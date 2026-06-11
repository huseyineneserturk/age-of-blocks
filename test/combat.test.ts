// Headless combat duels: equal-size squads attack-move into each other on an
// open field; the counter relationship should decide the fight.
// Run: npx tsx test/combat.test.ts

import { TileMap } from '../src/engine/grid';
import { World } from '../src/game/world';
import { updateCombat } from '../src/game/combat';
import { updateMovement } from '../src/game/movement';
import { updateProjectiles } from '../src/game/projectiles';
import { issueAttackMove } from '../src/game/commands';
import type { UnitKind, Team } from '../src/data/units';

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

function duel(a: UnitKind, b: UnitKind, n = 6, seconds = 90): [number, number] {
  const map = new TileMap(40, 20);
  const world = new World(map);

  const squadA = [];
  const squadB = [];
  for (let i = 0; i < n; i++) {
    squadA.push(world.spawnUnit(0, a, 12, 7 + i * 1.2));
    squadB.push(world.spawnUnit(1, b, 28, 7 + i * 1.2));
  }
  issueAttackMove(world, squadA, 28, 10);
  issueAttackMove(world, squadB, 12, 10);

  const ticks = Math.floor(seconds / DT);
  for (let t = 0; t < ticks; t++) {
    updateCombat(world, DT);
    updateMovement(world, DT);
    updateProjectiles(world, DT);
    world.events = [];
    const a0 = world.units.some((u) => u.team === 0);
    const a1 = world.units.some((u) => u.team === 1);
    if (!a0 || !a1) break;
  }

  const s0 = world.units.filter((u) => u.team === (0 as Team)).length;
  const s1 = world.units.filter((u) => u.team === (1 as Team)).length;
  return [s0, s1];
}

console.log('\n⚔️  COUNTER DUELS (eşit sayıda, counter kazanmalı)');
{
  const [kn, ar] = duel('knight', 'archer');
  check('knight > archer', kn > ar, `(knight=${kn}, archer=${ar})`);
}
{
  const [sp, cv] = duel('spear', 'cavalry');
  check('spear > cavalry (hard counter)', sp > cv, `(spear=${sp}, cavalry=${cv})`);
}
{
  const [ar, sp] = duel('archer', 'spear');
  check('archer > spear', ar > sp, `(archer=${ar}, spear=${sp})`);
}
{
  const [cv, ar] = duel('cavalry', 'archer');
  check('cavalry > archer', cv > ar, `(cavalry=${cv}, archer=${ar})`);
}
{
  const [cv, kn] = duel('cavalry', 'knight');
  check('cavalry > knight', cv > kn, `(cavalry=${cv}, knight=${kn})`);
}

console.log('\n🧙 ÖZEL ROLLER');
{
  const [mg, kn] = duel('mage', 'knight', 5);
  console.log(`  ℹ️ mage vs knight: ${mg}-${kn} (mage AoE kalabalığa; teke tek kaybedebilir, bilgi amaçlı)`);
  check('duel tamamlanıyor (asılı kalmıyor)', true);
}

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
