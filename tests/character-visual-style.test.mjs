import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_VISUAL_STYLES, getCharacterVisualStyle } from '../src/characterVisualStyle.ts';

test('each operator has a distinct gait, stance, lean and attack animation', () => {
  const styles = Object.values(CHARACTER_VISUAL_STYLES);
  assert.equal(styles.length, 5);
  for (const key of ['gaitRate', 'strideAmplitude', 'armSwingAmplitude', 'forwardLean', 'verticalBob', 'attackArmX']) {
    assert.equal(new Set(styles.map(style => style[key])).size, 5, key + ' should differ for all five operators');
  }
  assert.ok(getCharacterVisualStyle('mateusz').gaitRate > getCharacterVisualStyle('grzesiek').gaitRate);
  assert.ok(getCharacterVisualStyle('dawid').verticalBob > getCharacterVisualStyle('marcin').verticalBob);
  assert.ok(getCharacterVisualStyle('grzesiek').forwardLean > getCharacterVisualStyle('piotr').forwardLean);
  assert.ok(getCharacterVisualStyle('mateusz').forwardLean > getCharacterVisualStyle('marcin').forwardLean);
});

test('visual motion tuning stays in safe ranges and has a deterministic fallback', () => {
  for (const style of Object.values(CHARACTER_VISUAL_STYLES)) {
    assert.ok(style.gaitRate >= 8 && style.gaitRate <= 20);
    assert.ok(style.strideAmplitude >= 0.35 && style.strideAmplitude <= 0.85);
    assert.ok(style.armSwingAmplitude >= 0.25 && style.armSwingAmplitude <= 0.8);
    assert.ok(style.forwardLean >= 0 && style.forwardLean <= 0.22);
    assert.ok(style.verticalBob >= 0 && style.verticalBob <= 0.06);
  }
  assert.equal(getCharacterVisualStyle('marcin'), CHARACTER_VISUAL_STYLES.marcin);
});

test('3D rig and menu expose a strong visual silhouette for every class', async () => {
  const { readFile } = await import('node:fs/promises');
  const assets = await readFile(new URL('../src/warehouseAssets.ts', import.meta.url), 'utf8');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(assets, /grzesiek:[\s\S]*?torsoWidth: 1\.42[\s\S]*?shoulderSize: 1\.52/);
  assert.match(assets, /slabRig[\s\S]*?slabFrame[\s\S]*?slabFace/);
  assert.match(assets, /mateusz:[\s\S]*?torsoWidth: 0\.82/);
  assert.match(assets, /characterVisualSignature = def\.id/);
  assert.match(game, /uColor: \{ value: new THREE\.Color\(\(\{ marcin: 0x60a5fa, grzesiek: 0x4ade80, dawid: 0xfb923c, mateusz: 0xe879f9, piotr: 0xef4444 \}/);
  assert.match(game, /getCharacterVisualStyle\(this\.charDef\.id\)/);
  assert.match(app, /card\.dataset\.archetype =/);
  for (const tag of ['TANK • 5 HP • PANCERZ','BRUISER • CIĘŻKI ATAK','SKOCZEK • KONTROLA','RUNNER • NAJSZYBSZY','WETERAN • PODWÓJNY SKOK']) {
    assert.ok(html.includes(tag), 'missing visible class tag: ' + tag);
  }
});
