// Combat system: target acquisition, chasing, attacking, deaths — units,
// buildings and destructible rocks. Environment rules (Phase 4):
//  • Forest ambush: a unit in forest is hidden from enemies until they close in
//  • Hill bonus: ranged units on a hill gain +1 range
//  • Neutral camp: killing the last monster grants gold + a permanent buff

import { findPath } from '../engine/astar';
import { Terrain } from '../engine/grid';
import { UNITS, counterMultiplier, type Team } from '../data/units';
import { BUILDINGS, SIEGE_VS_BUILDING } from '../data/buildings';
import { killBounty } from './spells';
import type { Building, RockEntity, Unit, World } from './world';

const REPATH_INTERVAL = 0.4;
const LEASH_EXTRA = 2.0;
const ATTACK_ANIM = 0.25;
const FOREST_REVEAL = 2.2; // enemies closer than this see into the forest
const HILL_RANGE_BONUS = 1;
const CAMP_GOLD = 150;
const CAMP_DAMAGE_BUFF = 0.1;

function upgradesOf(world: World, team: Team): { damage: number; atkspeed: number } {
  if (team === 2) return { damage: 1, atkspeed: 1 };
  return world.players[team].upgrades;
}

/** Is `u` hidden (in forest) from the viewpoint of `viewerTeam`? */
export function isHiddenFrom(world: World, u: Unit, viewerTeam: Team): boolean {
  if (u.team === viewerTeam) return false;
  if (world.map.get(Math.floor(u.x), Math.floor(u.y)) !== Terrain.Forest) return false;
  for (const v of world.units) {
    if (!v.alive || v.team !== viewerTeam) continue;
    if (Math.hypot(v.x - u.x, v.y - u.y) <= FOREST_REVEAL) return false;
  }
  return true;
}

/** Effective attack range, including the hill bonus for ranged units. */
function effectiveRange(world: World, u: Unit): number {
  const def = UNITS[u.kind];
  let range = def.range;
  if (def.range >= 3 && world.map.get(Math.floor(u.x), Math.floor(u.y)) === Terrain.Hill) {
    range += HILL_RANGE_BONUS;
  }
  return range;
}

export function updateCombat(world: World, dt: number): void {
  for (const u of world.units) {
    if (!u.alive) continue;

    if (u.atkTimer > 0) u.atkTimer = Math.max(0, u.atkTimer - dt);
    if (u.attackAnimTimer > 0) {
      u.attackAnimTimer = Math.max(0, u.attackAnimTimer - dt);
      if (u.attackAnimTimer === 0) u.attacking = false;
    }
    if (u.repathTimer > 0) u.repathTimer = Math.max(0, u.repathTimer - dt);

    switch (u.order) {
      case 'attack':
        updateAttackOrder(world, u);
        break;
      case 'attackmove':
        updateAttackMove(world, u);
        break;
      case 'idle':
        updateIdle(world, u);
        break;
      case 'move':
        break;
    }
  }

  updateTowers(world);

  // Unit deaths (+ kill bounty + neutral camp reward)
  for (const u of world.units) {
    if (u.alive && u.hp <= 0) {
      u.alive = false;
      world.events.push({ type: 'death', x: u.x, y: u.y, team: u.team });
      // Kill bounty: the killing player earns gold for enemy units.
      if ((u.lastHitBy === 0 || u.lastHitBy === 1) && u.lastHitBy !== u.team) {
        world.players[u.lastHitBy].gold += killBounty(u.kind);
      }
      if (u.team === 2 && !world.campRewardGiven) {
        const remaining = world.units.some((m) => m.alive && m.team === 2 && m.id !== u.id);
        if (!remaining && (u.lastHitBy === 0 || u.lastHitBy === 1)) {
          world.campRewardGiven = true;
          const p = world.players[u.lastHitBy];
          p.gold += CAMP_GOLD;
          p.upgrades.damage += CAMP_DAMAGE_BUFF;
          world.events.push({ type: 'camp_cleared', team: u.lastHitBy });
        }
      }
    }
  }
  world.units = world.units.filter((u) => u.alive);

  // Rock deaths
  for (const r of world.rocks) {
    if (r.alive && r.hp <= 0) {
      world.removeRock(r);
      world.events.push({ type: 'rock_destroyed', x: r.x + 0.5, y: r.y + 0.5 });
    }
  }
  world.rocks = world.rocks.filter((r) => r.alive);

  // Building deaths
  for (const b of world.buildings) {
    if (b.alive && b.hp <= 0) {
      const c = world.buildingCenter(b);
      world.removeBuilding(b);
      world.events.push({ type: 'building_destroyed', x: c.x, y: c.y, team: b.team, kind: b.kind });
      if (b.kind === 'castle' && world.winner === null && b.team !== 2) {
        world.winner = b.team === 0 ? 1 : 0;
      }
    }
  }
  world.buildings = world.buildings.filter((b) => b.alive);
}

