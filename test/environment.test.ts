// Headless checks for Phase 4 environment mechanics:
// forest ambush visibility, destructible rocks, neutral camp reward.
// Run: npx tsx test/environment.test.ts

import { TileMap, Terrain } from '../src/engine/grid';
import { World } from '../src/game/world';
import { updateCombat, isHiddenFrom } from '../src/game/combat';
import { updateMovement } from '../src/game/movement';
import { updateProjectiles } from '../src/game/projectiles';
import { issueAttackRock, issueAttack } from '../src/game/commands';

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

const DT = 1 / 20;
function tick(world: World, seconds: number): void {
  const n = Math.floor(seconds / DT);
  for (let t = 0; t < n; t++) {
    updateCombat(world, DT);
    updateMovement(world, DT);
    updateProjectiles(world, DT);
    world.events = [];
  }
}

console.log('\n🌲 ORMAN PUSUSU');
{
  const map = new TileMap(30, 15);
  map.fillBlob(15, 7, 2, 2, Terrain.Forest);
  const world = new World(map);
  const lurker = world.spawnUnit(1, 'knight', 15, 7); // inside forest
  world.spawnUnit(0, 'archer', 9, 7); // 6 tiles away

  check('uzaktaki düşman ormandakini göremez', isHiddenFrom(world, lurker, 0));

  world.spawnUnit(0, 'knight', 13.5, 7); // 1.5 tiles — close enough to reveal
  check('yaklaşınca pusu açığa çıkar', !isHiddenFrom(world, lurker, 0));
}

console.log('\n🪨 KIRIK KAYA');
{
  const map = new TileMap(20, 10);
  const world = new World(map);
  const rock = world.addRock(10, 5);
  check('kaya tile\'ı geçilmez', !map.passable(10, 5));

  const cata = world.spawnUnit(0, 'catapult', 7, 5);
  issueAttackRock(world, [cata], rock.id);
  tick(world, 30);
  check('catapult kayayı kırar', !world.rocks.some((r) => r.alive), `(kalan=${world.rocks.length})`);
  check('geçit açılır (tile geçilebilir)', map.passable(10, 5));
}

console.log('\n🗿 NÖTR KAMP ÖDÜLÜ');
{
  const map = new TileMap(30, 15);
  const world = new World(map);
  const wolf = world.spawnUnit(2, 'wolf', 15, 7);
  wolf.hp = 30; // about to die
  const knight = world.spawnUnit(0, 'knight', 13, 7);
  const goldBefore = world.players[0].gold;
  const dmgBefore = world.players[0].upgrades.damage;

  issueAttack(world, [knight], wolf.id);
  // run ticks, capture camp_cleared event
  let sawEvent = false;
  for (let t = 0; t < 200; t++) {
    updateCombat(world, DT);
    updateMovement(world, DT);
    updateProjectiles(world, DT);
    if (world.events.some((e) => e.type === 'camp_cleared')) sawEvent = true;
    world.events = [];
    if (!world.units.some((u) => u.team === 2)) break;
  }

  check('son canavar ölünce camp_cleared olayı', sawEvent);
  check('+150 altın verildi', world.players[0].gold === goldBefore + 150, `(${goldBefore} → ${world.players[0].gold})`);
  check('+%10 kalıcı hasar buffı', Math.abs(world.players[0].upgrades.damage - (dmgBefore + 0.1)) < 1e-9);
  check('ödül bir kez verilir bayrağı', world.campRewardGiven);
}

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
