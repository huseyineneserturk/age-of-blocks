// Renderer: pre-renders the static terrain to an offscreen canvas once, then
// each frame blits the visible region via the camera and draws dynamic
// entities (units, selection, command markers) on top. v1 color identity.

import { Camera, TILE } from '../engine/camera';
import { Terrain, TileMap } from '../engine/grid';
import { TEAM_COLORS } from '../data/units';
import { BUILDINGS, type BuildingKind } from '../data/buildings';
import type { SelectRect } from '../engine/input';
import type { Building, Projectile, Unit, World } from '../game/world';
import { drawFigure } from './figures';
import type { Effects } from './effects';

export interface PlacementGhost {
  kind: BuildingKind;
  tileX: number;
  tileY: number;
  valid: boolean;
}

interface MoveMarker {
  x: number;
  y: number;
  age: number;
  color: string;
}

const COLORS = {
  grass: '#1f4d2e',
  grassLight: '#2d5a3a',
  grassDark: '#16381f',
  forest: '#143820',
  tree: '#0f5c2e',
  treeDark: '#0a3f20',
  hill: '#4f6b3a',
  hillLight: '#647f49',
  water: '#173a5e',
  waterLight: '#1f4d7a',
  bridge: '#9b6a3a',
  bridgeDark: '#6e4a26',
  rock: '#5c5e66',
  rockDark: '#43454c',
  goldNode: '#b8962e',
  gold: '#ffd700',
};

