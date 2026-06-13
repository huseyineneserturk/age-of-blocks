// Composite building art: civ-specific walls + roof + type silhouette, with a
// team-coloured pennant + outline for ownership. Replaces the old
// "tinted box + one roof" look. Drawn in screen space; the renderer supplies
// the footprint pixel rect and overlays HP/queue/rally on top.

import { TEAM_COLORS, type Team } from '../data/units';
import type { BuildingKind } from '../data/buildings';
import { CIV_PAL, type CivPalette } from './civArt';
import type { CivId } from '../data/civs';

interface Opts {
  selected: boolean;
  constructing: boolean;
  progress: number; // 0..1 while constructing
}

const GOLD = '#e8c54a';

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  kind: BuildingKind,
  civ: CivId,
  team: Team,
  sx: number,
  sy: number,
  w: number,
  h: number,
  scale: number,
  opts: Opts,
): void {
  const pal = CIV_PAL[civ];
  ctx.save();
  ctx.translate(sx, sy);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.96, w * 0.5, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (opts.constructing) {
    drawScaffold(ctx, w, h, pal, opts.progress);
    drawPennant(ctx, w, team, scale);
    ctx.restore();
    return;
  }

  // Body per type (draws its own walls + roof).
  switch (kind) {
    case 'castle': drawCastle(ctx, w, h, pal, scale); break;
    case 'house': drawHouse(ctx, w, h, pal, scale); break;
    case 'mine': drawMine(ctx, w, h, pal, scale); break;
    case 'barracks': drawBarracks(ctx, w, h, pal, scale); break;
    case 'archery': drawArchery(ctx, w, h, pal, scale); break;
    case 'stable': drawStable(ctx, w, h, pal, scale); break;
    case 'magetower': drawMageTower(ctx, w, h, pal, scale); break;
    case 'siegeworks': drawSiege(ctx, w, h, pal, scale); break;
    case 'research': drawResearch(ctx, w, h, pal, scale); break;
    case 'tower': drawTower(ctx, w, h, pal, scale); break;
    case 'wall': drawWall(ctx, w, h, pal); break;
  }

  // Ownership: team pennant + thin team/selection outline.
  drawPennant(ctx, w, team, scale);
  ctx.strokeStyle = opts.selected ? GOLD : TEAM_COLORS[team].main;
  ctx.lineWidth = opts.selected ? 2.5 : 1.4;
  ctx.globalAlpha = opts.selected ? 1 : 0.6;
  ctx.strokeRect(1, h * 0.32, w - 2, h * 0.66);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Wall fills + textures
// ---------------------------------------------------------------------------

/** Fill the lower body (the actual ground floor) with civ wall material. */
function walls(ctx: CanvasRenderingContext2D, w: number, top: number, h: number, pal: CivPalette): void {
  const bottom = h * 0.98;
  const height = bottom - top;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, pal.wall);
  grad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = grad;
  ctx.fillRect(w * 0.06, top, w * 0.88, height);

  // texture
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  if (pal.wallStyle === 'stone' || pal.wallStyle === 'plaster') {
    const rows = Math.max(2, Math.round(height / 9));
    for (let r = 1; r < rows; r++) {
      const yy = top + (height / rows) * r;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, yy);
      ctx.lineTo(w * 0.94, yy);
      ctx.stroke();
      if (pal.wallStyle === 'stone') {
        const off = r % 2 ? w * 0.3 : w * 0.5;
        ctx.beginPath();
        ctx.moveTo(off, yy);
        ctx.lineTo(off, yy - height / rows);
        ctx.stroke();
      }
    }
  } else {
    // timber planks (vertical)
    const cols = Math.max(2, Math.round(w / 9));
    for (let c = 1; c < cols; c++) {
      const xx = w * 0.06 + (w * 0.88 / cols) * c;
      ctx.beginPath();
      ctx.moveTo(xx, top);
      ctx.lineTo(xx, bottom);
      ctx.stroke();
    }
  }
  // foundation band
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(w * 0.06, bottom - height * 0.12, w * 0.88, height * 0.12);
}

