// Projectile simulation. Arrows softly home onto their target; boulders fly
// to the aimed tile (units can dodge) and splash on impact.

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
    if (p.splash > 0) {
      world.events.push({ type: 'boulder_hit', x: p.tx, y: p.ty, radius: p.splash });
      for (const e of world.units) {
        if (!e.alive || e.team === p.team) continue;
        const d = Math.hypot(e.x - p.tx, e.y - p.ty);
        if (d <= p.splash) {
          const falloff = 1 - (d / p.splash) * 0.5;
          e.hp -= p.damage * counterMultiplier(p.attackerKind, e.kind) * falloff;
        }
      }
    } else {
      const t = p.targetId !== null ? world.getUnit(p.targetId) : undefined;
      if (t) {
        t.hp -= p.damage;
        world.events.push({ type: 'arrow_hit', x: t.x, y: t.y, team: t.team });
        const shooter = world.getUnit(p.shooterId);
        if (shooter) retaliate(t, shooter);
      }
    }

    world.projectiles.splice(i, 1);
  }
}
