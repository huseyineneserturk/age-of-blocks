// Game orchestrator. Two modes:
//  • Single player: runs the 20 Hz sim locally + enemy AI.
//  • Multiplayer:   passive mirror — sends commands to the authoritative
//    server, renders interpolated snapshots. No local simulation.

import { Camera } from '../engine/camera';
import { Input } from '../engine/input';
import { buildRiverCrossing, type GameMap } from '../data/maps/riverCrossing';
import { UNITS, type UnitKind } from '../data/units';
import { BUILDINGS, BUILD_MENU, type BuildingKind } from '../data/buildings';
import { World, type Building, type Unit } from './world';
import { updateMovement } from './movement';
import { updateCombat } from './combat';
import { updateProjectiles } from './projectiles';
import { updateEconomy, enqueueUnit, pickUpgrade, researchCost, startResearch } from './economy';
import { issueAttack, issueAttackBuilding, issueAttackMove, issueAttackRock, issueMove } from './commands';
import { setupCommon, setupSinglePlayer } from './setup';
import { CIVS, randomCiv, type CivId } from '../data/civs';
import { EnemyAI, type Difficulty } from './ai';
import { FogOfWar } from './fog';
import { Renderer, type PlacementGhost } from '../render/renderer';
import { Minimap } from '../render/minimap';
import { Effects } from '../render/effects';
import { Sound } from '../audio/sound';
import { Hud } from '../ui/hud';
import { applySnapshot } from '../net/snapshot';
import { SNAPSHOT_INTERVAL_MS } from '../net/protocol';
import type { NetConnection } from '../net/client';

const DT = 1 / 20; // sim tick

export class Game {
  private world: World;
  private gameMap: GameMap;
  private camera: Camera;
  private input = new Input();
  private renderer: Renderer;
  private effects = new Effects();
  private sound = new Sound();
  private hud: Hud;
  private myTeam: 0 | 1;

  private selected = new Set<number>();
  private selectedBuildingId: number | null = null;
  private placing: BuildingKind | null = null;
  private attackMoveArmed = false;
  private gameOverShown = false;
  private ai: EnemyAI | null = null;
  private fog: FogOfWar;
  private minimap: Minimap;
  private fogTick = 0;
  private netFogTimer = 0;

  private acc = 0;
  private last = performance.now();
  private fpsTime = 0;
  private fpsCount = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    difficulty: Difficulty = 'normal',
    private net: NetConnection | null = null,
    playerCiv: CivId = 'rome',
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');

    this.myTeam = net?.team ?? 0;
    this.gameMap = buildRiverCrossing();
    this.world = new World(this.gameMap.map);

