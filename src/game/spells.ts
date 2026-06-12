// Commander spells, cast from the castle with energy: a player-skill layer.
// Meteor = AoE damage at a point; Heal = AoE heal for own units.

import { TRAIN } from '../data/buildings';
import type { World } from './world';

export type SpellKind = 'meteor' | 'heal';

export interface SpellDef {
  kind: SpellKind;
  label: string;
  icon: string;
  cost: number; // energy
  radius: number;
  hotkey: string;
}

export const SPELLS: Record<SpellKind, SpellDef> = {
  meteor: { kind: 'meteor', label: 'Meteor', icon: '☄️', cost: 50, radius: 2.2, hotkey: 'q' },
  heal:   { kind: 'heal',   label: 'Şifa',   icon: '💚', cost: 35, radius: 2.6, hotkey: 'w' },
};

export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 2.2; // per second

const METEOR_DAMAGE = 85;
const HEAL_AMOUNT = 65;

export function castSpell(world: World, team: 0 | 1, kind: SpellKind, x: number, y: number): boolean {
  const p = world.players[team];
  const s = SPELLS[kind];
  if (p.energy < s.cost) return false;
  // A castle must stand to channel commander magic.
  if (!world.buildings.some((b) => b.alive && b.team === team && b.kind === 'castle')) return false;

  p.energy -= s.cost;

  if (kind === 'meteor') {
    for (const u of world.units) {
      if (!u.alive || u.team === team) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d <= s.radius) {
        const falloff = 1 - (d / s.radius) * 0.4;
        u.hp -= METEOR_DAMAGE * falloff;
        u.lastHitBy = team;
      }
    }
    for (const b of world.buildings) {
      if (!b.alive || b.team === team) continue;
      if (world.distToBuilding(x, y, b) <= s.radius) b.hp -= METEOR_DAMAGE * 0.45;
    }
    for (const r of world.rocks) {
      if (r.alive && Math.hypot(r.x + 0.5 - x, r.y + 0.5 - y) <= s.radius + 0.5) {
        r.hp -= METEOR_DAMAGE;
      }
    }
  } else {
    for (const u of world.units) {
      if (!u.alive || u.team !== team) continue;
      if (Math.hypot(u.x - x, u.y - y) <= s.radius) {
        u.hp = Math.min(u.maxHp, u.hp + HEAL_AMOUNT);
      }
    }
  }

  world.events.push({ type: 'spell', spell: kind, x, y, team });
  return true;
}

/** Gold bounty for killing an enemy unit (claimed by lastHitBy). */
export function killBounty(kind: keyof typeof TRAIN): number {
  return Math.round(TRAIN[kind].cost * 0.4);
}
