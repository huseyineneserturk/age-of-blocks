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

  // --- River (vertical band in the middle) ---
  for (let y = 0; y < H; y++) {
    for (let x = 30; x <= 33; x++) map.set(x, y, Terrain.Water);
  }
  // Slight banks wobble for a natural look
  for (let y = 0; y < H; y++) {
    const wob = Math.sin(y * 0.7) > 0.55 ? 1 : 0;
    if (wob) {
      map.set(29, y, Terrain.Water);
      map.set(34, y, Terrain.Water);
    }
  }

  // --- Bridges (three chokepoints) ---
  const bridgeRows = [
    [6, 8],
    [19, 21],
    [32, 34],
  ];
  for (const [y0, y1] of bridgeRows) {
    for (let y = y0; y <= y1; y++) {
      for (let x = 28; x <= 35; x++) map.set(x, y, Terrain.Bridge);
    }
  }

  // --- Forests (ambush pockets near mid) ---
  mirrorBlob(22, 13, 4, 3, Terrain.Forest);
  mirrorBlob(24, 28, 3.5, 3, Terrain.Forest);
  mirrorBlob(14, 33, 4, 2.5, Terrain.Forest);
  mirrorBlob(12, 5, 3.5, 2.5, Terrain.Forest);

  // --- Hills (overlook the bridges) ---
  mirrorBlob(26, 4, 2.5, 2, Terrain.Hill);
  mirrorBlob(26, 24, 2.5, 2, Terrain.Hill);
  mirrorBlob(25, 37, 2.5, 1.8, Terrain.Hill);

  // --- Rock clusters (lane shaping) ---
  mirrorBlob(18, 17, 2, 1.5, Terrain.Rock);
  mirrorBlob(20, 23, 1.5, 1.2, Terrain.Rock);
  mirrorBlob(8, 26, 2, 1.5, Terrain.Rock);

  // --- Gold nodes (2 per base + 1 contested per side near center) ---
  const goldSpots: Array<[number, number]> = [
    [6, 10],
    [6, 30],
    [27, 19], // contested, by the middle bridge
  ];
  for (const [gx, gy] of goldSpots) {
    mirror(gx, gy, Terrain.Gold);
    mirror(gx + 1, gy, Terrain.Gold);
    goldNodes.push({ x: gx, y: gy }, { x: W - 1 - gx - 1, y: gy });
  }

  // --- Base areas: keep clear grass so castles/buildings fit ---
  map.fillRect(1, 16, 7, 24, Terrain.Grass);
  map.fillRect(W - 8, 16, W - 2, 24, Terrain.Grass);

  return {
    map,
    name: 'River Crossing',
    playerStart: { x: 4, y: 20 },
    enemyStart: { x: W - 5, y: 20 },
    goldNodes,
    neutralCamp: { x: 32, y: 20 },
  };
}
