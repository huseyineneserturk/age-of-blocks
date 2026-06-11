// Game orchestrator: fixed-timestep sim (20 Hz) + interpolated render,
// camera + input wiring, selection and command handling.

import { Camera } from '../engine/camera';
import { Input } from '../engine/input';
import { buildRiverCrossing, type GameMap } from '../data/maps/riverCrossing';
import { UNITS, type UnitKind } from '../data/units';
import { World, type Unit } from './world';
import { updateMovement } from './movement';
import { issueMove } from './commands';
import { Renderer } from '../render/renderer';
import { Hud } from '../ui/hud';

const DT = 1 / 20; // sim tick

export class Game {
  private world: World;
  private gameMap: GameMap;
  private camera: Camera;
  private input = new Input();
  private renderer: Renderer;
  private hud = new Hud();

  private selected = new Set<number>();
  private acc = 0;
  private last = performance.now();
  private fpsTime = 0;
  private fpsCount = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');

    this.gameMap = buildRiverCrossing();
    this.world = new World(this.gameMap.map);
    this.camera = new Camera(this.gameMap.map.w, this.gameMap.map.h);
    this.renderer = new Renderer(ctx, this.gameMap.map);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.spawnDemoArmies();
    this.camera.centerOn(this.gameMap.playerStart.x + 8, this.gameMap.playerStart.y);

    this.input.attach(canvas, {
      onSelectPoint: (sx, sy, additive) => this.selectPoint(sx, sy, additive),
      onSelectRect: (rect, additive) => this.selectRect(rect, additive),
      onCommand: (sx, sy) => this.command(sx, sy),
      onPan: (dx, dy) => this.camera.panPixels(dx, dy),
      onZoom: (sx, sy, f) => this.camera.zoomAt(sx, sy, f),
    });

    requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.setViewport(window.innerWidth, window.innerHeight);
  }

  /** Phase 1 sandbox: a mixed player army + an enemy patrol to look at. */
  private spawnDemoArmies(): void {
    const ps = this.gameMap.playerStart;
    const kinds: UnitKind[] = ['knight', 'knight', 'knight', 'spear', 'spear', 'archer', 'archer', 'archer', 'cavalry', 'cavalry', 'mage', 'catapult'];
    kinds.forEach((k, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      this.world.spawnUnit(0, k, ps.x + 2 + col * 1.2, ps.y - 2 + row * 1.4);
    });

    const es = this.gameMap.enemyStart;
    const enemyKinds: UnitKind[] = ['knight', 'knight', 'spear', 'archer', 'archer', 'cavalry'];
    enemyKinds.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      this.world.spawnUnit(1, k, es.x - 4 - col * 1.2, es.y - 1 + row * 1.4);
    });
  }

  // --- Selection ---

  private selectPoint(sx: number, sy: number, additive: boolean): void {
    const w = this.camera.screenToWorld(sx, sy);
    let best: Unit | null = null;
    let bestD = 0.8; // click tolerance in tiles
    for (const u of this.world.units) {
      if (u.team !== 0) continue;
      const d = Math.hypot(u.x - w.x, u.y - w.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (!additive) this.selected.clear();
    if (best) {
      if (additive && this.selected.has(best.id)) this.selected.delete(best.id);
      else this.selected.add(best.id);
    }
    this.updateSelectionInfo();
  }

  private selectRect(rect: { x0: number; y0: number; x1: number; y1: number }, additive: boolean): void {
    const a = this.camera.screenToWorld(rect.x0, rect.y0);
    const b = this.camera.screenToWorld(rect.x1, rect.y1);
    if (!additive) this.selected.clear();
    for (const u of this.world.units) {
      if (u.team !== 0) continue;
      if (u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y) {
        this.selected.add(u.id);
      }
    }
    this.updateSelectionInfo();
  }

  private command(sx: number, sy: number): void {
    if (this.selected.size === 0) return;
    const w = this.camera.screenToWorld(sx, sy);
    const units = this.world.units.filter((u) => this.selected.has(u.id));
    issueMove(this.world, units, w.x, w.y);
    this.renderer.addMoveMarker(w.x, w.y);
  }

  private updateSelectionInfo(): void {
    const units = this.world.units.filter((u) => this.selected.has(u.id));
    this.hud.setSelection(units.map((u) => UNITS[u.kind].label));
  }

  // --- Loop ---

  private frame(now: number): void {
    const elapsed = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += elapsed;

    this.camera.update(elapsed, this.input.keys);

    while (this.acc >= DT) {
      this.acc -= DT;
      updateMovement(this.world, DT);
    }

    const alpha = this.acc / DT;
    this.renderer.render(this.world, this.camera, this.selected, this.input.dragRect, alpha, elapsed);

    this.fpsCount++;
    this.fpsTime += elapsed;
    if (this.fpsTime >= 0.5) {
      this.hud.setFps(Math.round(this.fpsCount / this.fpsTime));
      this.fpsCount = 0;
      this.fpsTime = 0;
    }

    requestAnimationFrame((t) => this.frame(t));
  }
}
