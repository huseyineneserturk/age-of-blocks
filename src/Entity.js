// Base Entity class
export class Entity {
    constructor(x, y, team) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.alive = true;
        this.hp = 100;
        this.maxHp = 100;
    }

    takeDamage(amount, game) {
        this.hp -= amount;
        if (game && game.particles) {
            game.particles.spawnDamage(this.x, this.y, amount, this.team === 'player');
        }
        if (this.hp <= 0) {
            this.die(game);
        }
    }

    die(game) {
        this.alive = false;
        if (game) {
            if (game.particles) {
                game.particles.spawnDeath(this.x, this.y, this.team);
            }
            if (game.sound) {
                game.sound.playSound('death');
            }
        }
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
}

// Base Building class
export class Building extends Entity {
    constructor(x, y, team, type) {
        super(x, y, team);
        this.type = type;
        this.width = 1;
        this.height = 1;
        this.buildTime = 0;
        this.maxBuildTime = 1;
        this.isBuilding = true;
    }

    update(dt, game) {
        if (this.isBuilding) {
            this.buildTime += dt;
            if (this.buildTime >= this.maxBuildTime) {
                this.isBuilding = false;
                if (game.sound) game.sound.playSound('build');
            }
        }
    }
}

// Castle - Main building, game over if destroyed
export class Castle extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'castle');
        this.hp = 1000;
        this.maxHp = 1000;
        this.width = 2;
        this.height = 2;
        this.isBuilding = false;
    }
}

// Mine - Produces resources
export class Mine extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'mine');
        this.hp = 200;
        this.maxHp = 200;
        this.productionRate = 2; // Extra resources per second
        this.productionTimer = 0;
    }

    update(dt, game) {
        super.update(dt, game);
        if (!this.isBuilding && this.team === 'player') {
            this.productionTimer += dt;
            if (this.productionTimer >= 5) { // Every 5 seconds
                this.productionTimer = 0;
                game.addResources(5);
                if (game.particles) {
                    game.particles.spawnResource(this.x, this.y);
                }
            }
        }
    }
}

// Farm - Increases resource cap and provides small income
export class Farm extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'farm');
        this.hp = 150;
        this.maxHp = 150;
        this.productionTimer = 0;
    }

    update(dt, game) {
        super.update(dt, game);
        if (!this.isBuilding && this.team === 'player') {
            this.productionTimer += dt;
            if (this.productionTimer >= 8) {
                this.productionTimer = 0;
                game.addResources(3);
            }
        }
    }
}

// Barracks - Spawns Knight units
export class Barracks extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'barracks');
        this.hp = 300;
        this.maxHp = 300;
        this.spawnTimer = 0;
        this.spawnRate = 6;
        this.maxBuildTime = 1.5;
    }

    update(dt, game) {
        super.update(dt, game);
        // In multiplayer, only player's buildings spawn units locally
        // Enemy units come from host sync
        if (this.team === 'enemy' && game.isMultiplayer) return;

        if (!this.isBuilding) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnTimer = 0;
                this.spawnUnit(game);
            }
        }
    }

    spawnUnit(game) {
        const spawnX = this.team === 'player' ? this.x + 1.5 : this.x - 0.5;
        const spawnY = this.y + 0.5;
        game.spawnUnit(spawnX, spawnY, this.team, 'knight');
    }
}

// Archery Range - Spawns Archer units
export class ArcheryRange extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'archery');
        this.hp = 250;
        this.maxHp = 250;
        this.spawnTimer = 0;
        this.spawnRate = 7;
        this.maxBuildTime = 1.5;
    }

    update(dt, game) {
        super.update(dt, game);
        // In multiplayer, only player's buildings spawn units locally
        if (this.team === 'enemy' && game.isMultiplayer) return;

        if (!this.isBuilding) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnTimer = 0;
                this.spawnUnit(game);
            }
        }
    }

    spawnUnit(game) {
        const spawnX = this.team === 'player' ? this.x + 1.5 : this.x - 0.5;
        const spawnY = this.y + 0.5;
        game.spawnUnit(spawnX, spawnY, this.team, 'archer');
    }
}

