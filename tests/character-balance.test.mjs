import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/characters.ts';
import { resolveCharacterIncomingDamage, scaleCharacterBasicAttackDamage } from '../src/characterBalance.ts';

test('all five operators have deliberately different movement, jump, attack and HP profiles', () => {
  assert.deepEqual(Object.keys(CHARACTERS), ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']);
  assert.equal(CHARACTERS.marcin.maxHp, 5, 'Marcin is the durable front-line operator');
  assert.equal(CHARACTERS.grzesiek.maxHp, 4);
  assert.equal(CHARACTERS.dawid.maxHp, 4);
  assert.equal(CHARACTERS.mateusz.maxHp, 3, 'Mateusz trades health for mobility');
  assert.equal(CHARACTERS.piotr.maxHp, 4);
  assert.ok(CHARACTERS.mateusz.speed > CHARACTERS.marcin.speed);
  assert.ok(CHARACTERS.dawid.jumpForce > CHARACTERS.grzesiek.jumpForce);
  assert.ok(CHARACTERS.grzesiek.basicAttackDamageMultiplier > CHARACTERS.mateusz.basicAttackDamageMultiplier);
  assert.ok(CHARACTERS.marcin.damageTakenMultiplier < CHARACTERS.mateusz.damageTakenMultiplier);
  for (const character of Object.values(CHARACTERS)) {
    assert.ok(character.speed >= 6 && character.speed <= 10);
    assert.ok(character.jumpForce >= 7 && character.jumpForce <= 11);
    assert.ok(character.maxHp >= 3 && character.maxHp <= 5);
    assert.ok(character.basicAttackDamageMultiplier >= 0.8 && character.basicAttackDamageMultiplier <= 1.3);
    assert.ok(character.damageTakenMultiplier >= 0.8 && character.damageTakenMultiplier <= 1.1);
  }
});

test('primary attack power is character-specific and preserves readable tenths of HP', () => {
  assert.equal(scaleCharacterBasicAttackDamage(2, CHARACTERS.grzesiek.basicAttackDamageMultiplier), 2.6);
  assert.equal(scaleCharacterBasicAttackDamage(2, CHARACTERS.mateusz.basicAttackDamageMultiplier), 1.8);
  assert.equal(scaleCharacterBasicAttackDamage(0, 1.2), 0);
  assert.equal(scaleCharacterBasicAttackDamage(Number.NaN, 1.2), 0);
});

test('damage mitigation keeps HP integral and applies armour over repeated hits deterministically', () => {
  let remainder = 0;
  let totalDamage = 0;
  for (let hit = 0; hit < 5; hit++) {
    const result = resolveCharacterIncomingDamage(1, CHARACTERS.marcin.damageTakenMultiplier, remainder);
    assert.ok(Number.isInteger(result.damage));
    totalDamage += result.damage;
    remainder = result.remainder;
  }
  assert.equal(totalDamage, 4, 'Marcin absorbs one point across five one-damage hits');
  assert.ok(remainder > 0 && remainder < 1);

  const lightArmour = resolveCharacterIncomingDamage(1, CHARACTERS.mateusz.damageTakenMultiplier, 0);
  assert.equal(lightArmour.damage, 1);
  assert.ok(lightArmour.remainder > 0);
});

test('engine resets HP from the selected operator and applies class tuning only to basic attacks', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(game, /this\.maxHp = this\.charDef\.maxHp/);
  assert.match(game, /this\.charDef\.damageTakenMultiplier/);
  assert.match(game, /projectileDamageSource === 'basic_attack'[\s\S]*?this\.charDef\.basicAttackDamageMultiplier/);
  assert.match(game, /resolveCharacterIncomingDamage\(/);
  assert.match(app, /def\.maxHp/);
  assert.match(app, /def\.jumpForce\.toFixed\(1\)/);
  assert.match(html, /id="stat-bar-health"/);
  assert.match(html, /PUNKTY ŻYCIA/);
});
