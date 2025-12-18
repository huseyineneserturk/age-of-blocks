import { Renderer } from './Renderer.js';
import { ParticleSystem } from './Particles.js';
import { SoundManager } from './SoundManager.js';
import { AI } from './AI.js';
import { SocketMultiplayer } from './SocketMultiplayer.js';
import {
    Castle, Mine, Barracks, ArcheryRange, Stable, Tower, Wall, Forge,
    SiegeWorkshop, MageTower, Hospital, ResearchCenter,
    Knight, Archer, Cavalry, Catapult, Mage,
    BUILDING_COSTS, BUILDING_INFO, UPGRADES
} from './Entity.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Game State
        this.lastTime = 0;
        this.resources = 150; // Starting Legos
        this.resourceRate = 1; // Passive income per second
        this.score = 0;
        this.kills = 0;
        this.gameTime = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.gameStarted = false;

        // Upgrades system
        this.upgrades = {
            damage: 0,
            health: 0,
            speed: 0,
            income: 0,
            range: 0,
            attackspeed: 0,
            spawnrate: 0,
            towerdamage: 0
        };
        this.availableUpgrades = []; // 3 random upgrades when research center is built
        this.usedUpgradeIds = []; // Track used upgrades
        this.researchPoints = 0; // Number of research selections available

        // Grid System - Larger map
        this.gridSize = 32;
        this.cols = 30;
        this.rows = 20;
        this.width = this.cols * this.gridSize;
        this.height = this.rows * this.gridSize;

        // Entities
        this.buildings = [];
        this.units = [];
        this.projectiles = [];

        // Player Interaction
        this.selectedBuilding = null;
        this.mousePos = null;

        // Systems
        this.particles = new ParticleSystem();
        this.sound = new SoundManager();
        this.ai = new AI(this);
        this.renderer = new Renderer(this.ctx, this);

        // Multiplayer - WebSocket only (Firebase removed)
        this.useWebSocket = true; // Always true now
        this.multiplayer = new SocketMultiplayer(this);
        this.isMultiplayer = false;
        this.team = 1; // Player's team in multiplayer

        this.init();
    }

    init() {
        // Resize canvas
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Initialize Castles
        this.playerCastle = new Castle(1, Math.floor(this.rows / 2) - 1, 'player');
        this.buildings.push(this.playerCastle);

        this.enemyCastle = new Castle(this.cols - 3, Math.floor(this.rows / 2) - 1, 'enemy');
        this.buildings.push(this.enemyCastle);

        // Input Handling
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.mousePos = null);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        this.setupUI();
        this.createBackgroundParticles();
    }

    createBackgroundParticles() {
        // Create floating particles in background
        const container = document.getElementById('bg-particles');
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 20}s`;
            particle.style.animationDuration = `${15 + Math.random() * 10}s`;
            container.appendChild(particle);
        }
    }

    setupUI() {
        // === PLAYER COUNT ===
        this.multiplayer.onPlayerCountUpdate = (count) => {
            const playerCountEl = document.getElementById('active-players');
            if (playerCountEl) {
                playerCountEl.textContent = count;
            }
        };

        // Initial player count fetch
        this.multiplayer.getPlayerCount().then(count => {
            const playerCountEl = document.getElementById('active-players');
            if (playerCountEl) {
                playerCountEl.textContent = count;
            }
        });

        // === SINGLE PLAYER ===
        document.getElementById('single-player-btn')?.addEventListener('click', () => {
            this.startGame();
        });

        // === LOBBY SYSTEM ===

        // Store for pending lobby join (for password modal)
        this.pendingLobbyJoin = null;


        // Lobby button - show lobby list
        document.getElementById('lobby-btn')?.addEventListener('click', async () => {
            this.showScreen('lobby-list-screen');
            await this.refreshLobbies();
        });

        // Refresh lobbies button
        document.getElementById('refresh-lobbies')?.addEventListener('click', async () => {
            await this.refreshLobbies();
        });

        // Back from lobby list
        document.getElementById('back-from-lobby')?.addEventListener('click', () => {
            this.showScreen('main-menu');
        });

        // Create lobby button (from lobby list screen)
        document.getElementById('create-lobby-btn')?.addEventListener('click', () => {
            this.showScreen('create-lobby-screen');
        });

        // Toggle visibility buttons
        document.getElementById('public-btn')?.addEventListener('click', () => {
            document.getElementById('public-btn').classList.add('active');
            document.getElementById('private-btn').classList.remove('active');
        });

        document.getElementById('private-btn')?.addEventListener('click', () => {
            document.getElementById('private-btn').classList.add('active');
            document.getElementById('public-btn').classList.remove('active');
        });

        // Back from create lobby
        document.getElementById('back-from-create-lobby')?.addEventListener('click', () => {
            this.showScreen('lobby-list-screen');
        });

        // Confirm create lobby - get form values and show lobby room
        document.getElementById('confirm-create-lobby')?.addEventListener('click', async () => {
            const roomName = document.getElementById('lobby-name')?.value.trim() || null;
            const playerName = document.getElementById('host-name')?.value.trim() || 'Player_' + Math.random().toString(36).substr(2, 4);
            const isPublic = document.getElementById('public-btn')?.classList.contains('active');
            const password = document.getElementById('lobby-password')?.value || null;

            // Validate player name
            if (!playerName || playerName.length < 2) {
                alert('Lütfen geçerli bir oyuncu adı girin');
                return;
            }

            try {
                const result = await this.multiplayer.createLobby(roomName, playerName, isPublic, password);
                this.showLobbyRoom(result.roomCode, result.roomName);
            } catch (err) {
                console.error('Create lobby error:', err);
            }
        });

        // Leave lobby button
        document.getElementById('leave-lobby-btn')?.addEventListener('click', () => {
            this.multiplayer.leaveRoom();
            this.showScreen('main-menu');
        });

        // Start game button (host only)
        document.getElementById('start-game-btn')?.addEventListener('click', async () => {
            try {
                await this.multiplayer.startGame();
            } catch (err) {
                console.log('Cannot start game:', err.message);
            }
        });

        // Players update listener - update lobby room player list
        this.multiplayer.onPlayersUpdate = (players) => {
            this.updateLobbyPlayerList(players);

            // Show/hide start button based on player count (host only)
            const startBtn = document.getElementById('start-game-btn');
            const playerCount = Object.keys(players).length;

            if (this.multiplayer.isHost && playerCount >= 2) {
                startBtn?.classList.remove('hidden');
                document.getElementById('lobby-status').textContent = 'Oyun başlatılabilir!';
            } else if (this.multiplayer.isHost) {
                startBtn?.classList.add('hidden');
                document.getElementById('lobby-status').textContent = 'Rakip bekleniyor...';
            } else {
                // Guest player
                document.getElementById('lobby-status').textContent = playerCount >= 2 ? 'Host oyunu başlatacak...' : 'Rakip bekleniyor...';
            }
        };

        // Lobbies update listener
        this.multiplayer.onLobbiesUpdate = async () => {
            const lobbyListScreen = document.getElementById('lobby-list-screen');
            if (lobbyListScreen && !lobbyListScreen.classList.contains('hidden')) {
                await this.refreshLobbies();
            }
        };

        // Join lobby modal handlers
        document.getElementById('modal-cancel')?.addEventListener('click', () => {
            document.getElementById('join-lobby-modal').classList.add('hidden');
            document.getElementById('modal-player-name').value = '';
            document.getElementById('modal-password').value = '';
            document.getElementById('modal-error').classList.add('hidden');
            this.pendingLobbyJoin = null;
        });

        document.getElementById('modal-confirm')?.addEventListener('click', async () => {
            if (!this.pendingLobbyJoin) return;

            const playerName = document.getElementById('modal-player-name')?.value.trim();
            const password = document.getElementById('modal-password')?.value || null;

            // Validate player name
            if (!playerName || playerName.length < 2) {
                const errorEl = document.getElementById('modal-error');
                errorEl.textContent = 'Lütfen geçerli bir oyuncu adı girin';
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                await this.multiplayer.joinLobby(this.pendingLobbyJoin.code, playerName, password);
                document.getElementById('join-lobby-modal').classList.add('hidden');
                document.getElementById('modal-player-name').value = '';
                document.getElementById('modal-password').value = '';
                this.showLobbyRoom(this.pendingLobbyJoin.code, this.pendingLobbyJoin.roomName);
                this.pendingLobbyJoin = null;
            } catch (err) {
                const errorEl = document.getElementById('modal-error');
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
            }
        });


        // Multiplayer game start callback
        this.multiplayer.onGameStart = (data) => {
            this.isMultiplayer = true;
            this.team = this.multiplayer.team;
            this.startMultiplayerGame(data);
        };


        // === GAME UI ===

        // Card selection
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => this.selectCard(card));
            card.addEventListener('mouseenter', (e) => this.showTooltip(e, card));
            card.addEventListener('mouseleave', () => this.hideTooltip());
        });

        // Sound controls
        document.getElementById('music-btn')?.addEventListener('click', (e) => {
            const enabled = this.sound.toggleMusic();
            e.target.classList.toggle('muted', !enabled);
        });

        document.getElementById('sfx-btn')?.addEventListener('click', (e) => {
            const enabled = this.sound.toggleSFX();
            e.target.classList.toggle('muted', !enabled);
        });

        // Exit to menu button
        document.getElementById('exit-game-btn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to exit to menu?')) {
                if (this.isMultiplayer) {
                    this.multiplayer.stopHostSync();
                    this.multiplayer.leaveRoom();
                }
                location.reload();
            }
        });

        // Restart button
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            location.reload();
        });

        // Resume button
        document.getElementById('resume-btn')?.addEventListener('click', () => {
            this.togglePause();
        });

        // Panel tabs
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.menu-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId)?.classList.remove('hidden');
    }

    showJoinError(message) {
        const errorEl = document.getElementById('join-error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        setTimeout(() => errorEl.classList.add('hidden'), 3000);
    }

    async refreshLobbies() {
        const lobbyListEl = document.getElementById('lobby-list');
        if (!lobbyListEl) return;

        try {
            const lobbies = await this.multiplayer.getLobbies();

            if (lobbies.length === 0) {
                lobbyListEl.innerHTML = '<div class="lobby-empty">Aktif lobi bulunamadı</div>';
                return;
            }

            lobbyListEl.innerHTML = lobbies.map(lobby => `
                <div class="lobby-item" data-code="${lobby.code}" data-room-name="${lobby.roomName}" data-has-password="${lobby.hasPassword}">
                    <div class="lobby-info">
                        <div class="host-name">${lobby.roomName}</div>
                        <div class="player-count">👥 ${lobby.players}/${lobby.maxPlayers} • ${lobby.hostName}</div>
                    </div>
                    <div class="lobby-status">
                        ${lobby.hasPassword ? '<span class="lock-icon">🔒</span>' : ''}
                        <span class="join-icon">➜</span>
                    </div>
                </div>
            `).join('');

            // Add click handlers
            lobbyListEl.querySelectorAll('.lobby-item').forEach(item => {
                item.addEventListener('click', () => this.handleLobbyClick(item));
            });
        } catch (err) {
            console.error('Failed to fetch lobbies:', err);
            lobbyListEl.innerHTML = '<div class="lobby-empty">Lobiler yüklenemedi</div>';
        }
    }

    handleLobbyClick(lobbyItem) {
        const code = lobbyItem.dataset.code;
        const roomName = lobbyItem.dataset.roomName;
        const hasPassword = lobbyItem.dataset.hasPassword === 'true';

        // Store pending join info
        this.pendingLobbyJoin = { code, roomName, hasPassword };

        // Show join modal (always - for player name input)
        document.getElementById('modal-player-name').value = '';
        document.getElementById('modal-password').value = '';
        document.getElementById('modal-error').classList.add('hidden');
        document.getElementById('modal-lobby-info').textContent = roomName;

        // Show/hide password field based on lobby
        const passwordGroup = document.getElementById('modal-password-group');
        if (hasPassword) {
            passwordGroup?.classList.remove('hidden');
        } else {
            passwordGroup?.classList.add('hidden');
        }

        document.getElementById('join-lobby-modal').classList.remove('hidden');
    }

    showLobbyRoom(roomCode, roomName = null) {
        this.showScreen('lobby-room-screen');

        // Store room code internally (for server communication)
        this.currentRoomCode = roomCode;

        // Set room title
        const titleEl = document.getElementById('lobby-room-title');
        if (titleEl) {
            titleEl.textContent = roomName || 'Lobi';
        }

        // Reset UI
        document.getElementById('lobby-player-list').innerHTML = '';
        document.getElementById('lobby-status').textContent = 'Rakip bekleniyor...';

        // Hide start button initially (will be shown when enough players join and if host)
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.classList.add('hidden');
        }
    }



    updateLobbyPlayerList(players) {
        const playerListEl = document.getElementById('lobby-player-list');
        if (!playerListEl) return;

        const playerArray = Object.values(players);

        playerListEl.innerHTML = playerArray.map(player => `
            <div class="player-card ${player.isHost ? 'host' : ''}">
                <span class="player-name">${player.name}</span>
                <span class="player-badge">${player.isHost ? 'Host' : 'Oyuncu'}</span>
            </div>
        `).join('');
    }




    startMultiplayerGame(data) {
        // Hide lobby, show game
        document.getElementById('start-screen').classList.add('hidden');

        // Initialize game for multiplayer
        this.gameStarted = true;
        this.isMultiplayer = true;
        this.team = this.multiplayer.team;

        // Don't use AI in multiplayer
        this.ai = null;

        // Clear single player entities
        this.buildings = [];
        this.units = [];

        // Setup castles - Each player sees themselves on the LEFT
        const rows = this.rows;

        // Player's castle is always on the left (from their perspective)
        this.playerCastle = new Castle(1, Math.floor(rows / 2) - 1, 'player');
        this.playerCastle.multiplayerTeam = this.team;
        this.buildings.push(this.playerCastle);

        // Enemy castle is always on the right (from their perspective)
        this.enemyCastle = new Castle(this.cols - 3, Math.floor(rows / 2) - 1, 'enemy');
        this.enemyCastle.multiplayerTeam = this.team === 1 ? 2 : 1;
        this.buildings.push(this.enemyCastle);

        // Setup multiplayer callbacks (works for both Firebase and WebSocket)
        if (this.useWebSocket) {
            // WebSocket (SocketMultiplayer) callbacks
            this.multiplayer.onBuildingReceived = (data) => {
                this.handleRemoteBuildingPlaced(data);
            };

            // Only host receives immediate unit spawn events
            // Non-host gets units via syncFromHostState to avoid duplication
            if (this.multiplayer.isHost) {
                this.multiplayer.onUnitReceived = (data) => {
                    this.handleRemoteUnitSpawned(data);
                };
            }

            this.multiplayer.onGameStateReceived = (gameState) => {
                this.syncFromHostState(gameState);
            };

            this.multiplayer.onGameOver = (data) => {
                if (!this.gameOver) {
                    const isPlayerWin = data.winner === this.team;
                    this.endGame(isPlayerWin);
                }
            };
        } else {
            // Firebase (Multiplayer) callbacks
            this.multiplayer.onBuildingsUpdate = (buildings) => {
                if (!this.multiplayer.isHost) {
                    this.syncBuildingsFromServer(buildings);
                }
            };

            this.multiplayer.onUnitsUpdate = (units) => {
                if (!this.multiplayer.isHost) {
                    this.syncUnitsFromServer(units);
                }
            };

            this.multiplayer.onCastlesUpdate = (castles) => {
                if (!this.multiplayer.isHost && castles) {
                    const myCastle = this.team === 1 ? castles.team1 : castles.team2;
                    const enemyCastle = this.team === 1 ? castles.team2 : castles.team1;
                    if (myCastle) {
                        this.playerCastle.hp = myCastle.hp;
                        this.playerCastle.alive = myCastle.alive;
                    }
                    if (enemyCastle) {
                        this.enemyCastle.hp = enemyCastle.hp;
                        this.enemyCastle.alive = enemyCastle.alive;
                    }
                }
            };

            this.multiplayer.onWinner = (winner) => {
                if (winner !== null && !this.gameOver) {
                    const isPlayerWin = winner === this.team;
                    this.endGame(isPlayerWin);
                }
            };

            this.multiplayer.listenToGameState();
        }

        // Host starts syncing game state
        if (this.multiplayer.isHost) {
            this.multiplayer.startHostSync();
        }

        // Start passive income loop for multiplayer
        setInterval(() => {
            if (!this.gameOver && !this.isPaused && this.gameStarted) {
                this.addResources(this.resourceRate);
            }
        }, 1000);

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    syncBuildingsFromServer(serverBuildings) {
        // Process server buildings
        serverBuildings.forEach(sb => {
            // Skip castles (handled separately)
            if (sb.type === 'castle') return;

            // Convert world coordinates to local coordinates
            const localX = this.team === 1 ? sb.x : (this.cols - 1 - sb.x);

            // Check if building is from enemy team
            const isEnemy = sb.team !== this.team;
            if (!isEnemy) return;

            // Check if we already have this building
            const existingBuilding = this.buildings.find(b => b.syncId === sb.id);

            if (existingBuilding) {
                // Update existing building HP and alive status
                existingBuilding.hp = sb.hp;
                existingBuilding.alive = sb.alive;
            } else {
                // Create new building
                let building = null;
                const team = 'enemy';

                switch (sb.type) {
                    case 'mine': building = new Mine(localX, sb.y, team); break;
                    case 'barracks': building = new Barracks(localX, sb.y, team); break;
                    case 'archery': building = new ArcheryRange(localX, sb.y, team); break;
                    case 'stable': building = new Stable(localX, sb.y, team); break;
                    case 'siege': building = new SiegeWorkshop(localX, sb.y, team); break;
                    case 'mage': building = new MageTower(localX, sb.y, team); break;
                    case 'tower': building = new Tower(localX, sb.y, team); break;
                    case 'wall': building = new Wall(localX, sb.y, team); break;
                    case 'forge': building = new Forge(localX, sb.y, team); break;
                    case 'hospital': building = new Hospital(localX, sb.y, team); break;
                    case 'research': building = new ResearchCenter(localX, sb.y, team); break;
                }

                if (building) {
                    building.syncId = sb.id;
                    building.isBuilding = false;
                    building.hp = sb.hp;
                    building.alive = sb.alive;
                    building.multiplayerTeam = sb.team;
                    this.buildings.push(building);
                }
            }
        });

        // Remove buildings that are dead on server
        this.buildings = this.buildings.filter(b => {
            if (b.syncId && !b.alive) return false;
            return true;
        });
    }

    syncUnitsFromServer(serverUnits) {
        // Process server units
        serverUnits.forEach(su => {
            // Skip if from our team
            if (su.team === this.team) return;

            // Convert world coordinates to local coordinates
            const localX = this.team === 1 ? su.x : (this.cols - 1 - su.x);

            // Check if we already have this unit
            const existingUnit = this.units.find(u => u.syncId === su.id);

            if (existingUnit) {
                // Update existing unit - position and HP
                existingUnit.realX = localX;
                existingUnit.realY = su.y;
                existingUnit.hp = su.hp;
                existingUnit.alive = su.alive;
            } else if (su.alive) {
                // Create new unit only if alive
                let unit = null;
                const team = 'enemy';

                switch (su.type) {
                    case 'knight': unit = new Knight(localX, su.y, team); break;
                    case 'archer': unit = new Archer(localX, su.y, team); break;
                    case 'cavalry': unit = new Cavalry(localX, su.y, team); break;
                    case 'catapult': unit = new Catapult(localX, su.y, team); break;
                    case 'mage': unit = new Mage(localX, su.y, team); break;
                }

                if (unit) {
                    unit.syncId = su.id;
                    unit.hp = su.hp;
                    unit.multiplayerTeam = su.team;
                    this.units.push(unit);
                }
            }
        });

        // Remove dead units
        this.units = this.units.filter(u => u.alive);
    }

    // WebSocket: Handle remote building placed
    handleRemoteBuildingPlaced(data) {
        // Convert world coordinates to local (flip for team 2)
        const localX = this.team === 1 ? data.x : (this.cols - 1 - data.x);

        let building = null;
        const team = 'enemy';

        switch (data.type) {
            case 'mine': building = new Mine(localX, data.y, team); break;
            case 'barracks': building = new Barracks(localX, data.y, team); break;
            case 'archery': building = new ArcheryRange(localX, data.y, team); break;
            case 'stable': building = new Stable(localX, data.y, team); break;
            case 'siege': building = new SiegeWorkshop(localX, data.y, team); break;
            case 'mage': building = new MageTower(localX, data.y, team); break;
            case 'tower': building = new Tower(localX, data.y, team); break;
            case 'wall': building = new Wall(localX, data.y, team); break;
            case 'forge': building = new Forge(localX, data.y, team); break;
            case 'hospital': building = new Hospital(localX, data.y, team); break;
            case 'research': building = new ResearchCenter(localX, data.y, team); break;
        }

        if (building) {
            building.syncId = data.id;
            building.isBuilding = false;
            building.hp = data.hp;
            building.multiplayerTeam = data.senderTeam || data.team;
            this.buildings.push(building);
            this.particles.spawnBuild(localX * this.cellSize + this.cellSize / 2, data.y * this.cellSize + this.cellSize / 2);
        }
    }

    // WebSocket: Handle remote unit spawned
    handleRemoteUnitSpawned(data) {
        const localX = this.team === 1 ? data.x : (this.cols - 1 - data.x);

        let unit = null;
        const team = 'enemy';

        switch (data.type) {
            case 'knight': unit = new Knight(localX, data.y, team); break;
            case 'archer': unit = new Archer(localX, data.y, team); break;
            case 'cavalry': unit = new Cavalry(localX, data.y, team); break;
            case 'catapult': unit = new Catapult(localX, data.y, team); break;
            case 'mage': unit = new Mage(localX, data.y, team); break;
        }

        if (unit) {
            unit.syncId = data.id;
            unit.hp = data.hp;
            unit.multiplayerTeam = data.senderTeam || data.team;
            this.units.push(unit);
        }
    }

    // WebSocket: Sync from host state (for non-host clients)
    syncFromHostState(gameState) {
        if (this.multiplayer.isHost) return;

        // Update castles
        if (gameState.castles) {
            const myCastle = this.team === 1 ? gameState.castles.team1 : gameState.castles.team2;
            const enemyCastle = this.team === 1 ? gameState.castles.team2 : gameState.castles.team1;

            if (myCastle) {
                this.playerCastle.hp = myCastle.hp;
                this.playerCastle.alive = myCastle.alive;
            }
            if (enemyCastle) {
                this.enemyCastle.hp = enemyCastle.hp;
                this.enemyCastle.alive = enemyCastle.alive;
            }
        }

        // Sync ALL units from host (both player and enemy)
        if (gameState.units) {
            // Create a set of server unit IDs for cleanup
            const serverUnitIds = new Set(gameState.units.map(u => u.id));

            gameState.units.forEach(su => {
                // Convert world coordinates to local
                const localX = this.team === 1 ? su.x : (this.cols - 1 - su.x);
                const isMyTeam = su.team === this.team;
                const existingUnit = this.units.find(u => u.syncId === su.id);

                if (existingUnit) {
                    // Update existing unit position and HP
                    existingUnit.realX = localX;
                    existingUnit.realY = su.y;
                    existingUnit.hp = su.hp;
                    existingUnit.alive = su.alive;
                } else if (su.alive) {
                    // Create missing unit
                    let unit = null;
                    const team = isMyTeam ? 'player' : 'enemy';

                    switch (su.type) {
                        case 'knight': unit = new Knight(localX, su.y, team); break;
                        case 'archer': unit = new Archer(localX, su.y, team); break;
                        case 'cavalry': unit = new Cavalry(localX, su.y, team); break;
                        case 'catapult': unit = new Catapult(localX, su.y, team); break;
                        case 'mage': unit = new Mage(localX, su.y, team); break;
                    }

                    if (unit) {
                        unit.syncId = su.id;
                        unit.hp = su.hp;
                        unit.multiplayerTeam = su.team;
                        this.units.push(unit);
                    }
                }
            });

            // Remove units that don't exist on server anymore
            this.units = this.units.filter(u => {
                if (!u.syncId) return true; // Keep local units without syncId
                return serverUnitIds.has(u.syncId) && u.alive;
            });
        }

        // Sync ALL buildings from host
        if (gameState.buildings) {
            const serverBuildingIds = new Set(gameState.buildings.map(b => b.id));

            gameState.buildings.forEach(sb => {
                if (sb.type === 'castle') return; // Skip castles

                const localX = this.team === 1 ? sb.x : (this.cols - 1 - sb.x);
                const existingBuilding = this.buildings.find(b => b.syncId === sb.id);

                if (existingBuilding) {
                    existingBuilding.hp = sb.hp;
                    existingBuilding.alive = sb.alive;
                }
            });

            // Remove dead buildings
            this.buildings = this.buildings.filter(b => {
                if (b.type === 'castle') return true; // Never remove castles
                if (!b.syncId) return true;
                return b.alive;
            });
        }
    }

    switchTab(tab) {
        // Remove active from all tabs and panels
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));

        // Activate clicked tab and its panel
        tab.classList.add('active');
        const panelId = tab.dataset.panel;
        document.getElementById(panelId).classList.add('active');
    }

    generateUpgrades() {
        // Increment research points
        this.researchPoints++;

        // Generate new upgrades if none are available
        if (this.availableUpgrades.length === 0) {
            this.refreshUpgradeChoices();
        }

        this.updateResearchPanel();

        // Show/update badge on research tab
        this.updateResearchBadge();
    }

    refreshUpgradeChoices() {
        // Get unused upgrades
        const available = UPGRADES.filter(u => !this.usedUpgradeIds.includes(u.id));

        if (available.length < 3) {
            this.availableUpgrades = available;
        } else {
            // Pick 3 random upgrades
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            this.availableUpgrades = shuffled.slice(0, 3);
        }
    }

    updateResearchBadge() {
        const researchTab = document.getElementById('research-tab');
        let badge = researchTab.querySelector('.badge');

        if (this.researchPoints > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge';
                researchTab.appendChild(badge);
            }
            badge.textContent = this.researchPoints;
        } else if (badge) {
            badge.remove();
        }
    }

    updateResearchPanel() {
        const panel = document.getElementById('research-panel');
        panel.innerHTML = '';

        if (this.availableUpgrades.length === 0) {
            panel.innerHTML = `
                <div class="no-research">
                    <div>🔬 No upgrades available</div>
                    <div class="hint">Build a Research Center to unlock upgrades!</div>
                </div>
            `;
            return;
        }

        const icons = {
            damage: '⚔️', health: '❤️', speed: '💨', income: '💰',
            range: '🎯', attackspeed: '⚡', spawnrate: '🏭', towerdamage: '🗼'
        };

        this.availableUpgrades.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <div class="upgrade-icon">${icons[upgrade.effect.type] || '📚'}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.desc}</div>
            `;
            card.addEventListener('click', () => this.selectUpgrade(upgrade));
            panel.appendChild(card);
        });
    }

    selectUpgrade(upgrade) {
        // Apply upgrade
        this.upgrades[upgrade.effect.type] += upgrade.effect.value;

        // Special handling for income
        if (upgrade.effect.type === 'income') {
            this.resourceRate += upgrade.effect.value;
        }

        // Mark as used
        this.usedUpgradeIds.push(upgrade.id);

        // Decrement research points
        this.researchPoints--;

        // Show notification
        this.showNotification(`Upgraded: ${upgrade.name}!`, 'success');
        this.sound.playSound('build');

        // Generate new upgrade choices if we still have research points
        if (this.researchPoints > 0) {
            this.refreshUpgradeChoices();
            this.updateResearchPanel();
            this.updateResearchBadge();
        } else {
            // Clear available upgrades and update UI
            this.availableUpgrades = [];
            this.updateResearchPanel();
            this.updateResearchBadge();

            // Switch back to buildings tab
            const buildingsTab = document.querySelector('[data-panel="controls"]');
            this.switchTab(buildingsTab);
        }
    }

    selectCard(card) {
        if (!this.gameStarted || this.gameOver) return;

        const buildingId = card.dataset.id;
        const cost = BUILDING_COSTS[buildingId];

        document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));

        if (this.selectedBuilding === buildingId) {
            this.selectedBuilding = null;
        } else if (this.resources >= cost) {
            this.selectedBuilding = buildingId;
            card.classList.add('selected');
            this.sound.playSound('select');
        } else {
            this.showNotification('Not enough Legos!', 'warning');
        }
    }

    showTooltip(e, card) {
        const buildingId = card.dataset.id;
        const info = BUILDING_INFO[buildingId];
        if (!info) return;

        const tooltip = document.getElementById('tooltip');
        tooltip.querySelector('.tooltip-title').textContent = info.name;
        tooltip.querySelector('.tooltip-desc').textContent = info.desc;

        const statsContainer = tooltip.querySelector('.tooltip-stats');
        statsContainer.innerHTML = '';

        for (const [key, val] of Object.entries(info.stats)) {
            const stat = document.createElement('div');
            stat.className = 'tooltip-stat';
            stat.innerHTML = `<span class="key">${key}:</span><span class="val">${val}</span>`;
            statsContainer.appendChild(stat);
        }

        const rect = card.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2 - 125}px`;
        tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        tooltip.style.top = 'auto';

        tooltip.classList.add('visible');
    }

    hideTooltip() {
        document.getElementById('tooltip').classList.remove('visible');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        container.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        this.gameStarted = true;
        this.sound.init();
        this.start();
    }

    start() {
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));

        // Passive Income Loop
        setInterval(() => {
            if (!this.gameOver && !this.isPaused && this.gameStarted) {
                this.addResources(this.resourceRate);
            }
        }, 1000);
    }

    gameLoop(timestamp) {
        if (this.gameOver) return;

        const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        if (!this.isPaused && this.gameStarted) {
            this.update(deltaTime);
        }

        this.renderer.render();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
        // Update game time
        this.gameTime += dt;

        // Update AI (only in single player)
        if (this.ai) {
            this.ai.update(dt);
        }

        // Update Buildings
        this.buildings.forEach(b => {
            if (b.update) b.update(dt, this);
        });

        // Update Units
        this.units.forEach(unit => unit.update(dt, this));

        // Update Projectiles
        this.updateProjectiles(dt);

        // Update Particles
        this.particles.update(dt);

        // Cleanup dead entities
        this.units = this.units.filter(u => u.alive);
        this.buildings = this.buildings.filter(b => b.alive);

        // Check Win Condition
        if (!this.playerCastle.alive) {
            this.endGame(false);
        } else if (!this.enemyCastle.alive) {
            this.endGame(true);
        }

        this.updateUI();
        this.updateCardStates();
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.progress += p.speed * dt / Math.hypot(
                p.targetX - p.x,
                p.targetY - p.y
            );

            if (p.progress >= 1) {
                // Projectile hit
                if (p.target && p.target.alive && p.damage) {
                    let dmg = p.damage;

                    // Check for forge bonus
                    const forge = this.buildings.find(b =>
                        b.type === 'forge' &&
                        b.team === p.team &&
                        !b.isBuilding
                    );
                    if (forge) {
                        const dist = Math.hypot(forge.x - p.x, forge.y - p.y);
                        if (dist <= forge.buffRadius) {
                            dmg *= forge.damageBonus;
                        }
                    }

                    p.target.takeDamage(dmg, this);

                    // Splash damage for boulders
                    if (p.splash) {
                        this.applySplashDamage(p.targetX, p.targetY, p.splashRadius, dmg * 0.5, p.team);
                        this.particles.spawnExplosion(p.targetX, p.targetY, p.splashRadius);
                    }

                    // Kill reward
                    if (!p.target.alive && p.target.team !== p.team && p.team === 'player') {
                        const reward = 10;
                        this.addResources(reward);
                        this.addScore(reward * 2);
                        this.kills++;
                    }
                }

                this.projectiles.splice(i, 1);
            }
        }
    }

    applySplashDamage(x, y, radius, damage, fromTeam) {
        // Damage all enemies in radius
        [...this.units, ...this.buildings].forEach(entity => {
            if (entity.team !== fromTeam && entity.alive) {
                const dist = Math.hypot((entity.realX || entity.x) - x, (entity.realY || entity.y) - y);
                if (dist <= radius) {
                    entity.takeDamage(damage * (1 - dist / radius), this);
                }
            }
        });
    }

    handleClick(e) {
        if (this.gameOver || !this.gameStarted || this.isPaused) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const gridX = Math.floor(x / this.gridSize);
        const gridY = Math.floor(y / this.gridSize);

        if (this.selectedBuilding) {
            this.tryPlaceBuilding(gridX, gridY, this.selectedBuilding);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleKeyDown(e) {
        if (!this.gameStarted) return;

        // Number keys for building selection
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 8) {
            const cards = document.querySelectorAll('.card');
            if (cards[keyNum - 1]) {
                this.selectCard(cards[keyNum - 1]);
            }
        }

        // Escape to deselect or pause
        if (e.key === 'Escape') {
            if (this.selectedBuilding) {
                this.selectedBuilding = null;
                document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
            } else {
                this.togglePause();
            }
        }

        // P to pause
        if (e.key === 'p' || e.key === 'P') {
            this.togglePause();
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-overlay').classList.toggle('hidden', !this.isPaused);
    }

    canPlaceBuilding(x, y, type) {
        // Check bounds (Player side only: x < cols / 2)
        if (x >= this.cols / 2 - 1) return false;
        if (x < 0 || y < 0 || y >= this.rows) return false;

        // Check collision with existing buildings
        const occupied = this.buildings.some(b => {
            return x >= b.x && x < b.x + b.width &&
                y >= b.y && y < b.y + b.height;
        });

        return !occupied;
    }

    tryPlaceBuilding(x, y, type) {
        if (!this.canPlaceBuilding(x, y, type)) {
            this.sound.playSound('click');
            return;
        }

        const cost = BUILDING_COSTS[type];
        if (this.resources < cost) {
            this.showNotification('Not enough Legos!', 'warning');
            return;
        }

        let building = null;

        switch (type) {
            case 'mine':
                building = new Mine(x, y, 'player');
                this.resourceRate += 1;
                break;
            case 'barracks':
                building = new Barracks(x, y, 'player');
                break;
            case 'archery':
                building = new ArcheryRange(x, y, 'player');
                break;
            case 'stable':
                building = new Stable(x, y, 'player');
                break;
            case 'siege':
                building = new SiegeWorkshop(x, y, 'player');
                break;
            case 'mage':
                building = new MageTower(x, y, 'player');
                break;
            case 'tower':
                building = new Tower(x, y, 'player');
                break;
            case 'wall':
                building = new Wall(x, y, 'player');
                break;
            case 'forge':
                building = new Forge(x, y, 'player');
                break;
            case 'hospital':
                building = new Hospital(x, y, 'player');
                break;
            case 'research':
                building = new ResearchCenter(x, y, 'player');
                // Generate 3 random upgrades when built
                setTimeout(() => this.generateUpgrades(), 1500);
                break;
        }

        if (building) {
            this.resources -= cost;
            this.buildings.push(building);
            this.particles.spawnBuild(x, y);
            this.sound.playSound('build');
            this.addScore(cost / 2);

            // Sync to multiplayer
            if (this.isMultiplayer) {
                building.multiplayerTeam = this.team;
                building.syncId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                if (this.useWebSocket) {
                    this.multiplayer.sendBuildingPlaced(building);
                } else {
                    this.multiplayer.syncBuildingPlaced(building);
                }
            }
        }
    }

    spawnEnemyBuilding(x, y, type) {
        let building = null;

        switch (type) {
            case 'mine':
                building = new Mine(x, y, 'enemy');
                break;
            case 'barracks':
                building = new Barracks(x, y, 'enemy');
                break;
            case 'archery':
                building = new ArcheryRange(x, y, 'enemy');
                break;
            case 'stable':
                building = new Stable(x, y, 'enemy');
                break;
            case 'tower':
                building = new Tower(x, y, 'enemy');
                break;
        }

        if (building) {
            building.isBuilding = false; // Enemy buildings are instant
            this.buildings.push(building);
        }
    }

    spawnUnit(x, y, team, type) {
        // MULTIPLAYER: On non-host client, don't spawn enemy units from buildings
        // Enemy units will come from host via syncFromHostState
        if (this.isMultiplayer && this.useWebSocket && !this.multiplayer.isHost) {
            if (team === 'enemy') {
                // Don't spawn enemy units locally on non-host
                return;
            }
        }

        let unit = null;

        switch (type) {
            case 'knight':
                unit = new Knight(x, y, team);
                break;
            case 'archer':
                unit = new Archer(x, y, team);
                break;
            case 'cavalry':
                unit = new Cavalry(x, y, team);
                break;
            case 'catapult':
                unit = new Catapult(x, y, team);
                break;
            case 'mage':
                unit = new Mage(x, y, team);
                break;
        }

        if (unit) {
            this.units.push(unit);
            if (team === 'player') {
                this.sound.playSound('spawn');

                // Sync to multiplayer
                if (this.isMultiplayer) {
                    unit.multiplayerTeam = this.team;
                    unit.syncId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                    if (this.useWebSocket) {
                        this.multiplayer.sendUnitSpawned(unit);
                    } else {
                        this.multiplayer.syncUnitSpawned(unit);
                    }
                }
            }
        }
    }

    addResources(amount) {
        this.resources += amount;
        if (amount > 5) {
            this.sound.playSound('resource');
        }
    }

    addScore(points) {
        this.score += Math.floor(points);
    }

    updateUI() {
        document.getElementById('lego-count').textContent = Math.floor(this.resources);
        document.getElementById('lego-rate').textContent = this.resourceRate;
        document.getElementById('score-value').textContent = this.score;

        // Castle health bars
        const playerHpPct = (this.playerCastle.hp / this.playerCastle.maxHp) * 100;
        const enemyHpPct = (this.enemyCastle.hp / this.enemyCastle.maxHp) * 100;

        document.getElementById('player-hp-bar').style.width = `${playerHpPct}%`;
        document.getElementById('enemy-hp-bar').style.width = `${enemyHpPct}%`;
        document.getElementById('player-hp').textContent = Math.max(0, Math.floor(this.playerCastle.hp));
        document.getElementById('enemy-hp').textContent = Math.max(0, Math.floor(this.enemyCastle.hp));
    }

    updateCardStates() {
        document.querySelectorAll('.card').forEach(card => {
            const cost = BUILDING_COSTS[card.dataset.id];
            card.classList.toggle('disabled', this.resources < cost);
        });
    }

    endGame(playerWon) {
        this.gameOver = true;

        const winnerText = document.getElementById('winner-text');
        winnerText.textContent = playerWon ? 'Victory!' : 'Defeat!';
        winnerText.className = playerWon ? 'victory' : 'defeat';

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-kills').textContent = this.kills;

        // Format game time as M:SS
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = Math.floor(this.gameTime % 60);
        document.getElementById('final-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('game-over-screen').classList.remove('hidden');

        this.sound.playSound(playerWon ? 'victory' : 'defeat');
    }
}
