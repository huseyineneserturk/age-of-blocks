// Enemy RTS AI: builds an economy, trains counter units, defends its base
// and attacks in growing waves staged through the open (bottom) bridge.

import { BUILDINGS, type BuildingKind } from '../data/buildings';
import type { UnitKind } from '../data/units';
import type { GameMap } from '../data/maps/riverCrossing';
import { Terrain } from '../engine/grid';
import { issueAttackMove } from './commands';
import { enqueueUnit, pickUpgrade, researchCost, startResearch } from './economy';
import type { Building, Unit, World } from './world';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface DiffConfig {
  thinkInterval: number; // seconds between decisions
  waveSize: number; // units needed to launch the first wave
  waveGrowth: number; // wave size increase per wave
  incomeMul: number; // economy handicap/cheat
  maxMilitary: number; // military production building cap
  useResearch: boolean;
}

const DIFF: Record<Difficulty, DiffConfig> = {
  easy:   { thinkInterval: 2.4, waveSize: 6,  waveGrowth: 1, incomeMul: 1.0,  maxMilitary: 3, useResearch: false },
  normal: { thinkInterval: 1.6, waveSize: 9,  waveGrowth: 2, incomeMul: 1.2,  maxMilitary: 4, useResearch: true },
  hard:   { thinkInterval: 1.1, waveSize: 12, waveGrowth: 3, incomeMul: 1.45, maxMilitary: 6, useResearch: true },
};

const AI_TEAM = 1 as const;

// Which trainable unit counters a given player unit.
const COUNTER_PICK: Record<UnitKind, UnitKind> = {
  knight: 'cavalry',
  spear: 'archer',
  archer: 'knight',
  cavalry: 'spear',
  mage: 'cavalry',
  catapult: 'cavalry',
  golem: 'archer',
  wolf: 'spear',
};

export class EnemyAI {
  private cfg: DiffConfig;
  private thinkTimer = 0;
  private waveSize: number;
  private waveStage: 0 | 1 | 2 = 0; // 0 = building up, 1 = marching to bridge, 2 = pushing castle
  private gather: { x: number; y: number };
  private bridgePoint = { x: 32, y: 33 }; // bottom bridge (the open crossing)

  constructor(
    private world: World,
    gameMap: GameMap,
    readonly difficulty: Difficulty,
  ) {
    this.cfg = DIFF[difficulty];
    this.waveSize = this.cfg.waveSize;
    const es = gameMap.enemyStart;
    this.gather = { x: es.x - 8, y: es.y };
    world.players[AI_TEAM].upgrades.income *= this.cfg.incomeMul;
  }

  update(dt: number): void {
    this.thinkTimer += dt;
    if (this.thinkTimer < this.cfg.thinkInterval) return;
    this.thinkTimer = 0;
    if (this.world.winner !== null) return;

    this.spendResearch();
    if (this.defendBase()) return; // defense overrides everything
    this.buildSomething();
    this.trainUnits();
    this.runWaves();
  }

  // --- Helpers ---

  private myBuildings(kind?: BuildingKind): Building[] {
    return this.world.buildings.filter(
      (b) => b.alive && b.team === AI_TEAM && (kind === undefined || b.kind === kind),
    );
  }

  private military(): Unit[] {
    return this.world.units.filter((u) => u.alive && u.team === AI_TEAM);
  }

  private gold(): number {
    return this.world.players[AI_TEAM].gold;
  }

  private castle(): Building | undefined {
    return this.myBuildings('castle')[0];
  }

