import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createCthulhuBossModel } from '../src/cthulhuAssets.ts';
import {
  CTHULHU_CORE_DAMAGE_MULTIPLIER,
  CTHULHU_CORE_OPEN_SECONDS,
  getCthulhuCoreDamageMultiplier,
  getCthulhuPhaseTwoAttack,
  isWithinCthulhuLashLane,
} from '../src/cthulhuCombat.ts';

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
  assert.equal(built.group.userData.cthulhuArmL, built.armL);
  assert.equal(built.group.userData.cthulhuArmR, built.armR);
  assert.equal(built.group.userData.cthulhuHead, built.head);
  assert.ok(built.group.userData.cthulhuSigil instanceof THREE.Mesh);
  assert.equal(built.group.userData.cthulhuCore, built.core);
  assert.equal(built.group.userData.cthulhuCoreHalo, built.coreHalo);
  assert.equal(built.core.name, 'cthulhu-exposed-elder-core');
  assert.equal(built.coreHalo.name, 'cthulhu-core-iris');
  assert.notEqual(
    built.coreHalo.material,
    built.group.userData.cthulhuSigil.material,
    'core animation must not recolour the boss-wide shared bioluminescent material',
  );
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

test('Cthulhu phase two cycles through a slam, aimed lash and grab with a readable snare response', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /getCthulhuPhaseTwoAttack/);
  assert.match(game, /cthulhuNextAttack = phaseTwoPlan\.nextAttack/);
  assert.match(game, /cthulhuActiveAttack = 'slam'/);
  assert.match(game, /cthulhuActiveAttack/);
  assert.match(game, /spawnCthulhuLashTelegraph/);
  assert.match(game, /cthulhuActiveAttack === 'lash'/);
  assert.match(game, /Lock both aimed moves to the corridor/);
  assert.match(game, /cthulhuLashDirX \?\? dx/);
  assert.match(game, /MACKI CELOWANE — ODSKOCZ W BOK LUB WYSKOCZ/);
  assert.match(game, /isWithinCthulhuLashLane/);
  assert.match(game, /cthulhuStrikeTimer/);
  assert.match(game, /cthulhuTorso/);
  assert.match(game, /cthulhuActiveAttack === 'grab'/);
  assert.match(game, /private spawnCthulhuGrabEffect/);
  assert.match(game, /cthulhu-player-grab-effect/);
  assert.match(game, /cthulhuSnareTimer/);
  assert.match(game, /cthulhuSnareTimer - dt \* 1\.4/);
  assert.match(game, /MACKI CHTULHU ZAMYKAJĄ SIĘ NA TOBIE/);
});


test('Cthulhu phase-two attack selector loops through all three distinct moves', () => {
  let nextAttack;
  const sequence = [];
  for (let index = 0; index < 6; index++) {
    const plan = getCthulhuPhaseTwoAttack(nextAttack);
    sequence.push(plan.attack);
    nextAttack = plan.nextAttack;
  }
  assert.deepEqual(sequence, ['lash', 'grab', 'slam', 'lash', 'grab', 'slam']);
});

test('Cthulhu idle and attack animation now articulate its head, arms and living sigil', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('const cthulhuHead = e.mesh.userData.cthulhuHead as THREE.Group | undefined;'));
  assert.ok(game.includes('cthulhuHead.rotation.y = idleScan'));
  assert.ok(game.includes('const armSway = Math.sin(e.walkCycle * 0.33)'));
  assert.ok(game.includes('cthulhuArmL.rotation.x = -armSway'));
  assert.ok(game.includes('cthulhuArmR.rotation.x = armSway'));
  assert.ok(game.includes('cthulhuSigil.scale.set(sigilPulse'));
});

