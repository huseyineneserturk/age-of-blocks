// Fog of war (classic AoE): unexplored (dark) / explored (dim, terrain only) /
// visible. Computed for the player's team; the AI plays with full vision.

import { Terrain } from '../engine/grid';
import { BUILDINGS } from '../data/buildings';
import type { World } from './world';

export const FOG_UNEXPLORED = 0;
export const FOG_EXPLORED = 1;
export const FOG_VISIBLE = 2;

const UNIT_VISION = 6;
const HILL_BONUS = 2;

const BUILDING_VISION: Partial<Record<keyof typeof BUILDINGS, number>> = {
  castle: 9,
  tower: 9,
};

export class FogOfWar {
  readonly state: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.state = new Uint8Array(w * h).fill(FOG_UNEXPLORED);
  }

  update(world: World, team: 0 | 1 = 0): void {
    // Downgrade visible → explored.
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] === FOG_VISIBLE) this.state[i] = FOG_EXPLORED;
    }

    for (const u of world.units) {
      if (!u.alive || u.team !== team) continue;
      let vision = UNIT_VISION;
      if (world.map.get(Math.floor(u.x), Math.floor(u.y)) === Terrain.Hill) vision += HILL_BONUS;
      this.stamp(u.x, u.y, vision);
    }
    for (const b of world.buildings) {
      if (!b.alive || b.team !== team) continue;
      const vision = BUILDING_VISION[b.kind] ?? 6;
      this.stamp(b.x + b.w / 2, b.y + b.h / 2, vision);
    }
  }

  private stamp(cx: number, cy: number, r: number): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.state[y * this.w + x] = FOG_VISIBLE;
      }
    }
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return FOG_UNEXPLORED;
    return this.state[y * this.w + x];
  }

  isVisible(x: number, y: number): boolean {
    return this.at(Math.floor(x), Math.floor(y)) === FOG_VISIBLE;
  }

  isExplored(x: number, y: number): boolean {
    return this.at(Math.floor(x), Math.floor(y)) >= FOG_EXPLORED;
  }
}
