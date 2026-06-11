// Economy system: construction progress, gold income, production queues,
// supply bookkeeping, research point accrual + pick-1-of-3 offers.

import {
  BUILDINGS,
  RESEARCH_BASE_COST,
  RESEARCH_COST_STEP,
  RESEARCH_TIME,
  TRAIN,
  UPGRADES,
} from '../data/buildings';
import { findPath } from '../engine/astar';
import type { Building, PlayerState, World } from './world';

/** Buildings/economy belong to the two players only (never team 2). */
type PlayerTeam = 0 | 1;

export function updateEconomy(world: World, dt: number): void {
  recalcSupply(world);

  for (const b of world.buildings) {
    if (!b.alive || b.team === 2) continue;
    const team = b.team as PlayerTeam;
    const def = BUILDINGS[b.kind];

    // --- Construction ---
    if (b.buildProgress < 1) {
      const step = def.buildTime > 0 ? dt / def.buildTime : 1;
      b.buildProgress = Math.min(1, b.buildProgress + step);
      // HP scales 10% → 100% while building.
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * step);
      if (b.buildProgress >= 1) {
        b.hp = Math.min(b.maxHp, b.hp);
      }
      continue; // unfinished buildings neither earn nor train
    }

    // --- Income ---
    if (def.income) {
      const p = world.players[team];
      p.gold += def.income * p.upgrades.income * dt;
    }

    // --- Paid research in progress ---
    if (b.kind === 'research' && b.researching) {
      b.researchTimer += dt;
      if (b.researchTimer >= RESEARCH_TIME) {
        b.researching = false;
        b.researchTimer = 0;
        grantResearchPoint(world, team);
      }
    }

    // --- Production queue ---
    if (b.queue.length > 0) {
      const kind = b.queue[0];
      b.trainProgress += dt;
      if (b.trainProgress >= TRAIN[kind].time) {
        b.trainProgress = 0;
        b.queue.shift();
        spawnTrained(world, b, kind);
      }
    }
  }
}

function recalcSupply(world: World): void {
  for (const team of [0, 1] as PlayerTeam[]) {
    const p = world.players[team];
    let cap = 0;
    for (const b of world.buildings) {
      if (b.alive && b.team === team && b.buildProgress >= 1) {
        cap += BUILDINGS[b.kind].supply ?? 0;
      }
    }
    let used = 0;
    for (const u of world.units) {
      if (u.alive && u.team === team) used += TRAIN[u.kind].supply;
    }
    // Queued units also reserve supply.
    for (const b of world.buildings) {
      if (b.alive && b.team === team) {
        for (const k of b.queue) used += TRAIN[k].supply;
      }
    }
    p.supplyCap = cap;
    p.supplyUsed = used;
  }
}

/** Try to enqueue a unit; deducts gold. Returns false if not allowed. */
export function enqueueUnit(world: World, b: Building, kind: Parameters<typeof spawnTrained>[2]): boolean {
  const def = BUILDINGS[b.kind];
  if (!def.trains || !def.trains.includes(kind)) return false;
  if (b.buildProgress < 1 || b.queue.length >= 5 || b.team === 2) return false;
  const p = world.players[b.team];
  const t = TRAIN[kind];
  if (p.gold < t.cost) return false;
  if (p.supplyUsed + t.supply > p.supplyCap) return false;
  p.gold -= t.cost;
  b.queue.push(kind);
  return true;
}

function spawnTrained(world: World, b: Building, kind: keyof typeof TRAIN): void {
  // Find a free tile around the building (prefer the enemy-facing side).
  const dir = b.team === 0 ? 1 : -1;
  const candidates: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < 4 && candidates.length === 0; r++) {
    for (let y = b.y - 1 - r; y <= b.y + b.h + r; y++) {
      const xs = dir === 1
        ? [b.x + b.w + r, b.x - 1 - r]
        : [b.x - 1 - r, b.x + b.w + r];
      for (const x of xs) {
        if (world.map.passable(x, y)) candidates.push({ x, y });
      }
    }
  }
  const spot = candidates[0] ?? { x: b.x + b.w, y: b.y };
  const u = world.spawnUnit(b.team, kind, spot.x + 0.5, spot.y + 0.5);
  world.events.push({ type: 'train_done', x: u.x, y: u.y, team: b.team });

  // Walk to the rally point if set.
  if (b.rallyX !== null && b.rallyY !== null) {
    const path = findPath(world.map, u.x, u.y, b.rallyX, b.rallyY);
    if (path) {
      u.path = path;
      u.pathIdx = 0;
      u.order = 'move';
    }
  }
}

// --- Research ---

/** Current price of the next research (escalates with each one bought). */
export function researchCost(p: PlayerState): number {
  return RESEARCH_BASE_COST + RESEARCH_COST_STEP * (p.usedUpgrades.length + p.researchPoints);
}

/** Pay gold to start a research at this building. */
export function startResearch(world: World, b: Building): boolean {
  if (b.kind !== 'research' || b.buildProgress < 1 || b.researching || b.team === 2) return false;
  const p = world.players[b.team];
  const cost = researchCost(p);
  if (p.gold < cost) return false;
  p.gold -= cost;
  b.researching = true;
  b.researchTimer = 0;
  return true;
}

function grantResearchPoint(world: World, team: PlayerTeam): void {
  const p = world.players[team];
  p.researchPoints++;
  if (p.offer.length === 0) rollOffer(p);
}

function rollOffer(p: PlayerState): void {
  const pool = UPGRADES.filter((u) => !p.usedUpgrades.includes(u.id)).map((u) => u.id);
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  p.offer = pool.slice(0, 3);
}

/** Apply a chosen upgrade from the current offer. */
export function pickUpgrade(world: World, team: PlayerTeam, upgradeId: string): boolean {
  const p = world.players[team];
  if (p.researchPoints <= 0 || !p.offer.includes(upgradeId)) return false;
  const def = UPGRADES.find((u) => u.id === upgradeId);
  if (!def || p.usedUpgrades.includes(upgradeId)) return false;

  p.upgrades[def.effect] += def.value;
  p.usedUpgrades.push(upgradeId);
  p.researchPoints--;
  p.offer = [];
  if (p.researchPoints > 0) rollOffer(p);
  return true;
}
