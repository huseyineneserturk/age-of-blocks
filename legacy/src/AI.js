// AI System for enemy behavior - Aggressive and Strategic
export class AI {
    constructor(game) {
        this.game = game;
        this.resources = 150; // Start with more resources
        this.resourceRate = 2; // Faster base income
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1;
        this.difficulty = 'hard';

        // Bonus multipliers
        this.incomeMultiplier = 1.5;
        this.buildSpeedMultiplier = 0.6;

        this.threatLevel = 0;

        this.costs = {
            mine: 50,
            barracks: 100,
            archery: 120,
            stable: 150,
            siege: 200,
            mage: 180,
            tower: 80,
            forge: 200,
            hospital: 150
        };
    }

    update(dt) {
        this.buildTimer += dt;
        this.resourceTimer += dt;
        this.gameTime += dt;

        // Faster passive income
        if (this.resourceTimer >= 0.5) {
            this.resourceTimer = 0;
            this.resources += (this.resourceRate * this.incomeMultiplier) * 0.5;
        }

        // Faster aggression scaling
        if (this.gameTime > 30) this.aggressionLevel = 2;
        if (this.gameTime > 60) this.aggressionLevel = 3;
        if (this.gameTime > 90) this.aggressionLevel = 4;
        if (this.gameTime > 120) this.aggressionLevel = 5;
        if (this.gameTime > 150) this.aggressionLevel = 6;
        if (this.gameTime > 180) this.aggressionLevel = 7;

        // Calculate threat level
        const playerUnits = this.game.units.filter(u => u.team === 'player');
        const enemyUnits = this.game.units.filter(u => u.team === 'enemy');
        this.threatLevel = Math.max(0, playerUnits.length - enemyUnits.length);

        // Much faster build interval
        const baseBuildInterval = 4;
        const buildInterval = Math.max(1.5, (baseBuildInterval - this.aggressionLevel * 0.5) * this.buildSpeedMultiplier);

        if (this.buildTimer >= buildInterval) {
            this.buildTimer = 0;
            this.makeDecision();

            // Multiple decisions in late game
            if (this.aggressionLevel >= 4 && this.resources > 200) {
                this.makeDecision();
            }
            if (this.aggressionLevel >= 6 && this.resources > 300) {
                this.makeDecision();
            }
        }
    }

    makeDecision() {
        const enemyBuildings = this.game.buildings.filter(b => b.team === 'enemy');
        const playerUnits = this.game.units.filter(u => u.team === 'player');
        const enemyUnits = this.game.units.filter(u => u.team === 'enemy');

        const counts = {
            mines: enemyBuildings.filter(b => b.type === 'mine').length,
            barracks: enemyBuildings.filter(b => b.type === 'barracks').length,
            archery: enemyBuildings.filter(b => b.type === 'archery').length,
            stables: enemyBuildings.filter(b => b.type === 'stable').length,
            towers: enemyBuildings.filter(b => b.type === 'tower').length,
            siege: enemyBuildings.filter(b => b.type === 'siege').length,
            mage: enemyBuildings.filter(b => b.type === 'mage').length,
            forge: enemyBuildings.filter(b => b.type === 'forge').length,
            hospital: enemyBuildings.filter(b => b.type === 'hospital').length
        };

        const needsDefense = this.threatLevel > 3;

        let buildType = null;
        let cost = 0;

        // PHASE 1: Early Game (0-30s)
        if (this.gameTime < 30) {
            if (counts.mines < 2 && this.resources >= this.costs.mine) {
                buildType = 'mine'; cost = this.costs.mine;
            } else if (counts.barracks < 1 && this.resources >= this.costs.barracks) {
                buildType = 'barracks'; cost = this.costs.barracks;
            } else if (counts.archery < 1 && this.resources >= this.costs.archery) {
                buildType = 'archery'; cost = this.costs.archery;
            }
        }
        // PHASE 2: Mid Game (30-90s)
        else if (this.gameTime < 90) {
            if (needsDefense && counts.towers < 3 && this.resources >= this.costs.tower) {
                buildType = 'tower'; cost = this.costs.tower;
            } else if (counts.mines < 3 && this.resources >= this.costs.mine) {
                buildType = 'mine'; cost = this.costs.mine;
            } else if (counts.barracks < 3 && this.resources >= this.costs.barracks) {
                buildType = 'barracks'; cost = this.costs.barracks;
            } else if (counts.archery < 2 && this.resources >= this.costs.archery) {
                buildType = 'archery'; cost = this.costs.archery;
            } else if (counts.stables < 1 && this.resources >= this.costs.stable) {
                buildType = 'stable'; cost = this.costs.stable;
            } else if (counts.forge < 1 && this.resources >= this.costs.forge) {
                buildType = 'forge'; cost = this.costs.forge;
            }
        }
        // PHASE 3: Late Game (90s+)
        else {
            if (counts.mines < 4 + Math.floor(this.aggressionLevel / 2) && this.resources >= this.costs.mine) {
                buildType = 'mine'; cost = this.costs.mine;
            } else if (needsDefense && counts.towers < 4 && this.resources >= this.costs.tower) {
                buildType = 'tower'; cost = this.costs.tower;
            } else if (counts.hospital < 1 && this.resources >= this.costs.hospital) {
                buildType = 'hospital'; cost = this.costs.hospital;
            } else if (counts.siege < 2 && this.resources >= this.costs.siege) {
                buildType = 'siege'; cost = this.costs.siege;
            } else if (counts.mage < 2 && this.resources >= this.costs.mage) {
                buildType = 'mage'; cost = this.costs.mage;
            } else if (counts.stables < 2 && this.resources >= this.costs.stable) {
                buildType = 'stable'; cost = this.costs.stable;
            } else if (counts.barracks < 5 + this.aggressionLevel && this.resources >= this.costs.barracks) {
                buildType = 'barracks'; cost = this.costs.barracks;
            } else if (counts.archery < 3 && this.resources >= this.costs.archery) {
                buildType = 'archery'; cost = this.costs.archery;
            } else if (this.resources >= this.costs.barracks) {
                buildType = 'barracks'; cost = this.costs.barracks;
            }
        }

        // Fallback
        if (!buildType && this.resources > 150) {
            const options = [
                { type: 'barracks', cost: this.costs.barracks },
                { type: 'archery', cost: this.costs.archery },
                { type: 'tower', cost: this.costs.tower }
            ];
            const affordable = options.filter(o => this.resources >= o.cost);
            if (affordable.length > 0) {
                const choice = affordable[Math.floor(Math.random() * affordable.length)];
                buildType = choice.type; cost = choice.cost;
            }
        }

        if (buildType && this.resources >= cost) {
            if (this.tryBuild(buildType)) {
                this.resources -= cost;
            }
        }
    }

    onMineBuild() {
        this.resourceRate += 1.5;
    }

    tryBuild(type) {
        const cols = this.game.cols;
        const rows = this.game.rows;
        const minX = Math.floor(cols / 2) + 1;
        const maxX = cols - 3;

        for (let attempt = 0; attempt < 50; attempt++) {
            let x, y;

            if (type === 'tower' && attempt < 10) {
                x = minX + Math.floor(Math.random() * 3);
                y = Math.floor(rows / 2) + Math.floor(Math.random() * 5) - 2;
            } else if (type === 'mine' && attempt < 10) {
                x = maxX - Math.floor(Math.random() * 3);
                y = 1 + Math.floor(Math.random() * (rows - 2));
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
        this.resourceRate = 2;
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1;
        this.threatLevel = 0;
    }
}
