// Movement system: waypoint following + soft separation between units.
// Anti-stuck measures: terrain guard on every step (buildings placed onto a
// path can't be walked through), waypoint lookahead after pushes, and a
// stuck detector that forces a repath toward the remaining destination.

import { findPath } from '../engine/astar';
import { Terrain, TileMap } from '../engine/grid';
import { UNITS } from '../data/units';
import type { Unit, World } from './world';

const WAYPOINT_REACH = 0.18; // tiles
const FINAL_REACH = 0.16;
const STUCK_CHECK = 0.8; // seconds between progress checks
const STUCK_MIN_PROGRESS = 0.2; // tiles moved per check window

export function updateMovement(world: World, dt: number): void {
  for (const u of world.units) {
    u.prevX = u.x;
    u.prevY = u.y;
    u.moving = false;

    if (!u.path || u.pathIdx >= u.path.length) {
      u.path = null;
      u.stuckTimer = 0;
      continue;
    }

    const def = UNITS[u.kind];

    // Waypoint lookahead: after being pushed around, the next waypoint may
    // already be closer than the current one — skip ahead to avoid backtracking.
    if (u.pathIdx + 1 < u.path.length) {
      const cur = u.path[u.pathIdx];
      const nxt = u.path[u.pathIdx + 1];
      const dCur = Math.hypot(cur.x - u.x, cur.y - u.y);
      const dNxt = Math.hypot(nxt.x - u.x, nxt.y - u.y);
      const dCurToNxt = Math.hypot(nxt.x - cur.x, nxt.y - cur.y);
      if (dNxt < dCurToNxt && dNxt < dCur + dCurToNxt * 0.5) u.pathIdx++;
    }

    const wp = u.path[u.pathIdx];
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const dist = Math.hypot(dx, dy);
    const isLast = u.pathIdx === u.path.length - 1;
    const reach = isLast ? FINAL_REACH : WAYPOINT_REACH;

    if (dist <= reach) {
      u.pathIdx++;
      if (u.pathIdx >= u.path.length) {
        u.path = null;
        u.stuckTimer = 0;
        // A completed plain move becomes a new idle post (leash anchor).
        if (u.order === 'move') {
          u.order = 'idle';
          u.anchorX = u.x;
          u.anchorY = u.y;
        }
      }
      continue;
    }

    const speedMul = u.team === 2 ? 1 : world.players[u.team].upgrades.speed;
    let terrainMul = world.map.speedAt(u.x, u.y);
    // Celt — Orman Halkı: forests never slow them down.
    if (
      terrainMul < 1 &&
      world.civOf(u.team)?.forestFullSpeed &&
      world.map.get(Math.floor(u.x), Math.floor(u.y)) === Terrain.Forest
    ) {
      terrainMul = 1;
    }
    let speed = def.speed * terrainMul * speedMul;
    if (u.kind === 'commander' && u.team !== 2 && world.players[u.team]?.civ === 'celt') {
      speed *= 1.3;
    }
    const step = Math.min(dist, speed * dt);
    const nx = u.x + (dx / dist) * step;
    const ny = u.y + (dy / dist) * step;

    // Terrain guard: never walk into an impassable/blocked tile (e.g. a
    // building placed onto this path after it was computed) — slide/repath instead.
    const resolved = resolveTerrainCollision(world.map, nx, ny, def.radius);
    if (world.map.passable(Math.floor(resolved.x), Math.floor(resolved.y))) {
      u.x = resolved.x;
      u.y = resolved.y;
      u.moving = true;
      u.animTime += dt;
      if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
    } else {
      repathToDestination(world, u);
      continue;
    }

    // Stuck detection: while following a path, require real progress.
    u.stuckTimer += dt;
    if (u.stuckTimer >= STUCK_CHECK) {
      const progressed = Math.hypot(u.x - u.lastPX, u.y - u.lastPY);
      u.stuckTimer = 0;
      u.lastPX = u.x;
      u.lastPY = u.y;
      if (progressed < STUCK_MIN_PROGRESS) {
        repathToDestination(world, u);
      }
    }
  }

  separate(world);
}

/** Recompute the path to the current path's final destination. */
function repathToDestination(world: World, u: Unit): void {
  if (!u.path || u.path.length === 0) {
    u.path = null;
    return;
  }
  const dest = u.path[u.path.length - 1];
  const p = findPath(world.map, u.x, u.y, dest.x, dest.y);
  u.path = p;
  u.pathIdx = 0;
  u.stuckTimer = 0;
  u.lastPX = u.x;
  u.lastPY = u.y;
}

/** Soft push-apart so units don't stack. Idle units yield to moving ones. */
function separate(world: World): void {
  const units = world.units;
  const SOFTNESS = 0.65; // resolve only part of the overlap per tick — less jitter
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    const ra = UNITS[a.kind].radius;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      const rb = UNITS[b.kind].radius;
      const minDist = ra + rb;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= minDist || d === 0) {
        if (d === 0) {
          dx = (Math.random() - 0.5) * 0.01 || 0.01;
          dy = (Math.random() - 0.5) * 0.01;
          d = Math.hypot(dx, dy);
        } else {
          continue;
        }
      }
      const overlap = (minDist - d) * SOFTNESS;
      const nx = dx / d;
      const ny = dy / d;
      // Moving units push idle ones aside more than vice versa.
      const aShare = a.moving === b.moving ? 0.5 : a.moving ? 0.25 : 0.75;
      tryShift(world, a, -nx * overlap * aShare, -ny * overlap * aShare);
      tryShift(world, b, nx * overlap * (1 - aShare), ny * overlap * (1 - aShare));
    }
  }
}

function tryShift(world: World, u: Unit, dx: number, dy: number): void {
  const nx = u.x + dx;
  const ny = u.y + dy;
  const def = UNITS[u.kind];
  const resolved = resolveTerrainCollision(world.map, nx, ny, def.radius);
  if (world.map.passable(Math.floor(resolved.x), Math.floor(resolved.y))) {
    u.x = resolved.x;
    u.y = resolved.y;
  }
}

export function resolveTerrainCollision(map: TileMap, x: number, y: number, r: number): { x: number; y: number } {
  let cx = x;
  let cy = y;

  const minX = Math.floor(cx - r);
  const maxX = Math.floor(cx + r);
  const minY = Math.floor(cy - r);
  const maxY = Math.floor(cy + r);

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!map.passable(tx, ty)) {
        const px = Math.max(tx, Math.min(cx, tx + 1));
        const py = Math.max(ty, Math.min(cy, ty + 1));

        const vx = cx - px;
        const vy = cy - py;
        const d = Math.hypot(vx, vy);

        if (d < r) {
          const overlap = r - d;
          if (d > 0) {
            cx += (vx / d) * overlap;
            cy += (vy / d) * overlap;
          } else {
            const tileCenterX = tx + 0.5;
            const tileCenterY = ty + 0.5;
            const pdx = cx - tileCenterX;
            const pdy = cy - tileCenterY;
            const pd = Math.hypot(pdx, pdy);
            if (pd > 0) {
              cx += (pdx / pd) * r;
              cy += (pdy / pd) * r;
            } else {
              cx += r;
              cy += r;
            }
          }
        }
      }
    }
  }

  return { x: cx, y: cy };
}
