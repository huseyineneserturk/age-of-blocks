// One authoritative match: the server owns the World, runs the sim at 20 Hz,
// validates every client command, and broadcasts 10 Hz snapshots.

import type { Server, Socket } from 'socket.io';
import { buildRiverCrossing, type GameMap } from '../src/data/maps/riverCrossing';
import { BUILDINGS } from '../src/data/buildings';
import { CIVS, randomCiv, type CivId } from '../src/data/civs';
import { World, type Unit } from '../src/game/world';
import { setupCommon, setupSymmetric } from '../src/game/setup';
import { updateCombat } from '../src/game/combat';
import { updateMovement } from '../src/game/movement';
import { updateProjectiles } from '../src/game/projectiles';
import { updateEconomy, enqueueUnit, pickUpgrade, startResearch } from '../src/game/economy';
import {
  issueAttack,
  issueAttackBuilding,
  issueAttackMove,
  issueAttackRock,
  issueMove,
} from '../src/game/commands';
import { encodeSnapshot } from '../src/net/snapshot';
import { SNAPSHOT_INTERVAL_MS, type ClientCommand } from '../src/net/protocol';

const DT = 1 / 20;

export class GameRoom {
  readonly code: string;
  private world: World;
  private gameMap: GameMap;
  private players = new Map<string, 0 | 1>(); // socket.id → team
  private sockets = new Map<0 | 1, Socket>();
  // Per-socket listeners, kept so an explicit leave can detach them cleanly.
  private handlers = new Map<string, { onCommand: (c: ClientCommand) => void; onDisconnect: () => void }>();
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private snapAccum = 0;
  private started = false;
  finished = false;

  /** Seconds a disconnected player gets before the match is forfeited. */
  private static readonly FORFEIT_GRACE_S = 10;

  constructor(
    code: string,
    private io: Server,
    private onEmpty: () => void,
  ) {
    this.code = code;
    this.gameMap = buildRiverCrossing();
    this.world = new World(this.gameMap.map);
    setupCommon(this.world, this.gameMap);
    setupSymmetric(this.world, this.gameMap);
  }

  get playerCount(): number {
    return this.players.size;
  }

  /** Open = waiting for an opponent, joinable from the lobby. */
  get open(): boolean {
    return !this.started && !this.finished && this.players.size === 1;
  }

  /** The host (team 0) civilization — shown in the lobby listing. */
  get hostCiv(): CivId {
    return this.world.players[0].civ;
  }

  addPlayer(socket: Socket, civ?: CivId): 0 | 1 | null {
    if (this.started || this.players.size >= 2) return null;
    const team: 0 | 1 = this.players.size === 0 ? 0 : 1;
    this.players.set(socket.id, team);
    this.sockets.set(team, socket);
    socket.join(this.code);

    // Validate + apply the chosen civilization.
    const chosen: CivId = civ && CIVS[civ] ? civ : randomCiv();
    this.world.players[team].civ = chosen;

    const onCommand = (cmd: ClientCommand): void => this.handleCommand(team, cmd);
    const onDisconnect = (): void => this.leave(socket);
    this.handlers.set(socket.id, { onCommand, onDisconnect });
    socket.on('command', onCommand);
    socket.on('disconnect', onDisconnect);

    if (this.players.size === 2) this.start();
    return team;
  }

  /** Explicit departure (host cancels a waiting room, or a real disconnect). */
  leave(socket: Socket): void {
    const h = this.handlers.get(socket.id);
    if (h) {
      socket.off('command', h.onCommand);
      socket.off('disconnect', h.onDisconnect);
      this.handlers.delete(socket.id);
    }
    this.handleLeave(socket);
  }

  private start(): void {
    this.started = true;
    const civs: [CivId, CivId] = [this.world.players[0].civ, this.world.players[1].civ];
    for (const [team, socket] of this.sockets) {
      socket.emit('start', { team, map: this.gameMap.name, civs });
    }
    this.simTimer = setInterval(() => this.tick(), DT * 1000);
    console.log(`[room ${this.code}] match started (${civs[0]} vs ${civs[1]})`);
  }

