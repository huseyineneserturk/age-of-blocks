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

  // --- Lobby: open-room listing + live online count, pushed to every socket ---
  function lobbyState(): {
    online: number;
    rooms: Array<{ code: string; civ: string; name: string; locked: boolean }>;
  } {
    const open: Array<{ code: string; civ: string; name: string; locked: boolean }> = [];
    for (const room of rooms.values()) {
      if (room.open) {
        open.push({ code: room.code, civ: room.hostCiv, name: room.name, locked: room.locked });
      }
    }
    return { online: io.engine.clientsCount, rooms: open };
  }
  function broadcastLobby(): void {
    io.emit('lobby', lobbyState());
  }

  io.on('connection', (socket) => {
    // New arrival: send them the current lobby, and refresh everyone's count.
    socket.emit('lobby', lobbyState());
    broadcastLobby();
    socket.on('disconnect', () => broadcastLobby());
    socket.on('listLobby', (cb: (s: ReturnType<typeof lobbyState>) => void) => {
      if (typeof cb === 'function') cb(lobbyState());
    });
    socket.on('leaveRoom', () => {
      for (const room of rooms.values()) {
        if (room.open) room.leave(socket);
      }
      broadcastLobby();
    });

    socket.on(
      'createRoom',
      (
        payload: { civ?: string; name?: string; password?: string } | undefined,
        cb: (res: { code: string; team: number }) => void,
      ) => {
        // Back-compat: payload may be the callback itself.
        if (typeof payload === 'function') {
          cb = payload as unknown as typeof cb;
          payload = undefined;
        }
        if (typeof cb !== 'function') return;
        const code = makeCode();
        const room = new GameRoom(
          code,
          io,
          () => {
            rooms.delete(code);
            broadcastLobby();
          },
          payload?.name,
          payload?.password,
        );
        rooms.set(code, room);
        const team = room.addPlayer(socket, payload?.civ as never);
        console.log(`[server] room ${code} created (${room.name}${room.locked ? ', locked' : ''})`);
        cb({ code, team: team ?? 0 });
        broadcastLobby();
      },
    );

    socket.on(
      'joinRoom',
      (
        payload: { code: string; civ?: string; password?: string } | string,
        cb: (res: { ok: boolean; team?: number; error?: string }) => void,
      ) => {
        if (typeof cb !== 'function') return;
        const code = typeof payload === 'string' ? payload : payload?.code;
        const civ = typeof payload === 'object' ? payload?.civ : undefined;
        const password = typeof payload === 'object' ? payload?.password : undefined;
        const room = rooms.get(String(code).toUpperCase().trim());
        // Error strings are codes; the client localizes them.
        if (!room || !room.open) {
          cb({ ok: false, error: 'not_found' });
          return;
        }
        if (!room.verifyPassword(password)) {
          cb({ ok: false, error: 'bad_password' });
          return;
        }
        const team = room.addPlayer(socket, civ as never);
        if (team === null) {
          cb({ ok: false, error: 'full' });
          return;
        }
        cb({ ok: true, team });
        broadcastLobby(); // room is now full → drops off the open list
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
