// Headless AI check: on the real map, with a passive player, the AI must
// build an economy, train an army, cross the river and damage the player
// castle within a few minutes. Run: npx tsx test/ai.test.ts

import { buildRiverCrossing } from '../src/data/maps/riverCrossing';
import { World } from '../src/game/world';
import { EnemyAI } from '../src/game/ai';
import { updateCombat } from '../src/game/combat';
import { updateMovement } from '../src/game/movement';
import { updateProjectiles } from '../src/game/projectiles';
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

const DT = 1 / 20;
const gm = buildRiverCrossing();
const world = new World(gm.map);

// Same initial layout as the game (castles + AI starter towers).
world.placeBuilding(0, 'castle', gm.playerStart.x - 1, gm.playerStart.y - 1, true);
world.placeBuilding(1, 'castle', gm.enemyStart.x - 2, gm.enemyStart.y - 1, true);
world.placeBuilding(1, 'tower', gm.enemyStart.x - 5, gm.enemyStart.y - 3, true);

const ai = new EnemyAI(world, gm, 'normal');

const SECONDS = 240;
let crossedAt = -1;
for (let t = 0; t < SECONDS / DT; t++) {
  ai.update(DT);
  updateEconomy(world, DT);
  updateCombat(world, DT);
  updateMovement(world, DT);
  updateProjectiles(world, DT);
  world.events = [];
  if (crossedAt < 0 && world.units.some((u) => u.team === 1 && u.x < 30)) {
    crossedAt = Math.round(t * DT);
  }
  if (world.winner !== null) break;
}

const aiBuildings = world.buildings.filter((b) => b.team === 1);
const mines = aiBuildings.filter((b) => b.kind === 'mine').length;
const military = aiBuildings.filter((b) => ['barracks', 'archery', 'stable', 'siegeworks', 'magetower'].includes(b.kind)).length;
const houses = aiBuildings.filter((b) => b.kind === 'house').length;
const playerCastle = world.buildings.find((b) => b.team === 0 && b.kind === 'castle');

console.log('\n🤖 AI (normal) — 240sn pasif rakibe karşı');
check('ekonomi kurdu (maden ≥ 2)', mines >= 2, `(maden=${mines})`);
check('askeri bina kurdu (≥ 2)', military >= 2, `(askeri=${military})`);
check('ev kurdu (supply)', houses >= 1, `(ev=${houses})`);
check('ordu eğitti', world.units.filter((u) => u.team === 1).length > 0 || world.winner === 1, `(birim=${world.units.filter((u) => u.team === 1).length})`);
check('nehri geçti (dalga saldırısı)', crossedAt >= 0, crossedAt >= 0 ? `(t=${crossedAt}sn)` : '');
check(
  'oyuncu kalesine hasar verdi / yıktı',
  world.winner === 1 || (playerCastle !== undefined && playerCastle.hp < playerCastle.maxHp),
  world.winner === 1 ? '(kale yıkıldı!)' : `(kale hp=${playerCastle ? Math.round(playerCastle.hp) : '?'} / ${playerCastle?.maxHp})`,
);

console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
