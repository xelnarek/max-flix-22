import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('public identity and operator labels are generic and contain no Max-Flix references', async () => {
  const [html, app, intro, characters, metadata, assets] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/cinematicIntro.ts'),
    read('../src/characters.ts'),
    read('../metadata.json'),
    read('../src/assets.ts'),
  ]);
  assert.match(html, /<title>Paleciaki! Magazyn Chaosu<\\/title>/);
  assert.match(html, /SURVIVAL • FALE • HORDY I EWOLUCJE/);
  assert.match(metadata, /"name": "Paleciaki! Magazyn Chaosu"/);
  assert.doesNotMatch([html, app, intro, characters, assets].join('\\n'), /Max-Flix|Max-Fliz|Palczak|Kuleto|Walczak|Króla-Leto|Zdzich|\\bAtlas\\b|\\bForge\\b|\\bVector\\b|\\bVolt\\b|\\bRook\\b|\\bMarcin\\b|\\bGrzesiek\\b|\\bDawid\\b|\\bMateusz\\b|\\bPiotr\\b/i);
  assert.match(characters, /name: 'Operator 01'/);
  assert.match(characters, /name: 'Operator 05'/);
});

test('the public UI exposes Survival only', async () => {
  const html = await read('../index.html');
  assert.match(html, /id="btn-start-survival"/);
  assert.doesNotMatch(html, /id="btn-start-game"|data-tab="tab-zones"|data-tab="tab-story"|id="story-intro-modal"|KAMPANIA|kampania/i);
  assert.match(html, /RANKING GLOBALNY • SURVIVAL/);
  assert.doesNotMatch(html, /RANKING GLOBALNY • .*KAMPANIA/i);
});
