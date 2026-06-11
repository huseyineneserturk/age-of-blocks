// Player commands: turn a right-click into per-unit paths with formation
// slots around the target so groups arrive in a loose block, not a stack.

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

/** Order the given units to move toward (tx, ty) in tile coords. */
export function issueMove(world: World, units: Unit[], tx: number, ty: number): void {
  if (units.length === 0) return;
  const slots = formationSlots(world.map, tx, ty, units.length);
  if (slots.length === 0) return;

  // Greedy nearest assignment: keeps crossing paths to a minimum.
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
    }
  }
}
