import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/crimson-shift-responsive-v2.css', import.meta.url), 'utf8');

test('Crimson Shift responsive v2 loads after the visual theme', () => {
  const theme = html.indexOf('/src/crimson-shift-menu.css');
  const responsive = html.indexOf('/src/crimson-shift-responsive-v2.css');
  assert.ok(theme >= 0 && responsive > theme, 'responsive geometry must load after Crimson Shift theme');
});

test('menu keeps the three main actions and all eleven destinations', () => {
  for (const id of ['btn-start-survival', 'btn-open-campaign', 'btn-open-pvp']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing mode action ' + id);
  }
  for (const id of ['tab-team', 'tab-map', 'tab-pvp', 'tab-enemies', 'tab-perks', 'tab-field-guide', 'tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements', 'tab-settings']) {
    assert.ok(html.includes('id="' + id + '"') || html.includes('data-tab="' + id + '"'), 'missing menu destination ' + id);
  }
});

test('responsive geometry covers desktop, tablet, phone, narrow and short landscape viewports', () => {
  for (const query of [
    '@media (max-width: 1100px)',
    '@media (max-width: 760px)',
    '@media (max-width: 380px)',
    '@media (max-height: 760px)',
    '@media (max-height: 560px)',
    '@media (max-height: 560px) and (orientation: landscape) and (pointer: coarse)',
    '@media (prefers-reduced-motion: reduce)',
  ]) assert.ok(css.includes(query), 'missing responsive rule ' + query);
  assert.ok(css.includes('100dvh'), 'must use dynamic viewport height');
  assert.ok(css.includes('env(safe-area-inset-bottom'), 'must respect mobile safe areas');
  assert.ok(css.includes('minmax(0, 1fr)'), 'grid must be allowed to shrink without overflow');
});

test('responsive scaling does not use transform or zoom hacks', () => {
  assert.ok(!/\bzoom\s*:/.test(css), 'do not scale the UI using CSS zoom');
  assert.ok(!/transform\s*:\s*scale\(/.test(css), 'do not scale the UI with transforms');
  assert.ok(css.includes('min-height: 0'), 'flex and grid children must be allowed to shrink');
  assert.ok(css.includes('min-width: 0'), 'content must be allowed to shrink horizontally');
});

test('touch navigation keeps minimum 44px targets and scrolls independently from content', () => {
  assert.ok(css.includes('min-height: 44px'), 'navigation targets should remain touch friendly');
  assert.ok(css.includes('overflow-x: auto'), 'navigation rail must scroll horizontally on compact screens');
  assert.ok(css.includes('overscroll-behavior: contain'), 'panel scrolling should not chain to the page');
});
