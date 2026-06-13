// Age of Blocks — authoritative match server.
// Run: npm run server   (tsx server/index.ts, PORT env optional)

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { GameRoom } from './room';

export function startServer(port: number): { io: Server; close: () => void } {
  const http = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    void req;
  });
  const io = new Server(http, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    // Tolerate background-tab throttling: don't drop a player for a slow pong.
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  const rooms = new Map<string, GameRoom>();

  function makeCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (rooms.has(code));
    return code;
  }

  io.on('connection', (socket) => {
    socket.on('createRoom', (payload: { civ?: string } | undefined, cb: (res: { code: string; team: number }) => void) => {
      // Back-compat: payload may be the callback itself.
      if (typeof payload === 'function') {
        cb = payload as unknown as typeof cb;
        payload = undefined;
      }
      if (typeof cb !== 'function') return;
      const code = makeCode();
      const room = new GameRoom(code, io, () => rooms.delete(code));
      rooms.set(code, room);
      const team = room.addPlayer(socket, payload?.civ as never);
      console.log(`[server] room ${code} created`);
      cb({ code, team: team ?? 0 });
    });

    socket.on(
      'joinRoom',
      (
        payload: { code: string; civ?: string } | string,
        cb: (res: { ok: boolean; team?: number; error?: string }) => void,
      ) => {
        if (typeof cb !== 'function') return;
        const code = typeof payload === 'string' ? payload : payload?.code;
        const civ = typeof payload === 'object' ? payload?.civ : undefined;
        const room = rooms.get(String(code).toUpperCase().trim());
        if (!room) {
          cb({ ok: false, error: 'Oda bulunamadı' });
          return;
        }
        const team = room.addPlayer(socket, civ as never);
        if (team === null) {
          cb({ ok: false, error: 'Oda dolu veya oyun başladı' });
          return;
        }
        cb({ ok: true, team });
      },
    );
  });

  http.listen(port, () => {
    console.log(`⚔ Age of Blocks match server — port ${port}`);
  });

  return {
    io,
    close: () => {
      for (const room of rooms.values()) room.destroy();
      io.close();
      http.close();
    },
  };
}

// Start directly when run as a script (not when imported by tests).
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('server/index.ts');
if (isMain) {
  startServer(Number(process.env.PORT) || 3001);
}
