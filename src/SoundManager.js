// Sound Manager using Web Audio API for procedural sounds
export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.masterVolume = 0.3;
        this.musicVolume = 0.15;
        this.sfxVolume = 0.4;

        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    // Play a procedurally generated sound
    playSound(type) {
        if (!this.initialized || !this.sfxEnabled || !this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        switch (type) {
            case 'build':
                this.playBuildSound(ctx, now);
                break;
            case 'hit':
                this.playHitSound(ctx, now);
                break;
            case 'death':
                this.playDeathSound(ctx, now);
                break;
            case 'spawn':
                this.playSpawnSound(ctx, now);
                break;
            case 'click':
                this.playClickSound(ctx, now);
                break;
            case 'select':
                this.playSelectSound(ctx, now);
                break;
            case 'wave':
                this.playWaveSound(ctx, now);
                break;
            case 'victory':
                this.playVictorySound(ctx, now);
                break;
            case 'defeat':
                this.playDefeatSound(ctx, now);
                break;
            case 'resource':
                this.playResourceSound(ctx, now);
                break;
            case 'arrow':
                this.playArrowSound(ctx, now);
                break;
        }
    }

    createGain(ctx, volume) {
        const gainNode = ctx.createGain();
        gainNode.gain.value = volume * this.masterVolume * this.sfxVolume;
        gainNode.connect(ctx.destination);
        return gainNode;
    }

    playBuildSound(ctx, now) {
        // Hammering/construction sound
        const osc = ctx.createOscillator();
        const gain = this.createGain(ctx, 0.3);

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.15);

        // Second hit
        const osc2 = ctx.createOscillator();
        const gain2 = this.createGain(ctx, 0.2);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(180, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(90, now + 0.2);

        gain2.gain.setValueAtTime(0.2 * this.sfxVolume, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc2.connect(gain2);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.25);
    }

    playHitSound(ctx, now) {
        // Impact sound
        const osc = ctx.createOscillator();
        const gain = this.createGain(ctx, 0.2);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

        gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playDeathSound(ctx, now) {
        // Death/explosion sound
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

        const gain = this.createGain(ctx, 0.3);
        gain.gain.setValueAtTime(0.3 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        noise.start(now);
        noise.stop(now + 0.3);
    }

    playSpawnSound(ctx, now) {
        // Spawn/summon sound
        const osc = ctx.createOscillator();
        const gain = this.createGain(ctx, 0.15);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

        gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playClickSound(ctx, now) {
        const osc = ctx.createOscillator();
        const gain = this.createGain(ctx, 0.1);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

        gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playSelectSound(ctx, now) {
        const osc = ctx.createOscillator();
        const gain = this.createGain(ctx, 0.12);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.05);

        gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playWaveSound(ctx, now) {
        // Epic wave incoming sound
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = this.createGain(ctx, 0.2);

            osc.type = 'sawtooth';
            const baseFreq = 100 + i * 50;
            osc.frequency.setValueAtTime(baseFreq, now + i * 0.1);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + i * 0.1 + 0.3);

            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + i * 0.1 + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);

            osc.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.5);
        }
    }

    playVictorySound(ctx, now) {
        // Triumphant fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = this.createGain(ctx, 0.2);

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);

            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.2 * this.sfxVolume, now + i * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);

            osc.connect(gain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.4);
        });
    }

    playDefeatSound(ctx, now) {
        // Sad defeat sound
        const notes = [392, 349.23, 293.66, 261.63]; // G4, F4, D4, C4

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = this.createGain(ctx, 0.15);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.2);

            gain.gain.setValueAtTime(0, now + i * 0.2);
            gain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, now + i * 0.2 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.5);

            osc.connect(gain);
            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.5);
        });
    }

    playResourceSound(ctx, now) {
        // Coin/resource pickup sound
        const osc = ctx.createOscillator();
        const gain = this.createGain(ctx, 0.1);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1600, now + 0.05);

        gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playArrowSound(ctx, now) {
        // Arrow/projectile whoosh
        const noise = ctx.createBufferSource();
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + 0.15);

        const gain = this.createGain(ctx, 0.1);
        gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        noise.start(now);
        noise.stop(now + 0.15);
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        return this.musicEnabled;
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
}
