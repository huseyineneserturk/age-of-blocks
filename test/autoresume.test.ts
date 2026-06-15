// Headless check for Villager Auto-Resume Construction.
// Run: npx tsx test/autoresume.test.ts

import { TileMap } from '../src/engine/grid';
import { World } from '../src/game/world';
import { updateEconomy } from '../src/game/economy';

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

console.log('\n🏠 VILLAGER AUTO-RESUME CONSTRUCTION');
{
  const map = new TileMap(40, 20);
  const world = new World(map);

  // Spawn a villager
  const u = world.spawnUnit(0, 'villager', 4.5, 1.5);

  // Spawn building A (unfinished, 99% done)
  const bA = world.placeBuilding(0, 'barracks', 4, 2, false);
  bA.buildProgress = 0.99;
  bA.hp = bA.maxHp * 0.99;

  // Spawn building B (unfinished) nearby (distance < 15)
  const bB = world.placeBuilding(0, 'barracks', 8, 2, false);
  bB.buildProgress = 0.5;
  bB.hp = bB.maxHp * 0.5;

  // Assign villager to building A
  u.targetBuildingId = bA.id;
  u.order = 'move';

  // Run a tick of updateEconomy
  updateEconomy(world, 1.0); // 1.0 seconds dt to finish it

  check('Building A is completed', bA.buildProgress >= 1.0);
  check('Villager target switched to Building B', u.targetBuildingId === bB.id);
  check('Villager order is still move', u.order === 'move');
  check('Villager has a path set', u.path !== null && u.path.length > 0);
}

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