// Stable - Spawns Cavalry units
export class Stable extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'stable');
        this.hp = 350;
        this.maxHp = 350;
        this.spawnTimer = 0;
        this.spawnRate = 10;
        this.maxBuildTime = 2;
    }

    update(dt, game) {
        super.update(dt, game);
        // In multiplayer, only player's buildings spawn units locally
        if (this.team === 'enemy' && game.isMultiplayer) return;

        if (!this.isBuilding) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnTimer = 0;
                this.spawnUnit(game);
            }
        }
    }

    spawnUnit(game) {
        const spawnX = this.team === 'player' ? this.x + 1.5 : this.x - 0.5;
        const spawnY = this.y + 0.5;
        game.spawnUnit(spawnX, spawnY, this.team, 'cavalry');
    }
}

// Tower - Attacks nearby enemies
export class Tower extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'tower');
        this.hp = 400;
        this.maxHp = 400;
        this.range = 5;
        this.damage = 15;
        this.attackCooldown = 1;
        this.attackTimer = 0;
        this.target = null;
        this.maxBuildTime = 1.2;
    }

    update(dt, game) {
        super.update(dt, game);
        if (this.isBuilding) return;

        this.attackTimer += dt;
        if (this.attackTimer >= this.attackCooldown) {
            const target = this.findTarget(game);
            if (target) {
                this.target = target;
                target.takeDamage(this.damage, game);
                this.attackTimer = 0;

                // Create projectile visual
                if (game.projectiles) {
                    game.projectiles.push({
                        x: this.x + 0.5,
                        y: this.y + 0.5,
                        targetX: target.realX || target.x,
                        targetY: target.realY || target.y,
                        progress: 0,
                        speed: 8,
                        color: this.team === 'player' ? '#4a9eff' : '#ff4a4a',
                        type: 'arrow'
                    });
                }

                if (game.sound) game.sound.playSound('arrow');
            }
        }
    }

    findTarget(game) {
        let closest = null;
        let minDist = Infinity;

        game.units.forEach(unit => {
            if (unit.team !== this.team && unit.alive) {
                const dist = Math.hypot(unit.realX - this.x, unit.realY - this.y);
                if (dist <= this.range && dist < minDist) {
                    minDist = dist;
                    closest = unit;
                }
            }
        });

        return closest;
    }
}

// Wall - Defensive structure
export class Wall extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'wall');
        this.hp = 500;
        this.maxHp = 500;
        this.maxBuildTime = 0.5;
    }
}

// Forge - Buffs nearby units
export class Forge extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'forge');
        this.hp = 300;
        this.maxHp = 300;
        this.buffRadius = 4;
        this.damageBonus = 1.25; // 25% more damage
        this.maxBuildTime = 2;
    }

    update(dt, game) {
        super.update(dt, game);
        // Forge passively buffs units in range
        // (handled in unit damage calculation)
    }
}

// Siege Workshop - Spawns Catapults
export class SiegeWorkshop extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'siege');
        this.hp = 300;
        this.maxHp = 300;
        this.spawnTimer = 0;
        this.spawnRate = 15;
        this.maxBuildTime = 2.5;
    }

    update(dt, game) {
        super.update(dt, game);
        // In multiplayer, only player's buildings spawn units locally
        if (this.team === 'enemy' && game.isMultiplayer) return;

        if (!this.isBuilding) {
            this.spawnTimer += dt;
            const rate = this.spawnRate * (1 - (game.upgrades?.spawnrate || 0));
            if (this.spawnTimer >= rate) {
                this.spawnTimer = 0;
                this.spawnUnit(game);
            }
        }
    }

    spawnUnit(game) {
        const spawnX = this.team === 'player' ? this.x + 1.5 : this.x - 0.5;
        const spawnY = this.y + 0.5;
        game.spawnUnit(spawnX, spawnY, this.team, 'catapult');
    }
}

