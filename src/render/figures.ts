// Mini military figures, ported from the v1 renderer work (legacy/src/Renderer.js).
// All figures are drawn facing right around origin (0,0); callers translate,
// then mirror with scale(-1,1) for left-facing. `s` is the base half-size in px.

import type { Team, UnitKind } from '../data/units';
import { CIVS, type CivId } from '../data/civs';
import { CIV_PAL } from './civArt';

const PAL = {
  skin: '#e8b88a',
  steel: '#dfe6f0',
  steelDark: '#9aa7bd',
  wood: '#9b6a3a',
  woodDark: '#6e4a26',
  gold: '#ffd700',
};

type Ctx = CanvasRenderingContext2D;

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
  switch (kind) {
    case 'cavalry': figCavalry(ctx, s, col, dark, walk, atk); break;
    case 'catapult': figCatapult(ctx, s, col, atk); break;
    case 'archer': figArcher(ctx, s, col, dark, walk, atk); break;
    case 'mage': figMage(ctx, s, col, dark, atk); break;
    case 'spear': figSpear(ctx, s, col, dark, walk, atk); break;
    case 'golem': figGolem(ctx, s, atk); break;
    case 'wolf': figWolf(ctx, s, walk, atk); break;
    default: figKnight(ctx, s, col, dark, walk, atk); break;
  }
  if (civ) civAccent(ctx, kind, s, civ, team);
}

// --------------------------------------------------------------------
// Civilization accents: a distinctive headdress/crest + shield mark
// layered over the base figure, so each civ's army reads differently.
// --------------------------------------------------------------------

function civAccent(ctx: Ctx, kind: UnitKind, s: number, civ: CivId, team: Team): void {
  const accent = CIVS[civ].accent;
  const teamCol = team === 0 ? '#7ab8ff' : team === 1 ? '#ff8a8a' : '#c3a6e6';

  // Head positions differ per figure.
  let hx = 0;
  let hy = -s * 0.62;
  let hr = s * 0.26;
  if (kind === 'cavalry') {
    hx = -s * 0.05;
    hy = -s * 0.74;
    hr = s * 0.18;
  }
  if (kind === 'golem' || kind === 'wolf' || kind === 'catapult' || kind === 'mage') {
    // Mage keeps the arcane hat; war machines get a pennant instead.
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
      // Red crest over the helmet.
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.45, hr * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      ctx.fill();
      break;
    }
    case 'ottoman': {
      // White turban wrap with a small crest dot.
      ctx.fillStyle = '#f1ece0';
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.35, hr * 1.05, hr * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.85, hr * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'china': {
      // Red tassel plume curving back.
      ctx.strokeStyle = '#e04a3a';
      ctx.lineWidth = s * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy - hr * 0.9);
      ctx.quadraticCurveTo(hx - hr * 0.7, hy - hr * 1.7, hx - hr * 1.2, hy - hr * 1.1);
      ctx.stroke();
      ctx.fillStyle = PAL.gold;
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.9, hr * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'viking': {
      // Iron helm ridge + nose guard.
      ctx.strokeStyle = '#737f92';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(hx, hy - hr * 1.05);
      ctx.lineTo(hx, hy + hr * 0.25);
      ctx.stroke();
      break;
    }
    case 'celt': {
      // Wild red hair spikes over the helmet line + woad face stripe.
      ctx.fillStyle = '#b4502e';
      ctx.beginPath();
      ctx.arc(hx, hy - hr * 0.3, hr * 0.95, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.55)';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.5, hy + hr * 0.05);
      ctx.lineTo(hx + hr * 0.5, hy + hr * 0.05);
      ctx.stroke();
      break;
    }
  }

  // Shield mark for shield-bearing infantry: civ emblem on a team-colour rim.
  if (kind === 'knight' || kind === 'spear') {
    const shx = kind === 'knight' ? -s * 0.34 : -s * 0.32;
    const shy = -s * 0.05;
    ctx.strokeStyle = teamCol;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(shx, shy, s * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(shx, shy, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

function legs(ctx: Ctx, s: number, color: string, walk: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, s * 0.32);
  ctx.lineTo(-s * 0.13 + walk * s * 0.22, s * 0.92);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.13, s * 0.32);
  ctx.lineTo(s * 0.13 - walk * s * 0.22, s * 0.92);
  ctx.stroke();
}

function torsoHead(ctx: Ctx, s: number, col: string, dark: string, helmet: string | null): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(-s * 0.3, s * 0.05, s * 0.6, s * 0.1);
  ctx.fillStyle = PAL.skin;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.24, 0, Math.PI * 2);
  ctx.fill();
  if (helmet) {
    ctx.fillStyle = helmet;
    ctx.beginPath();
    ctx.arc(0, -s * 0.64, s * 0.26, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-s * 0.26, -s * 0.66, s * 0.52, s * 0.1);
  }
}

