// Shared per-civilization art palette + small primitives used by BOTH the
// building renderer and the unit "civ kit". One source of truth so a Roman
// army and a Roman town read with the same materials/colours.

import type { CivId } from '../data/civs';

export type WallStyle = 'stone' | 'timber' | 'plaster';
export type RoofStyle = 'thatch' | 'dome' | 'pagoda' | 'pediment' | 'gable';

export interface CivPalette {
  wall: string;
  wallDark: string;
  wallStyle: WallStyle;
  roof: string;
  roofDark: string;
  roofStyle: RoofStyle;
  trim: string; // gold/decor accent
  // Unit kit
  cloth: string; // tunic / robe
  clothDark: string;
  metal: string; // armour / helmet
  metalDark: string;
  leather: string;
}

const GOLD = '#e8c54a';
const STEEL = '#cfd6e2';
const STEEL_DK = '#8a96aa';

export const CIV_PAL: Record<CivId, CivPalette> = {
  celt: {
    wall: '#6f5a3e', wallDark: '#4a3a26', wallStyle: 'timber',
    roof: '#b6a05a', roofDark: '#8a763a', roofStyle: 'thatch', trim: '#3e7a46',
    cloth: '#3e7a46', clothDark: '#285230', metal: '#b9c2cc', metalDark: '#7d8893', leather: '#6e4a26',
  },
  ottoman: {
    wall: '#dccba0', wallDark: '#b3a070', wallStyle: 'plaster',
    roof: '#cf4636', roofDark: '#9c2f24', roofStyle: 'dome', trim: GOLD,
    cloth: '#b01e28', clothDark: '#7e161e', metal: STEEL, metalDark: STEEL_DK, leather: '#7d5a2c',
  },
  china: {
    wall: '#caa36a', wallDark: '#9c7b48', wallStyle: 'timber',
    roof: '#9c1f1f', roofDark: '#6e1414', roofStyle: 'pagoda', trim: GOLD,
    cloth: '#2a8d77', clothDark: '#1d6354', metal: '#3b4a5c', metalDark: '#26313d', leather: '#8a5d33',
  },
  rome: {
    wall: '#ddd6c6', wallDark: '#b3ac98', wallStyle: 'stone',
    roof: '#b8543a', roofDark: '#8a3c28', roofStyle: 'pediment', trim: GOLD,
    cloth: '#a8242e', clothDark: '#7e1a22', metal: STEEL, metalDark: STEEL_DK, leather: '#9b6a3a',
  },
  viking: {
    wall: '#5e4a32', wallDark: '#3f3120', wallStyle: 'timber',
    roof: '#445246', roofDark: '#2c3830', roofStyle: 'gable', trim: '#c9b27a',
    cloth: '#3a4250', clothDark: '#262d38', metal: '#8b95a4', metalDark: '#5d6675', leather: '#6b5640',
  },
};

export const SKIN = '#e8b88a';
export { GOLD, STEEL, STEEL_DK };
