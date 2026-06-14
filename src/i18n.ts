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
    'menu.single': 'Tek Oyuncu',
    'menu.singleDesc': 'Yapay zekâya karşı sefer',
    'menu.multi': 'Çok Oyuncu',
    'menu.multiDesc': 'Çevrimiçi 1v1 cephe',
    'menu.back': '← Geri',
    'menu.createTitle': 'Oda Kur',
    'menu.roomName': 'Oda Adı',
    'menu.roomNamePh': 'Oda adı gir',
    'menu.password': 'Şifre (boş bırak = herkese açık)',
    'menu.passwordPh': 'Şifre (opsiyonel)',
    'menu.createConfirm': 'Odayı Kur',
    'menu.joinTitle': 'Odaya Katıl',
    'menu.host': 'Kuran',
    'menu.locked': 'Şifreli',
    'err.not_found': 'Oda bulunamadı veya kapandı',
    'err.full': 'Oda dolu veya oyun başladı',
    'err.bad_password': 'Yanlış şifre',
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
    'hint.controls': '',
    'hint.place': '{icon} {label} — yerleştirmek için tıkla (ESC iptal)',
    'hint.placeGold': '{icon} {label} — altın madeni üzerine tıkla (ESC iptal)',
    'hint.attackMove': '🎯 Saldırı emri — hedef noktayı tıkla (ESC iptal)',

    // Pause modal
    'pause.title': 'Oyun Duraklatıldı',
    'pause.resume': 'Devam Et',
    'pause.restart': 'Yeniden Başlat',
    'pause.music': 'Müzik',
    'pause.sfx': 'Ses Efektleri',
    'pause.exit': 'Ana Menüye Dön',

    // Unit descriptions
    'desc.knight': 'Ağır zırhlı yakın dövüş birimi. Okçulara karşı etkilidir.',
    'desc.spear': 'Uzak menzilli dürtüşe sahip mızraklı birim. Süvarilere karşı yüksek hasar verir.',
    'desc.archer': 'Menzilli okçu birimi. Yavaş hareket eder ancak uzaktan vurur.',
    'desc.cavalry': 'Hızlı hareket eden süvari birimi. Okçuları avlamak için idealdir.',
    'desc.villager': 'İnşa yapan ve kaynak toplayan işçi sınıfı.',
    'desc.commander': 'Medeniyete özgü güçlü komutan. Orduyu yönetir.',
    'desc.catapult': 'Uzun menzilli kuşatma silahı. Binaları yıkmakta etkilidir.',
    'desc.golem': 'Kalenin kadim koruyucusu. Çok yüksek can ve zırh.',
    'desc.wolf': 'Vahşi kurt sürüsü.',
    'desc.pirate': 'Tarafsız kaleyi koruyan tehlikeli haydutlar.',
    'desc.gladiator': 'Gladyatör. Seçkin ağır piyade. Olağanüstü can miktarı ve yakın dövüş gücüne sahiptir.',
    'desc.janissary': 'Yeniçeri. Uzun menzilli ve yüksek hasarlı seçkin Osmanlı yeniçerisi.',
    'desc.berserker': 'Berserker. Çılgın savaşçı. Hızlı yürür ve vuruşları yakınındaki tüm rakiplere alan hasarı verir.',
    'desc.druid': 'Druid. Kelt bilgesi. Savaş alanında kendi canını yeniler ve rakipleri büyüyle uzaktan yıpratır.',

    'hud.multiSummary': '{n} Birim Seçildi',

    // Banners
    'banner.matchup': '{emblem} {civ} — {bonusName}: {bonusDesc} · Rakip: {foe}',
    'banner.campOwn': '🗿 Kamp temizlendi! +150 altın, kalıcı +%10 hasar',
    'banner.campEnemy': '⚠️ Düşman kampı temizledi ve güçlendi!',
    'banner.passageOpen': '🪨 Geçit açıldı!',
    'banner.opponentLeft': '🏳️ Rakip oyundan ayrıldı — zafer senin!',
    'banner.opponentDc': '⚠️ Rakibin bağlantısı koptu — {sec}sn bekleniyor…',
    'err.needVillagerSelected': 'İnşa yapmak için bir köylü seçmelisiniz!',
    'banner.commOwn': '👑 Özel komutanınız {name} savaşa katıldı!',
    'banner.commEnemy': '⚠️ Düşman özel komutanı {name} savaşa katıldı!',
    'comm.celt': 'Kraliçe Boadicea',
    'comm.ottoman': 'Fatih Sultan Mehmet',
    'comm.china': 'General Guan Yu',
    'comm.rome': 'Jül Sezar',
    'comm.viking': 'Ragnar Lodbrok',
    'civ.celt': 'Kelt',
    'civ.ottoman': 'Osmanlı',
    'civ.china': 'Çin',
    'civ.rome': 'Roma',
    'civ.viking': 'Viking',

    // Game over
    'go.victory': '🏆 Zafer!',
    'go.defeat': '💀 Yenilgi',
    'go.connLost': '🔌 Bağlantı Koptu',
    'go.restart': 'Tekrar Oyna',
  },
  en: {
    // Menu
    'menu.sub': 'Build · Command · Conquer',
    'menu.single': 'Single Player',
    'menu.singleDesc': 'Campaign vs the AI',
    'menu.multi': 'Multiplayer',
    'menu.multiDesc': 'Online 1v1 frontline',
    'menu.back': '← Back',
    'menu.createTitle': 'Create Room',
    'menu.roomName': 'Room Name',
    'menu.roomNamePh': 'Enter a room name',
    'menu.password': 'Password (empty = public)',
    'menu.passwordPh': 'Password (optional)',
    'menu.createConfirm': 'Create Room',
    'menu.joinTitle': 'Join Room',
    'menu.host': 'Host',
    'menu.locked': 'Locked',
    'err.not_found': 'Room not found or closed',
    'err.full': 'Room is full or already started',
    'err.bad_password': 'Wrong password',
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
    'hint.controls': '',
    'hint.place': '{icon} {label} — click to place (ESC to cancel)',
    'hint.placeGold': '{icon} {label} — click on a gold mine (ESC to cancel)',
    'hint.attackMove': '🎯 Attack-move — click the target point (ESC to cancel)',

    // Pause modal
    'pause.title': 'Game Paused',
    'pause.resume': 'Resume',
    'pause.restart': 'Restart',
    'pause.music': 'Music',
    'pause.sfx': 'SFX',
    'pause.exit': 'Exit to Menu',

    // Unit descriptions
    'desc.knight': 'Heavy armored melee unit. Strong against archers.',
    'desc.spear': 'Spearman with extended reach. Deals massive damage to cavalry.',
    'desc.archer': 'Ranged archer unit. Slow but attacks from distance.',
    'desc.cavalry': 'Fast-moving cavalry unit. Perfect for hunting archers.',
    'desc.villager': 'Worker class that constructs buildings and gathers gold.',
    'desc.commander': 'Powerful civilization-specific leader with unique buffs.',
    'desc.catapult': 'Long-range siege engine. Extremely effective against buildings.',
    'desc.golem': 'Ancient defender of the keep. Very high health and armor.',
    'desc.wolf': 'Wild woodland wolf.',
    'desc.pirate': 'Roguish bandits guarding the central fortress.',
    'desc.gladiator': 'Gladiator. Elite heavy infantry. Possesses exceptional health and melee power.',
    'desc.janissary': 'Janissary. Elite Ottoman ranged unit with high damage.',
    'desc.berserker': 'Berserker. Frenzied warrior. Moves fast and attacks deal splash damage to nearby enemies.',
    'desc.druid': 'Druid. Celtic sage. Regenerates health and damages enemies from afar using magic.',

    'hud.multiSummary': '{n} Units Selected',

    // Banners
    'banner.matchup': '{emblem} {civ} — {bonusName}: {bonusDesc} · Opponent: {foe}',
    'banner.campOwn': '🗿 Camp cleared! +150 gold, permanent +10% damage',
    'banner.campEnemy': '⚠️ The enemy cleared a camp and grew stronger!',
    'banner.passageOpen': '🪨 Passage opened!',
    'banner.opponentLeft': '🏳️ Opponent left the game — victory is yours!',
    'banner.opponentDc': '⚠️ Opponent disconnected — waiting {sec}s…',
    'err.needVillagerSelected': 'You must select a villager to build!',
    'banner.commOwn': '👑 Your special commander {name} has joined the fight!',
    'banner.commEnemy': '⚠️ The enemy special commander {name} has joined the fight!',
    'comm.celt': 'Queen Boadicea',
    'comm.ottoman': 'Mehmed the Conqueror',
    'comm.china': 'General Guan Yu',
    'comm.rome': 'Julius Caesar',
    'comm.viking': 'Ragnar Lothbrok',
    'civ.celt': 'Celt',
    'civ.ottoman': 'Ottoman',
    'civ.china': 'China',
    'civ.rome': 'Rome',
    'civ.viking': 'Viking',

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
  villager: { tr: 'Köylü', en: 'Villager' },
  commander: { tr: 'Komutan', en: 'Commander' },
  catapult: { tr: 'Mancınık', en: 'Catapult' },
  golem: { tr: 'Golem', en: 'Golem' },
  wolf: { tr: 'Kurt', en: 'Wolf' },
  pirate: { tr: 'Korsan', en: 'Pirate' },
  gladiator: { tr: 'Gladyatör', en: 'Gladiator' },
  janissary: { tr: 'Yeniçeri', en: 'Janissary' },
  berserker: { tr: 'Berserker', en: 'Berserker' },
  druid: { tr: 'Druid', en: 'Druid' },
};

