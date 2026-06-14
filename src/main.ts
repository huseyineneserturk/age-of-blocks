import { Game } from './game/game';
import type { Difficulty } from './game/ai';
import { NetConnection } from './net/client';
import { MenuScene } from './ui/menuScene';
import { CIVS, CIV_LIST, type CivId } from './data/civs';
import type { LobbyState } from './net/protocol';
import { t, getLang, setLang, onLangChange, civLabel, civBonus, type Lang } from './i18n';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menu = document.getElementById('main-menu')!;
const statusEl = document.getElementById('mm-status')!;
const onlineEl = document.getElementById('mm-online')!;
const onlineTextEl = document.getElementById('mm-online-text')!;
const langEl = document.getElementById('mm-lang')!;
const roomListEl = document.getElementById('mm-room-list')!;
const roomNameInput = document.getElementById('room-name') as HTMLInputElement;
const roomPassInput = document.getElementById('room-pass') as HTMLInputElement;
const joinPassInput = document.getElementById('join-pass') as HTMLInputElement;
const joinPassField = document.getElementById('join-pass-field')!;
const joinRoomLabel = document.getElementById('join-room-label')!;

type Screen = 'landing' | 'single' | 'lobby' | 'create' | 'join' | 'waiting';

let difficulty: Difficulty = 'normal';
let selectedCiv: CivId = 'rome';
let starting = false; // joining / launching a multiplayer match
let currentScreen: Screen = 'landing';
let pendingJoin: { code: string; name: string; locked: boolean } | null = null;

const menuScene = new MenuScene(document.getElementById('menu-scene') as HTMLCanvasElement);
menuScene.startLoop();

// --- Menu music (starts on first interaction — browsers block autoplay) ---
const music = document.getElementById('menu-music') as HTMLAudioElement;
const gameMusic = document.getElementById('game-music') as HTMLAudioElement;
const musicBtn = document.getElementById('mm-music')!;
music.volume = 0.45;
gameMusic.volume = 0.35;
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

// --- Screen navigation ---
function showScreen(name: Screen): void {
  currentScreen = name;
  document.querySelectorAll<HTMLElement>('.mm-screen').forEach((s) =>
    s.classList.toggle('active', s.dataset.screen === name),
  );
  if (name !== 'waiting') status(null);
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
  roomNameInput.placeholder = t('menu.roomNamePh');
  roomPassInput.placeholder = t('menu.passwordPh');
  joinPassInput.placeholder = t('menu.passwordPh');
  musicBtn.title = t('menu.music');
  renderCivPickers();
  renderOnline();
  renderRooms();
}

langEl.querySelectorAll<HTMLButtonElement>('.mm-lang-btn').forEach((b) => {
  b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
});
onLangChange(refreshLang);

// --- Civilization picker (shared across single / create / join screens) ---
function renderCivPickers(): void {
  document.querySelectorAll<HTMLElement>('[data-civs]').forEach((container) => {
    container.innerHTML = '';
    for (const id of CIV_LIST) {
      const civ = CIVS[id];
      const btn = document.createElement('button');
      btn.className = 'mm-civ-btn' + (id === selectedCiv ? ' active' : '');
      btn.innerHTML = `<span class="ce">${civ.emblem}</span>${civLabel(id).toLocaleUpperCase(getLang())}`;
      btn.addEventListener('click', () => {
        selectedCiv = id;
        renderCivPickers();
      });
      container.appendChild(btn);
    }
  });
  const b = civBonus(selectedCiv);
  document.querySelectorAll<HTMLElement>('[data-civ-bonus]').forEach((el) => {
    el.textContent = `${b.name} — ${b.desc}`;
  });
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
  if (musicWanted) {
    gameMusic.volume = 0.35;
    void gameMusic.play().catch(() => {});
  }
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

// --- Mode select ---
document.getElementById('mode-single')!.addEventListener('click', () => showScreen('single'));
document.getElementById('mode-multi')!.addEventListener('click', () => showScreen('lobby'));
document.querySelectorAll<HTMLButtonElement>('.mm-back').forEach((b) => {
  b.addEventListener('click', () => showScreen(b.dataset.target as Screen));
});

// --- Single player ---
document.getElementById('sp-start')!.addEventListener('click', () => {
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

function emptyRow(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'mm-room-empty';
  d.textContent = text;
  return d;
}

function renderRooms(): void {
  roomListEl.innerHTML = '';
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
      `<span class="mm-room-civ" title="${t('menu.host')}: ${civLabel(r.civ)}">` +
      `<span class="ce">${civ.emblem}</span>${escapeHtml(r.name)}</span>` +
      `<span class="mm-room-status">${r.locked ? '<span class="mm-room-lock">🔒</span>' : ''}${t('menu.waiting')}</span>`;
    const join = document.createElement('button');
    join.className = 'mm-join-btn';
    join.textContent = t('menu.join');
    join.addEventListener('click', () => openJoin(r));
    row.appendChild(join);
    roomListEl.appendChild(row);
  }
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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
    if (currentScreen === 'lobby') renderRooms();
  };
  lobby.onStart = () => launch(lobby!);
  lobby.onConnectionLost = () => {
    connected = false;
    connecting = false;
    renderOnline();
    if (currentScreen === 'waiting') showScreen('lobby');
    renderRooms();
  };

  lobby
    .connect(SERVER_URL)
    .then(() => {
      connected = true;
      connecting = false;
      renderOnline();
      lobby!.requestLobby();
    })
    .catch(() => {
      connected = false;
      connecting = false;
      renderOnline();
      renderRooms();
    });
}

// Create room: open the form, then confirm.
document.getElementById('open-create')!.addEventListener('click', () => {
  if (!connected) {
    status(t('menu.connectFail'));
    return;
  }
  if (!roomNameInput.value.trim()) roomNameInput.value = '';
  showScreen('create');
});

document.getElementById('create-confirm')!.addEventListener('click', () => {
  if (!connected || !lobby) {
    status(t('menu.connectFail'));
    return;
  }
  showScreen('waiting');
  void lobby.createRoom({
    civ: selectedCiv,
    name: roomNameInput.value.trim(),
    password: roomPassInput.value,
  });
});

document.getElementById('waiting-cancel')!.addEventListener('click', () => {
  lobby?.leaveRoom();
  showScreen('lobby');
});

document.getElementById('mm-refresh')!.addEventListener('click', () => {
  if (connected) lobby?.requestLobby();
  else connectLobby();
});

function openJoin(room: { code: string; name: string; locked: boolean }): void {
  pendingJoin = room;
  joinRoomLabel.textContent = room.name;
  joinPassField.style.display = room.locked ? '' : 'none';
  joinPassInput.value = '';
  showScreen('join');
}

document.getElementById('join-confirm')!.addEventListener('click', () => {
  if (!pendingJoin || !connected || !lobby || starting) return;
  starting = true;
  status(t('menu.joining'));
  const pw = pendingJoin.locked ? joinPassInput.value : undefined;
  void lobby.joinRoom(pendingJoin.code, selectedCiv, pw).then((res) => {
    if (!res.ok) {
      status(`${t('menu.joinFail')} — ${t('err.' + (res.error ?? 'not_found'))}`);
      starting = false;
    }
    // On success the server emits `start` → lobby.onStart → launch().
  });
});

// --- Boot ---
refreshLang();
showScreen('landing');
connectLobby();
