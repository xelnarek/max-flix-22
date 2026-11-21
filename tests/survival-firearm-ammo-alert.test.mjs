import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getSurvivalFirearmAmmoAlert } from '../src/survivalFirearms.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('shared magazine thresholds distinguish safe, low, critical and empty states', () => {
  assert.equal(getSurvivalFirearmAmmoAlert(12, 12), 'ready');
  assert.equal(getSurvivalFirearmAmmoAlert(4, 12), 'ready');
  assert.equal(getSurvivalFirearmAmmoAlert(3, 12), 'low');
  assert.equal(getSurvivalFirearmAmmoAlert(1, 12), 'critical');
  assert.equal(getSurvivalFirearmAmmoAlert(0, 12), 'empty');
});

test('small magazines keep useful warning bands instead of losing their final-round warning', () => {
  assert.equal(getSurvivalFirearmAmmoAlert(3, 4), 'ready');
  assert.equal(getSurvivalFirearmAmmoAlert(2, 4), 'low');
  assert.equal(getSurvivalFirearmAmmoAlert(1, 4), 'critical');
  assert.equal(getSurvivalFirearmAmmoAlert(0, 4), 'empty');
});

test('large magazines warn at the final quarter and critical at the final ten percent', () => {
  assert.equal(getSurvivalFirearmAmmoAlert(16, 60), 'ready');
  assert.equal(getSurvivalFirearmAmmoAlert(15, 60), 'low');
  assert.equal(getSurvivalFirearmAmmoAlert(6, 60), 'critical');
  assert.equal(getSurvivalFirearmAmmoAlert(0, 60), 'empty');
});

test('ammo alert helper clamps invalid and out-of-range inputs safely', () => {
  assert.equal(getSurvivalFirearmAmmoAlert(-4, 12), 'empty');
  assert.equal(getSurvivalFirearmAmmoAlert(999, 12), 'ready');
  assert.equal(getSurvivalFirearmAmmoAlert(Number.NaN, 12), 'empty');
  assert.equal(getSurvivalFirearmAmmoAlert(1, 0), 'critical');
});

test('both PvE and PvP HUDs use the shared warning helper and expose visible alert states', async () => {
  const [app, survivalCss, pvpCss] = await Promise.all([
    read('../src/index.ts'),
    read('../src/hud-layout.css'),
    read('../src/index.css'),
  ]);
  assert.match(app, /getSurvivalFirearmAmmoAlert\(primaryFirearm\.ammoInMagazine, primaryFirearm\.magazineSize\)/);
  assert.match(app, /getSurvivalFirearmAmmoAlert\(primaryAmmo, primaryDefinition\.magazineSize\)/);
  for (const state of ['is-low-ammo', 'is-critical-ammo', 'is-empty-ammo']) {
    assert.ok(app.includes(state), 'missing HUD state: ' + state);
    assert.ok(survivalCss.includes(state), 'missing Survival/Campaign style: ' + state);
    assert.ok(pvpCss.includes(state), 'missing PvP style: ' + state);
  }
  assert.match(app, /MAŁO AMUNICJI/);
  assert.match(app, /KOŃCÓWKA MAGAZYNKA/);
});
