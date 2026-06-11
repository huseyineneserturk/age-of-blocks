// Building + research data tables.

import type { UnitKind } from './units';

export type BuildingKind =
  | 'castle'
  | 'house'
  | 'mine'
  | 'barracks'
  | 'archery'
  | 'stable'
  | 'magetower'
  | 'siegeworks'
  | 'tower'
  | 'wall'
  | 'research';

export interface BuildingDef {
  kind: BuildingKind;
  label: string;
  icon: string;
  hp: number;
  cost: number;
  buildTime: number; // seconds of construction
  w: number; // size in tiles
  h: number;
  trains?: UnitKind[];
  income?: number; // gold per second when complete
  supply?: number; // population capacity provided
  onGold?: boolean; // must be placed on a gold node tile
  range?: number; // tower attack
  damage?: number;
  attackCooldown?: number;
  hotkey?: string;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  castle:     { kind: 'castle',     label: 'Kale',          icon: '🏰', hp: 2200, cost: 0,   buildTime: 0,  w: 3, h: 3, income: 3, supply: 10 },
  house:      { kind: 'house',      label: 'Ev',            icon: '🏠', hp: 350,  cost: 50,  buildTime: 6,  w: 1, h: 1, supply: 8, hotkey: '1' },
  mine:       { kind: 'mine',       label: 'Maden',         icon: '⛏️', hp: 450,  cost: 90,  buildTime: 10, w: 1, h: 1, income: 6, onGold: true, hotkey: '2' },
  barracks:   { kind: 'barracks',   label: 'Kışla',         icon: '⚔️', hp: 700,  cost: 150, buildTime: 12, w: 2, h: 2, trains: ['knight', 'spear'], hotkey: '3' },
  archery:    { kind: 'archery',    label: 'Atış Alanı',    icon: '🏹', hp: 600,  cost: 175, buildTime: 12, w: 2, h: 2, trains: ['archer'], hotkey: '4' },
  stable:     { kind: 'stable',     label: 'Ahır',          icon: '🐴', hp: 700,  cost: 200, buildTime: 14, w: 2, h: 2, trains: ['cavalry'], hotkey: '5' },
  magetower:  { kind: 'magetower',  label: 'Büyücü Kulesi', icon: '🔮', hp: 550,  cost: 225, buildTime: 15, w: 2, h: 2, trains: ['mage'], hotkey: '6' },
  siegeworks: { kind: 'siegeworks', label: 'Kuşatma',       icon: '🛠️', hp: 650,  cost: 250, buildTime: 16, w: 2, h: 2, trains: ['catapult'], hotkey: '7' },
  research:   { kind: 'research',   label: 'Araştırma',     icon: '📚', hp: 500,  cost: 200, buildTime: 14, w: 2, h: 2, hotkey: '8' },
  tower:      { kind: 'tower',      label: 'Kule',          icon: '🗼', hp: 800,  cost: 100, buildTime: 10, w: 1, h: 1, range: 6, damage: 18, attackCooldown: 1.1, hotkey: '9' },
  wall:       { kind: 'wall',       label: 'Duvar',         icon: '🧱', hp: 900,  cost: 25,  buildTime: 3,  w: 1, h: 1, hotkey: '0' },
};

export const BUILD_MENU: BuildingKind[] = [
  'house', 'mine', 'barracks', 'archery', 'stable', 'magetower', 'siegeworks', 'research', 'tower', 'wall',
];

export const SIEGE_VS_BUILDING = 4; // catapult bonus vs buildings

// --- Unit training costs ---

export interface TrainDef {
  cost: number;
  supply: number;
  time: number; // seconds
}

export const TRAIN: Record<UnitKind, TrainDef> = {
  knight:   { cost: 60,  supply: 1, time: 7 },
  spear:    { cost: 50,  supply: 1, time: 6 },
  archer:   { cost: 70,  supply: 1, time: 8 },
  cavalry:  { cost: 110, supply: 2, time: 11 },
  mage:     { cost: 130, supply: 2, time: 13 },
  catapult: { cost: 170, supply: 3, time: 16 },
};

export const QUEUE_MAX = 5;
export const START_GOLD = 350;

// --- Research upgrades (v1's pick-1-of-3 system) ---

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  effect: 'damage' | 'health' | 'speed' | 'income' | 'atkspeed';
  value: number; // additive multiplier bonus, e.g. 0.15 = +15%
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'damage1', name: 'Keskin Kılıçlar', desc: 'Tüm birimler +15% hasar', icon: '⚔️', effect: 'damage', value: 0.15 },
  { id: 'damage2', name: 'Ağır Darbeler', desc: 'Tüm birimler +25% hasar', icon: '💥', effect: 'damage', value: 0.25 },
  { id: 'health1', name: 'Kalın Zırh', desc: 'Yeni birimler +20% HP', icon: '🛡️', effect: 'health', value: 0.20 },
  { id: 'health2', name: 'Demir İrade', desc: 'Yeni birimler +35% HP', icon: '⛓️', effect: 'health', value: 0.35 },
  { id: 'speed1', name: 'Hızlı Adımlar', desc: 'Birimler %15 hızlı yürür', icon: '💨', effect: 'speed', value: 0.15 },
  { id: 'atkspeed1', name: 'Savaş Öfkesi', desc: 'Birimler %20 hızlı saldırır', icon: '🔥', effect: 'atkspeed', value: 0.20 },
  { id: 'income1', name: 'Verimli Madencilik', desc: '+%25 altın geliri', icon: '🪙', effect: 'income', value: 0.25 },
  { id: 'income2', name: 'Altına Hücum', desc: '+%45 altın geliri', icon: '💰', effect: 'income', value: 0.45 },
];

export const RESEARCH_INTERVAL = 35; // seconds per extra research point
