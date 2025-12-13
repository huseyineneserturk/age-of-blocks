// Particle System for visual effects
export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx += p.ax * dt;
            p.vy += p.ay * dt;
            p.alpha = Math.max(0, p.life / p.maxLife);
            p.size *= (1 - dt * p.shrink);
        }
    }

    render(ctx, gridSize) {
        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.8;

            const screenX = p.x * gridSize;
            const screenY = p.y * gridSize;

            if (p.type === 'circle') {
                const gradient = ctx.createRadialGradient(
                    screenX, screenY, 0,
                    screenX, screenY, p.size
                );
                gradient.addColorStop(0, p.color);
                gradient.addColorStop(1, 'transparent');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'square') {
                ctx.fillStyle = p.color;
                ctx.fillRect(
                    screenX - p.size / 2,
                    screenY - p.size / 2,
                    p.size,
                    p.size
                );
            } else if (p.type === 'star') {
                ctx.fillStyle = p.color;
                ctx.translate(screenX, screenY);
                ctx.rotate(p.rotation || 0);
                this.drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
                ctx.fill();
            }

            ctx.restore();
        });
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    }

    // Spawn damage particles when entity takes damage
    spawnDamage(x, y, amount, isPlayer = false) {
        const color = isPlayer ? '#ff4a4a' : '#ffd700';
        const count = Math.min(15, Math.floor(amount / 5) + 3);

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 2 + Math.random() * 3;

            this.particles.push({
                x: x + 0.5,
                y: y + 0.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ax: 0,
                ay: 2,
                size: 6 + Math.random() * 4,
                color: color,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8,
                alpha: 1,
                shrink: 0.5,
                type: 'circle'
            });
        }
    }

    // Spawn particles when building is constructed
    spawnBuild(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;

            this.particles.push({
                x: x + 0.5 + (Math.random() - 0.5) * 0.5,
                y: y + 0.5 + (Math.random() - 0.5) * 0.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                ax: 0,
                ay: 3,
                size: 4 + Math.random() * 6,
                color: ['#ffd700', '#ffaa00', '#ff8800'][Math.floor(Math.random() * 3)],
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1,
                alpha: 1,
                shrink: 0.3,
                type: 'square'
            });
        }
    }

    // Spawn particles when entity dies
    spawnDeath(x, y, team) {
        const colors = team === 'player' ? ['#4a9eff', '#6eb5ff', '#ffffff'] : ['#ff4a4a', '#ff7b7b', '#ffffff'];

        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;

            this.particles.push({
                x: x + 0.5,
                y: y + 0.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ax: 0,
                ay: 5,
                size: 5 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.8 + Math.random() * 0.4,
                maxLife: 1.2,
                alpha: 1,
                shrink: 0.4,
                type: 'circle'
            });
        }
    }

    // Spawn heal effect
    spawnHeal(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x + 0.5 + (Math.random() - 0.5) * 0.8,
                y: y + 0.5,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1.5 - Math.random(),
                ax: 0,
                ay: 0,
                size: 8 + Math.random() * 4,
                color: '#32cd32',
                life: 0.8 + Math.random() * 0.3,
                maxLife: 1.1,
                alpha: 1,
                shrink: 0.2,
                type: 'star',
                rotation: Math.random() * Math.PI
            });
        }
    }

    // Spawn resource collection effect
    spawnResource(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: x + 0.5,
                y: y + 0.5,
                vx: (Math.random() - 0.5) * 2,
                vy: -2 - Math.random() * 2,
                ax: 0,
                ay: 1,
                size: 10 + Math.random() * 5,
                color: '#ffd700',
                life: 0.8 + Math.random() * 0.4,
                maxLife: 1.2,
                alpha: 1,
                shrink: 0.3,
                type: 'square'
            });
        }
    }

    // Spawn projectile trail
    spawnTrail(x, y, color = '#ffd700') {
        this.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            ax: 0,
            ay: 0,
            size: 3 + Math.random() * 2,
            color: color,
            life: 0.2 + Math.random() * 0.1,
            maxLife: 0.3,
            alpha: 0.7,
            shrink: 0.5,
            type: 'circle'
        });
    }

    // Spawn explosion effect
    spawnExplosion(x, y, radius = 1) {
        const count = Math.floor(radius * 20);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5 * radius;

            this.particles.push({
                x: x + 0.5,
                y: y + 0.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ax: 0,
                ay: 3,
                size: 8 + Math.random() * 12,
                color: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'][Math.floor(Math.random() * 4)],
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1,
                alpha: 1,
                shrink: 0.6,
                type: 'circle'
            });
        }
    }

    // Spawn wave start effect
    spawnWaveStart() {
        // This creates particles across the right side of the screen
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: 28 + Math.random() * 2,
                y: 2 + Math.random() * 16,
                vx: -3 - Math.random() * 2,
                vy: (Math.random() - 0.5) * 2,
                ax: 0,
                ay: 0,
                size: 10 + Math.random() * 10,
                color: '#ff4a4a',
                life: 1 + Math.random() * 0.5,
                maxLife: 1.5,
                alpha: 0.8,
                shrink: 0.3,
                type: 'circle'
            });
        }
    }

    clear() {
        this.particles = [];
    }
}