/** Civ roof cap sitting on top of a body whose wall-top is at `top`. */
function roof(ctx: CanvasRenderingContext2D, w: number, top: number, pal: CivPalette, scale: number, slim = 1): void {
  const cx = w / 2;
  const rw = w * 0.92 * slim;
  switch (pal.roofStyle) {
    case 'dome': {
      const r = rw / 2;
      const g = ctx.createLinearGradient(cx - r, top - r, cx + r, top);
      g.addColorStop(0, '#e6e9ef');
      g.addColorStop(1, '#aab2c0');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, top, r, Math.PI, Math.PI * 2);
      ctx.fill();
      // crescent finial
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = Math.max(1.5, scale * 0.05);
      ctx.beginPath();
      ctx.arc(cx, top - r - scale * 0.16, scale * 0.12, Math.PI * 0.4, Math.PI * 1.6);
      ctx.stroke();
      break;
    }
    case 'pagoda': {
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2 - scale * 0.12, top + scale * 0.06);
      ctx.quadraticCurveTo(cx, top - scale * 0.42, cx + rw / 2 + scale * 0.12, top + scale * 0.06);
      ctx.quadraticCurveTo(cx, top - scale * 0.06, cx - rw / 2 - scale * 0.12, top + scale * 0.06);
      ctx.fill();
      ctx.fillStyle = pal.roofDark;
      ctx.fillRect(cx - rw / 2 - scale * 0.12, top + scale * 0.04, rw + scale * 0.24, scale * 0.05);
      ctx.fillStyle = pal.trim;
      ctx.beginPath();
      ctx.arc(cx, top - scale * 0.34, scale * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pediment': {
      ctx.fillStyle = '#e7e2d4';
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2, top + scale * 0.04);
      ctx.lineTo(cx, top - scale * 0.34);
      ctx.lineTo(cx + rw / 2, top + scale * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.roofDark;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = pal.roof;
      ctx.fillRect(cx - rw / 2, top, rw, scale * 0.06);
      break;
    }
    case 'gable': {
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2 - scale * 0.08, top + scale * 0.05);
      ctx.lineTo(cx, top - scale * 0.44);
      ctx.lineTo(cx + rw / 2 + scale * 0.08, top + scale * 0.05);
      ctx.closePath();
      ctx.fill();
      // crossed beams
      ctx.strokeStyle = pal.roofDark;
      ctx.lineWidth = Math.max(1, scale * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx - scale * 0.16, top - scale * 0.48);
      ctx.lineTo(cx + scale * 0.12, top - scale * 0.2);
      ctx.moveTo(cx + scale * 0.16, top - scale * 0.48);
      ctx.lineTo(cx - scale * 0.12, top - scale * 0.2);
      ctx.stroke();
      break;
    }
    case 'thatch': {
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2 - scale * 0.1, top + scale * 0.06);
      ctx.quadraticCurveTo(cx, top - scale * 0.4, cx + rw / 2 + scale * 0.1, top + scale * 0.06);
      ctx.lineTo(cx + rw / 2, top + scale * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.roofDark;
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, top + scale * 0.06, (rw / 2) * (i / 4), Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
  }
}

function door(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = 'rgba(20,12,6,0.8)';
  ctx.fillRect(w * 0.42, h * 0.62, w * 0.16, h * 0.36);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(w * 0.42, h * 0.62, w * 0.16, h * 0.36);
}

// ---------------------------------------------------------------------------
// Per-type bodies
// ---------------------------------------------------------------------------

function drawHouse(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  walls(ctx, w, h * 0.45, h, pal);
  roof(ctx, w, h * 0.45, pal, scale);
  door(ctx, w, h);
  // window
  ctx.fillStyle = 'rgba(255,220,150,0.7)';
  ctx.fillRect(w * 0.16, h * 0.56, w * 0.12, h * 0.12);
  // chimney smoke
  ctx.fillStyle = 'rgba(220,220,220,0.25)';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.28, scale * 0.1, 0, Math.PI * 2);
  ctx.arc(w * 0.78, h * 0.16, scale * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawMine(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // rocky mound
  ctx.fillStyle = '#5c5e66';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.7, w * 0.46, h * 0.4, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#43454c';
  ctx.fillRect(w * 0.08, h * 0.66, w * 0.84, h * 0.32);
  // timber-framed entrance
  ctx.fillStyle = '#1a120a';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.72, w * 0.2, Math.PI, Math.PI * 2);
  ctx.fillRect(w * 0.3, h * 0.72, w * 0.4, h * 0.26);
  ctx.fill();
  ctx.strokeStyle = pal.leather;
  ctx.lineWidth = Math.max(2, scale * 0.08);
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.98); ctx.lineTo(w * 0.3, h * 0.56); ctx.lineTo(w * 0.7, h * 0.56); ctx.lineTo(w * 0.7, h * 0.98);
  ctx.stroke();
  // ore glints
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 3; i++) ctx.fillRect(w * (0.2 + i * 0.25), h * (0.5 + (i % 2) * 0.08), 3, 3);
}

