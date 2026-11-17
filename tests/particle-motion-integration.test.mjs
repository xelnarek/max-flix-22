import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('game particle state is fixed-capacity and all visual emitters reuse preallocated motion records', async () => {
  const [game, pool] = await Promise.all([
    read('../src/game.ts'),
    read('../src/particleMotionPool.ts'),
  ]);
  assert.match(pool, /new THREE\.Vector3\(\)/);
  assert.match(game, /PARTICLE_STATE_CAPACITY = 75/);
  assert.match(game, /new ParticleMotionStatePool\(PARTICLE_STATE_CAPACITY\)/);
  assert.match(game, /new Array<ParticleMotionState \| undefined>\(PARTICLE_STATE_CAPACITY\)/);
  assert.match(game, /private addParticle\(/);
  assert.match(game, /this\.particleStatePool\.acquire\(\)/);
  assert.match(game, /this\.particles\[this\.particleCount\+\+\] = particle/);
  assert.doesNotMatch(game, /this\.particles\.push\(/);
  assert.doesNotMatch(game, /this\.particles\.splice\(/);
  assert.match(game, /this\.particles\.copyWithin\(0, excess, this\.particleCount\)/);
  assert.match(game, /private readonly particleColorScratch = new THREE\.Color\(\)/);
});

test('particle update loop only mutates pooled records and releases expired particles by swap removal', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private updateParticles(dt: number)');
  const end = game.indexOf('public triggerJump()', start);
  const update = game.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(update, /this\.particleCount - 1/);
  assert.match(update, /this\.removeParticleAt\(i\)/);
  assert.match(update, /pt\.hasGravity/);
  assert.match(update, /pt\.hasRotation/);
  assert.doesNotMatch(update, /new THREE\.(?:Vector3|Quaternion|Color)\(/);
  assert.doesNotMatch(update, /\.splice\(/);
});

test('particle emitters no longer allocate velocity or rotational Vector3 objects per burst item', async () => {
  const game = await read('../src/game.ts');
  const methods = [
    'private spawnSurvivalWeaponMuzzleFx(',
    'private spawnSurvivalWeaponTrail(',
    'private spawnCompactImpact(',
    'private spawnDust(',
    'private spawnParticleRing(',
    'private spawnExplosionParticles(',
  ];
  for (const name of methods) {
    const start = game.indexOf(name);
    assert.ok(start >= 0, 'missing emitter ' + name);
    const end = game.indexOf('\n  private ', start + name.length);
    const method = game.slice(start, end > start ? end : game.length);
    assert.doesNotMatch(method, /new THREE\.Vector3\(/, name + ' should use scalar motion data');
    assert.doesNotMatch(method, /this\.particles\.push\(/, name + ' should use the fixed particle state pool');
  }
  assert.match(game, /this\.particleColorScratch\.set\(color\)\.offsetHSL/);
});
