// AI System for enemy behavior - Fair but Strategic
export class AI {
    constructor(game) {
        this.game = game;
        this.resources = 150; // Same as player
        this.resourceRate = 1; // Same as player base rate
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1;

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
            hospital: 150
        };
    }

    update(dt) {
        this.buildTimer += dt;
        this.resourceTimer += dt;
        this.gameTime += dt;

        // Same passive income as player (1 per second base)
        if (this.resourceTimer >= 1) {
            this.resourceTimer = 0;
            this.resources += this.resourceRate;
        }

        // Gradual aggression increase
        if (this.gameTime > 45) this.aggressionLevel = 2;
        if (this.gameTime > 90) this.aggressionLevel = 3;
        if (this.gameTime > 135) this.aggressionLevel = 4;
        if (this.gameTime > 180) this.aggressionLevel = 5;

        // Normal build interval (same pace as before the buffs)
        const buildInterval = Math.max(4, 8 - this.aggressionLevel);

        if (this.buildTimer >= buildInterval) {
            this.buildTimer = 0;
            this.makeDecision();
        }
    }

    makeDecision() {
        const enemyBuildings = this.game.buildings.filter(b => b.team === 'enemy');
        const playerBuildings = this.game.buildings.filter(b => b.team === 'player');
        const playerUnits = this.game.units.filter(u => u.team === 'player');
        const enemyUnits = this.game.units.filter(u => u.team === 'enemy');

        // Count building types
        const counts = {
            mines: enemyBuildings.filter(b => b.type === 'mine').length,
            farms: enemyBuildings.filter(b => b.type === 'farm').length,
            barracks: enemyBuildings.filter(b => b.type === 'barracks').length,
            archery: enemyBuildings.filter(b => b.type === 'archery').length,
            stables: enemyBuildings.filter(b => b.type === 'stable').length,
            towers: enemyBuildings.filter(b => b.type === 'tower').length,
            siege: enemyBuildings.filter(b => b.type === 'siege').length,
            mage: enemyBuildings.filter(b => b.type === 'mage').length,
            forge: enemyBuildings.filter(b => b.type === 'forge').length,
            hospital: enemyBuildings.filter(b => b.type === 'hospital').length
        };

        // Analyze player's strategy
        const playerMines = playerBuildings.filter(b => b.type === 'mine').length;
        const playerMilitary = playerBuildings.filter(b =>
            ['barracks', 'archery', 'stable', 'siege', 'mage'].includes(b.type)
        ).length;

        const isUnderPressure = playerUnits.length > enemyUnits.length + 3;
        const playerRushing = playerMilitary > playerMines + 1;

        let buildType = null;
        let cost = 0;

        // SMART DECISION MAKING (no cheating, just better priorities)

        // Step 1: Always maintain economy first
        // Build mines proportionally - aim for 1 mine per 2 military buildings
        const desiredMines = Math.max(2, Math.floor((counts.barracks + counts.archery + counts.stables) / 2) + 1);

        if (counts.mines < desiredMines && counts.mines < 4 && this.resources >= this.costs.mine) {
            buildType = 'mine';
            cost = this.costs.mine;
        }
        // Step 2: React to player pressure with defense
        else if (isUnderPressure && counts.towers < 2 && this.resources >= this.costs.tower) {
            buildType = 'tower';
            cost = this.costs.tower;
        }
        // Step 3: Counter player rushing with quick military
        else if (playerRushing && counts.barracks < 2 && this.resources >= this.costs.barracks) {
            buildType = 'barracks';
            cost = this.costs.barracks;
        }
        // Step 4: Build balanced army composition
        else if (counts.barracks < 2 && this.resources >= this.costs.barracks) {
            buildType = 'barracks';
            cost = this.costs.barracks;
        }
        else if (counts.archery < 1 && this.resources >= this.costs.archery) {
            buildType = 'archery';
            cost = this.costs.archery;
        }
        // Step 5: Mid-game diversity
        else if (this.aggressionLevel >= 2) {
            if (counts.stables < 1 && this.resources >= this.costs.stable) {
                buildType = 'stable';
                cost = this.costs.stable;
            }
            else if (counts.forge < 1 && this.resources >= this.costs.forge) {
                buildType = 'forge';
                cost = this.costs.forge;
            }
            else if (counts.archery < 2 && this.resources >= this.costs.archery) {
                buildType = 'archery';
                cost = this.costs.archery;
            }
        }
        // Step 6: Late-game power units
        else if (this.aggressionLevel >= 3) {
            if (counts.mage < 1 && this.resources >= this.costs.mage) {
                buildType = 'mage';
                cost = this.costs.mage;
            }
            else if (counts.siege < 1 && this.resources >= this.costs.siege) {
                buildType = 'siege';
                cost = this.costs.siege;
            }
            else if (counts.hospital < 1 && this.resources >= this.costs.hospital) {
                buildType = 'hospital';
                cost = this.costs.hospital;
            }
        }
        // Step 7: Scale up existing production
        else if (counts.barracks < 3 + this.aggressionLevel && this.resources >= this.costs.barracks) {
            buildType = 'barracks';
            cost = this.costs.barracks;
        }
        // Fallback: Don't hoard resources, spend them on something useful
        else if (this.resources >= 150) {
            if (counts.towers < 3 && this.resources >= this.costs.tower) {
                buildType = 'tower';
                cost = this.costs.tower;
            } else if (this.resources >= this.costs.barracks) {
                buildType = 'barracks';
                cost = this.costs.barracks;
            }
        }

        if (buildType && this.resources >= cost) {
            if (this.tryBuild(buildType)) {
                this.resources -= cost;
            }
        }
    }

    onMineBuild() {
        this.resourceRate += 1; // Same as player gets from mines
    }

    tryBuild(type) {
        const cols = this.game.cols;
        const rows = this.game.rows;
        const minX = Math.floor(cols / 2) + 1;
        const maxX = cols - 3;

        // Strategic placement
        for (let attempt = 0; attempt < 40; attempt++) {
            let x, y;

            // Towers near front line
            if (type === 'tower' && attempt < 15) {
                x = minX + Math.floor(Math.random() * 4);
                y = Math.floor(rows / 2) + Math.floor(Math.random() * 6) - 3;
            }
            // Mines in back for safety
            else if (type === 'mine' && attempt < 15) {
                x = maxX - Math.floor(Math.random() * 4);
                y = 1 + Math.floor(Math.random() * (rows - 2));
            }
            // Other buildings randomly
            else {
                x = minX + Math.floor(Math.random() * (maxX - minX));
                y = 1 + Math.floor(Math.random() * (rows - 2));
            }

            // Clamp values
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
    }
}