function drawBarracks(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  walls(ctx, w, h * 0.4, h, pal);
  roof(ctx, w, h * 0.4, pal, scale);
  door(ctx, w, h);
  // crossed swords emblem over the door
  ctx.strokeStyle = pal.metal;
  ctx.lineWidth = Math.max(1.5, scale * 0.05);
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.46); ctx.lineTo(w * 0.6, h * 0.6);
  ctx.moveTo(w * 0.6, h * 0.46); ctx.lineTo(w * 0.4, h * 0.6);
  ctx.stroke();
}

function drawArchery(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  walls(ctx, w, h * 0.46, h, pal);
  // open front (timber posts + lintel) instead of full roof
  ctx.strokeStyle = pal.leather;
  ctx.lineWidth = Math.max(2, scale * 0.09);
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.98); ctx.lineTo(w * 0.12, h * 0.4); ctx.lineTo(w * 0.88, h * 0.4); ctx.lineTo(w * 0.88, h * 0.98);
  ctx.stroke();
  roof(ctx, w, h * 0.4, pal, scale, 1.05);
  // target
  const tx = w * 0.5;
  const ty = h * 0.72;
  const tr = w * 0.16;
  ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(tx, ty, tr * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.arc(tx, ty, tr * 0.25, 0, Math.PI * 2); ctx.fill();
}

function drawStable(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  walls(ctx, w, h * 0.42, h, pal);
  roof(ctx, w, h * 0.42, pal, scale);
  // two arched stalls
  ctx.fillStyle = 'rgba(20,12,6,0.78)';
  for (const ax of [0.26, 0.6]) {
    ctx.beginPath();
    ctx.arc(w * (ax + 0.07), h * 0.66, w * 0.13, Math.PI, Math.PI * 2);
    ctx.fillRect(w * ax, h * 0.66, w * 0.14, h * 0.32);
    ctx.fill();
  }
  // hay
  ctx.fillStyle = '#d8b24a';
  ctx.fillRect(w * 0.08, h * 0.86, w * 0.12, h * 0.1);
}

function drawMageTower(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // slim tall tower
  const tw = w * 0.5;
  const tx = w * 0.5 - tw / 2;
  const grad = ctx.createLinearGradient(0, h * 0.2, 0, h);
  grad.addColorStop(0, pal.wall);
  grad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = grad;
  ctx.fillRect(tx, h * 0.2, tw, h * 0.78);
  // conical cap
  ctx.fillStyle = pal.roof;
  ctx.beginPath();
  ctx.moveTo(tx - w * 0.06, h * 0.22);
  ctx.lineTo(w * 0.5, h * 0.2 - scale * 0.5);
  ctx.lineTo(tx + tw + w * 0.06, h * 0.22);
  ctx.closePath();
  ctx.fill();
  // glowing orb window
  const og = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.16);
  og.addColorStop(0, '#eaf2ff');
  og.addColorStop(0.5, '#7aa8ff');
  og.addColorStop(1, 'rgba(80,120,220,0)');
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, w * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawSiege(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // open timber workshop frame
  ctx.strokeStyle = pal.leather;
  ctx.lineWidth = Math.max(2, scale * 0.1);
  ctx.strokeRect(w * 0.12, h * 0.4, w * 0.76, h * 0.56);
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.4); ctx.lineTo(w * 0.5, h * 0.24); ctx.lineTo(w * 0.88, h * 0.4);
  ctx.stroke();
  // a catapult arm + wheel inside
  ctx.strokeStyle = '#3a2c1a';
  ctx.lineWidth = Math.max(2, scale * 0.08);
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.92); ctx.lineTo(w * 0.62, h * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#2c2016';
  ctx.beginPath();
  ctx.arc(w * 0.34, h * 0.9, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(w * 0.64, h * 0.48, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawResearch(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  walls(ctx, w, h * 0.4, h, pal);
  roof(ctx, w, h * 0.4, pal, scale);
  // observatory cupola + telescope
  ctx.fillStyle = pal.wallDark;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.4, w * 0.18, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = Math.max(1.5, scale * 0.06);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.36);
  ctx.lineTo(w * 0.7, h * 0.2);
  ctx.stroke();
  // book/scroll emblem
  ctx.fillStyle = '#f0ece0';
  ctx.fillRect(w * 0.4, h * 0.62, w * 0.2, h * 0.16);
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.5, h * 0.78);
  ctx.stroke();
}

function drawTower(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  const tw = w * 0.6;
  const tx = w * 0.5 - tw / 2;
  const grad = ctx.createLinearGradient(0, h * 0.15, 0, h);
  grad.addColorStop(0, pal.wall);
  grad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = grad;
  ctx.fillRect(tx, h * 0.15, tw, h * 0.83);
  // crenellations
  ctx.fillStyle = pal.wallDark;
  const teeth = 3;
  for (let i = 0; i < teeth; i++) {
    ctx.fillRect(tx + (tw / teeth) * i, h * 0.1, tw / (teeth * 2), scale * 0.16);
  }
  // arrow slit
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(w * 0.5 - scale * 0.04, h * 0.4, scale * 0.08, h * 0.3);
  void scale;
}

function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette): void {
  ctx.fillStyle = pal.wall;
  ctx.fillRect(w * 0.04, h * 0.3, w * 0.92, h * 0.68);
  ctx.fillStyle = pal.wallDark;
  const teeth = 3;
  for (let i = 0; i < teeth; i++) {
    ctx.fillRect(w * 0.04 + (w * 0.92 / teeth) * i, h * 0.24, w * 0.92 / (teeth * 2), h * 0.1);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.04, h * 0.62); ctx.lineTo(w * 0.96, h * 0.62);
  ctx.moveTo(w * 0.5, h * 0.3); ctx.lineTo(w * 0.5, h * 0.62);
  ctx.stroke();
}

