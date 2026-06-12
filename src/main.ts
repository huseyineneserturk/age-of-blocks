import { Game } from './game/game';
import type { Difficulty } from './game/ai';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menu = document.getElementById('main-menu')!;
const startBtn = document.getElementById('mm-start')!;

let difficulty: Difficulty = 'normal';

document.querySelectorAll<HTMLButtonElement>('.mm-diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mm-diff-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff as Difficulty;
  });
});

startBtn.addEventListener('click', () => {
  menu.classList.add('hidden');
  const game = new Game(canvas, difficulty);
  (window as unknown as { game: Game }).game = game;
  console.log('⚔ Age of Blocks: War Fronts — savaş başladı');
});
