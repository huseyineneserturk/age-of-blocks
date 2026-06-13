// Lightweight client-side i18n. Two languages (Turkish / English), auto-detected
// from the browser and overridable via the menu toggle (persisted to
// localStorage). Server code never imports this — it stays browser-only.

import type { CivId } from './data/civs';
import type { UnitKind } from './data/units';
import type { BuildingKind } from './data/buildings';

export type Lang = 'tr' | 'en';

const UI: Record<Lang, Record<string, string>> = {
  tr: {
    // Menu
    'menu.sub': 'Kur · Yönet · Fethet',
    'menu.chooseCiv': 'MEDENİYETİNİ SEÇ',
    'menu.campaign': 'SEFER · Tek Oyunculu',
    'menu.difficulty': 'ZORLUK',
    'diff.easy': 'Kolay',
    'diff.normal': 'Normal',
    'diff.hard': 'Zor',
    'menu.start': 'SAVAŞA BAŞLA',
    'menu.front': 'CEPHE · Çok Oyunculu 1v1',
    'menu.createRoom': '+ Oda Kur',
    'menu.openRooms': 'Açık Odalar',
    'menu.refresh': 'Yenile',
    'menu.noRooms': 'Açık oda yok — ilk odayı sen kur.',
    'menu.waiting': 'bekliyor',
    'menu.join': 'Katıl',
    'menu.online': '{n} çevrimiçi',
    'menu.offline': 'çevrimdışı',
    'menu.connecting': 'Sunucuya bağlanılıyor…',
    'menu.connectFail': '❌ Sunucuya bağlanılamadı — tekrar dene.',
    'menu.roomWaiting': 'Oda kuruldu — rakip bekleniyor…',
    'menu.cancel': 'İptal',
    'menu.joining': 'Katılınıyor…',
    'menu.joinFail': '❌ Katılınamadı',
    'menu.vs': 'sana karşı',
    'menu.music': 'Müzik',
    'menu.langName': 'Türkçe',

    // HUD
    'hud.noSelection': 'Birim seçilmedi',
    'hud.selected': 'Seçili: {x}',
    'hud.selectedBuilding': 'Seçili: {x}',
    'grp.economy': 'EKONOMİ',
    'grp.military': 'ASKER',
    'grp.defense': 'SAVUNMA',
    'hud.constructing': 'İnşa ediliyor…',
    'hud.rallyHint': 'Sağ tık: toplanma noktası belirle',
    'hud.research': 'Araştır',
    'hud.researching': 'Araştırılıyor',
    'hud.researchingHint': 'Araştırma sürüyor…',
    'hud.researchBuyHint': 'Altın karşılığı geliştirme puanı al (her seferinde pahalanır)',
    'hud.income': '+{x}/sn',
    'hud.fps': '{x} fps',
    'tip.trains': 'Üretir: {x}',
    'tip.income': '+{x} altın/sn',
    'tip.supply': '+{x} nüfus',
    'tip.onGold': 'Altın madenine kurulur',
    'tip.tower': 'Yakındaki düşmanlara ok atar',
    'tip.research': 'Geliştirme puanı üretir',
    'tip.trainTime': '{x} — {t}sn',

    // Hint bar (controls)
    'hint.controls':
      'Sol tık / sürükle: <b>seç</b> · Sağ tık: <b>yürüt / saldır</b> · <b>A</b>: saldırı emri · WASD / orta tuş: <b>kamera</b> · Tekerlek: <b>zoom</b>',
    'hint.place': '{icon} {label} — yerleştirmek için tıkla (ESC iptal)',
    'hint.placeGold': '{icon} {label} — altın madeni üzerine tıkla (ESC iptal)',
    'hint.attackMove': '🎯 Saldırı emri — hedef noktayı tıkla (ESC iptal)',

    // Banners
    'banner.matchup': '{emblem} {civ} — {bonusName}: {bonusDesc} · Rakip: {foe}',
    'banner.campOwn': '🗿 Kamp temizlendi! +150 altın, kalıcı +%10 hasar',
    'banner.campEnemy': '⚠️ Düşman kampı temizledi ve güçlendi!',
    'banner.passageOpen': '🪨 Geçit açıldı!',
    'banner.opponentLeft': '🏳️ Rakip oyundan ayrıldı — zafer senin!',
    'banner.opponentDc': '⚠️ Rakibin bağlantısı koptu — {sec}sn bekleniyor…',

    // Game over
    'go.victory': '🏆 Zafer!',
    'go.defeat': '💀 Yenilgi',
    'go.connLost': '🔌 Bağlantı Koptu',
    'go.restart': 'Tekrar Oyna',
  },
  en: {
    // Menu
    'menu.sub': 'Build · Command · Conquer',
    'menu.chooseCiv': 'CHOOSE YOUR CIVILIZATION',
    'menu.campaign': 'CAMPAIGN · Single Player',
    'menu.difficulty': 'DIFFICULTY',
    'diff.easy': 'Easy',
    'diff.normal': 'Normal',
    'diff.hard': 'Hard',
    'menu.start': 'START BATTLE',
    'menu.front': 'FRONTLINE · Multiplayer 1v1',
    'menu.createRoom': '+ Create Room',
    'menu.openRooms': 'Open Rooms',
    'menu.refresh': 'Refresh',
    'menu.noRooms': 'No open rooms — be the first to create one.',
    'menu.waiting': 'waiting',
    'menu.join': 'Join',
    'menu.online': '{n} online',
    'menu.offline': 'offline',
    'menu.connecting': 'Connecting to server…',
    'menu.connectFail': '❌ Couldn’t reach the server — try again.',
    'menu.roomWaiting': 'Room created — waiting for an opponent…',
    'menu.cancel': 'Cancel',
    'menu.joining': 'Joining…',
    'menu.joinFail': '❌ Could not join',
    'menu.vs': 'vs you',
    'menu.music': 'Music',
    'menu.langName': 'English',

    // HUD
    'hud.noSelection': 'No units selected',
    'hud.selected': 'Selected: {x}',
    'hud.selectedBuilding': 'Selected: {x}',
    'grp.economy': 'ECONOMY',
    'grp.military': 'MILITARY',
    'grp.defense': 'DEFENSE',
    'hud.constructing': 'Under construction…',
    'hud.rallyHint': 'Right click: set rally point',
    'hud.research': 'Research',
    'hud.researching': 'Researching',
    'hud.researchingHint': 'Research in progress…',
    'hud.researchBuyHint': 'Buy a research point with gold (price rises each time)',
    'hud.income': '+{x}/s',
    'hud.fps': '{x} fps',
    'tip.trains': 'Trains: {x}',
    'tip.income': '+{x} gold/s',
    'tip.supply': '+{x} population',
    'tip.onGold': 'Built on a gold mine',
    'tip.tower': 'Fires arrows at nearby enemies',
    'tip.research': 'Generates research points',
    'tip.trainTime': '{x} — {t}s',

    // Hint bar (controls)
    'hint.controls':
      'Left click / drag: <b>select</b> · Right click: <b>move / attack</b> · <b>A</b>: attack-move · WASD / middle mouse: <b>camera</b> · Wheel: <b>zoom</b>',
    'hint.place': '{icon} {label} — click to place (ESC to cancel)',
    'hint.placeGold': '{icon} {label} — click on a gold mine (ESC to cancel)',
    'hint.attackMove': '🎯 Attack-move — click the target point (ESC to cancel)',

    // Banners
    'banner.matchup': '{emblem} {civ} — {bonusName}: {bonusDesc} · Opponent: {foe}',
    'banner.campOwn': '🗿 Camp cleared! +150 gold, permanent +10% damage',
    'banner.campEnemy': '⚠️ The enemy cleared a camp and grew stronger!',
    'banner.passageOpen': '🪨 Passage opened!',
    'banner.opponentLeft': '🏳️ Opponent left the game — victory is yours!',
    'banner.opponentDc': '⚠️ Opponent disconnected — waiting {sec}s…',

    // Game over
    'go.victory': '🏆 Victory!',
    'go.defeat': '💀 Defeat',
    'go.connLost': '🔌 Connection Lost',
    'go.restart': 'Play Again',
  },
};

