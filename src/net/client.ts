// Thin Socket.IO client wrapper for the match server.

import { io, type Socket } from 'socket.io-client';
import type { ClientCommand, Snapshot } from './protocol';

export class NetConnection {
  team: 0 | 1 = 0;
  /** Time (performance.now) of the last applied snapshot, for interpolation. */
  lastSnapshotAt = 0;
  private socket: Socket | null = null;

  onSnapshot: (snap: Snapshot) => void = () => {};
  onStart: () => void = () => {};
  onOpponentLeft: () => void = () => {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(url, { transports: ['websocket', 'polling'], timeout: 6000 });
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', (e) => reject(e));

      this.socket.on('start', ({ team }: { team: 0 | 1 }) => {
        this.team = team;
        this.onStart();
      });
      this.socket.on('snapshot', (snap: Snapshot) => {
        this.lastSnapshotAt = performance.now();
        this.onSnapshot(snap);
      });
      this.socket.on('opponentLeft', () => this.onOpponentLeft());
    });
  }

  createRoom(): Promise<string> {
    return new Promise((resolve) => {
      this.socket!.emit('createRoom', (res: { code: string; team: 0 | 1 }) => {
        this.team = res.team;
        resolve(res.code);
      });
    });
  }

  joinRoom(code: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket!.emit('joinRoom', code, (res: { ok: boolean; team?: 0 | 1; error?: string }) => {
        if (res.ok && res.team !== undefined) this.team = res.team;
        resolve(res);
      });
    });
  }

  send(cmd: ClientCommand): void {
    this.socket?.emit('command', cmd);
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}
