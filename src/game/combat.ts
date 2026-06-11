// Combat system: target acquisition, chasing, attacking, deaths.
// Rules (Age-style): units never advance on their own. Idle units only
// retaliate within their aggro radius and leash back to their post.
// Attack-move engages anything met along the way, then resumes.

import { findPath } from '../engine/astar';
import { UNITS, counterMultiplier } from '../data/units';
import type { Unit, World } from './world';

const REPATH_INTERVAL = 0.4; // s, chase repath throttle
const LEASH_EXTRA = 2.0; // tiles beyond aggro an idle unit will chase
const ATTACK_ANIM = 0.25; // s, swing pose duration

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
        // Pure move ignores enemies; movement system flips to idle at the end.
        break;
    }
  }

  // Deaths
  for (const u of world.units) {
    if (u.alive && u.hp <= 0) {
      u.alive = false;
      world.events.push({ type: 'death', x: u.x, y: u.y, team: u.team });
    }
  }
  world.units = world.units.filter((u) => u.alive);
}

// --- Order handlers ---

function updateAttackOrder(world: World, u: Unit): void {
  const target = u.targetId !== null ? world.getUnit(u.targetId) : undefined;
  if (!target) {
    becomeIdle(u);
    return;
  }
  engage(world, u, target);
}

function updateAttackMove(world: World, u: Unit): void {
  let target = u.targetId !== null ? world.getUnit(u.targetId) : undefined;
  if (!target) {
    u.targetId = null;
    target = scanForEnemy(world, u, UNITS[u.kind].aggro);
    if (target) {
      u.targetId = target.id;
    } else if (!u.path) {
      // Resume marching toward the attack-move destination.
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
      return;
    }
  }
  if (target) engage(world, u, target);
}

function updateIdle(world: World, u: Unit): void {
  const def = UNITS[u.kind];
  let target = u.targetId !== null ? world.getUnit(u.targetId) : undefined;

  // Leash: don't stray too far from the post.
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
    // Walk back to the post.
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

// --- Core engagement: chase if out of range, swing if in range ---

function engage(world: World, u: Unit, target: Unit): void {
  const def = UNITS[u.kind];
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= def.range) {
    // In range: stop, face, attack on cooldown.
    u.path = null;
    if (Math.abs(dx) > 0.05) u.facing = dx > 0 ? 1 : -1;
    if (u.atkTimer <= 0) {
      u.atkTimer = def.attackCooldown;
      u.attacking = true;
      u.attackAnimTimer = ATTACK_ANIM;
      performAttack(world, u, target);
    }
    return;
  }

  // Chase: repath toward the target (throttled).
  if (u.repathTimer <= 0) {
    u.repathTimer = REPATH_INTERVAL;
    const p = findPath(world.map, u.x, u.y, target.x, target.y);
    if (p) {
      u.path = p;
      u.pathIdx = 0;
    }
  }
}

function performAttack(world: World, u: Unit, target: Unit): void {
  const def = UNITS[u.kind];
  const dmg = def.damage * counterMultiplier(u.kind, target.kind);

  switch (u.kind) {
    case 'archer':
      world.projectiles.push({
        kind: 'arrow',
        x: u.x, y: u.y, sx: u.x, sy: u.y,
        tx: target.x, ty: target.y,
        progress: 0, speed: 11,
        targetId: target.id, shooterId: u.id,
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
        targetId: null, shooterId: u.id, // boulders land where aimed — dodgeable!
        damage: dmg, splash: 1.1,
        team: u.team, attackerKind: u.kind,
      });
      world.events.push({ type: 'boulder_fire', x: u.x, y: u.y });
      break;

    case 'mage': {
      // Instant arcane blast around the target.
      const radius = def.aoeRadius ?? 1.5;
      world.events.push({
        type: 'magic_cast',
        fromX: u.x, fromY: u.y, toX: target.x, toY: target.y, team: u.team,
      });
      for (const e of world.units) {
        if (!e.alive || e.team === u.team) continue;
        const d = Math.hypot(e.x - target.x, e.y - target.y);
        if (d <= radius) {
          const falloff = 1 - (d / radius) * 0.4;
          e.hp -= def.damage * counterMultiplier(u.kind, e.kind) * falloff;
          retaliate(e, u);
        }
      }
      break;
    }

    default:
      // Melee (knight, spear, cavalry)
      target.hp -= dmg;
      world.events.push({ type: 'melee_hit', x: target.x, y: target.y, team: target.team });
      retaliate(target, u);
      break;
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
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function becomeIdle(u: Unit): void {
  u.order = 'idle';
  u.targetId = null;
  u.path = null;
  u.anchorX = u.x;
  u.anchorY = u.y;
}