// --- Entity label tables (kept here so the data files stay single-language) ---

const CIV_I18N: Record<CivId, Record<Lang, { label: string; bonusName: string; bonusDesc: string }>> = {
  celt: {
    tr: { label: 'Kelt', bonusName: 'Orman Halkı', bonusDesc: 'Birimler ormanda yavaşlamaz — pusu ustaları.' },
    en: { label: 'Celt', bonusName: 'Forest Folk', bonusDesc: 'Units never slow in forests — masters of ambush.' },
  },
  ottoman: {
    tr: { label: 'Osmanlı', bonusName: 'Devşirme Ocağı', bonusDesc: 'Birim eğitimi %20 daha hızlı.' },
    en: { label: 'Ottoman', bonusName: 'Devshirme Corps', bonusDesc: 'Unit training is 20% faster.' },
  },
  china: {
    tr: { label: 'Çin', bonusName: 'Hanedan Bilgeliği', bonusDesc: 'Evler +4 nüfus, araştırma %20 daha ucuz.' },
    en: { label: 'China', bonusName: 'Dynastic Wisdom', bonusDesc: 'Houses give +4 population, research 20% cheaper.' },
  },
  rome: {
    tr: { label: 'Roma', bonusName: 'Lejyon Disiplini', bonusDesc: 'Tüm birimler +%10 dayanıklılık (HP).' },
    en: { label: 'Rome', bonusName: 'Legion Discipline', bonusDesc: 'All units gain +10% durability (HP).' },
  },
  viking: {
    tr: { label: 'Viking', bonusName: 'Yağma', bonusDesc: 'Düşman öldürme ganimeti iki kat.' },
    en: { label: 'Viking', bonusName: 'Plunder', bonusDesc: 'Double bounty for killing enemy units.' },
  },
};

