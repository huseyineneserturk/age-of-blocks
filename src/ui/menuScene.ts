// Main-menu background scene: five mini soldiers from historic civilizations
// — Celt, Ottoman, Chinese, Roman, Viking — each with their waving banner on
// a stone pedestal, under a moonlit sky with drifting embers.

import { civLabel, getLang } from '../i18n';
import type { CivId } from '../data/civs';

type Ctx = CanvasRenderingContext2D;

interface Civ {
  id: CivId;
  draw: (ctx: Ctx, s: number, t: number) => void;
  flag: { field: string; trim: string; emblem: (ctx: Ctx, s: number) => void };
}

const SKIN = '#e8b88a';
const SKIN_DARK = '#c89868';
const STEEL = '#cfd6e2';
const STEEL_DARK = '#8a96aa';
const WOOD = '#8a5d33';
const GOLD = '#e8c54a';

interface Ember {
  x: number;
  y: number;
  vy: number;
  vx: number;
  size: number;
  phase: number;
}

export class MenuScene {
  private ctx: Ctx;
  private running = false;
  private embers: Ember[] = [];
  private start = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 26; i++) {
      this.embers.push({
        x: Math.random(),
        y: Math.random(),
        vy: 0.01 + Math.random() * 0.025,
        vx: (Math.random() - 0.5) * 0.008,
        size: 1 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  startLoop(): void {
    if (this.running) return;
    this.running = true;
    const tick = (): void => {
      if (!this.running) return;
      this.draw((performance.now() - this.start) / 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }

  // ------------------------------------------------------------------
  private draw(t: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.drawSky(ctx, w, h, t);
    this.drawGround(ctx, w, h);

    // --- The five civilizations on a stone ground band ---
    // groundY is lifted off the very bottom so the name plaques below each
    // figure stay fully on screen (they used to be clipped at h*0.93).
    const civs = CIVS;
    const groundY = h * 0.8;
    const s = Math.max(30, Math.min(w * 0.046, h * 0.1, 74));

    // Stone plinth band running across the bottom, behind the figures.
    const bandTop = groundY - s * 0.1;
    const bg = ctx.createLinearGradient(0, bandTop, 0, h);
    bg.addColorStop(0, '#2a2c33');
    bg.addColorStop(1, '#16171c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, bandTop, w, h - bandTop);
    ctx.strokeStyle = 'rgba(232,197,74,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bandTop);
    ctx.lineTo(w, bandTop);
    ctx.stroke();

    // Flanking torches with flickering light pools.
    this.drawTorch(ctx, w * 0.045, groundY, s, t);
    this.drawTorch(ctx, w * 0.955, groundY, s, t + 1.3);

    for (let i = 0; i < civs.length; i++) {
      const cx = w * (0.5 + (i - 2) * 0.185);
      const bob = Math.sin(t * 1.4 + i * 1.7) * s * 0.025;
      // cast shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(cx, groundY + s * 0.05, s * 0.8, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      this.drawPedestal(ctx, cx, groundY, s, civLabel(civs[i].id).toLocaleUpperCase(getLang()));
      this.drawFlag(ctx, cx - s * 1.5, groundY, s, t, i, civs[i].flag);
      ctx.save();
      ctx.translate(cx, groundY - s * 1.05 + bob);
      civs[i].draw(ctx, s, t + i);
      ctx.restore();
    }

    this.drawEmbers(ctx, w, h, t);
  }

  private drawSky(ctx: Ctx, w: number, h: number, t: number): void {
    // Moon with halo
    const mx = w * 0.82;
    const my = h * 0.16;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, w * 0.13);
    halo.addColorStop(0, 'rgba(240, 228, 190, 0.30)');
    halo.addColorStop(1, 'rgba(240, 228, 190, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - w * 0.13, my - w * 0.13, w * 0.26, w * 0.26);
    ctx.fillStyle = '#efe6c8';
    ctx.beginPath();
    ctx.arc(mx, my, Math.min(34, w * 0.03), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 188, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(mx - 8, my - 5, 5, 0, Math.PI * 2);
    ctx.arc(mx + 7, my + 8, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Stars (twinkling, deterministic positions)
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % 360) / 360;
      const sy = ((i * 73.3) % 130) / 260;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillStyle = '#d8dff0';
      ctx.fillRect(sx * w, sy * h, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    // Distant mountain silhouettes (two layers)
    const horizon = h * 0.66;
    ctx.fillStyle = '#10151f';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 30);
    for (let x = 0; x <= w; x += w / 12) {
      ctx.lineTo(x, horizon + 18 - Math.abs(Math.sin(x * 0.012 + 2)) * h * 0.10);
    }
    ctx.lineTo(w, horizon + 60);
    ctx.lineTo(0, horizon + 60);
    ctx.fill();
    ctx.fillStyle = '#0b0f17';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 44);
    for (let x = 0; x <= w; x += w / 9) {
      ctx.lineTo(x, horizon + 36 - Math.abs(Math.sin(x * 0.008 + 8)) * h * 0.065);
    }
    ctx.lineTo(w, horizon + 80);
    ctx.lineTo(0, horizon + 80);
    ctx.fill();
  }

  private drawGround(ctx: Ctx, w: number, h: number): void {
    const gy = h * 0.72;
    const grad = ctx.createLinearGradient(0, gy, 0, h);
    grad.addColorStop(0, '#121a14');
    grad.addColorStop(0.4, '#0d130e');
    grad.addColorStop(1, '#070a08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gy, w, h - gy);
    // Sparse grass ticks
    ctx.strokeStyle = 'rgba(70, 100, 60, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const x = ((i * 197) % 1000) / 1000 * w;
      const y = gy + 14 + (((i * 71) % 100) / 100) * (h - gy - 24);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - 5);
      ctx.stroke();
    }
  }

  private drawPedestal(ctx: Ctx, cx: number, groundY: number, s: number, name: string): void {
    const w = s * 2.6;
    const h1 = s * 0.34;
    // Stone slab
    const grad = ctx.createLinearGradient(cx, groundY, cx, groundY + h1);
    grad.addColorStop(0, '#4a4f58');
    grad.addColorStop(1, '#2c3038');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w / 2, groundY, w, h1);
    ctx.fillStyle = '#22252c';
    ctx.fillRect(cx - w / 2 - s * 0.12, groundY + h1, w + s * 0.24, h1 * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(cx - w / 2, groundY, w, h1);

    // Name plaque
    ctx.fillStyle = 'rgba(12, 10, 6, 0.85)';
    const pw = Math.max(s * 2.2, name.length * s * 0.34);
    ctx.fillRect(cx - pw / 2, groundY + h1 * 1.75, pw, s * 0.52);
    ctx.strokeStyle = 'rgba(232, 197, 74, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - pw / 2, groundY + h1 * 1.75, pw, s * 0.52);
    ctx.fillStyle = GOLD;
    ctx.font = `600 ${s * 0.32}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cx, groundY + h1 * 1.75 + s * 0.27);
  }

  /** Banner on a pole, waving slice-by-slice. */
  private drawFlag(
    ctx: Ctx,
    px: number,
    groundY: number,
    s: number,
    t: number,
    phase: number,
    flag: Civ['flag'],
  ): void {
    const poleH = s * 2.9;
    const topY = groundY - poleH;
    // Pole
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = Math.max(2, s * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, groundY + s * 0.2);
    ctx.lineTo(px, topY);
    ctx.stroke();
    // Finial
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(px, topY - s * 0.06, s * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Waving banner (vertical slices)
    const fw = s * 1.5;
    const fh = s * 0.95;
    const slices = 12;
    const amp = s * 0.07;
    const sliceW = fw / slices;
    let prevTop = topY + s * 0.1;
    let prevX = px;
    for (let i = 1; i <= slices; i++) {
      const frac = i / slices;
      const wave = Math.sin(t * 2.4 + phase * 1.3 + frac * 4.2) * amp * frac;
      const x = px + i * sliceW;
      const top = topY + s * 0.1 + wave;
      // shaded by wave slope for a cloth feel
      const shade = Math.max(0, Math.min(1, 0.5 + wave / (amp * 2 || 1)));
      ctx.fillStyle = flag.field;
      ctx.globalAlpha = 0.88 + shade * 0.12;
      ctx.beginPath();
      ctx.moveTo(prevX, prevTop);
      ctx.lineTo(x, top);
      ctx.lineTo(x, top + fh);
      ctx.lineTo(prevX, prevTop + fh);
      ctx.closePath();
      ctx.fill();
      prevTop = top;
      prevX = x;
    }
    ctx.globalAlpha = 1;
    // Trim along the bottom
    ctx.strokeStyle = flag.trim;
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    for (let i = 0; i <= slices; i++) {
      const frac = i / slices;
      const wave = Math.sin(t * 2.4 + phase * 1.3 + frac * 4.2) * amp * frac;
      const x = px + i * sliceW;
      const y = topY + s * 0.1 + wave + fh;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Emblem at banner centre (follows the mid wave)
    const midWave = Math.sin(t * 2.4 + phase * 1.3 + 0.5 * 4.2) * amp * 0.5;
    ctx.save();
    ctx.translate(px + fw / 2, topY + s * 0.1 + midWave + fh / 2);
    flag.emblem(ctx, s);
    ctx.restore();
  }

  private drawTorch(ctx: Ctx, x: number, groundY: number, s: number, t: number): void {
    const poleTop = groundY - s * 2.2;
    // light pool on the ground
    const flick = 0.75 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23) * 0.06;
    const pool = ctx.createRadialGradient(x, poleTop, 0, x, poleTop, s * 3.2 * flick);
    pool.addColorStop(0, 'rgba(255, 170, 70, 0.28)');
    pool.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(x, poleTop, s * 3.2 * flick, 0, Math.PI * 2);
    ctx.fill();
    // pole
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, poleTop);
    ctx.stroke();
    // iron basket
    ctx.fillStyle = '#2c2c30';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, poleTop);
    ctx.lineTo(x + s * 0.28, poleTop);
    ctx.lineTo(x + s * 0.18, poleTop + s * 0.3);
    ctx.lineTo(x - s * 0.18, poleTop + s * 0.3);
    ctx.closePath();
    ctx.fill();
    // flame (layered)
    const fh = s * (0.9 + Math.sin(t * 13) * 0.12);
    const grad = ctx.createLinearGradient(x, poleTop - fh, x, poleTop);
    grad.addColorStop(0, 'rgba(255,240,160,0.95)');
    grad.addColorStop(0.5, '#ff9b30');
    grad.addColorStop(1, '#d83a12');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, poleTop);
    ctx.quadraticCurveTo(x - s * 0.26, poleTop - fh * 0.5, x + Math.sin(t * 9) * s * 0.06, poleTop - fh);
    ctx.quadraticCurveTo(x + s * 0.26, poleTop - fh * 0.5, x + s * 0.22, poleTop);
    ctx.closePath();
    ctx.fill();
    // bright core
    ctx.fillStyle = 'rgba(255,245,200,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, poleTop - fh * 0.4, s * 0.1, fh * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEmbers(ctx: Ctx, w: number, h: number, t: number): void {
    for (const e of this.embers) {
      e.y -= e.vy / 100;
      e.x += e.vx / 100 + Math.sin(t + e.phase) * 0.0003;
      if (e.y < -0.05) {
        e.y = 1.02;
        e.x = Math.random();
      }
      const a = 0.25 + 0.45 * Math.abs(Math.sin(t * 2 + e.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffae5e';
      ctx.beginPath();
      ctx.arc(e.x * w, e.y * h, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ====================================================================
//  Shared body helpers — all soldiers face slightly right.
// ====================================================================

function legs(ctx: Ctx, s: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.14, s * 0.35);
  ctx.lineTo(-s * 0.18, s * 1.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.14, s * 0.35);
  ctx.lineTo(s * 0.18, s * 1.02);
  ctx.stroke();
}

function boots(ctx: Ctx, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(-s * 0.3, s * 0.94, s * 0.26, s * 0.12);
  ctx.fillRect(s * 0.06, s * 0.94, s * 0.26, s * 0.12);
}

function head(ctx: Ctx, s: number): void {
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

// ====================================================================
//  The five civilizations
// ====================================================================

const CIVS: Civ[] = [
  // ----------------------------------------------------------- KELT
  {
    id: 'celt',
    draw: (ctx, s) => {
      legs(ctx, s, '#5d4a32');
      boots(ctx, s, '#3c2f1f');
      // green plaid tunic
      ctx.fillStyle = '#3e7a46';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.05, s * 0.34, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 200, 120, 0.4)';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.2);
      ctx.lineTo(s * 0.3, -s * 0.05);
      ctx.moveTo(-s * 0.3, s * 0.05);
      ctx.lineTo(s * 0.3, s * 0.2);
      ctx.stroke();
      head(ctx, s);
      // wild red hair + moustache
      ctx.fillStyle = '#b4502e';
      ctx.beginPath();
      ctx.arc(0, -s * 0.7, s * 0.27, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.fillRect(-s * 0.3, -s * 0.74, s * 0.1, s * 0.3); // braid
      ctx.fillRect(-s * 0.14, -s * 0.52, s * 0.28, s * 0.06); // moustache
      // round shield with triskele
      ctx.fillStyle = '#6e4a26';
      ctx.beginPath();
      ctx.arc(-s * 0.42, -s * 0.05, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.04;
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 3) * Math.PI * 2;
        ctx.moveTo(-s * 0.42, -s * 0.05);
        ctx.arc(-s * 0.42 + Math.cos(a0) * s * 0.13, -s * 0.05 + Math.sin(a0) * s * 0.13, s * 0.13, a0 + Math.PI, a0 + Math.PI * 1.8);
      }
      ctx.stroke();
      // long sword held up-right
      ctx.save();
      ctx.translate(s * 0.34, -s * 0.15);
      ctx.rotate(-0.5);
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.1);
      ctx.lineTo(0, -s * 0.85);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.fillRect(-s * 0.13, -s * 0.02, s * 0.26, s * 0.07);
      ctx.restore();
    },
    flag: {
      field: '#2e6136',
      trim: GOLD,
      emblem: (ctx, s) => {
        // gold triskele spiral
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a0 = (k / 3) * Math.PI * 2;
          ctx.moveTo(0, 0);
          ctx.arc(Math.cos(a0) * s * 0.12, Math.sin(a0) * s * 0.12, s * 0.12, a0 + Math.PI, a0 + Math.PI * 1.75);
        }
        ctx.stroke();
      },
    },
  },

  // ----------------------------------------------------------- OSMANLI
  {
    id: 'ottoman',
    draw: (ctx, s) => {
      legs(ctx, s, '#7a2430'); // şalvar
      boots(ctx, s, '#caa24a'); // yellow boots
      // red kaftan with gold trim
      ctx.fillStyle = '#a8242e';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.05, s * 0.36, s * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.48);
      ctx.lineTo(0, s * 0.35);
      ctx.stroke();
      // gold sash
      ctx.fillStyle = GOLD;
      ctx.fillRect(-s * 0.34, s * 0.12, s * 0.68, s * 0.1);
      head(ctx, s);
      // white turban with red top + aigrette
      ctx.fillStyle = '#f1ece0';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.74, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8242e';
      ctx.beginPath();
      ctx.arc(0, -s * 0.88, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(s * 0.06, -s * 0.9);
      ctx.lineTo(s * 0.14, -s * 1.12);
      ctx.stroke();
      // kalkan (small round shield)
      ctx.fillStyle = '#7d5a2c';
      ctx.beginPath();
      ctx.arc(-s * 0.42, -s * 0.02, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.035;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-s * 0.42, -s * 0.02, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      // kılıç (curved kilij) raised
      ctx.save();
      ctx.translate(s * 0.36, -s * 0.2);
      ctx.rotate(-0.7);
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = s * 0.075;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.05);
      ctx.quadraticCurveTo(s * 0.28, -s * 0.4, s * 0.05, -s * 0.8);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.fillRect(-s * 0.1, -s * 0.01, s * 0.2, s * 0.07);
      ctx.restore();
    },
    flag: {
      field: '#b01e28',
      trim: '#f1ece0',
      emblem: (ctx, s) => {
        // white crescent + star
        ctx.fillStyle = '#f6f2e8';
        ctx.beginPath();
        ctx.arc(-s * 0.06, 0, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b01e28';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.165, 0, Math.PI * 2);
        ctx.fill();
        // 5-point star
        ctx.fillStyle = '#f6f2e8';
        ctx.save();
        ctx.translate(s * 0.18, 0);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
          const x = Math.cos(a) * s * 0.09;
          const y = Math.sin(a) * s * 0.09;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      },
    },
  },

  // ----------------------------------------------------------- ÇİN
  {
    id: 'china',
    draw: (ctx, s) => {
      legs(ctx, s, '#2c3a4c');
      boots(ctx, s, '#1d2733');
      // jade robe with gold sash
      ctx.fillStyle = '#2a8d77';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(-s * 0.38, s * 0.42);
      ctx.lineTo(s * 0.38, s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(-s * 0.3, s * 0.05, s * 0.6, s * 0.09);
      // lamellar chest hint
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = s * 0.03;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.2 + i * 0.02, -s * 0.32 + i * s * 0.11);
        ctx.lineTo(s * 0.2 - i * 0.02, -s * 0.32 + i * s * 0.11);
        ctx.stroke();
      }
      head(ctx, s);
      // helmet with red plume tassel
      ctx.fillStyle = '#3b4a5c';
      ctx.beginPath();
      ctx.arc(0, -s * 0.68, s * 0.27, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.27, -s * 0.66);
      ctx.lineTo(s * 0.27, -s * 0.66);
      ctx.lineTo(s * 0.2, -s * 0.56);
      ctx.lineTo(-s * 0.2, -s * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e04a3a';
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.95);
      ctx.quadraticCurveTo(s * 0.14, -s * 1.18, s * 0.24, -s * 1.05);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(0, -s * 0.95, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // guandao (pole with curved blade)
      ctx.strokeStyle = '#6e4a26';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(s * 0.4, s * 0.95);
      ctx.lineTo(s * 0.4, -s * 0.95);
      ctx.stroke();
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -s * 0.95);
      ctx.quadraticCurveTo(s * 0.72, -s * 1.1, s * 0.46, -s * 1.5);
      ctx.quadraticCurveTo(s * 0.4, -s * 1.2, s * 0.4, -s * 0.95);
      ctx.fill();
      ctx.fillStyle = '#c33';
      ctx.beginPath();
      ctx.arc(s * 0.4, -s * 0.9, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
    },
    flag: {
      field: '#9c1f1f',
      trim: GOLD,
      emblem: (ctx, s) => {
        // gold dragon S-curve with head
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = s * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.22, s * 0.12);
        ctx.bezierCurveTo(-s * 0.05, s * 0.22, s * 0.0, -s * 0.2, s * 0.2, -s * 0.1);
        ctx.stroke();
        // head
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(s * 0.21, -s * 0.11, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        // whisker
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        ctx.moveTo(s * 0.25, -s * 0.1);
        ctx.lineTo(s * 0.32, -s * 0.04);
        ctx.stroke();
      },
    },
  },

  // ----------------------------------------------------------- ROMA
  {
    id: 'rome',
    draw: (ctx, s) => {
      legs(ctx, s, SKIN_DARK); // bare legs + sandal straps
      ctx.strokeStyle = '#6e4a26';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(-s * 0.24, s * 0.7);
      ctx.lineTo(-s * 0.1, s * 0.78);
      ctx.moveTo(s * 0.1, s * 0.7);
      ctx.lineTo(s * 0.24, s * 0.78);
      ctx.stroke();
      boots(ctx, s, '#5a3c22');
      // red tunic
      ctx.fillStyle = '#a8242e';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.32, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // lorica segmentata (steel bands)
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.18, s * 0.33, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = STEEL_DARK;
      ctx.lineWidth = s * 0.03;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.3 + i * s * 0.12);
        ctx.lineTo(s * 0.3, -s * 0.3 + i * s * 0.12);
        ctx.stroke();
      }
      head(ctx, s);
      // galea helmet + red crest
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.arc(0, -s * 0.66, s * 0.27, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      ctx.fillRect(-s * 0.27, -s * 0.66, s * 0.08, s * 0.22); // cheek guard
      ctx.fillRect(s * 0.19, -s * 0.66, s * 0.08, s * 0.22);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, -s * 0.78, s * 0.3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.fill();
      // scutum (rectangular shield)
      ctx.fillStyle = '#8f1d26';
      ctx.fillRect(-s * 0.62, -s * 0.42, s * 0.36, s * 0.78);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.035;
      ctx.strokeRect(-s * 0.62, -s * 0.42, s * 0.36, s * 0.78);
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(-s * 0.44, -s * 0.03, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // gold wing flourishes
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(-s * 0.44, -s * 0.12);
      ctx.quadraticCurveTo(-s * 0.34, -s * 0.26, -s * 0.3, -s * 0.34);
      ctx.moveTo(-s * 0.44, -s * 0.12);
      ctx.quadraticCurveTo(-s * 0.54, -s * 0.26, -s * 0.58, -s * 0.34);
      ctx.stroke();
      // pilum
      ctx.strokeStyle = '#6e4a26';
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(s * 0.38, s * 0.95);
      ctx.lineTo(s * 0.38, -s * 1.0);
      ctx.stroke();
      ctx.strokeStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(s * 0.38, -s * 1.0);
      ctx.lineTo(s * 0.38, -s * 1.3);
      ctx.stroke();
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(s * 0.33, -s * 1.26);
      ctx.lineTo(s * 0.38, -s * 1.42);
      ctx.lineTo(s * 0.43, -s * 1.26);
      ctx.closePath();
      ctx.fill();
    },
    flag: {
      field: '#7e1a22',
      trim: GOLD,
      emblem: (ctx, s) => {
        // gold aquila (eagle) above SPQR-style bar
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        // wings
        ctx.moveTo(0, -s * 0.05);
        ctx.lineTo(-s * 0.2, -s * 0.14);
        ctx.lineTo(-s * 0.12, -s * 0.02);
        ctx.closePath();
        ctx.moveTo(0, -s * 0.05);
        ctx.lineTo(s * 0.2, -s * 0.14);
        ctx.lineTo(s * 0.12, -s * 0.02);
        ctx.closePath();
        ctx.fill();
        // body + head
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.02, s * 0.05, s * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.015, -s * 0.13, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
        // bar below
        ctx.fillRect(-s * 0.16, s * 0.1, s * 0.32, s * 0.05);
      },
    },
  },

  // ----------------------------------------------------------- VIKING
  {
    id: 'viking',
    draw: (ctx, s) => {
      legs(ctx, s, '#4c3a28');
      boots(ctx, s, '#33261a');
      // dark tunic + fur vest
      ctx.fillStyle = '#3a4250';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.02, s * 0.34, s * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b5640';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.28, s * 0.36, s * 0.2, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // fur texture ticks
      ctx.strokeStyle = '#54422f';
      ctx.lineWidth = s * 0.02;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.09, -s * 0.42);
        ctx.lineTo(i * s * 0.09 + s * 0.02, -s * 0.3);
        ctx.stroke();
      }
      head(ctx, s);
      // blond beard + braid
      ctx.fillStyle = '#caa24a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.55);
      ctx.quadraticCurveTo(0, -s * 0.1, s * 0.2, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.04, -s * 0.25, s * 0.08, s * 0.14); // braided tip
      // iron helm with nose guard
      ctx.fillStyle = STEEL_DARK;
      ctx.beginPath();
      ctx.arc(0, -s * 0.68, s * 0.27, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-s * 0.035, -s * 0.68, s * 0.07, s * 0.18);
      ctx.strokeStyle = '#737f92';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.95);
      ctx.lineTo(0, -s * 0.68);
      ctx.stroke();
      // round shield (red/white quarters)
      const shx = -s * 0.44;
      ctx.fillStyle = '#8f1d26';
      ctx.beginPath();
      ctx.arc(shx, -s * 0.02, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e2d4';
      ctx.beginPath();
      ctx.moveTo(shx, -s * 0.02);
      ctx.arc(shx, -s * 0.02, s * 0.3, -Math.PI / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(shx, -s * 0.02);
      ctx.arc(shx, -s * 0.02, s * 0.3, Math.PI / 2, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = STEEL_DARK;
      ctx.beginPath();
      ctx.arc(shx, -s * 0.02, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2c2620';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.arc(shx, -s * 0.02, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      // bearded axe over shoulder
      ctx.save();
      ctx.translate(s * 0.32, -s * 0.1);
      ctx.rotate(0.5);
      ctx.strokeStyle = '#6e4a26';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.45);
      ctx.lineTo(0, -s * 0.75);
      ctx.stroke();
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.75);
      ctx.quadraticCurveTo(s * 0.34, -s * 0.72, s * 0.3, -s * 0.38);
      ctx.quadraticCurveTo(s * 0.12, -s * 0.52, 0, -s * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    flag: {
      field: '#23303f',
      trim: '#e8e2d4',
      emblem: (ctx, s) => {
        // white raven
        ctx.fillStyle = '#e8e2d4';
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.13, s * 0.07, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // wing (angular)
        ctx.beginPath();
        ctx.moveTo(-s * 0.02, -s * 0.03);
        ctx.lineTo(s * 0.1, -s * 0.18);
        ctx.lineTo(s * 0.04, -s * 0.02);
        ctx.closePath();
        ctx.fill();
        // head + beak
        ctx.beginPath();
        ctx.arc(-s * 0.13, -s * 0.05, s * 0.045, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.17, -s * 0.05);
        ctx.lineTo(-s * 0.24, -s * 0.02);
        ctx.lineTo(-s * 0.16, -s * 0.01);
        ctx.closePath();
        ctx.fill();
        // tail
        ctx.beginPath();
        ctx.moveTo(s * 0.11, s * 0.02);
        ctx.lineTo(s * 0.2, s * 0.07);
        ctx.lineTo(s * 0.1, s * 0.06);
        ctx.closePath();
        ctx.fill();
      },
    },
  },
];