function figKnight(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  legs(ctx, s, dark, walk);
  // back shield
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(-s * 0.34, -s * 0.05, s * 0.16, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = s * 0.05;
  ctx.stroke();
  torsoHead(ctx, s, col, dark, dark);
  // sword arm
  ctx.save();
  ctx.translate(s * 0.26, -s * 0.18);
  ctx.rotate(atk ? -1.15 : -0.25);
  ctx.strokeStyle = PAL.steel;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.05);
  ctx.lineTo(0, -s * 0.78);
  ctx.stroke();
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(-s * 0.13, -s * 0.02, s * 0.26, s * 0.07);
  ctx.restore();
}

function figSpear(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  legs(ctx, s, dark, walk);
  torsoHead(ctx, s, col, dark, dark);
  // long spear held forward
  ctx.save();
  ctx.translate(s * 0.24, -s * 0.15);
  ctx.rotate(atk ? 0.1 : -0.55);
  ctx.strokeStyle = PAL.wood;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.lineTo(0, -s * 1.05);
  ctx.stroke();
  ctx.fillStyle = PAL.steel;
  ctx.beginPath();
  ctx.moveTo(-s * 0.07, -s * 1.0);
  ctx.lineTo(0, -s * 1.25);
  ctx.lineTo(s * 0.07, -s * 1.0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // small buckler
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(-s * 0.32, -s * 0.05, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function figArcher(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  legs(ctx, s, dark, walk);
  torsoHead(ctx, s, col, dark, null);
  // hood
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.27, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();
  // bow + string
  const bx = s * 0.3;
  const by = -s * 0.1;
  const br = s * 0.42;
  ctx.strokeStyle = PAL.wood;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(bx, by, br, -Math.PI * 0.55, Math.PI * 0.55);
  ctx.stroke();
  const topx = bx + Math.cos(-Math.PI * 0.55) * br;
  const topy = by + Math.sin(-Math.PI * 0.55) * br;
  const botx = bx + Math.cos(Math.PI * 0.55) * br;
  const boty = by + Math.sin(Math.PI * 0.55) * br;
  const nockx = atk ? s * 0.02 : bx;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(topx, topy);
  ctx.lineTo(nockx, by);
  ctx.lineTo(botx, boty);
  ctx.stroke();
  if (atk) {
    ctx.strokeStyle = PAL.steelDark;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.moveTo(nockx, by);
    ctx.lineTo(bx + br, by);
    ctx.stroke();
  }
}

function figMage(ctx: Ctx, s: number, col: string, dark: string, atk: number): void {
  // robe
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.35);
  ctx.lineTo(-s * 0.4, s * 0.92);
  ctx.lineTo(s * 0.4, s * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(-s * 0.4, s * 0.8, s * 0.8, s * 0.12);
  // head + pointed hat
  ctx.fillStyle = PAL.skin;
  ctx.beginPath();
  ctx.arc(0, -s * 0.5, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.52);
  ctx.lineTo(s * 0.3, -s * 0.52);
  ctx.lineTo(s * 0.06, -s * 1.15);
  ctx.closePath();
  ctx.fill();
  // staff + glowing orb
  ctx.strokeStyle = PAL.wood;
  ctx.lineWidth = s * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.32, s * 0.6);
  ctx.lineTo(s * 0.32, -s * 0.7);
  ctx.stroke();
  const gr = s * (atk ? 0.42 : 0.28);
  const grad = ctx.createRadialGradient(s * 0.32, -s * 0.8, 0, s * 0.32, -s * 0.8, gr);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, '#8fb6ff');
  grad.addColorStop(1, 'rgba(120,160,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s * 0.32, -s * 0.8, gr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eaf2ff';
  ctx.beginPath();
  ctx.arc(s * 0.32, -s * 0.8, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function figCavalry(ctx: Ctx, s: number, col: string, dark: string, walk: number, atk: number): void {
  const horse = '#7a5230';
  const horseDark = '#5a3c22';
  // horse legs
  ctx.strokeStyle = horseDark;
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  const lp = walk * s * 0.18;
  const legXs: Array<[number, number]> = [
    [-s * 0.45, lp],
    [-s * 0.2, -lp],
    [s * 0.25, lp],
    [s * 0.5, -lp],
  ];
  for (const [lx, off] of legXs) {
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.2);
    ctx.lineTo(lx + off, s * 0.92);
    ctx.stroke();
  }
  // horse body + neck + head
  ctx.fillStyle = horse;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.45, -s * 0.05);
  ctx.lineTo(s * 0.82, -s * 0.5);
  ctx.lineTo(s * 1.02, -s * 0.4);
  ctx.lineTo(s * 0.62, s * 0.05);
  ctx.closePath();
  ctx.fill();
  // rider
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.35, s * 0.2, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.skin;
  ctx.beginPath();
  ctx.arc(-s * 0.05, -s * 0.72, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(-s * 0.05, -s * 0.74, s * 0.17, Math.PI, Math.PI * 2);
  ctx.fill();
  // lance
  ctx.save();
  ctx.translate(s * 0.1, -s * 0.35);
  ctx.rotate(atk ? 0.18 : -0.1);
  ctx.strokeStyle = PAL.wood;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, 0);
  ctx.lineTo(s * 1.05, 0);
  ctx.stroke();
  ctx.fillStyle = PAL.steel;
  ctx.beginPath();
  ctx.moveTo(s * 1.05, -s * 0.06);
  ctx.lineTo(s * 1.22, 0);
  ctx.lineTo(s * 1.05, s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function figGolem(ctx: Ctx, s: number, atk: number): void {
  const rock = '#7d8089';
  const rockDark = '#54565e';
  // legs (stubby boulders)
  ctx.fillStyle = rockDark;
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, s * 0.7, s * 0.22, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.3, s * 0.7, s * 0.22, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  // body (big boulder)
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.62, s * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  // cracks
  ctx.strokeStyle = rockDark;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.5);
  ctx.lineTo(-s * 0.05, -s * 0.15);
  ctx.lineTo(-s * 0.3, s * 0.15);
  ctx.stroke();
  // smash arm
  ctx.save();
  ctx.translate(s * 0.45, -s * 0.2);
  ctx.rotate(atk ? 0.9 : 0.25);
  ctx.fillStyle = rockDark;
  ctx.beginPath();
  ctx.ellipse(s * 0.25, s * 0.1, s * 0.3, s * 0.2, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // glowing eyes
  ctx.fillStyle = '#ffb84a';
  ctx.beginPath();
  ctx.arc(s * 0.12, -s * 0.3, s * 0.07, 0, Math.PI * 2);
  ctx.arc(s * 0.34, -s * 0.3, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function figWolf(ctx: Ctx, s: number, walk: number, atk: number): void {
  const fur = '#8a7866';
  const furDark = '#5e5246';
  // legs
  ctx.strokeStyle = furDark;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  const lp = walk * s * 0.2;
  const legXs: Array<[number, number]> = [
    [-s * 0.4, lp],
    [-s * 0.18, -lp],
    [s * 0.18, lp],
    [s * 0.4, -lp],
  ];
  for (const [lx, off] of legXs) {
    ctx.beginPath();
    ctx.moveTo(lx, s * 0.3);
    ctx.lineTo(lx + off, s * 0.85);
    ctx.stroke();
  }
  // body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.15, s * 0.52, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.strokeStyle = fur;
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.05);
  ctx.quadraticCurveTo(-s * 0.75, -s * 0.15, -s * 0.7, -s * 0.35);
  ctx.stroke();
  // head (lunges when attacking)
  const hx = s * (atk ? 0.72 : 0.58);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(hx, -s * 0.05, s * 0.24, s * 0.18, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // snout + ear
  ctx.fillStyle = furDark;
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.15, -s * 0.1);
  ctx.lineTo(hx + s * 0.42, s * 0.02);
  ctx.lineTo(hx + s * 0.12, s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx - s * 0.1, -s * 0.2);
  ctx.lineTo(hx - s * 0.02, -s * 0.42);
  ctx.lineTo(hx + s * 0.1, -s * 0.18);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.arc(hx + s * 0.05, -s * 0.1, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function figCatapult(ctx: Ctx, s: number, col: string, atk: number): void {
  // wheels
  for (const wx of [-s * 0.4, s * 0.4]) {
    ctx.fillStyle = PAL.woodDark;
    ctx.beginPath();
    ctx.arc(wx, s * 0.7, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.wood;
    ctx.beginPath();
    ctx.arc(wx, s * 0.7, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  // frame
  ctx.strokeStyle = PAL.wood;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.7);
  ctx.lineTo(s * 0.5, s * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.7);
  ctx.lineTo(0, -s * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.7);
  ctx.lineTo(0, -s * 0.1);
  ctx.stroke();
  // throwing arm
  ctx.save();
  ctx.translate(0, -s * 0.1);
  ctx.rotate(atk ? -1.4 : -0.25);
  ctx.strokeStyle = PAL.woodDark;
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.7);
  ctx.stroke();
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(0, -s * 0.72, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // team flag
  ctx.fillStyle = col;
  ctx.fillRect(-s * 0.52, s * 0.28, s * 0.18, s * 0.14);
}
