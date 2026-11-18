import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('all five character abilities use the randomized shout dispatcher instead of one fixed line', async () => {
  const [game, shouts] = await Promise.all([
    read('../src/game.ts'), read('../src/characterAbilityShouts.ts')
  ]);
  assert.match(game, /private sayAbilityShout\(\): void/);
  assert.match(game, /selectCharacterAbilityShout\(\s*characterId,\s*Math\.random\(\),\s*this\.lastAbilityShoutIndexes\.get\(characterId\)/);
  assert.match(game, /this\.sayAbilityShout\(\);[\s\S]*?this\.specialSwingTimer = 0\.86 \\* abilityDurationScale/);
  for (const id of ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']) {
    assert.match(shouts, new RegExp('^  ' + id + ': \\[', 'm'));
  }
  for (const oldLine of [
    'KONWÓJ WZ-404! DO BOJU! To nie jest samouczek',
    '44 CM ZAGŁADY! PIĘŚĆ WCHODZI',
    'JA WIEM LEPIEJ! Salwa 5 płyt',
    'MULTIWERŚUM, ZBIÓRKA! Pięciu bohaterów',
    'RYTUAŁ MAFIKAPIBAR! Pentagram B4 otwiera',
  ]) assert.ok(!game.includes(oldLine), 'fixed ability shout remains in engine: ' + oldLine);
});

test('PvP only announces an ability request when the local ability is ready', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const local = this\.pvpSlot === 'p1'[\s\S]*?this\.lastPvpState\?\.p1[\s\S]*?this\.lastPvpState\?\.p2/);
  assert.match(game, /if \(!this\.pvpWantAbility && local && local\.abilityCooldownTimer <= 0\.0001\)\s*\{\s*this\.sayAbilityShout\(\);/);
});
