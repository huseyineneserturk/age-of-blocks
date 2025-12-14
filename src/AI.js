// AI System for enemy behavior - Dynamic and Adaptive
export class AI {
    constructor(game) {
        this.game = game;
        this.resources = 150;
        this.resourceRate = 1;
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1;

        // Random personality for variety
        this.personality = this.randomPersonality();

        this.costs = {
            mine: 50,
            farm: 40,
            barracks: 100,
            archery: 120,
            stable: 150,
            siege: 200,
            mage: 180,
            tower: 80,
            forge: 200,
            hospital: 150,
            research: 250
        };
    }

    randomPersonality() {
        const types = ['aggressive', 'balanced', 'defensive', 'economic'];
        return types[Math.floor(Math.random() * types.length)];
    }

    update(dt) {
        this.buildTimer += dt;
        this.resourceTimer += dt;
        this.gameTime += dt;

        // Normal passive income
        if (this.resourceTimer >= 1) {
            this.resourceTimer = 0;
            this.resources += this.resourceRate;
        }

        // Faster aggression scaling
        if (this.gameTime > 30) this.aggressionLevel = 2;
        if (this.gameTime > 60) this.aggressionLevel = 3;
        if (this.gameTime > 100) this.aggressionLevel = 4;
        if (this.gameTime > 150) this.aggressionLevel = 5;

        // Faster build interval - don't wait too long
        const buildInterval = Math.max(2.5, 5 - this.aggressionLevel * 0.5);

        if (this.buildTimer >= buildInterval) {
            this.buildTimer = 0;
            this.makeDecision();
        }

        // Extra decision if hoarding too many resources
        if (this.resources > 200 && this.buildTimer > 1) {
            this.buildTimer = 0;
            this.makeDecision();
        }
    }

    makeDecision() {
        const enemyBuildings = this.game.buildings.filter(b => b.team === 'enemy');
        const playerBuildings = this.game.buildings.filter(b => b.team === 'player');
        const playerUnits = this.game.units.filter(u => u.team === 'player');
        const enemyUnits = this.game.units.filter(u => u.team === 'enemy');

        // Count all building types
        const counts = {};
        ['mine', 'farm', 'barracks', 'archery', 'stable', 'tower', 'siege', 'mage', 'forge', 'hospital', 'research'].forEach(type => {
            counts[type] = enemyBuildings.filter(b => b.type === type).length;
        });

        // Analyze game state
        const totalEnemyBuildings = enemyBuildings.length;
        const unitDifference = playerUnits.length - enemyUnits.length;
        const isLosing = unitDifference > 4;
        const isWinning = unitDifference < -3;
        const needsEconomy = counts.mine < 2;
        const hasGoodEconomy = counts.mine >= 3;

        // Build options based on current state
        let options = [];

        // ALWAYS consider economy if lacking
        if (counts.mine < 3) {
            options.push({ type: 'mine', weight: needsEconomy ? 30 : 10 });
        }

        // MILITARY - always needed
        if (counts.barracks < 4 + this.aggressionLevel) {
            options.push({ type: 'barracks', weight: 25 });
        }
        if (counts.archery < 3) {
            options.push({ type: 'archery', weight: 20 });
        }
        if (counts.stable < 2) {
            options.push({ type: 'stable', weight: 15 });
        }

        // DEFENSE - when under pressure
        if (isLosing && counts.tower < 3) {
            options.push({ type: 'tower', weight: 35 });
        } else if (counts.tower < 2) {
            options.push({ type: 'tower', weight: 10 });
        }

        // ADVANCED UNITS - mid to late game
        if (this.aggressionLevel >= 2) {
            if (counts.mage < 2) {
                options.push({ type: 'mage', weight: 18 });
            }
            if (counts.siege < 2) {
                options.push({ type: 'siege', weight: 15 });
            }
        }

        // SUPPORT BUILDINGS - strategic timing
        if (hasGoodEconomy) {
            if (counts.forge < 1) {
                options.push({ type: 'forge', weight: 20 });
            }
            if (counts.hospital < 1 && enemyUnits.length > 5) {
                options.push({ type: 'hospital', weight: 18 });
            }
            if (counts.research < 1 && this.aggressionLevel >= 2) {
                options.push({ type: 'research', weight: 15 });
            }
        }

        // Late game extras
        if (this.aggressionLevel >= 4) {
            if (counts.forge < 2) options.push({ type: 'forge', weight: 12 });
            if (counts.hospital < 2) options.push({ type: 'hospital', weight: 12 });
        }

        // Personality modifiers
        switch (this.personality) {
            case 'aggressive':
                options.forEach(o => {
                    if (['barracks', 'stable', 'siege'].includes(o.type)) o.weight *= 1.5;
                });
                break;
            case 'defensive':
                options.forEach(o => {
                    if (['tower', 'hospital'].includes(o.type)) o.weight *= 1.5;
                });
                break;
            case 'economic':
                options.forEach(o => {
                    if (['mine', 'forge', 'research'].includes(o.type)) o.weight *= 1.5;
                });
                break;
            // balanced stays as is
        }

        // Filter affordable options
        options = options.filter(o => this.resources >= this.costs[o.type]);

        if (options.length === 0) return;

        // Weighted random selection
        const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
        let random = Math.random() * totalWeight;

        let selectedType = options[0].type;
        for (const option of options) {
            random -= option.weight;
            if (random <= 0) {
                selectedType = option.type;
                break;
            }
        }

        // Try to build
        if (this.tryBuild(selectedType)) {
            this.resources -= this.costs[selectedType];
        }
    }

    onMineBuild() {
        this.resourceRate += 1;
    }

    tryBuild(type) {
        const cols = this.game.cols;
        const rows = this.game.rows;
        const minX = Math.floor(cols / 2) + 1;
        const maxX = cols - 3;

        for (let attempt = 0; attempt < 40; attempt++) {
            let x, y;

            // Strategic placement
            if (type === 'tower' && attempt < 15) {
                // Front line defense
                x = minX + Math.floor(Math.random() * 4);
                y = Math.floor(rows / 2) + Math.floor(Math.random() * 6) - 3;
            } else if ((type === 'mine' || type === 'research') && attempt < 15) {
                // Back for safety
                x = maxX - Math.floor(Math.random() * 4);
                y = 1 + Math.floor(Math.random() * (rows - 2));
            } else if ((type === 'hospital' || type === 'forge') && attempt < 15) {
                // Center for best coverage
                x = minX + 2 + Math.floor(Math.random() * 4);
                y = Math.floor(rows / 2) + Math.floor(Math.random() * 4) - 2;
            } else {
                x = minX + Math.floor(Math.random() * (maxX - minX));
                y = 1 + Math.floor(Math.random() * (rows - 2));
            }

            x = Math.max(minX, Math.min(maxX, x));
            y = Math.max(1, Math.min(rows - 2, y));

            const occupied = this.game.buildings.some(b => {
                return x >= b.x && x < b.x + b.width &&
                    y >= b.y && y < b.y + b.height;
            });

            if (!occupied) {
                this.game.spawnEnemyBuilding(x, y, type);
                if (type === 'mine') {
                    this.onMineBuild();
                }
                return true;
            }
        }

        return false;
    }

    reset() {
        this.resources = 150;
        this.resourceRate = 1;
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1;
        this.personality = this.randomPersonality();
    }
}
