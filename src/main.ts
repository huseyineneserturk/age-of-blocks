import { Game } from './game/game';
import type { Difficulty } from './game/ai';
import { NetConnection } from './net/client';
import { MenuScene } from './ui/menuScene';
import { CIVS, CIV_LIST, type CivId } from './data/civs';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menu = document.getElementById('main-menu')!;
const startBtn = document.getElementById('mm-start')!;
const createBtn = document.getElementById('mm-create')!;
const joinBtn = document.getElementById('mm-join')!;
const codeInput = document.getElementById('mm-code') as HTMLInputElement;
const statusEl = document.getElementById('mm-status')!;
const civsEl = document.getElementById('mm-civs')!;
const civBonusEl = document.getElementById('mm-civ-bonus')!;

let difficulty: Difficulty = 'normal';
let selectedCiv: CivId = 'rome';
let starting = false;

const menuScene = new MenuScene(document.getElementById('menu-scene') as HTMLCanvasElement);
menuScene.startLoop();

// --- Menu music (starts on first interaction — browsers block autoplay) ---
const music = document.getElementById('menu-music') as HTMLAudioElement;
const musicBtn = document.getElementById('mm-music')!;
music.volume = 0.45;
let musicWanted = true;

function tryPlayMusic(): void {
  if (musicWanted && music.paused) void music.play().catch(() => {});
}
window.addEventListener('pointerdown', tryPlayMusic, { once: true });
window.addEventListener('keydown', tryPlayMusic, { once: true });
musicBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  musicWanted = !musicWanted;
  musicBtn.classList.toggle('off', !musicWanted);
  musicBtn.textContent = musicWanted ? '♪' : '♪̸';
  if (musicWanted) void music.play().catch(() => {});
  else music.pause();
});

function fadeOutMusic(): void {
  const step = (): void => {
    if (music.volume > 0.05) {
      music.volume = Math.max(0, music.volume - 0.05);
      setTimeout(step, 80);
    } else {
      music.pause();
    }
  };
  step();
}

// --- Civilization picker ---
function buildCivPicker(): void {
  civsEl.innerHTML = '';
  for (const id of CIV_LIST) {
    const civ = CIVS[id];
    const btn = document.createElement('button');
    btn.className = 'mm-civ-btn' + (id === selectedCiv ? ' active' : '');
    btn.innerHTML = `<span class="ce">${civ.emblem}</span>${civ.label.toUpperCase()}`;
    btn.addEventListener('click', () => {
      selectedCiv = id;
      civsEl.querySelectorAll('.mm-civ-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateCivBonus();
    });
    civsEl.appendChild(btn);
  }
  updateCivBonus();
}
function updateCivBonus(): void {
  const civ = CIVS[selectedCiv];
  civBonusEl.textContent = `${civ.bonusName} — ${civ.bonusDesc}`;
}
buildCivPicker();

// --- Difficulty ---
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
  menuScene.stop();
  fadeOutMusic();
  menu.classList.add('hidden');
  const game = new Game(canvas, difficulty, net, selectedCiv);
  (window as unknown as { game: Game }).game = game;
}

// Match server URL: ?server=... override wins. In local dev we hit the
// match server on :3001 of the same host; in production it lives behind the
// `server.<domain>` subdomain (nginx → localhost:3001), so derive that.
const serverOverride = new URLSearchParams(location.search).get('server');
const isLocalHost =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const SERVER_URL =
  serverOverride ??
  (isLocalHost
    ? `${location.protocol}//${location.hostname}:3001`
    : `https://server.${location.hostname.replace(/^www\./, '')}`);

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
  const code = await net.createRoom(selectedCiv);
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
  const res = await net.joinRoom(code, selectedCiv);
  if (!res.ok) {
    status(`❌ ${res.error ?? 'Katılamadı'}`);
    net.disconnect();
    starting = false;
  } else {
    status('Katıldın — maç başlıyor...');
  }
});
