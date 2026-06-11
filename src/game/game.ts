// Game orchestrator: fixed-timestep sim (20 Hz) + interpolated render,
// camera + input wiring, selection, commands, combat events → effects/sound.

import { Camera } from '../engine/camera';
import { Input } from '../engine/input';
import { buildRiverCrossing, type GameMap } from '../data/maps/riverCrossing';
import { UNITS, type UnitKind } from '../data/units';
import { World, type Unit } from './world';
import { updateMovement } from './movement';
import { updateCombat } from './combat';
import { updateProjectiles } from './projectiles';
import { issueAttack, issueAttackMove, issueMove } from './commands';
import { Renderer } from '../render/renderer';
import { Effects } from '../render/effects';
import { Sound } from '../audio/sound';
import { Hud } from '../ui/hud';

const DT = 1 / 20; // sim tick

export class Game {
  private world: World;
  private gameMap: GameMap;
  private camera: Camera;
  private input = new Input();
  private renderer: Renderer;
  private effects = new Effects();
  private sound = new Sound();
  private hud = new Hud();

  private selected = new Set<number>();
  private attackMoveArmed = false;
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

    // Audio needs a user gesture; also hotkeys.
    window.addEventListener('pointerdown', () => this.sound.init(), { once: true });
    window.addEventListener('keydown', (e) => this.handleKey(e));

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

  /** Phase 2 sandbox: player army vs enemy squads (idle — they retaliate). */
  private spawnDemoArmies(): void {
    const ps = this.gameMap.playerStart;
    const kinds: UnitKind[] = ['knight', 'knight', 'knight', 'spear', 'spear', 'archer', 'archer', 'archer', 'cavalry', 'cavalry', 'mage', 'catapult'];
    kinds.forEach((k, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      this.world.spawnUnit(0, k, ps.x + 2 + col * 1.2, ps.y - 2 + row * 1.4);
    });

    // Enemy garrison at their base
    const es = this.gameMap.enemyStart;
    const baseKinds: UnitKind[] = ['knight', 'knight', 'spear', 'archer', 'archer', 'cavalry'];
    baseKinds.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      this.world.spawnUnit(1, k, es.x - 4 - col * 1.2, es.y - 1 + row * 1.4);
    });

    // Enemy patrol guarding the middle bridge — first fight happens here.
    const patrol: UnitKind[] = ['knight', 'spear', 'archer', 'archer', 'mage'];
    patrol.forEach((k, i) => {
      this.world.spawnUnit(1, k, 37 + (i % 2) * 1.3, 19 + Math.floor(i / 2) * 1.3);
    });
  }

  // --- Selection & commands ---

  private selectPoint(sx: number, sy: number, additive: boolean): void {
    const w = this.camera.screenToWorld(sx, sy);

    // Armed attack-move: this click is the order, not a selection.
    if (this.attackMoveArmed) {
      this.executeAttackMove(w.x, w.y);
      return;
    }

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
      this.sound.play('select');
    }
    this.updateSelectionInfo();
  }

  private selectRect(rect: { x0: number; y0: number; x1: number; y1: number }, additive: boolean): void {
    if (this.attackMoveArmed) this.disarmAttackMove();
    const a = this.camera.screenToWorld(rect.x0, rect.y0);
    const b = this.camera.screenToWorld(rect.x1, rect.y1);
    if (!additive) this.selected.clear();
    let any = false;
    for (const u of this.world.units) {
      if (u.team !== 0) continue;
      if (u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y) {
        this.selected.add(u.id);
        any = true;
      }
    }
    if (any) this.sound.play('select');
    this.updateSelectionInfo();
  }

  private command(sx: number, sy: number): void {
    if (this.attackMoveArmed) this.disarmAttackMove();
    if (this.selected.size === 0) return;
    const w = this.camera.screenToWorld(sx, sy);
    const units = this.world.units.filter((u) => this.selected.has(u.id));

    // Right-click on an enemy → focused attack; on ground → move.
    let target: Unit | null = null;
    let bestD = 0.85;
    for (const u of this.world.units) {
      if (u.team === 0) continue;
      const d = Math.hypot(u.x - w.x, u.y - w.y);
      if (d < bestD) {
        bestD = d;
        target = u;
      }
    }

    if (target) {
      issueAttack(this.world, units, target.id);
      this.renderer.addMoveMarker(target.x, target.y, '#ff5a5a');
    } else {
      issueMove(this.world, units, w.x, w.y);
      this.renderer.addMoveMarker(w.x, w.y, '#ffd700');
    }
    this.sound.play('click');
  }

  private executeAttackMove(wx: number, wy: number): void {
    const units = this.world.units.filter((u) => this.selected.has(u.id));
    issueAttackMove(this.world, units, wx, wy);
    this.renderer.addMoveMarker(wx, wy, '#ff8a3d');
    this.sound.play('click');
    this.disarmAttackMove();
  }

  private handleKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === 'a' && this.selected.size > 0) {
      this.attackMoveArmed = true;
      this.canvas.style.cursor = 'crosshair';
      this.hud.setHintOverride('🎯 Saldırı emri — hedef noktayı tıkla (ESC iptal)');
    } else if (k === 'escape') {
      if (this.attackMoveArmed) {
        this.disarmAttackMove();
      } else {
        this.selected.clear();
        this.updateSelectionInfo();
      }
    }
  }

  private disarmAttackMove(): void {
    this.attackMoveArmed = false;
    this.canvas.style.cursor = 'default';
    this.hud.setHintOverride(null);
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
      updateCombat(this.world, DT);
      updateMovement(this.world, DT);
      updateProjectiles(this.world, DT);
    }

    // Consume sim events → particles + sound.
    if (this.world.events.length > 0) {
      this.effects.consume(this.world.events);
      for (const e of this.world.events) {
        switch (e.type) {
          case 'melee_hit': this.sound.play('hit'); break;
          case 'arrow_fire': this.sound.play('arrow'); break;
          case 'arrow_hit': this.sound.play('hit'); break;
          case 'boulder_hit': this.sound.play('explosion'); break;
          case 'magic_cast': this.sound.play('magic'); break;
          case 'death': this.sound.play('death'); break;
        }
      }
      this.world.events = [];
    }

    // Drop dead units from the selection.
    let selectionChanged = false;
    for (const id of this.selected) {
      if (!this.world.units.some((u) => u.id === id && u.alive)) {
        this.selected.delete(id);
        selectionChanged = true;
      }
    }
    if (selectionChanged) this.updateSelectionInfo();

    const alpha = this.acc / DT;
    this.renderer.render(this.world, this.camera, this.selected, this.input.dragRect, alpha, elapsed, this.effects);

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
