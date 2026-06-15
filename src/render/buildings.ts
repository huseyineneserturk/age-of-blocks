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

function lighten(hex: string, percent: number): string {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  const num = parseInt(color, 16);
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) + amt;
  let g = (num >> 8 & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

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
  ctx.ellipse(w / 2, h * 0.96, Math.max(0.1, w * 0.5), Math.max(0.1, h * 0.16), 0, 0, Math.PI * 2);
  ctx.fill();

  if (opts.constructing) {
    drawScaffold(ctx, w, h, pal, opts.progress);
    drawPennant(ctx, w, team, scale);
    ctx.restore();
    return;
  }

  // Body per type (draws its own walls + roof).
  switch (kind) {
    case 'castle': drawCastle(ctx, w, h, pal, scale, team); break;
    case 'house': drawHouse(ctx, w, h, pal, scale); break;
    case 'mine': drawMine(ctx, w, h, pal, scale); break;
    case 'barracks': drawBarracks(ctx, w, h, pal, scale); break;
    case 'archery': drawArchery(ctx, w, h, pal, scale); break;
    case 'stable': drawStable(ctx, w, h, pal, scale); break;
    case 'siegeworks': drawSiege(ctx, w, h, pal, scale); break;
    case 'research': drawResearch(ctx, w, h, pal, scale); break;
    case 'tower': drawTower(ctx, w, h, pal, scale); break;
    case 'wall': drawWall(ctx, w, h, pal); break;
    case 'colosseum': drawColosseum(ctx, w, h, pal, scale); break;
    case 'forum': drawForum(ctx, w, h, pal, scale); break;
    case 'mosque': drawMosque(ctx, w, h, pal, scale); break;
    case 'caravanserai': drawCaravanserai(ctx, w, h, pal, scale); break;
    case 'pagoda': drawPagoda(ctx, w, h, pal, scale); break;
    case 'bastion': drawBastion(ctx, w, h, pal, scale); break;
    case 'longhouse': drawLonghouse(ctx, w, h, pal, scale); break;
    case 'shrine': drawShrine(ctx, w, h, pal, scale); break;
    case 'grove': drawGrove(ctx, w, h, pal, scale); break;
    case 'stone_circle': drawStoneCircle(ctx, w, h, pal, scale); break;
  }

  // Ownership: team pennant + thin team/selection outline.
  drawPennant(ctx, w, team, scale);
  if (opts.selected) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(1, h * 0.32, w - 2, h * 0.66);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Wall fills + textures
// ---------------------------------------------------------------------------

/** Fill the lower body (the actual ground floor) with civ wall material. */
function walls(ctx: CanvasRenderingContext2D, w: number, top: number, h: number, pal: CivPalette): void {
  const bottom = h * 0.98;
  const height = bottom - top;
  const frontW = w * 0.74;
  const depthY = w * 0.08;

  // 1. Draw Ground/Base Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(w * 0.06, bottom - 2, w * 0.88, 4);

  // 2. Draw Side Wall (Right shadow side)
  const sideGrad = ctx.createLinearGradient(w * 0.8, top, w * 0.94, bottom);
  sideGrad.addColorStop(0, pal.wallDark);
  sideGrad.addColorStop(1, 'rgba(0,0,0,0.85)'); // extra dark shadow
  ctx.fillStyle = sideGrad;
  
  ctx.beginPath();
  ctx.moveTo(w * 0.8, top);
  ctx.lineTo(w * 0.94, top - depthY);
  ctx.lineTo(w * 0.94, bottom - depthY);
  ctx.lineTo(w * 0.8, bottom);
  ctx.closePath();
  ctx.fill();

  // 3. Draw Front Wall (Left light side)
  const frontGrad = ctx.createLinearGradient(0, top, 0, bottom);
  frontGrad.addColorStop(0, pal.wall);
  frontGrad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = frontGrad;

  ctx.beginPath();
  ctx.moveTo(w * 0.06, top);
  ctx.lineTo(w * 0.8, top);
  ctx.lineTo(w * 0.8, bottom);
  ctx.lineTo(w * 0.06, bottom);
  ctx.closePath();
  ctx.fill();

  // texture
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  if (pal.wallStyle === 'stone' || pal.wallStyle === 'plaster') {
    const rows = Math.max(2, Math.round(height / 9));
    for (let r = 1; r < rows; r++) {
      const yy = top + (height / rows) * r;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, yy);
      ctx.lineTo(w * 0.8, yy);
      ctx.stroke();
    }
  } else {
    // timber planks (vertical)
    const cols = Math.max(2, Math.round(frontW / 9));
    for (let c = 1; c < cols; c++) {
      const xx = w * 0.06 + (frontW / cols) * c;
      ctx.beginPath();
      ctx.moveTo(xx, top);
      ctx.lineTo(xx, bottom);
      ctx.stroke();
    }
  }
  // foundation band
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, bottom - height * 0.12);
  ctx.lineTo(w * 0.8, bottom - height * 0.12);
  ctx.lineTo(w * 0.8, bottom);
  ctx.lineTo(w * 0.06, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(w * 0.8, bottom - height * 0.12);
  ctx.lineTo(w * 0.94, bottom - height * 0.12 - depthY);
  ctx.lineTo(w * 0.94, bottom - depthY);
  ctx.lineTo(w * 0.8, bottom);
  ctx.closePath();
  ctx.fill();
}

