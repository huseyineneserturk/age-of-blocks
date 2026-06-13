// Renderer: pre-renders the static terrain to an offscreen canvas once, then
// each frame blits the visible region via the camera and draws dynamic
// entities (units, selection, command markers) on top. v1 color identity.

import { Camera, TILE } from '../engine/camera';
import { Terrain, TileMap } from '../engine/grid';
import { TEAM_COLORS } from '../data/units';
import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { CIVS, type CivId } from '../data/civs';
import type { SelectRect } from '../engine/input';
import type { Building, Projectile, RockEntity, Unit, World } from '../game/world';
import { isHiddenFrom } from '../game/combat';
import { FOG_EXPLORED, FOG_UNEXPLORED, type FogOfWar } from '../game/fog';
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
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogImage: ImageData;
  private markers: MoveMarker[] = [];

  constructor(
    private ctx: CanvasRenderingContext2D,
    map: TileMap,
  ) {
    this.terrainCanvas = document.createElement('canvas');
    this.renderTerrain(map);
    // 1px-per-tile fog canvas, scaled up with smoothing for soft edges.
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = map.w;
    this.fogCanvas.height = map.h;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.fogImage = this.fogCtx.createImageData(map.w, map.h);
  }

  /** Get the pre-rendered terrain for the minimap. */
  get terrain(): HTMLCanvasElement {
    return this.terrainCanvas;
  }

  /** Rebuild the fog overlay pixels from the fog grid. */
  updateFog(fog: FogOfWar): void {
    const d = this.fogImage.data;
    for (let i = 0; i < fog.state.length; i++) {
      const s = fog.state[i];
      d[i * 4] = 6;
      d[i * 4 + 1] = 8;
      d[i * 4 + 2] = 14;
      d[i * 4 + 3] = s === FOG_UNEXPLORED ? 245 : s === FOG_EXPLORED ? 120 : 0;
    }
    this.fogCtx.putImageData(this.fogImage, 0, 0);
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
        // 4-tone patchwork
        c.fillStyle = h > 0.75 ? COLORS.grassLight : h > 0.45 ? COLORS.grass : h > 0.2 ? '#1b452a' : COLORS.grassDark;
        c.fillRect(px, py, TILE, TILE);
        // grass blade tufts
        const h2 = tileHash(x * 5 + 1, y * 3 + 2);
        if (h2 > 0.55) {
          c.strokeStyle = 'rgba(120, 170, 90, 0.35)';
          c.lineWidth = 1;
          const gx = px + 5 + h2 * (TILE - 12);
          const gy = py + 6 + h * (TILE - 12);
          c.beginPath();
          c.moveTo(gx, gy + 4);
          c.lineTo(gx - 2, gy - 2);
          c.moveTo(gx + 2, gy + 4);
          c.lineTo(gx + 3, gy - 2);
          c.stroke();
        }
        // occasional tiny flowers / pebbles
        if (h > 0.93) {
          c.fillStyle = '#d8d06a';
          c.fillRect(px + h2 * (TILE - 6) + 2, py + h * (TILE - 8), 2.5, 2.5);
        } else if (h < 0.05) {
          c.fillStyle = 'rgba(160,160,170,0.4)';
          c.beginPath();
          c.ellipse(px + TILE * 0.5 + (h2 - 0.5) * 10, py + TILE * 0.6, 3, 2, 0, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case Terrain.Forest: {
        c.fillStyle = COLORS.forest;
        c.fillRect(px, py, TILE, TILE);
        // 2 deterministic trees per tile, with ground shadows
        for (let i = 0; i < 2; i++) {
          const hx = tileHash(x * 3 + i, y * 7 + i);
          const tx = px + 6 + hx * (TILE - 14);
          const ty = py + 6 + tileHash(y * 5 + i, x * 11) * (TILE - 14);
          const r = 5 + hx * 4;
          // shadow
          c.fillStyle = 'rgba(0,0,0,0.3)';
          c.beginPath();
          c.ellipse(tx + r * 0.25, ty + r * 1.05, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
          c.fill();
          // trunk
          c.fillStyle = '#3d2c1a';
          c.fillRect(tx + r * 0.28, ty + r * 0.4, r * 0.22, r * 0.6);
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
          // canopy highlight
          c.fillStyle = 'rgba(120, 200, 120, 0.18)';
          c.beginPath();
          c.moveTo(tx - r * 0.15, ty + r * 0.1);
          c.lineTo(tx + r * 0.12, ty + r * 0.1);
          c.lineTo(tx, ty - r * 0.8);
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
        // depth-varied blue + double wave + sparkle
        const deep = h > 0.5 ? COLORS.water : '#142f4e';
        c.fillStyle = deep;
        c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = COLORS.waterLight;
        c.lineWidth = 1.5;
        const wy = py + TILE * (0.25 + h * 0.35);
        c.beginPath();
        c.moveTo(px + 4, wy);
        c.quadraticCurveTo(px + TILE / 2, wy - 3, px + TILE - 4, wy);
        c.stroke();
        c.strokeStyle = 'rgba(120, 170, 220, 0.35)';
        c.beginPath();
        c.moveTo(px + 7, wy + TILE * 0.32);
        c.quadraticCurveTo(px + TILE / 2, wy + TILE * 0.32 - 2.5, px + TILE - 7, wy + TILE * 0.32);
        c.stroke();
        if (h > 0.85) {
          c.fillStyle = 'rgba(200, 230, 255, 0.6)';
          c.fillRect(px + h * (TILE - 8) + 2, py + (1 - h) * (TILE - 8) + 2, 2, 2);
        }
        break;
      }
      case Terrain.Bridge: {
        // wooden planks + side rails
        c.fillStyle = COLORS.bridge;
        c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = COLORS.bridgeDark;
        c.lineWidth = 1.5;
        for (let i = 1; i < 4; i++) {
          c.beginPath();
          c.moveTo(px + (TILE / 4) * i, py);
          c.lineTo(px + (TILE / 4) * i + 1, py + TILE);
          c.stroke();
        }
        // plank grain
        c.strokeStyle = 'rgba(60, 40, 20, 0.25)';
        c.beginPath();
        c.moveTo(px, py + TILE * (0.3 + h * 0.4));
        c.lineTo(px + TILE, py + TILE * (0.3 + h * 0.4));
        c.stroke();
        // rails along the water edge (top/bottom of the bridge band)
        const above = map.inBounds(x, y - 1) && map.get(x, y - 1) === Terrain.Water;
        const below = map.inBounds(x, y + 1) && map.get(x, y + 1) === Terrain.Water;
        c.fillStyle = '#4e3315';
        if (above) c.fillRect(px, py, TILE, 3.5);
        if (below) c.fillRect(px, py + TILE - 3.5, TILE, 3.5);
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
    fog: FogOfWar,
    myTeam: 0 | 1 = 0,
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
      // Enemy buildings appear once their ground has been explored.
      if (b.team !== myTeam && !fog.isExplored(b.x + b.w / 2, b.y + b.h / 2)) continue;
      this.drawBuilding(ctx, camera, b, b.id === selectedBuildingId, world.civOf(b.team)?.id);
    }

    // --- Cracked rocks (destructible) ---
    for (const r of world.rocks) {
      this.drawRock(ctx, camera, r);
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
    // Forest ambush from the player's perspective: hidden enemies are not
    // drawn; the player's own units inside forests render semi-transparent.
    const sorted = [...world.units].sort((a, b) => a.y - b.y);
    for (const u of sorted) {
      if (u.team !== myTeam && isHiddenFrom(world, u, myTeam)) continue;
      if (u.team !== myTeam && !fog.isVisible(u.x, u.y)) continue; // fog of war
      const inForest = world.map.get(Math.floor(u.x), Math.floor(u.y)) === Terrain.Forest;
      if (inForest) ctx.globalAlpha = 0.55;
      this.drawUnit(ctx, camera, u, selected.has(u.id), alpha, world.civOf(u.team)?.id);
      ctx.globalAlpha = 1;
    }

    // --- Projectiles ---
    for (const pr of world.projectiles) {
      if (pr.team !== myTeam && !fog.isVisible(pr.x, pr.y)) continue;
      this.drawProjectile(ctx, camera, pr);
    }

    // --- Effects (particles) ---
    effects.update(dt);
    effects.render(ctx, camera);

    // --- Fog overlay (soft-scaled 1px/tile canvas) ---
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.fogCanvas,
      tl.x,
      tl.y,
      w / camera.scale,
      h / camera.scale,
      0,
      0,
      w,
      h,
    );
    ctx.restore();

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

  private drawBuilding(ctx: CanvasRenderingContext2D, camera: Camera, b: Building, isSelected: boolean, civ?: CivId): void {
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

    // Civilization architecture (roofs/crests) — skip walls, they are plain.
    if (civ && b.kind !== 'wall' && b.buildProgress >= 1) {
      this.drawCivRoof(ctx, civ, p0.x + pad, p0.y + pad, wpx - pad * 2, hpx - pad * 2, b.kind === 'castle', camera.scale);
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

  /** Civilization rooflines: each civ's base reads differently at a glance. */
  private drawCivRoof(
    ctx: CanvasRenderingContext2D,
    civ: CivId,
    x: number,
    y: number,
    w: number,
    h: number,
    isCastle: boolean,
    scale: number,
  ): void {
    const accent = CIVS[civ].accent;
    const cx = x + w / 2;

    switch (civ) {
      case 'ottoman': {
        // Dome with a crescent finial.
        const r = Math.min(w * 0.28, scale * 0.5);
        ctx.fillStyle = '#d8dde6';
        ctx.beginPath();
        ctx.arc(cx, y + 1, r, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1, scale * 0.04);
        ctx.stroke();
        if (isCastle) {
          ctx.strokeStyle = '#f1ece0';
          ctx.lineWidth = Math.max(1.5, scale * 0.06);
          ctx.beginPath();
          ctx.arc(cx + r * 0.12, y - r - scale * 0.18, scale * 0.14, Math.PI * 0.35, Math.PI * 1.65);
          ctx.stroke();
        }
        break;
      }
      case 'china': {
        // Curved pagoda eaves (double for the castle).
        const layers = isCastle ? 2 : 1;
        for (let i = 0; i < layers; i++) {
          const yy = y - i * scale * 0.22;
          const ww = w * (1 - i * 0.22);
          ctx.fillStyle = '#8f1d1d';
          ctx.beginPath();
          ctx.moveTo(cx - ww / 2 - scale * 0.1, yy + scale * 0.1);
          ctx.quadraticCurveTo(cx, yy - scale * 0.34, cx + ww / 2 + scale * 0.1, yy + scale * 0.1);
          ctx.quadraticCurveTo(cx, yy - scale * 0.1, cx - ww / 2 - scale * 0.1, yy + scale * 0.1);
          ctx.fill();
        }
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.arc(cx, y - (layers - 1) * scale * 0.22 - scale * 0.3, scale * 0.07, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rome': {
        // Stone pediment + column hints on the castle.
        ctx.fillStyle = '#cfc9bb';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.08, y + 2);
        ctx.lineTo(cx, y - scale * 0.32);
        ctx.lineTo(x + w * 0.92, y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#8f8878';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (isCastle) {
          ctx.fillStyle = 'rgba(207, 201, 187, 0.5)';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + w * (0.25 + i * 0.25) - scale * 0.04, y + h * 0.25, scale * 0.08, h * 0.5);
          }
        }
        break;
      }
      case 'viking': {
        // Steep timber gable with crossed beams.
        ctx.fillStyle = '#54422f';
        ctx.beginPath();
        ctx.moveTo(x - scale * 0.06, y + scale * 0.12);
        ctx.lineTo(cx, y - scale * 0.38);
        ctx.lineTo(x + w + scale * 0.06, y + scale * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#33261a';
        ctx.lineWidth = Math.max(1, scale * 0.05);
        ctx.beginPath();
        ctx.moveTo(cx - scale * 0.16, y - scale * 0.42);
        ctx.lineTo(cx + scale * 0.1, y - scale * 0.16);
        ctx.moveTo(cx + scale * 0.16, y - scale * 0.42);
        ctx.lineTo(cx - scale * 0.1, y - scale * 0.16);
        ctx.stroke();
        break;
      }
      case 'celt': {
        // Thatched round roof + standing-stone hint for the castle.
        ctx.fillStyle = '#b09a4e';
        ctx.beginPath();
        ctx.arc(cx, y + 2, w * 0.42, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8a763a';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(cx, y + 2, w * 0.42 * (i / 3), Math.PI, Math.PI * 2);
          ctx.stroke();
        }
        if (isCastle) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const a0 = (k / 3) * Math.PI * 2;
            ctx.moveTo(cx, y - w * 0.2);
            ctx.arc(cx + Math.cos(a0) * scale * 0.08, y - w * 0.2 + Math.sin(a0) * scale * 0.08, scale * 0.08, a0 + Math.PI, a0 + Math.PI * 1.7);
          }
          ctx.strokeStyle = COLORS.gold;
          ctx.lineWidth = Math.max(1, scale * 0.035);
          ctx.stroke();
        }
        break;
      }
    }
  }

  private drawRock(ctx: CanvasRenderingContext2D, camera: Camera, r: RockEntity): void {
    const p = camera.worldToScreen(r.x + 0.5, r.y + 0.5);
    const s = camera.scale;
    if (p.x < -s || p.y < -s || p.x > camera.viewW + s || p.y > camera.viewH + s) return;

    // Boulder
    ctx.fillStyle = COLORS.rock;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.08, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.rockDark;
    ctx.beginPath();
    ctx.ellipse(p.x - s * 0.14, p.y - s * 0.06, s * 0.16, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // cracks — these rocks are breakable, show it
    ctx.strokeStyle = '#2c2e33';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.05, p.y - s * 0.26);
    ctx.lineTo(p.x + s * 0.08, p.y);
    ctx.lineTo(p.x - s * 0.1, p.y + s * 0.22);
    ctx.moveTo(p.x + 0.08 * s, p.y);
    ctx.lineTo(p.x + s * 0.28, p.y + s * 0.1);
    ctx.stroke();

    // HP bar when damaged
    if (r.hp < r.maxHp) {
      const bw = s * 0.8;
      const frac = Math.max(0, r.hp / r.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p.x - bw / 2, p.y - s * 0.55, bw, 4);
      ctx.fillStyle = '#d0c060';
      ctx.fillRect(p.x - bw / 2, p.y - s * 0.55, bw * frac, 4);
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

  private drawUnit(ctx: CanvasRenderingContext2D, camera: Camera, u: Unit, isSelected: boolean, alpha: number, civ?: CivId): void {
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
    drawFigure(ctx, u.kind, s, tc.main, tc.dark, walk, u.attacking ? 1 : 0, civ);
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
