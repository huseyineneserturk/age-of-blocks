// Headless checks for civilization bonuses.
// Run: npx tsx test/civs.test.ts

import { TileMap, Terrain } from '../src/engine/grid';
import { World } from '../src/game/world';
import { updateMovement } from '../src/game/movement';
import { updateEconomy, enqueueUnit, researchCost } from '../src/game/economy';
import { updateCombat, killBounty } from '../src/game/combat';
import { issueAttack } from '../src/game/commands';
import { findPath } from '../src/engine/astar';

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

console.log('\n🌀 KELT — Orman Halkı (ormanda yavaşlamaz)');
{
  // Two identical units cross the same forest strip; the Celt arrives sooner.
  const run = (civ: 'celt' | 'rome'): number => {
    const map = new TileMap(30, 9);
    map.fillRect(8, 0, 22, 8, Terrain.Forest);
    const world = new World(map);
    world.players[0].civ = civ;
    const u = world.spawnUnit(0, 'knight', 4, 4);
    u.path = findPath(map, 4, 4, 26, 4);
    u.pathIdx = 0;
    u.order = 'move';
    let ticks = 0;
    while (u.path && ticks < 1200) {
      updateMovement(world, DT);
      ticks++;
    }
    return ticks;
  };
  const celt = run('celt');
  const rome = run('rome');
  check('Kelt ormanı belirgin hızlı geçer', celt < rome * 0.8, `(kelt=${celt} tick, roma=${rome} tick)`);
}

console.log('\n☪ OSMANLI — Devşirme Ocağı (eğitim %20 hızlı)');
{
  const time = (civ: 'ottoman' | 'rome'): number => {
    const map = new TileMap(30, 12);
    const world = new World(map);
    world.players[0].civ = civ;
    world.players[0].gold = 1000;
    const b = world.placeBuilding(0, 'barracks', 5, 5, true);
    world.placeBuilding(0, 'castle', 10, 5, true); // supply
    updateEconomy(world, DT); // supply recalc
    enqueueUnit(world, b, 'knight');
    let t = 0;
    while (b.queue.length > 0 && t < 1000) {
      updateEconomy(world, DT);
      t++;
    }
    return t;
  };
  const ot = time('ottoman');
  const ro = time('rome');
  check('Osmanlı daha hızlı eğitir', ot < ro, `(osmanlı=${ot} tick, roma=${ro} tick)`);
  check('~%20 hız farkı', Math.abs(ot / ro - 0.8) < 0.06, `(oran=${(ot / ro).toFixed(2)})`);
}

console.log('\n龍 ÇİN — Hanedan Bilgeliği (+4 ev nüfusu, araştırma %20 ucuz)');
{
  const map = new TileMap(30, 12);
  const world = new World(map);
  world.players[0].civ = 'china';
  world.players[1].civ = 'rome';
  world.placeBuilding(0, 'house', 5, 5, true);
  world.placeBuilding(1, 'house', 20, 5, true);
  updateEconomy(world, DT);
  check('Çin evi +4 nüfus', world.players[0].supplyCap === world.players[1].supplyCap + 4,
    `(çin=${world.players[0].supplyCap}, roma=${world.players[1].supplyCap})`);
  check('araştırma %20 ucuz', researchCost(world.players[0]) === Math.round(researchCost(world.players[1]) * 0.8),
    `(çin=${researchCost(world.players[0])}, roma=${researchCost(world.players[1])})`);
}

console.log('\n🦅 ROMA — Lejyon Disiplini (+%10 HP)');
{
  const map = new TileMap(20, 10);
  const world = new World(map);
  world.players[0].civ = 'rome';
  world.players[1].civ = 'celt';
  const r = world.spawnUnit(0, 'knight', 5, 5);
  const c = world.spawnUnit(1, 'knight', 15, 5);
  check('Roma birimi %10 daha dayanıklı', Math.abs(r.maxHp / c.maxHp - 1.1) < 1e-9, `(roma=${r.maxHp}, kelt=${c.maxHp})`);
}

console.log('\n🪓 VIKING — Yağma (ganimet 2x)');
{
  const map = new TileMap(20, 10);
  const world = new World(map);
  world.players[0].civ = 'viking';
  const victim = world.spawnUnit(1, 'cavalry', 12, 5);
  victim.hp = 5;
  const killer = world.spawnUnit(0, 'knight', 11, 5);
  const before = world.players[0].gold;
  issueAttack(world, [killer], victim.id);
  for (let t = 0; t < 100 && world.units.some((u) => u.team === 1); t++) {
    updateCombat(world, DT);
    updateMovement(world, DT);
    world.events = [];
  }
  const gained = world.players[0].gold - before;
  check('Viking 2x ganimet alır', gained === killBounty('cavalry') * 2, `(+${gained}, normal=${killBounty('cavalry')})`);
}

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
