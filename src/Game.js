import { Renderer } from './Renderer.js';
import { ParticleSystem } from './Particles.js';
import { SoundManager } from './SoundManager.js';
import { AI } from './AI.js';
import { Multiplayer } from './Multiplayer.js';
import {
    Castle, Mine, Farm, Barracks, ArcheryRange, Stable, Tower, Wall, Forge,
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

        // Multiplayer
        this.multiplayer = new Multiplayer(this);
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
        // === LOBBY UI ===

        // Single Player button
        document.getElementById('single-player-btn')?.addEventListener('click', () => {
            this.startGame();
        });

        // Create Room button
        document.getElementById('create-room-btn')?.addEventListener('click', () => {
            this.showScreen('create-room-screen');
        });

        // Join Room button
        document.getElementById('join-room-btn')?.addEventListener('click', () => {
            this.showScreen('join-room-screen');
        });

        // Back buttons
        document.getElementById('back-from-create')?.addEventListener('click', () => {
            this.showScreen('main-menu');
        });

        document.getElementById('back-from-join')?.addEventListener('click', () => {
            this.showScreen('main-menu');
        });

        // Mode selector
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Confirm Create Room
        document.getElementById('confirm-create-btn')?.addEventListener('click', async () => {
            const name = document.getElementById('create-player-name').value || 'Player';
            const mode = document.querySelector('.mode-btn.selected')?.dataset.mode || '1v1';

            try {
                const roomCode = await this.multiplayer.createRoom(mode, name);
                this.showLobby(roomCode, mode);
            } catch (err) {
                console.error('Create room error:', err);
            }
        });

        // Confirm Join Room
        document.getElementById('confirm-join-btn')?.addEventListener('click', async () => {
            const name = document.getElementById('join-player-name').value || 'Player';
            const code = document.getElementById('room-code-input').value.toUpperCase();

            if (code.length !== 6) {
                this.showJoinError('Room code must be 6 characters');
                return;
            }

            try {
                const roomData = await this.multiplayer.joinRoom(code, name);
                this.showLobby(code, roomData.mode);
            } catch (err) {
                this.showJoinError(err.message);
            }
        });

        // Switch Team
        document.getElementById('switch-team-btn')?.addEventListener('click', async () => {
            const newTeam = this.multiplayer.team === 1 ? 2 : 1;
            await this.multiplayer.setTeam(newTeam);
        });

        // Ready button
        document.getElementById('ready-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('ready-btn');
            const isReady = btn.classList.toggle('ready');
            btn.textContent = isReady ? 'Ready ✓' : 'Ready';
            await this.multiplayer.setReady(isReady);
        });

        // Leave Room
        document.getElementById('leave-room-btn')?.addEventListener('click', async () => {
            await this.multiplayer.leaveRoom();
            this.showScreen('main-menu');
        });

        // Start Game (Host only)
        document.getElementById('start-game-btn')?.addEventListener('click', async () => {
            if (!this.multiplayer.isHost) return;

            try {
                await this.multiplayer.startGame();
            } catch (err) {
                alert(err.message);
            }
        });

        // Multiplayer callbacks
        this.multiplayer.onPlayersUpdate = (players) => this.updateLobbyPlayers(players);
        this.multiplayer.onRoomDeleted = () => {
            alert('Room was closed');
            this.showScreen('main-menu');
        };
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

    showLobby(roomCode, mode) {
        this.showScreen('lobby-screen');
        document.getElementById('lobby-room-code').textContent = roomCode;
        document.getElementById('lobby-mode').textContent = mode;

        // Show/hide start button based on host status
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.style.display = this.multiplayer.isHost ? 'block' : 'none';
        }
    }

    updateLobbyPlayers(players) {
        const team1List = document.getElementById('team1-players');
        const team2List = document.getElementById('team2-players');

        team1List.innerHTML = '';
        team2List.innerHTML = '';

        Object.values(players).forEach(player => {
            const div = document.createElement('div');
            div.className = 'player-item' + (player.ready ? ' ready' : '') + (player.isHost ? ' host' : '');
            div.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.ready ? '<span class="ready-badge">Ready</span>' : ''}
            `;

            if (player.team === 1) {
                team1List.appendChild(div);
            } else {
                team2List.appendChild(div);
            }
        });
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

        // Setup multiplayer callbacks
        this.multiplayer.onBuildingsUpdate = (buildings) => {
            // Only non-host clients apply building updates from server
            if (!this.multiplayer.isHost) {
                this.syncBuildingsFromServer(buildings);
            }
        };

        this.multiplayer.onUnitsUpdate = (units) => {
            // Only non-host clients apply unit updates from server
            if (!this.multiplayer.isHost) {
                this.syncUnitsFromServer(units);
            }
        };

        this.multiplayer.onTeamsUpdate = (teams) => {
            // Update resources from other team's data
        };

        this.multiplayer.onCastlesUpdate = (castles) => {
            // Non-host clients update castle HP from server
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

        this.multiplayer.onGameEnd = () => {
            // Handle game end from server
        };

        // Start listening to game state
        this.multiplayer.listenToGameState();

        // Host starts syncing game state
        if (this.multiplayer.isHost) {
            this.multiplayer.startHostSync();
        }

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
                    case 'farm': building = new Farm(localX, sb.y, team); break;
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
        // Client receives ALL units from host
        serverUnits.forEach(su => {
            // Convert world coordinates to local coordinates
            const localX = this.team === 1 ? su.x : (this.cols - 1 - su.x);

            // Determine local team representation
            const team = su.team === this.team ? 'player' : 'enemy';

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
        // Get unused upgrades
        const available = UPGRADES.filter(u => !this.usedUpgradeIds.includes(u.id));

        if (available.length < 3) {
            this.availableUpgrades = available;
        } else {
            // Pick 3 random upgrades
            const shuffled = [...available].sort(() => Math.random() - 0.5);
            this.availableUpgrades = shuffled.slice(0, 3);
        }

        this.updateResearchPanel();

        // Show badge on research tab
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '!';
        const researchTab = document.getElementById('research-tab');
        if (!researchTab.querySelector('.badge')) {
            researchTab.appendChild(badge);
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

        // Clear available upgrades
        this.availableUpgrades = [];
        this.updateResearchPanel();

        // Remove badge
        const badge = document.getElementById('research-tab').querySelector('.badge');
        if (badge) badge.remove();

        // Show notification
        this.showNotification(`Upgraded: ${upgrade.name}!`, 'success');
        this.sound.playSound('build');

        // Switch back to buildings tab
        const buildingsTab = document.querySelector('[data-panel="controls"]');
        this.switchTab(buildingsTab);
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

        // Update minimap
        const minimapCanvas = document.getElementById('minimapCanvas');
        if (minimapCanvas) {
            minimapCanvas.width = 180;
            minimapCanvas.height = 120;
            this.renderer.renderMinimap(minimapCanvas);
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
        // Update game time
        this.gameTime += dt;

        // In multiplayer, only host runs full simulation
        // Client just receives and renders state from host
        if (this.isMultiplayer && !this.multiplayer.isHost) {
            // Client only updates UI and checks win condition from synced data
            this.updateUI();
            this.updateCardStates();
            return;
        }

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
            case 'farm':
                building = new Farm(x, y, 'player');
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
                this.multiplayer.syncBuildingPlaced(building);
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
        // In multiplayer, only host can spawn enemy units
        // Client spawns player units, host handles enemy sync
        if (this.isMultiplayer && !this.multiplayer.isHost && team === 'enemy') {
            // Non-host clients don't spawn enemy units locally
            // They will receive them via sync
            return;
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
            // Assign syncId immediately for multiplayer
            if (this.isMultiplayer) {
                unit.syncId = `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                unit.multiplayerTeam = team === 'player' ? this.team : (this.team === 1 ? 2 : 1);
            }

            this.units.push(unit);
            if (team === 'player') {
                this.sound.playSound('spawn');
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