/** Civ roof cap sitting on top of a body whose wall-top is at `top`. */
function roof(ctx: CanvasRenderingContext2D, w: number, top: number, pal: CivPalette, scale: number, slim = 1): void {
  const depthY = w * 0.08;
  const cx = w * 0.43 * slim; // Shifted left to fit isometric depth
  const rw = w * 0.74 * slim;
  const rightX = w * 0.8;

  switch (pal.roofStyle) {
    case 'dome': {
      const r = Math.max(0.1, rw / 2);

      // 3D Dome side cap/slope (covers the 3D side wall top to prevent exposed flat tops)
      ctx.fillStyle = pal.roofDark || '#aab2c0';
      ctx.beginPath();
      ctx.moveTo(cx, top - r);
      ctx.lineTo(cx + w * 0.14, top - r - depthY);
      ctx.lineTo(w * 0.94, top - depthY);
      ctx.lineTo(rightX, top);
      ctx.closePath();
      ctx.fill();
      
      // 3D Dome shadow side (right) - Top-right quadrant only to prevent overlapping walls
      ctx.fillStyle = pal.roofDark || '#aab2c0';
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.arc(cx, top, r, -Math.PI * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      // 3D Dome light side (left) - Top-left quadrant only to prevent overlapping walls
      const lightColor = lighten(pal.roof, 25);
      const g = ctx.createLinearGradient(cx - r, top - r, cx, top);
      g.addColorStop(0, lightColor);
      g.addColorStop(1, pal.roof);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.arc(cx, top, r, Math.PI, -Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();

      // crescent finial
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = Math.max(1.5, scale * 0.05);
      ctx.beginPath();
      ctx.arc(cx, top - r - scale * 0.16, Math.max(0.1, scale * 0.12), Math.PI * 0.4, Math.PI * 1.6);
      ctx.stroke();
      break;
    }
    case 'pagoda': {
      // 3D Pagoda side roof
      ctx.fillStyle = pal.roofDark;
      ctx.beginPath();
      ctx.moveTo(rightX, top + scale * 0.06);
      ctx.quadraticCurveTo(rightX + w * 0.07, top - scale * 0.32 - depthY, rightX + w * 0.14 + scale * 0.12, top + scale * 0.06 - depthY);
      ctx.lineTo(rightX + w * 0.14, top + scale * 0.06 - depthY);
      ctx.lineTo(rightX, top + scale * 0.06);
      ctx.closePath();
      ctx.fill();

      // 3D Pagoda front roof
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(w * 0.06 - scale * 0.12, top + scale * 0.06);
      ctx.quadraticCurveTo(cx, top - scale * 0.42, rightX + scale * 0.12, top + scale * 0.06);
      ctx.quadraticCurveTo(cx, top - scale * 0.06, w * 0.06 - scale * 0.12, top + scale * 0.06);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.roofDark;
      ctx.fillRect(w * 0.06 - scale * 0.12, top + scale * 0.04, rw + scale * 0.24, scale * 0.05);
      ctx.fillStyle = pal.trim;
      ctx.beginPath();
      ctx.arc(cx, top - scale * 0.34, scale * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pediment': {
      // 3D Pediment side roof
      ctx.fillStyle = pal.roofDark;
      ctx.beginPath();
      ctx.moveTo(cx, top - scale * 0.34);
      ctx.lineTo(cx + w * 0.14, top - scale * 0.34 - depthY);
      ctx.lineTo(w * 0.94, top - depthY);
      ctx.lineTo(rightX, top);
      ctx.closePath();
      ctx.fill();

      // 3D Pediment front triangle
      ctx.fillStyle = '#e7e2d4';
      ctx.beginPath();
      ctx.moveTo(w * 0.06, top + scale * 0.04);
      ctx.lineTo(cx, top - scale * 0.34);
      ctx.lineTo(rightX, top + scale * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.roofDark;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = pal.roof;
      ctx.fillRect(w * 0.06, top, rw, scale * 0.06);
      break;
    }
    case 'gable': {
      const peakX = cx;
      const peakY = top - scale * 0.44;

      // 3D Gable side slope
      ctx.fillStyle = pal.roofDark;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX + w * 0.14, peakY - depthY);
      ctx.lineTo(w * 0.94, top - depthY);
      ctx.lineTo(rightX, top);
      ctx.closePath();
      ctx.fill();

      // 3D Gable front triangle
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, top + scale * 0.05);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(rightX, top + scale * 0.05);
      ctx.closePath();
      ctx.fill();

      // crossed beams
      ctx.strokeStyle = pal.roofDark;
      ctx.lineWidth = Math.max(1, scale * 0.05);
      ctx.beginPath();
      ctx.moveTo(peakX - scale * 0.16, top - scale * 0.48);
      ctx.lineTo(peakX + scale * 0.12, top - scale * 0.2);
      ctx.moveTo(peakX + scale * 0.16, top - scale * 0.48);
      ctx.lineTo(peakX - scale * 0.12, top - scale * 0.2);
      ctx.stroke();
      break;
    }
    case 'thatch': {
      // 3D Thatch side slope
      ctx.fillStyle = pal.roofDark;
      ctx.beginPath();
      ctx.moveTo(cx, top - scale * 0.4);
      ctx.lineTo(cx + w * 0.14, top - scale * 0.4 - depthY);
      ctx.lineTo(w * 0.94, top - depthY);
      ctx.lineTo(rightX, top);
      ctx.closePath();
      ctx.fill();

      // 3D Thatch front dome shape
      ctx.fillStyle = pal.roof;
      ctx.beginPath();
      ctx.moveTo(w * 0.06 - scale * 0.1, top + scale * 0.06);
      ctx.quadraticCurveTo(cx, top - scale * 0.4, rightX + scale * 0.1, top + scale * 0.06);
      ctx.lineTo(rightX, top + scale * 0.06);
      ctx.lineTo(w * 0.06, top + scale * 0.06);
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
  const dx = w * 0.42;
  const dy = h * 0.62;
  const dw = w * 0.16;
  const dh = h * 0.36;

  // Door background (timber brown)
  ctx.fillStyle = '#4a2f13';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(dx, dy, dw, dh);

  // Vertical planks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(dx + dw * 0.33, dy); ctx.lineTo(dx + dw * 0.33, dy + dh);
  ctx.moveTo(dx + dw * 0.66, dy); ctx.lineTo(dx + dw * 0.66, dy + dh);
  ctx.stroke();

  // Brass knob
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(dx + dw * 0.8, dy + dh * 0.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
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
  const tw = w * 0.5;
  const tx = w * 0.18; // Centered to fit in bounding box
  const depthY = w * 0.08;
  const sideW = w * 0.18;
  
  // Side wall (dark shadow)
  const sideGrad = ctx.createLinearGradient(tx + tw, h * 0.15, tx + tw + sideW, h);
  sideGrad.addColorStop(0, pal.wallDark);
  sideGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(tx + tw, h * 0.15);
  ctx.lineTo(tx + tw + sideW, h * 0.15 - depthY);
  ctx.lineTo(tx + tw + sideW, h * 0.98 - depthY);
  ctx.lineTo(tx + tw, h * 0.98);
  ctx.closePath();
  ctx.fill();

  // Front wall (light)
  const frontGrad = ctx.createLinearGradient(0, h * 0.15, 0, h);
  frontGrad.addColorStop(0, pal.wall);
  frontGrad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = frontGrad;
  ctx.fillRect(tx, h * 0.15, tw, h * 0.83);

  // crenellations
  ctx.fillStyle = pal.wallDark;
  const teeth = 3;
  for (let i = 0; i < teeth; i++) {
    ctx.fillRect(tx + (tw / teeth) * i, h * 0.1, tw / (teeth * 2), scale * 0.16);
  }
  // arrow slit
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(tx + tw * 0.5 - scale * 0.04, h * 0.4, scale * 0.08, h * 0.3);
  void scale;
}

function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette): void {
  const ww = w * 0.72;
  const wx = w * 0.08;
  const depthY = w * 0.08;
  const sideW = w * 0.12;

  // Side Wall (dark shadow)
  ctx.fillStyle = pal.wallDark;
  ctx.beginPath();
  ctx.moveTo(wx + ww, h * 0.3);
  ctx.lineTo(wx + ww + sideW, h * 0.3 - depthY);
  ctx.lineTo(wx + ww + sideW, h * 0.98 - depthY);
  ctx.lineTo(wx + ww, h * 0.98);
  ctx.closePath();
  ctx.fill();

  // Front Wall (lighted)
  ctx.fillStyle = pal.wall;
  ctx.fillRect(wx, h * 0.3, ww, h * 0.68);

  // Top cap (3D depth surface)
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(wx, h * 0.3);
  ctx.lineTo(wx + sideW, h * 0.3 - depthY);
  ctx.lineTo(wx + ww + sideW, h * 0.3 - depthY);
  ctx.lineTo(wx + ww, h * 0.3);
  ctx.closePath();
  ctx.fill();

  // crenellations
  ctx.fillStyle = pal.wallDark;
  const teeth = 3;
  for (let i = 0; i < teeth; i++) {
    ctx.fillRect(wx + (ww / teeth) * i, h * 0.24, ww / (teeth * 2), h * 0.1);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wx, h * 0.62); ctx.lineTo(wx + ww, h * 0.62);
  ctx.moveTo(wx + ww * 0.5, h * 0.3); ctx.lineTo(wx + ww * 0.5, h * 0.62);
  ctx.stroke();
}

function drawCastle(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number, team: Team): void {
  const isPirate = (team === 2);
  const piratePal: CivPalette = {
    wall: '#3b2f2f', // dark weathered wood/stone
    wallDark: '#1e1616',
    wallStyle: 'timber',
    roof: '#1c1d21', // black slate roof
    roofDark: '#0b0c10',
    roofStyle: 'gable',
    trim: GOLD,
    cloth: '#222',
    clothDark: '#000',
    metal: '#444',
    metalDark: '#111',
    leather: '#2b1a1a',
  };
  const activePal = isPirate ? piratePal : pal;

  // 1. central keep walls (drawn first)
  walls(ctx, w, h * 0.34, h, activePal);
  
  // 2. keep roof (civ style) (drawn second so it sits behind the corner towers)
  roof(ctx, w, h * 0.34, activePal, scale, 0.66);

  // 3. corner towers (taller, with 3D side panels! drawn over keep roof)
  const depthY = w * 0.08;

  for (const cx of [0.02, 0.64]) {
    // Side panel of the tower (shadowed)
    const sideGrad = ctx.createLinearGradient(w * (cx + 0.18), h * 0.2, w * (cx + 0.3), h);
    sideGrad.addColorStop(0, activePal.wallDark);
    sideGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.moveTo(w * (cx + 0.18), h * 0.2);
    ctx.lineTo(w * (cx + 0.28), h * 0.2 - depthY);
    ctx.lineTo(w * (cx + 0.28), h * 0.98 - depthY);
    ctx.lineTo(w * (cx + 0.18), h * 0.98);
    ctx.closePath();
    ctx.fill();

    // Front panel of the tower (lighted)
    const frontGrad = ctx.createLinearGradient(0, h * 0.2, 0, h);
    frontGrad.addColorStop(0, activePal.wall);
    frontGrad.addColorStop(1, activePal.wallDark);
    ctx.fillStyle = frontGrad;
    ctx.fillRect(w * cx, h * 0.2, w * 0.18, h * 0.78);
    
    // Crenellations
    ctx.fillStyle = activePal.wallDark;
    for (let i = 0; i < 2; i++) {
      ctx.fillRect(w * cx + (w * 0.09) * i, h * 0.15, w * 0.05, scale * 0.18);
    }
  }

  // 4. big gate (drawn in front)
  ctx.fillStyle = 'rgba(15,10,5,0.85)';
  ctx.beginPath();
  ctx.arc(w * 0.43, h * 0.72, w * 0.13, Math.PI, Math.PI * 2);
  ctx.fillRect(w * 0.3, h * 0.72, w * 0.26, h * 0.26);
  ctx.fill();
  ctx.strokeStyle = activePal.trim;
  ctx.lineWidth = Math.max(1.5, scale * 0.05);
  ctx.stroke();

  if (isPirate) {
    // Draw a golden skull emblem above the gate
    const sx = w * 0.43;
    const sy = h * 0.52;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.1, scale * 0.1), 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(sx - scale * 0.035, sy + scale * 0.015, Math.max(0.1, scale * 0.022), 0, Math.PI * 2);
    ctx.arc(sx + scale * 0.035, sy + scale * 0.015, Math.max(0.1, scale * 0.022), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Ownership + construction
// ---------------------------------------------------------------------------

function drawPirateFlag(ctx: CanvasRenderingContext2D, w: number, scale: number): void {
  const px = w * 0.9;
  const topY = -scale * 0.15;
  
  // Wooden pole
  ctx.strokeStyle = '#3a2c1a'; // dark wood
  ctx.lineWidth = Math.max(1.5, scale * 0.05);
  ctx.beginPath();
  ctx.moveTo(px, scale * 0.55);
  ctx.lineTo(px, topY);
  ctx.stroke();

  // Flag fabric (black)
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(px, topY);
  ctx.lineTo(px + scale * 0.45, topY + scale * 0.12);
  ctx.lineTo(px, topY + scale * 0.28);
  ctx.closePath();
  ctx.fill();

  // White skull symbol
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px + scale * 0.16, topY + scale * 0.14, Math.max(0.1, scale * 0.05), 0, Math.PI * 2);
  ctx.fill();

  // Small crossbones
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + scale * 0.08, topY + scale * 0.08); ctx.lineTo(px + scale * 0.24, topY + scale * 0.20);
  ctx.moveTo(px + scale * 0.24, topY + scale * 0.08); ctx.lineTo(px + scale * 0.08, topY + scale * 0.20);
  ctx.stroke();
}

function drawPennant(ctx: CanvasRenderingContext2D, w: number, team: Team, scale: number): void {
  if (team === 2) {
    drawPirateFlag(ctx, w, scale);
    return;
  }
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

// --- unique buildings drawings ---

function drawColosseum(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  void scale;
  // Oval base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.95, Math.max(0.1, w * 0.45), Math.max(0.1, h * 0.1), 0, 0, Math.PI * 2);
  ctx.fill();

  const top = h * 0.4;
  const bottom = h * 0.98;
  const depthY = w * 0.08;

  // 3D Side shadow wall
  const sideGrad = ctx.createLinearGradient(w * 0.75, top, w * 0.92, bottom);
  sideGrad.addColorStop(0, pal.wallDark);
  sideGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.75, top);
  ctx.lineTo(w * 0.92, top - depthY);
  ctx.lineTo(w * 0.92, bottom - depthY);
  ctx.lineTo(w * 0.75, bottom);
  ctx.closePath();
  ctx.fill();

  // Front arena wall
  const frontGrad = ctx.createLinearGradient(0, top, 0, bottom);
  frontGrad.addColorStop(0, pal.wall);
  frontGrad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = frontGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, top);
  ctx.lineTo(w * 0.75, top);
  ctx.lineTo(w * 0.75, bottom);
  ctx.lineTo(w * 0.08, bottom);
  ctx.closePath();
  ctx.fill();

  // Draw two tiers of arched colosseum cutouts
  ctx.fillStyle = 'rgba(10,5,0,0.85)';
  for (let tier = 0; tier < 2; tier++) {
    const ty = top + h * 0.12 + tier * h * 0.22;
    for (let i = 0; i < 4; i++) {
      const tx = w * (0.16 + i * 0.14);
      ctx.beginPath();
      ctx.arc(tx, ty, w * 0.05, Math.PI, Math.PI * 2);
      ctx.fillRect(tx - w * 0.05, ty, w * 0.1, h * 0.12);
      ctx.fill();
    }
  }
}

function drawForum(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Steps/Foundation base
  ctx.fillStyle = pal.wallDark;
  ctx.fillRect(w * 0.05, h * 0.85, w * 0.9, h * 0.13);
  ctx.fillStyle = pal.wall;
  ctx.fillRect(w * 0.08, h * 0.88, w * 0.84, h * 0.1);

  // Main temple backing
  walls(ctx, w, h * 0.42, h * 0.86, pal);

  // Roman wooden door behind the columns
  ctx.fillStyle = '#4a2f13';
  ctx.fillRect(w * 0.38, h * 0.62, w * 0.24, h * 0.24);
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w * 0.38, h * 0.62, w * 0.24, h * 0.24);

  // Triangular pediment roof (using roof helper to render 3D side caps)
  roof(ctx, w, h * 0.42, pal, scale, 1.0);

  // Columns in front of the wall
  ctx.fillStyle = pal.trim;
  const count = 4;
  for (let i = 0; i < count; i++) {
    const cx = w * 0.06 + (w * 0.74 / (count - 1)) * i;
    // Column base
    ctx.fillStyle = pal.wallDark;
    ctx.fillRect(cx - 2, h * 0.82, w * 0.06 + 4, h * 0.04);
    // Column shaft (with 3D gradient shading)
    const colGrad = ctx.createLinearGradient(cx, 0, cx + w * 0.06, 0);
    colGrad.addColorStop(0, lighten(pal.trim, 20));
    colGrad.addColorStop(0.4, pal.trim);
    colGrad.addColorStop(1, pal.wallDark);
    ctx.fillStyle = colGrad;
    ctx.fillRect(cx, h * 0.42, w * 0.06, h * 0.4);
    // Column capital (top block)
    ctx.fillStyle = pal.trim;
    ctx.fillRect(cx - 2, h * 0.42, w * 0.06 + 4, h * 0.035);
  }
}

function drawMosque(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Main building body
  walls(ctx, w, h * 0.48, h, pal);

  // 1. Right Side Dome (drawn first so center dome overlaps it, covers right side wall)
  const cx2 = w * 0.72;
  const cy2 = h * 0.48;
  const rx2 = Math.max(0.1, w * 0.15);
  const ry2 = Math.max(0.1, h * 0.12);

  // Side-dome 3D side cover
  ctx.fillStyle = pal.roofDark || '#9c2f24';
  ctx.beginPath();
  ctx.moveTo(cx2, cy2 - ry2);
  ctx.lineTo(cx2 + w * 0.12, cy2 - ry2 - w * 0.06);
  ctx.lineTo(w * 0.94, cy2 - w * 0.08);
  ctx.lineTo(cx2 + rx2, cy2);
  ctx.closePath();
  ctx.fill();

  // Side-dome itself
  const domeGrad2 = ctx.createRadialGradient(cx2, cy2 - ry2 * 0.3, 0, cx2, cy2, rx2);
  domeGrad2.addColorStop(0, pal.roof);
  domeGrad2.addColorStop(0.7, pal.roofDark ?? '#8a1c22');
  domeGrad2.addColorStop(1, '#221111');
  ctx.fillStyle = domeGrad2;
  ctx.beginPath();
  ctx.ellipse(cx2, cy2, rx2, ry2, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // 2. Center Dome
  const rx = Math.max(0.1, w * 0.28);
  const ry = Math.max(0.1, h * 0.22);
  const cx = w * 0.43;
  const cy = h * 0.48;

  // Center dome 3D side cover
  ctx.fillStyle = pal.roofDark || '#9c2f24';
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx + w * 0.14, cy - ry - w * 0.08);
  ctx.lineTo(w * 0.8, cy - w * 0.08);
  ctx.lineTo(w * 0.8, cy);
  ctx.closePath();
  ctx.fill();

  // Main Center dome
  const domeGrad = ctx.createRadialGradient(cx, cy - ry * 0.3, 0, cx, cy, rx);
  domeGrad.addColorStop(0, pal.roof);
  domeGrad.addColorStop(0.7, pal.roofDark ?? '#8a1c22');
  domeGrad.addColorStop(1, '#221111');
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Golden crescent spike on top of the dome
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = scale * 0.06;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx, cy - ry - scale * 0.16);
  ctx.stroke();

  // Pencil Minarets on the sides (slender, 3D cylindrical, with spires)
  const mw = w * 0.05; // slender width
  for (const ccx of [w * 0.06, w * 0.80]) {
    const mx = ccx - mw / 2;
    // 3D Minaret column (cylindrical linear gradient shading)
    const colGrad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    colGrad.addColorStop(0, lighten(pal.wall, 15));
    colGrad.addColorStop(0.3, pal.wall);
    colGrad.addColorStop(1, pal.wallDark);
    ctx.fillStyle = colGrad;
    ctx.fillRect(mx, h * 0.22, mw, h * 0.76);

    // Balcony (rendered as a small projecting 3D block/cylinder near the top)
    const balGrad = ctx.createLinearGradient(mx - mw * 0.25, 0, mx + mw * 1.25, 0);
    balGrad.addColorStop(0, '#f2d982'); // lighter gold
    balGrad.addColorStop(0.5, pal.trim); // gold
    balGrad.addColorStop(1, '#a6821e'); // darker gold
    ctx.fillStyle = balGrad;
    ctx.fillRect(mx - mw * 0.25, h * 0.32, mw * 1.5, h * 0.045);

    // Conical roof cap (cylindrical linear gradient shading)
    const capGrad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    capGrad.addColorStop(0, lighten(pal.roof, 20));
    capGrad.addColorStop(0.4, pal.roof);
    capGrad.addColorStop(1, pal.roofDark);
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.moveTo(mx, h * 0.22);
    ctx.lineTo(ccx, h * 0.06);
    ctx.lineTo(mx + mw, h * 0.22);
    ctx.closePath();
    ctx.fill();

    // Golden crescent spike/finial on top of minaret cap
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = scale * 0.03;
    ctx.beginPath();
    ctx.moveTo(ccx, h * 0.06);
    ctx.lineTo(ccx, h * 0.015);
    ctx.stroke();
  }
}

function drawCaravanserai(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Fortified Brick outer walls
  walls(ctx, w, h * 0.45, h, pal);

  // Large Arched Portal (Gatehouse) in the center
  const pW = w * 0.44;
  const pX = w * 0.22;
  const pY = h * 0.38;

  // Gatehouse side shadow (3D effect)
  ctx.fillStyle = pal.wallDark;
  ctx.beginPath();
  ctx.moveTo(pX + pW, pY);
  ctx.lineTo(pX + pW + w * 0.1, pY - w * 0.05);
  ctx.lineTo(pX + pW + w * 0.1, h * 0.98 - w * 0.05);
  ctx.lineTo(pX + pW, h * 0.98);
  ctx.closePath();
  ctx.fill();

  // Gatehouse front
  ctx.fillStyle = pal.wall;
  ctx.fillRect(pX, pY, pW, h * 0.6);

  // Large dark gate opening
  ctx.fillStyle = '#110c08';
  ctx.beginPath();
  ctx.arc(pX + pW / 2, pY + h * 0.28, pW * 0.28, Math.PI, Math.PI * 2);
  ctx.fillRect(pX + pW * 0.22, pY + h * 0.28, pW * 0.56, h * 0.32);
  ctx.fill();

  // Striped brick arch accent
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = scale * 0.06;
  ctx.beginPath();
  ctx.arc(pX + pW / 2, pY + h * 0.28, pW * 0.32, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawPagoda(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Renders a centered 3-tiered Chinese Pagoda
  // Tier 1 (Base) - width w
  walls(ctx, w, h * 0.65, h, pal);
  roof(ctx, w, h * 0.65, pal, scale, 0.9);

  // Tier 2 (Middle) - width w * 0.8, translated by w * 0.13 to center peak
  ctx.save();
  ctx.translate(w * 0.13, 0);
  walls(ctx, w * 0.8, h * 0.4, h * 0.65, pal);
  roof(ctx, w * 0.8, h * 0.4, pal, scale, 0.75);
  ctx.restore();

  // Tier 3 (Top) - width w * 0.6, translated by w * 0.245 to center peak
  ctx.save();
  ctx.translate(w * 0.245, 0);
  walls(ctx, w * 0.6, h * 0.2, h * 0.4, pal);
  roof(ctx, w * 0.6, h * 0.2, pal, scale, 0.55);
  ctx.restore();

  // Golden spire precisely in the center of the aligned top tier peak
  const peakX = w * 0.387;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = scale * 0.07;
  ctx.beginPath();
  ctx.moveTo(peakX, h * 0.2);
  ctx.lineTo(peakX, h * 0.03);
  ctx.stroke();

  // Spire details
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(peakX, h * 0.08, scale * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawBastion(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Heavy battle tower. Wider than standard tower. Centered inside bounding box.
  const tw = w * 0.58;
  const tx = w * 0.12;
  const depthY = w * 0.08;
  const sideW = w * 0.16;

  // Side Wall (shadow)
  const sideGrad = ctx.createLinearGradient(tx + tw, h * 0.12, tx + tw + sideW, h);
  sideGrad.addColorStop(0, pal.wallDark);
  sideGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = sideGrad;
  ctx.beginPath();
  ctx.moveTo(tx + tw, h * 0.12);
  ctx.lineTo(tx + tw + sideW, h * 0.12 - depthY);
  ctx.lineTo(tx + tw + sideW, h * 0.98 - depthY);
  ctx.lineTo(tx + tw, h * 0.98);
  ctx.closePath();
  ctx.fill();

  // Front Wall (light)
  const frontGrad = ctx.createLinearGradient(0, h * 0.12, 0, h);
  frontGrad.addColorStop(0, pal.wall);
  frontGrad.addColorStop(1, pal.wallDark);
  ctx.fillStyle = frontGrad;
  ctx.fillRect(tx, h * 0.12, tw, h * 0.86);

  // Stone battlements (crenellations)
  ctx.fillStyle = pal.wallDark;
  const teeth = 4;
  for (let i = 0; i < teeth; i++) {
    ctx.fillRect(tx + (tw / teeth) * i, h * 0.06, tw / (teeth * 2), scale * 0.2);
  }

  // Double Arrow slits
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(tx + tw * 0.28, h * 0.35, scale * 0.06, h * 0.22);
  ctx.fillRect(tx + tw * 0.66, h * 0.35, scale * 0.06, h * 0.22);
}

function drawLonghouse(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Wooden walls
  walls(ctx, w, h * 0.55, h, pal);

  // Use roof helper to render a detailed 3D roof
  roof(ctx, w, h * 0.55, pal, scale, 1.02);

  // Detailed wooden door with planks and hinges
  const dx = w * 0.4;
  const dy = h * 0.72;
  const dw = w * 0.18;
  const dh = h * 0.26;
  ctx.fillStyle = '#3f2b18'; // dark timber
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(dx, dy, dw, dh);

  // vertical planks
  ctx.beginPath();
  ctx.moveTo(dx + dw * 0.33, dy); ctx.lineTo(dx + dw * 0.33, dy + dh);
  ctx.moveTo(dx + dw * 0.66, dy); ctx.lineTo(dx + dw * 0.66, dy + dh);
  ctx.stroke();

  // metal hinges
  ctx.strokeStyle = pal.metal || '#7a7a7a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dx, dy + dh * 0.3); ctx.lineTo(dx + dw * 0.4, dy + dh * 0.3);
  ctx.moveTo(dx, dy + dh * 0.7); ctx.lineTo(dx + dw * 0.4, dy + dh * 0.7);
  ctx.stroke();

  // cozy glowing window
  ctx.fillStyle = 'rgba(255,200,100,0.7)';
  ctx.fillRect(w * 0.2, h * 0.64, w * 0.1, h * 0.1);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(w * 0.2, h * 0.64, w * 0.1, h * 0.1);
}

function drawShrine(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  // Grassy stone platform with 3D side paneling
  const depthY = w * 0.05;
  const topY = h * 0.76;
  const bottomY = h * 0.98;
  const rightSide = w * 0.8;

  // 1. Side panel of platform (dark gray-green stone shadow)
  ctx.fillStyle = '#3c403d';
  ctx.beginPath();
  ctx.moveTo(rightSide, topY);
  ctx.lineTo(rightSide + w * 0.1, topY - depthY);
  ctx.lineTo(rightSide + w * 0.1, bottomY - depthY);
  ctx.lineTo(rightSide, bottomY);
  ctx.closePath();
  ctx.fill();

  // 2. Top surface (grassy green)
  ctx.fillStyle = '#4c634e';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, topY);
  ctx.lineTo(w * 0.1 + w * 0.1, topY - depthY);
  ctx.lineTo(rightSide + w * 0.1, topY - depthY);
  ctx.lineTo(rightSide, topY);
  ctx.closePath();
  ctx.fill();

  // 3. Front panel of platform (lighted stone gray)
  ctx.fillStyle = '#5c635e';
  ctx.fillRect(w * 0.1, topY, w * 0.7, bottomY - topY);

  // Stone lines/texture on front panel
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, topY + (bottomY - topY) * 0.5);
  ctx.lineTo(rightSide, topY + (bottomY - topY) * 0.5);
  ctx.stroke();

  // Standing wooden pillars (left/right)
  const px1 = w * 0.18;
  const px2 = w * 0.68;
  const pw = w * 0.08;
  const ph = h * 0.42;
  const ptop = h * 0.38;

  // Shaded wooden pillars
  const woodGrad = ctx.createLinearGradient(px1, 0, px1 + pw, 0);
  woodGrad.addColorStop(0, '#8b5a2b');
  woodGrad.addColorStop(0.5, '#6b4c35');
  woodGrad.addColorStop(1, '#4a2f13');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(px1, ptop, pw, ph);
  
  const woodGrad2 = ctx.createLinearGradient(px2, 0, px2 + pw, 0);
  woodGrad2.addColorStop(0, '#8b5a2b');
  woodGrad2.addColorStop(0.5, '#6b4c35');
  woodGrad2.addColorStop(1, '#4a2f13');
  ctx.fillStyle = woodGrad2;
  ctx.fillRect(px2, ptop, pw, ph);

  // Cross beam
  ctx.fillStyle = '#5a3d28';
  ctx.fillRect(w * 0.14, h * 0.34, w * 0.66, h * 0.08);

  // Shields mounted on the pillars
  for (const sx of [px1 + pw / 2, px2 + pw / 2]) {
    ctx.fillStyle = pal.roof;
    ctx.beginPath();
    ctx.arc(sx, h * 0.52, Math.max(0.1, scale * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2;
    ctx.stroke();
    // shield boss
    ctx.fillStyle = pal.metal || '#aaa';
    ctx.beginPath();
    ctx.arc(sx, h * 0.52, Math.max(0.1, scale * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }

  // Central Fire Pit
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.84, Math.max(0.1, w * 0.16), Math.max(0.1, h * 0.06), 0, 0, Math.PI * 2);
  ctx.fill();

  // Bonfire flames
  const time = Date.now() * 0.015;
  for (let i = 0; i < 3; i++) {
    const fR = Math.max(0.1, scale * (0.12 + Math.sin(time + i) * 0.03));
    const fx = w / 2 + Math.sin(time + i * 2) * scale * 0.08;
    const fy = h * 0.74 + Math.cos(time + i) * scale * 0.04;
    ctx.fillStyle = i === 0 ? '#ff4500' : i === 1 ? '#ff8c00' : '#ffd700';
    ctx.beginPath();
    ctx.arc(fx, fy, fR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrove(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  void pal;
  // Oak trunks
  ctx.fillStyle = '#4a2f13';
  ctx.fillRect(w * 0.25, h * 0.55, w * 0.14, h * 0.43);
  ctx.fillRect(w * 0.55, h * 0.5, w * 0.16, h * 0.48);

  // Large dense leafy canopies
  const time = Date.now() * 0.002;
  const wind1 = Math.sin(time) * 4;
  const wind2 = Math.cos(time) * 3;

  ctx.fillStyle = '#1d532b'; // dark forest green
  ctx.beginPath();
  ctx.arc(w * 0.32 + wind1, h * 0.45, w * 0.3, 0, Math.PI * 2);
  ctx.arc(w * 0.62 + wind2, h * 0.38, w * 0.34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2d7a3f'; // lighter highlight canopy
  ctx.beginPath();
  ctx.arc(w * 0.32 + wind1 - scale * 0.08, h * 0.45 - scale * 0.08, w * 0.24, 0, Math.PI * 2);
  ctx.arc(w * 0.62 + wind2 - scale * 0.08, h * 0.38 - scale * 0.08, w * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Runestones on the ground
  ctx.fillStyle = '#8a8d94';
  ctx.fillRect(w * 0.16, h * 0.85, w * 0.08, h * 0.12);
  // Celtic blue glowing moss details
  ctx.fillStyle = '#00ffcc';
  ctx.shadowColor = '#00ffcc';
  ctx.shadowBlur = 6;
  ctx.fillRect(w * 0.18, h * 0.88, 2, 6);
  ctx.shadowBlur = 0;
}

function drawStoneCircle(ctx: CanvasRenderingContext2D, w: number, h: number, pal: CivPalette, scale: number): void {
  void pal;
  void scale;
  // Earth mound base
  ctx.fillStyle = '#485e3d';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.94, Math.max(0.1, w * 0.45), Math.max(0.1, h * 0.1), 0, 0, Math.PI * 2);
  ctx.fill();

  // Arranged 3D stone monoliths
  const positions = [
    { x: w * 0.16, y: h * 0.62, wd: w * 0.12, ht: h * 0.34 },
    { x: w * 0.35, y: h * 0.52, wd: w * 0.14, ht: h * 0.42 },
    { x: w * 0.58, y: h * 0.54, wd: w * 0.13, ht: h * 0.4 },
    { x: w * 0.76, y: h * 0.64, wd: w * 0.12, ht: h * 0.32 }
  ];

  positions.forEach((pos) => {
    const finalHt = pos.ht;
    
    // Stone side panel (3D shadow)
    ctx.fillStyle = '#5c5e63';
    ctx.beginPath();
    ctx.moveTo(pos.x + pos.wd, pos.y);
    ctx.lineTo(pos.x + pos.wd + w * 0.04, pos.y - w * 0.02);
    ctx.lineTo(pos.x + pos.wd + w * 0.04, pos.y + finalHt - w * 0.02);
    ctx.lineTo(pos.x + pos.wd, pos.y + finalHt);
    ctx.closePath();
    ctx.fill();

    // Stone front panel
    ctx.fillStyle = '#7a7d84';
    ctx.fillRect(pos.x, pos.y, pos.wd, finalHt);

    // Carved glowing runes on front
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 5;
    ctx.fillRect(pos.x + pos.wd * 0.4, pos.y + finalHt * 0.3, 2, 8);
    ctx.shadowBlur = 0;
  });
}
