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
  assert.match(html, /aria-label="Kluska, piekielny pies">🐕‍🔥/);
  assert.match(html, /aria-label="Patelnia Wściekłej Żony">🍳/);
  assert.match(html, /Kluska Piekielna <span class="enemy-guide-title-sub">Tropiciel B4<\/span>/);
  assert.match(html, /Wściekła Żona <span class="enemy-guide-title-sub">Patelniowa Egzekutorka<\/span>/);
  assert.match(html, /atakuje pyskiem/);
  assert.match(html, /0,34 s/);
  assert.match(html, /0,18 s/);
  assert.match(html, /0,72 s/);
  assert.match(html, /0,42 s/);
  assert.match(html, /0,98 m/);
  assert.match(html, /odkurzacz na plecach/);
  assert.match(html, /Kobaltowy sweter/);
  assert.match(html, /unik w bok/);
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
  assert.ok(model.group.getObjectByName('side_swept_fringe'));
  assert.ok(model.group.getObjectByName('pan_inner_rim'));
  assert.ok(model.group.getObjectByName('pan_rivet'));
  assert.ok(model.group.userData.vacuumNozzle);
});

test('Kluska ma detale pyska, wnętrza uszu, pazury i niezależne przeguby uszu oraz ogona', () => {
  const model = createKluskaHellhoundModel();
  assert.ok(model.group.getObjectByName('open_mouth'));
  assert.ok(model.group.getObjectByName('visible_tongue'));
  assert.ok(model.group.getObjectByName('upper_fang_-1'));
  assert.ok(model.group.getObjectByName('floppy_ear_inner'));
  assert.ok(model.group.getObjectByName('paw_claw_center'));
  assert.ok(model.group.getObjectByName('nostril_-1'));
  assert.ok(model.group.getObjectByName('tail_tip_marking'));
  assert.ok(model.group.getObjectByName('raised_back_scruff'));
  assert.ok(model.group.userData.tail);
  assert.equal(model.group.userData.ears.length, 2);
});
