// Multiplayer Room Management
import { database, ref, set, get, push, onValue, update, remove, onDisconnect, playerId } from './Firebase.js';

export class Multiplayer {
    constructor(game) {
        this.game = game;
        this.roomCode = null;
        this.roomRef = null;
        this.isHost = false;
        this.playerName = 'Player_' + Math.random().toString(36).substr(2, 4);
        this.team = 1;
        this.players = {};
        this.gameMode = '1v1'; // 1v1, 2v2, 3v3
        this.listeners = [];
    }

    // Generate 6-character room code
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Create a new room
    async createRoom(mode = '1v1', playerName = this.playerName) {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.playerName = playerName;
        this.gameMode = mode;

        const maxPlayers = this.getMaxPlayers(mode);

        this.roomRef = ref(database, `rooms/${this.roomCode}`);

        const roomData = {
            code: this.roomCode,
            host: playerId,
            mode: mode,
            status: 'waiting',
            maxPlayers: maxPlayers,
            createdAt: Date.now(),
            players: {
                [playerId]: {
                    id: playerId,
                    name: playerName,
                    team: 1,
                    ready: false,
                    isHost: true
                }
            }
        };

        await set(this.roomRef, roomData);

        // Remove room if host disconnects
        const playerRef = ref(database, `rooms/${this.roomCode}/players/${playerId}`);
        onDisconnect(playerRef).remove();

        // Start listening to room changes
        this.listenToRoom();

        return this.roomCode;
    }

    // Join existing room
    async joinRoom(roomCode, playerName = this.playerName) {
        this.roomCode = roomCode.toUpperCase();
        this.playerName = playerName;
        this.isHost = false;

        this.roomRef = ref(database, `rooms/${this.roomCode}`);

        // Check if room exists
        const snapshot = await get(this.roomRef);
        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }

        const roomData = snapshot.val();

        // Check if room is full
        const currentPlayers = Object.keys(roomData.players || {}).length;
        if (currentPlayers >= roomData.maxPlayers) {
            throw new Error('Room is full');
        }

        // Check if game already started
        if (roomData.status === 'playing') {
            throw new Error('Game already in progress');
        }

        this.gameMode = roomData.mode;

        // Assign team based on mode
        const team = this.assignTeam(roomData);
        this.team = team;

        // Add player to room
        const playerRef = ref(database, `rooms/${this.roomCode}/players/${playerId}`);
        await set(playerRef, {
            id: playerId,
            name: playerName,
            team: team,
            ready: false,
            isHost: false
        });

        // Remove player if disconnected
        onDisconnect(playerRef).remove();

        // Start listening
        this.listenToRoom();