    // Civilizations: SP = your pick + a different random foe; MP = from server.
    if (net) {
      this.world.players[0].civ = net.civs[0];
      this.world.players[1].civ = net.civs[1];
    } else {
      this.world.players[0].civ = playerCiv;
      this.world.players[1].civ = randomCiv(playerCiv);
    }
    this.camera = new Camera(this.gameMap.map.w, this.gameMap.map.h);
    this.renderer = new Renderer(ctx, this.gameMap.map);
    this.hud = new Hud({
      onPickBuilding: (kind) => this.startPlacement(kind),
      onTrain: (kind) => this.train(kind),
      onResearch: () => this.research(),
      onPickUpgrade: (id) => this.pickUpgradeAction(id),
      onRestart: () => location.reload(),
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (this.net) {
      // World arrives via snapshots; commands go to the server.
      this.net.onSnapshot = (snap) => applySnapshot(this.world, snap);
      this.net.onOpponentLeft = () => {
        if (this.world.winner === null) {
          this.world.winner = this.myTeam;
          this.banner('🏳️ Rakip oyundan ayrıldı — zafer senin!');
        }
      };
      this.net.onOpponentDisconnected = (sec) => {
        this.banner(`⚠️ Rakibin bağlantısı koptu — ${sec}sn bekleniyor...`);
      };
      this.net.onConnectionLost = () => {
        if (this.world.winner === null && !this.gameOverShown) {
          this.gameOverShown = true;
          this.hud.showGameOver(false, '🔌 Bağlantı Koptu');
        }
      };
      console.log(`🌐 Çok oyunculu — takım ${this.myTeam === 0 ? 'MAVİ' : 'KIRMIZI'}`);
    } else {
      setupCommon(this.world, this.gameMap);
      setupSinglePlayer(this.world, this.gameMap);
      this.ai = new EnemyAI(this.world, this.gameMap, difficulty);
      console.log(`🤖 Düşman AI: ${difficulty}`);
    }

    const home = this.myTeam === 0 ? this.gameMap.playerStart : this.gameMap.enemyStart;
    this.camera.centerOn(home.x + (this.myTeam === 0 ? 6 : -6), home.y);

    // Fog of war + minimap
    this.fog = new FogOfWar(this.gameMap.map.w, this.gameMap.map.h);
    this.fog.update(this.world, this.myTeam);
    this.renderer.updateFog(this.fog);
    this.minimap = new Minimap(
      document.getElementById('minimap') as HTMLCanvasElement,
      this.renderer.terrain,
      this.gameMap.map.w,
      this.gameMap.map.h,
      (wx, wy) => this.camera.centerOn(wx, wy),
    );

    this.input.attach(canvas, {
      onSelectPoint: (sx, sy, additive) => this.selectPoint(sx, sy, additive),
      onSelectRect: (rect, additive) => this.selectRect(rect, additive),
      onCommand: (sx, sy) => this.command(sx, sy),
      onPan: (dx, dy) => this.camera.panPixels(dx, dy),
      onZoom: (sx, sy, f) => this.camera.zoomAt(sx, sy, f),
    });

    window.addEventListener('pointerdown', () => this.sound.init(), { once: true });
    window.addEventListener('keydown', (e) => this.handleKey(e));

    // Announce the matchup + your civilization bonus.
    const myCiv = CIVS[this.world.players[this.myTeam].civ];
    const foeCiv = CIVS[this.world.players[this.myTeam === 0 ? 1 : 0].civ];
    this.banner(`${myCiv.emblem} ${myCiv.label} — ${myCiv.bonusName}: ${myCiv.bonusDesc} · Rakip: ${foeCiv.label}`);

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

  private me(): World['players'][number] {
    return this.world.players[this.myTeam];
  }

  // --- Building placement ---

  private startPlacement(kind: BuildingKind): void {
    if (this.me().gold < BUILDINGS[kind].cost) {
      this.sound.play('click');
      return;
    }
    this.placing = kind;
    this.attackMoveArmed = false;
    this.canvas.style.cursor = 'copy';
    this.hud.setBuildSelection(kind);
    const def = BUILDINGS[kind];
    this.hud.setHintOverride(
      def.onGold
        ? `${def.icon} ${def.label} — altın madeni üzerine tıkla (ESC iptal)`
        : `${def.icon} ${def.label} — yerleştirmek için tıkla (ESC iptal)`,
    );
  }

  private stopPlacement(): void {
    this.placing = null;
    this.canvas.style.cursor = 'default';
    this.hud.setBuildSelection(null);
    this.hud.setHintOverride(null);
  }

  private tryPlace(wx: number, wy: number): void {
    if (!this.placing) return;
    const kind = this.placing;
    const def = BUILDINGS[kind];
    const tx = Math.round(wx - def.w / 2);
    const ty = Math.round(wy - def.h / 2);

    if (this.me().gold < def.cost || !this.world.canPlace(kind, tx, ty)) {
      this.sound.play('click');
      return;
    }
    if (this.net) {
      this.net.send({ t: 'build', kind, x: tx, y: ty });
      this.sound.play('build');
    } else {
      this.me().gold -= def.cost;
      this.world.placeBuilding(this.myTeam, kind, tx, ty);
      this.world.events.push({ type: 'build_placed', x: tx + def.w / 2, y: ty + def.h / 2, team: this.myTeam });
    }
    // Walls chain-place; other buildings exit placement mode.
    if (kind !== 'wall') this.stopPlacement();
  }

  // --- Selection & commands ---

  private selectPoint(sx: number, sy: number, additive: boolean): void {
    const w = this.camera.screenToWorld(sx, sy);

    if (this.placing) {
      this.tryPlace(w.x, w.y);
      return;
    }
    if (this.attackMoveArmed) {
      this.executeAttackMove(w.x, w.y);
      return;
    }

    // Priority 1: own unit near the click.
    let best: Unit | null = null;
    let bestD = 0.8;
    for (const u of this.world.units) {
      if (u.team !== this.myTeam) continue;
      const d = Math.hypot(u.x - w.x, u.y - w.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) {
      this.selectedBuildingId = null;
      if (!additive) this.selected.clear();
      if (additive && this.selected.has(best.id)) this.selected.delete(best.id);
      else this.selected.add(best.id);
      this.sound.play('select');
      this.updateSelectionInfo();
      return;
    }

    // Priority 2: own building under the click.
    const b = this.world.buildings.find(
      (bb) => bb.team === this.myTeam && w.x >= bb.x && w.x < bb.x + bb.w && w.y >= bb.y && w.y < bb.y + bb.h,
    );
    if (b) {
      this.selected.clear();
      this.selectedBuildingId = b.id;
      this.sound.play('select');
      this.hud.setSelectionText(`Seçili: ${BUILDINGS[b.kind].icon} ${BUILDINGS[b.kind].label}`);
      return;
    }

    // Empty ground.
    if (!additive) {
      this.selected.clear();
      this.selectedBuildingId = null;
      this.updateSelectionInfo();
    }
  }

  private selectRect(rect: { x0: number; y0: number; x1: number; y1: number }, additive: boolean): void {
    if (this.placing) {
      this.stopPlacement();
      return;
    }
    if (this.attackMoveArmed) this.disarmAttackMove();
    const a = this.camera.screenToWorld(rect.x0, rect.y0);
    const b = this.camera.screenToWorld(rect.x1, rect.y1);
    if (!additive) this.selected.clear();
    let any = false;
    for (const u of this.world.units) {
      if (u.team !== this.myTeam) continue;
      if (u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y) {
        this.selected.add(u.id);
        any = true;
      }
    }
    if (any) {
      this.selectedBuildingId = null;
      this.sound.play('select');
    }
    this.updateSelectionInfo();
  }

  private selectedIds(): number[] {
    return [...this.selected];
  }

  private command(sx: number, sy: number): void {
    if (this.placing) {
      this.stopPlacement();
      return;
    }
    if (this.attackMoveArmed) this.disarmAttackMove();
    const w = this.camera.screenToWorld(sx, sy);

    // Building selected → right click sets the rally point.
    if (this.selectedBuildingId !== null && this.selected.size === 0) {
      const b = this.world.getBuilding(this.selectedBuildingId);
      if (b && b.team === this.myTeam && BUILDINGS[b.kind].trains) {
        if (this.net) {
          this.net.send({ t: 'rally', building: b.id, x: w.x, y: w.y });
        } else {
          b.rallyX = w.x;
          b.rallyY = w.y;
        }
        this.renderer.addMoveMarker(w.x, w.y, '#5fd0ff');
        this.sound.play('click');
      }
      return;
    }

    if (this.selected.size === 0) return;
    const units = this.world.units.filter((u) => this.selected.has(u.id));

    // Enemy unit under cursor → focus attack (only if visible through fog).
    let target: Unit | null = null;
    let bestD = 0.85;
    for (const u of this.world.units) {
      if (u.team === this.myTeam) continue;
      if (!this.fog.isVisible(u.x, u.y)) continue;
      const d = Math.hypot(u.x - w.x, u.y - w.y);
      if (d < bestD) {
        bestD = d;
        target = u;
      }
    }
    if (target) {
      if (this.net) this.net.send({ t: 'attack', ids: this.selectedIds(), target: target.id });
      else issueAttack(this.world, units, target.id);
      this.renderer.addMoveMarker(target.x, target.y, '#ff5a5a');
      this.sound.play('click');
      return;
    }

    // Enemy building under cursor → siege it (must be explored).
    const tb = this.world.buildings.find(
      (bb) =>
        bb.team !== this.myTeam &&
        w.x >= bb.x && w.x < bb.x + bb.w && w.y >= bb.y && w.y < bb.y + bb.h &&
        this.fog.isExplored(bb.x + bb.w / 2, bb.y + bb.h / 2),
    );
    if (tb) {
      if (this.net) this.net.send({ t: 'attackB', ids: this.selectedIds(), target: tb.id });
      else issueAttackBuilding(this.world, units, tb.id);
      const c = this.world.buildingCenter(tb);
      this.renderer.addMoveMarker(c.x, c.y, '#ff5a5a');
      this.sound.play('click');
      return;
    }

    // Cracked rock under cursor → break it open.
    const rock = this.world.rocks.find(
      (r) => r.alive && w.x >= r.x && w.x < r.x + 1 && w.y >= r.y && w.y < r.y + 1,
    );
    if (rock) {
      if (this.net) this.net.send({ t: 'attackR', ids: this.selectedIds(), target: rock.id });
      else issueAttackRock(this.world, units, rock.id);
      this.renderer.addMoveMarker(rock.x + 0.5, rock.y + 0.5, '#d0c060');
      this.sound.play('click');
      return;
    }

    if (this.net) this.net.send({ t: 'move', ids: this.selectedIds(), x: w.x, y: w.y });
    else issueMove(this.world, units, w.x, w.y);
    this.renderer.addMoveMarker(w.x, w.y, '#ffd700');
    this.sound.play('click');
  }

  private executeAttackMove(wx: number, wy: number): void {
    if (this.net) {
      this.net.send({ t: 'amove', ids: this.selectedIds(), x: wx, y: wy });
    } else {
      const units = this.world.units.filter((u) => this.selected.has(u.id));
      issueAttackMove(this.world, units, wx, wy);
    }
    this.renderer.addMoveMarker(wx, wy, '#ff8a3d');
    this.sound.play('click');
    this.disarmAttackMove();
  }

  private train(kind: UnitKind): void {
    if (this.selectedBuildingId === null) return;
    const b = this.world.getBuilding(this.selectedBuildingId);
    if (!b || b.team !== this.myTeam) return;
    if (this.net) {
      this.net.send({ t: 'train', building: b.id, kind });
      this.sound.play('click');
    } else if (enqueueUnit(this.world, b, kind)) {
      this.sound.play('click');
    }
  }

  private research(): void {
    if (this.selectedBuildingId === null) return;
    const b = this.world.getBuilding(this.selectedBuildingId);
    if (!b || b.team !== this.myTeam) return;
    if (this.net) {
      this.net.send({ t: 'research', building: b.id });
      this.sound.play('build');
    } else if (startResearch(this.world, b)) {
      this.sound.play('build');
    }
  }

  private pickUpgradeAction(id: string): void {
    if (this.net) {
      this.net.send({ t: 'pick', id });
      this.sound.play('resource');
    } else if (pickUpgrade(this.world, this.myTeam, id)) {
      this.sound.play('resource');
    }
  }

  private handleKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();

    // Build hotkeys
    const byHotkey = BUILD_MENU.find((kind) => BUILDINGS[kind].hotkey === k);
    if (byHotkey) {
      this.startPlacement(byHotkey);
      return;
    }

    if (k === 'a' && this.selected.size > 0 && !this.placing) {
      this.attackMoveArmed = true;
      this.canvas.style.cursor = 'crosshair';
      this.hud.setHintOverride('🎯 Saldırı emri — hedef noktayı tıkla (ESC iptal)');
    } else if (k === 'escape') {
      if (this.placing) {
        this.stopPlacement();
      } else if (this.attackMoveArmed) {
        this.disarmAttackMove();
      } else {
        this.selected.clear();
        this.selectedBuildingId = null;
        this.updateSelectionInfo();
      }
    }
  }

  private disarmAttackMove(): void {
    this.attackMoveArmed = false;
    this.canvas.style.cursor = 'default';
    this.hud.setHintOverride(null);
  }

  private bannerTimer: number | undefined;

  /** Flash a message in the hint bar for a few seconds. */
  private banner(text: string): void {
    this.hud.setHintOverride(text);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      if (!this.placing && !this.attackMoveArmed) this.hud.setHintOverride(null);
    }, 4000);
  }

