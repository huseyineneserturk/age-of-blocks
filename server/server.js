const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store rooms
const rooms = new Map();

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Room class
class GameRoom {
    constructor(code, hostId, mode) {
        this.code = code;
        this.hostId = hostId;
        this.mode = mode;
        this.status = 'waiting';
        this.players = new Map();
        this.gameState = {
            buildings: [],
            units: [],
            castles: { team1: { hp: 1000 }, team2: { hp: 1000 } }
        };
        this.lastUpdate = Date.now();
    }

    addPlayer(socketId, name, team) {
        this.players.set(socketId, {
            id: socketId,
            name: name,
            team: team,
            ready: false,
            isHost: socketId === this.hostId
        });
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
    }

    getMaxPlayers() {
        switch (this.mode) {
            case 'ffa': return 4;
            case '1v1': return 2;
            case '2v2': return 4;
            case '3v3': return 6;
            default: return 2;
        }
    }

    assignTeam() {
        const teamCounts = { 1: 0, 2: 0 };
        this.players.forEach(p => {
            if (teamCounts[p.team] !== undefined) {
                teamCounts[p.team]++;
            }
        });
        return teamCounts[1] <= teamCounts[2] ? 1 : 2;
    }

    allReady() {
        let allReady = true;
        this.players.forEach(p => {
            if (!p.ready && !p.isHost) allReady = false;
        });
        return allReady && this.players.size >= 2;
    }

    serialize() {
        return {
            code: this.code,
            mode: this.mode,
            status: this.status,
            players: Object.fromEntries(this.players),
            maxPlayers: this.getMaxPlayers()
        };
    }
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    let currentRoom = null;

    // Create room
    socket.on('createRoom', ({ mode, playerName }, callback) => {
        const code = generateRoomCode();
        const room = new GameRoom(code, socket.id, mode);
        room.addPlayer(socket.id, playerName, 1);
        rooms.set(code, room);
        currentRoom = code;

        socket.join(code);
        console.log(`Room ${code} created by ${playerName}`);

        callback({ success: true, roomCode: code, room: room.serialize() });
        io.to(code).emit('roomUpdate', room.serialize());
    });

    // Join room
    socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
        const room = rooms.get(roomCode.toUpperCase());

        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        if (room.players.size >= room.getMaxPlayers()) {
            callback({ success: false, error: 'Room is full' });
            return;
        }

        if (room.status !== 'waiting') {
            callback({ success: false, error: 'Game already started' });
            return;
        }

        const team = room.assignTeam();
        room.addPlayer(socket.id, playerName, team);
        currentRoom = roomCode.toUpperCase();

        socket.join(currentRoom);
        console.log(`${playerName} joined room ${currentRoom}`);

        callback({ success: true, room: room.serialize(), team });
        io.to(currentRoom).emit('roomUpdate', room.serialize());
    });

    // Toggle ready
    socket.on('toggleReady', (callback) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            player.ready = !player.ready;
            io.to(currentRoom).emit('roomUpdate', room.serialize());
            callback({ ready: player.ready });
        }
    });

    // Switch team
    socket.on('switchTeam', () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            player.team = player.team === 1 ? 2 : 1;
            io.to(currentRoom).emit('roomUpdate', room.serialize());
        }
    });

    // Start game
    socket.on('startGame', (callback) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== socket.id) return;

        if (!room.allReady()) {
            callback({ success: false, error: 'Not all players ready' });
            return;
        }

        room.status = 'playing';
        room.gameState = {
            buildings: [],
            units: [],
            castles: { team1: { hp: 1000, alive: true }, team2: { hp: 1000, alive: true } },
            winner: null
        };

        io.to(currentRoom).emit('gameStart', { room: room.serialize() });
        callback({ success: true });
        console.log(`Game started in room ${currentRoom}`);
    });

    // Building placed
    socket.on('buildingPlaced', (data) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.status !== 'playing') return;

        const player = room.players.get(socket.id);
        if (!player) return;

        // Broadcast to all players in room
        socket.to(currentRoom).emit('buildingPlaced', {
            ...data,
            team: player.team,
            playerId: socket.id
        });
    });

    // Unit spawned
    socket.on('unitSpawned', (data) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.status !== 'playing') return;

        const player = room.players.get(socket.id);
        if (!player) return;

        socket.to(currentRoom).emit('unitSpawned', {
            ...data,
            team: player.team,
            playerId: socket.id
        });
    });

    // Game state sync (from host)
    socket.on('gameStateSync', (gameState) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== socket.id) return;

        room.gameState = gameState;
        room.lastUpdate = Date.now();

        // Broadcast to all non-host players
        socket.to(currentRoom).emit('gameStateUpdate', gameState);
    });

    // Castle damage
    socket.on('castleDamage', (data) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.status !== 'playing') return;

        io.to(currentRoom).emit('castleDamage', data);
    });

    // Game over
    socket.on('gameOver', (data) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        room.status = 'finished';
        room.gameState.winner = data.winner;

        io.to(currentRoom).emit('gameOver', data);
        console.log(`Game over in room ${currentRoom}, winner: Team ${data.winner}`);
    });

    // Leave room
    socket.on('leaveRoom', () => {
        handleLeave();
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        handleLeave();
    });

    function handleLeave() {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const wasHost = room.hostId === socket.id;
        room.removePlayer(socket.id);

        if (room.players.size === 0) {
            // Delete empty room
            rooms.delete(currentRoom);
            console.log(`Room ${currentRoom} deleted (empty)`);
        } else if (wasHost) {
            // Transfer host to first player
            const newHost = room.players.keys().next().value;
            room.hostId = newHost;
            const hostPlayer = room.players.get(newHost);
            if (hostPlayer) hostPlayer.isHost = true;

            io.to(currentRoom).emit('hostChanged', { newHostId: newHost });
            io.to(currentRoom).emit('roomUpdate', room.serialize());
        } else {
            io.to(currentRoom).emit('roomUpdate', room.serialize());
        }

        socket.leave(currentRoom);
        currentRoom = null;
    }
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        rooms: rooms.size,
        players: Array.from(rooms.values()).reduce((sum, r) => sum + r.players.size, 0)
    });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces for LAN access

httpServer.listen(PORT, HOST, () => {
    console.log(`🎮 Medieval Lego Wars Server running on port ${PORT}`);
    console.log(`📡 LAN: http://YOUR_IP:${PORT}`);
    console.log(`💡 Find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)`);
});
