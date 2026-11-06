import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readSurvivalMapPreference,
  writeSurvivalMapPreference,
  SURVIVAL_MAP_PREFERENCE_KEY,
} from '../src/survivalMapPreference.ts';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    value(key) { return values.get(key) ?? null; },
  };
}

test('a selected arena survives a menu reload', () => {
  const storage = createStorage();
  assert.equal(writeSurvivalMapPreference(storage, 'cold_storage'), true);
  assert.equal(storage.value(SURVIVAL_MAP_PREFERENCE_KEY), 'cold_storage');
  assert.equal(readSurvivalMapPreference(storage), 'cold_storage');
});

test('random rotation is a deliberate saved preference and remains the default', () => {
  const storage = createStorage();
  assert.equal(readSurvivalMapPreference(storage), null);
  assert.equal(writeSurvivalMapPreference(storage, null), true);
  assert.equal(storage.value(SURVIVAL_MAP_PREFERENCE_KEY), 'random');
  assert.equal(readSurvivalMapPreference(storage), null);
});

test('stale values and storage failures safely fall back to random', () => {
  const stale = createStorage({ [SURVIVAL_MAP_PREFERENCE_KEY]: 'removed_map_v9' });
  assert.equal(readSurvivalMapPreference(stale), null);
  const failing = {
    getItem() { throw new Error('storage blocked'); },
    setItem() { throw new Error('storage blocked'); },
  };
  assert.equal(readSurvivalMapPreference(failing), null);
  assert.equal(writeSurvivalMapPreference(failing, 'warehouse_b4'), false);
});
