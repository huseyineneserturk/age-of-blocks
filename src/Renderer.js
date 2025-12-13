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
            healthBg: 'rgba(255, 0, 0, 0.5)'
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
            const size = gs * 0.35;

            // Unit shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(x, y + size + 2, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Team color
            const teamColor = u.team === 'player' ? this.colors.player : this.colors.enemy;
            const teamGlow = u.team === 'player' ? this.colors.playerGlow : this.colors.enemyGlow;

            // Glow effect when attacking
            if (u.isAttacking) {
                ctx.shadowColor = teamGlow;
                ctx.shadowBlur = 15;
            }

            // Unit body
            ctx.fillStyle = teamColor;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            // Unit type indicator
            ctx.fillStyle = 'white';
            ctx.font = `${size * 1.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const icon = this.getUnitIcon(u.type);
            ctx.fillText(icon, x, y);

            // Direction arrow for cavalry
            if (u.type === 'cavalry') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                const arrowX = x + u.direction * (size + 5);
                ctx.moveTo(arrowX, y);
                ctx.lineTo(arrowX - u.direction * 6, y - 4);
                ctx.lineTo(arrowX - u.direction * 6, y + 4);
                ctx.closePath();
                ctx.fill();
            }

            // Health bar
            if (u.hp < u.maxHp) {
                this.drawHealthBar(x - size, y - size - 8, size * 2, 4, u.hp, u.maxHp);
            }
        });
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
                // Boulder
                ctx.beginPath();
                ctx.arc(currentX, currentY + arcY, 8, 0, Math.PI * 2);
                ctx.fill();
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
            farm: '🌾',
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