// Mage Tower - Spawns Mages
export class MageTower extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'mage');
        this.hp = 280;
        this.maxHp = 280;
        this.spawnTimer = 0;
        this.spawnRate = 12;
        this.maxBuildTime = 2;
    }

    update(dt, game) {
        super.update(dt, game);
        // In multiplayer, only player's buildings spawn units locally
        if (this.team === 'enemy' && game.isMultiplayer) return;

        if (!this.isBuilding) {
            this.spawnTimer += dt;
            const rate = this.spawnRate * (1 - (game.upgrades?.spawnrate || 0));
            if (this.spawnTimer >= rate) {
                this.spawnTimer = 0;
                this.spawnUnit(game);
            }
        }
    }

    spawnUnit(game) {
        const spawnX = this.team === 'player' ? this.x + 1.5 : this.x - 0.5;
        const spawnY = this.y + 0.5;
        game.spawnUnit(spawnX, spawnY, this.team, 'mage');
    }
}

// Hospital - Heals nearby units
export class Hospital extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'hospital');
        this.hp = 250;
        this.maxHp = 250;
        this.healRadius = 4;
        this.healRate = 5; // HP per second
        this.healTimer = 0;
        this.maxBuildTime = 1.5;
    }

    update(dt, game) {
        super.update(dt, game);
        if (this.isBuilding) return;

        this.healTimer += dt;
        if (this.healTimer >= 1) {
            this.healTimer = 0;
            this.healNearbyUnits(game);
        }
    }

    healNearbyUnits(game) {
        game.units.forEach(unit => {
            if (unit.team === this.team && unit.alive && unit.hp < unit.maxHp) {
                const dist = Math.hypot(unit.realX - this.x, unit.realY - this.y);
                if (dist <= this.healRadius) {
                    unit.heal(this.healRate);
                    if (game.particles) {
                        game.particles.spawnHeal(unit.realX, unit.realY);
                    }
                }
            }
        });
    }
}

// Research Center - Provides upgrades
export class ResearchCenter extends Building {
    constructor(x, y, team) {
        super(x, y, team, 'research');
        this.hp = 200;
        this.maxHp = 200;
        this.maxBuildTime = 2;
        this.hasResearched = false;
    }

    update(dt, game) {
        super.update(dt, game);
        // Research is handled via click interaction in Game.js
    }
}


// Base Unit class
export class Unit extends Entity {
    constructor(x, y, team, type) {
        super(x, y, team);
        this.type = type;
        this.realX = x;
        this.realY = y;
        this.speed = 2;
        this.damage = 10;
        this.attackRange = 1.2;
        this.attackCooldown = 1;
        this.attackTimer = 0;
        this.target = null;
        this.level = 1;

        // Animation state
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.isAttacking = false;
        this.attackAnimTimer = 0;
        this.direction = team === 'player' ? 1 : -1; // 1 = right, -1 = left
    }

    update(dt, game) {
        this.attackTimer += dt;
        this.animationTimer += dt;

        if (this.animationTimer > 0.15) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
        }

        if (this.isAttacking) {
            this.attackAnimTimer += dt;
            if (this.attackAnimTimer > 0.2) {
                this.isAttacking = false;
                this.attackAnimTimer = 0;
            }
        }

        // MULTIPLAYER: Skip simulation for enemy units on non-host client
        // Host runs full simulation, non-host only simulates their own units
        // Enemy unit positions come from host via syncFromHostState
        if (game.isMultiplayer && game.useWebSocket && !game.multiplayer.isHost) {
            // Non-host client: only simulate player's own units
            if (this.team === 'enemy') {
                // Don't simulate enemy units - their state comes from host
                return;
            }
        }

        // Find target
        const target = this.findTarget(game);