        return roomData;
    }

    // Assign team based on current players
    assignTeam(roomData) {
        const players = roomData.players || {};
        const teamCounts = {};
        const maxTeams = this.getTeamCount(roomData.mode);

        // Count players per team
        for (let i = 1; i <= maxTeams; i++) {
            teamCounts[i] = 0;
        }

        Object.values(players).forEach(p => {
            if (teamCounts[p.team] !== undefined) {
                teamCounts[p.team]++;
            }
        });

        // Find team with least players
        let minTeam = 1;
        let minCount = Infinity;
        for (let i = 1; i <= maxTeams; i++) {
            if (teamCounts[i] < minCount) {
                minCount = teamCounts[i];
                minTeam = i;
            }
        }

        return minTeam;
    }

    // Listen to room changes
    listenToRoom() {
        const roomListener = onValue(this.roomRef, (snapshot) => {
            if (!snapshot.exists()) {
                // Room was deleted
                this.onRoomDeleted();
                return;
            }

            const data = snapshot.val();
            this.players = data.players || {};

            // Update UI
            if (this.onPlayersUpdate) {
                this.onPlayersUpdate(this.players);
            }

            // Check if game should start
            if (data.status === 'playing' && !this.game.gameStarted) {
                this.onGameStart(data);
            }
        });

        this.listeners.push(roomListener);
    }

    // Set player ready status
    async setReady(ready) {
        if (!this.roomCode) return;

        const playerRef = ref(database, `rooms/${this.roomCode}/players/${playerId}/ready`);
        await set(playerRef, ready);
    }

    // Change team
    async setTeam(team) {
        if (!this.roomCode) return;

        this.team = team;
        const playerRef = ref(database, `rooms/${this.roomCode}/players/${playerId}/team`);
        await set(playerRef, team);
    }

    // Start game (host only)
    async startGame() {
        if (!this.isHost || !this.roomCode) return;

        // Check if all players are ready
        const allReady = Object.values(this.players).every(p => p.ready || p.isHost);
        if (!allReady) {
            throw new Error('Not all players are ready');
        }

        // Initialize game state
        const initialState = {
            buildings: [],
            units: [],
            projectiles: [],
            teams: {}
        };

        // Set resources for each team
        const teamCount = this.getTeamCount(this.gameMode);
        for (let i = 1; i <= teamCount; i++) {
            initialState.teams[i] = {
                resources: 150,
                resourceRate: 1
            };
        }

        await update(this.roomRef, {
            status: 'playing',
            gameState: initialState,
            startedAt: Date.now()
        });
    }

    // Sync building placement
    async syncBuildingPlaced(building) {
        if (!this.roomCode) return;

        const buildingsRef = ref(database, `rooms/${this.roomCode}/gameState/buildings`);
        const snapshot = await get(buildingsRef);
        const buildings = snapshot.val() || [];

        // Convert local coordinates to world coordinates
        // Team 1: x stays same, Team 2: x is flipped
        const worldX = this.team === 1 ? building.x : (this.game.cols - 1 - building.x);

        buildings.push({
            id: Date.now() + '_' + playerId,
            type: building.type,
            x: worldX,
            y: building.y,
            team: this.team,
            hp: building.hp,
            maxHp: building.maxHp
        });

        await set(buildingsRef, buildings);
    }

    // Sync unit spawn
    async syncUnitSpawned(unit) {
        if (!this.roomCode) return;

        const unitsRef = ref(database, `rooms/${this.roomCode}/gameState/units`);
        const snapshot = await get(unitsRef);
        const units = snapshot.val() || [];

        // Convert local coordinates to world coordinates
        const worldX = this.team === 1 ? unit.realX : (this.game.cols - 1 - unit.realX);

        units.push({
            id: Date.now() + '_' + playerId,
            type: unit.type,
            x: worldX,
            y: unit.realY,
            team: this.team,
            hp: unit.hp,
            maxHp: unit.maxHp
        });

        await set(unitsRef, units);
    }

    // Sync resources
    async syncResources(resources, resourceRate) {
        if (!this.roomCode) return;

        const teamRef = ref(database, `rooms/${this.roomCode}/gameState/teams/${this.team}`);
        await update(teamRef, { resources, resourceRate });
    }

    // Leave room
    async leaveRoom() {
        if (!this.roomCode) return;

        const playerRef = ref(database, `rooms/${this.roomCode}/players/${playerId}`);
        await remove(playerRef);

        // If host leaves, delete room
        if (this.isHost) {
            await remove(this.roomRef);
        }

        this.roomCode = null;
        this.roomRef = null;
    }

    // Get max players for mode
    getMaxPlayers(mode) {
        switch (mode) {
            case '1v1': return 2;
            case '2v2': return 4;
            case '3v3': return 6;
            default: return 2;
        }
    }

    // Get team count for mode
    getTeamCount(mode) {
        return 2; // Always 2 teams
    }

    // Listen to game state changes
    listenToGameState() {
        if (!this.roomCode) return;

        // Listen for new buildings
        const buildingsRef = ref(database, `rooms/${this.roomCode}/gameState/buildings`);
        const buildingsListener = onValue(buildingsRef, (snapshot) => {
            const buildings = snapshot.val() || [];
            if (this.onBuildingsUpdate) {
                this.onBuildingsUpdate(buildings);
            }
        });
        this.listeners.push(buildingsListener);

        // Listen for new units
        const unitsRef = ref(database, `rooms/${this.roomCode}/gameState/units`);
        const unitsListener = onValue(unitsRef, (snapshot) => {
            const units = snapshot.val() || [];
            if (this.onUnitsUpdate) {
                this.onUnitsUpdate(units);
            }
        });
        this.listeners.push(unitsListener);

        // Listen for team resources
        const teamsRef = ref(database, `rooms/${this.roomCode}/gameState/teams`);
        const teamsListener = onValue(teamsRef, (snapshot) => {
            const teams = snapshot.val() || {};
            if (this.onTeamsUpdate) {
                this.onTeamsUpdate(teams);
            }
        });
        this.listeners.push(teamsListener);

        // Listen for game end
        const statusRef = ref(database, `rooms/${this.roomCode}/status`);
        const statusListener = onValue(statusRef, (snapshot) => {
            const status = snapshot.val();
            if (status === 'finished' && this.onGameEnd) {
                this.onGameEnd();
            }
        });
        this.listeners.push(statusListener);
    }

    // End game
    async endGame(winningTeam) {
        if (!this.roomCode) return;

        await update(this.roomRef, {
            status: 'finished',
            winner: winningTeam,
            endedAt: Date.now()
        });
    }

    // Callbacks
    onPlayersUpdate = null;
    onRoomDeleted = () => { };
    onGameStart = () => { };
    onBuildingsUpdate = null;
    onUnitsUpdate = null;
    onTeamsUpdate = null;
    onGameEnd = null;
}
