// Visual Renderer with improved graphics
export class Renderer {
    constructor(ctx, game) {
        this.ctx = ctx;
        this.game = game;

        // Color palette
        this.colors = {
            player: '#4a9eff',
            playerDark: '#2a6ecf',
            playerGlow: 'rgba(74, 158, 255, 0.5)',
            enemy: '#ff4a4a',
            enemyDark: '#cf2a2a',
            enemyGlow: 'rgba(255, 74, 74, 0.5)',
            grass: '#1a472a',
            grassLight: '#2d5a3a',
            grassDark: '#0f2a1a',
            grid: 'rgba(255, 255, 255, 0.05)',
            gold: '#ffd700',
            health: '#32cd32',
            healthBg: 'rgba(255, 0, 0, 0.5)',
            // Figure palette
            skin: '#e8b88a',
            skinDark: '#c89868',
            steel: '#dfe6f0',
            steelDark: '#9aa7bd',
            wood: '#9b6a3a',
            woodDark: '#6e4a26'
        };

        // Terrain noise (for visual variety)
        this.terrainNoise = [];
        this.generateTerrainNoise();
    }

    generateTerrainNoise() {
        for (let x = 0; x < this.game.cols; x++) {
            this.terrainNoise[x] = [];
            for (let y = 0; y < this.game.rows; y++) {
                this.terrainNoise[x][y] = Math.random();
            }
        }
    }

    render() {
        const { ctx, game } = this;

        ctx.clearRect(0, 0, game.width, game.height);

        this.drawTerrain();
        this.drawGrid();
        this.drawBuildings();
        this.drawProjectiles();
        this.drawUnits();

        // Render particles
        if (game.particles) {
            game.particles.render(ctx, game.gridSize);
        }

        this.drawSelectionPreview();
    }

    drawTerrain() {
        const { ctx, game } = this;
        const gs = game.gridSize;

        // Base grass gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
        gradient.addColorStop(0, this.colors.grassLight);
        gradient.addColorStop(0.5, this.colors.grass);
        gradient.addColorStop(1, this.colors.grassDark);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, game.width, game.height);

        // Territory coloring
        // Player side (blue tint)
        ctx.fillStyle = 'rgba(74, 158, 255, 0.05)';
        ctx.fillRect(0, 0, game.width / 2, game.height);

        // Enemy side (red tint)
        ctx.fillStyle = 'rgba(255, 74, 74, 0.05)';
        ctx.fillRect(game.width / 2, 0, game.width / 2, game.height);