const UNIT_I18N: Record<UnitKind, Record<Lang, string>> = {
  knight: { tr: 'Şövalye', en: 'Knight' },
  spear: { tr: 'Mızrakçı', en: 'Spearman' },
  archer: { tr: 'Okçu', en: 'Archer' },
  cavalry: { tr: 'Süvari', en: 'Cavalry' },
  mage: { tr: 'Büyücü', en: 'Mage' },
  catapult: { tr: 'Mancınık', en: 'Catapult' },
  golem: { tr: 'Golem', en: 'Golem' },
  wolf: { tr: 'Kurt', en: 'Wolf' },
};

const BUILDING_I18N: Record<BuildingKind, Record<Lang, string>> = {
  castle: { tr: 'Kale', en: 'Castle' },
  house: { tr: 'Ev', en: 'House' },
  mine: { tr: 'Maden', en: 'Mine' },
  barracks: { tr: 'Kışla', en: 'Barracks' },
  archery: { tr: 'Atış Alanı', en: 'Archery Range' },
  stable: { tr: 'Ahır', en: 'Stable' },
  magetower: { tr: 'Büyücü Kulesi', en: 'Mage Tower' },
  siegeworks: { tr: 'Kuşatma', en: 'Siege Works' },
  research: { tr: 'Araştırma', en: 'Research' },
  tower: { tr: 'Kule', en: 'Tower' },
  wall: { tr: 'Duvar', en: 'Wall' },
};

const UPGRADE_I18N: Record<string, Record<Lang, { name: string; desc: string }>> = {
  damage1: { tr: { name: 'Keskin Kılıçlar', desc: 'Tüm birimler +15% hasar' }, en: { name: 'Sharpened Blades', desc: 'All units +15% damage' } },
  damage2: { tr: { name: 'Ağır Darbeler', desc: 'Tüm birimler +25% hasar' }, en: { name: 'Heavy Strikes', desc: 'All units +25% damage' } },
  health1: { tr: { name: 'Kalın Zırh', desc: 'Yeni birimler +20% HP' }, en: { name: 'Thick Armor', desc: 'New units +20% HP' } },
  health2: { tr: { name: 'Demir İrade', desc: 'Yeni birimler +35% HP' }, en: { name: 'Iron Will', desc: 'New units +35% HP' } },
  speed1: { tr: { name: 'Hızlı Adımlar', desc: 'Birimler %15 hızlı yürür' }, en: { name: 'Swift Steps', desc: 'Units move 15% faster' } },
  atkspeed1: { tr: { name: 'Savaş Öfkesi', desc: 'Birimler %20 hızlı saldırır' }, en: { name: 'Battle Fury', desc: 'Units attack 20% faster' } },
  income1: { tr: { name: 'Verimli Madencilik', desc: '+%25 altın geliri' }, en: { name: 'Efficient Mining', desc: '+25% gold income' } },
  income2: { tr: { name: 'Altına Hücum', desc: '+%45 altın geliri' }, en: { name: 'Gold Rush', desc: '+45% gold income' } },
};

// --- State ---

function detect(): Lang {
  try {
    const saved = localStorage.getItem('aob-lang');
    if (saved === 'tr' || saved === 'en') return saved;
  } catch { /* localStorage may be unavailable */ }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let current: Lang = detect();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try { localStorage.setItem('aob-lang', l); } catch { /* ignore */ }
  for (const fn of listeners) fn();
}

/** Subscribe to language changes (e.g. to re-render the menu). */
export function onLangChange(fn: () => void): void {
  listeners.add(fn);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = UI[current][key] ?? UI.tr[key] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

export function civLabel(id: CivId): string {
  return CIV_I18N[id][current].label;
}
export function civBonus(id: CivId): { name: string; desc: string } {
  const c = CIV_I18N[id][current];
  return { name: c.bonusName, desc: c.bonusDesc };
}
export function unitLabel(kind: UnitKind): string {
  return UNIT_I18N[kind][current];
}
export function buildingLabel(kind: BuildingKind): string {
  return BUILDING_I18N[kind][current];
}
export function upgradeText(id: string): { name: string; desc: string } {
  return UPGRADE_I18N[id]?.[current] ?? { name: id, desc: '' };
}
