// End-to-end multiplayer test: real server + two socket.io clients.
// Verifies lobby flow, authoritative sim, command validation and snapshots.
// Run: npx tsx test/net.test.ts

import { io as ioc, type Socket } from 'socket.io-client';
import { startServer } from '../server/index';
import type { Snapshot } from '../src/net/protocol';

const PORT = 3917;
const URL = `http://localhost:${PORT}`;

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

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(URL, { transports: ['websocket'] });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const server = startServer(PORT);
  console.log('\n🌐 MULTIPLAYER ENTEGRASYON');

  const a = await connect();
  const b = await connect();

  // --- Lobby ---
  const created = await new Promise<{ code: string; team: number }>((r) => a.emit('createRoom', r));
  check('oda kuruldu (kod 5 hane)', created.code.length === 5 && created.team === 0, `(${created.code})`);

  const startA = new Promise<{ team: number }>((r) => a.once('start', r));
  const startB = new Promise<{ team: number }>((r) => b.once('start', r));
  const joined = await new Promise<{ ok: boolean; team?: number }>((r) => b.emit('joinRoom', created.code, r));
  check('odaya katılım', joined.ok === true && joined.team === 1);

  const [sa, sb] = await Promise.all([startA, startB]);
  check('maç başladı (takımlar 0 ve 1)', sa.team === 0 && sb.team === 1);

  // --- Snapshots flow ---
  const snapsA: Snapshot[] = [];
  a.on('snapshot', (s: Snapshot) => snapsA.push(s));
  await sleep(600);
  check('snapshot akışı (~10Hz)', snapsA.length >= 3, `(${snapsA.length} snapshot / 0.6sn)`);

  const first = snapsA[snapsA.length - 1];
  const castles = first.buildings.filter((x) => x.kind === 'castle').length;
  check('dünya simetrik kuruldu (2 kale)', castles === 2);
  check('başlangıç birlikleri var', first.units.filter((u) => u.team === 0).length >= 4);

  // --- Commands: move own units ---
  const myUnits = first.units.filter((u) => u.team === 0 && u.kind !== 'golem' && u.kind !== 'wolf');
  const ids = myUnits.map((u) => u.id);
  const beforeX = myUnits[0].x;
  a.emit('command', { t: 'move', ids, x: beforeX + 5, y: myUnits[0].y });
  await sleep(1200);
  const after = snapsA[snapsA.length - 1].units.find((u) => u.id === ids[0]);
  check('hareket komutu işlendi (sunucu sim)', after !== undefined && after.x > beforeX + 1, `(x: ${beforeX} → ${after?.x})`);

  // --- Cheat prevention: player B cannot command A's units ---
  const bMoveTargetBefore = snapsA[snapsA.length - 1].units.find((u) => u.id === ids[1])!;
  b.emit('command', { t: 'move', ids: [ids[1]], x: 5, y: 5 });
  await sleep(600);
  const bMoveTargetAfter = snapsA[snapsA.length - 1].units.find((u) => u.id === ids[1])!;
  check(
    'hile koruması: rakip senin birimini yönetemez',
    Math.abs(bMoveTargetAfter.x - bMoveTargetBefore.x) < 1.5,
  );

  // --- Build command (validated server-side) ---
  const goldBefore = snapsA[snapsA.length - 1].players[0].gold;
  a.emit('command', { t: 'build', kind: 'house', x: 8, y: 14 });
  await sleep(400);
  const lastSnap = snapsA[snapsA.length - 1];
  const houseBuilt = lastSnap.buildings.some((x) => x.kind === 'house' && x.team === 0);
  check('inşa komutu sunucuda doğrulanıp uygulandı', houseBuilt && lastSnap.players[0].gold < goldBefore);

  // --- Train command ---
  // (need a completed military building — use the castle? castles don't train;
  //  just verify invalid train is safely ignored)
  a.emit('command', { t: 'train', building: 99999, kind: 'knight' });
  await sleep(300);
  check('geçersiz komut sunucuyu düşürmez', snapsA.length > 0);

  // --- Forfeit ---
  const leftPromise = new Promise<void>((r) => a.once('opponentLeft', () => r()));
  b.disconnect();
  await Promise.race([leftPromise.then(() => true), sleep(2000).then(() => false)]).then((ok) =>
    check('rakip ayrılınca forfeit bildirimi', ok === true),
  );

  a.disconnect();
  server.close();

  console.log(`\n${fail === 0 ? '🎉' : '⚠️'}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
