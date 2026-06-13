import { Game } from './game/game';
import type { Difficulty } from './game/ai';
import { NetConnection } from './net/client';
import { MenuScene } from './ui/menuScene';
import { CIVS, CIV_LIST, type CivId } from './data/civs';
import type { LobbyState } from './net/protocol';
import { t, getLang, setLang, onLangChange, civLabel, civBonus, type Lang } from './i18n';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menu = document.getElementById('main-menu')!;
const startBtn = document.getElementById('mm-start')!;
const civsEl = document.getElementById('mm-civs')!;
const civBonusEl = document.getElementById('mm-civ-bonus')!;
const createBtn = document.getElementById('mm-create') as HTMLButtonElement;
const refreshBtn = document.getElementById('mm-refresh') as HTMLButtonElement;
const roomListEl = document.getElementById('mm-room-list')!;
const statusEl = document.getElementById('mm-status')!;
const onlineEl = document.getElementById('mm-online')!;
const onlineTextEl = document.getElementById('mm-online-text')!;
const langEl = document.getElementById('mm-lang')!;

let difficulty: Difficulty = 'normal';
let selectedCiv: CivId = 'rome';
let starting = false; // joining/launching a multiplayer match
let hosting = false; // created a room, waiting for an opponent

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

// --- Language ---
function applyStaticI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
}

function refreshLang(): void {
  applyStaticI18n();
  langEl.querySelectorAll<HTMLButtonElement>('.mm-lang-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.lang === getLang()),
  );
  document.documentElement.lang = getLang();
  buildCivPicker();
  updateCivBonus();
  updateCreateBtn();
  renderOnline();
  renderRooms();
  musicBtn.title = t('menu.music');
}

langEl.querySelectorAll<HTMLButtonElement>('.mm-lang-btn').forEach((b) => {
  b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
});
onLangChange(refreshLang);

// --- Civilization picker ---
function buildCivPicker(): void {
  civsEl.innerHTML = '';
  for (const id of CIV_LIST) {
    const civ = CIVS[id];
    const btn = document.createElement('button');
    btn.className = 'mm-civ-btn' + (id === selectedCiv ? ' active' : '');
    btn.innerHTML = `<span class="ce">${civ.emblem}</span>${civLabel(id).toUpperCase()}`;
    btn.addEventListener('click', () => {
      selectedCiv = id;
      civsEl.querySelectorAll('.mm-civ-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateCivBonus();
    });
    civsEl.appendChild(btn);
  }
}
function updateCivBonus(): void {
  const b = civBonus(selectedCiv);
  civBonusEl.textContent = `${b.name} — ${b.desc}`;
}

// --- Difficulty ---
document.querySelectorAll<HTMLButtonElement>('.mm-diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mm-diff-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff as Difficulty;
  });
});

function status(text: string | null): void {
  if (text === null) {
    statusEl.classList.add('hidden');
    return;
  }
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

// Match server URL: ?server=... override wins. In local dev we hit the match
// server on :3001 of the same host; in production it lives behind the
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

// --- Multiplayer lobby ---
let lobby: NetConnection | null = null;
let lobbyState: LobbyState = { online: 0, rooms: [] };
let connecting = true;
let connected = false;

function renderOnline(): void {
  onlineEl.classList.toggle('online', connected);
  onlineTextEl.textContent = connected
    ? t('menu.online', { n: lobbyState.online })
    : t('menu.offline');
}

function renderRooms(): void {
  roomListEl.innerHTML = '';
  if (hosting) {
    roomListEl.appendChild(emptyRow(t('menu.roomWaiting')));
    return;
  }
  if (connecting) {
    roomListEl.appendChild(emptyRow(t('menu.connecting')));
    return;
  }
  if (!connected) {
    roomListEl.appendChild(emptyRow(t('menu.connectFail')));
    return;
  }
  if (lobbyState.rooms.length === 0) {
    roomListEl.appendChild(emptyRow(t('menu.noRooms')));
    return;
  }
  for (const r of lobbyState.rooms) {
    const civ = CIVS[r.civ] ?? CIVS.rome;
    const row = document.createElement('div');
    row.className = 'mm-room';
    row.innerHTML =
      `<span class="mm-room-civ"><span class="ce">${civ.emblem}</span>${civLabel(r.civ)}</span>` +
      `<span class="mm-room-status">${t('menu.waiting')}</span>`;
    const join = document.createElement('button');
    join.className = 'mm-join-btn';
    join.textContent = t('menu.join');
    join.addEventListener('click', () => joinRoom(r.code));
    row.appendChild(join);
    roomListEl.appendChild(row);
  }
}

function emptyRow(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'mm-room-empty';
  d.textContent = text;
  return d;
}

function updateCreateBtn(): void {
  createBtn.textContent = hosting ? t('menu.cancel') : t('menu.createRoom');
  createBtn.classList.toggle('cancel', hosting);
  createBtn.disabled = !connected && !hosting;
}

function connectLobby(): void {
  connecting = true;
  connected = false;
  renderOnline();
  renderRooms();

  lobby = new NetConnection();
  lobby.onLobby = (s) => {
    lobbyState = s;
    connected = true;
    connecting = false;
    renderOnline();
    if (!hosting) renderRooms();
  };
  lobby.onStart = () => launch(lobby!);
  lobby.onConnectionLost = () => {
    connected = false;
    connecting = false;
    hosting = false;
    updateCreateBtn();
    renderOnline();
    renderRooms();
  };

  lobby
    .connect(SERVER_URL)
    .then(() => {
      connected = true;
      connecting = false;
      renderOnline();
      updateCreateBtn();
      lobby!.requestLobby();
    })
    .catch(() => {
      connected = false;
      connecting = false;
      renderOnline();
      renderRooms();
      updateCreateBtn();
    });
}

function createHost(): void {
  if (!connected || !lobby) {
    status(t('menu.connectFail'));
    return;
  }
  hosting = true;
  updateCreateBtn();
  renderRooms();
  status(t('menu.roomWaiting'));
  void lobby.createRoom(selectedCiv);
}

function cancelHost(): void {
  hosting = false;
  updateCreateBtn();
  status(null);
  lobby?.leaveRoom();
  renderRooms();
}

function joinRoom(code: string): void {
  if (!connected || !lobby || starting || hosting) return;
  starting = true;
  status(t('menu.joining'));
  void lobby.joinRoom(code, selectedCiv).then((res) => {
    if (!res.ok) {
      status(`${t('menu.joinFail')}${res.error ? ' — ' + res.error : ''}`);
      starting = false;
    }
    // On success the server emits `start` → lobby.onStart → launch().
  });
}

createBtn.addEventListener('click', () => {
  if (starting) return;
  if (hosting) cancelHost();
  else createHost();
});
refreshBtn.addEventListener('click', () => {
  if (connected) lobby?.requestLobby();
  else connectLobby();
});

// --- Boot ---
refreshLang();
connectLobby();