  private tick(): void {
    if (this.world.winner === null) {
      updateEconomy(this.world, DT);
      updateCombat(this.world, DT);
      updateMovement(this.world, DT);
      updateProjectiles(this.world, DT);
    }

    this.snapAccum += DT * 1000;
    if (this.snapAccum >= SNAPSHOT_INTERVAL_MS) {
      this.snapAccum = 0;
      this.io.to(this.code).emit('snapshot', encodeSnapshot(this.world));
      this.world.events = [];
      if (this.world.winner !== null && !this.finished) {
        this.finished = true;
        console.log(`[room ${this.code}] winner: team ${this.world.winner}`);
        setTimeout(() => this.destroy(), 5000);
      }
    }
  }

  /** Validate and apply a client command. Ownership is always enforced. */
  private handleCommand(team: 0 | 1, cmd: ClientCommand): void {
    if (!this.started || this.world.winner !== null || !cmd || typeof cmd !== 'object') return;
    const w = this.world;

    const myUnits = (ids: unknown): Unit[] => {
      if (!Array.isArray(ids)) return [];
      const set = new Set(ids.filter((i) => typeof i === 'number'));
      return w.units.filter((u) => u.alive && u.team === team && set.has(u.id));
    };
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

    switch (cmd.t) {
      case 'move':
        issueMove(w, myUnits(cmd.ids), num(cmd.x), num(cmd.y));
        break;
      case 'amove':
        issueAttackMove(w, myUnits(cmd.ids), num(cmd.x), num(cmd.y));
        break;
      case 'attack': {
        const target = w.getUnit(num(cmd.target));
        if (target && target.team !== team) issueAttack(w, myUnits(cmd.ids), target.id);
        break;
      }
      case 'attackB': {
        const b = w.getBuilding(num(cmd.target));
        if (b && b.team !== team) issueAttackBuilding(w, myUnits(cmd.ids), b.id);
        break;
      }
      case 'attackR': {
        const r = w.getRock(num(cmd.target));
        if (r) issueAttackRock(w, myUnits(cmd.ids), r.id);
        break;
      }
      case 'build': {
        const def = BUILDINGS[cmd.kind];
        if (!def || cmd.kind === 'castle') return;
        const tx = Math.round(num(cmd.x));
        const ty = Math.round(num(cmd.y));
        const p = w.players[team];
        if (p.gold >= def.cost && w.canPlace(cmd.kind, tx, ty)) {
          p.gold -= def.cost;
          w.placeBuilding(team, cmd.kind, tx, ty);
          w.events.push({ type: 'build_placed', x: tx + def.w / 2, y: ty + def.h / 2, team });
        }
        break;
      }
      case 'train': {
        const b = w.getBuilding(num(cmd.building));
        if (b && b.team === team) enqueueUnit(w, b, cmd.kind);
        break;
      }
      case 'research': {
        const b = w.getBuilding(num(cmd.building));
        if (b && b.team === team) startResearch(w, b);
        break;
      }
      case 'pick':
        if (typeof cmd.id === 'string') pickUpgrade(w, team, cmd.id);
        break;
      case 'rally': {
        const b = w.getBuilding(num(cmd.building));
        if (b && b.team === team && BUILDINGS[b.kind].trains) {
          b.rallyX = num(cmd.x);
          b.rallyY = num(cmd.y);
        }
        break;
      }
    }
  }

  private handleLeave(socket: Socket): void {
    const team = this.players.get(socket.id);
    this.players.delete(socket.id);
    if (team !== undefined) this.sockets.delete(team);

    if (this.started && !this.finished && team !== undefined) {
      // Don't end the match on a transient blip: warn the opponent and give
      // the leaver a grace window before declaring a forfeit.
      console.log(`[room ${this.code}] team ${team} disconnected — ${GameRoom.FORFEIT_GRACE_S}s grace`);
      this.io.to(this.code).emit('opponentDisconnected', { graceSeconds: GameRoom.FORFEIT_GRACE_S });
      if (this.graceTimer) clearTimeout(this.graceTimer);
      this.graceTimer = setTimeout(() => {
        if (this.finished) return;
        this.finished = true;
        this.io.to(this.code).emit('opponentLeft');
        console.log(`[room ${this.code}] team ${team} did not return — forfeit`);
        this.destroy();
      }, GameRoom.FORFEIT_GRACE_S * 1000);
    } else if (this.players.size === 0) {
      this.destroy();
    }
  }

  destroy(): void {
    if (this.simTimer) clearInterval(this.simTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.simTimer = null;
    this.graceTimer = null;
    this.onEmpty();
  }
}
