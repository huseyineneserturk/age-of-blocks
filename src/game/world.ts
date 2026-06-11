// World state: the tile map + all living entities. Pure data + spawn helpers;
// systems (movement, combat) operate on this.

import { TileMap } from '../engine/grid';
import { UNITS, type Team, type UnitKind } from '../data/units';
import type { Waypoint } from '../engine/astar';

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
  facing: 1 | -1;
  animTime: number;
  moving: boolean;
  attacking: boolean;
  // Movement
  path: Waypoint[] | null;
  pathIdx: number;
}

export class World {
  units: Unit[] = [];
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
      facing: team === 0 ? 1 : -1,
      animTime: 0,
      moving: false,
      attacking: false,
      path: null,
      pathIdx: 0,
    };
    this.units.push(u);
    return u;
  }

  unitsOfTeam(team: Team): Unit[] {
    return this.units.filter((u) => u.team === team);
  }
}