const BUILDING_I18N: Record<BuildingKind, Record<Lang, string>> = {
  castle: { tr: 'Kale', en: 'Castle' },
  house: { tr: 'Ev', en: 'House' },
  mine: { tr: 'Maden', en: 'Mine' },
  barracks: { tr: 'Kışla', en: 'Barracks' },
  archery: { tr: 'Atış Alanı', en: 'Archery Range' },
  stable: { tr: 'Ahır', en: 'Stable' },
  siegeworks: { tr: 'Kuşatma', en: 'Siege Works' },
  research: { tr: 'Araştırma', en: 'Research' },
  tower: { tr: 'Kule', en: 'Tower' },
  wall: { tr: 'Duvar', en: 'Wall' },
  colosseum: { tr: 'Kolezyum', en: 'Colosseum' },
  forum: { tr: 'Roma Forumu', en: 'Roman Forum' },
  mosque: { tr: 'Mehmed Camii', en: 'Mehmed Mosque' },
  caravanserai: { tr: 'Kervansaray', en: 'Caravanserai' },
  pagoda: { tr: 'Pagoda Tapınağı', en: 'Pagoda Temple' },
  bastion: { tr: 'Çin Seddi Tabyası', en: 'Great Wall Bastion' },
  longhouse: { tr: 'Viking Büyük Salonu', en: 'Viking Longhouse' },
  shrine: { tr: 'Odin Tapınağı', en: 'Odin Shrine' },
  grove: { tr: 'Kutsal Koruluk', en: 'Sacred Grove' },
  stone_circle: { tr: 'Megolitik Taşlar', en: 'Stone Circle' },
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
export function unitDesc(kind: UnitKind): string {
  return t(`desc.${kind}`);
}
export function buildingLabel(kind: BuildingKind): string {
  return BUILDING_I18N[kind][current];
}
export function upgradeText(id: string): { name: string; desc: string } {
  return UPGRADE_I18N[id]?.[current] ?? { name: id, desc: '' };
}
