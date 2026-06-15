// Premium 3D-shaded military figures with smooth animations.
// All figures are drawn facing right around origin (0,0); callers translate,
// then mirror with scale(-1,1) for left-facing. `s` is the base half-size in px.

import type { Team, UnitKind } from '../data/units';
import { CIVS, type CivId } from '../data/civs';
import { CIV_PAL } from './civArt';

const PAL = {
  skin: '#e8b88a',
  skinShadow: '#c4946a',
  skinHighlight: '#f5d4b0',
  steel: '#dfe6f0',
  steelDark: '#9aa7bd',
  steelHighlight: '#f0f4ff',
  wood: '#9b6a3a',
  woodDark: '#6e4a26',
  woodHighlight: '#c49055',
  gold: '#ffd700',
  goldDark: '#c5a200',
  goldHighlight: '#ffe866',
  leather: '#8a6235',
  leatherDark: '#614322',
};

type Ctx = CanvasRenderingContext2D;

// --- Gradient helpers for 3D depth ---

function bodyGrad(ctx: Ctx, x: number, y: number, r: number, col: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(col, 20));
  g.addColorStop(0.55, col);
  g.addColorStop(1, dark);
  return g;
}

function metalGrad(ctx: Ctx, x: number, y: number, r: number): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, PAL.steelHighlight);
  g.addColorStop(0.4, PAL.steel);
  g.addColorStop(1, PAL.steelDark);
  return g;
}

function woodGrad(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, PAL.woodHighlight);
  g.addColorStop(0.5, PAL.wood);
  g.addColorStop(1, PAL.woodDark);
  return g;
}

function goldGrad(ctx: Ctx, x: number, y: number, r: number): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.25, r * 0.05, x, y, r);
  g.addColorStop(0, PAL.goldHighlight);
  g.addColorStop(0.5, PAL.gold);
  g.addColorStop(1, PAL.goldDark);
  return g;
}

function lighten(hex: string, amt: number): string {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  let r = parseInt(color.slice(0, 2), 16);
  let g = parseInt(color.slice(2, 4), 16);
  let b = parseInt(color.slice(4, 6), 16);
  r = Math.min(255, r + amt);
  g = Math.min(255, g + amt);
  b = Math.min(255, b + amt);
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, amt: number): string {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  let r = parseInt(color.slice(0, 2), 16);
  let g = parseInt(color.slice(2, 4), 16);
  let b = parseInt(color.slice(4, 6), 16);
  r = Math.max(0, r - amt);
  g = Math.max(0, g - amt);
  b = Math.max(0, b - amt);
  return `rgb(${r},${g},${b})`;
}

// Smooth sinusoidal walk helper — replaces harsh linear leg swing
function smoothWalk(walk: number, phase: number): number {
  return Math.sin(walk + phase * Math.PI) * 0.95;
}

/**
 * Draw a unit. The BODY uses the civilization's cloth palette (so a Roman and
 * an Ottoman knight look materially different); ownership is conveyed by the
 * team ground-ring drawn in the renderer + civ-specific kit accents here.
 */
export function drawFigure(
  ctx: Ctx,
  kind: UnitKind,
  civ: CivId | undefined,
  team: Team,
  s: number,
  walk: number, // -1..1 leg swing
  atk: number, // 0 or 1 attack pose
): void {
  const pal = civ ? CIV_PAL[civ] : CIV_PAL.rome;
  const col = pal.cloth;
  const dark = pal.clothDark;
  const activeCiv = civ || 'rome';
  switch (kind) {
    case 'cavalry': figCavalry(ctx, s, col, dark, walk, atk, activeCiv); break;
    case 'catapult': figCatapult(ctx, s, col, atk); break;
    case 'archer': figArcher(ctx, s, col, dark, walk, atk, activeCiv); break;
    case 'spear': figSpear(ctx, s, col, dark, walk, atk, activeCiv, team); break;
    case 'villager': figVillager(ctx, s, col, dark, walk, atk); break;
    case 'commander': figCommander(ctx, s, col, dark, walk, atk, civ); break;
    case 'golem': figGolem(ctx, s, atk); break;
    case 'wolf': figWolf(ctx, s, walk, atk); break;
    case 'pirate': figPirate(ctx, s, walk, atk); break;
    case 'gladiator': figGladiator(ctx, s, col, dark, walk, atk); break;
    case 'janissary': figJanissary(ctx, s, col, dark, walk, atk); break;
    case 'berserker': figBerserker(ctx, s, col, dark, walk, atk); break;
    case 'druid': figDruid(ctx, s, col, dark, walk, atk); break;
    default: figKnight(ctx, s, col, dark, walk, atk, activeCiv, team); break;
  }
  if (civ && kind !== 'pirate') civAccent(ctx, kind, s, civ, team);
}

// --------------------------------------------------------------------
// Civilization accents: distinctive headdress/crest + shield mark
// layered over the base figure, so each civ's army reads differently.
// Now with 3D shading.
// --------------------------------------------------------------------

function civAccent(ctx: Ctx, kind: UnitKind, s: number, civ: CivId, _team: Team): void {
  const accent = CIVS[civ].accent;

  let hx = 0;
  let hy = -s * 0.62;
  let hr = s * 0.26;
  if (kind === 'cavalry') {
    hx = -s * 0.05;
    hy = -s * 0.74;
    hr = s * 0.18;
  }
  if (kind === 'golem' || kind === 'wolf' || kind === 'catapult' || kind === 'commander') {
    if (kind === 'catapult') {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.lineTo(s * 0.34, -s * 0.2);
      ctx.lineTo(0, -s * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  switch (civ) {
    case 'rome': {
      // Red crest with 3D shading
      const g = ctx.createLinearGradient(hx, hy - hr * 0.8, hx, hy);
      g.addColorStop(0, '#e74c3c');
      g.addColorStop(0.5, '#c0392b');
      g.addColorStop(1, '#922b21');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.45, hr * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      ctx.fill();
      break;
    }
    case 'ottoman': {
      // White turban wrap with shading
      const tg = ctx.createRadialGradient(hx, hy - hr * 0.5, hr * 0.1, hx, hy - hr * 0.35, hr * 1.1);
      tg.addColorStop(0, '#ffffff');
      tg.addColorStop(0.6, '#f1ece0');
      tg.addColorStop(1, '#d5cfc0');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.35, hr * 1.05, hr * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Jewel with glow
      ctx.fillStyle = goldGrad(ctx, hx, hy - hr * 0.85, hr * 0.3);
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.85, hr * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.85, hr * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'china': {
      // Red tassel plume curving back
      ctx.strokeStyle = '#e04a3a';
      ctx.lineWidth = s * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy - hr * 0.9);
      ctx.quadraticCurveTo(hx - hr * 0.7, hy - hr * 1.7, hx - hr * 1.2, hy - hr * 1.1);
      ctx.stroke();
      ctx.fillStyle = goldGrad(ctx, hx, hy - hr * 0.9, hr * 0.18);
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.9, hr * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'viking': {
      // Iron helm ridge + nose guard with metallic gradient
      const vg = ctx.createLinearGradient(hx - s * 0.05, hy, hx + s * 0.05, hy);
      vg.addColorStop(0, '#8a95a6');
      vg.addColorStop(0.5, '#b0bcc8');
      vg.addColorStop(1, '#6b7888');
      ctx.strokeStyle = vg;
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(hx, hy - hr * 1.05);
      ctx.lineTo(hx, hy + hr * 0.25);
      ctx.stroke();
      break;
    }
    case 'celt': {
      // Wild red hair spikes with shading
      const cg = ctx.createRadialGradient(hx, hy - hr * 0.4, hr * 0.1, hx, hy - hr * 0.3, hr * 1.0);
      cg.addColorStop(0, '#d96e3d');
      cg.addColorStop(1, '#8b3a15');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.3, hr * 0.95, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      // Woad stripe
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.55)';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.5, hy + hr * 0.05);
      ctx.lineTo(hx + hr * 0.5, hy + hr * 0.05);
      ctx.stroke();
      break;
    }
  }
}

// --- Shared drawing primitives with 3D shading ---

function legs3D(ctx: Ctx, s: number, color: string, colorDark: string, walk: number): void {
  const lw = s * 0.2;
  const sw = smoothWalk(walk, 0);
  const sw2 = smoothWalk(walk, 1);

  // Left leg (shadow)
  ctx.strokeStyle = colorDark;
  ctx.lineWidth = lw + 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, s * 0.32);
  ctx.lineTo(-s * 0.13 + sw * s * 0.2, s * 0.92);
  ctx.stroke();
  // Left leg (lit)
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, s * 0.32);
  ctx.lineTo(-s * 0.13 + sw * s * 0.2, s * 0.92);
  ctx.stroke();

  // Right leg (shadow)
  ctx.strokeStyle = colorDark;
  ctx.lineWidth = lw + 2;
  ctx.beginPath();
  ctx.moveTo(s * 0.13, s * 0.32);
  ctx.lineTo(s * 0.13 + sw2 * s * 0.2, s * 0.92);
  ctx.stroke();
  // Right leg (lit)
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(s * 0.13, s * 0.32);
  ctx.lineTo(s * 0.13 + sw2 * s * 0.2, s * 0.92);
  ctx.stroke();

  // Boots — small rounded rectangles at feet
  const bootCol = darken(color, 25);
  ctx.fillStyle = bootCol;
  const lx1 = -s * 0.13 + sw * s * 0.2;
  const lx2 = s * 0.13 + sw2 * s * 0.2;
  ctx.beginPath();
  ctx.ellipse(lx1, s * 0.94, s * 0.11, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(lx2, s * 0.94, s * 0.11, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
}

function torsoHead3D(ctx: Ctx, s: number, col: string, dark: string, helmet: string | null): void {
  // Torso with 3D gradient
  ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.05, s * 0.38, col, dark);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belt / waist detail
  ctx.fillStyle = darken(dark, 15);
  ctx.fillRect(-s * 0.28, s * 0.05, s * 0.56, s * 0.08);
  // Belt buckle
  ctx.fillStyle = PAL.goldDark;
  ctx.fillRect(-s * 0.05, s * 0.05, s * 0.1, s * 0.08);

  // Chainmail shimmer on upper torso
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = PAL.steelHighlight;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.2, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Head with skin gradient
  const sg = ctx.createRadialGradient(-s * 0.06, -s * 0.66, s * 0.04, 0, -s * 0.62, s * 0.24);
  sg.addColorStop(0, PAL.skinHighlight);
  sg.addColorStop(0.6, PAL.skin);
  sg.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#2c1810';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.64, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlight
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s * 0.075, -s * 0.65, s * 0.015, 0, Math.PI * 2);
  ctx.fill();

  if (helmet) {
    // Helmet with metallic 3D gradient
    const hg = metalGrad(ctx, 0, -s * 0.7, s * 0.28);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -s * 0.64, s * 0.26, Math.PI, Math.PI * 2);
    ctx.fill();
    // Helmet brim
    ctx.fillStyle = darken(helmet, 10);
    ctx.fillRect(-s * 0.27, -s * 0.66, s * 0.54, s * 0.08);
    // Highlight streak
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-s * 0.1, -s * 0.76, s * 0.2, s * 0.04);
    ctx.globalAlpha = 1;
  }
}