        if (target) {
            const dist = Math.hypot(
                (target.realX || target.x) - this.realX,
                (target.realY || target.y) - this.realY
            );

            if (dist <= this.attackRange) {
                // Attack
                if (this.attackTimer >= this.attackCooldown) {
                    this.attack(target, game);
                    this.attackTimer = 0;
                }
            } else {
                // Move towards target
                this.moveTowards(target.realX || target.x, target.realY || target.y, dt, game);
            }
        } else {
            // Move towards enemy castle
            const enemyCastle = this.team === 'player' ? game.enemyCastle : game.playerCastle;
            if (enemyCastle && enemyCastle.alive) {
                this.moveTowards(enemyCastle.x + 1, enemyCastle.y + 1, dt, game);
            }
        }

        // Update grid position
        this.x = Math.round(this.realX);
        this.y = Math.round(this.realY);
    }

    attack(target, game) {
        this.isAttacking = true;
        this.attackAnimTimer = 0;

        // Calculate damage with forge bonus
        let dmg = this.damage;
        const forge = game.buildings.find(b =>
            b.type === 'forge' &&
            b.team === this.team &&
            !b.isBuilding &&
            Math.hypot(b.x - this.realX, b.y - this.realY) <= b.buffRadius
        );
        if (forge) {
            dmg *= forge.damageBonus;
        }

        target.takeDamage(dmg, game);

        if (game.sound) game.sound.playSound('hit');

        // Reward for kill
        if (!target.alive && target.team !== this.team && this.team === 'player') {
            const reward = target.type === 'knight' ? 15 :
                target.type === 'archer' ? 12 :
                    target.type === 'cavalry' ? 25 : 10;
            game.addResources(reward);
            game.addScore(reward * 2);
            game.kills++;
        }
    }

    moveTowards(targetX, targetY, dt, game) {
        const dx = targetX - this.realX;
        const dy = targetY - this.realY;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.1) {
            // Update direction for animation
            this.direction = dx > 0 ? 1 : -1;

            // Simple movement with slight avoidance
            let moveX = (dx / dist) * this.speed * dt;
            let moveY = (dy / dist) * this.speed * dt;

            // Basic collision avoidance with other units
            game.units.forEach(u => {
                if (u !== this && u.alive) {
                    const udx = this.realX - u.realX;
                    const udy = this.realY - u.realY;
                    const udist = Math.hypot(udx, udy);
                    if (udist < 0.5 && udist > 0) {
                        moveX += (udx / udist) * dt * 0.5;
                        moveY += (udy / udist) * dt * 0.5;
                    }
                }
            });

            this.realX += moveX;
            this.realY += moveY;

            // Keep in bounds
            this.realX = Math.max(0, Math.min(game.cols - 1, this.realX));
            this.realY = Math.max(0, Math.min(game.rows - 1, this.realY));
        }
    }

    findTarget(game) {
        let closest = null;
        let minDist = 6; // Aggro range

        // Prioritize units
        game.units.forEach(u => {
            if (u.team !== this.team && u.alive) {
                const dist = Math.hypot(u.realX - this.realX, u.realY - this.realY);
                if (dist < minDist) {
                    minDist = dist;
                    closest = u;
                }
            }
        });

        if (closest) return closest;

        // Then buildings
        minDist = 6;
        game.buildings.forEach(b => {
            if (b.team !== this.team && b.alive) {
                const dist = Math.hypot(b.x - this.realX, b.y - this.realY);
                if (dist < minDist) {
                    minDist = dist;
                    closest = b;
                }
            }
        });

        return closest;
    }
}

// Knight - Balanced melee unit
export class Knight extends Unit {
    constructor(x, y, team) {
        super(x, y, team, 'knight');
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 12;
        this.speed = 2;
        this.attackRange = 1.2;
        this.attackCooldown = 1;
    }
}

// Archer - Ranged unit, low HP
export class Archer extends Unit {
    constructor(x, y, team) {
        super(x, y, team, 'archer');
        this.hp = 60;
        this.maxHp = 60;
        this.damage = 8;
        this.speed = 1.8;
        this.attackRange = 4;
        this.attackCooldown = 1.5;
    }

