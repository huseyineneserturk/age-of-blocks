import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);

    // Expose game for debugging
    window.game = game;

    console.log('🏰 Medieval Lego Wars loaded!');
    console.log('📖 Controls:');
    console.log('   1-8: Select building');
    console.log('   Click: Place building on your side');
    console.log('   ESC: Deselect / Pause');
    console.log('   P: Pause/Resume');
});
