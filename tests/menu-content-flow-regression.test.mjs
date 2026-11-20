import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/menu-final-tuning.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('active menu content is anchored to the top instead of being vertically distributed', () => {
  assert.match(css, /\.menu-tab-content-area > \.tab-panel\.active\s*\{[\s\S]*?justify-content:\s*flex-start\s*!important/);
  assert.match(css, /#title-screen #tab-map\s*\{[\s\S]*?min-height:\s*max-content\s*!important/);
  assert.match(css, /#title-screen #tab-map > \.campaign-board\s*\{[\s\S]*?margin-block:\s*0\s*!important/);
});

test('campaign content remains present and attached to its single active menu panel', () => {
  assert.match(html, /id="tab-map"[^>]*class="[^"]*tab-panel/);
  assert.match(html, /class="campaign-board"[^>]*aria-labelledby="campaign-board-title"/);
  assert.match(html, /id="campaign-board-title">KAMPANIA ZMIAN</);
});