        // Draw subtle terrain details
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let x = 0; x < game.cols; x++) {
            for (let y = 0; y < game.rows; y++) {
                if (this.terrainNoise[x] && this.terrainNoise[x][y] > 0.8) {
                    ctx.beginPath();
                    ctx.arc(
                        x * gs + gs / 2 + (Math.random() - 0.5) * 10,
                        y * gs + gs / 2 + (Math.random() - 0.5) * 10,
                        2 + Math.random() * 3,
                        0, Math.PI * 2
                    );
                    ctx.fill();
                }
            }
        }

        // Center divider line
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(game.width / 2, 0);
        ctx.lineTo(game.width / 2, game.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawGrid() {
        const { ctx, game } = this;
        const gs = game.gridSize;

        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;

        for (let x = 0; x <= game.cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * gs, 0);
            ctx.lineTo(x * gs, game.height);
            ctx.stroke();
        }

        for (let y = 0; y <= game.rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * gs);
            ctx.lineTo(game.width, y * gs);
            ctx.stroke();
        }
    }

    drawBuildings() {
        const { ctx, game } = this;
        const gs = game.gridSize;

        game.buildings.forEach(b => {
            const x = b.x * gs;
            const y = b.y * gs;
            const w = b.width * gs;
            const h = b.height * gs;

            // Building shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x + 4, y + 4, w - 4, h - 4);

            // Building base
            const teamColor = b.team === 'player' ? this.colors.player : this.colors.enemy;
            const teamDark = b.team === 'player' ? this.colors.playerDark : this.colors.enemyDark;

            // Building gradient
            const gradient = ctx.createLinearGradient(x, y, x, y + h);
            gradient.addColorStop(0, teamColor);
            gradient.addColorStop(1, teamDark);

            ctx.fillStyle = gradient;

            // Different shapes based on building type
            if (b.type === 'castle') {
                this.drawCastle(x, y, w, h, teamColor);
            } else if (b.type === 'tower') {
                this.drawTower(x, y, w, h, teamColor, b);
            } else if (b.type === 'wall') {
                this.drawWall(x, y, w, h, teamColor);
            } else {
                // Default building shape
                ctx.fillRect(x + 3, y + 3, w - 6, h - 6);

                // Building border
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
            }

            // Building icon
            ctx.font = `${gs * 0.5}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;

            const icon = this.getBuildingIcon(b.type);
            ctx.fillText(icon, x + w / 2, y + h / 2);
            ctx.shadowBlur = 0;

            // Construction progress
            if (b.isBuilding) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(x + 3, y + 3, w - 6, h - 6);

                // Progress bar
                const progress = b.buildTime / b.maxBuildTime;
                ctx.fillStyle = this.colors.gold;
                ctx.fillRect(x + 5, y + h - 10, (w - 10) * progress, 5);
            }

            // Health bar
            if (!b.isBuilding && b.hp < b.maxHp) {
                this.drawHealthBar(x, y - 8, w, 6, b.hp, b.maxHp);
            }

            // Tower range indicator
            if (b.type === 'tower' && game.selectedBuilding === 'tower') {
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x + w / 2, y + h / 2, b.range * gs, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }

    drawCastle(x, y, w, h, color) {
        const { ctx } = this;
        const gs = this.game.gridSize;

        // Main building
        ctx.fillStyle = color;
        ctx.fillRect(x + 5, y + h * 0.3, w - 10, h * 0.7 - 5);

        // Towers at corners
        const towerW = w * 0.25;
        ctx.fillRect(x + 3, y + 5, towerW, h - 10);
        ctx.fillRect(x + w - towerW - 3, y + 5, towerW, h - 10);

        // Battlements
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(x + 5 + i * (w - 10) / 5, y + h * 0.25, (w - 10) / 10, 5);
        }

        // Gate
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(x + w / 2 - 8, y + h - 25, 16, 20);
    }

    drawTower(x, y, w, h, color, tower) {
        const { ctx, game } = this;

        // Tower base
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + 5);
        ctx.lineTo(x + w - 5, y + h - 5);
        ctx.lineTo(x + 5, y + h - 5);
        ctx.closePath();
        ctx.fill();

        // Tower top platform
        ctx.fillRect(x + 3, y + 3, w - 6, 10);

        // Attack line to target
        if (tower.target && tower.attackTimer < 0.2) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y + h / 2);
            const targetX = (tower.target.realX || tower.target.x) * game.gridSize + game.gridSize / 2;
            const targetY = (tower.target.realY || tower.target.y) * game.gridSize + game.gridSize / 2;
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    drawWall(x, y, w, h, color) {
        const { ctx } = this;

        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

        // Brick pattern
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;

        for (let row = 0; row < 3; row++) {
            const yOffset = y + 5 + row * (h - 10) / 3;
            ctx.beginPath();
            ctx.moveTo(x + 2, yOffset);
            ctx.lineTo(x + w - 2, yOffset);
            ctx.stroke();
        }
    }

    drawUnits() {
        const { ctx, game } = this;
        const gs = game.gridSize;

        game.units.forEach(u => {
            const x = u.realX * gs + gs / 2;
            const y = u.realY * gs + gs / 2;
            const s = gs * 0.4;
            const dir = u.direction || (u.team === 'player' ? 1 : -1);
            const col = u.team === 'player' ? this.colors.player : this.colors.enemy;
            const dark = u.team === 'player' ? this.colors.playerDark : this.colors.enemyDark;
            const glow = u.team === 'player' ? this.colors.playerGlow : this.colors.enemyGlow;
            const walk = Math.sin(((u.animationFrame || 0) / 4) * Math.PI * 2);
            const atk = u.isAttacking ? 1 : 0;

            // Ground shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(x, y + s * 0.95, s * 0.7, s * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(dir, 1); // everything below drawn facing right
            if (u.isAttacking) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }

            switch (u.type) {
                case 'cavalry': this._figCavalry(s, col, dark, walk, atk); break;
                case 'catapult': this._figCatapult(s, col, dark, atk); break;
                case 'archer': this._figArcher(s, col, dark, walk, atk); break;
                case 'mage': this._figMage(s, col, dark, walk, atk); break;
                default: this._figKnight(s, col, dark, walk, atk); break;
            }
            ctx.shadowBlur = 0;
            ctx.restore();

            // Health bar (screen space)
            if (u.hp < u.maxHp) {
                this.drawHealthBar(x - s * 0.8, y - s * 1.55, s * 1.6, 4, u.hp, u.maxHp);
            }
        });
    }

    // ---- Mini military figures (all drawn facing right; origin = unit centre) ----
    _legs(s, color, walk) {
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.22;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.13, s * 0.32);
        ctx.lineTo(-s * 0.13 + walk * s * 0.22, s * 0.92);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.13, s * 0.32);
        ctx.lineTo(s * 0.13 - walk * s * 0.22, s * 0.92);
        ctx.stroke();
    }

    _torsoHead(s, col, dark, helmet) {
        const ctx = this.ctx, C = this.colors;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.05, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.fillRect(-s * 0.3, s * 0.05, s * 0.6, s * 0.1);
        ctx.fillStyle = C.skin;
        ctx.beginPath();
        ctx.arc(0, -s * 0.62, s * 0.24, 0, Math.PI * 2);
        ctx.fill();
        if (helmet) {
            ctx.fillStyle = helmet;
            ctx.beginPath();
            ctx.arc(0, -s * 0.64, s * 0.26, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-s * 0.26, -s * 0.66, s * 0.52, s * 0.1);
        }
    }

    _figKnight(s, col, dark, walk, atk) {
        const ctx = this.ctx, C = this.colors;
        this._legs(s, dark, walk);
        // back shield
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(-s * 0.34, -s * 0.05, s * 0.16, s * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.gold; ctx.lineWidth = s * 0.05; ctx.stroke();
        this._torsoHead(s, col, dark, dark);
        // sword arm (front)
        ctx.save();
        ctx.translate(s * 0.26, -s * 0.18);
        ctx.rotate(atk ? -1.15 : -0.25);
        ctx.strokeStyle = C.steel; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, s * 0.05); ctx.lineTo(0, -s * 0.78); ctx.stroke();
        ctx.fillStyle = C.gold; ctx.fillRect(-s * 0.13, -s * 0.02, s * 0.26, s * 0.07);
        ctx.restore();
    }

    _figArcher(s, col, dark, walk, atk) {
        const ctx = this.ctx, C = this.colors;
        this._legs(s, dark, walk);
        this._torsoHead(s, col, dark, null);
        // hood
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, -s * 0.62, s * 0.27, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        // bow + string (front)
        const bx = s * 0.3, by = -s * 0.1, br = s * 0.42;
        ctx.strokeStyle = C.wood; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(bx, by, br, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke();
        const topx = bx + Math.cos(-Math.PI * 0.55) * br, topy = by + Math.sin(-Math.PI * 0.55) * br;
        const botx = bx + Math.cos(Math.PI * 0.55) * br, boty = by + Math.sin(Math.PI * 0.55) * br;
        const nockx = atk ? s * 0.02 : bx;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = s * 0.03;
        ctx.beginPath(); ctx.moveTo(topx, topy); ctx.lineTo(nockx, by); ctx.lineTo(botx, boty); ctx.stroke();
        if (atk) {
            ctx.strokeStyle = C.steelDark; ctx.lineWidth = s * 0.04;
            ctx.beginPath(); ctx.moveTo(nockx, by); ctx.lineTo(bx + br, by); ctx.stroke();
        }
    }

    _figMage(s, col, dark, walk, atk) {
        const ctx = this.ctx, C = this.colors;
        // robe
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.35);
        ctx.lineTo(-s * 0.4, s * 0.92);
        ctx.lineTo(s * 0.4, s * 0.92);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = dark; ctx.fillRect(-s * 0.4, s * 0.8, s * 0.8, s * 0.12);
        // head
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.22, 0, Math.PI * 2); ctx.fill();
        // pointed hat
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.52);
        ctx.lineTo(s * 0.3, -s * 0.52);
        ctx.lineTo(s * 0.06, -s * 1.15);
        ctx.closePath();
        ctx.fill();
        // staff + glowing orb (front)
        ctx.strokeStyle = C.wood; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 0.32, s * 0.6); ctx.lineTo(s * 0.32, -s * 0.7); ctx.stroke();
        const gr = s * (atk ? 0.42 : 0.28);
        const grad = ctx.createRadialGradient(s * 0.32, -s * 0.8, 0, s * 0.32, -s * 0.8, gr);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#8fb6ff');
        grad.addColorStop(1, 'rgba(120,160,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(s * 0.32, -s * 0.8, gr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eaf2ff';
        ctx.beginPath(); ctx.arc(s * 0.32, -s * 0.8, s * 0.1, 0, Math.PI * 2); ctx.fill();
    }

    _figCavalry(s, col, dark, walk, atk) {
        const ctx = this.ctx, C = this.colors;
        const horse = '#7a5230', horseDark = '#5a3c22';
        // horse legs
        ctx.strokeStyle = horseDark; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
        const lp = walk * s * 0.18;
        [[-s * 0.45, lp], [-s * 0.2, -lp], [s * 0.25, lp], [s * 0.5, -lp]].forEach(([lx, off]) => {
            ctx.beginPath(); ctx.moveTo(lx, s * 0.2); ctx.lineTo(lx + off, s * 0.92); ctx.stroke();
        });
        // horse body
        ctx.fillStyle = horse;
        ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        // neck + head
        ctx.beginPath();
        ctx.moveTo(s * 0.45, -s * 0.05);
        ctx.lineTo(s * 0.82, -s * 0.5);
        ctx.lineTo(s * 1.02, -s * 0.4);
        ctx.lineTo(s * 0.62, s * 0.05);
        ctx.closePath(); ctx.fill();
        // rider
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.35, s * 0.2, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin;
        ctx.beginPath(); ctx.arc(-s * 0.05, -s * 0.72, s * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.arc(-s * 0.05, -s * 0.74, s * 0.17, Math.PI, Math.PI * 2); ctx.fill();
        // lance (front)
        ctx.save();
        ctx.translate(s * 0.1, -s * 0.35);
        ctx.rotate(atk ? 0.18 : -0.1);
        ctx.strokeStyle = C.wood; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(s * 1.05, 0); ctx.stroke();
        ctx.fillStyle = C.steel;
        ctx.beginPath(); ctx.moveTo(s * 1.05, -s * 0.06); ctx.lineTo(s * 1.22, 0); ctx.lineTo(s * 1.05, s * 0.06); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    _figCatapult(s, col, dark, atk) {
        const ctx = this.ctx, C = this.colors;
        // wheels
        [-s * 0.4, s * 0.4].forEach(wx => {
            ctx.fillStyle = C.woodDark;
            ctx.beginPath(); ctx.arc(wx, s * 0.7, s * 0.28, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.wood;
            ctx.beginPath(); ctx.arc(wx, s * 0.7, s * 0.13, 0, Math.PI * 2); ctx.fill();
        });
        // frame
        ctx.strokeStyle = C.wood; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.7); ctx.lineTo(s * 0.5, s * 0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.7); ctx.lineTo(0, -s * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.3, s * 0.7); ctx.lineTo(0, -s * 0.1); ctx.stroke();
        // throwing arm
        ctx.save();
        ctx.translate(0, -s * 0.1);
        ctx.rotate(atk ? -1.4 : -0.25);
        ctx.strokeStyle = C.woodDark; ctx.lineWidth = s * 0.1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.7); ctx.stroke();
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(0, -s * 0.72, s * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // team flag
        ctx.fillStyle = col;
        ctx.fillRect(-s * 0.52, s * 0.28, s * 0.18, s * 0.14);
    }

    drawProjectiles() {
        const { ctx, game } = this;
        const gs = game.gridSize;

        if (!game.projectiles) return;

        game.projectiles.forEach(p => {
            const startX = p.x * gs;
            const startY = p.y * gs;
            const endX = p.targetX * gs;
            const endY = p.targetY * gs;

            const currentX = startX + (endX - startX) * p.progress;
            const currentY = startY + (endY - startY) * p.progress;

            // Arc height for boulders
            let arcY = 0;
            if (p.type === 'boulder') {
                arcY = -Math.sin(p.progress * Math.PI) * 30;
            }

            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;

            if (p.type === 'arrow') {
                // Arrow
                const angle = Math.atan2(endY - startY, endX - startX);
                ctx.save();
                ctx.translate(currentX, currentY + arcY);
                ctx.rotate(angle);

                ctx.fillRect(-6, -1.5, 12, 3);
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(3, -3);
                ctx.lineTo(3, 3);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            } else if (p.type === 'boulder') {
                // Spinning rock with a fiery glow
                ctx.save();
                ctx.translate(currentX, currentY + arcY);
                ctx.rotate(p.progress * 14);
                ctx.shadowColor = '#ff7a00';
                ctx.shadowBlur = 12;
                ctx.fillStyle = '#5a4636';
                ctx.beginPath();
                for (let k = 0; k < 8; k++) {
                    const a = (k / 8) * Math.PI * 2;
                    const r = 9 + (k % 2 ? -2.5 : 1.5);
                    const px = Math.cos(a) * r, py = Math.sin(a) * r;
                    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#3a2c22';
                ctx.beginPath();
                ctx.arc(-2, -2, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.shadowBlur = 0;

            // Trail particles
            if (game.particles && Math.random() > 0.5) {
                game.particles.spawnTrail(
                    currentX / gs,
                    (currentY + arcY) / gs,
                    p.color
                );
            }
        });
    }

    drawHealthBar(x, y, w, h, hp, maxHp) {
        const { ctx } = this;
        const pct = Math.max(0, hp / maxHp);

        // Background
        ctx.fillStyle = this.colors.healthBg;
        ctx.fillRect(x, y, w, h);

        // Health (color changes based on %)
        if (pct > 0.6) {
            ctx.fillStyle = this.colors.health;
        } else if (pct > 0.3) {
            ctx.fillStyle = '#ffa500';
        } else {
            ctx.fillStyle = '#ff4444';
        }
        ctx.fillRect(x, y, w * pct, h);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    }

    drawSelectionPreview() {
        const { ctx, game } = this;
        const gs = game.gridSize;

        if (!game.selectedBuilding || !game.mousePos) return;

        const gridX = Math.floor(game.mousePos.x / gs);
        const gridY = Math.floor(game.mousePos.y / gs);

        // Check if valid placement
        const isValid = game.canPlaceBuilding(gridX, gridY, game.selectedBuilding);

        // Preview rectangle
        ctx.fillStyle = isValid ? 'rgba(74, 158, 255, 0.3)' : 'rgba(255, 74, 74, 0.3)';
        ctx.fillRect(gridX * gs, gridY * gs, gs, gs);

        ctx.strokeStyle = isValid ? '#4a9eff' : '#ff4a4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(gridX * gs, gridY * gs, gs, gs);

        // Icon preview
        const icon = this.getBuildingIcon(game.selectedBuilding);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `${gs * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, gridX * gs + gs / 2, gridY * gs + gs / 2);
    }

    getBuildingIcon(type) {
        const icons = {
            castle: '🏰',
            mine: '⛏️',
            barracks: '⚔️',
            archery: '🏹',
            stable: '🐴',
            siege: '💣',
            mage: '🔮',
            tower: '🗼',
            wall: '🧱',
            forge: '🔥',
            hospital: '🏥',
            research: '📚'
        };
        return icons[type] || '🏠';
    }

    getUnitIcon(type) {
        const icons = {
            knight: '⚔️',
            archer: '🏹',
            cavalry: '🐴',
            catapult: '💣',
            mage: '🔮'
        };
        return icons[type] || '👤';
    }

    // Minimap rendering
    renderMinimap(minimapCanvas) {
        const ctx = minimapCanvas.getContext('2d');
        const game = this.game;

        const scaleX = minimapCanvas.width / game.width;
        const scaleY = minimapCanvas.height / game.height;

        // Background
        ctx.fillStyle = '#1a472a';
        ctx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

        // Territory line
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(minimapCanvas.width / 2, 0);
        ctx.lineTo(minimapCanvas.width / 2, minimapCanvas.height);
        ctx.stroke();

        // Buildings
        game.buildings.forEach(b => {
            ctx.fillStyle = b.team === 'player' ? this.colors.player : this.colors.enemy;
            ctx.fillRect(
                b.x * game.gridSize * scaleX,
                b.y * game.gridSize * scaleY,
                b.width * game.gridSize * scaleX,
                b.height * game.gridSize * scaleY
            );
        });

        // Units as dots
        game.units.forEach(u => {
            ctx.fillStyle = u.team === 'player' ? this.colors.player : this.colors.enemy;
            ctx.beginPath();
            ctx.arc(
                u.realX * game.gridSize * scaleX,
                u.realY * game.gridSize * scaleY,
                2,
                0, Math.PI * 2
            );
            ctx.fill();
        });
    }
}