  private updateSelectionInfo(): void {
    const units = this.world.units.filter((u) => this.selected.has(u.id));
    this.hud.setSelection(units.map((u) => UNITS[u.kind].label));
  }

  // --- Loop ---

  private frame(now: number): void {
    const elapsed = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    this.camera.update(elapsed, this.input.keys);

    let alpha: number;
    if (this.net) {
      // Mirror mode: interpolate between snapshots; advance walk anims locally.
      alpha = Math.min(1, (now - this.net.lastSnapshotAt) / SNAPSHOT_INTERVAL_MS);
      for (const u of this.world.units) {
        if (u.moving) u.animTime += elapsed;
      }
      this.netFogTimer += elapsed;
      if (this.netFogTimer >= 0.2) {
        this.netFogTimer = 0;
        this.fog.update(this.world, this.myTeam);
        this.renderer.updateFog(this.fog);
      }
    } else {
      this.acc += elapsed;
      if (this.world.winner === null) {
        while (this.acc >= DT) {
          this.acc -= DT;
          this.ai!.update(DT);
          updateEconomy(this.world, DT);
          updateCombat(this.world, DT);
          updateMovement(this.world, DT);
          updateProjectiles(this.world, DT);
          // Fog refresh every 4th tick (5 Hz) — plenty for vision.
          if (++this.fogTick >= 4) {
            this.fogTick = 0;
            this.fog.update(this.world, this.myTeam);
            this.renderer.updateFog(this.fog);
          }
        }
      } else {
        this.acc = 0;
      }
      alpha = this.acc / DT;
    }

    // Sim events → particles + sound.
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
          case 'building_destroyed': this.sound.play('explosion'); break;
          case 'train_done': this.sound.play('spawn'); break;
          case 'build_placed': this.sound.play('build'); break;
          case 'rock_destroyed':
            this.sound.play('explosion');
            this.banner('🪨 Geçit açıldı!');
            break;
          case 'camp_cleared':
            this.sound.play('victory');
            this.banner(
              e.team === this.myTeam
                ? '🗿 Kamp temizlendi! +150 altın, kalıcı +%10 hasar'
                : '⚠️ Düşman kampı temizledi ve güçlendi!',
            );
            break;
        }
      }
      this.world.events = [];
    }

    // Selection hygiene.
    let selectionChanged = false;
    for (const id of this.selected) {
      if (!this.world.units.some((u) => u.id === id && u.alive)) {
        this.selected.delete(id);
        selectionChanged = true;
      }
    }
    if (selectionChanged) this.updateSelectionInfo();
    if (this.selectedBuildingId !== null && !this.world.getBuilding(this.selectedBuildingId)) {
      this.selectedBuildingId = null;
    }

    // Ghost preview while placing.
    let ghost: PlacementGhost | null = null;
    if (this.placing) {
      const w = this.camera.screenToWorld(this.input.mouseX, this.input.mouseY);
      const def = BUILDINGS[this.placing];
      const tx = Math.round(w.x - def.w / 2);
      const ty = Math.round(w.y - def.h / 2);
      ghost = {
        kind: this.placing,
        tileX: tx,
        tileY: ty,
        valid: this.world.canPlace(this.placing, tx, ty) && this.me().gold >= def.cost,
      };
    }

    this.renderer.render(
      this.world,
      this.camera,
      this.selected,
      this.selectedBuildingId,
      ghost,
      this.input.dragRect,
      alpha,
      elapsed,
      this.effects,
      this.fog,
      this.myTeam,
    );
    this.minimap.render(this.world, this.camera, this.fog, this.myTeam);

    // HUD
    const me = this.me();
    const selBuilding = this.selectedBuildingId !== null
      ? (this.world.getBuilding(this.selectedBuildingId) as Building | undefined) ?? null
      : null;
    this.hud.update(me, selBuilding, researchCost(me));
    let income = 0;
    for (const b of this.world.buildings) {
      if (b.alive && b.team === this.myTeam && b.buildProgress >= 1) income += BUILDINGS[b.kind].income ?? 0;
    }
    this.hud.setIncome(income * me.upgrades.income);

    // Win/lose
    if (this.world.winner !== null && !this.gameOverShown) {
      this.gameOverShown = true;
      this.hud.showGameOver(this.world.winner === this.myTeam);
      this.sound.play(this.world.winner === this.myTeam ? 'victory' : 'defeat');
    }

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
