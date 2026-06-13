// Civilizations: identity, visual accents and ONE distinctive gameplay bonus
// each. Team colors (blue/red) stay primary for readability; the civilization
// shows through headgear, shields, trim and architecture.

export type CivId = 'celt' | 'ottoman' | 'china' | 'rome' | 'viking';

export interface CivDef {
  id: CivId;
  label: string;
  emblem: string; // small text emblem for UI
  /** Accent used for trims, crests, shield faces. */
  accent: string;
  accentDark: string;
  bonusName: string;
  bonusDesc: string;
  // --- gameplay bonus knobs (1 = no change) ---
  forestFullSpeed?: boolean; // celt
  trainTimeMul?: number; // ottoman
  houseSupplyBonus?: number; // china
  researchCostMul?: number; // china
  unitHpMul?: number; // rome
  bountyMul?: number; // viking
}

export const CIVS: Record<CivId, CivDef> = {
  celt: {
    id: 'celt',
    label: 'Kelt',
    emblem: '🌀',
    accent: '#3e7a46',
    accentDark: '#2a5530',
    bonusName: 'Orman Halkı',
    bonusDesc: 'Birimler ormanda yavaşlamaz — pusu ustaları.',
    forestFullSpeed: true,
  },
  ottoman: {
    id: 'ottoman',
    label: 'Osmanlı',
    emblem: '☪',
    accent: '#b01e28',
    accentDark: '#7e161e',
    bonusName: 'Devşirme Ocağı',
    bonusDesc: 'Birim eğitimi %20 daha hızlı.',
    trainTimeMul: 0.8,
  },
  china: {
    id: 'china',
    label: 'Çin',
    emblem: '龍',
    accent: '#2a8d77',
    accentDark: '#1d6354',
    bonusName: 'Hanedan Bilgeliği',
    bonusDesc: 'Evler +4 nüfus, araştırma %20 daha ucuz.',
    houseSupplyBonus: 4,
    researchCostMul: 0.8,
  },
  rome: {
    id: 'rome',
    label: 'Roma',
    emblem: '🦅',
    accent: '#8f1d26',
    accentDark: '#641219',
    bonusName: 'Lejyon Disiplini',
    bonusDesc: 'Tüm birimler +%10 dayanıklılık (HP).',
    unitHpMul: 1.1,
  },
  viking: {
    id: 'viking',
    label: 'Viking',
    emblem: '🪓',
    accent: '#23303f',
    accentDark: '#161e28',
    bonusName: 'Yağma',
    bonusDesc: 'Düşman öldürme ganimeti iki kat.',
    bountyMul: 2,
  },
};

export const CIV_LIST: CivId[] = ['celt', 'ottoman', 'china', 'rome', 'viking'];

export function randomCiv(except?: CivId): CivId {
  const pool = CIV_LIST.filter((c) => c !== except);
  return pool[Math.floor(Math.random() * pool.length)];
}
