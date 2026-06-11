// Movement system: waypoint following + soft separation between units.
// Runs on the fixed sim tick.

import { UNITS } from '../data/units';
import type { Unit, World } from './world';

const WAYPOINT_REACH = 0.18; // tiles
const FINAL_REACH = 0.12;

export function updateMovement(world: World, dt: number): void {
  for (const u of world.units) {
    u.prevX = u.x;
    u.prevY = u.y;
    u.moving = false;

    if (!u.path || u.pathIdx >= u.path.length) {
      u.path = null;
      continue;
    }

    const def = UNITS[u.kind];
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
      }
      continue;
    }

    const speed = def.speed * world.map.speedAt(u.x, u.y);
    const step = Math.min(dist, speed * dt);
    u.x += (dx / dist) * step;
    u.y += (dy / dist) * step;
    u.moving = true;
    u.animTime += dt;
    if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
  }

  separate(world);
}

/** Soft push-apart so units don't stack. Idle units yield to moving ones. */
function separate(world: World): void {
  const units = world.units;
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
      const overlap = minDist - d;
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
  if (world.map.passable(Math.floor(nx), Math.floor(u.y))) u.x = nx;
  if (world.map.passable(Math.floor(u.x), Math.floor(ny))) u.y = ny;
}
