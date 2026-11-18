import test from 'node:test';
import assert from 'node:assert/strict';
import { MATEUSZ_RIVAL_ROSTER, getMateuszRivalSpawnOffset } from '../src/mateuszRivals.ts';

test('Mateusz calls five distinct Marvel/DC heroes with no borrowed enemy rigs', () => {
  assert.equal(MATEUSZ_RIVAL_ROSTER.length, 5);
  assert.deepEqual(MATEUSZ_RIVAL_ROSTER.map(hero => hero.name), [
    'Iron Man', 'Hulk', 'Spider-Man', 'Storm', 'Batman',
  ]);
  assert.equal(MATEUSZ_RIVAL_ROSTER.filter(hero => hero.universe === 'MARVEL').length, 4);
  assert.equal(MATEUSZ_RIVAL_ROSTER.filter(hero => hero.universe === 'DC').length, 1);
  assert.equal(new Set(MATEUSZ_RIVAL_ROSTER.map(hero => hero.id)).size, 5);
  assert.equal(new Set(MATEUSZ_RIVAL_ROSTER.map(hero => hero.style)).size, 5);
});

test('all five hero profiles have valid, deliberately different combat tuning', () => {
  for (const hero of MATEUSZ_RIVAL_ROSTER) {
    assert.ok(hero.preferredRangeMeters >= 1.5 && hero.preferredRangeMeters <= 9);
    assert.ok(hero.attackRangeMeters >= hero.preferredRangeMeters);
    assert.ok(hero.moveSpeed >= 7 && hero.moveSpeed <= 11);
    assert.ok(hero.attackCooldownSeconds >= 0.6 && hero.attackCooldownSeconds <= 1.2);
    assert.ok(hero.damage >= 4 && hero.damage <= 9);
    assert.ok(hero.stunSeconds >= 0.2 && hero.stunSeconds <= 0.9);
  }
  assert.ok(MATEUSZ_RIVAL_ROSTER.find(hero => hero.id === 'hulk').damage >
    MATEUSZ_RIVAL_ROSTER.find(hero => hero.id === 'spider-man').damage);
  assert.ok(MATEUSZ_RIVAL_ROSTER.find(hero => hero.id === 'spider-man').moveSpeed >
    MATEUSZ_RIVAL_ROSTER.find(hero => hero.id === 'hulk').moveSpeed);
});

test('five allies spawn in a stable non-orbiting formation around Mateusz', () => {
  const offsets = MATEUSZ_RIVAL_ROSTER.map((_, index) => getMateuszRivalSpawnOffset(index));
  assert.equal(new Set(offsets.map(offset => offset.x + ':' + offset.z)).size, 5);
  assert.deepEqual(getMateuszRivalSpawnOffset(0), { x: -2.4, z: 2.2 });
  assert.deepEqual(getMateuszRivalSpawnOffset(4), { x: 0, z: 4.1 });
  assert.deepEqual(getMateuszRivalSpawnOffset(5), getMateuszRivalSpawnOffset(0));
});
