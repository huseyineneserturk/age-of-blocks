// Wire protocol between client and the authoritative server.
// Clients only ever send COMMANDS; the server simulates and broadcasts
// snapshots. A client can never set positions/HP directly.

import type { BuildingKind } from '../data/buildings';
import type { Team, UnitKind } from '../data/units';
import type { CivId } from '../data/civs';
import type { SimEvent, Upgrades } from '../game/world';

export const SNAPSHOT_INTERVAL_MS = 100; // 10 Hz state broadcast

/** Lobby state pushed to every connected client (online count + open rooms). */
export interface LobbyState {
  online: number;
  rooms: Array<{ code: string; civ: CivId; name: string; locked: boolean }>;
}

export type ClientCommand =
  | { t: 'move'; ids: number[]; x: number; y: number }
  | { t: 'amove'; ids: number[]; x: number; y: number }
  | { t: 'attack'; ids: number[]; target: number }
  | { t: 'attackB'; ids: number[]; target: number }
  | { t: 'attackR'; ids: number[]; target: number }
  | { t: 'build'; kind: BuildingKind; x: number; y: number }
  | { t: 'train'; building: number; kind: UnitKind }
  | { t: 'research'; building: number }
  | { t: 'pick'; id: string }
  | { t: 'rally'; building: number; x: number; y: number };

export interface SnapUnit {
  id: number;
  team: Team;
  kind: UnitKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  moving: boolean;
  attacking: boolean;
}

export interface SnapBuilding {
  id: number;
  team: Team;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  buildProgress: number;
  queue: UnitKind[];
  trainProgress: number;
  rallyX: number | null;
  rallyY: number | null;
  researching: boolean;
  researchTimer: number;
}

export interface SnapRock {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface SnapProjectile {
  kind: 'arrow' | 'boulder';
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  progress: number;
  team: Team;
}

export interface SnapPlayer {
  civ: CivId;
  gold: number;
  supplyUsed: number;
  supplyCap: number;
  upgrades: Upgrades;
  researchPoints: number;
  usedUpgrades: string[];
  offer: string[];
}

export interface Snapshot {
  winner: Team | null;
  units: SnapUnit[];
  buildings: SnapBuilding[];
  rocks: SnapRock[];
  projectiles: SnapProjectile[];
  players: [SnapPlayer, SnapPlayer];
  events: SimEvent[];
}
