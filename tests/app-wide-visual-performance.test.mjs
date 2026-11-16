import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getCampaignLightingProfile,
  PVP_LIGHTING_PROFILE,
} from '../src/worldVisualQuality.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('one font stylesheet is loaded and the shared polish layer is the final CSS owner', async () => {
  const [html, baseCss] = await Promise.all([read('../index.html'), read('../src/index.css')]);
  assert.equal((html.match(/fonts\.googleapis\.com\/css2/g) || []).length, 1);
  assert.doesNotMatch(baseCss, /^@import\s+url\([^\n]*fonts\.googleapis\.com/m);
  const previous = html.indexOf('/src/pvp-reconnect-overlay.css');
  const finalLayer = html.indexOf('/src/app-wide-polish.css');
  assert.ok(previous >= 0 && finalLayer > previous, 'app-wide polish must load after the existing UI layers');
});

test('shared tokens use a muted industrial palette with semantic status colours', async () => {
  const tokens = await read('../src/design-tokens.css');
  const polish = await read('../src/app-wide-polish.css');
  for (const token of ['--mf-bg:', '--mf-surface:', '--mf-text:', '--mf-amber:', '--mf-cyan:', '--mf-green:', '--mf-red:']) {
    assert.ok(tokens.includes(token), 'missing shared palette token ' + token);
  }
  assert.ok(polish.includes('--status-success: var(--mf-green)'));
  assert.ok(polish.includes('--status-danger: var(--mf-red)'));
  assert.ok(polish.includes('.btn-primary-start'));
  assert.ok(polish.includes('#pvp-hud .pvp-player-box'));
  assert.ok(polish.includes('#survival-hud .survival-chip'));
});

test('mobile UI avoids repeated backdrop-filter compositing and respects reduced motion', async () => {
  const polish = await read('../src/app-wide-polish.css');
  assert.ok(polish.includes('@media (max-width: 900px), (pointer: coarse)'));
  assert.ok(polish.includes('backdrop-filter: none !important'));
  assert.ok(polish.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(polish.includes('transition-duration: .01ms'));
});

test('Campaign and PvP lighting stay inside a calmer exposure range', () => {
  for (const sector of [1, 2, 3, 4]) {
    const profile = getCampaignLightingProfile(sector);
    assert.ok(profile.exposure <= 1.02, 'Campaign sector ' + sector + ' is overexposed');
    assert.ok(profile.directionalIntensity <= 2.6, 'Campaign sector ' + sector + ' uses excessive key light');
    assert.ok(profile.hemisphereIntensity <= 1.32, 'Campaign sector ' + sector + ' has excessive fill light');
  }
  assert.ok(PVP_LIGHTING_PROFILE.exposure <= 1.02);
  assert.ok(PVP_LIGHTING_PROFILE.directionalIntensity >= 2.4 && PVP_LIGHTING_PROFILE.directionalIntensity <= 2.6);
  assert.ok(PVP_LIGHTING_PROFILE.rimIntensity < 1.5);
});
