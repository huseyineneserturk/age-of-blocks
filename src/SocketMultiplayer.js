// Socket.IO based Multiplayer Manager
export class SocketMultiplayer {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomCode = null;
        this.isHost = false;
        this.playerName = 'Player_' + Math.random().toString(36).substr(2, 4);
        this.team = 1;
        this.players = {};
        this.gameMode = '1v1';
        this.connected = false;
        this.syncInterval = null;
        this.SYNC_RATE = 50; // 50ms for smooth sync

        // Server URL - Render.com deployed server
        this.serverUrl = 'https://medieval-lego-wars.onrender.com';
    }

    // Connect to server
    async connect() {
        return new Promise((resolve, reject) => {
            // Load Socket.IO client
            if (!window.io) {
                const script = document.createElement('script');
                script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                script.onload = () => {
                    this.initSocket();
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            } else {
                this.initSocket();
                resolve();
            }
        });
    }

    initSocket() {
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('Connected to game server');
            this.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
        });

        // Room updates
        this.socket.on('roomUpdate', (room) => {
            this.players = room.players;
            if (this.onPlayersUpdate) {
                this.onPlayersUpdate(room.players);
            }
        });

        // Game start
        this.socket.on('gameStart', (data) => {
            if (this.onGameStart) {
                this.onGameStart(data);
            }
        });

        // Building placed by other player
        this.socket.on('buildingPlaced', (data) => {
            if (this.onBuildingReceived) {
                this.onBuildingReceived(data);
            }
        });

        // Unit spawned by other player
        this.socket.on('unitSpawned', (data) => {
            if (this.onUnitReceived) {
                this.onUnitReceived(data);
            }
        });

        // Game state update (from host)
        this.socket.on('gameStateUpdate', (gameState) => {
            if (this.onGameStateReceived) {
                this.onGameStateReceived(gameState);
            }
        });

        // Castle damage
        this.socket.on('castleDamage', (data) => {
            if (this.onCastleDamage) {
                this.onCastleDamage(data);
            }
        });

        // Game over
        this.socket.on('gameOver', (data) => {
            if (this.onGameOver) {
                this.onGameOver(data);
            }
        });

        // Host changed
        this.socket.on('hostChanged', (data) => {
            if (data.newHostId === this.socket.id) {
                this.isHost = true;
                console.log('You are now the host');
            }
        });
    }

    // Create room
    async createRoom(mode, playerName) {
        await this.connect();

        return new Promise((resolve, reject) => {
            this.socket.emit('createRoom', { mode, playerName }, (response) => {
                if (response.success) {
                    this.roomCode = response.roomCode;
                    this.isHost = true;
                    this.playerName = playerName;
                    this.gameMode = mode;
                    this.team = 1;
                    resolve(response.roomCode);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    // Join room
    async joinRoom(roomCode, playerName) {
        await this.connect();

        return new Promise((resolve, reject) => {
            this.socket.emit('joinRoom', { roomCode, playerName }, (response) => {
                if (response.success) {
                    this.roomCode = roomCode.toUpperCase();
                    this.isHost = false;
                    this.playerName = playerName;
                    this.gameMode = response.room.mode;
                    this.team = response.team;
                    resolve(response.room);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    // Toggle ready
    async setReady(ready) {
        return new Promise((resolve) => {
            this.socket.emit('toggleReady', (response) => {
                resolve(response);
            });
        });
    }

    // Switch team
    async setTeam(team) {
        this.team = team;
        this.socket.emit('switchTeam');
    }

    // Start game
    async startGame() {
        return new Promise((resolve, reject) => {
            this.socket.emit('startGame', (response) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    // Send building placement
    sendBuildingPlaced(building) {
        this.socket.emit('buildingPlaced', {
            id: Date.now() + '_' + this.socket.id,
            type: building.type,
            x: building.x,
            y: building.y,
            hp: building.hp,
            maxHp: building.maxHp
        });
    }

    // Send unit spawn
    sendUnitSpawned(unit) {
        this.socket.emit('unitSpawned', {
            id: Date.now() + '_' + this.socket.id,
            type: unit.type,
            x: unit.realX,
            y: unit.realY,
            hp: unit.hp,
            maxHp: unit.maxHp
        });
    }

    // Host sync game state
    startHostSync() {
        if (!this.isHost) return;

        this.syncInterval = setInterval(() => {
            this.syncGameState();
        }, this.SYNC_RATE);
    }

    stopHostSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    syncGameState() {
        if (!this.isHost || !this.game.gameStarted) return;

        const game = this.game;

        // Minimal state for sync
        const gameState = {
            units: game.units.map(u => ({
                id: u.syncId,
                x: u.realX,
                y: u.realY,
                hp: u.hp,
                alive: u.alive,
                type: u.type,
                team: u.multiplayerTeam || (u.team === 'player' ? this.team : (this.team === 1 ? 2 : 1))
            })),
            buildings: game.buildings.map(b => ({
                id: b.syncId || `${b.x}_${b.y}`,
                x: b.x,
                y: b.y,
                hp: b.hp,
                alive: b.alive,
                type: b.type,
                team: b.multiplayerTeam || (b.team === 'player' ? this.team : (this.team === 1 ? 2 : 1))
            })),
            castles: {
                team1: { hp: game.playerCastle.hp, alive: game.playerCastle.alive },
                team2: { hp: game.enemyCastle.hp, alive: game.enemyCastle.alive }
            },
            timestamp: Date.now()
        };

        // Check winner
        if (!game.playerCastle.alive) {
            this.socket.emit('gameOver', { winner: this.team === 1 ? 2 : 1 });
        } else if (!game.enemyCastle.alive) {
            this.socket.emit('gameOver', { winner: this.team });
        }

        this.socket.emit('gameStateSync', gameState);
    }

    // Leave room
    leaveRoom() {
        this.stopHostSync();
        if (this.socket) {
            this.socket.emit('leaveRoom');
        }
        this.roomCode = null;
    }

    // Disconnect
    disconnect() {
        this.stopHostSync();
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // Get max players
    getMaxPlayers(mode) {
        switch (mode) {
            case 'ffa': return 4;
            case '1v1': return 2;
            case '2v2': return 4;
            case '3v3': return 6;
            default: return 2;
        }
    }

    // Callbacks
    onPlayersUpdate = null;
    onGameStart = null;
    onBuildingReceived = null;
    onUnitReceived = null;
    onGameStateReceived = null;
    onCastleDamage = null;
    onGameOver = null;
}
