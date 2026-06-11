// Player commands: move, attack a target, attack-move. Groups get formation
// slots around the destination so they arrive as a loose block, not a stack.

import { findPath } from '../engine/astar';
import type { TileMap } from '../engine/grid';
import type { Unit, World } from './world';

/** Generate n passable formation slots spiraling out from the target tile. */
function formationSlots(map: TileMap, tx: number, ty: number, n: number): Array<{ x: number; y: number }> {
  const slots: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  const cx = Math.floor(tx);
  const cy = Math.floor(ty);

  for (let r = 0; slots.length < n && r <= 12; r++) {
    for (let dy = -r; dy <= r && slots.length < n; dy++) {
      for (let dx = -r; dx <= r && slots.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (map.passable(x, y)) slots.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }
  return slots;
}

/** Greedy nearest unit→slot assignment + pathing. Returns assigned slots. */
function moveToSlots(world: World, units: Unit[], tx: number, ty: number): Map<Unit, { x: number; y: number }> {
  const assigned = new Map<Unit, { x: number; y: number }>();
  const slots = formationSlots(world.map, tx, ty, units.length);
  if (slots.length === 0) return assigned;

  const remaining = [...units];
  for (const slot of slots) {
    if (remaining.length === 0) break;
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = Math.hypot(remaining[i].x - slot.x, remaining[i].y - slot.y);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const unit = remaining.splice(bestIdx, 1)[0];
    const path = findPath(world.map, unit.x, unit.y, slot.x, slot.y);
    if (path) {
      unit.path = path;
      unit.pathIdx = 0;
      assigned.set(unit, slot);
    }
  }
  return assigned;
}

/** Plain move: ignores enemies en route. */
export function issueMove(world: World, units: Unit[], tx: number, ty: number): void {
  if (units.length === 0) return;
  const assigned = moveToSlots(world, units, tx, ty);
  for (const unit of assigned.keys()) {
    unit.order = 'move';
    unit.targetId = null;
    unit.targetBuildingId = null;
    unit.targetRockId = null;
  }
}

/** Focus-fire a specific enemy: chase + attack until it dies. */
export function issueAttack(_world: World, units: Unit[], targetId: number): void {
  for (const unit of units) {
    unit.order = 'attack';
    unit.targetId = targetId;
    unit.targetBuildingId = null;
    unit.targetRockId = null;
    unit.repathTimer = 0; // chase immediately
  }
}

/** Focus a specific enemy building. */
export function issueAttackBuilding(_world: World, units: Unit[], buildingId: number): void {
  for (const unit of units) {
    unit.order = 'attack';
    unit.targetId = null;
    unit.targetBuildingId = buildingId;
    unit.targetRockId = null;
    unit.repathTimer = 0;
  }
}

/** Break a cracked rock (siege units are far more effective). */
export function issueAttackRock(_world: World, units: Unit[], rockId: number): void {
  for (const unit of units) {
    unit.order = 'attack';
    unit.targetId = null;
    unit.targetBuildingId = null;
    unit.targetRockId = rockId;
    unit.repathTimer = 0;
  }
}

/** Attack-move: march to a point, engaging anything encountered. */
export function issueAttackMove(world: World, units: Unit[], tx: number, ty: number): void {
  if (units.length === 0) return;
  const assigned = moveToSlots(world, units, tx, ty);
  for (const [unit, slot] of assigned) {
    unit.order = 'attackmove';
    unit.targetId = null;
    unit.targetBuildingId = null;
    unit.amX = slot.x;
    unit.amY = slot.y;
  }
  // Units that couldn't path still adopt the order so they engage locally.
  for (const unit of units) {
    if (!assigned.has(unit)) {
      unit.order = 'attackmove';
      unit.targetId = null;
      unit.targetBuildingId = null;
      unit.amX = tx;
      unit.amY = ty;
    }
  }
}