// --- Order handlers ---

function updateAttackOrder(world: World, u: Unit): void {
  if (u.targetRockId !== null) {
    const r = world.getRock(u.targetRockId);
    if (!r) {
      becomeIdle(u);
      return;
    }
    engageRock(world, u, r);
    return;
  }
  if (u.targetBuildingId !== null) {
    const tb = world.getBuilding(u.targetBuildingId);
    if (!tb) {
      becomeIdle(u);
      return;
    }
    engageBuilding(world, u, tb);
    return;
  }
  const target = u.targetId !== null ? world.getUnit(u.targetId) : undefined;
  if (!target || isHiddenFrom(world, target, u.team)) {
    becomeIdle(u);
    return;
  }
  engage(world, u, target);
}

function updateAttackMove(world: World, u: Unit): void {
  // Priority 1: enemy units (visible only).
  let target = u.targetId !== null ? world.getUnit(u.targetId) : undefined;
  if (target && isHiddenFrom(world, target, u.team)) target = undefined;
  if (!target) {
    u.targetId = null;
    target = scanForEnemy(world, u, UNITS[u.kind].aggro);
    if (target) u.targetId = target.id;
  }
  if (target) {
    u.targetBuildingId = null;
    engage(world, u, target);
    return;
  }

  // Priority 2: enemy buildings nearby.
  let tb = u.targetBuildingId !== null ? world.getBuilding(u.targetBuildingId) : undefined;
  if (!tb) {
    u.targetBuildingId = null;
    tb = scanForBuilding(world, u, UNITS[u.kind].aggro);
    if (tb) u.targetBuildingId = tb.id;
  }
  if (tb) {
    engageBuilding(world, u, tb);
    return;
  }

  // Otherwise: keep marching to the attack-move destination.
  if (!u.path) {
    const d = Math.hypot(u.amX - u.x, u.amY - u.y);
    if (d > 0.6) {
      if (u.repathTimer <= 0) {
        u.repathTimer = REPATH_INTERVAL;
        const p = findPath(world.map, u.x, u.y, u.amX, u.amY);
        if (p) {
          u.path = p;
          u.pathIdx = 0;
        } else {
          becomeIdle(u);
        }
      }
    } else {
      becomeIdle(u);
    }
  }
}

function updateIdle(world: World, u: Unit): void {
  const def = UNITS[u.kind];
  let target = u.targetId !== null ? world.getUnit(u.targetId) : undefined;
  if (target && isHiddenFrom(world, target, u.team)) target = undefined;

  const anchorDist = Math.hypot(u.x - u.anchorX, u.y - u.anchorY);
  if (target && anchorDist > def.aggro + LEASH_EXTRA) {
    u.targetId = null;
    target = undefined;
  }

  if (!target) {
    u.targetId = null;
    target = scanForEnemy(world, u, def.aggro);
    if (target) u.targetId = target.id;
  }

  if (target) {
    engage(world, u, target);
  } else if (anchorDist > 0.9 && !u.path) {
    if (u.repathTimer <= 0) {
      u.repathTimer = REPATH_INTERVAL;
      const p = findPath(world.map, u.x, u.y, u.anchorX, u.anchorY);
      if (p) {
        u.path = p;
        u.pathIdx = 0;
      } else {
        u.anchorX = u.x;
        u.anchorY = u.y;
      }
    }
  }
}

// --- Engagement ---

function engage(world: World, u: Unit, target: Unit): void {
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const dist = Math.hypot(dx, dy);
  const range = effectiveRange(world, u);

  if (dist <= range) {
    u.path = null;
    if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
    if (u.atkTimer <= 0) {
      u.atkTimer = UNITS[u.kind].attackCooldown / upgradesOf(world, u.team).atkspeed;
      u.attacking = true;
      u.attackAnimTimer = ATTACK_ANIM;
      performAttack(world, u, target);
    }
    return;
  }

  if (u.repathTimer <= 0) {
    u.repathTimer = REPATH_INTERVAL;
    const p = findPath(world.map, u.x, u.y, target.x, target.y);
    if (p) {
      u.path = p;
      u.pathIdx = 0;
    }
  }
}

