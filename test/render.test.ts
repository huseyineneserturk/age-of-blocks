// Test script to run unit and building renderers across all civilizations and catch exceptions.
// Run: npx tsx test/render.test.ts

import { drawFigure } from '../src/render/figures';
import { drawStructure } from '../src/render/buildings';
import { CIV_LIST } from '../src/data/civs';
import { UNITS } from '../src/data/units';
import { BUILDINGS } from '../src/data/buildings';

// Minimal mock of CanvasRenderingContext2D
const mockGradient = {
  addColorStop: () => {},
};

const mockContext: any = {
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  beginPath: () => {},
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

console.log('--- Testing Unit Rendering (drawFigure) ---');
for (const civ of [undefined, ...CIV_LIST]) {
  for (const kind of Object.keys(UNITS) as any[]) {
    for (const team of [0, 1, 2] as any[]) {
      try {
        // s = 30, walk = 0, atk = 0
        drawFigure(mockContext, kind, civ, team, 30, 0, 0);
      } catch (err: any) {
        console.error(`❌ Error rendering unit: civ=${civ}, kind=${kind}, team=${team}`);
        console.error(err.stack || err);
        errors++;
      }
    }
  }
}

console.log('--- Testing Building Rendering (drawStructure) ---');
for (const civ of CIV_LIST) {
  for (const kind of Object.keys(BUILDINGS) as any[]) {
    for (const team of [0, 1, 2] as any[]) {
      try {
        drawStructure(mockContext, kind, civ, team, 0, 0, 100, 100, 1, {
          selected: false,
          constructing: false,
          progress: 1,
        });
      } catch (err: any) {
        console.error(`❌ Error rendering building: civ=${civ}, kind=${kind}, team=${team}`);
        console.error(err.stack || err);
        errors++;
      }
    }
  }
}

if (errors === 0) {
  console.log('\n✅ All rendering tests passed without throwing any exceptions!');
  process.exit(0);
} else {
  console.log(`\n❌ Found ${errors} rendering errors.`);
  process.exit(1);
}