test('the Necronomicon relic animates its book, sigil, halo and individual floating runes', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('group.userData.necronomiconBook = book;'));
  assert.ok(game.includes('group.userData.necronomiconSigil = sigilRing;'));
  assert.ok(game.includes('group.userData.necronomiconRunes = glyphs;'));
  assert.ok(game.includes('group.userData.necronomiconHalo = halo;'));
  assert.ok(game.includes('book.rotation.z = -0.09 + Math.sin(secret.age * 1.45)'));
  assert.ok(game.includes('sigil.rotation.z += dt * 0.72'));
  assert.ok(game.includes('runes.children.forEach((rune, index)'));
  assert.ok(game.includes('rune.position.y = 0.90 + Math.sin(secret.age * 2.3 + index * 1.25)'));
  assert.ok(game.includes('haloMaterial.opacity = 0.66'));
});


test('Cthulhu core exposure lasts for a clear window and rewards damage only while open', () => {
  assert.equal(CTHULHU_CORE_OPEN_SECONDS, 2.15);
  assert.equal(CTHULHU_CORE_DAMAGE_MULTIPLIER, 1.5);
  assert.equal(getCthulhuCoreDamageMultiplier(2.15), 1.5);
  assert.equal(getCthulhuCoreDamageMultiplier(0.001), 1.5);
  assert.equal(getCthulhuCoreDamageMultiplier(0), 1);
  assert.equal(getCthulhuCoreDamageMultiplier(-1), 1);
  assert.equal(getCthulhuCoreDamageMultiplier(Number.NaN), 1);
});

test('Cthulhu opens the visible chest core after each resolved attack and scales damage fairly', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('e.mesh.userData.cthulhuCoreOpenTimer = CTHULHU_CORE_OPEN_SECONDS;'));
  assert.ok(game.includes('RDZEŃ ODSŁONIĘTY • ATAKUJ! +50% OBRAŻEŃ'));
  assert.ok(game.includes('getCthulhuCoreDamageMultiplier(coreOpenSeconds)'));
  assert.ok(game.includes('coreMaterial.emissiveIntensity = coreOpen ? 2.35 + corePulse * 1.05'));
  assert.ok(game.includes("const baseAppliedDamage = this.gameMode === 'survival'"));
});

test('the Necronomicon pickup plays a hinged opening cinematic with rising runes before the boss reveal', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /private spawnNecronomiconOpeningEffect\(x: number, z: number\): void/);
  assert.match(game, /this\.spawnNecronomiconOpeningEffect\(this\.playerPos\.x, this\.playerPos\.z\)/);
  assert.match(game, /necronomicon-opening-hinged-cover/);
  assert.match(game, /lidPivot\.rotation\.x = -2\.05 \* eased/);
  assert.match(game, /necronomicon-opening-runes/);
  assert.match(game, /burstDone/);
});

test('R’lyeh summoning ritual now has orbiting glyphs and a pulsing central eye', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /cthulhu-rlyeh-ritual-glyphs/);
  assert.match(game, /const centralEye = new THREE\.Mesh/);
  assert.match(game, /centralEye\.rotation\.y -= dt \* 1\.25/);
  assert.match(game, /runeMaterial\.opacity = 0\.92 \* \(1 - progress \* 0\.78\)/);
});

test('Cthulhu has a bespoke sinking death animation and a collapsing R’lyeh finale, not the generic boss burst', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /const isCthulhuDeath = enemy\.name\.includes\('CTHULHU'\)/);
  assert.match(game, /enemy\.deathVisualDuration = duration/);
  assert.match(game, /mesh\.position\.y = rest\.positionY \+ Math\.sin\(progress \* Math\.PI\) \* 0\.42 - eased \* 1\.38/);
  assert.match(game, /private spawnRlyehCollapse\(x: number, y: number, z: number\): void/);
  assert.match(game, /rlyeh-sunken-ruins-collapse/);
  assert.match(game, /this\.spawnRlyehCollapse\(e\.x, e\.y, e\.z\)/);
  assert.match(game, /!e\.name\.includes\('CTHULHU'\) && \(e\.type === 'walczak'/);
});