function engageBuilding(world: World, u: Unit, b: Building): void {
  const dist = world.distToBuilding(u.x, u.y, b);
  const c = world.buildingCenter(b);
  const range = effectiveRange(world, u);

  if (dist <= range) {
    u.path = null;
    if (Math.abs(c.x - u.x) > 0.05) u.facing = c.x > u.x ? 1 : -1;
    if (u.atkTimer <= 0) {
      u.atkTimer = UNITS[u.kind].attackCooldown / upgradesOf(world, u.team).atkspeed;
      u.attacking = true;
      u.attackAnimTimer = ATTACK_ANIM;
      performAttackOnBuilding(world, u, b);
    }
    return;
  }

  if (u.repathTimer <= 0) {
    u.repathTimer = REPATH_INTERVAL;
    const p = findPath(world.map, u.x, u.y, c.x, c.y);
    if (p) {
      u.path = p;
      u.pathIdx = 0;
    }
  }
}

function engageRock(world: World, u: Unit, r: RockEntity): void {
  const cx = r.x + 0.5;
  const cy = r.y + 0.5;
  const dist = Math.hypot(cx - u.x, cy - u.y) - 0.5;
  const range = effectiveRange(world, u);

  if (dist <= range) {
    u.path = null;
    if (Math.abs(cx - u.x) > 0.05) u.facing = cx > u.x ? 1 : -1;
    if (u.atkTimer <= 0) {
      u.atkTimer = UNITS[u.kind].attackCooldown / upgradesOf(world, u.team).atkspeed;
      u.attacking = true;
      u.attackAnimTimer = ATTACK_ANIM;
      let dmg = unitDamage(world, u);
      dmg *= u.kind === 'catapult' ? SIEGE_VS_BUILDING : 0.5;
      r.hp -= dmg;
      world.events.push({ type: 'melee_hit', x: cx, y: cy, team: 2 });
    }
    return;
  }

  if (u.repathTimer <= 0) {
    u.repathTimer = REPATH_INTERVAL;
    const p = findPath(world.map, u.x, u.y, cx, cy);
    if (p) {
      u.path = p;
      u.pathIdx = 0;
    }
  }
}

function unitDamage(world: World, u: Unit): number {
  return UNITS[u.kind].damage * upgradesOf(world, u.team).damage;
}

function hurt(target: Unit, amount: number, attackerTeam: Team): void {
  target.hp -= amount;
  target.lastHitBy = attackerTeam;
}

function performAttack(world: World, u: Unit, target: Unit): void {
  const def = UNITS[u.kind];
  const dmg = unitDamage(world, u) * counterMultiplier(u.kind, target.kind);

  switch (u.kind) {
    case 'archer':
      world.projectiles.push({
        kind: 'arrow',
        x: u.x, y: u.y, sx: u.x, sy: u.y,
        tx: target.x, ty: target.y,
        progress: 0, speed: 11,
        targetId: target.id, targetBuildingId: null, shooterId: u.id,
        damage: dmg, splash: 0,
        team: u.team, attackerKind: u.kind,
      });
      world.events.push({ type: 'arrow_fire', x: u.x, y: u.y });
      break;

    case 'catapult':
      world.projectiles.push({
        kind: 'boulder',
        x: u.x, y: u.y, sx: u.x, sy: u.y,
        tx: target.x, ty: target.y,
        progress: 0, speed: 6,
        targetId: null, targetBuildingId: null, shooterId: u.id,
        damage: dmg, splash: 1.1,
        team: u.team, attackerKind: u.kind,
      });
      world.events.push({ type: 'boulder_fire', x: u.x, y: u.y });
      break;

    case 'mage': {
      const radius = def.aoeRadius ?? 1.5;
      world.events.push({
        type: 'magic_cast',
        fromX: u.x, fromY: u.y, toX: target.x, toY: target.y, team: u.team,
      });
      const base = unitDamage(world, u);
      for (const e of world.units) {
        if (!e.alive || e.team === u.team) continue;
        const d = Math.hypot(e.x - target.x, e.y - target.y);
        if (d <= radius) {
          const falloff = 1 - (d / radius) * 0.4;
          hurt(e, base * counterMultiplier(u.kind, e.kind) * falloff, u.team);
          retaliate(e, u);
        }
      }
      break;
    }

    default:
      hurt(target, dmg, u.team);
      world.events.push({ type: 'melee_hit', x: target.x, y: target.y, team: target.team });
      retaliate(target, u);
      break;
  }
}

