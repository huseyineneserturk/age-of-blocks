// Thin Socket.IO client wrapper for the match server.

import { io, type Socket } from 'socket.io-client';
import type { CivId } from '../data/civs';
import type { ClientCommand, LobbyState, Snapshot } from './protocol';

export class NetConnection {
  team: 0 | 1 = 0;
  civs: [CivId, CivId] = ['rome', 'rome'];
  /** Time (performance.now) of the last applied snapshot, for interpolation. */
  lastSnapshotAt = 0;
  private socket: Socket | null = null;

  onSnapshot: (snap: Snapshot) => void = () => {};
  onStart: () => void = () => {};
  onOpponentLeft: () => void = () => {};
  onOpponentDisconnected: (graceSeconds: number) => void = () => {};
  onConnectionLost: () => void = () => {};
  onLobby: (state: LobbyState) => void = () => {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // No auto-reconnect: a reconnected socket can't rejoin its room, so a
      // drop is final — surface it clearly instead of leaving a zombie.
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 6000,
        reconnection: false,
      });
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', (e) => reject(e));

      this.socket.on('start', ({ team, civs }: { team: 0 | 1; civs?: [CivId, CivId] }) => {
        this.team = team;
        if (civs) this.civs = civs;
        this.onStart();
      });
      this.socket.on('snapshot', (snap: Snapshot) => {
        this.lastSnapshotAt = performance.now();
        this.onSnapshot(snap);
      });
      this.socket.on('opponentLeft', () => this.onOpponentLeft());
      this.socket.on('opponentDisconnected', ({ graceSeconds }: { graceSeconds: number }) =>
        this.onOpponentDisconnected(graceSeconds),
      );
      this.socket.on('lobby', (state: LobbyState) => this.onLobby(state));
      this.socket.on('disconnect', () => this.onConnectionLost());
    });
  }

  /** Leave a room we created while still waiting for an opponent. */
  leaveRoom(): void {
    this.socket?.emit('leaveRoom');
  }

  /** Ask the server to re-send the current lobby state (manual refresh). */
  requestLobby(): void {
    this.socket?.emit('listLobby', (state: LobbyState) => this.onLobby(state));
  }

  createRoom(opts: { civ: CivId; name?: string; password?: string }): Promise<string> {
    return new Promise((resolve) => {
      this.socket!.emit('createRoom', opts, (res: { code: string; team: 0 | 1 }) => {
        this.team = res.team;
        resolve(res.code);
      });
    });
  }

  joinRoom(code: string, civ: CivId, password?: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket!.emit(
        'joinRoom',
        { code, civ, password },
        (res: { ok: boolean; team?: 0 | 1; error?: string }) => {
          if (res.ok && res.team !== undefined) this.team = res.team;
          resolve(res);
        },
      );
    });
  }

  send(cmd: ClientCommand): void {
    this.socket?.emit('command', cmd);
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}
