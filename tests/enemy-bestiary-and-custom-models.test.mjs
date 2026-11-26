import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createKluskaHellhoundModel, createWkurzonaZonaModel } from '../src/customEnemyModels.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Bestiariusz zawiera obie nowe karty, właściwe ikony i komplet opisów', async () => {
  const [html, css, profiles] = await Promise.all([
    read('../index.html'),
    read('../src/enemy-bestiary-polish.css'),
    import('../src/enemyVisualProfiles.ts'),
  ]);

  assert.equal((html.match(/<div class="enemy-guide-card/g) || []).length, 22);
  assert.match(html, /<span>22<\/span> POZYCJE/);
  assert.match(html, /enemy-guide-card--kluska/);
  assert.match(html, /enemy-guide-card--zona/);
  assert.match(html, /aria-label="Pies z płomieniem">🐕‍🔥/);
  assert.match(html, /aria-label="Patelnia Wściekłej Żony">🍳/);
  assert.match(html, /Kluska Piekielna — Tropiciel B4/);
  assert.match(html, /Wściekła Żona — Patelniowa Egzekutorka/);
  assert.match(html, /szarżą i ugryzieniem/);
  assert.match(html, /odkurzaczu na plecach/);
  assert.match(html, /enemy-guide-card--kluska/);
  assert.match(css, /enemy-guide-card--kluska/);
  assert.match(css, /enemy-guide-card--zona/);
  assert.ok(profiles.ENEMY_VISUAL_PROFILES.wkurzona_zona.visualBrief.length > 80);
  assert.ok(profiles.ENEMY_VISUAL_PROFILES.kluska_piekielna.visualBrief.length > 80);
});

test('Wściekła Żona ma poprawiony detal twarzy i kompletną końcówkę odkurzacza', () => {
  const model = createWkurzonaZonaModel();
  assert.ok(model.group.getObjectByName('eye_sclera'));
  assert.ok(model.group.getObjectByName('dark_pupil'));
  assert.ok(model.group.getObjectByName('vacuum_floor_nozzle'));
  assert.ok(model.group.getObjectByName('vacuum_nozzle_head'));
  assert.ok(model.group.userData.vacuumNozzle);
});

test('Kluska ma detale pyska, wnętrza uszu, pazury i niezależne przeguby uszu oraz ogona', () => {
  const model = createKluskaHellhoundModel();
  assert.ok(model.group.getObjectByName('open_mouth'));
  assert.ok(model.group.getObjectByName('visible_tongue'));
  assert.ok(model.group.getObjectByName('upper_fang_-1'));
  assert.ok(model.group.getObjectByName('floppy_ear_inner'));
  assert.ok(model.group.getObjectByName('paw_claw_center'));
  assert.ok(model.group.userData.tail);
  assert.equal(model.group.userData.ears.length, 2);
});
