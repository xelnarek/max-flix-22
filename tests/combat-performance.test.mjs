import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/characters.ts';
import { getSurvivalDifficultyProfile } from '../src/survivalDifficulty.ts';
import {
  estimatePrimaryAttackDps,
  estimatePrimaryAttackTtkSeconds,
  getBaseAttackCooldownSeconds,
  getPrimaryAttackBaseDamage,
  SURVIVAL_PRIMARY_ATTACK_DAMAGE_MULTIPLIER,
} from '../src/combatBalance.ts';

const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

test('primary attack damage profiles match the live regular/regular/finisher combo', () => {
  for (const id of ids) {
    const profile = CHARACTERS[id];
    const regular = getPrimaryAttackBaseDamage(id, false);
    const finisher = getPrimaryAttackBaseDamage(id, true);
    assert.ok(regular > 0 && finisher > regular, id + ' has a stronger third combo hit');
    assert.equal(getPrimaryAttackBaseDamage(id, true, 1), finisher + 1);
    assert.ok(estimatePrimaryAttackDps(id, profile.basicAttackDamageMultiplier, 'campaign') > 0);
    assert.ok(getBaseAttackCooldownSeconds(id, 'survival') < getBaseAttackCooldownSeconds(id, 'campaign') * 2.0);
  }
});

test('Survival primary attacks have a measurable neutral-build DPS floor without changing Campaign', () => {
  assert.equal(SURVIVAL_PRIMARY_ATTACK_DAMAGE_MULTIPLIER, 1.15);
  for (const id of ids) {
    const profile = CHARACTERS[id];
    const survivalDps = estimatePrimaryAttackDps(id, profile.basicAttackDamageMultiplier, 'survival');
    const campaignDps = estimatePrimaryAttackDps(id, profile.basicAttackDamageMultiplier, 'campaign');
    assert.ok(survivalDps >= 0.56, id + ' Survival primary DPS fell below the neutral-build floor: ' + survivalDps.toFixed(3));
    assert.ok(campaignDps > survivalDps, id + ' Campaign and Survival scaling remain distinct');
  }
  assert.ok(estimatePrimaryAttackDps('grzesiek', CHARACTERS.grzesiek.basicAttackDamageMultiplier, 'survival') > 1.1);
  assert.ok(estimatePrimaryAttackDps('piotr', CHARACTERS.piotr.basicAttackDamageMultiplier, 'survival') > 1.0);
});

test('neutral basic-attack TTK remains bounded through Survival waves 10, 20 and 30', () => {
  const waves = [10, 20, 30];
  const maxTtkByWave = { 10: 9.8, 20: 12.0, 30: 13.5 };
  for (const wave of waves) {
    const difficulty = getSurvivalDifficultyProfile(wave);
    const regularEnemyHp = Math.ceil(2 * difficulty.enemyHealthMultiplier);
    for (const id of ids) {
      const multiplier = CHARACTERS[id].basicAttackDamageMultiplier;
      const ttk = estimatePrimaryAttackTtkSeconds(regularEnemyHp, id, multiplier, 'survival');
      assert.ok(ttk <= maxTtkByWave[wave],
        id + ' TTK exceeded the wave ' + wave + ' baseline: ' + ttk.toFixed(2) + ' s');
    }
  }
});
