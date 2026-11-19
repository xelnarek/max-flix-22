import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const art = await readFile(new URL('../src/menu-art-direction-v3.css', import.meta.url), 'utf8');

test('Warehouse MaDDnes arcade art direction is the final menu palette layer', () => {
  const noir = html.indexOf('/src/industrial-noir-menu.css');
  const responsive = html.indexOf('/src/menu-acceptance-polish.css');
  const arcade = html.indexOf('/src/menu-art-direction-v3.css');
  assert.ok(noir >= 0 && responsive > noir && arcade > responsive);
  assert.equal(html.split('/src/menu-art-direction-v3.css').length - 1, 1);
  assert.doesNotMatch(html, /industrial-noir-menu\.css" \/>\\\\n/);
  assert.match(art, /--menu-teal: #53d5c4/);
  assert.match(art, /--menu-gold: #ffc66e/);
  for (const mode of ['survival', 'campaign', 'pvp']) {
    assert.match(art, new RegExp('data-mode="' + mode + '"'));
  }
});
