// Particle effects, ported from the v1 work (legacy/src/Particles.js).
// Positions are in world tile units; rendering converts via the camera.

import type { Camera } from '../engine/camera';
import { TEAM_COLORS, type Team } from '../data/units';
import type { SimEvent } from '../game/world';

type PType = 'circle' | 'square' | 'star' | 'ring' | 'glow';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  size: number; // px at zoom 1
  color: string;
  life: number;
  maxLife: number;
  alpha: number;
  shrink: number; // negative = grow (rings)
  type: PType;
  rotation?: number;
  lineWidth?: number;
}

export class Effects {
  private particles: Particle[] = [];

  consume(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'melee_hit':
          this.impact(e.x, e.y, e.team === 0 ? '#ff8a8a' : '#ffd700');
          break;
        case 'arrow_hit':
          this.impact(e.x, e.y, TEAM_COLORS[e.team].main);
          break;
        case 'boulder_hit':
          this.explosion(e.x, e.y, e.radius);
          break;
        case 'magic_cast':
          this.magicBolt(e.fromX, e.fromY, e.toX, e.toY, e.team);
          this.magicBurst(e.toX, e.toY, e.team);
          break;
        case 'death':
          this.death(e.x, e.y, e.team);
          break;
        case 'arrow_fire':
        case 'boulder_fire':
          break; // sound only
      }
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= 1 - dt * p.shrink;
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const zoom = camera.zoom;
    for (const p of this.particles) {
      const s = camera.worldToScreen(p.x, p.y);
      if (s.x < -50 || s.y < -50 || s.x > camera.viewW + 50 || s.y > camera.viewH + 50) continue;
      const size = p.size * zoom;

      ctx.save();
      ctx.globalAlpha = p.alpha * 0.85;

      switch (p.type) {
        case 'circle': {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'square':
          ctx.fillStyle = p.color;
          ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
          break;
        case 'star':
          ctx.fillStyle = p.color;
          ctx.translate(s.x, s.y);
          ctx.rotate(p.rotation ?? 0);
          drawStar(ctx, size, size / 2);
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = (p.lineWidth ?? 3) * zoom;
          ctx.beginPath();
          ctx.arc(s.x, s.y, Math.max(0.1, size), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'glow': {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, Math.max(0.1, size));
          g.addColorStop(0, p.color);
          g.addColorStop(0.5, p.color);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, Math.max(0.1, size), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  // --- Spawners (world coords) ---

  impact(x: number, y: number, color: string): void {
    this.particles.push({
      x, y, vx: 0, vy: 0, ax: 0, ay: 0,
      size: 5, color, life: 0.25, maxLife: 0.25, alpha: 1,
      shrink: -7, type: 'ring', lineWidth: 2.5,
    });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ax: 0, ay: 3, size: 3 + Math.random() * 3, color,
        life: 0.3, maxLife: 0.3, alpha: 1, shrink: 0.8, type: 'circle',
      });
    }
  }

  explosion(x: number, y: number, radius = 1): void {
    this.particles.push({
      x, y, vx: 0, vy: 0, ax: 0, ay: 0,
      size: 8, color: '#ffcc66', life: 0.35, maxLife: 0.35, alpha: 1,
      shrink: -8 * radius, type: 'ring', lineWidth: 4,
    });
    this.particles.push({
      x, y, vx: 0, vy: 0, ax: 0, ay: 0,
      size: 20 * radius, color: '#ffaa44', life: 0.2, maxLife: 0.2, alpha: 1,
      shrink: 1.2, type: 'glow',
    });
    const count = Math.floor(radius * 16);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 5 * radius;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ax: 0, ay: 3, size: 6 + Math.random() * 9,
        color: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'][Math.floor(Math.random() * 4)],
        life: 0.5 + Math.random() * 0.35, maxLife: 0.85, alpha: 1, shrink: 0.6, type: 'circle',
      });
    }
  }

  magicBolt(fromX: number, fromY: number, toX: number, toY: number, team: Team): void {
    const core = team === 0 ? '#7ab8ff' : '#ff7ad0';
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.particles.push({
        x: fromX + (toX - fromX) * t + (Math.random() - 0.5) * 0.2,
        y: fromY + (toY - fromY) * t + (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        ax: 0, ay: 0,
        size: 5 + Math.random() * 4,
        color: i % 2 ? core : '#ffffff',
        life: 0.18 + t * 0.12, maxLife: 0.3, alpha: 1, shrink: 1.2, type: 'glow',
      });
    }
  }

  magicBurst(x: number, y: number, team: Team): void {
    const c1 = team === 0 ? '#9d6bff' : '#ff6bd0';
    const c2 = team === 0 ? '#6bd5ff' : '#ffb86b';
    this.particles.push({
      x, y, vx: 0, vy: 0, ax: 0, ay: 0,
      size: 26, color: '#ffffff', life: 0.18, maxLife: 0.18, alpha: 1, shrink: 1.5, type: 'glow',
    });
    [c1, c2].forEach((col, k) => {
      this.particles.push({
        x, y, vx: 0, vy: 0, ax: 0, ay: 0,
        size: 6 + k * 4, color: col, life: 0.45, maxLife: 0.45, alpha: 1,
        shrink: -6, type: 'ring', lineWidth: 4 - k,
      });
    });
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
      const sp = 2 + Math.random() * 4;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ax: 0, ay: 1, size: 4 + Math.random() * 4,
        color: [c1, c2, '#ffffff'][Math.floor(Math.random() * 3)],
        life: 0.4 + Math.random() * 0.3, maxLife: 0.7, alpha: 1, shrink: 0.6,
        type: 'star', rotation: Math.random() * Math.PI,
      });
    }
  }

  death(x: number, y: number, team: Team): void {
    const colors = team === 0
      ? ['#4a9eff', '#6eb5ff', '#ffffff']
      : ['#ff4a4a', '#ff7b7b', '#ffffff'];
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ax: 0, ay: 5, size: 4 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.7 + Math.random() * 0.35, maxLife: 1.05, alpha: 1, shrink: 0.4, type: 'circle',
      });
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, outer: number, inner: number): void {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / 5;
  ctx.beginPath();
  ctx.moveTo(0, -outer);
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
    rot += step;
  }
  ctx.lineTo(0, -outer);
  ctx.closePath();
}
