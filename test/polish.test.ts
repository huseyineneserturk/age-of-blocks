// Headless checks for Phase 6: fog of war states, commander spells, kill bounty.
// Run: npx tsx test/polish.test.ts

import { TileMap } from '../src/engine/grid';
import { World } from '../src/game/world';
import { FogOfWar, FOG_UNEXPLORED, FOG_EXPLORED, FOG_VISIBLE } from '../src/game/fog';
import { castSpell, killBounty } from '../src/game/spells';
import { updateCombat } from '../src/game/combat';
import { issueAttack } from '../src/game/commands';
import { updateMovement } from '../src/game/movement';
import { TRAIN } from '../src/data/buildings';

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

console.log('\n🌫️ FOG OF WAR');
{
  const map = new TileMap(40, 20);
  const world = new World(map);
  world.spawnUnit(0, 'knight', 10, 10);
  const fog = new FogOfWar(40, 20);
  fog.update(world);

  check('birimin yanı görünür', fog.at(10, 10) === FOG_VISIBLE);
  check('uzak köşe keşfedilmemiş', fog.at(38, 2) === FOG_UNEXPLORED);

  // Move the unit away — old area becomes "explored", new area visible.
  world.units[0].x = 30;
  world.units[0].y = 10;
  fog.update(world);
  check('terk edilen alan "keşfedilmiş"e düşer', fog.at(10, 10) === FOG_EXPLORED);
  check('yeni konum görünür', fog.at(30, 10) === FOG_VISIBLE);
}

console.log('\n☄️ KOMUTAN BÜYÜLERİ');
{
  const map = new TileMap(40, 20);
  const world = new World(map);
  world.placeBuilding(0, 'castle', 2, 8, true); // castle required to cast
  const enemy = world.spawnUnit(1, 'knight', 20, 10);
  const own = world.spawnUnit(0, 'knight', 20, 12);
  own.hp = 50;

  const e0 = world.players[0].energy;
  check('başlangıç enerjisi 40', e0 === 40);

  const okMeteor = castSpell(world, 0, 'meteor', 20, 10);
  check('meteor enerjisi yetmezken reddedilir', !okMeteor && enemy.hp === enemy.maxHp);

  world.players[0].energy = 100;
  const ok2 = castSpell(world, 0, 'meteor', 20, 10);
  check('meteor düşmana hasar verir', ok2 && enemy.hp < enemy.maxHp, `(hp=${Math.round(enemy.hp)})`);
  check('enerji düşer', world.players[0].energy === 50);

  const ok3 = castSpell(world, 0, 'heal', 20, 12);
  check('şifa kendi birimini iyileştirir', ok3 && own.hp > 50, `(hp=${Math.round(own.hp)})`);
}

console.log('\n💰 KILL ÖDÜLÜ');
{
  const map = new TileMap(40, 20);
  const world = new World(map);
  const victim = world.spawnUnit(1, 'cavalry', 12, 10);
  victim.hp = 10;
  const killer = world.spawnUnit(0, 'knight', 11, 10);
  const goldBefore = world.players[0].gold;

  issueAttack(world, [killer], victim.id);
  for (let t = 0; t < 100; t++) {
    updateCombat(world, 1 / 20);
    updateMovement(world, 1 / 20);
    world.events = [];
    if (!world.units.some((u) => u.team === 1)) break;
  }
  const expected = killBounty('cavalry');
  check(
    `süvari öldürene +${expected} altın (maliyetin %40'ı)`,
    world.players[0].gold === goldBefore + expected,
    `(${goldBefore} → ${world.players[0].gold})`,
  );
  check('bounty maliyetle orantılı', expected === Math.round(TRAIN.cavalry.cost * 0.4));
}

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
