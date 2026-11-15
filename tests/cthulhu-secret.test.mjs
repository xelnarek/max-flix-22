import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createCthulhuBossModel } from '../src/cthulhuAssets.ts';
import { isWithinCthulhuLashLane } from '../src/cthulhuCombat.ts';

const enemyTypeNames = [
  'walczak', // Reuses the existing major-boss AI/reward contract; the mesh is bespoke Cthulhu.
];

test('the Cthulhu model is a distinct articulated multi-part boss with wings and moving tentacles', () => {
  const built = createCthulhuBossModel();
  assert.ok(built.group instanceof THREE.Group);
  assert.equal(built.group.name, 'cthulhu-elder-god-boss');
  assert.ok(built.legL instanceof THREE.Group);
  assert.ok(built.legR instanceof THREE.Group);
  assert.ok(built.armL instanceof THREE.Group);
  assert.ok(built.armR instanceof THREE.Group);
  assert.ok(built.head instanceof THREE.Group);
  assert.ok(built.tentacles.length >= 7);
  assert.equal(built.wings.length, 2);
  const meshNames = [];
  built.group.traverse((object) => { if (object instanceof THREE.Mesh) meshNames.push(object.name); });
  assert.ok(meshNames.some((name) => name.includes('glowing-eye')));
  assert.ok(meshNames.some((name) => name.includes('wing-membrane')));
  assert.ok(meshNames.some((name) => name.includes('elder-sigil')));
  assert.ok(meshNames.some((name) => name.includes('talon')));
  assert.ok(meshNames.length >= 48, 'the boss should be more than a simple recoloured humanoid');
});

test('Necronomicon secrets summon a bespoke Cthulhu using the existing boss AI contract', async () => {
  const [game, maps] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/survivalMaps.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(maps, /'necronomicon'/);
  assert.match(game, /if \(secret\.id === 'necronomicon'\) this\.summonCthulhu\(\)/);
  assert.match(game, /private summonCthulhu\(\): void/);
  assert.match(game, /private addCthulhuBossEnemy\(id: string, x: number, z: number\)/);
  assert.match(game, /const built = createCthulhuBossModel\(\)/);
  assert.match(game, /name: 'CTHULHU • PAN ZATOPIONEGO R’LYEH'/);
  assert.match(game, /this\.spawnCthulhuArrivalRitual\(spawnX, spawnZ\)/);
  assert.match(game, /cthulhuSecretSummoned/);
  assert.deepEqual(enemyTypeNames, ['walczak']);
});

test('the Cthulhu encounter uses a visible wind-up, a dodgeable area attack and a second phase', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /const isCthulhuBoss = e\.name\.includes\('CTHULHU'\)/);
  assert.match(game, /const cooldown = isCthulhuBoss\s*\?\s*\(isPhase2 \? 2\.05 : 3\.35\)/);
  assert.match(game, /e\.chargeTimer = isPhase2 \? 0\.72 : 0\.98/);
  assert.match(game, /this\.spawnBossImpactTelegraph\([\s\S]{0,180}impactRadius/);
  assert.match(game, /isWithinBossImpactRadius\([\s\S]{0,140}impactRadius/);
  assert.match(game, /CTHULHU ROZRYWA ZASŁONĘ/);
  assert.match(game, /R’LYEH ZAPADŁO SIĘ POD FALE/);
});

test('the Necronomicon has its own 3D book geometry, runes and floating aura', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /secret\.style === 'necronomicon'/);
  assert.match(game, /necronomicon-book/);
  assert.match(game, /NECRONOMICON/);
  assert.match(game, /necronomicon-floating-runes/);
  assert.match(game, /new THREE\.TorusGeometry\(0\.83/);
});


test('the phase-two tentacle lash has a directional, dodgeable corridor hit test', () => {
  assert.equal(isWithinCthulhuLashLane(0, 8, 0, 0, 0, 5), true);
  assert.equal(isWithinCthulhuLashLane(2.4, 8, 0, 0, 0, 1), false, 'outside the lane width is safe');
  assert.equal(isWithinCthulhuLashLane(0, -2, 0, 0, 0, 1), false, 'behind the boss is safe');
  assert.equal(isWithinCthulhuLashLane(0, 18, 0, 0, 0, 1), false, 'outside the reach is safe');
  assert.equal(isWithinCthulhuLashLane(0, 8, 0, 0, 0, 0), false, 'a zero direction is invalid');
  assert.equal(isWithinCthulhuLashLane(0, 8, 0, 0, 0, 3, 15.5, 2.15), true, 'raw aim vectors are normalized');
});

test('Cthulhu phase two alternates a line telegraph with the circular ground rupture', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /cthulhuNextAttack !== 'slam'/);
  assert.match(game, /cthulhuNextAttack = 'slam'/);
  assert.match(game, /cthulhuNextAttack = 'lash'/);
  assert.match(game, /spawnCthulhuLashTelegraph/);
  assert.match(game, /MACKI CELOWANE — ODSKOCZ W BOK LUB WYSKOCZ/);
  assert.match(game, /isWithinCthulhuLashLane/);
  assert.match(game, /cthulhuStrikeTimer/);
  assert.match(game, /cthulhuTorso/);
});
