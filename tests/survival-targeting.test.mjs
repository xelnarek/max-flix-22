import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSurvivalAutoTarget } from '../src/survivalTargeting.ts';

const candidate = (id, type, x, extra = {}) => ({
  id, type, x, z: 0, state: 'chase', mesh: { visible: true }, ...extra
});

test('auto target favours a nearby boss over an ordinary enemy at comparable distance', () => {
  const grunt = candidate('grunt', 'customer', 8);
  const boss = candidate('boss', 'walczak', 9);
  const result = selectSurvivalAutoTarget([grunt, boss], 0, 0, 18);
  assert.equal(result?.target.id, 'boss');
  assert.equal(result?.distance, 9);
});

test('a nearby immediate threat still beats a much more distant boss', () => {
  const grunt = candidate('grunt', 'customer', 2);
  const boss = candidate('boss', 'walczak', 17);
  const result = selectSurvivalAutoTarget([boss, grunt], 0, 0, 18);
  assert.equal(result?.target.id, 'grunt');
});

test('charging threats and elites receive a bounded tactical priority', () => {
  const ordinary = candidate('ordinary', 'customer', 7);
  const charging = candidate('charging', 'customer', 8, { chargeTimer: 0.4 });
  const result = selectSurvivalAutoTarget([ordinary, charging], 0, 0, 18);
  assert.equal(result?.target.id, 'charging');

  const elite = candidate('elite', 'elite_walczak_guard', 9);
  const similarGrunt = candidate('grunt', 'customer', 8);
  assert.equal(selectSurvivalAutoTarget([similarGrunt, elite], 0, 0, 18)?.target.id, 'elite');
});

test('hidden, defeated, invalid and out-of-range enemies are ignored', () => {
  const candidates = [
    candidate('hidden', 'walczak', 1, { mesh: { visible: false } }),
    candidate('dead', 'walczak', 1, { state: 'defeated' }),
    candidate('bad', 'walczak', Number.NaN),
    candidate('far', 'walczak', 30),
  ];
  assert.equal(selectSurvivalAutoTarget(candidates, 0, 0, 18), null);
  assert.equal(selectSurvivalAutoTarget([candidate('grunt', 'customer', 1)], Number.NaN, 0, 18), null);
});
