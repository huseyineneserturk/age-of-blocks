// World state: the tile map + all living entities. Pure data + spawn helpers;
// systems (movement, combat, projectiles) operate on this.

import { TileMap } from '../engine/grid';
import { UNITS, type Team, type UnitKind } from '../data/units';
import type { Waypoint } from '../engine/astar';

export type UnitOrder = 'idle' | 'move' | 'attack' | 'attackmove';

export interface Unit {
  id: number;
  team: Team;
  kind: UnitKind;
  // Position in tile units (float). prev* for render interpolation.
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
  // Movement
  path: Waypoint[] | null;
  pathIdx: number;
  // Combat / orders
  order: UnitOrder;
  targetId: number | null;
  anchorX: number; // idle post — leash center
  anchorY: number;
  amX: number; // attack-move destination
  amY: number;
  atkTimer: number; // attack cooldown remaining
  repathTimer: number; // throttle chase repaths
}

export interface Projectile {
  kind: 'arrow' | 'boulder';
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  progress: number; // 0..1
  speed: number; // tiles/sec
  targetId: number | null; // homing target
  shooterId: number;
  damage: number;
  splash: number; // 0 = single target
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
  | { type: 'death'; x: number; y: number; team: Team };

export class World {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  /** Sim events accumulated during ticks; renderer consumes + clears each frame. */
  events: SimEvent[] = [];
  private nextId = 1;

  constructor(readonly map: TileMap) {}

  spawnUnit(team: Team, kind: UnitKind, x: number, y: number): Unit {
    const def = UNITS[kind];
    const u: Unit = {
      id: this.nextId++,
      team,
      kind,
      x,
      y,
      prevX: x,
      prevY: y,
      hp: def.hp,
      maxHp: def.hp,
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

  getUnit(id: number): Unit | undefined {
    return this.units.find((u) => u.id === id && u.alive);
  }

  unitsOfTeam(team: Team): Unit[] {
    return this.units.filter((u) => u.team === team);
  }
}
