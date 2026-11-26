import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createKluskaHellhoundModel, createWkurzonaZonaModel } from '../src/customEnemyModels.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Wściekła Żona i Kluska są obecne w kompletnym Bestiariuszu', async () => {
  const [html, css, profiles] = await Promise.all([
    read('../index.html'),
    read('../src/enemy-bestiary-polish.css'),
    import('../src/enemyVisualProfiles.ts'),
  ]);

  assert.equal((html.match(/<article class="enemy-guide-card/g) || []).length, 25);
  assert.match(html, /<span>25<\/span> TYPÓW/);
  assert.match(html, /data-enemy-type="kluska_piekielna"/);
  assert.match(html, /data-enemy-type="wkurzona_zona"/);
  assert.match(html, /aria-label="Kluska, piekielny pies">🐕‍🔥/);
  assert.match(html, /aria-label="Patelnia Wściekłej Żony">🍳/);
  assert.match(html, /Kluska Piekielna — Tropiciel B4/);
  assert.match(html, /Wściekła Żona — Patelniowa Egzekutorka/);
  assert.match(html, /atakuje pyskiem/);
  assert.match(html, /0,34 s/);
  assert.match(html, /0,18 s/);
  assert.match(html, /0,72 s/);
  assert.match(html, /0,42 s/);
  assert.match(html, /0,98 m/);
  assert.match(html, /odkurzacz z widocznym wężem na plecach/);
  assert.match(html, /Kobaltowy sweter/);
  assert.match(html, /unik w bok/);
  assert.match(css, /enemy-guide-card--kluska/);
  assert.match(css, /enemy-guide-card--zona/);
  assert.match(css, /enemy-guide-tactic/);
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
