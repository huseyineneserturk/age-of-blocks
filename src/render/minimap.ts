// Clickable minimap: scaled terrain + fog + entity dots + camera viewport.
// Click or drag to move the camera.

import type { Camera } from '../engine/camera';
import { TEAM_COLORS } from '../data/units';
import { FOG_EXPLORED, FOG_UNEXPLORED, type FogOfWar } from '../game/fog';
import type { World } from '../game/world';

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private dragging = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private terrain: HTMLCanvasElement,
    private mapW: number,
    private mapH: number,
    onNavigate: (wx: number, wy: number) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    canvas.width = 208;
    canvas.height = Math.round((208 * mapH) / mapW);

    const nav = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const wx = ((e.clientX - rect.left) / rect.width) * this.mapW;
      const wy = ((e.clientY - rect.top) / rect.height) * this.mapH;
      onNavigate(wx, wy);
    };
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      nav(e);
      e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) nav(e);
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  render(world: World, camera: Camera, fog: FogOfWar, myTeam: 0 | 1 = 0): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sx = W / this.mapW;
    const sy = H / this.mapH;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, 0, 0, W, H);

    // Buildings (explored enemies + always own)
    for (const b of world.buildings) {
      if (b.team !== myTeam && !fog.isExplored(b.x + b.w / 2, b.y + b.h / 2)) continue;
      ctx.fillStyle = b.team === 2 ? TEAM_COLORS[2].main : TEAM_COLORS[b.team].main;
      ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }

    // Units (visible enemies + always own)
    for (const u of world.units) {
      if (u.team !== myTeam && !fog.isVisible(u.x, u.y)) continue;
      ctx.fillStyle = TEAM_COLORS[u.team].main;
      ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2.5, 2.5);
    }

    // Fog
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const s = fog.at(x, y);
        if (s === FOG_UNEXPLORED) {
          ctx.fillStyle = 'rgba(5,8,14,0.93)';
          ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
        } else if (s === FOG_EXPLORED) {
          ctx.fillStyle = 'rgba(5,8,14,0.45)';
          ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
        }
      }
    }

    // Camera viewport
    const tl = camera.screenToWorld(0, 0);
    const br = camera.screenToWorld(camera.viewW, camera.viewH);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x * sx, tl.y * sy, (br.x - tl.x) * sx, (br.y - tl.y) * sy);
  }
}