    attack(target, game) {
        this.isAttacking = true;
        this.attackAnimTimer = 0;

        // Shoot projectile
        if (game.projectiles) {
            game.projectiles.push({
                x: this.realX,
                y: this.realY,
                targetX: target.realX || target.x,
                targetY: target.realY || target.y,
                progress: 0,
                speed: 6,
                color: this.team === 'player' ? '#4a9eff' : '#ff4a4a',
                type: 'arrow',
                damage: this.damage,
                target: target,
                team: this.team
            });
        }

        if (game.sound) game.sound.playSound('arrow');

        // Damage is dealt when projectile hits (handled in Game.js)
    }
}

// Cavalry - Fast, high damage
export class Cavalry extends Unit {
    constructor(x, y, team) {
        super(x, y, team, 'cavalry');
        this.hp = 120;
        this.maxHp = 120;
        this.damage = 20;
        this.speed = 4;
        this.attackRange = 1.5;
        this.attackCooldown = 1.2;
    }
}

// Catapult - Slow, area damage to buildings
export class Catapult extends Unit {
    constructor(x, y, team) {
        super(x, y, team, 'catapult');
        this.hp = 150;
        this.maxHp = 150;
        this.damage = 40;
        this.speed = 0.8;
        this.attackRange = 5;
        this.attackCooldown = 3;
        this.splashRadius = 1;
    }

    attack(target, game) {
        this.isAttacking = true;
        this.attackAnimTimer = 0;

        // Launch projectile
        if (game.projectiles) {
            game.projectiles.push({
                x: this.realX,
                y: this.realY,
                targetX: target.realX || target.x,
                targetY: target.realY || target.y,
                progress: 0,
                speed: 3,
                color: '#ff8800',
                type: 'boulder',
                damage: this.damage,
                target: target,
                team: this.team,
                splash: true,
                splashRadius: this.splashRadius
            });
        }

        if (game.sound) game.sound.playSound('arrow');
    }

    findTarget(game) {
        // Catapults prefer buildings
        let closest = null;
        let minDist = 8;

        game.buildings.forEach(b => {
            if (b.team !== this.team && b.alive) {
                const dist = Math.hypot(b.x - this.realX, b.y - this.realY);
                if (dist < minDist) {
                    minDist = dist;
                    closest = b;
                }
            }
        });

        if (closest) return closest;

        // Fall back to units
        return super.findTarget(game);
    }
}

// Mage - Area damage caster
export class Mage extends Unit {
    constructor(x, y, team) {
        super(x, y, team, 'mage');
        this.hp = 50;
        this.maxHp = 50;
        this.damage = 20;
        this.speed = 1.5;
        this.attackRange = 3.5;
        this.attackCooldown = 2;
        this.splashRadius = 1.5;
    }

    attack(target, game) {
        this.isAttacking = true;
        this.attackAnimTimer = 0;

        // Area magic attack
        const targetX = target.realX || target.x;
        const targetY = target.realY || target.y;

        // Damage all enemies in splash radius
        [...game.units, ...game.buildings].forEach(entity => {
            if (entity.team !== this.team && entity.alive) {
                const dist = Math.hypot(
                    (entity.realX || entity.x) - targetX,
                    (entity.realY || entity.y) - targetY
                );
                if (dist <= this.splashRadius) {
                    const dmg = this.damage * (1 - dist / (this.splashRadius * 1.5));
                    entity.takeDamage(dmg, game);
                }
            }
        });

        // Visual effect
        if (game.particles) {
            game.particles.spawnExplosion(targetX, targetY, 0.8);
        }

        if (game.sound) game.sound.playSound('hit');

        // Kill rewards
        if (!target.alive && target.team !== this.team && this.team === 'player') {
            game.addResources(15);
            game.addScore(30);
            game.kills++;
        }
    }
}

// Building costs configuration
export const BUILDING_COSTS = {
    mine: 50,
    farm: 40,
    barracks: 100,
    archery: 120,
    stable: 150,
    siege: 200,
    mage: 180,
    tower: 80,
    wall: 30,
    forge: 200,
    hospital: 150,
    research: 250
};

