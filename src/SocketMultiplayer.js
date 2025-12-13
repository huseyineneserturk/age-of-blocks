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

        // Server URL - DigitalOcean with SSL
        this.serverUrl = 'https://server.ageofblocks.games';
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
        // Convert local coordinates to world coordinates
        // Team 1: x stays same (their left = world left)
        // Team 2: x is flipped (their left = world right)
        const worldX = this.team === 1 ? building.x : (this.game.cols - 1 - building.x);

        this.socket.emit('buildingPlaced', {
            id: building.syncId, // Use the syncId from Game.js
            type: building.type,
            x: worldX,
            y: building.y,
            hp: building.hp,
            maxHp: building.maxHp,
            senderTeam: this.team
        });
    }

    // Send unit spawn
    sendUnitSpawned(unit) {
        // Convert local coordinates to world coordinates
        const worldX = this.team === 1 ? unit.realX : (this.game.cols - 1 - unit.realX);

        this.socket.emit('unitSpawned', {
            id: unit.syncId, // Use the syncId from Game.js
            type: unit.type,
            x: worldX,
            y: unit.realY,
            hp: unit.hp,
            maxHp: unit.maxHp,
            senderTeam: this.team
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
        const cols = game.cols;

        // Convert coordinates to world space
        // Host perspective: player buildings/units are on Team 1 if host is Team 1
        const gameState = {
            units: game.units.map(u => {
                // Determine unit's actual team
                const unitTeam = u.multiplayerTeam || (u.team === 'player' ? this.team : (this.team === 1 ? 2 : 1));
                // Convert to world coordinates (Team 2 units need flip)
                const worldX = this.team === 1 ? u.realX : (cols - 1 - u.realX);

                return {
                    id: u.syncId,
                    x: worldX,
                    y: u.realY,
                    hp: u.hp,
                    alive: u.alive,
                    type: u.type,
                    team: unitTeam
                };
            }),
            buildings: game.buildings.map(b => {
                const buildingTeam = b.multiplayerTeam || (b.team === 'player' ? this.team : (this.team === 1 ? 2 : 1));
                const worldX = this.team === 1 ? b.x : (cols - 1 - b.x);

                return {
                    id: b.syncId || `${b.x}_${b.y}`,
                    x: worldX,
                    y: b.y,
                    hp: b.hp,
                    alive: b.alive,
                    type: b.type,
                    team: buildingTeam
                };
            }),
            castles: {
                // Map correctly based on host's team
                team1: {
                    hp: this.team === 1 ? game.playerCastle.hp : game.enemyCastle.hp,
                    alive: this.team === 1 ? game.playerCastle.alive : game.enemyCastle.alive
                },
                team2: {
                    hp: this.team === 1 ? game.enemyCastle.hp : game.playerCastle.hp,
                    alive: this.team === 1 ? game.enemyCastle.alive : game.playerCastle.alive
                }
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
