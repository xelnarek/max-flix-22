import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  ProjectileTracerPool,
  getFirearmTracerStyle,
  getOperatorTracerStyle,
  getSurvivalWeaponTracerStyle,
} from '../src/projectileTracerPool.ts';
import { SURVIVAL_FIREARM_DEFS } from '../src/survivalFirearms.ts';
import { SURVIVAL_DAMAGE_WEAPONS } from '../src/survivalDamageStats.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('ProjectileTracerPool emits, updates, ring-evicts, clears and disposes pooled tracer beams', () => {
  const parent = new THREE.Group();
  const pool = new ProjectileTracerPool(3);
  const style = getFirearmTracerStyle('gauss', 0x22d3ee);

  assert.equal(pool.emitSegment(parent, 1, 1, 1, 1, 1, 1, style), false, 'zero-length segment should be ignored');
  assert.equal(pool.emitSegment(parent, 0, 1, 0, 0, 1, 2, style), true);
  assert.equal(pool.emitSegment(parent, 0, 1, 2, 0, 1, 4, style), true);
  assert.equal(pool.emitSegment(parent, 0, 1, 4, 0, 1, 6, style), true);
  assert.equal(pool.activeCount, 3);
  assert.equal(parent.children.length, 3);

  // Exceeding pool capacity evicts oldest without allocating extra GPU slots
  assert.equal(pool.emitSegment(parent, 0, 1, 6, 0, 1, 8, style), true);
  assert.equal(pool.activeCount, 3);
  assert.equal(pool.allocatedCount, 3);

  pool.update(style.lifeSeconds * 0.5);
  assert.equal(pool.activeCount, 3);
  pool.update(style.lifeSeconds);
  assert.equal(pool.activeCount, 0);
  assert.equal(parent.children.length, 0);

  assert.equal(pool.emitSegment(parent, 0, 1, 0, 2, 1, 0, style), true);
  assert.equal(pool.activeCount, 1);
  pool.clear();
  assert.equal(pool.activeCount, 0);
  assert.equal(parent.children.length, 0);

  pool.dispose();
  assert.equal(pool.emitSegment(parent, 0, 1, 0, 2, 1, 0, style), false);
});

test('all firearms, survival weapons, and operators produce vivid tracer profiles', () => {
  const firearmDefs = Object.values(SURVIVAL_FIREARM_DEFS);
  const archetypes = new Set(firearmDefs.map((def) => def.archetype));
  assert.equal(archetypes.size, 11);
  for (const def of firearmDefs) {
    const style = getFirearmTracerStyle(def.archetype, def.color);
    assert.ok(style.width > 0 && style.lifeSeconds >= 0.13);
    assert.ok(style.opacity >= 0.7 && style.coreOpacity >= 0.8);
    assert.ok(style.minLength >= 0.45);
    assert.ok(style.effectKind, 'every firearm must resolve to a dedicated tracer family');
  }
  assert.equal(getFirearmTracerStyle('rocket', 0xef4444).effectKind, 'rocket-exhaust');
  assert.equal(getFirearmTracerStyle('flame', 0xfb923c).effectKind, 'flame-jet');
  assert.equal(getFirearmTracerStyle('grenade', 0xd4a24f).effectKind, 'smoke');

  for (const [id, meta] of Object.entries(SURVIVAL_DAMAGE_WEAPONS)) {
    const style = getSurvivalWeaponTracerStyle(id, meta.color);
    assert.ok(style.width > 0 && style.lifeSeconds > 0);
    assert.ok(style.opacity >= 0.7 && style.coreOpacity >= 0.8);
  }

  for (const charId of ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']) {
    const base = getOperatorTracerStyle(charId, false);
    const combo = getOperatorTracerStyle(charId, true);
    assert.ok(combo.width > base.width);
    assert.ok(combo.lifeSeconds > base.lifeSeconds);
  }
});

test('Crimsonland firearm mechanics, continuous tracers, casings, stopping power and dry click are wired', async () => {
  const [game, soundSrc] = await Promise.all([
    read('../src/game.ts'),
    read('../src/sound.ts'),
  ]);

  assert.match(game, /private readonly tracerPool = new ProjectileTracerPool\(340\)/);
  assert.match(game, /this\.tracerPool\.update\(simDt\)/);
  assert.match(game, /this\.tracerPool\.clear\(\)/);
  assert.match(game, /this\.tracerPool\.dispose\(\)/);
  assert.match(game, /private spawnFirearmShellCasing\(/);
  assert.match(game, /private applyCrimsonlandWeaponKnockback\(/);
  assert.match(game, /sound\.playFirearmDryClick\(\)/);
  assert.match(game, /this\.pvpProjectileLastPositions/);
  assert.match(game, /p\.mesh\.rotation\.x = -Math\.atan2\(p\.vel\.y, Math\.sqrt\(horizontalSpeedSq\)\)/);
  assert.match(game, /mesh\.rotation\.x = -Math\.atan2\(definition\.projectileLaunchVelocity, definition\.projectileSpeed\)/);
  assert.match(game, /Crimsonland directional exit spray along bullet trajectory/);
  assert.match(game, /tracerEndX = closestX/);
  assert.match(soundSrc, /private getGunshotNoiseBuffer\(\)/);
  assert.match(soundSrc, /public playFirearmDryClick\(\)/);

  // Hostile enemy projectiles remain clean and never emit tracers or trails
  const hostileStart = game.indexOf('for (let i = this.enemyProjectiles.length - 1;');
  const hostileEnd = game.indexOf('\n  private updateSpecialEffects', hostileStart);
  assert.ok(hostileStart >= 0 && hostileEnd > hostileStart);
  assert.doesNotMatch(game.slice(hostileStart, hostileEnd), /tracerPool|trailTimer|trailColor/);
});