// Building descriptions for tooltips
export const BUILDING_INFO = {
    mine: {
        name: 'Lego Mine',
        desc: 'Produces +5 Lego every 5 seconds. Also increases passive income.',
        stats: { 'HP': 200, 'Production': '+5/5s' }
    },
    farm: {
        name: 'Farm',
        desc: 'Produces +3 Lego every 8 seconds.',
        stats: { 'HP': 150, 'Production': '+3/8s' }
    },
    barracks: {
        name: 'Barracks',
        desc: 'Trains Knight units automatically.',
        stats: { 'HP': 300, 'Spawn Rate': '6s' }
    },
    archery: {
        name: 'Archery Range',
        desc: 'Trains Archer units with ranged attacks.',
        stats: { 'HP': 250, 'Spawn Rate': '7s' }
    },
    stable: {
        name: 'Stable',
        desc: 'Trains fast Cavalry units.',
        stats: { 'HP': 350, 'Spawn Rate': '10s' }
    },
    siege: {
        name: 'Siege Workshop',
        desc: 'Builds powerful Catapults for destroying buildings.',
        stats: { 'HP': 300, 'Spawn Rate': '15s' }
    },
    mage: {
        name: 'Mage Tower',
        desc: 'Trains Mages with area damage spells.',
        stats: { 'HP': 280, 'Spawn Rate': '12s' }
    },
    tower: {
        name: 'Defense Tower',
        desc: 'Shoots arrows at nearby enemies.',
        stats: { 'HP': 400, 'Damage': 15, 'Range': 5 }
    },
    wall: {
        name: 'Wall',
        desc: 'Blocks enemy movement. High HP.',
        stats: { 'HP': 500 }
    },
    forge: {
        name: 'Forge',
        desc: 'Increases damage of nearby friendly units by 25%.',
        stats: { 'HP': 300, 'Buff Range': 4, 'Damage Bonus': '+25%' }
    },
    hospital: {
        name: 'Hospital',
        desc: 'Heals nearby friendly units over time.',
        stats: { 'HP': 250, 'Heal Range': 4, 'Heal Rate': '5 HP/s' }
    },
    research: {
        name: 'Research Center',
        desc: 'Click to choose from 3 random upgrades!',
        stats: { 'HP': 200, 'Upgrades': 'Random' }
    }
};

// Available upgrades for Research Center
export const UPGRADES = [
    { id: 'damage1', name: 'Sharp Blades', desc: 'All units deal +15% damage', effect: { type: 'damage', value: 0.15 } },
    { id: 'damage2', name: 'Heavy Blows', desc: 'All units deal +25% damage', effect: { type: 'damage', value: 0.25 } },
    { id: 'health1', name: 'Thick Armor', desc: 'All units have +20% HP', effect: { type: 'health', value: 0.20 } },
    { id: 'health2', name: 'Iron Will', desc: 'All units have +35% HP', effect: { type: 'health', value: 0.35 } },
    { id: 'speed1', name: 'Swift Feet', desc: 'All units move 20% faster', effect: { type: 'speed', value: 0.20 } },
    { id: 'speed2', name: 'Windrunner', desc: 'All units move 40% faster', effect: { type: 'speed', value: 0.40 } },
    { id: 'income1', name: 'Efficient Mining', desc: '+2 passive income', effect: { type: 'income', value: 2 } },
    { id: 'income2', name: 'Gold Rush', desc: '+5 passive income', effect: { type: 'income', value: 5 } },
    { id: 'range1', name: 'Eagle Eye', desc: 'Ranged units +1 range', effect: { type: 'range', value: 1 } },
    { id: 'attackspeed1', name: 'Battle Fury', desc: 'All units attack 20% faster', effect: { type: 'attackspeed', value: 0.20 } },
    { id: 'spawn1', name: 'Rapid Training', desc: 'Buildings spawn units 20% faster', effect: { type: 'spawnrate', value: 0.20 } },
    { id: 'tower1', name: 'Reinforced Towers', desc: 'Towers deal +50% damage', effect: { type: 'towerdamage', value: 0.50 } }
];