function performAttackOnBuilding(world: World, u: Unit, b: Building): void {
  let dmg = unitDamage(world, u);
  if (u.kind === 'catapult') dmg *= SIEGE_VS_BUILDING;
  else dmg *= 0.6; // ordinary units chip at walls slowly — siege matters
  const c = world.buildingCenter(b);

  switch (u.kind) {
    case 'archer':
      world.projectiles.push({
        kind: 'arrow',
        x: u.x, y: u.y, sx: u.x, sy: u.y,
        tx: c.x, ty: c.y,
        progress: 0, speed: 11,
        targetId: null, targetBuildingId: b.id, shooterId: u.id,
        damage: dmg, splash: 0,
        team: u.team, attackerKind: u.kind,
      });
      world.events.push({ type: 'arrow_fire', x: u.x, y: u.y });
      break;
    case 'catapult':
      world.projectiles.push({
        kind: 'boulder',
        x: u.x, y: u.y, sx: u.x, sy: u.y,
        tx: c.x, ty: c.y,
        progress: 0, speed: 6,
        targetId: null, targetBuildingId: b.id, shooterId: u.id,
        damage: dmg, splash: 0.8,
        team: u.team, attackerKind: u.kind,
      });
      world.events.push({ type: 'boulder_fire', x: u.x, y: u.y });
      break;
    case 'mage':
      world.events.push({ type: 'magic_cast', fromX: u.x, fromY: u.y, toX: c.x, toY: c.y, team: u.team });
      b.hp -= dmg;
      break;
    default:
      b.hp -= dmg;
      world.events.push({ type: 'melee_hit', x: c.x, y: c.y, team: b.team });
      break;
  }
}

// --- Towers ---

function updateTowers(world: World): void {
  for (const b of world.buildings) {
    if (!b.alive || b.kind !== 'tower' || b.buildProgress < 1) continue;
    const def = BUILDINGS.tower;
    if (b.atkTimer > 0) b.atkTimer = Math.max(0, b.atkTimer - 1 / 20);
    if (b.atkTimer > 0) continue;

    const c = world.buildingCenter(b);
    let best: Unit | undefined;
    let bestD = def.range!;
    for (const u of world.units) {
      if (!u.alive || u.team === b.team) continue;
      if (isHiddenFrom(world, u, b.team)) continue; // can't shoot into forests
      const d = Math.hypot(u.x - c.x, u.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) {
      b.atkTimer = def.attackCooldown!;
      world.projectiles.push({
        kind: 'arrow',
        x: c.x, y: c.y, sx: c.x, sy: c.y,
        tx: best.x, ty: best.y,
        progress: 0, speed: 12,
        targetId: best.id, targetBuildingId: null, shooterId: -1,
        damage: def.damage!, splash: 0,
        team: b.team, attackerKind: 'archer',
      });
      world.events.push({ type: 'arrow_fire', x: c.x, y: c.y });
    }
  }
}

/** Being hit wakes an idle victim up to fight back. */
export function retaliate(victim: Unit, attacker: Unit): void {
  if (!victim.alive) return;
  if (victim.order === 'idle' && victim.targetId === null) {
    victim.targetId = attacker.id;
  }
}

// --- Helpers ---

function scanForEnemy(world: World, u: Unit, radius: number): Unit | undefined {
  let best: Unit | undefined;
  let bestD = radius;
  for (const e of world.units) {
    if (!e.alive || e.team === u.team) continue;
    if (isHiddenFrom(world, e, u.team)) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function scanForBuilding(world: World, u: Unit, radius: number): Building | undefined {
  let best: Building | undefined;
  let bestD = radius;
  for (const b of world.buildings) {
    if (!b.alive || b.team === u.team || b.team === 2) continue;
    const d = world.distToBuilding(u.x, u.y, b);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function becomeIdle(u: Unit): void {
  u.order = 'idle';
  u.targetId = null;
  u.targetBuildingId = null;
  u.targetRockId = null;
  u.path = null;
  u.anchorX = u.x;
  u.anchorY = u.y;
}
