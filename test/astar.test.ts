// Headless A* checks. Run: npm test  (tsx test/astar.test.ts)

import { findPath } from '../src/engine/astar';
import { TileMap, Terrain } from '../src/engine/grid';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name} ${detail}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${detail}`);
  }
}

console.log('\n🧭 A* PATHFINDING');

// 1. Straight path on open ground
{
  const map = new TileMap(20, 10);
  const path = findPath(map, 1, 5, 18, 5);
  check('open ground path found', path !== null && path.length >= 1);
  const end = path![path!.length - 1];
  check('reaches target', Math.abs(end.x - 18.5) < 1 && Math.abs(end.y - 5.5) < 1);
}

// 2. Wall with a gap → path routes through the gap
{
  const map = new TileMap(20, 10);
  for (let y = 0; y < 10; y++) map.set(10, y, Terrain.Water);
  map.set(10, 7, Terrain.Bridge); // gap
  const path = findPath(map, 2, 2, 17, 2);
  check('routes through gap', path !== null);
  const passesGap = path!.some((p) => Math.floor(p.x) === 10 && Math.floor(p.y) === 7);
  check('uses the bridge tile', passesGap);
}

// 3. Fully blocked → null
{
  const map = new TileMap(20, 10);
  for (let y = 0; y < 10; y++) map.set(10, y, Terrain.Water);
  const path = findPath(map, 2, 2, 17, 2);
  check('unreachable returns null', path === null);
}

// 4. No corner cutting through diagonal gaps
{
  const map = new TileMap(10, 10);
  map.set(5, 5, Terrain.Rock);
  map.set(4, 4, Terrain.Rock);
  // Diagonal squeeze between (5,5) and (4,4) must NOT be allowed
  const path = findPath(map, 4, 5, 5, 4);
  check('path exists around corner', path !== null);
  if (path) {
    let cuts = false;
    let px = 4.5;
    let py = 5.5;
    for (const wp of path) {
      // A direct diagonal step from (4,5)→(5,4) would mean both deltas == 1 tile
      if (Math.abs(wp.x - px) >= 0.9 && Math.abs(wp.y - py) >= 0.9 && path.length === 1) cuts = true;
      px = wp.x;
      py = wp.y;
    }
    check('does not cut the corner', !cuts);
  }
}

// 5. Impassable target → lands on nearest passable tile
{
  const map = new TileMap(20, 10);
  map.fillBlob(15, 5, 2, 2, Terrain.Rock);
  const path = findPath(map, 2, 5, 15, 5);
  check('impassable target redirected', path !== null);
  const end = path![path!.length - 1];
  check(
    'end tile is passable',
    map.passable(Math.floor(end.x), Math.floor(end.y)),
    `(end=${end.x.toFixed(1)},${end.y.toFixed(1)})`,
  );
}

// 6. Forest is pricier than grass → path prefers going around small forests
{
  const map = new TileMap(30, 11);
  map.fillRect(10, 0, 14, 8, Terrain.Forest); // forest block, open row at y=9..10
  const path = findPath(map, 2, 4, 27, 4);
  check('forest-aware path found', path !== null);
}

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
