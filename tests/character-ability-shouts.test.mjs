import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARACTER_ABILITY_SHOUTS, selectCharacterAbilityShout } from '../src/characterAbilityShouts.ts';

const characterIds = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

test('every operator has four distinct, role-specific ability shout variations', () => {
  for (const id of characterIds) {
    const lines = CHARACTER_ABILITY_SHOUTS[id];
    assert.equal(lines.length, 4, id + ' should have four skill callouts');
    assert.equal(new Set(lines).size, lines.length, id + ' must not repeat lines');
    assert.ok(lines.every((line) => line.length >= 12 && line.length <= 90));
  }
  assert.match(CHARACTER_ABILITY_SHOUTS.marcin.join(' '), /WZ-404|ERP|Kierownik/);
  assert.match(CHARACTER_ABILITY_SHOUTS.grzesiek.join(' '), /pięści|ramię|biceps/i);
  assert.match(CHARACTER_ABILITY_SHOUTS.dawid.join(' '), /Gres|Marmur|salwa/i);
  assert.match(CHARACTER_ABILITY_SHOUTS.mateusz.join(' '), /Multiwersum|bohaterów|Avengers/i);
  assert.match(CHARACTER_ABILITY_SHOUTS.piotr.join(' '), /B4|Kapibary|Rodzina/i);
});

test('selection is deterministic at weighted boundaries and never repeats the previous line', () => {
  const first = selectCharacterAbilityShout('marcin', 0);
  assert.equal(first.index, 0);
  assert.equal(first.text, CHARACTER_ABILITY_SHOUTS.marcin[0]);

  const second = selectCharacterAbilityShout('marcin', 0, first.index);
  assert.equal(second.index, 1);
  assert.notEqual(second.text, first.text);

  const last = selectCharacterAbilityShout('piotr', 1);
  assert.equal(last.index, 3);
});

test('invalid random values resolve safely and keep a valid shout', () => {
  for (const roll of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -100, 100]) {
    const selected = selectCharacterAbilityShout('mateusz', roll);
    assert.ok(selected.index >= 0 && selected.index < 4);
    assert.ok(CHARACTER_ABILITY_SHOUTS.mateusz.includes(selected.text));
  }
});
