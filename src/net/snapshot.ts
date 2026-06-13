// Snapshot encode (server) / apply (client). The client world is a passive
// mirror: objects are mutated in place so ids stay stable for selection,
// and prevX/prevY keep render interpolation smooth between snapshots.

import type { Snapshot } from './protocol';
import type { Building, RockEntity, Unit, World } from '../game/world';

export function encodeSnapshot(world: World): Snapshot {
  return {
    winner: world.winner,
    units: world.units.map((u) => ({
      id: u.id,
      team: u.team,
      kind: u.kind,
      x: round2(u.x),
      y: round2(u.y),
      hp: Math.round(u.hp),
      maxHp: Math.round(u.maxHp),
      facing: u.facing,
      moving: u.moving,
      attacking: u.attacking,
    })),
    buildings: world.buildings.map((b) => ({
      id: b.id,
      team: b.team,
      kind: b.kind,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      hp: Math.round(b.hp),
      maxHp: b.maxHp,
      buildProgress: round2(b.buildProgress),
      queue: [...b.queue],
      trainProgress: round2(b.trainProgress),
      rallyX: b.rallyX,
      rallyY: b.rallyY,
      researching: b.researching,
      researchTimer: round2(b.researchTimer),
    })),
    rocks: world.rocks.map((r) => ({ id: r.id, x: r.x, y: r.y, hp: Math.round(r.hp), maxHp: r.maxHp })),
    projectiles: world.projectiles.map((p) => ({
      kind: p.kind,
      x: round2(p.x),
      y: round2(p.y),
      sx: round2(p.sx),
      sy: round2(p.sy),
      tx: round2(p.tx),
      ty: round2(p.ty),
      progress: round2(p.progress),
      team: p.team,
    })),
    players: [encodePlayer(world, 0), encodePlayer(world, 1)],
    events: [...world.events],
  };
}

function encodePlayer(world: World, team: 0 | 1): Snapshot['players'][number] {
  const p = world.players[team];
  return {
    civ: p.civ,
    gold: Math.floor(p.gold),
    supplyUsed: p.supplyUsed,
    supplyCap: p.supplyCap,
    upgrades: { ...p.upgrades },
    researchPoints: p.researchPoints,
    usedUpgrades: [...p.usedUpgrades],
    offer: [...p.offer],
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Apply a snapshot to the client-side mirror world. */
export function applySnapshot(world: World, snap: Snapshot): void {
  world.winner = snap.winner;

  // --- Units (mutate-in-place, keep ids stable) ---
  const unitById = new Map(world.units.map((u) => [u.id, u]));
  const nextUnits: Unit[] = [];
  for (const s of snap.units) {
    let u = unitById.get(s.id);
    if (!u) {
      u = world.spawnUnit(s.team, s.kind, s.x, s.y);
      u.id = s.id;
      world.units.pop(); // spawnUnit pushed it; we manage the array ourselves
    } else {
      u.prevX = u.x;
      u.prevY = u.y;
    }
    u.x = s.x;
    u.y = s.y;
    u.hp = s.hp;
    u.maxHp = s.maxHp;
    u.facing = s.facing;
    u.moving = s.moving;
    u.attacking = s.attacking;
    u.alive = true;
    nextUnits.push(u);
  }
  world.units = nextUnits;

  // --- Buildings ---
  const bById = new Map(world.buildings.map((b) => [b.id, b]));
  const nextBuildings: Building[] = [];
  for (const s of snap.buildings) {
    let b = bById.get(s.id);
    if (!b) {
      b = {
        id: s.id,
        team: s.team,
        kind: s.kind,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        hp: s.hp,
        maxHp: s.maxHp,
        alive: true,
        buildProgress: s.buildProgress,
        queue: [...s.queue],
        trainProgress: s.trainProgress,
        rallyX: s.rallyX,
        rallyY: s.rallyY,
        atkTimer: 0,
        researching: s.researching,
        researchTimer: s.researchTimer,
      };
    } else {
      b.hp = s.hp;
      b.buildProgress = s.buildProgress;
      b.queue = [...s.queue];
      b.trainProgress = s.trainProgress;
      b.rallyX = s.rallyX;
      b.rallyY = s.rallyY;
      b.researching = s.researching;
      b.researchTimer = s.researchTimer;
    }
    nextBuildings.push(b);
  }
  world.buildings = nextBuildings;

  // --- Rocks ---
  const rById = new Map(world.rocks.map((r) => [r.id, r]));
  const nextRocks: RockEntity[] = [];
  for (const s of snap.rocks) {
    let r = rById.get(s.id);
    if (!r) r = { id: s.id, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, alive: true };
    else r.hp = s.hp;
    nextRocks.push(r);
  }
  world.rocks = nextRocks;

  // --- Projectiles (stateless visuals — rebuild) ---
  world.projectiles = snap.projectiles.map((s) => ({
    kind: s.kind,
    x: s.x,
    y: s.y,
    sx: s.sx,
    sy: s.sy,
    tx: s.tx,
    ty: s.ty,
    progress: s.progress,
    speed: 0,
    targetId: null,
    targetBuildingId: null,
    shooterId: -1,
    damage: 0,
    splash: 0,
    team: s.team,
    attackerKind: 'archer',
  }));

  // --- Players ---
  for (const team of [0, 1] as const) {
    const p = world.players[team];
    const s = snap.players[team];
    p.civ = s.civ;
    p.gold = s.gold;
    p.supplyUsed = s.supplyUsed;
    p.supplyCap = s.supplyCap;
    p.upgrades = { ...s.upgrades };
    p.researchPoints = s.researchPoints;
    p.usedUpgrades = [...s.usedUpgrades];
    p.offer = [...s.offer];
  }

  // --- Rebuild the blocked layer (buildings + rocks moved/died) ---
  world.map.blocked.fill(0);
  for (const b of world.buildings) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) world.map.setBlocked(x, y, true);
    }
  }
  for (const r of world.rocks) world.map.setBlocked(r.x, r.y, true);

  // --- Events for FX/sound (consumed by the game frame) ---
  world.events.push(...snap.events);
}
