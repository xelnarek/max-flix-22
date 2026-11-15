import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_HIT_REACTION_PROFILES, getCharacterHitReactionProfile } from '../src/characterHitReaction.ts';

const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

test('all five operators have bounded class-specific hit reaction profiles', () => {
  assert.deepEqual(Object.keys(CHARACTER_HIT_REACTION_PROFILES).sort(), [...ids].sort());
  for (const id of ids) {
    const p = getCharacterHitReactionProfile(id);
    for (const [key, value] of Object.entries(p)) {
      assert.ok(Number.isFinite(value), id + '.' + key);
    }
    assert.ok(p.durationSeconds >= 0.25 && p.durationSeconds <= 0.45);
    assert.ok(p.armRecoil >= 0.25 && p.armRecoil <= 0.65);
    assert.ok(p.armRoll >= 0 && p.armRoll <= 0.2);
    assert.ok(p.torsoPitch >= 0 && p.torsoPitch <= 0.15);
    assert.ok(p.torsoRoll >= 0 && p.torsoRoll <= 0.16);
    assert.ok(p.headSnap >= 0 && p.headSnap <= 0.12);
    assert.ok(p.toolKick >= 0 && p.toolKick <= 0.24);
  }
  assert.equal(new Set(ids.map((id) => JSON.stringify(getCharacterHitReactionProfile(id)))).size, 5);
});

test('heavy operator braces harder while the fast operator recovers quickest', () => {
  assert.ok(CHARACTER_HIT_REACTION_PROFILES.grzesiek.armRecoil >
    CHARACTER_HIT_REACTION_PROFILES.mateusz.armRecoil);
  assert.ok(CHARACTER_HIT_REACTION_PROFILES.mateusz.durationSeconds <
    CHARACTER_HIT_REACTION_PROFILES.grzesiek.durationSeconds);
  assert.ok(CHARACTER_HIT_REACTION_PROFILES.dawid.toolKick >
    CHARACTER_HIT_REACTION_PROFILES.marcin.toolKick);
});


test('the game applies the same character-specific reaction profile in campaign and PvP', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /import \{ getCharacterHitReactionProfile \} from '\.\/characterHitReaction\.ts'/);
  assert.ok((game.match(/getCharacterHitReactionProfile\(this\.currentCharacterId\)/g) || []).length >= 4);
  assert.match(game, /reaction\.headSnap \* hit/);
  assert.match(game, /reaction\.toolKick \* hit/);
  assert.match(game, /reaction\.torsoRoll \* this\.playerHitReactDirection/);
});
