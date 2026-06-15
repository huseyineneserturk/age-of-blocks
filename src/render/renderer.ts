// Renderer: pre-renders the static terrain to an offscreen canvas once, then
// each frame blits the visible region via the camera and draws dynamic
// entities (units, selection, command markers) on top. v1 color identity.

import { Camera, TILE } from '../engine/camera';
import { Terrain, TileMap } from '../engine/grid';
import { TEAM_COLORS } from '../data/units';
import { BUILDINGS, type BuildingKind } from '../data/buildings';
import type { CivId } from '../data/civs';
import type { SelectRect } from '../engine/input';
import type { Building, Projectile, RockEntity, Unit, World } from '../game/world';
import { isHiddenFrom } from '../game/combat';
import { FOG_EXPLORED, FOG_UNEXPLORED, type FogOfWar } from '../game/fog';
import { drawFigure } from './figures';
import { drawStructure } from './buildings';
import type { Effects } from './effects';

export interface PlacementGhost {
  kind: BuildingKind;
  tileX: number;
  tileY: number;
  valid: boolean;
  extraWalls?: { tileX: number; tileY: number; valid: boolean }[];
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
    // Decorative prop pass: bushes / flower patches scattered on open grass.
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.get(x, y) !== Terrain.Grass) continue;
        const r = tileHash(x * 11 + 7, y * 13 + 3);
        if (r > 0.93) this.drawBush(c, x * TILE, y * TILE, tileHash(x + 2, y + 5));
        else if (r > 0.86) this.drawFlowers(c, x * TILE, y * TILE, tileHash(x + 9, y + 1));
      }
    }
  }

  private drawBush(c: CanvasRenderingContext2D, px: number, py: number, hh: number): void {
    const cx = px + TILE * (0.3 + hh * 0.4);
    const cy = py + TILE * (0.5 + hh * 0.3);
    const r = TILE * (0.16 + hh * 0.1);
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath();
    c.ellipse(cx, cy + r * 0.7, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1c4a26';
    c.beginPath();
    c.arc(cx - r * 0.5, cy, r * 0.7, 0, Math.PI * 2);
    c.arc(cx + r * 0.5, cy, r * 0.7, 0, Math.PI * 2);
    c.arc(cx, cy - r * 0.4, r * 0.8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(120, 200, 120, 0.18)';
    c.beginPath();
    c.arc(cx, cy - r * 0.5, r * 0.5, 0, Math.PI * 2);
    c.fill();
  }

  private drawFlowers(c: CanvasRenderingContext2D, px: number, py: number, hh: number): void {
    const colors = ['#e8d06a', '#e07a9a', '#d8d0e8'];
    const col = colors[Math.floor(hh * colors.length) % colors.length];
    for (let i = 0; i < 4; i++) {
      const fx = px + TILE * (0.2 + ((i * 0.27 + hh) % 0.6));
      const fy = py + TILE * (0.3 + ((i * 0.19 + hh * 1.3) % 0.5));
      c.fillStyle = col;
      c.beginPath();
      c.arc(fx, fy, 1.8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(fx - 0.5, fy - 0.5, 1, 1);
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
        
        // grass bevels/shading for subtle 3D grid texture
        c.fillStyle = 'rgba(255,255,255,0.06)'; // highlight top-left
        c.fillRect(px, py, TILE, 1);
        c.fillRect(px, py, 1, TILE);
        c.fillStyle = 'rgba(0,0,0,0.1)'; // shadow bottom-right
        c.fillRect(px, py + TILE - 1, TILE, 1);
        c.fillRect(px + TILE - 1, py, 1, TILE);

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
        // 2 deterministic layered pine trees per tile, with ground shadows
        for (let i = 0; i < 2; i++) {
          const hx = tileHash(x * 3 + i, y * 7 + i);
          const tx = px + 6 + hx * (TILE - 14);
          const ty = py + 6 + tileHash(y * 5 + i, x * 11) * (TILE - 14);
          const r = 5 + hx * 4;
          // shadow
          c.fillStyle = 'rgba(0,0,0,0.35)';
          c.beginPath();
          c.ellipse(tx + r * 0.25, ty + r * 1.05, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
          c.fill();
          // trunk
          c.fillStyle = '#3d2c1a';
          c.fillRect(tx + r * 0.28, ty + r * 0.4, r * 0.22, r * 0.6);
          
          // Layered pine tree branches: 3 stacked triangles (canopies)
          // Bottom canopy
          c.fillStyle = COLORS.treeDark;
          c.beginPath();
          c.moveTo(tx - r * 0.8, ty + r * 0.5);
          c.lineTo(tx + r * 0.8, ty + r * 0.5);
          c.lineTo(tx, ty - r * 0.3);
          c.closePath();
          c.fill();
          
          // Middle canopy
          c.fillStyle = COLORS.tree;
          c.beginPath();
          c.moveTo(tx - r * 0.6, ty + r * 0.1);
          c.lineTo(tx + r * 0.6, ty + r * 0.1);
          c.lineTo(tx, ty - r * 0.7);
          c.closePath();
          c.fill();
          
          // Top canopy
          c.fillStyle = '#1c753b';
          c.beginPath();
          c.moveTo(tx - r * 0.4, ty - r * 0.3);
          c.lineTo(tx + r * 0.4, ty - r * 0.3);
          c.lineTo(tx, ty - r * 1.1);
          c.closePath();
          c.fill();

          // Highlight
          c.fillStyle = 'rgba(255, 255, 255, 0.14)';
          c.beginPath();
          c.moveTo(tx - r * 0.1, ty - r * 0.3);
          c.lineTo(tx + r * 0.1, ty - r * 0.3);
          c.lineTo(tx, ty - r * 1.1);
          c.closePath();
          c.fill();
        }
        break;
      }
      case Terrain.Hill: {
        // Base grass tile behind hill
        c.fillStyle = COLORS.grass;
        c.fillRect(px, py, TILE, TILE);

        const hx = px + TILE * 0.5;
        const hy = py + TILE * 0.3; // Hill peak

        // Ground shadow
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.beginPath();
        c.ellipse(hx, py + TILE * 0.85, TILE * 0.45, TILE * 0.12, 0, 0, Math.PI * 2);
        c.fill();

        // Left slope (sunlight side)
        c.fillStyle = '#6e8c4e'; // bright moss green
        c.beginPath();
        c.moveTo(px + TILE * 0.15, py + TILE * 0.85);
        c.lineTo(hx, hy);
        c.lineTo(hx, py + TILE * 0.85);
        c.closePath();
        c.fill();

        // Right slope (shadowed side)
        c.fillStyle = '#3f5628'; // dark olive green
        c.beginPath();
        c.moveTo(hx, hy);
        c.lineTo(px + TILE * 0.85, py + TILE * 0.85);
        c.lineTo(hx, py + TILE * 0.85);
        c.closePath();
        c.fill();

        // Rocky peak highlight
        c.fillStyle = '#9bb57b';
        c.beginPath();
        c.moveTo(hx - 2, hy + 3);
        c.lineTo(hx, hy);
        c.lineTo(hx + 2, hy + 3);
        c.closePath();
        c.fill();
        break;
      }
      case Terrain.Water: {
        // depth-varied blue + double wave + sparkle
        const deep = h > 0.5 ? COLORS.water : '#142f4e';
        c.fillStyle = deep;
        c.fillRect(px, py, TILE, TILE);

        // Shoreline sandy border where water meets land
        c.fillStyle = '#c5a059'; // warm shoreline sand
        const checkLand = (tx: number, ty: number) => {
          if (!map.inBounds(tx, ty)) return false;
          const nt = map.get(tx, ty);
          return nt !== Terrain.Water && nt !== Terrain.Bridge;
        };
        if (checkLand(x, y - 1)) c.fillRect(px, py, TILE, 3.5); // top
        if (checkLand(x, y + 1)) c.fillRect(px, py + TILE - 3.5, TILE, 3.5); // bottom
        if (checkLand(x - 1, y)) c.fillRect(px, py, 3.5, TILE); // left
        if (checkLand(x + 1, y)) c.fillRect(px + TILE - 3.5, py, 3.5, TILE); // right

        // Bridge shadows on water
        c.fillStyle = 'rgba(0,0,0,0.45)';
        if (map.inBounds(x, y - 1) && map.get(x, y - 1) === Terrain.Bridge) c.fillRect(px, py, TILE, 6);
        if (map.inBounds(x, y + 1) && map.get(x, y + 1) === Terrain.Bridge) c.fillRect(px, py + TILE - 6, TILE, 6);
        if (map.inBounds(x - 1, y) && map.get(x - 1, y) === Terrain.Bridge) c.fillRect(px, py, 6, TILE);
        if (map.inBounds(x + 1, y) && map.get(x + 1, y) === Terrain.Bridge) c.fillRect(px + TILE - 6, py, 6, TILE);
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

    // --- Animated River waves and sparkles ---
    const bounds = camera.visibleTiles();
    const time = Date.now() * 0.0012; // animation time in seconds
    
    ctx.save();
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        if (world.map.get(x, y) === Terrain.Water) {
          const p = camera.worldToScreen(x, y);
          const size = camera.scale;
          const hHash = tileHash(x, y);
          
          // Draw animated waves!
          ctx.strokeStyle = COLORS.waterLight;
          ctx.lineWidth = 1.5 * camera.zoom;
          
          // Primary wave: drifts horizontally
          const waveSpeed1 = 1.5;
          const wy = p.y + size * (0.25 + hHash * 0.35);
          const dx = ((time * waveSpeed1 + hHash) * size) % (size * 1.5) - (size * 0.25);
          
          ctx.beginPath();
          ctx.moveTo(p.x + dx, wy);
          ctx.quadraticCurveTo(p.x + dx + size * 0.25, wy - 3 * camera.zoom, p.x + dx + size * 0.5, wy);
          
          // Clip to tile boundaries
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x, p.y, size, size);
          ctx.clip();
          ctx.stroke();
          ctx.restore();

          // Secondary wave: drifts slower, in the opposite direction
          ctx.strokeStyle = 'rgba(120, 170, 220, 0.35)';
          const waveSpeed2 = -0.8;
          const wy2 = wy + size * 0.32;
          const dx2 = ((time * waveSpeed2 + hHash * 1.7) * size) % (size * 1.5) - (size * 0.25);
          
          ctx.beginPath();
          ctx.moveTo(p.x + dx2, wy2);
          ctx.quadraticCurveTo(p.x + dx2 + size * 0.25, wy2 - 2.5 * camera.zoom, p.x + dx2 + size * 0.5, wy2);
          
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x, p.y, size, size);
          ctx.clip();
          ctx.stroke();
          ctx.restore();

          // Sparkles: shift position/fade based on time
          if (hHash > 0.82) {
            const opacity = Math.abs(Math.sin(time * 3 + hHash * 10));
            ctx.fillStyle = `rgba(200, 230, 255, ${opacity * 0.65})`;
            const sparkleX = p.x + ((hHash * size * 0.7 + time * size * 0.1) % (size * 0.8)) + size * 0.1;
            const sparkleY = p.y + ((1 - hHash) * size * 0.7 % (size * 0.8)) + size * 0.1;
            ctx.fillRect(sparkleX, sparkleY, 2 * camera.zoom, 2 * camera.zoom);
          }
        }
      }
    }
    ctx.restore();

    // --- Drifting cloud shadows ---
    const cloudT = Date.now() * 0.00003;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const clouds = [
      { x: (cloudT * 40 + 10) % (w + 400) - 200, y: (cloudT * 20 + 50) % (h + 400) - 200, rx: 180, ry: 110 },
      { x: ((cloudT + 0.35) * 40 + 200) % (w + 400) - 200, y: ((cloudT + 0.35) * 20 + 150) % (h + 400) - 200, rx: 250, ry: 150 },
      { x: ((cloudT + 0.7) * 40 + 50) % (w + 400) - 200, y: ((cloudT + 0.7) * 20 + 350) % (h + 400) - 200, rx: 190, ry: 120 }
    ];
    for (const c of clouds) {
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(c.rx, c.ry));
      g.addColorStop(0, 'rgba(10, 20, 40, 0.08)');
      g.addColorStop(0.5, 'rgba(10, 20, 40, 0.04)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
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
      const ghostsToDraw = [{ tileX: ghost.tileX, tileY: ghost.tileY, valid: ghost.valid }];
      if (ghost.extraWalls) {
        for (const extra of ghost.extraWalls) {
          ghostsToDraw.push({ tileX: extra.tileX, tileY: extra.tileY, valid: extra.valid });
        }
      }
      for (const g of ghostsToDraw) {
        const p0 = camera.worldToScreen(g.tileX, g.tileY);
        const wpx = def.w * camera.scale;
        const hpx = def.h * camera.scale;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = g.valid ? '#5fe07a' : '#ff6a6a';
        ctx.fillRect(p0.x, p0.y, wpx, hpx);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g.valid ? '#2bd47a' : '#ff4a4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(p0.x, p0.y, wpx, hpx);
        ctx.font = `${camera.scale * 0.8}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, p0.x + wpx / 2, p0.y + hpx / 2);
      }
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
      this.drawUnit(ctx, camera, u, selected.has(u.id), alpha, world.civOf(u.team)?.id, world);
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
    const p0 = camera.worldToScreen(b.x, b.y);
    const wpx = b.w * camera.scale;
    const hpx = b.h * camera.scale;
    if (p0.x > camera.viewW + 40 || p0.y > camera.viewH + 40 || p0.x + wpx < -40 || p0.y + hpx < -40) return;
    const pad = camera.scale * 0.06;

    // Composite civ structure (walls + roof + team pennant + outline).
    drawStructure(ctx, b.kind, civ ?? 'rome', b.team, p0.x, p0.y, wpx, hpx, camera.scale, {
      selected: isSelected,
      constructing: b.buildProgress < 1,
      progress: b.buildProgress,
    });

    // Production progress bar
    if (b.queue.length > 0 && b.buildProgress >= 1) {
      const total = b.queue.length;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p0.x + pad, p0.y + hpx - pad - 4, wpx - pad * 2, 4);
      ctx.fillStyle = '#5fd0ff';
      ctx.fillRect(p0.x + pad, p0.y + hpx - pad - 4, (wpx - pad * 2) * Math.min(1, total / 5), 4);
    }

    // HP bar (only draw if completed and damaged)
    if (b.buildProgress >= 1 && b.hp < b.maxHp) {
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
      
      // Tracer fire trail
      const trailGrad = ctx.createLinearGradient(0, 0, -18 * z, 0);
      trailGrad.addColorStop(0, TEAM_COLORS[pr.team].main);
      trailGrad.addColorStop(0.5, TEAM_COLORS[pr.team].glow);
      trailGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 2.5 * z;
      ctx.beginPath();
      ctx.moveTo(-4 * z, 0);
      ctx.lineTo(-18 * z, 0);
      ctx.stroke();
      
      // Shaft
      ctx.strokeStyle = '#a8805e';
      ctx.lineWidth = 1.2 * z;
      ctx.beginPath();
      ctx.moveTo(-6 * z, 0);
      ctx.lineTo(4 * z, 0);
      ctx.stroke();
      
      // Feathers (fletching)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-6 * z, 0);
      ctx.lineTo(-9 * z, -2 * z);
      ctx.lineTo(-8 * z, 0);
      ctx.lineTo(-9 * z, 2 * z);
      ctx.closePath();
      ctx.fill();
      
      // Arrowhead
      ctx.fillStyle = '#cfd6df';
      ctx.beginPath();
      ctx.moveTo(6 * z, 0);
      ctx.lineTo(2 * z, -2 * z);
      ctx.lineTo(3 * z, 0);
      ctx.lineTo(2 * z, 2 * z);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    } else {
      // Boulder with a lobbed arc.
      const arcY = -Math.sin(Math.min(1, pr.progress) * Math.PI) * 1.4 * camera.scale;
      
      // Flame trail pointing backwards
      const angle = Math.atan2(pr.ty - pr.sy, pr.tx - pr.sx);
      ctx.save();
      ctx.translate(p.x, p.y + arcY);
      ctx.rotate(angle + Math.PI);
      
      const flameGrad = ctx.createRadialGradient(0, 0, 0, -12 * z, 0, 16 * z);
      flameGrad.addColorStop(0, 'rgba(255, 120, 0, 0.8)');
      flameGrad.addColorStop(0.4, 'rgba(255, 60, 0, 0.5)');
      flameGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(-6 * z, 0, 16 * z, 0, Math.PI * 2);
      ctx.fill();
      
      for (let i = 0; i < 3; i++) {
        const offset = -(8 + i * 6) * z;
        const radius = (6 - i * 1.5) * z;
        ctx.fillStyle = `rgba(100, 100, 100, ${0.4 - i * 0.1})`;
        ctx.beginPath();
        ctx.arc(offset + Math.sin(Date.now() * 0.02 + i) * 2 * z, Math.cos(Date.now() * 0.02 + i) * 2 * z, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

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

  private drawUnit(ctx: CanvasRenderingContext2D, camera: Camera, u: Unit, isSelected: boolean, alpha: number, civ?: CivId, world?: World): void {
    const wx = u.prevX + (u.x - u.prevX) * alpha;
    const wy = u.prevY + (u.y - u.prevY) * alpha;
    const p = camera.worldToScreen(wx, wy);
    const s = camera.scale * 0.42;

    // Cull offscreen
    if (p.x < -60 || p.y < -60 || p.x > camera.viewW + 60 || p.y > camera.viewH + 60) return;

    // Draw gold connection beam if constructing
    const targetedB = (world && u.kind === 'villager' && u.targetBuildingId !== null)
      ? world.buildings.find(bb => bb.id === u.targetBuildingId && bb.alive && bb.buildProgress < 1)
      : null;
    if (targetedB) {
      const bc = world!.buildingCenter(targetedB);
      const bp = camera.worldToScreen(bc.x, bc.y);
      ctx.save();
      ctx.strokeStyle = '#ffd700'; // Gold beam
      ctx.lineWidth = 1.6 * camera.zoom;
      ctx.setLineDash([4 * camera.zoom, 4 * camera.zoom]);
      ctx.lineDashOffset = -(Date.now() * 0.012) % 8;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(bp.x, bp.y);
      ctx.stroke();
      ctx.restore();
    }

    const tc = TEAM_COLORS[u.team];

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.92, s * 0.7, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Team ground-ring (ALWAYS shown — primary ownership cue now that the
    // body uses the civ palette). Selected units get a brighter gold ring.
    ctx.strokeStyle = isSelected ? COLORS.gold : tc.main;
    ctx.lineWidth = isSelected ? 2.4 : 1.8;
    ctx.globalAlpha = isSelected ? 1 : 0.85;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.88, s * 0.7, s * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const walk = u.moving ? u.animTime * 11 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(u.facing, 1);
    
    // Constructing villagers use attack figure pose (for hammer swing)
    const isBuilding = world && u.kind === 'villager' && u.targetBuildingId !== null &&
      world.buildings.some(bb => bb.id === u.targetBuildingId && bb.alive && bb.buildProgress < 1);
    const figureAtk = (u.attacking || isBuilding) ? 1 : 0;

    if (figureAtk) {
      ctx.shadowColor = tc.glow;
      ctx.shadowBlur = 10;
    }
    drawFigure(ctx, u.kind, civ, u.team, s, walk, figureAtk);
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
