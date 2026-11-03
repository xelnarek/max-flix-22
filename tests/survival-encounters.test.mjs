import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSpawnBosmanKrakow } from '../src/survivalEncounters.ts';

test('Bosman Krakow only enters Survival from wave six and at its rare spawn roll', () => {
  assert.equal(shouldSpawnBosmanKrakow(5, 0.001, false), false);
  assert.equal(shouldSpawnBosmanKrakow(6, 0.001, false), true);
  assert.equal(shouldSpawnBosmanKrakow(12, 0.039999, false), true);
  assert.equal(shouldSpawnBosmanKrakow(12, 0.04, false), false);
  assert.equal(shouldSpawnBosmanKrakow(12, 0.7, false), false);
});

test('Bosman Krakow cannot spawn while another Bosman remains active', () => {
  assert.equal(shouldSpawnBosmanKrakow(6, 0.001, true), false);
  assert.equal(shouldSpawnBosmanKrakow(20, 0.02, true), false);
  assert.equal(shouldSpawnBosmanKrakow(20, 0.02, false), true);
});

test('Bosman spawn guard rejects invalid wave and random values', () => {
  assert.equal(shouldSpawnBosmanKrakow(Number.NaN, 0.01, false), false);
  assert.equal(shouldSpawnBosmanKrakow(6, Number.NaN, false), false);
  assert.equal(shouldSpawnBosmanKrakow(6, -0.01, false), false);
});