  /** Find a placement spot near (cx, cy), scanning outward. */
  private findSpot(kind: BuildingKind, cx: number, cy: number): { x: number; y: number } | null {
    const def = BUILDINGS[kind];
    for (let r = 2; r <= 12; r++) {
      // Walk the ring with a per-ring offset for variety.
      const start = Math.floor(Math.random() * 8);
      for (let i = 0; i < r * 8; i++) {
        const angle = ((i + start) / (r * 8)) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(angle) * r - def.w / 2);
        const y = Math.round(cy + Math.sin(angle) * r - def.h / 2);
        if (this.world.canPlace(kind, x, y)) return { x, y };
      }
    }
    return null;
  }

  private tryBuild(kind: BuildingKind, near?: { x: number; y: number }): boolean {
    const def = BUILDINGS[kind];
    if (this.gold() < def.cost) return false;
    const c = this.castle();
    if (!c) return false;
    const center = near ?? { x: c.x + c.w / 2, y: c.y + c.h / 2 };
    const spot = this.findSpot(kind, center.x, center.y);
    if (!spot) return false;
    this.world.players[AI_TEAM].gold -= def.cost;
    const b = this.world.placeBuilding(AI_TEAM, kind, spot.x, spot.y);
    if (def.trains) {
      b.rallyX = this.gather.x;
      b.rallyY = this.gather.y;
    }
    return true;
  }

  /** Find a free gold node tile on the AI half. */
  private freeGoldTile(): { x: number; y: number } | null {
    const { map } = this.world;
    const half = Math.floor(map.w / 2);
    for (let y = 0; y < map.h; y++) {
      for (let x = half; x < map.w; x++) {
        if (map.get(x, y) === Terrain.Gold && !map.isBlocked(x, y)) return { x, y };
      }
    }
    return null;
  }

  // --- Decisions ---

  private spendResearch(): void {
    const p = this.world.players[AI_TEAM];
    if (p.researchPoints > 0 && p.offer.length > 0) {
      const pick = p.offer[Math.floor(Math.random() * p.offer.length)];
      pickUpgrade(this.world, AI_TEAM, pick);
    }
  }

  /** Returns true when defending (skips other decisions this tick). */
  private defendBase(): boolean {
    const c = this.castle();
    if (!c) return false;
    const cc = this.world.buildingCenter(c);
    const intruders = this.world.units.filter(
      (u) => u.alive && u.team === 0 && Math.hypot(u.x - cc.x, u.y - cc.y) < 14,
    );
    if (intruders.length < 2) return false;

    const ix = intruders.reduce((s, u) => s + u.x, 0) / intruders.length;
    const iy = intruders.reduce((s, u) => s + u.y, 0) / intruders.length;
    issueAttackMove(this.world, this.military(), ix, iy);
    this.waveStage = 0; // wave restarts after the defense
    return true;
  }

  private buildSomething(): void {
    const p = this.world.players[AI_TEAM];
    const houses = this.myBuildings('house').length;
    const mines = this.myBuildings('mine').length;
    const barracks = this.myBuildings('barracks').length;
    const archery = this.myBuildings('archery').length;
    const stable = this.myBuildings('stable').length;
    const siege = this.myBuildings('siegeworks').length;
    const research = this.myBuildings('research');
    const towers = this.myBuildings('tower').length;
    const militaryCount = barracks + archery + stable + siege + this.myBuildings('magetower').length;

    // Supply first — never get blocked.
    if (p.supplyCap - p.supplyUsed < 4 && houses < 10) {
      if (this.tryBuild('house')) return;
    }
    // Economy: claim free gold nodes.
    if (mines < 4) {
      const tile = this.freeGoldTile();
      if (tile && this.gold() >= BUILDINGS.mine.cost) {
        this.world.players[AI_TEAM].gold -= BUILDINGS.mine.cost;
        this.world.placeBuilding(AI_TEAM, 'mine', tile.x, tile.y);
        return;
      }
    }
    // Military buildings in a sensible order.
    if (barracks === 0 && this.tryBuild('barracks')) return;
    if (archery === 0 && this.gold() > 250 && this.tryBuild('archery')) return;
    if (stable === 0 && this.gold() > 330 && this.tryBuild('stable')) return;
    if (this.cfg.useResearch && research.length === 0 && this.gold() > 380 && this.tryBuild('research')) return;
    if (siege === 0 && this.gold() > 430 && this.tryBuild('siegeworks')) return;
    if (towers < 3 && this.gold() > 350 && this.tryBuild('tower')) return;
    if (militaryCount < this.cfg.maxMilitary && this.gold() > 500) {
      const extra: BuildingKind[] = ['barracks', 'archery', 'stable'];
      if (this.tryBuild(extra[Math.floor(Math.random() * extra.length)])) return;
    }
    // Paid research when rich.
    const lab = research[0];
    if (lab && !lab.researching && lab.buildProgress >= 1) {
      if (this.gold() > researchCost(p) + 250) startResearch(this.world, lab);
    }
  }

  private trainUnits(): void {
    // What does the player field the most? Train its counter.
    const counts = new Map<UnitKind, number>();
    for (const u of this.world.units) {
      if (u.alive && u.team === 0) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1);
    }
    let dominant: UnitKind | null = null;
    let max = 1;
    for (const [k, n] of counts) {
      if (n > max) {
        max = n;
        dominant = k;
      }
    }
    const counterWanted = dominant ? COUNTER_PICK[dominant] : null;

    for (const b of this.myBuildings()) {
      const def = BUILDINGS[b.kind];
      if (!def.trains || b.buildProgress < 1 || b.queue.length >= 2) continue;
      let kind: UnitKind = def.trains[0];
      if (counterWanted && def.trains.includes(counterWanted)) {
        kind = counterWanted;
      } else if (b.kind === 'barracks') {
        // Mix knights and spears.
        kind = Math.random() < 0.6 ? 'knight' : 'spear';
      }
      enqueueUnit(this.world, b, kind);
    }
  }

  private runWaves(): void {
    const army = this.military();

    if (this.waveStage === 0) {
      if (army.length >= this.waveSize) {
        // March to the open bottom bridge first.
        issueAttackMove(this.world, army, this.bridgePoint.x, this.bridgePoint.y);
        this.waveStage = 1;
      }
      return;
    }

    if (army.length === 0) {
      // Wave wiped — rebuild a bigger one.
      this.waveStage = 0;
      this.waveSize += this.cfg.waveGrowth;
      return;
    }

    if (this.waveStage === 1) {
      // Crossed the river? Push the castle.
      const avgX = army.reduce((s, u) => s + u.x, 0) / army.length;
      const idleish = army.filter((u) => u.order === 'idle').length;
      if (avgX < 31 || idleish > army.length * 0.6) {
        const pc = this.world.buildings.find((b) => b.alive && b.team === 0 && b.kind === 'castle');
        if (pc) {
          const c = this.world.buildingCenter(pc);
          issueAttackMove(this.world, army, c.x, c.y);
          this.waveStage = 2;
        }
      }
    }
  }
}