// --- Smooth attack interpolation ---
function atkSwing(atk: number): number {
  if (!atk) return 0;
  return Math.sin(Date.now() * 0.012) * 0.4 + 0.6;
}

// =====================================================================
// UNIT FIGURES — Full 3D Rework
// =====================================================================

// --- Custom Civ drawing helpers for Shields and Weapons ---

function drawCivShield(ctx: Ctx, s: number, x: number, y: number, civ: CivId, team: Team, sizeMult: number = 1): void {
  const r = s * 0.16 * sizeMult;
  const teamCol = team === 0 ? '#7ab8ff' : team === 1 ? '#ff8a8a' : '#c3a6e6';

  ctx.save();
  ctx.translate(x, y);

  switch (civ) {
    case 'rome': {
      // Rectangular red/gold scutum shield
      const w = r * 1.5;
      const h = r * 2.4;
      const rx = -w / 2;
      const ry = -h / 2;
      ctx.fillStyle = '#9e2a2b';
      ctx.fillRect(rx, ry, w, h);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(rx + 2, ry + 2, w - 4, h - 4);
      ctx.strokeStyle = '#ffb703';
      ctx.lineWidth = s * 0.03;
      ctx.strokeRect(rx + 1, ry + 1, w - 2, h - 2);
      ctx.fillStyle = goldGrad(ctx, 0, 0, r * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ottoman': {
      // Round gilded steel kalkan shield
      const radius = r * 1.15;
      ctx.fillStyle = goldGrad(ctx, 0, 0, radius);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = teamCol;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'china': {
      // Oval dragon shield
      const w = r * 1.4;
      const h = r * 2.1;
      ctx.fillStyle = '#1d3557';
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(0.1, (w / 2) - 1), Math.max(0.1, (h / 2) - 1), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'viking': {
      // Round wooden shield with iron boss
      const radius = r * 1.15;
      ctx.fillStyle = '#8a6235';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c401f';
      ctx.lineWidth = s * 0.025;
      for (let i = -1; i <= 1; i++) {
        const px = i * radius * 0.4;
        ctx.beginPath();
        ctx.moveTo(px, -Math.sqrt(radius * radius - px * px));
        ctx.lineTo(px, Math.sqrt(radius * radius - px * px));
        ctx.stroke();
      }
      ctx.strokeStyle = teamCol;
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, radius - 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = metalGrad(ctx, 0, 0, radius * 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'celt': {
      // Oval Celtic shield with bronze boss and Celtic pattern
      const w = r * 1.3;
      const h = r * 2.2;
      ctx.fillStyle = '#2a9d8f';
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e9c46a';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(0.1, (w / 2) - 1.5), Math.max(0.1, (h / 2) - 1.5), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = goldGrad(ctx, 0, 0, r * 0.28);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawCivSword(ctx: Ctx, s: number, swing: number, civ: CivId): void {
  ctx.save();
  ctx.translate(s * 0.26, -s * 0.18);
  ctx.rotate(swing);

  // Arm
  ctx.strokeStyle = PAL.skin;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.2);
  ctx.stroke();

  switch (civ) {
    case 'rome': {
      // Roman Gladius
      const sg = ctx.createLinearGradient(-s * 0.05, -s * 0.2, s * 0.05, -s * 0.68);
      sg.addColorStop(0, PAL.steelDark);
      sg.addColorStop(0.5, PAL.steelHighlight);
      sg.addColorStop(1, PAL.steel);
      ctx.strokeStyle = sg;
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(0, -s * 0.68);
      ctx.stroke();
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(-s * 0.11, -s * 0.23, s * 0.22, s * 0.055);
      ctx.fillStyle = PAL.gold;
      ctx.beginPath();
      ctx.arc(0, s * 0.04, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ottoman': {
      // Curved Scimitar
      ctx.strokeStyle = PAL.steel;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.12, -s * 0.5, s * 0.18, -s * 0.76);
      ctx.stroke();
      ctx.strokeStyle = PAL.steelHighlight;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(s * 0.02, -s * 0.25);
      ctx.quadraticCurveTo(s * 0.13, -s * 0.5, s * 0.17, -s * 0.74);
      ctx.stroke();
      ctx.fillStyle = PAL.gold;
      ctx.save();
      ctx.rotate(0.2);
      ctx.fillRect(-s * 0.12, -s * 0.22, s * 0.24, s * 0.05);
      ctx.restore();
      break;
    }
    case 'china': {
      // Chinese Dao
      const sg = ctx.createLinearGradient(-s * 0.04, -s * 0.2, s * 0.04, -s * 0.78);
      sg.addColorStop(0, PAL.steelDark);
      sg.addColorStop(0.5, PAL.steelHighlight);
      sg.addColorStop(1, PAL.steel);
      ctx.strokeStyle = sg;
      ctx.lineWidth = s * 0.075;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(0, -s * 0.78);
      ctx.stroke();
      ctx.fillStyle = PAL.gold;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.22, s * 0.09, s * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 0.05, s * 0.1, s * 0.03, s * 0.2);
      ctx.stroke();
      break;
    }
    case 'viking': {
      // Viking Battle Axe
      ctx.strokeStyle = PAL.wood;
      ctx.lineWidth = s * 0.055;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.1);
      ctx.lineTo(0, -s * 0.65);
      ctx.stroke();
      const ag = ctx.createLinearGradient(0, -s * 0.6, s * 0.25, -s * 0.5);
      ag.addColorStop(0, PAL.steelDark);
      ag.addColorStop(0.5, PAL.steelHighlight);
      ag.addColorStop(1, PAL.steel);
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.65);
      ctx.quadraticCurveTo(s * 0.25, -s * 0.7, s * 0.28, -s * 0.52);
      ctx.lineTo(s * 0.22, -s * 0.42);
      ctx.quadraticCurveTo(s * 0.08, -s * 0.38, 0, -s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'celt': {
      // Celtic Broadsword
      const sg = ctx.createLinearGradient(-s * 0.05, -s * 0.2, s * 0.05, -s * 0.85);
      sg.addColorStop(0, PAL.steelDark);
      sg.addColorStop(0.5, PAL.steelHighlight);
      sg.addColorStop(1, PAL.steel);
      ctx.strokeStyle = sg;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(0, -s * 0.85);
      ctx.stroke();
      ctx.fillStyle = PAL.goldDark;
      ctx.beginPath();
      ctx.moveTo(-s * 0.14, -s * 0.26);
      ctx.lineTo(0, -s * 0.21);
      ctx.lineTo(s * 0.14, -s * 0.26);
      ctx.lineTo(0, -s * 0.24);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawCivSpear(ctx: Ctx, s: number, thrust: number, civ: CivId): void {
  ctx.save();
  ctx.translate(s * 0.24, -s * 0.15);
  ctx.rotate(thrust);

  // Shaft
  ctx.strokeStyle = woodGrad(ctx, 0, s * 0.5, 0, -s * 1.05);
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.lineTo(0, -s * 1.05);
  ctx.stroke();

  switch (civ) {
    case 'rome': {
      // Pilum spear
      ctx.strokeStyle = PAL.steelDark;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(0, -s * 1.15);
      ctx.stroke();
      ctx.fillStyle = PAL.steel;
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, -s * 1.15);
      ctx.lineTo(0, -s * 1.25);
      ctx.lineTo(s * 0.05, -s * 1.15);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ottoman': {
      // Partizan Crescent spear
      ctx.fillStyle = PAL.steel;
      ctx.beginPath();
      ctx.moveTo(-s * 0.06, -s * 1.05);
      ctx.lineTo(0, -s * 1.28);
      ctx.lineTo(s * 0.06, -s * 1.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PAL.steelDark;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.arc(0, -s * 1.0, s * 0.09, Math.PI, 0, true);
      ctx.stroke();
      break;
    }
    case 'china': {
      // Chinese Qiang spear with red horsehair tassel
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.02, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.steelHighlight;
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.15, s * 0.05, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'viking': {
      // Hewing spear
      const sg = ctx.createLinearGradient(-s * 0.04, -s * 1.05, s * 0.04, -s * 1.3);
      sg.addColorStop(0, PAL.steelDark);
      sg.addColorStop(0.5, PAL.steelHighlight);
      sg.addColorStop(1, PAL.steel);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 1.05);
      ctx.lineTo(-s * 0.05, -s * 1.2);
      ctx.lineTo(0, -s * 1.32);
      ctx.lineTo(s * 0.05, -s * 1.2);
      ctx.lineTo(s * 0.08, -s * 1.05);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'celt': {
      // Wavy flamespear
      ctx.fillStyle = PAL.steel;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.0);
      ctx.bezierCurveTo(-s * 0.08, -s * 1.08, s * 0.08, -s * 1.16, 0, -s * 1.28);
      ctx.bezierCurveTo(s * 0.08, -s * 1.16, -s * 0.08, -s * 1.08, 0, -s * 1.0);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function figKnight(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number, civ: CivId, team: Team): void {
  legs3D(ctx, s, dark, darken(dark, 25), walk);

  // Draw civilization specific shield on back
  drawCivShield(ctx, s, -s * 0.34, -s * 0.05, civ, team);

  torsoHead3D(ctx, s, col, dark, dark);

  // Sword/Axe arm with smooth swing
  const swing = atk ? -0.6 - atkSwing(atk) * 0.7 : -0.25;
  drawCivSword(ctx, s, swing, civ);
}

function figSpear(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number, civ: CivId, team: Team): void {
  legs3D(ctx, s, dark, darken(dark, 25), walk);
  torsoHead3D(ctx, s, col, dark, dark);

  // Long spear with smooth thrust animation
  const thrust = atk ? 0.05 + atkSwing(atk) * 0.15 : -0.55;
  drawCivSpear(ctx, s, thrust, civ);

  // Draw civilization specific buckler shield on back (slightly smaller)
  drawCivShield(ctx, s, -s * 0.32, -s * 0.05, civ, team, 0.85);
}

function figArcher(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number, civ: CivId): void {
  legs3D(ctx, s, dark, darken(dark, 25), walk);
  torsoHead3D(ctx, s, col, dark, null);

  // Hood — 3D shading
  const hg = ctx.createRadialGradient(-s * 0.05, -s * 0.68, s * 0.05, 0, -s * 0.62, s * 0.28);
  hg.addColorStop(0, lighten(col, 15));
  hg.addColorStop(0.7, col);
  hg.addColorStop(1, dark);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.27, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();

  // Quiver on back
  ctx.fillStyle = PAL.leatherDark;
  ctx.fillRect(-s * 0.22, -s * 0.5, s * 0.1, s * 0.5);
  // Arrow tips poking out
  ctx.strokeStyle = PAL.steelDark;
  ctx.lineWidth = s * 0.02;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.2 + i * s * 0.03, -s * 0.5);
    ctx.lineTo(-s * 0.19 + i * s * 0.03, -s * 0.58);
    ctx.stroke();
  }

  // Bow + string — smooth draw animation
  const bx = s * 0.3;
  const by = -s * 0.1;
  const br = s * 0.42;

  // Custom bow shape
  ctx.strokeStyle = woodGrad(ctx, bx - br, by - br, bx + br, by + br);
  ctx.lineWidth = s * 0.065;
  ctx.lineCap = 'round';
  
  if (civ === 'ottoman') {
    // Ottoman Composite Horn Bow: highly recurved
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(-Math.PI * 0.6) * br, by + Math.sin(-Math.PI * 0.6) * br);
    ctx.quadraticCurveTo(bx - br * 0.25, by - br * 0.3, bx + br * 0.2, by);
    ctx.quadraticCurveTo(bx - br * 0.25, by + br * 0.3, bx + Math.cos(Math.PI * 0.6) * br, by + Math.sin(Math.PI * 0.6) * br);
    ctx.stroke();
  } else if (civ === 'china') {
    // Chinese Crossbow prod
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(-Math.PI * 0.5) * br, by + Math.sin(-Math.PI * 0.5) * br);
    ctx.quadraticCurveTo(bx + br * 0.4, by, bx + Math.cos(Math.PI * 0.5) * br, by + Math.sin(Math.PI * 0.5) * br);
    ctx.stroke();
    // Tiller stock
    ctx.strokeStyle = PAL.woodDark;
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.1, by);
    ctx.lineTo(bx + s * 0.3, by);
    ctx.stroke();
  } else {
    // Standard longbow curve
    ctx.beginPath();
    ctx.arc(bx, by, br, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();
  }

  // Bow tips — gold nocks
  const topx = bx + Math.cos(-Math.PI * 0.55) * br;
  const topy = by + Math.sin(-Math.PI * 0.55) * br;
  const botx = bx + Math.cos(Math.PI * 0.55) * br;
  const boty = by + Math.sin(Math.PI * 0.55) * br;
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.arc(topx, topy, s * 0.03, 0, Math.PI * 2);
  ctx.arc(botx, boty, s * 0.03, 0, Math.PI * 2);
  ctx.fill();

  // Draw string with smooth pull
  const drawAmt = atk ? Math.sin(Date.now() * 0.008) * 0.3 + 0.5 : 0;
  const nockx = bx - drawAmt * s * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(topx, topy);
  ctx.lineTo(nockx, by);
  ctx.lineTo(botx, boty);
  ctx.stroke();

  // Arrow when drawn
  if (atk) {
    ctx.strokeStyle = PAL.wood;
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(nockx - s * 0.05, by);
    ctx.lineTo(bx + br * 0.6, by);
    ctx.stroke();
    // Arrowhead
    ctx.fillStyle = PAL.steel;
    ctx.beginPath();
    ctx.moveTo(bx + br * 0.6, by - s * 0.03);
    ctx.lineTo(bx + br * 0.75, by);
    ctx.lineTo(bx + br * 0.6, by + s * 0.03);
    ctx.closePath();
    ctx.fill();
  }
}

function figVillager(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  // Legs
  ctx.strokeStyle = darken('#5a3c22', 15);
  ctx.lineWidth = s * 0.16 + 1;
  ctx.lineCap = 'round';
  const sw = smoothWalk(walk, 0);
  const sw2 = smoothWalk(walk, 1);
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, s * 0.2);
  ctx.lineTo(-s * 0.15 + sw * s * 0.2, s * 0.9);
  ctx.moveTo(s * 0.15, s * 0.2);
  ctx.lineTo(s * 0.15 + sw2 * s * 0.2, s * 0.9);
  ctx.stroke();
  ctx.strokeStyle = '#5a3c22';
  ctx.lineWidth = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, s * 0.2);
  ctx.lineTo(-s * 0.15 + sw * s * 0.2, s * 0.9);
  ctx.moveTo(s * 0.15, s * 0.2);
  ctx.lineTo(s * 0.15 + sw2 * s * 0.2, s * 0.9);
  ctx.stroke();

  // Body — tunic with gradient
  ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.1, s * 0.36, col, dark);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1, s * 0.32, s * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  // Apron detail
  ctx.fillStyle = darken(col, 20);
  ctx.fillRect(-s * 0.18, s * 0.05, s * 0.36, s * 0.2);

  // Head
  const sg = ctx.createRadialGradient(-s * 0.05, -s * 0.62, s * 0.04, 0, -s * 0.58, s * 0.22);
  sg.addColorStop(0, PAL.skinHighlight);
  sg.addColorStop(0.6, PAL.skin);
  sg.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, -s * 0.58, s * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Straw hat
  ctx.fillStyle = '#c8a86a';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.68, s * 0.32, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8944a';
  ctx.beginPath();
  ctx.arc(0, -s * 0.72, s * 0.18, Math.PI, Math.PI * 2);
  ctx.fill();

  // Hammer/Tool with smooth hammering animation
  ctx.save();
  ctx.translate(s * 0.2, -s * 0.1);
  if (atk) {
    const hammerSwing = Math.sin(Date.now() * 0.015) * 0.6 + 0.2;
    ctx.rotate(hammerSwing);
  } else {
    ctx.rotate(-0.3);
  }
  // Handle — wood gradient
  ctx.strokeStyle = woodGrad(ctx, 0, s * 0.3, 0, -s * 0.45);
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.lineTo(0, -s * 0.45);
  ctx.stroke();
  // Hammer head — metallic
  ctx.fillStyle = metalGrad(ctx, 0, -s * 0.48, s * 0.16);
  ctx.fillRect(-s * 0.14, -s * 0.55, s * 0.28, s * 0.16);
  ctx.restore();
}

function figCommander(
  ctx: Ctx,
  s: number,
  _col: string,
  dark: string,
  walk: number,
  atk: number,
  civ: CivId | undefined,
): void {
  let capeColor = dark;

  if (civ === 'rome') capeColor = '#78281f';
  else if (civ === 'ottoman') capeColor = '#1e8449';
  else if (civ === 'china') capeColor = '#7d6608';
  else if (civ === 'viking') capeColor = '#5d6d7e';
  else if (civ === 'celt') capeColor = '#a04000';

  // Cape with flowing animation — 3D gradient
  const capeWave = Math.sin(Date.now() * 0.003 + walk) * s * 0.05;
  const cg = ctx.createLinearGradient(-s * 0.3, -s * 0.4, -s * 0.1, s * 0.8);
  cg.addColorStop(0, lighten(capeColor, 20));
  cg.addColorStop(0.5, capeColor);
  cg.addColorStop(1, darken(capeColor, 30));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.35);
  ctx.lineTo(-s * 0.65 + capeWave, s * 0.85);
  ctx.lineTo(s * 0.05 + capeWave * 0.5, s * 0.85);
  ctx.closePath();
  ctx.fill();
  // Cape edge highlight
  ctx.strokeStyle = lighten(capeColor, 15);
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.35);
  ctx.lineTo(-s * 0.65 + capeWave, s * 0.85);
  ctx.stroke();

  // Legs — armored
  const sw = smoothWalk(walk, 0);
  const sw2 = smoothWalk(walk, 1);
  ctx.strokeStyle = PAL.steelDark;
  ctx.lineWidth = s * 0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, s * 0.2);
  ctx.lineTo(-s * 0.18 + sw * s * 0.2, s * 0.9);
  ctx.moveTo(s * 0.18, s * 0.2);
  ctx.lineTo(s * 0.18 + sw2 * s * 0.2, s * 0.9);
  ctx.stroke();

  // Golden boots/greaves
  ctx.fillStyle = goldGrad(ctx, 0, s * 0.76, s * 0.16);
  const bx1 = -s * 0.18 + sw * s * 0.2;
  const bx2 = s * 0.18 + sw2 * s * 0.2;
  ctx.fillRect(bx1 - s * 0.08, s * 0.72, s * 0.16, s * 0.18);
  ctx.fillRect(bx2 - s * 0.08, s * 0.72, s * 0.16, s * 0.18);

  // Body — Plate armor with metallic 3D gradient
  ctx.fillStyle = metalGrad(ctx, 0, -s * 0.12, s * 0.42);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.12, s * 0.38, s * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pauldrons (shoulder armor)
  ctx.fillStyle = metalGrad(ctx, -s * 0.3, -s * 0.35, s * 0.12);
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.35, s * 0.14, s * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metalGrad(ctx, s * 0.3, -s * 0.35, s * 0.12);
  ctx.beginPath();
  ctx.ellipse(s * 0.3, -s * 0.35, s * 0.14, s * 0.1, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Golden chest decoration (crest)
  ctx.fillStyle = goldGrad(ctx, 0, -s * 0.15, s * 0.12);
  ctx.beginPath();
  ctx.arc(0, -s * 0.15, s * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Head
  const headG = ctx.createRadialGradient(-s * 0.06, -s * 0.7, s * 0.04, 0, -s * 0.65, s * 0.24);
  headG.addColorStop(0, PAL.skinHighlight);
  headG.addColorStop(0.6, PAL.skin);
  headG.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(0, -s * 0.65, s * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Commander eyes — intense
  ctx.fillStyle = '#1a0c05';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.67, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s * 0.075, -s * 0.68, s * 0.015, 0, Math.PI * 2);
  ctx.fill();

  // Civilization-specific Headdresses
  if (civ === 'rome') {
    // Golden laurel wreath — 3D
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.7, s * 0.25);
    ctx.beginPath();
    ctx.arc(-s * 0.22, -s * 0.68, s * 0.07, 0, Math.PI * 2);
    ctx.arc(s * 0.22, -s * 0.68, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.arc(0, -s * 0.68, s * 0.25, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Red crest plume
    const pg = ctx.createLinearGradient(0, -s * 1.1, 0, -s * 0.8);
    pg.addColorStop(0, '#ff2222');
    pg.addColorStop(0.5, '#c0392b');
    pg.addColorStop(1, '#7b241c');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.95, s * 0.08, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (civ === 'ottoman') {
    const tg = ctx.createRadialGradient(0, -s * 0.85, s * 0.05, 0, -s * 0.78, s * 0.3);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.6, '#f5f0e0');
    tg.addColorStop(1, '#d5cfc0');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.78, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, -s * 0.88, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    // Feather
    ctx.strokeStyle = '#fafafa';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.92);
    ctx.quadraticCurveTo(s * 0.15, -s * 1.15, s * 0.05, -s * 1.2);
    ctx.stroke();
  } else if (civ === 'china') {
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(-s * 0.18, -s * 0.95, s * 0.36, s * 0.3);
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.72, s * 0.22);
    ctx.fillRect(-s * 0.22, -s * 0.72, s * 0.44, s * 0.06);
  } else if (civ === 'viking') {
    ctx.fillStyle = metalGrad(ctx, 0, -s * 0.75, s * 0.28);
    ctx.beginPath();
    ctx.arc(0, -s * 0.68, s * 0.25, Math.PI, Math.PI * 2);
    ctx.fill();
    // Horns — ivory gradient
    const hornG = ctx.createLinearGradient(-s * 0.4, -s * 1.05, -s * 0.2, -s * 0.74);
    hornG.addColorStop(0, '#f5f0e0');
    hornG.addColorStop(1, '#d5cbb0');
    ctx.strokeStyle = hornG;
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.74);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.95, -s * 0.38, -s * 1.05);
    ctx.moveTo(s * 0.22, -s * 0.74);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.95, s * 0.38, -s * 1.05);
    ctx.stroke();
  } else if (civ === 'celt') {
    const og = ctx.createRadialGradient(0, -s * 0.7, s * 0.05, 0, -s * 0.65, s * 0.28);
    og.addColorStop(0, '#e67e22');
    og.addColorStop(1, '#8b4513');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(0, -s * 0.65, s * 0.26, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.8, s * 0.15);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.75);
    ctx.lineTo(0, -s * 0.9);
    ctx.lineTo(s * 0.2, -s * 0.75);
    ctx.lineTo(0, -s * 0.68);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = metalGrad(ctx, 0, -s * 0.7, s * 0.26);
    ctx.beginPath();
    ctx.arc(0, -s * 0.65, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.75, s * 0.2);
    ctx.beginPath();
    ctx.arc(0, -s * 0.75, s * 0.26, Math.PI * 1.25, Math.PI * 1.75);
    ctx.lineTo(0, -s * 0.65);
    ctx.closePath();
    ctx.fill();
  }

  // Weapon drawing (unique per civ) — with smooth swing
  ctx.save();
  ctx.translate(s * 0.25, -s * 0.1);
  const cmdSwing = atk ? 0.5 + atkSwing(atk) * 0.6 : -0.75;
  ctx.rotate(cmdSwing);

  if (civ === 'china') {
    // Guan Dao (Glaive)
    ctx.strokeStyle = woodGrad(ctx, 0, s * 0.6, 0, -s * 0.4);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.6);
    ctx.lineTo(0, -s * 0.4);
    ctx.stroke();
    const bg = ctx.createLinearGradient(-s * 0.05, -s * 1.4, s * 0.1, -s * 0.4);
    bg.addColorStop(0, PAL.steelHighlight);
    bg.addColorStop(0.5, PAL.steel);
    bg.addColorStop(1, PAL.steelDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.8, s * 0.08, -s * 1.4);
    ctx.lineTo(-s * 0.08, -s * 1.4);
    ctx.lineTo(-s * 0.08, -s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.44, s * 0.1);
    ctx.fillRect(-s * 0.1, -s * 0.44, s * 0.2, s * 0.08);
  } else if (civ === 'viking') {
    // Dual-headed battle axe
    ctx.strokeStyle = woodGrad(ctx, 0, s * 0.35, 0, -s * 0.9);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.35);
    ctx.lineTo(0, -s * 0.9);
    ctx.stroke();
    const ag = ctx.createLinearGradient(-s * 0.3, -s * 0.65, s * 0.3, -s * 0.65);
    ag.addColorStop(0, PAL.steelDark);
    ag.addColorStop(0.3, PAL.steelHighlight);
    ag.addColorStop(0.7, PAL.steel);
    ag.addColorStop(1, PAL.steelDark);
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(-s * 0.04, -s * 0.65, s * 0.34, -Math.PI * 0.4, Math.PI * 0.4, true);
    ctx.lineTo(-s * 0.04, -s * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.04, -s * 0.65, s * 0.34, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.lineTo(s * 0.04, -s * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.72, s * 0.1);
    ctx.fillRect(-s * 0.08, -s * 0.72, s * 0.16, s * 0.14);
  } else if (civ === 'ottoman') {
    // Ottoman Scimitar — curved
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.1, s * 0.12);
    ctx.fillRect(-s * 0.12, -s * 0.14, s * 0.24, s * 0.08);
    ctx.strokeStyle = woodGrad(ctx, 0, s * 0.15, 0, -s * 0.1);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(0, s * 0.15);
    ctx.stroke();
    const bg = ctx.createLinearGradient(0, -s * 0.1, s * 0.32, -s * 1.15);
    bg.addColorStop(0, PAL.steelDark);
    bg.addColorStop(0.4, PAL.steelHighlight);
    bg.addColorStop(1, PAL.steel);
    ctx.strokeStyle = bg;
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.quadraticCurveTo(s * 0.28, -s * 0.6, s * 0.32, -s * 1.15);
    ctx.stroke();
  } else if (civ === 'rome') {
    // Roman Gladius — short, broad
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.1, s * 0.14);
    ctx.fillRect(-s * 0.14, -s * 0.14, s * 0.28, s * 0.08);
    ctx.strokeStyle = woodGrad(ctx, 0, s * 0.14, 0, -s * 0.1);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(0, s * 0.14);
    ctx.stroke();
    const bg = ctx.createLinearGradient(-s * 0.06, -s * 0.1, s * 0.06, -s * 0.88);
    bg.addColorStop(0, PAL.steelDark);
    bg.addColorStop(0.35, PAL.steelHighlight);
    bg.addColorStop(0.65, PAL.steel);
    bg.addColorStop(1, PAL.steelDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.11, -s * 0.1);
    ctx.lineTo(-s * 0.11, -s * 0.72);
    ctx.lineTo(0, -s * 0.88);
    ctx.lineTo(s * 0.11, -s * 0.72);
    ctx.lineTo(s * 0.11, -s * 0.1);
    ctx.closePath();
    ctx.fill();
  } else {
    // Broadsword fallback
    ctx.fillStyle = goldGrad(ctx, 0, -s * 0.1, s * 0.15);
    ctx.fillRect(-s * 0.15, -s * 0.14, s * 0.3, s * 0.08);
    ctx.strokeStyle = woodGrad(ctx, 0, s * 0.15, 0, -s * 0.1);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(0, s * 0.15);
    ctx.stroke();
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.arc(0, s * 0.18, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    const bg = ctx.createLinearGradient(-s * 0.05, -s * 0.1, s * 0.05, -s * 1.18);
    bg.addColorStop(0, PAL.steelDark);
    bg.addColorStop(0.3, PAL.steelHighlight);
    bg.addColorStop(0.7, PAL.steel);
    bg.addColorStop(1, PAL.steelDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.09, -s * 0.1);
    ctx.lineTo(-s * 0.07, -s * 1.05);
    ctx.lineTo(0, -s * 1.18);
    ctx.lineTo(s * 0.07, -s * 1.05);
    ctx.lineTo(s * 0.09, -s * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function figPirate(ctx: Ctx, s: number, walk: number, atk: number): void {
  const coat = '#2c3e50';
  const coatLight = '#3d566e';
  const pants = '#7f8c8d';
  const shirt = '#ecf0f1';
  const red = '#e74c3c';

  // Legs with 3D shading
  legs3D(ctx, s, pants, darken(pants, 25), walk);

  // Torso — coat with 3D gradient
  ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.05, s * 0.35, coatLight, coat);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coat lapels
  ctx.strokeStyle = darken(coat, 15);
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, -s * 0.35);
  ctx.lineTo(-s * 0.15, s * 0.3);
  ctx.moveTo(s * 0.05, -s * 0.35);
  ctx.lineTo(s * 0.15, s * 0.3);
  ctx.stroke();

  // Striped shirt details
  ctx.fillStyle = shirt;
  ctx.fillRect(-s * 0.12, -s * 0.2, s * 0.24, s * 0.07);
  ctx.fillStyle = red;
  ctx.fillRect(-s * 0.12, -s * 0.13, s * 0.24, s * 0.07);

  // Gold buttons
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.arc(-s * 0.04, -s * 0.3, s * 0.025, 0, Math.PI * 2);
  ctx.arc(-s * 0.04, -s * 0.22, s * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Head
  const sg = ctx.createRadialGradient(-s * 0.05, -s * 0.67, s * 0.04, 0, -s * 0.62, s * 0.24);
  sg.addColorStop(0, PAL.skinHighlight);
  sg.addColorStop(0.6, PAL.skin);
  sg.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Scruffy beard
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.ellipse(s * 0.04, -s * 0.5, s * 0.12, s * 0.08, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eyepatch
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.64, s * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.7);
  ctx.lineTo(s * 0.18, -s * 0.58);
  ctx.stroke();

  // Other eye
  ctx.fillStyle = '#2c1810';
  ctx.beginPath();
  ctx.arc(-s * 0.08, -s * 0.64, s * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // Red Bandana + Tricorn hat — 3D
  const bg = ctx.createRadialGradient(0, -s * 0.72, s * 0.05, 0, -s * 0.68, s * 0.28);
  bg.addColorStop(0, '#ff5555');
  bg.addColorStop(1, '#a82020');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, -s * 0.68, s * 0.26, Math.PI, Math.PI * 2);
  ctx.fill();

  // Hat brim — black with 3D
  const hg = ctx.createRadialGradient(0, -s * 0.82, s * 0.08, 0, -s * 0.8, s * 0.4);
  hg.addColorStop(0, '#333');
  hg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.8, s * 0.38, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hat crown
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.9, s * 0.16, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Skull emblem on hat
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(0, -s * 0.88, s * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Weapon: Cutlass with smooth swing
  ctx.save();
  ctx.translate(s * 0.26, -s * 0.18);
  const cutlassSwing = atk ? -0.7 - atkSwing(atk) * 0.6 : -0.25;
  ctx.rotate(cutlassSwing);

  // Blade — curved metallic
  const csg = ctx.createLinearGradient(0, s * 0.05, s * 0.12, -s * 0.78);
  csg.addColorStop(0, PAL.steelDark);
  csg.addColorStop(0.4, PAL.steelHighlight);
  csg.addColorStop(1, PAL.steel);
  ctx.strokeStyle = csg;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.05);
  ctx.quadraticCurveTo(s * 0.1, -s * 0.3, s * 0.12, -s * 0.78);
  ctx.stroke();
  // Gold guard
  ctx.fillStyle = goldGrad(ctx, 0, s * 0.02, s * 0.1);
  ctx.beginPath();
  ctx.arc(0, s * 0.02, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function figCavalry(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number, civ: CivId): void {
  const horse = '#7a5230';
  const horseDark = '#5a3c22';
  const horseLight = '#9a7a52';

  // Horse legs — 3D with smooth gait
  ctx.lineCap = 'round';
  const lp = smoothWalk(walk, 0);
  const lp2 = smoothWalk(walk, 0.5);
  const legXs: Array<[number, number]> = [
    [-s * 0.45, lp * s * 0.16],
    [-s * 0.2, lp2 * s * 0.16],
    [s * 0.25, -lp * s * 0.16],
    [s * 0.5, -lp2 * s * 0.16],
  ];
  for (const [lx, off] of legXs) {
    ctx.strokeStyle = horseDark;
    ctx.lineWidth = s * 0.14 + 1;
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.2);
    ctx.lineTo(lx + off, s * 0.92);
    ctx.stroke();
    ctx.strokeStyle = horse;
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.2);
    ctx.lineTo(lx + off, s * 0.92);
    ctx.stroke();
    // Hooves
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.ellipse(lx + off, s * 0.94, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Horse body — 3D gradient
  ctx.fillStyle = bodyGrad(ctx, 0, s * 0.05, s * 0.55, horseLight, horseDark);
  ctx.beginPath();
  ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Saddle
  ctx.fillStyle = PAL.leatherDark;
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.12, s * 0.2, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Saddle blanket — customized color by civilization
  let blanketCol = col;
  if (civ === 'rome') blanketCol = '#e63946'; // Roman red
  else if (civ === 'ottoman') blanketCol = '#2a9d8f'; // Ottoman green
  else if (civ === 'china') blanketCol = '#ffb703'; // Chinese gold/yellow
  else if (civ === 'viking') blanketCol = '#5c401f'; // Viking dark brown wood/leather
  else if (civ === 'celt') blanketCol = '#264653'; // Celtic dark blue/teal
  ctx.fillStyle = blanketCol;
  ctx.fillRect(-s * 0.25, -s * 0.08, s * 0.4, s * 0.16);

  // Horse neck + head — 3D
  const neckG = ctx.createLinearGradient(s * 0.45, -s * 0.05, s * 1.02, -s * 0.4);
  neckG.addColorStop(0, horseLight);
  neckG.addColorStop(0.5, horse);
  neckG.addColorStop(1, horseDark);
  ctx.fillStyle = neckG;
  ctx.beginPath();
  ctx.moveTo(s * 0.45, -s * 0.05);
  ctx.lineTo(s * 0.82, -s * 0.5);
  ctx.lineTo(s * 1.02, -s * 0.4);
  ctx.lineTo(s * 0.62, s * 0.05);
  ctx.closePath();
  ctx.fill();

  // Horse eye
  ctx.fillStyle = '#1a0c05';
  ctx.beginPath();
  ctx.arc(s * 0.88, -s * 0.42, s * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Mane
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = s * 0.04;
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const mx = s * 0.5 + t * s * 0.3;
    const my = -s * 0.1 - t * s * 0.35;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - s * 0.12, my + s * 0.08);
    ctx.stroke();
  }

  // Bridle
  ctx.strokeStyle = PAL.leather;
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(s * 0.92, -s * 0.5);
  ctx.lineTo(s * 0.98, -s * 0.38);
  ctx.stroke();

  // Rider body — 3D
  ctx.fillStyle = bodyGrad(ctx, -s * 0.05, -s * 0.35, s * 0.22, col, dark);
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.35, s * 0.2, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rider head
  const rsg = ctx.createRadialGradient(-s * 0.08, -s * 0.76, s * 0.03, -s * 0.05, -s * 0.72, s * 0.16);
  rsg.addColorStop(0, PAL.skinHighlight);
  rsg.addColorStop(0.7, PAL.skin);
  rsg.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = rsg;
  ctx.beginPath();
  ctx.arc(-s * 0.05, -s * 0.72, s * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Rider helmet base (not drawn for Celts/Ottomans who wear hair/turbans)
  if (civ !== 'celt' && civ !== 'ottoman') {
    ctx.fillStyle = metalGrad(ctx, -s * 0.05, -s * 0.78, s * 0.18);
    ctx.beginPath();
    ctx.arc(-s * 0.05, -s * 0.74, s * 0.17, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // Lance with 3D shading & custom flags
  ctx.save();
  ctx.translate(s * 0.1, -s * 0.35);
  const lanceAngle = atk ? 0.12 + atkSwing(atk) * 0.1 : -0.1;
  ctx.rotate(lanceAngle);
  ctx.strokeStyle = woodGrad(ctx, -s * 0.2, 0, s * 1.05, 0);
  ctx.lineWidth = s * 0.065;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, 0);
  ctx.lineTo(s * 1.05, 0);
  ctx.stroke();

  // Lance head — metallic
  const lg = ctx.createLinearGradient(s * 1.05, -s * 0.06, s * 1.22, 0);
  lg.addColorStop(0, PAL.steelDark);
  lg.addColorStop(0.5, PAL.steelHighlight);
  lg.addColorStop(1, PAL.steel);
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(s * 1.05, -s * 0.06);
  ctx.lineTo(s * 1.25, 0);
  ctx.lineTo(s * 1.05, s * 0.06);
  ctx.closePath();
  ctx.fill();

  // Lance pennant - customized color and design by civilization
  let pennantCol = col;
  if (civ === 'rome') pennantCol = '#e63946';
  else if (civ === 'ottoman') pennantCol = '#2a9d8f';
  else if (civ === 'china') pennantCol = '#ffb703';
  else if (civ === 'viking') pennantCol = '#457b9d';
  else if (civ === 'celt') pennantCol = '#e76f51';
  ctx.fillStyle = pennantCol;

  if (civ === 'rome') {
    // Roman vexillum style square banner
    ctx.fillRect(s * 0.72, -s * 0.14, s * 0.18, s * 0.18);
  } else {
    // Triangular pennant
    ctx.beginPath();
    ctx.moveTo(s * 0.9, -s * 0.06);
    ctx.lineTo(s * 0.72, -s * 0.14);
    ctx.lineTo(s * 0.72, s * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function figGolem(ctx: Ctx, s: number, atk: number): void {
  const rockDark = '#54565e';
  const rockLight = '#a0a4af';

  // Legs — boulder stumps with 3D gradient
  for (const ox of [-s * 0.3, s * 0.3]) {
    ctx.fillStyle = bodyGrad(ctx, ox, s * 0.7, s * 0.24, rockLight, rockDark);
    ctx.beginPath();
    ctx.ellipse(ox, s * 0.7, s * 0.22, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body — massive boulder with 3D radial gradient
  ctx.fillStyle = bodyGrad(ctx, -s * 0.1, -s * 0.2, s * 0.55, rockLight, rockDark);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.62, s * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();

  // Surface texture — cracks with depth
  ctx.strokeStyle = rockDark;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.5);
  ctx.lineTo(-s * 0.05, -s * 0.15);
  ctx.lineTo(-s * 0.3, s * 0.15);
  ctx.stroke();
  // Secondary crack
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, -s * 0.35);
  ctx.lineTo(s * 0.25, -s * 0.1);
  ctx.stroke();

  // Moss patches
  ctx.fillStyle = 'rgba(60, 120, 60, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, s * 0.2, s * 0.12, s * 0.08, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.15, s * 0.35, s * 0.1, s * 0.06, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Smash arm — smooth swing
  ctx.save();
  ctx.translate(s * 0.45, -s * 0.2);
  const smashAngle = atk ? 0.4 + atkSwing(atk) * 0.7 : 0.25;
  ctx.rotate(smashAngle);
  ctx.fillStyle = bodyGrad(ctx, s * 0.25, s * 0.1, s * 0.25, rockLight, rockDark);
  ctx.beginPath();
  ctx.ellipse(s * 0.25, s * 0.1, s * 0.3, s * 0.2, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Glowing eyes — pulsing
  const pulse = Math.sin(Date.now() * 0.004) * 0.15 + 1.0;
  ctx.shadowColor = '#ffb84a';
  ctx.shadowBlur = 8 * pulse;
  ctx.fillStyle = '#ffb84a';
  ctx.beginPath();
  ctx.arc(s * 0.12, -s * 0.3, s * 0.07 * pulse, 0, Math.PI * 2);
  ctx.arc(s * 0.34, -s * 0.3, s * 0.07 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function figWolf(ctx: Ctx, s: number, walk: number, atk: number): void {
  const fur = '#8a7866';
  const furDark = '#5e5246';
  const furLight = '#a8967e';

  // Legs — smooth gait
  const lp = smoothWalk(walk, 0);
  const lp2 = smoothWalk(walk, 0.5);
  const legXs: Array<[number, number]> = [
    [-s * 0.4, lp * s * 0.18],
    [-s * 0.18, lp2 * s * 0.18],
    [s * 0.18, -lp * s * 0.18],
    [s * 0.4, -lp2 * s * 0.18],
  ];
  for (const [lx, off] of legXs) {
    ctx.strokeStyle = furDark;
    ctx.lineWidth = s * 0.13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.3);
    ctx.lineTo(lx + off, s * 0.85);
    ctx.stroke();
    ctx.strokeStyle = fur;
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.3);
    ctx.lineTo(lx + off, s * 0.85);
    ctx.stroke();
    // Paw
    ctx.fillStyle = furDark;
    ctx.beginPath();
    ctx.ellipse(lx + off, s * 0.87, s * 0.06, s * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body — 3D gradient
  ctx.fillStyle = bodyGrad(ctx, -s * 0.05, s * 0.05, s * 0.48, furLight, furDark);
  ctx.beginPath();
  ctx.ellipse(0, s * 0.15, s * 0.52, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly — lighter strip
  ctx.fillStyle = furLight;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.25, s * 0.35, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Tail — bushy with gradient
  ctx.strokeStyle = fur;
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  const tailWave = Math.sin(Date.now() * 0.005) * s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.05);
  ctx.quadraticCurveTo(-s * 0.75 + tailWave, -s * 0.15, -s * 0.7, -s * 0.35);
  ctx.stroke();
  // Tail tip — lighter
  ctx.strokeStyle = furLight;
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, -s * 0.32);
  ctx.lineTo(-s * 0.68, -s * 0.38);
  ctx.stroke();

  // Head — lunges when attacking, with 3D
  const headLunge = atk ? atkSwing(atk) * s * 0.15 : 0;
  const hx = s * 0.58 + headLunge;
  ctx.fillStyle = bodyGrad(ctx, hx - s * 0.05, -s * 0.1, s * 0.2, furLight, furDark);
  ctx.beginPath();
  ctx.ellipse(hx, -s * 0.05, s * 0.24, s * 0.18, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = furDark;
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.15, -s * 0.1);
  ctx.lineTo(hx + s * 0.42, s * 0.02);
  ctx.lineTo(hx + s * 0.12, s * 0.1);
  ctx.closePath();
  ctx.fill();
  // Nose
  ctx.fillStyle = '#1a0c05';
  ctx.beginPath();
  ctx.arc(hx + s * 0.38, s * 0.01, s * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // Ear
  ctx.fillStyle = furDark;
  ctx.beginPath();
  ctx.moveTo(hx - s * 0.1, -s * 0.2);
  ctx.lineTo(hx - s * 0.02, -s * 0.42);
  ctx.lineTo(hx + s * 0.1, -s * 0.18);
  ctx.closePath();
  ctx.fill();
  // Inner ear
  ctx.fillStyle = '#c49a70';
  ctx.beginPath();
  ctx.moveTo(hx - s * 0.05, -s * 0.22);
  ctx.lineTo(hx, -s * 0.35);
  ctx.lineTo(hx + s * 0.06, -s * 0.2);
  ctx.closePath();
  ctx.fill();

  // Eye — glowing
  ctx.fillStyle = '#ffd24a';
  ctx.shadowColor = '#ffd24a';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(hx + s * 0.05, -s * 0.1, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Pupil
  ctx.fillStyle = '#1a0c05';
  ctx.beginPath();
  ctx.arc(hx + s * 0.06, -s * 0.1, s * 0.02, 0, Math.PI * 2);
  ctx.fill();

  // Teeth when attacking
  if (atk) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.2, s * 0.0);
    ctx.lineTo(hx + s * 0.24, s * 0.06);
    ctx.lineTo(hx + s * 0.28, s * 0.0);
    ctx.fill();
  }
}

function figCatapult(ctx: Ctx, s: number, col: string, atk: number): void {
  // Wheels — 3D with spokes
  for (const wx of [-s * 0.4, s * 0.4]) {
    // Tire
    ctx.fillStyle = bodyGrad(ctx, wx, s * 0.7, s * 0.28, PAL.woodHighlight, '#3a2810');
    ctx.beginPath();
    ctx.arc(wx, s * 0.7, s * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Hub
    ctx.fillStyle = bodyGrad(ctx, wx, s * 0.7, s * 0.13, PAL.woodHighlight, PAL.wood);
    ctx.beginPath();
    ctx.arc(wx, s * 0.7, s * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = PAL.woodDark;
    ctx.lineWidth = s * 0.03;
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx, s * 0.7);
      ctx.lineTo(wx + Math.cos(ang) * s * 0.25, s * 0.7 + Math.sin(ang) * s * 0.25);
      ctx.stroke();
    }

    // Iron rim
    ctx.strokeStyle = PAL.steelDark;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.arc(wx, s * 0.7, s * 0.27, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Frame — 3D wood
  ctx.strokeStyle = woodGrad(ctx, -s * 0.5, s * 0.7, s * 0.5, s * 0.7);
  ctx.lineWidth = s * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.7);
  ctx.lineTo(s * 0.5, s * 0.7);
  ctx.stroke();

  // A-frame supports
  ctx.strokeStyle = woodGrad(ctx, -s * 0.3, s * 0.7, 0, -s * 0.1);
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.7);
  ctx.lineTo(0, -s * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.7);
  ctx.lineTo(0, -s * 0.1);
  ctx.stroke();

  // Iron pivot bolt
  ctx.fillStyle = metalGrad(ctx, 0, -s * 0.1, s * 0.08);
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Throwing arm — smooth swing
  ctx.save();
  ctx.translate(0, -s * 0.1);
  const armAngle = atk ? -0.8 - atkSwing(atk) * 0.7 : -0.25;
  ctx.rotate(armAngle);
  ctx.strokeStyle = woodGrad(ctx, 0, 0, 0, -s * 0.7);
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.7);
  ctx.stroke();
  // Boulder/payload — 3D
  ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.72, s * 0.16, '#888888', '#444444');
  ctx.beginPath();
  ctx.arc(0, -s * 0.72, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Team flag — with wave
  const flagWave = Math.sin(Date.now() * 0.006) * s * 0.02;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-s * 0.52, s * 0.28);
  ctx.lineTo(-s * 0.52, s * 0.42);
  ctx.lineTo(-s * 0.34 + flagWave, s * 0.38);
  ctx.lineTo(-s * 0.34, s * 0.32);
  ctx.closePath();
  ctx.fill();
}

function figGladiator(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  legs3D(ctx, s, dark, darken(dark, 25), walk);

  // Large round shield — 3D bronze boss
  const shX = -s * 0.35;
  const shY = -s * 0.05;
  const shR = s * 0.22;
  ctx.fillStyle = bodyGrad(ctx, shX, shY, shR, '#d4a030', '#8b6914');
  ctx.beginPath();
  ctx.arc(shX, shY, shR, 0, Math.PI * 2);
  ctx.fill();
  // Shield rim
  ctx.strokeStyle = goldGrad(ctx, shX, shY, shR);
  ctx.lineWidth = s * 0.04;
  ctx.stroke();
  // Shield boss
  ctx.fillStyle = goldGrad(ctx, shX, shY, s * 0.08);
  ctx.beginPath();
  ctx.arc(shX, shY, s * 0.08, 0, Math.PI * 2);
  ctx.fill();

  torsoHead3D(ctx, s, col, dark, '#c0c0c0');

  // Gladius with smooth swing
  ctx.save();
  ctx.translate(s * 0.28, -s * 0.18);
  const gladSwing = atk ? -0.8 - atkSwing(atk) * 0.6 : -0.3;
  ctx.rotate(gladSwing);

  // Blade
  const bg = ctx.createLinearGradient(-s * 0.04, s * 0.05, s * 0.04, -s * 0.65);
  bg.addColorStop(0, PAL.steelDark);
  bg.addColorStop(0.35, PAL.steelHighlight);
  bg.addColorStop(0.7, PAL.steel);
  bg.addColorStop(1, PAL.steelDark);
  ctx.strokeStyle = bg;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.05);
  ctx.lineTo(0, -s * 0.65);
  ctx.stroke();
  // Crossguard
  ctx.fillStyle = goldGrad(ctx, 0, -s * 0.02, s * 0.15);
  ctx.fillRect(-s * 0.15, -s * 0.05, s * 0.3, s * 0.06);
  ctx.restore();
}

function figJanissary(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  legs3D(ctx, s, dark, darken(dark, 25), walk);
  torsoHead3D(ctx, s, col, dark, null);

  // Tall distinctive hat — 3D with crescent
  const hatG = ctx.createLinearGradient(-s * 0.1, -s * 1.0, s * 0.1, -s * 0.58);
  hatG.addColorStop(0, '#ffffff');
  hatG.addColorStop(0.5, '#f5f0e0');
  hatG.addColorStop(1, '#d5cfc0');
  ctx.fillStyle = hatG;
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.58);
  ctx.lineTo(-s * 0.18, -s * 1.0);
  ctx.quadraticCurveTo(0, -s * 1.15, s * 0.18, -s * 1.0);
  ctx.lineTo(s * 0.18, -s * 0.58);
  ctx.closePath();
  ctx.fill();
  // Hat trim
  ctx.strokeStyle = PAL.goldDark;
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.58);
  ctx.lineTo(s * 0.18, -s * 0.58);
  ctx.stroke();
  // Crescent emblem on hat
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.arc(0, -s * 0.82, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // Plume feather
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = s * 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.08);
  ctx.quadraticCurveTo(s * 0.15, -s * 1.25, s * 0.1, -s * 1.35);
  ctx.stroke();

  // Musket/rifle — smooth aim
  ctx.save();
  ctx.translate(s * 0.25, -s * 0.15);
  const aimAngle = atk ? -0.05 + atkSwing(atk) * 0.08 : -0.6;
  ctx.rotate(aimAngle);

  // Barrel — steel
  const barrelG = ctx.createLinearGradient(0, -s * 0.6, 0, -s * 0.95);
  barrelG.addColorStop(0, PAL.steelDark);
  barrelG.addColorStop(0.5, PAL.steelHighlight);
  barrelG.addColorStop(1, PAL.steel);
  ctx.strokeStyle = barrelG;
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.6);
  ctx.lineTo(0, -s * 0.95);
  ctx.stroke();

  // Stock — wood
  ctx.strokeStyle = woodGrad(ctx, 0, s * 0.2, 0, -s * 0.65);
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.2);
  ctx.lineTo(0, -s * 0.65);
  ctx.stroke();

  // Muzzle flash when attacking
  if (atk) {
    const flashPulse = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
    if (flashPulse > 0.4) {
      ctx.fillStyle = `rgba(255, 200, 50, ${flashPulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(0, -s * 1.0, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Iron band
  ctx.fillStyle = PAL.steelDark;
  ctx.fillRect(-s * 0.06, -s * 0.62, s * 0.12, s * 0.04);
  ctx.restore();
}

function figBerserker(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  void col;
  const furDark = '#5c2e0b';
  const furLight = '#a85a2a';

  legs3D(ctx, s, furDark, darken(furDark, 20), walk);

  // Fur vest body — 3D
  ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.05, s * 0.38, furLight, furDark);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fur texture — short strokes
  ctx.strokeStyle = furDark;
  ctx.lineWidth = s * 0.02;
  for (let i = -3; i <= 3; i++) {
    const fx = i * s * 0.07;
    ctx.beginPath();
    ctx.moveTo(fx, -s * 0.25);
    ctx.lineTo(fx + s * 0.02, -s * 0.32);
    ctx.stroke();
  }

  // War paint on torso
  ctx.strokeStyle = 'rgba(200, 50, 50, 0.4)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.2);
  ctx.lineTo(s * 0.18, -s * 0.2);
  ctx.moveTo(-s * 0.15, -s * 0.12);
  ctx.lineTo(s * 0.15, -s * 0.12);
  ctx.stroke();

  // Belt/waist
  ctx.fillStyle = darken(dark, 15);
  ctx.fillRect(-s * 0.28, s * 0.05, s * 0.56, s * 0.08);

  // Head
  const headG = ctx.createRadialGradient(-s * 0.06, -s * 0.66, s * 0.04, 0, -s * 0.62, s * 0.24);
  headG.addColorStop(0, PAL.skinHighlight);
  headG.addColorStop(0.6, PAL.skin);
  headG.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Wild hair
  ctx.fillStyle = '#cc7733';
  ctx.beginPath();
  ctx.arc(0, -s * 0.65, s * 0.26, Math.PI * 0.8, Math.PI * 2.2);
  ctx.fill();

  // War paint on face
  ctx.strokeStyle = 'rgba(50, 100, 200, 0.5)';
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.62);
  ctx.lineTo(s * 0.15, -s * 0.62);
  ctx.stroke();

  // Fierce eyes
  ctx.fillStyle = '#1a0c05';
  ctx.beginPath();
  ctx.arc(s * 0.06, -s * 0.64, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cc0000';
  ctx.beginPath();
  ctx.arc(s * 0.065, -s * 0.645, s * 0.02, 0, Math.PI * 2);
  ctx.fill();

  // Iron helm
  ctx.fillStyle = metalGrad(ctx, 0, -s * 0.72, s * 0.2);
  ctx.beginPath();
  ctx.arc(0, -s * 0.66, s * 0.22, Math.PI * 1.1, Math.PI * 1.9);
  ctx.fill();

  // Dual axes — smooth chop animation
  const axeSwingR = atk ? -0.8 - atkSwing(atk) * 0.6 : -0.4;
  const axeSwingL = atk ? -0.3 + atkSwing(atk) * 0.4 : -0.9;

  ctx.save();
  ctx.translate(s * 0.28, -s * 0.15);
  ctx.rotate(axeSwingR);
  drawAxe3D(ctx, s);
  ctx.restore();
  ctx.save();
  ctx.translate(-s * 0.28, -s * 0.15);
  ctx.rotate(axeSwingL);
  drawAxe3D(ctx, s);
  ctx.restore();
}

function drawAxe3D(ctx: Ctx, s: number): void {
  // Handle — wood gradient
  ctx.strokeStyle = woodGrad(ctx, 0, s * 0.25, 0, -s * 0.55);
  ctx.lineWidth = s * 0.065;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.25);
  ctx.lineTo(0, -s * 0.55);
  ctx.stroke();

  // Axe head — metallic 3D
  const ag = ctx.createLinearGradient(0, -s * 0.55, s * 0.22, -s * 0.4);
  ag.addColorStop(0, PAL.steelDark);
  ag.addColorStop(0.4, PAL.steelHighlight);
  ag.addColorStop(1, PAL.steel);
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.24, -s * 0.55, s * 0.24, -s * 0.28, 0, -s * 0.4);
  ctx.closePath();
  ctx.fill();

  // Edge highlight
  ctx.strokeStyle = PAL.steelHighlight;
  ctx.lineWidth = s * 0.015;
  ctx.beginPath();
  ctx.arc(s * 0.12, -s * 0.42, s * 0.12, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.stroke();
}

function figDruid(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  void col;
  void dark;
  const robeColor = '#2d5a27';
  const robeDark = '#1a3a15';
  const robeLight = '#3d7a35';

  // Legs — robe bottom, smooth sway
  const sw = smoothWalk(walk, 0);
  const sw2 = smoothWalk(walk, 1);
  ctx.strokeStyle = robeDark;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, s * 0.2);
  ctx.lineTo(-s * 0.13 + sw * s * 0.15, s * 0.9);
  ctx.moveTo(s * 0.13, s * 0.2);
  ctx.lineTo(s * 0.13 + sw2 * s * 0.15, s * 0.9);
  ctx.stroke();

  // Robe body — 3D gradient
  ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.05, s * 0.38, robeLight, robeDark);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.32, s * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  // Robe details — runic patterns
  ctx.strokeStyle = 'rgba(0, 220, 160, 0.25)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.15);
  ctx.lineTo(-s * 0.08, -s * 0.25);
  ctx.lineTo(0, -s * 0.15);
  ctx.lineTo(s * 0.08, -s * 0.25);
  ctx.lineTo(s * 0.15, -s * 0.15);
  ctx.stroke();

  // Belt — rope
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(-s * 0.22, s * 0.1);
  ctx.lineTo(s * 0.22, s * 0.1);
  ctx.stroke();

  // Head
  const headG = ctx.createRadialGradient(-s * 0.05, -s * 0.62, s * 0.04, 0, -s * 0.58, s * 0.22);
  headG.addColorStop(0, PAL.skinHighlight);
  headG.addColorStop(0.6, PAL.skin);
  headG.addColorStop(1, PAL.skinShadow);
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(0, -s * 0.58, s * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Deep hood — 3D
  const hoodG = ctx.createRadialGradient(-s * 0.05, -s * 0.65, s * 0.05, 0, -s * 0.6, s * 0.28);
  hoodG.addColorStop(0, robeLight);
  hoodG.addColorStop(0.7, robeColor);
  hoodG.addColorStop(1, robeDark);
  ctx.fillStyle = hoodG;
  ctx.beginPath();
  ctx.arc(0, -s * 0.6, s * 0.26, Math.PI, Math.PI * 2);
  ctx.lineTo(s * 0.22, -s * 0.45);
  ctx.lineTo(-s * 0.22, -s * 0.45);
  ctx.closePath();
  ctx.fill();

  // Mysterious eyes — green glow
  ctx.fillStyle = '#00cc88';
  ctx.shadowColor = '#00ffaa';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(s * 0.04, -s * 0.6, s * 0.03, 0, Math.PI * 2);
  ctx.arc(-s * 0.06, -s * 0.6, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Staff with crystal orb — smooth casting animation
  ctx.save();
  ctx.translate(s * 0.25, -s * 0.15);
  const castAngle = atk ? -0.15 + atkSwing(atk) * 0.12 : -0.6;
  ctx.rotate(castAngle);

  // Staff — gnarled wood
  ctx.strokeStyle = woodGrad(ctx, 0, s * 0.5, 0, -s * 0.95);
  ctx.lineWidth = s * 0.065;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.lineTo(0, -s * 0.95);
  ctx.stroke();

  // Twisting vine detail
  ctx.strokeStyle = 'rgba(60, 140, 60, 0.4)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const ty = s * 0.3 - i * s * 0.25;
    ctx.moveTo(-s * 0.04, ty);
    ctx.quadraticCurveTo(s * 0.06, ty - s * 0.1, -s * 0.04, ty - s * 0.2);
  }
  ctx.stroke();

  // Crystal orb — pulsing glow
  const crystalTime = Date.now() * 0.005;
  const pulse = Math.sin(crystalTime) * 0.15 + 1.0;
  const cg = ctx.createRadialGradient(0, -s * 1.05, s * 0.02, 0, -s * 1.05, s * 0.12 * pulse);
  cg.addColorStop(0, '#aaffee');
  cg.addColorStop(0.4, '#00ffcc');
  cg.addColorStop(1, 'rgba(0, 200, 160, 0.3)');
  ctx.fillStyle = cg;
  ctx.shadowColor = '#00ffcc';
  ctx.shadowBlur = 12 * pulse;
  ctx.beginPath();
  ctx.arc(0, -s * 1.05, s * 0.12 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Inner sparkle
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6 + Math.sin(crystalTime * 2) * 0.3;
  ctx.beginPath();
  ctx.arc(s * 0.02, -s * 1.08, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 0;
  ctx.restore();
}
