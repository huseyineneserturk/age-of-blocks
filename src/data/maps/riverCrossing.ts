// "River Crossing" — first symmetric map. A vertical river with three bridges
// splits the map; forests for ambushes, hills near the bridges, gold nodes
// for expansion, rock clusters shaping the lanes.

import { TileMap, Terrain } from '../../engine/grid';

export interface GameMap {
  map: TileMap;
  name: string;
  playerStart: { x: number; y: number };
  enemyStart: { x: number; y: number };
  goldNodes: Array<{ x: number; y: number }>;
  neutralCamp: { x: number; y: number };
  /** Destructible rocks (placed as entities by the game, not terrain). */
  crackedRocks: Array<{ x: number; y: number }>;
}

export function buildRiverCrossing(): GameMap {
  const W = 64;
  const H = 40;
  const map = new TileMap(W, H);
  const goldNodes: Array<{ x: number; y: number }> = [];

  // Mirror helper: applies terrain on the left half and mirrors to the right.
  const mirror = (x: number, y: number, t: Terrain): void => {
    map.set(x, y, t);
    map.set(W - 1 - x, y, t);
  };
  const mirrorBlob = (cx: number, cy: number, rx: number, ry: number, t: Terrain): void => {
    map.fillBlob(cx, cy, rx, ry, t);
    map.fillBlob(W - 1 - cx, cy, rx, ry, t);
  };

  // --- River with Middle Island ---
  // The vertical river splits around a central island (x = 26..37) between y = 13..26
  for (let y = 0; y < H; y++) {
    if (y < 13 || y > 26) {
      // Single main river channel
      for (let x = 30; x <= 33; x++) map.set(x, y, Terrain.Water);
    } else {
      // Left channel
      for (let x = 23; x <= 25; x++) map.set(x, y, Terrain.Water);
      // Right channel
      for (let x = 38; x <= 40; x++) map.set(x, y, Terrain.Water);
      // Island grass in the middle
      for (let x = 26; x <= 37; x++) map.set(x, y, Terrain.Grass);
    }
  }

  // Smooth river connections at transition zones (y = 12 and y = 27)
  for (let x = 25; x <= 30; x++) {
    map.set(x, 12, Terrain.Water);
    map.set(x, 27, Terrain.Water);
  }
  for (let x = 33; x <= 38; x++) {
    map.set(x, 12, Terrain.Water);
    map.set(x, 27, Terrain.Water);
  }

  // --- Bridges (only top and bottom) ---
  const bridgeRows = [
    [6, 8],
    [32, 34],
  ];
  for (const [y0, y1] of bridgeRows) {
    for (let y = y0; y <= y1; y++) {
      for (let x = 28; x <= 35; x++) map.set(x, y, Terrain.Bridge);
    }
  }

  // --- Middle Island bridges (connect left/right banks to the island) ---
  for (let y = 19; y <= 21; y++) {
    // Left bridge
    for (let x = 23; x <= 26; x++) map.set(x, y, Terrain.Bridge);
    // Right bridge
    for (let x = 37; x <= 40; x++) map.set(x, y, Terrain.Bridge);
  }

  // --- Organic Forests (realistic patches for tactical hiding) ---
  mirrorBlob(8, 6, 4, 3, Terrain.Forest);
  mirrorBlob(10, 13, 5, 4, Terrain.Forest);
  mirrorBlob(9, 31, 5, 4, Terrain.Forest);
  mirrorBlob(22, 11, 3.5, 3.5, Terrain.Forest);
  mirrorBlob(21, 28, 3.5, 3.5, Terrain.Forest);
  mirrorBlob(15, 35, 4, 3, Terrain.Forest);

  // --- High-elevation Hills (tactical overlook points) ---
  mirrorBlob(26, 5, 3, 2.5, Terrain.Hill);
  mirrorBlob(26, 35, 3, 2.5, Terrain.Hill);
  mirrorBlob(15, 20, 3.5, 3, Terrain.Hill);
  mirrorBlob(6, 12, 2.5, 2.5, Terrain.Hill);
  mirrorBlob(6, 28, 2.5, 2.5, Terrain.Hill);

  // --- Stone deposits & natural rock formations ---
  mirrorBlob(18, 8, 2.5, 1.8, Terrain.Rock);
  mirrorBlob(19, 32, 2.5, 1.8, Terrain.Rock);
  mirrorBlob(16, 16, 2, 2, Terrain.Rock);
  mirrorBlob(16, 24, 2, 2, Terrain.Rock);

  // --- Gold nodes (2 per base + 1 contested per side near center) ---
  const goldSpots: Array<[number, number]> = [
    [6, 10],
    [6, 30],
    [26, 19], // contested near the island bridge
  ];
  for (const [gx, gy] of goldSpots) {
    mirror(gx, gy, Terrain.Gold);
    mirror(gx + 1, gy, Terrain.Gold);
    goldNodes.push({ x: gx, y: gy }, { x: W - 1 - gx - 1, y: gy });
  }

  // --- Base areas: keep clear grass so castles/buildings fit ---
  map.fillRect(1, 16, 7, 24, Terrain.Grass);
  map.fillRect(W - 8, 16, W - 2, 24, Terrain.Grass);

  // Cracked rocks seal the TOP and BOTTOM bridges — catapults can open these flanks.
  const crackedRocks: Array<{ x: number; y: number }> = [];
  // Top bridge (rows 6-8)
  for (let y = 6; y <= 8; y++) {
    crackedRocks.push({ x: 31, y }, { x: 32, y });
  }
  // Bottom bridge (rows 32-34)
  for (let y = 32; y <= 34; y++) {
    crackedRocks.push({ x: 31, y }, { x: 32, y });
  }

  return {
    map,
    name: 'River Crossing',
    playerStart: { x: 4, y: 20 },
    enemyStart: { x: W - 5, y: 20 },
    goldNodes,
    neutralCamp: { x: 32, y: 20 },
    crackedRocks,
  };
}
