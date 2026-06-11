// Unit stat tables. Numbers seeded from v1/v2 balance work; combat fields
// (damage/range/cooldown) activate in Phase 2.

export type UnitKind =
  | 'knight' | 'spear' | 'archer' | 'cavalry' | 'mage' | 'catapult'
  | 'golem' | 'wolf'; // neutral camp monsters

export interface UnitDef {
  kind: UnitKind;
  label: string;
  hp: number;
  damage: number;
  range: number; // tiles
  speed: number; // tiles per second
  attackCooldown: number; // seconds
  radius: number; // collision radius (tiles)
  aggro: number; // auto-acquire radius when idle (tiles)
  aoeRadius?: number;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  knight:   { kind: 'knight',   label: 'Knight',   hp: 150, damage: 14, range: 1.1, speed: 2.8, attackCooldown: 1.0,  radius: 0.32, aggro: 5 },
  spear:    { kind: 'spear',    label: 'Spearman', hp: 115, damage: 10, range: 1.5, speed: 2.4, attackCooldown: 1.0,  radius: 0.32, aggro: 5 },
  archer:   { kind: 'archer',   label: 'Archer',   hp: 80,  damage: 13, range: 4.8, speed: 2.6, attackCooldown: 1.2,  radius: 0.3,  aggro: 5.5 },
  cavalry:  { kind: 'cavalry',  label: 'Cavalry',  hp: 160, damage: 16, range: 1.2, speed: 4.2, attackCooldown: 1.05, radius: 0.42, aggro: 5 },
  mage:     { kind: 'mage',     label: 'Mage',     hp: 70,  damage: 24, range: 4.2, speed: 2.2, attackCooldown: 1.9,  radius: 0.3,  aggro: 5, aoeRadius: 1.5 },
  catapult: { kind: 'catapult', label: 'Catapult', hp: 170, damage: 40, range: 5.5, speed: 1.4, attackCooldown: 3.0,  radius: 0.46, aggro: 5.5 },
  golem:    { kind: 'golem',    label: 'Golem',    hp: 750, damage: 32, range: 1.3, speed: 1.6, attackCooldown: 1.6,  radius: 0.5,  aggro: 4 },
  wolf:     { kind: 'wolf',     label: 'Kurt',     hp: 180, damage: 14, range: 1.0, speed: 3.8, attackCooldown: 0.8,  radius: 0.3,  aggro: 4.5 },
};

// Counter multipliers (attacker → defender). Not overwhelming; micro decides.
const COUNTER: Partial<Record<UnitKind, Partial<Record<UnitKind, number>>>> = {
  knight: { archer: 1.5 },
  spear: { cavalry: 2.4 },
  archer: { spear: 1.8 },
  cavalry: { archer: 1.5, mage: 1.5, knight: 1.6 },
};

export function counterMultiplier(attacker: UnitKind, defender: UnitKind): number {
  return COUNTER[attacker]?.[defender] ?? 1.0;
}

/** 0 = player, 1 = enemy, 2 = neutral monsters. */
export type Team = 0 | 1 | 2;

export const TEAM_COLORS: Record<Team, { main: string; dark: string; glow: string }> = {
  0: { main: '#4a9eff', dark: '#2a6ecf', glow: 'rgba(74,158,255,0.5)' },
  1: { main: '#ff4a4a', dark: '#cf2a2a', glow: 'rgba(255,74,74,0.5)' },
  2: { main: '#a98ad0', dark: '#6d5394', glow: 'rgba(169,138,208,0.5)' },
};