function drawCastle(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // central keep
  walls(ctx, w, h * 0.34, h, pal);
  // corner towers (taller)
  for (const cx of [0.02, 0.74]) {
    const grad = ctx.createLinearGradient(0, h * 0.2, 0, h);
    grad.addColorStop(0, pal.wall);
    grad.addColorStop(1, pal.wallDark);
    ctx.fillStyle = grad;
    ctx.fillRect(w * cx, h * 0.2, w * 0.24, h * 0.78);
    ctx.fillStyle = pal.wallDark;
    for (let i = 0; i < 2; i++) ctx.fillRect(w * cx + (w * 0.12) * i, h * 0.15, w * 0.07, scale * 0.18);
  }
  // keep roof (civ style)
  roof(ctx, w, h * 0.34, pal, scale, 0.66);
  // big gate
  ctx.fillStyle = 'rgba(15,10,5,0.85)';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.72, w * 0.13, Math.PI, Math.PI * 2);
  ctx.fillRect(w * 0.37, h * 0.72, w * 0.26, h * 0.26);
  ctx.fill();
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = Math.max(1.5, scale * 0.05);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Ownership + construction
// ---------------------------------------------------------------------------

function drawPennant(ctx: CanvasRenderingContext2D, w: number, team: Team, scale: number): void {
  const px = w * 0.9;
  const topY = -scale * 0.1;
  ctx.strokeStyle = '#6e4a26';
  ctx.lineWidth = Math.max(1.5, scale * 0.05);
  ctx.beginPath();
  ctx.moveTo(px, scale * 0.55);
  ctx.lineTo(px, topY);
  ctx.stroke();
  ctx.fillStyle = TEAM_COLORS[team].main;
  ctx.beginPath();
  ctx.moveTo(px, topY);
  ctx.lineTo(px + scale * 0.42, topY + scale * 0.12);
  ctx.lineTo(px, topY + scale * 0.28);
  ctx.closePath();
  ctx.fill();
}

function drawScaffold(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, progress: number): void {
  // partial wall rising with progress
  const top = h * 0.98 - h * 0.6 * Math.max(0.15, progress);
  ctx.fillStyle = pal.wallDark;
  ctx.fillRect(w * 0.1, top, w * 0.8, h * 0.98 - top);
  // timber scaffold X
  ctx.strokeStyle = '#8a5d33';
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.08, h * 0.36, w * 0.84, h * 0.62);
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.36); ctx.lineTo(w * 0.92, h * 0.98);
  ctx.moveTo(w * 0.92, h * 0.36); ctx.lineTo(w * 0.08, h * 0.98);
  ctx.stroke();
  // progress bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(w * 0.1, h * 0.04, w * 0.8, 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(w * 0.1, h * 0.04, w * 0.8 * progress, 4);
}
