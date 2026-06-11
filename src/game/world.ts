// World state: the tile map + all living entities + per-team economy.
// Pure data + spawn helpers; systems operate on this.

import { TileMap, Terrain } from '../engine/grid';
import { UNITS, type Team, type UnitKind } from '../data/units';
import { BUILDINGS, START_GOLD, type BuildingKind } from '../data/buildings';
import type { Waypoint } from '../engine/astar';

export type UnitOrder = 'idle' | 'move' | 'attack' | 'attackmove';

export interface Unit {
  id: number;
  team: Team;
  kind: UnitKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  facing: 1 | -1;
  animTime: number;
  moving: boolean;
  attacking: boolean;
  attackAnimTimer: number;
  path: Waypoint[] | null;
  pathIdx: number;
  order: UnitOrder;
  targetId: number | null; // enemy unit
  targetBuildingId: number | null; // enemy building
  anchorX: number;
  anchorY: number;
  amX: number;
  amY: number;
  atkTimer: number;
  repathTimer: number;
}

export interface Building {
  id: number;
  team: Team;
  kind: BuildingKind;
  x: number; // top-left tile
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 0..1 construction progress; 1 = operational. */
  buildProgress: number;
  queue: UnitKind[];
  trainProgress: number; // seconds into current queue item
  rallyX: number | null;
  rallyY: number | null;
  atkTimer: number; // towers
  researchTimer: number; // research building point accrual
}

export interface Upgrades {
  damage: number; // multipliers, start at 1
  health: number;
  speed: number;
  income: number;
  atkspeed: number;
}

export interface PlayerState {
  team: Team;
  gold: number;
  supplyUsed: number;
  supplyCap: number;
  upgrades: Upgrades;
  researchPoints: number;
  usedUpgrades: string[];
  /** Current 3 offered upgrade ids (empty = no offer pending). */
  offer: string[];
}

export interface Projectile {
  kind: 'arrow' | 'boulder';
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  progress: number;
  speed: number;
  targetId: number | null;
  targetBuildingId: number | null;
  shooterId: number;
  damage: number;
  splash: number;
  team: Team;
  attackerKind: UnitKind;
}

export type SimEvent =
  | { type: 'melee_hit'; x: number; y: number; team: Team }
  | { type: 'arrow_fire'; x: number; y: number }
  | { type: 'arrow_hit'; x: number; y: number; team: Team }
  | { type: 'boulder_fire'; x: number; y: number }
  | { type: 'boulder_hit'; x: number; y: number; radius: number }
  | { type: 'magic_cast'; fromX: number; fromY: number; toX: number; toY: number; team: Team }
  | { type: 'death'; x: number; y: number; team: Team }
  | { type: 'building_destroyed'; x: number; y: number; team: Team; kind: BuildingKind }
  | { type: 'train_done'; x: number; y: number; team: Team }
  | { type: 'build_placed'; x: number; y: number; team: Team };

function makePlayer(team: Team): PlayerState {
  return {
    team,
    gold: START_GOLD,
    supplyUsed: 0,
    supplyCap: 0,
    upgrades: { damage: 1, health: 1, speed: 1, income: 1, atkspeed: 1 },
    researchPoints: 0,
    usedUpgrades: [],
    offer: [],
  };
}

export class World {
  units: Unit[] = [];
  buildings: Building[] = [];
  projectiles: Projectile[] = [];
  events: SimEvent[] = [];
  players: [PlayerState, PlayerState] = [makePlayer(0), makePlayer(1)];
  /** Set when a castle falls: winning team. */
  winner: Team | null = null;
  private nextId = 1;

  constructor(readonly map: TileMap) {}

  spawnUnit(team: Team, kind: UnitKind, x: number, y: number): Unit {
    const def = UNITS[kind];
    const hpMul = this.players[team].upgrades.health;
    const u: Unit = {
      id: this.nextId++,
      team,
      kind,
      x,
      y,
      prevX: x,
      prevY: y,
      hp: def.hp * hpMul,
      maxHp: def.hp * hpMul,
      alive: true,
      facing: team === 0 ? 1 : -1,
      animTime: 0,
      moving: false,
      attacking: false,
      attackAnimTimer: 0,
      path: null,
      pathIdx: 0,
      order: 'idle',
      targetId: null,
      targetBuildingId: null,
      anchorX: x,
      anchorY: y,
      amX: x,
      amY: y,
      atkTimer: 0,
      repathTimer: 0,
    };
    this.units.push(u);
    return u;
  }

  /**
   * Place a building with its top-left at tile (tx, ty). Marks tiles blocked.
   * `instant` completes construction immediately (initial castles etc.).
   */
  placeBuilding(team: Team, kind: BuildingKind, tx: number, ty: number, instant = false): Building {
    const def = BUILDINGS[kind];
    const b: Building = {
      id: this.nextId++,
      team,
      kind,
      x: tx,
      y: ty,
      w: def.w,
      h: def.h,
      hp: instant ? def.hp : def.hp * 0.1,
      maxHp: def.hp,
      alive: true,
      buildProgress: instant ? 1 : 0,
      queue: [],
      trainProgress: 0,
      rallyX: null,
      rallyY: null,
      atkTimer: 0,
      researchTimer: 0,
    };
    this.buildings.push(b);
    for (let y = ty; y < ty + def.h; y++) {
      for (let x = tx; x < tx + def.w; x++) this.map.setBlocked(x, y, true);
    }
    return b;
  }

  removeBuilding(b: Building): void {
    b.alive = false;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) this.map.setBlocked(x, y, false);
    }
  }

  /** Can a building footprint go at (tx, ty)? */
  canPlace(kind: BuildingKind, tx: number, ty: number): boolean {
    const def = BUILDINGS[kind];
    for (let y = ty; y < ty + def.h; y++) {
      for (let x = tx; x < tx + def.w; x++) {
        if (!this.map.inBounds(x, y)) return false;
        if (this.map.isBlocked(x, y)) return false;
        const t = this.map.get(x, y);
        if (def.onGold) {
          if (t !== Terrain.Gold) return false;
        } else if (t !== Terrain.Grass && t !== Terrain.Hill) {
          return false;
        }
        // Keep a unit-free footprint.
        for (const u of this.units) {
          if (u.x >= x && u.x < x + 1 && u.y >= y && u.y < y + 1) return false;
        }
      }
    }
    return true;
  }

  getUnit(id: number): Unit | undefined {
    return this.units.find((u) => u.id === id && u.alive);
  }

  getBuilding(id: number): Building | undefined {
    return this.buildings.find((b) => b.id === id && b.alive);
  }

  buildingCenter(b: Building): { x: number; y: number } {
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  /** Distance from a point to a building's rect (0 if inside). */
  distToBuilding(px: number, py: number, b: Building): number {
    const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
    const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
    return Math.hypot(dx, dy);
  }

  unitsOfTeam(team: Team): Unit[] {
    return this.units.filter((u) => u.team === team);
  }
}
