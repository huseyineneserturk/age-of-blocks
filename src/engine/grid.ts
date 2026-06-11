// Tile map + terrain definitions. All gameplay-relevant terrain effects
// (passability, speed) live here; visual styling lives in render/.

export enum Terrain {
  Grass = 0,
  Forest = 1,
  Hill = 2,
  Water = 3,
  Bridge = 4,
  Rock = 5,
  Gold = 6,
}

export interface TerrainProps {
  passable: boolean;
  speed: number; // movement speed multiplier
  cost: number; // pathfinding cost multiplier
}

export const TERRAIN: Record<Terrain, TerrainProps> = {
  [Terrain.Grass]: { passable: true, speed: 1.0, cost: 1.0 },
  [Terrain.Forest]: { passable: true, speed: 0.6, cost: 1.7 },
  [Terrain.Hill]: { passable: true, speed: 0.85, cost: 1.2 },
  [Terrain.Water]: { passable: false, speed: 0, cost: Infinity },
  [Terrain.Bridge]: { passable: true, speed: 1.0, cost: 1.0 },
  [Terrain.Rock]: { passable: false, speed: 0, cost: Infinity },
  [Terrain.Gold]: { passable: false, speed: 0, cost: Infinity },
};

export class TileMap {
  readonly tiles: Uint8Array;
  /** Dynamic obstacles (buildings). 1 = blocked. */
  readonly blocked: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.tiles = new Uint8Array(w * h).fill(Terrain.Grass);
    this.blocked = new Uint8Array(w * h);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Terrain {
    return this.tiles[y * this.w + x] as Terrain;
  }

  set(x: number, y: number, t: Terrain): void {
    if (this.inBounds(x, y)) this.tiles[y * this.w + x] = t;
  }

  setBlocked(x: number, y: number, v: boolean): void {
    if (this.inBounds(x, y)) this.blocked[y * this.w + x] = v ? 1 : 0;
  }

  isBlocked(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.blocked[y * this.w + x] === 1;
  }

  passable(x: number, y: number): boolean {
    return (
      this.inBounds(x, y) &&
      TERRAIN[this.get(x, y)].passable &&
      this.blocked[y * this.w + x] === 0
    );
  }

  /** Speed multiplier at a world position (tile units, float). */
  speedAt(wx: number, wy: number): number {
    const x = Math.floor(wx);
    const y = Math.floor(wy);
    if (!this.inBounds(x, y)) return 1;
    return TERRAIN[this.get(x, y)].speed;
  }

  costAt(x: number, y: number): number {
    return TERRAIN[this.get(x, y)].cost;
  }

  fillRect(x0: number, y0: number, x1: number, y1: number, t: Terrain): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) this.set(x, y, t);
    }
  }

  /** Fill a rough blob (ellipse) of terrain — used by map builders. */
  fillBlob(cx: number, cy: number, rx: number, ry: number, t: Terrain): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, t);
      }
    }
  }

  /** Nearest passable tile to (tx, ty), searching outward. Null if none nearby. */
  nearestPassable(tx: number, ty: number, maxR = 10): { x: number; y: number } | null {
    tx = Math.max(0, Math.min(this.w - 1, Math.round(tx)));
    ty = Math.max(0, Math.min(this.h - 1, Math.round(ty)));
    if (this.passable(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (this.passable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }
}
