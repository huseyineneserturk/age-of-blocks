// AI System for enemy behavior - Smarter and Stronger
export class AI {
    constructor(game) {
        this.game = game;
        this.resources = 100;
        this.resourceRate = 1;
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1; // Increases over time

        this.costs = {
            mine: 50,
            farm: 40,
            barracks: 100,
            archery: 120,
            stable: 150,
            siege: 200,
            mage: 180,
            tower: 80
        };
    }

    update(dt) {
        this.buildTimer += dt;
        this.resourceTimer += dt;
        this.gameTime += dt;

        // Passive income
        if (this.resourceTimer >= 1) {
            this.resourceTimer = 0;
            this.resources += this.resourceRate;
        }

        // Increase aggression over time
        if (this.gameTime > 60) this.aggressionLevel = 2;
        if (this.gameTime > 120) this.aggressionLevel = 3;
        if (this.gameTime > 180) this.aggressionLevel = 4;
        if (this.gameTime > 240) this.aggressionLevel = 5;

        // Build faster as aggression increases
        const buildInterval = Math.max(3, 8 - this.aggressionLevel);

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

        const mines = enemyBuildings.filter(b => b.type === 'mine').length;
        const barracks = enemyBuildings.filter(b => b.type === 'barracks').length;
        const archeryRanges = enemyBuildings.filter(b => b.type === 'archery').length;
        const stables = enemyBuildings.filter(b => b.type === 'stable').length;
        const towers = enemyBuildings.filter(b => b.type === 'tower').length;
        const siegeWorkshops = enemyBuildings.filter(b => b.type === 'siege').length;
        const mageTowers = enemyBuildings.filter(b => b.type === 'mage').length;

        let buildType = null;
        let cost = 0;

        // Strategic decision based on game state

        // Priority 1: Economy foundation
        if (mines < 1 + this.aggressionLevel && this.resources >= this.costs.mine) {
            buildType = 'mine';
            cost = this.costs.mine;
        }
        // Priority 2: Defense if being attacked
        else if (playerUnits.length > enemyUnits.length + 3 && towers < 2 + this.aggressionLevel && this.resources >= this.costs.tower) {
            buildType = 'tower';
            cost = this.costs.tower;
        }
        // Priority 3: Main army
        else if (barracks < 2 + Math.floor(this.aggressionLevel / 2) && this.resources >= this.costs.barracks) {
            buildType = 'barracks';
            cost = this.costs.barracks;
        }
        // Priority 4: Ranged support
        else if (archeryRanges < 1 + Math.floor(this.aggressionLevel / 2) && this.resources >= this.costs.archery) {
            buildType = 'archery';
            cost = this.costs.archery;
        }
        // Priority 5: Cavalry for speed
        else if (stables < Math.floor(this.aggressionLevel / 2) && this.resources >= this.costs.stable) {
            buildType = 'stable';
            cost = this.costs.stable;
        }
        // Priority 6: Mages for area damage (later game)
        else if (mageTowers < Math.floor(this.aggressionLevel / 3) && this.aggressionLevel >= 2 && this.resources >= this.costs.mage) {
            buildType = 'mage';
            cost = this.costs.mage;
        }
        // Priority 7: Siege for pushing (late game)
        else if (siegeWorkshops < 1 && this.aggressionLevel >= 3 && this.resources >= this.costs.siege) {
            buildType = 'siege';
            cost = this.costs.siege;
        }
        // Default: More barracks
        else if (this.resources >= this.costs.barracks) {
            buildType = 'barracks';
            cost = this.costs.barracks;
        }

        if (buildType && this.resources >= cost) {
            if (this.tryBuild(buildType)) {
                this.resources -= cost;
            }
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

        for (let attempt = 0; attempt < 30; attempt++) {
            const x = minX + Math.floor(Math.random() * (maxX - minX));
            const y = 1 + Math.floor(Math.random() * (rows - 2));

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
        this.resources = 100;
        this.resourceRate = 1;
        this.buildTimer = 0;
        this.resourceTimer = 0;
        this.gameTime = 0;
        this.aggressionLevel = 1;
    }
}
