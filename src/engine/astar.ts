// A* pathfinding on the tile grid. 8-directional, corner cutting forbidden,
// terrain cost aware. Returns waypoints at tile centers, smoothed with
// line-of-sight shortcuts so units walk natural diagonals.

import { TileMap } from './grid';

export interface Waypoint {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;

class MinHeap {
  private items: number[] = [];
  constructor(private score: Float64Array) {}

  get size(): number {
    return this.items.length;
  }

  push(v: number): void {
    this.items.push(v);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.score[this.items[p]] <= this.score[this.items[i]]) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.score[this.items[l]] < this.score[this.items[m]]) m = l;
        if (r < this.items.length && this.score[this.items[r]] < this.score[this.items[m]]) m = r;
        if (m === i) break;
        [this.items[m], this.items[i]] = [this.items[i], this.items[m]];
        i = m;
      }
    }
    return top;
  }
}

function octile(dx: number, dy: number): number {
  dx = Math.abs(dx);
  dy = Math.abs(dy);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Find a path between tile coords. Start/target are floats (unit positions);
 * they get snapped to tiles. If the target tile is impassable, the nearest
 * passable tile is used. Returns tile-center waypoints (excluding start),
 * or null if unreachable.
 */
export function findPath(
  map: TileMap,
  sx: number,
  sy: number,
  txIn: number,
  tyIn: number,
): Waypoint[] | null {
  const start = map.nearestPassable(sx, sy, 4);
  const target = map.nearestPassable(txIn, tyIn, 12);
  if (!start || !target) return null;
  if (start.x === target.x && start.y === target.y) {
    return [{ x: target.x + 0.5, y: target.y + 0.5 }];
  }

  const { w, h } = map;
  const n = w * h;
  const g = new Float64Array(n).fill(Infinity);
  const f = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new MinHeap(f);

  const sIdx = start.y * w + start.x;
  const tIdx = target.y * w + target.x;
  g[sIdx] = 0;
  f[sIdx] = octile(target.x - start.x, target.y - start.y);
  heap.push(sIdx);

  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  let found = false;
  let guard = n * 4;
  while (heap.size > 0 && guard-- > 0) {
    const cur = heap.pop();
    if (cur === tIdx) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;

    const cx = cur % w;
    const cy = (cur / w) | 0;

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!map.passable(nx, ny)) continue;
      // No corner cutting: diagonal requires both orthogonal neighbours open.
      if (dx !== 0 && dy !== 0 && (!map.passable(cx + dx, cy) || !map.passable(cx, cy + dy))) {
        continue;
      }
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const stepCost = (dx !== 0 && dy !== 0 ? SQRT2 : 1) * map.costAt(nx, ny);
      const ng = g[cur] + stepCost;
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + octile(target.x - nx, target.y - ny);
        came[ni] = cur;
        heap.push(ni);
      }
    }
  }

  if (!found) return null;

  // Reconstruct (tile coords).
  const tilePath: Array<{ x: number; y: number }> = [];
  let cur = tIdx;
  while (cur !== -1) {
    tilePath.push({ x: cur % w, y: (cur / w) | 0 });
    cur = came[cur];
  }
  tilePath.reverse();

  return smooth(map, tilePath).map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
}

/** Check a straight tile-line is fully passable (sampled). */
export function lineWalkable(map: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(x0 + (x1 - x0) * t + 0.5);
    const y = Math.floor(y0 + (y1 - y0) * t + 0.5);
    if (!map.passable(x, y)) return false;
  }
  return true;
}

/** Drop intermediate waypoints that have line of sight. */
function smooth(
  map: TileMap,
  path: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (path.length <= 2) return path.slice(1);
  const out: Array<{ x: number; y: number }> = [];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!lineWalkable(map, path[anchor].x, path[anchor].y, path[i].x, path[i].y)) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}
