import { Game } from './game/game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);

// Expose for debugging in the console.
(window as unknown as { game: Game }).game = game;

console.log('⚔ Age of Blocks: War Fronts — RTS çekirdeği yüklendi');
