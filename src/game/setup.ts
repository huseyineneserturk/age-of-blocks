// Shared initial world setup — used by the single-player game, the
// authoritative multiplayer server and headless tests.

import type { GameMap } from '../data/maps/riverCrossing';
import type { UnitKind } from '../data/units';
import type { World } from './world';

/** Castles, environment (cracked rocks + neutral camp). Common to all modes. */
export function setupCommon(world: World, gm: GameMap): void {
  world.placeBuilding(0, 'castle', gm.playerStart.x - 1, gm.playerStart.y - 1, true);
  world.placeBuilding(1, 'castle', gm.enemyStart.x - 2, gm.enemyStart.y - 1, true);

  for (const r of gm.crackedRocks) world.addRock(r.x, r.y);

  const camp = gm.neutralCamp;
  // Replace Golem with a neutral Castle (6000 HP)
  const fort = world.placeBuilding(2, 'castle', camp.x - 1, camp.y - 1, true);
  fort.maxHp = 6000;
  fort.hp = 6000;
  world.spawnUnit(2, 'pirate', camp.x - 1.6, camp.y - 1.2);
  world.spawnUnit(2, 'pirate', camp.x - 1.6, camp.y + 1.2);
  world.spawnUnit(2, 'pirate', camp.x + 1.6, camp.y - 1.2);
  world.spawnUnit(2, 'pirate', camp.x + 1.6, camp.y + 1.2);
}

/** Symmetric starting forces for fair PvP: both sides get the same kit. */
export function setupSymmetric(world: World, gm: GameMap): void {
  const squad: UnitKind[] = ['knight', 'knight', 'spear', 'archer', 'villager', 'villager', 'villager'];

  const ps = gm.playerStart;
  world.placeBuilding(0, 'tower', ps.x + 3, ps.y - 3, true);
  world.placeBuilding(0, 'tower', ps.x + 3, ps.y + 2, true);
  squad.forEach((k, i) => {
    world.spawnUnit(0, k, ps.x + 5 + (i % 2), ps.y - 1 + Math.floor(i / 2) * 1.5);
  });

  const es = gm.enemyStart;
  world.placeBuilding(1, 'tower', es.x - 5, es.y - 3, true);
  world.placeBuilding(1, 'tower', es.x - 5, es.y + 2, true);
  squad.forEach((k, i) => {
    world.spawnUnit(1, k, es.x - 6 - (i % 2), es.y - 1 + Math.floor(i / 2) * 1.5);
  });
}

/** Single-player extras: the player gets a squad, the AI side a garrison. */
export function setupSinglePlayer(world: World, gm: GameMap): void {
  const ps = gm.playerStart;
  const startKinds: UnitKind[] = ['knight', 'knight', 'spear', 'archer', 'villager', 'villager', 'villager'];
  startKinds.forEach((k, i) => {
    world.spawnUnit(0, k, ps.x + 3 + (i % 2), ps.y - 1 + Math.floor(i / 2) * 1.5);
  });

  const es = gm.enemyStart;
  world.placeBuilding(1, 'tower', es.x - 5, es.y - 3, true);
  world.placeBuilding(1, 'tower', es.x - 5, es.y + 2, true);
  const garrison: UnitKind[] = ['knight', 'spear', 'archer', 'villager', 'villager', 'villager'];
  garrison.forEach((k, i) => {
    world.spawnUnit(1, k, es.x - 7 - (i % 3) * 1.3, es.y - 1 + Math.floor(i / 3) * 1.5);
  });
}
