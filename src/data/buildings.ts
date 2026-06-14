// Building + research data tables.

import type { UnitKind } from './units';

export type BuildingKind =
  | 'castle'
  | 'house'
  | 'mine'
  | 'barracks'
  | 'archery'
  | 'stable'
  | 'siegeworks'
  | 'research'
  | 'tower'
  | 'wall'
  | 'colosseum' | 'forum'        // Rome
  | 'mosque' | 'caravanserai'    // Ottoman
  | 'pagoda' | 'bastion'         // China
  | 'longhouse' | 'shrine'       // Viking
  | 'grove' | 'stone_circle';    // Celt

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
  castle:     { kind: 'castle',     label: 'Kale',          icon: '🏰', hp: 2200, cost: 0,   buildTime: 0,  w: 3, h: 3, income: 1, supply: 10, trains: ['villager'] },
  house:      { kind: 'house',      label: 'Ev',            icon: '🏠', hp: 350,  cost: 50,  buildTime: 6,  w: 1, h: 1, supply: 8, hotkey: '1' },
  mine:       { kind: 'mine',       label: 'Maden',         icon: '⛏️', hp: 450,  cost: 90,  buildTime: 10, w: 1, h: 1, income: 3, onGold: true, hotkey: '2' },
  barracks:   { kind: 'barracks',   label: 'Kışla',         icon: '⚔️', hp: 700,  cost: 150, buildTime: 12, w: 2, h: 2, trains: ['knight', 'spear'], hotkey: '3' },
  archery:    { kind: 'archery',    label: 'Atış Alanı',    icon: '🏹', hp: 600,  cost: 175, buildTime: 12, w: 2, h: 2, trains: ['archer'], hotkey: '4' },
  stable:     { kind: 'stable',     label: 'Ahır',          icon: '🐴', hp: 700,  cost: 200, buildTime: 14, w: 2, h: 2, trains: ['cavalry'], hotkey: '5' },
  siegeworks: { kind: 'siegeworks', label: 'Kuşatma',       icon: '🛠️', hp: 650,  cost: 250, buildTime: 16, w: 2, h: 2, trains: ['catapult'], hotkey: '6' },
  research:   { kind: 'research',   label: 'Araştırma',     icon: '📚', hp: 500,  cost: 200, buildTime: 14, w: 2, h: 2, hotkey: '7' },
  tower:      { kind: 'tower',      label: 'Kule',          icon: '🗼', hp: 800,  cost: 100, buildTime: 10, w: 1, h: 1, range: 6, damage: 18, attackCooldown: 1.1, hotkey: '8' },
  wall:       { kind: 'wall',       label: 'Duvar',         icon: '🧱', hp: 900,  cost: 25,  buildTime: 3,  w: 1, h: 1, hotkey: '9' },
  colosseum:    { kind: 'colosseum',    label: 'Kolezyum',          icon: '🏟️', hp: 1600, cost: 250, buildTime: 20, w: 2, h: 2, trains: ['gladiator'], hotkey: 'q' },
  forum:        { kind: 'forum',        label: 'Roma Forumu',       icon: '🏛️', hp: 900,  cost: 150, buildTime: 15, w: 2, h: 2, income: 2, hotkey: 'w' },
  mosque:       { kind: 'mosque',       label: 'Mehmed Camii',      icon: '🕌', hp: 1200, cost: 180, buildTime: 18, w: 2, h: 2, trains: ['janissary'], hotkey: 'q' },
  caravanserai: { kind: 'caravanserai', label: 'Kervansaray',       icon: '⛺', hp: 800,  cost: 140, buildTime: 14, w: 2, h: 2, income: 2, hotkey: 'w' },
  pagoda:       { kind: 'pagoda',       label: 'Pagoda Tapınağı',   icon: '🛕', hp: 1000, cost: 130, buildTime: 14, w: 2, h: 2, income: 1, supply: 12, hotkey: 'q' },
  bastion:      { kind: 'bastion',      label: 'Çin Seddi Tabyası',  icon: '🏯', hp: 2000, cost: 160, buildTime: 15, w: 1, h: 1, range: 7.0, damage: 24, attackCooldown: 1.2, hotkey: 'w' },
  longhouse:    { kind: 'longhouse',    label: 'Büyük Salon',       icon: '🛖', hp: 1100, cost: 150, buildTime: 15, w: 2, h: 2, trains: ['berserker'], hotkey: 'q' },
  shrine:       { kind: 'shrine',       label: 'Odin Tapınağı',     icon: '🪵', hp: 900,  cost: 140, buildTime: 14, w: 2, h: 2, income: 1.5, hotkey: 'w' },
  grove:        { kind: 'grove',        label: 'Kutsal Koruluk',    icon: '🌳', hp: 800,  cost: 130, buildTime: 14, w: 2, h: 2, trains: ['druid'], hotkey: 'q' },
  stone_circle: { kind: 'stone_circle', label: 'Megolitik Taşlar',  icon: '🪨', hp: 1000, cost: 120, buildTime: 12, w: 2, h: 2, income: 1.5, hotkey: 'w' },
};

export const BUILD_MENU: BuildingKind[] = [
  'house', 'mine', 'barracks', 'archery', 'stable', 'siegeworks', 'research', 'tower', 'wall',
  'colosseum', 'forum', 'mosque', 'caravanserai', 'pagoda', 'bastion', 'longhouse', 'shrine', 'grove', 'stone_circle'
];

export const SIEGE_VS_BUILDING = 4; // catapult bonus vs buildings

// --- Unit training costs ---

export interface TrainDef {
  cost: number;
  supply: number;
  time: number; // seconds
}

export const TRAIN: Record<UnitKind, TrainDef> = {
  knight:    { cost: 60,  supply: 1, time: 7 },
  spear:     { cost: 50,  supply: 1, time: 6 },
  archer:    { cost: 70,  supply: 1, time: 8 },
  cavalry:   { cost: 110, supply: 2, time: 11 },
  villager:  { cost: 50,  supply: 1, time: 6 },
  commander: { cost: 0,   supply: 0, time: 0 },
  catapult:  { cost: 170, supply: 3, time: 16 },
  gladiator: { cost: 80,  supply: 1, time: 9 },
  janissary: { cost: 90,  supply: 1, time: 10 },
  berserker: { cost: 80,  supply: 1, time: 9 },
  druid:     { cost: 85,  supply: 1, time: 10 },
  // Neutral monsters — never trained, table entries for type completeness.
  golem:    { cost: 0, supply: 0, time: 0 },
  wolf:     { cost: 0, supply: 0, time: 0 },
  pirate:   { cost: 0, supply: 0, time: 0 },
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

// Research is bought with gold: each purchase costs more and takes time.
export const RESEARCH_BASE_COST = 80;
export const RESEARCH_COST_STEP = 40;
export const RESEARCH_TIME = 16; // seconds per research
