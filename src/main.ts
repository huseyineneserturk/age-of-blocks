import { Game } from './game/game';
import type { Difficulty } from './game/ai';
import { NetConnection } from './net/client';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menu = document.getElementById('main-menu')!;
const startBtn = document.getElementById('mm-start')!;
const createBtn = document.getElementById('mm-create')!;
const joinBtn = document.getElementById('mm-join')!;
const codeInput = document.getElementById('mm-code') as HTMLInputElement;
const statusEl = document.getElementById('mm-status')!;

let difficulty: Difficulty = 'normal';
let starting = false;

// Match server URL: ?server=... override, else same host on :3001.
const SERVER_URL =
  new URLSearchParams(location.search).get('server') ??
  `${location.protocol}//${location.hostname}:3001`;

document.querySelectorAll<HTMLButtonElement>('.mm-diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mm-diff-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff as Difficulty;
  });
});

function status(text: string): void {
  statusEl.textContent = text;
  statusEl.classList.remove('hidden');
}

function launch(net: NetConnection | null): void {
  menu.classList.add('hidden');
  const game = new Game(canvas, difficulty, net);
  (window as unknown as { game: Game }).game = game;
}

// --- Single player ---
startBtn.addEventListener('click', () => {
  if (starting) return;
  launch(null);
});

// --- Multiplayer ---
async function connect(): Promise<NetConnection | null> {
  status('Sunucuya bağlanılıyor...');
  const net = new NetConnection();
  try {
    await net.connect(SERVER_URL);
    return net;
  } catch {
    status('❌ Sunucuya bağlanılamadı — maç sunucusu çalışıyor mu? (npm run server)');
    return null;
  }
}

createBtn.addEventListener('click', async () => {
  if (starting) return;
  starting = true;
  const net = await connect();
  if (!net) {
    starting = false;
    return;
  }
  net.onStart = () => launch(net);
  const code = await net.createRoom();
  status(`Oda kodu: ${code} — rakibin bu kodla katılmasını bekle...`);
});

joinBtn.addEventListener('click', async () => {
  if (starting) return;
  const code = codeInput.value.trim().toUpperCase();
  if (code.length < 4) {
    status('Geçerli bir oda kodu gir');
    return;
  }
  starting = true;
  const net = await connect();
  if (!net) {
    starting = false;
    return;
  }
  net.onStart = () => launch(net);
  const res = await net.joinRoom(code);
  if (!res.ok) {
    status(`❌ ${res.error ?? 'Katılamadı'}`);
    net.disconnect();
    starting = false;
  } else {
    status('Katıldın — maç başlıyor...');
  }
});
