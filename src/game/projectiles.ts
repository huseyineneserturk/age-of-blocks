// Projectile simulation. Arrows softly home onto their target; boulders fly
// to the aimed tile (units can dodge) and splash on impact. Both can also
// target buildings.

import { counterMultiplier } from '../data/units';
import { retaliate } from './combat';
import type { World } from './world';

export function updateProjectiles(world: World, dt: number): void {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];

    // Homing: track the live target's position.
    if (p.targetId !== null) {
      const t = world.getUnit(p.targetId);
      if (t) {
        p.tx = t.x;
        p.ty = t.y;
      }
    }

    const total = Math.max(0.001, Math.hypot(p.tx - p.sx, p.ty - p.sy));
    p.progress += (p.speed * dt) / total;
    p.x = p.sx + (p.tx - p.sx) * Math.min(1, p.progress);
    p.y = p.sy + (p.ty - p.sy) * Math.min(1, p.progress);

    if (p.progress < 1) continue;

    // --- Impact ---
    if (p.targetBuildingId !== null) {
      const b = world.getBuilding(p.targetBuildingId);
      if (b) {
        b.hp -= p.damage;
        b.lastHitBy = p.team;
        if (p.splash > 0) {
          world.events.push({ type: 'boulder_hit', x: p.tx, y: p.ty, radius: p.splash });
        } else {
          world.events.push({ type: 'arrow_hit', x: p.tx, y: p.ty, team: b.team });
        }
      }
    } else if (p.splash > 0) {
      world.events.push({ type: 'boulder_hit', x: p.tx, y: p.ty, radius: p.splash });
      for (const e of world.units) {
        if (!e.alive || e.team === p.team) continue;
        const d = Math.hypot(e.x - p.tx, e.y - p.ty);
        if (d <= p.splash) {
          const falloff = 1 - (d / p.splash) * 0.5;
          e.hp -= p.damage * counterMultiplier(p.attackerKind, e.kind) * falloff;
          e.lastHitBy = p.team;
        }
      }
      // Splash also cracks nearby destructible rocks.
      for (const r of world.rocks) {
        if (!r.alive) continue;
        if (Math.hypot(r.x + 0.5 - p.tx, r.y + 0.5 - p.ty) <= p.splash + 0.5) {
          r.hp -= p.damage;
        }
      }
      // Splash also chips nearby enemy buildings.
      for (const b of world.buildings) {
        if (!b.alive || b.team === p.team) continue;
        if (world.distToBuilding(p.tx, p.ty, b) <= p.splash) {
          b.hp -= p.damage * 0.5;
          b.lastHitBy = p.team;
        }
      }
    } else {
      const t = p.targetId !== null ? world.getUnit(p.targetId) : undefined;
      if (t) {
        t.hp -= p.damage;
        t.lastHitBy = p.team;
        world.events.push({ type: 'arrow_hit', x: t.x, y: t.y, team: t.team });
        const shooter = world.getUnit(p.shooterId);
        if (shooter) retaliate(t, shooter);
      }
    }

    world.projectiles.splice(i, 1);
  }
}
