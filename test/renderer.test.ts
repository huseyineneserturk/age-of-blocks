// Full-scope rendering integration test to catch civilization starting screen crashes.
// Run: npx tsx test/renderer.test.ts

import { World } from '../src/game/world';
import { setupCommon, setupSinglePlayer } from '../src/game/setup';
import { buildRiverCrossing } from '../src/data/maps/riverCrossing';
import { CIV_LIST } from '../src/data/civs';
import { Camera } from '../src/engine/camera';
import { FogOfWar } from '../src/game/fog';
import { Effects } from '../src/render/effects';

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

// Now import Renderer
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

console.log('--- Running Civilizations Starting Render Test ---');
for (const civ of CIV_LIST) {
  try {
    console.log(`Testing civ: ${civ}...`);
    const gameMap = buildRiverCrossing();
    const world = new World(gameMap.map);
    
    // Set civilizations
    world.players[0].civ = civ;
    // Foe has a different random civ
    const pool = CIV_LIST.filter((c) => c !== civ);
    world.players[1].civ = pool[0];

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

    // Render the initial frame
    renderer.render(
      world,
      camera,
      new Set(), // selected
      null, // selectedBuildingId
      null, // ghost
      null, // dragRect
      0, // alpha
      0.016, // dt
      effects,
      fog,
      0, // myTeam
    );
    console.log(`  ✅ Successfully rendered initial frame for ${civ}!`);
  } catch (err: any) {
    console.error(`❌ Crash occurred during render for civ ${civ}:`);
    console.error(err.stack || err);
    errors++;
  }
}

if (errors === 0) {
  console.log('\n🎉 All civilizations passed the starting render test without crashes!');
  process.exit(0);
} else {
  console.log(`\n❌ Found ${errors} starting render errors.`);
  process.exit(1);
}
