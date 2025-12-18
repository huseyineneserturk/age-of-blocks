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

// Global player counter
let connectedPlayers = 0;

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Room class with lobby support
class GameRoom {
    constructor(code, hostId, mode, options = {}) {
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

        // Lobby properties
        this.isPublic = options.isPublic !== false; // Default true
        this.password = options.password || null;
        this.hostName = options.hostName || 'Host';
        this.roomName = options.roomName || `${this.hostName}'in Odası`;
        this.createdAt = Date.now();
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
        return 2; // Only 1v1 mode is supported
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

    // Lobby serialization for listing
    serializeForLobby() {
        return {
            code: this.code,
            roomName: this.roomName,
            hostName: this.hostName,
            players: this.players.size,
            maxPlayers: this.getMaxPlayers(),
            hasPassword: !!this.password,
            createdAt: this.createdAt
        };
    }
}


io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    let currentRoom = null;

    // Increment player count and broadcast
    connectedPlayers++;
    io.emit('playerCountUpdate', { count: connectedPlayers });

    // Get active player count
    socket.on('getPlayerCount', (callback) => {
        callback({ count: connectedPlayers });
    });

    // Get lobbies list
    socket.on('getLobbies', (callback) => {
        const publicLobbies = Array.from(rooms.values())
            .filter(r => r.isPublic && r.status === 'waiting')
            .map(r => r.serializeForLobby());
        callback(publicLobbies);
    });

    // Create lobby (new method with lobby options)
    socket.on('createLobby', ({ roomName, playerName, isPublic, password }, callback) => {
        const code = generateRoomCode();
        const room = new GameRoom(code, socket.id, '1v1', {
            isPublic: isPublic !== false,
            password: password || null,
            hostName: playerName,
            roomName: roomName || null
        });
        room.addPlayer(socket.id, playerName, 1);
        rooms.set(code, room);
        currentRoom = code;

        socket.join(code);
        console.log(`Lobby ${code} "${room.roomName}" created by ${playerName} (public: ${room.isPublic}, password: ${!!room.password})`);

        callback({ success: true, roomCode: code, room: room.serialize(), roomName: room.roomName });
        io.to(code).emit('roomUpdate', room.serialize());

        // Broadcast lobby list update to all
        io.emit('lobbiesUpdate');
    });


    // Join lobby with password support
    socket.on('joinLobby', ({ roomCode, playerName, password }, callback) => {
        const room = rooms.get(roomCode.toUpperCase());

        if (!room) {
            callback({ success: false, error: 'Oda bulunamadı' });
            return;
        }

        if (room.players.size >= room.getMaxPlayers()) {
            callback({ success: false, error: 'Oda dolu' });
            return;
        }

        if (room.status !== 'waiting') {
            callback({ success: false, error: 'Oyun zaten başlamış' });
            return;
        }

        // Password check
        if (room.password && room.password !== password) {
            callback({ success: false, error: 'Yanlış şifre' });
            return;
        }

        const team = room.assignTeam();
        room.addPlayer(socket.id, playerName, team);
        currentRoom = roomCode.toUpperCase();

        socket.join(currentRoom);
        console.log(`${playerName} joined lobby ${currentRoom}`);

        callback({ success: true, room: room.serialize(), team });
        io.to(currentRoom).emit('roomUpdate', room.serialize());

        // Broadcast lobby list update
        io.emit('lobbiesUpdate');

        // NOTE: No auto-start for lobbies - host will start the game manually
    });


    // Create room (legacy method - still supported)
    socket.on('createRoom', ({ mode, playerName }, callback) => {
        const code = generateRoomCode();
        const room = new GameRoom(code, socket.id, mode, {
            isPublic: false, // Legacy rooms are private
            hostName: playerName
        });
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

        // AUTO-START: If room is now full (2 players), start game immediately
        if (room.players.size >= room.getMaxPlayers()) {
            room.status = 'playing';
            room.gameState = {
                buildings: [],
                units: [],
                castles: { team1: { hp: 1000, alive: true }, team2: { hp: 1000, alive: true } },
                winner: null
            };

            // Small delay to ensure join callback is processed first
            setTimeout(() => {
                io.to(currentRoom).emit('gameStart', { room: room.serialize() });
                console.log(`Game auto-started in room ${currentRoom}`);
            }, 100);
        }
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

        // Check minimum players
        if (room.players.size < 2) {
            callback({ success: false, error: 'En az 2 oyuncu gerekli' });
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
        io.emit('lobbiesUpdate'); // Update lobby list since room is no longer waiting
        callback({ success: true });
        console.log(`Game started in room ${currentRoom} by host`);
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
        connectedPlayers--;
        io.emit('playerCountUpdate', { count: connectedPlayers });
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
            io.emit('lobbiesUpdate');
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
        activePlayers: connectedPlayers,
        rooms: rooms.size,
        playersInRooms: Array.from(rooms.values()).reduce((sum, r) => sum + r.players.size, 0)
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🎮 Age of Blocks Server running on port ${PORT}`);
});