function tileHash(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export class Renderer {
  private terrainCanvas: HTMLCanvasElement;
  private markers: MoveMarker[] = [];

  constructor(
    private ctx: CanvasRenderingContext2D,
    map: TileMap,
  ) {
    this.terrainCanvas = document.createElement('canvas');
    this.renderTerrain(map);
  }

  addMoveMarker(wx: number, wy: number, color = '#ffd700'): void {
    this.markers.push({ x: wx, y: wy, age: 0, color });
  }

  /** Pre-render full terrain at TILE px per tile. Call again if map changes. */
  renderTerrain(map: TileMap): void {
    const tc = this.terrainCanvas;
    tc.width = map.w * TILE;
    tc.height = map.h * TILE;
    const c = tc.getContext('2d')!;

    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        this.drawTile(c, map, x, y);
      }
    }
  }

  private drawTile(c: CanvasRenderingContext2D, map: TileMap, x: number, y: number): void {
    const t = map.get(x, y);
    const px = x * TILE;
    const py = y * TILE;
    const h = tileHash(x, y);

    switch (t) {
      case Terrain.Grass: {
        c.fillStyle = h > 0.66 ? COLORS.grassLight : h > 0.33 ? COLORS.grass : COLORS.grassDark;
        c.fillRect(px, py, TILE, TILE);
        if (h > 0.92) {
          c.fillStyle = 'rgba(255,255,255,0.05)';
          c.beginPath();
          c.arc(px + h * TILE, py + (1 - h) * TILE, 2.5, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case Terrain.Forest: {
        c.fillStyle = COLORS.forest;
        c.fillRect(px, py, TILE, TILE);
        // 2 deterministic trees per tile
        for (let i = 0; i < 2; i++) {
          const hx = tileHash(x * 3 + i, y * 7 + i);
          const tx = px + 6 + hx * (TILE - 14);
          const ty = py + 6 + tileHash(y * 5 + i, x * 11) * (TILE - 14);
          const r = 5 + hx * 4;
          c.fillStyle = COLORS.treeDark;
          c.beginPath();
          c.moveTo(tx, ty + r);
          c.lineTo(tx + r * 0.8, ty + r);
          c.lineTo(tx + r * 0.4, ty - r);
          c.closePath();
          c.fill();
          c.fillStyle = COLORS.tree;
          c.beginPath();
          c.moveTo(tx - r * 0.4, ty + r);
          c.lineTo(tx + r * 0.4, ty + r);
          c.lineTo(tx, ty - r);
          c.closePath();
          c.fill();
        }
        break;
      }
      case Terrain.Hill: {
        c.fillStyle = COLORS.hill;
        c.fillRect(px, py, TILE, TILE);
        c.fillStyle = COLORS.hillLight;
        c.beginPath();
        c.moveTo(px, py + TILE);
        c.lineTo(px + TILE * 0.5, py + TILE * 0.25);
        c.lineTo(px + TILE, py + TILE);
        c.closePath();
        c.fill();
        break;
      }
      case Terrain.Water: {
        c.fillStyle = COLORS.water;
        c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = COLORS.waterLight;
        c.lineWidth = 1.5;
        c.beginPath();
        const wy = py + TILE * (0.3 + h * 0.4);
        c.moveTo(px + 4, wy);
        c.quadraticCurveTo(px + TILE / 2, wy - 3, px + TILE - 4, wy);
        c.stroke();
        break;
      }
      case Terrain.Bridge: {
        c.fillStyle = COLORS.bridge;
        c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = COLORS.bridgeDark;
        c.lineWidth = 1.5;
        for (let i = 1; i < 4; i++) {
          c.beginPath();
          c.moveTo(px + (TILE / 4) * i, py);
          c.lineTo(px + (TILE / 4) * i, py + TILE);
          c.stroke();
        }
        break;
      }
      case Terrain.Rock: {
        c.fillStyle = COLORS.grassDark;
        c.fillRect(px, py, TILE, TILE);
        c.fillStyle = COLORS.rock;
        c.beginPath();
        c.ellipse(px + TILE / 2, py + TILE * 0.58, TILE * 0.38, TILE * 0.3, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = COLORS.rockDark;
        c.beginPath();
        c.ellipse(px + TILE * 0.35, py + TILE * 0.45, TILE * 0.16, TILE * 0.12, 0, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case Terrain.Gold: {
        c.fillStyle = COLORS.grassDark;
        c.fillRect(px, py, TILE, TILE);
        c.fillStyle = COLORS.rockDark;
        c.beginPath();
        c.ellipse(px + TILE / 2, py + TILE * 0.58, TILE * 0.36, TILE * 0.28, 0, 0, Math.PI * 2);
        c.fill();
        // gold glints
        c.fillStyle = COLORS.gold;
        for (let i = 0; i < 3; i++) {
          const gx = px + 8 + tileHash(x + i, y - i) * (TILE - 16);
          const gy = py + 12 + tileHash(y + i * 3, x) * (TILE - 20);
          c.fillRect(gx, gy, 3.5, 3.5);
        }
        break;
      }
    }
  }

  render(
    world: World,
    camera: Camera,
    selected: Set<number>,
    selectedBuildingId: number | null,
    ghost: PlacementGhost | null,
    dragRect: SelectRect | null,
    alpha: number,
    dt: number,
    effects: Effects,
  ): void {
    const ctx = this.ctx;
    const w = camera.viewW;
    const h = camera.viewH;

    ctx.fillStyle = '#0b0e16';
    ctx.fillRect(0, 0, w, h);

    // --- Terrain blit ---
    const tl = camera.screenToWorld(0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = camera.zoom < 1;
    ctx.drawImage(
      this.terrainCanvas,
      tl.x * TILE,
      tl.y * TILE,
      w / camera.zoom,
      h / camera.zoom,
      0,
      0,
      w,
      h,
    );
    ctx.restore();

    // --- Move markers ---
    for (const m of this.markers) {
      m.age += dt;
      const p = camera.worldToScreen(m.x, m.y);
      const t = m.age / 0.45;
      if (t >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - t) * 16 + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.markers = this.markers.filter((m) => m.age < 0.45);

    // --- Buildings (under units) ---
    for (const b of world.buildings) {
      this.drawBuilding(ctx, camera, b, b.id === selectedBuildingId);
    }

    // --- Placement ghost ---
    if (ghost) {
      const def = BUILDINGS[ghost.kind];
      const p0 = camera.worldToScreen(ghost.tileX, ghost.tileY);
      const wpx = def.w * camera.scale;
      const hpx = def.h * camera.scale;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ghost.valid ? '#5fe07a' : '#ff6a6a';
      ctx.fillRect(p0.x, p0.y, wpx, hpx);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ghost.valid ? '#2bd47a' : '#ff4a4a';
      ctx.lineWidth = 2;
      ctx.strokeRect(p0.x, p0.y, wpx, hpx);
      ctx.font = `${camera.scale * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, p0.x + wpx / 2, p0.y + hpx / 2);
    }

    // --- Units (y-sorted for painter's order) ---
    const sorted = [...world.units].sort((a, b) => a.y - b.y);
    for (const u of sorted) {
      this.drawUnit(ctx, camera, u, selected.has(u.id), alpha);
    }

    // --- Projectiles ---
    for (const pr of world.projectiles) {
      this.drawProjectile(ctx, camera, pr);
    }

    // --- Effects (particles) ---
    effects.update(dt);
    effects.render(ctx, camera);

    // --- Drag selection rect (screen space) ---
    if (dragRect) {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
      const rw = dragRect.x1 - dragRect.x0;
      const rh = dragRect.y1 - dragRect.y0;
      ctx.fillRect(dragRect.x0, dragRect.y0, rw, rh);
      ctx.strokeRect(dragRect.x0, dragRect.y0, rw, rh);
    }
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, camera: Camera, b: Building, isSelected: boolean): void {
    const def = BUILDINGS[b.kind];
    const p0 = camera.worldToScreen(b.x, b.y);
    const wpx = b.w * camera.scale;
    const hpx = b.h * camera.scale;
    if (p0.x > camera.viewW + 40 || p0.y > camera.viewH + 40 || p0.x + wpx < -40 || p0.y + hpx < -40) return;

    const tc = TEAM_COLORS[b.team];
    const pad = camera.scale * 0.06;

    // Shadow + body
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(p0.x + pad * 2, p0.y + pad * 2, wpx - pad * 2, hpx - pad * 2);
    const grad = ctx.createLinearGradient(p0.x, p0.y, p0.x, p0.y + hpx);
    grad.addColorStop(0, tc.main);
    grad.addColorStop(1, tc.dark);
    ctx.fillStyle = grad;
    ctx.fillRect(p0.x + pad, p0.y + pad, wpx - pad * 2, hpx - pad * 2);
    ctx.strokeStyle = isSelected ? COLORS.gold : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeRect(p0.x + pad, p0.y + pad, wpx - pad * 2, hpx - pad * 2);

    // Castle battlements
    if (b.kind === 'castle') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      const teeth = 6;
      for (let i = 0; i < teeth; i++) {
        ctx.fillRect(p0.x + pad + (i * (wpx - pad * 2)) / teeth, p0.y + pad, (wpx - pad * 2) / (teeth * 2), camera.scale * 0.18);
      }
    }

    // Icon
    ctx.font = `${Math.min(wpx, hpx) * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = b.buildProgress < 1 ? 0.45 : 1;
    ctx.fillText(def.icon, p0.x + wpx / 2, p0.y + hpx / 2);
    ctx.globalAlpha = 1;

    // Construction overlay (fills bottom-up)
    if (b.buildProgress < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const remaining = (1 - b.buildProgress) * (hpx - pad * 2);
      ctx.fillRect(p0.x + pad, p0.y + pad, wpx - pad * 2, remaining);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(p0.x + pad, p0.y + hpx - pad - 3, (wpx - pad * 2) * b.buildProgress, 3);
    }

    // Production progress bar
    if (b.queue.length > 0 && b.buildProgress >= 1) {
      const total = b.queue.length;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p0.x + pad, p0.y + hpx - pad - 4, wpx - pad * 2, 4);
      ctx.fillStyle = '#5fd0ff';
      // trainProgress fraction is shown by hud; here a subtle pulsing strip per queued count
      ctx.fillRect(p0.x + pad, p0.y + hpx - pad - 4, (wpx - pad * 2) * Math.min(1, total / 5), 4);
    }

    // HP bar
    if (b.hp < b.maxHp) {
      const frac = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p0.x + pad, p0.y - 7, wpx - pad * 2, 5);
      ctx.fillStyle = frac > 0.6 ? '#32cd32' : frac > 0.3 ? '#ffa500' : '#ff4444';
      ctx.fillRect(p0.x + pad, p0.y - 7, (wpx - pad * 2) * frac, 5);
    }

    // Rally flag for the selected building
    if (isSelected && b.rallyX !== null && b.rallyY !== null) {
      const rp = camera.worldToScreen(b.rallyX, b.rallyY);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const c = camera.worldToScreen(b.x + b.w / 2, b.y + b.h / 2);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(rp.x, rp.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${camera.scale * 0.7}px serif`;
      ctx.fillText('🚩', rp.x, rp.y);
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, camera: Camera, pr: Projectile): void {
    const p = camera.worldToScreen(pr.x, pr.y);
    if (p.x < -40 || p.y < -40 || p.x > camera.viewW + 40 || p.y > camera.viewH + 40) return;
    const z = camera.zoom;

    if (pr.kind === 'arrow') {
      const angle = Math.atan2(pr.ty - pr.sy, pr.tx - pr.sx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.fillStyle = pr.team === 0 ? '#bcd6ff' : '#ffc9c9';
      ctx.shadowColor = TEAM_COLORS[pr.team].main;
      ctx.shadowBlur = 6;
      ctx.fillRect(-7 * z, -1.2 * z, 14 * z, 2.4 * z);
      ctx.beginPath();
      ctx.moveTo(8 * z, 0);
      ctx.lineTo(4 * z, -3 * z);
      ctx.lineTo(4 * z, 3 * z);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // Boulder with a lobbed arc.
      const arcY = -Math.sin(Math.min(1, pr.progress) * Math.PI) * 1.4 * camera.scale;
      ctx.save();
      ctx.translate(p.x, p.y + arcY);
      ctx.rotate(pr.progress * 14);
      ctx.shadowColor = '#ff7a00';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#5a4636';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const r = (8 + (k % 2 ? -2.2 : 1.4)) * z;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      // landing shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6 * z, 2.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, camera: Camera, u: Unit, isSelected: boolean, alpha: number): void {
    const wx = u.prevX + (u.x - u.prevX) * alpha;
    const wy = u.prevY + (u.y - u.prevY) * alpha;
    const p = camera.worldToScreen(wx, wy);
    const s = camera.scale * 0.42;

    // Cull offscreen
    if (p.x < -60 || p.y < -60 || p.x > camera.viewW + 60 || p.y > camera.viewH + 60) return;

    const tc = TEAM_COLORS[u.team];

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + s * 0.85, s * 0.95, s * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.92, s * 0.7, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    const walk = u.moving ? Math.sin(u.animTime * 11) : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(u.facing, 1);
    if (u.attacking) {
      ctx.shadowColor = tc.glow;
      ctx.shadowBlur = 10;
    }
    drawFigure(ctx, u.kind, s, tc.main, tc.dark, walk, u.attacking ? 1 : 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // HP bar (only when damaged)
    if (u.hp < u.maxHp) {
      const bw = s * 1.6;
      const frac = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p.x - bw / 2, p.y - s * 1.45, bw, 4);
      ctx.fillStyle = frac > 0.6 ? '#32cd32' : frac > 0.3 ? '#ffa500' : '#ff4444';
      ctx.fillRect(p.x - bw / 2, p.y - s * 1.45, bw * frac, 4);
    }
  }
}
