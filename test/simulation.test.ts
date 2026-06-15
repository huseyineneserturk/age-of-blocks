// Simulation test to run full AI and simulation loops for 2000 ticks.
// Run: npx tsx test/simulation.test.ts

import { World } from '../src/game/world';
import { setupCommon, setupSinglePlayer } from '../src/game/setup';
import { buildRiverCrossing } from '../src/data/maps/riverCrossing';
import { CIV_LIST } from '../src/data/civs';
import { Camera } from '../src/engine/camera';
import { FogOfWar } from '../src/game/fog';
import { Effects } from '../src/render/effects';
import { EnemyAI } from '../src/game/ai';
import { updateEconomy } from '../src/game/economy';
import { updateCombat } from '../src/game/combat';
import { updateMovement } from '../src/game/movement';
import { updateProjectiles } from '../src/game/projectiles';

// Mock global window/document before importing Renderer
const mockCanvasElement = {
  width: 0,
  height: 0,
  getContext: () => ({
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => {},
    clip: () => {},
    drawImage: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
  }),
};

(global as any).window = {
  devicePixelRatio: 1,
  innerWidth: 1920,
  innerHeight: 1080,
};

(global as any).document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return mockCanvasElement;
    }
    return {};
  },
};

import { Renderer } from '../src/render/renderer';

const mockGradient = {
  addColorStop: () => {},
};

const mockCtx: any = {
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  beginPath: () => {},
  clip: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  ellipse: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  rect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fill: () => {},
  stroke: () => {},
  createLinearGradient: () => mockGradient,
  createRadialGradient: () => mockGradient,
  setTransform: () => {},
  clearRect: () => {},
  fillText: () => {},
  drawImage: () => {},
  setLineDash: () => {},
  // properties
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  font: '',
  textAlign: 'left',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  imageSmoothingEnabled: true,
};

let errors = 0;
const DT = 1 / 20;

console.log('--- Running Long Simulation test ---');
for (const civ of CIV_LIST) {
  for (const foeCiv of CIV_LIST) {
    if (civ === foeCiv) continue;
    try {
      console.log(`Testing matchup: player=${civ}, foe=${foeCiv}...`);
      const gameMap = buildRiverCrossing();
      const world = new World(gameMap.map);
      world.isSinglePlayer = true;
      
      // Set civilizations
      world.players[0].civ = civ;
      world.players[1].civ = foeCiv;

    // Run setup
    setupCommon(world, gameMap);
    setupSinglePlayer(world, gameMap);

    const camera = new Camera(gameMap.map.w, gameMap.map.h);
    camera.setViewport(1920, 1080);
    const home = gameMap.playerStart;
    camera.centerOn(home.x + 6, home.y);

    const fog = new FogOfWar(gameMap.map.w, gameMap.map.h);
    fog.update(world, 0);

    const effects = new Effects();
    const renderer = new Renderer(mockCtx, gameMap.map);
    renderer.updateFog(fog);

    const ai = new EnemyAI(world, gameMap, 'normal');

    // Run 2000 ticks of simulation (100 seconds)
    for (let tick = 0; tick < 2000; tick++) {
      ai.update(DT);
      updateEconomy(world, DT);
      updateCombat(world, DT);
      updateMovement(world, DT);
      updateProjectiles(world, DT);
      
      if (tick % 4 === 0) {
        fog.update(world, 0);
        renderer.updateFog(fog);
      }

      // Render every 4 ticks to test rendering as game changes
      if (tick % 4 === 0) {
        renderer.render(
          world,
          camera,
          new Set(),
          null,
          null,
          null,
          0.5,
          DT,
          effects,
          fog,
          0,
        );
      }
    }
    console.log(`  ✅ Successfully simulated 2000 ticks for ${civ}!`);
    } catch (err: any) {
      console.error(`❌ Crash occurred during simulation for civ ${civ}:`);
      console.error(err.stack || err);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log('\n🎉 All civilizations passed the simulation test without crashes!');
  process.exit(0);
} else {
  console.log(`\n❌ Found ${errors} simulation errors.`);
  process.exit(1);
}
