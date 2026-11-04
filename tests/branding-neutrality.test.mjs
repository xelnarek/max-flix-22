import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('public game identity uses the neutral Operacja B4 title', async () => {
  const [html, app, intro, metadata] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/cinematicIntro.ts'),
    read('../metadata.json'),
  ]);

  assert.match(html, /<title>Operacja B4: Strefa Chaosu<\/title>/);
  assert.match(html, /OPERACJA B4 <span>STREFA<\/span><em>CHAOSU<\/em>/);
  assert.match(app, /setAppTitle\('Operacja B4: Strefa Chaosu'\)/);
  assert.match(intro, /<h1>OPERACJA B4<\/h1>/);
  assert.match(intro, /STREFA <span>CHAOSU<\/span>/);
  assert.match(metadata, /"name": "Operacja B4: Strefa Chaosu"/);
});

test('operator cards use fictional call signs while retaining stable internal IDs', async () => {
  const [characters, html, app] = await Promise.all([
    read('../src/characters.ts'),
    read('../index.html'),
    read('../src/index.ts'),
  ]);
  const roster = [
    ['marcin', 'Atlas'],
    ['grzesiek', 'Forge'],
    ['dawid', 'Vector'],
    ['mateusz', 'Volt'],
    ['piotr', 'Rook'],
  ];

  for (const [id, callSign] of roster) {
    assert.match(characters, new RegExp(id + ': \\{[\\s\\S]*?name: \' ' + callSign + '\''));
    assert.ok(html.includes('data-char="' + id + '"'), 'stable character ID was changed: ' + id);
  }

  assert.match(app, /Atlas: 'marcin'.*Forge: 'grzesiek'.*Vector: 'dawid'.*Volt: 'mateusz'.*Rook: 'piotr'/);
  // Old leaderboard hero labels remain readable for historical entries.
  assert.match(app, /Marcin: 'marcin'.*Grzesiek: 'grzesiek'.*Dawid: 'dawid'.*Mateusz: 'mateusz'.*Piotr: 'piotr'/);
});

test('old company and personal names are absent from the public title and intro copy', async () => {
  const [html, intro, characters] = await Promise.all([
    read('../index.html'),
    read('../src/cinematicIntro.ts'),
    read('../src/characters.ts'),
  ]);
  const publicHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\s(?:id|class|data-[\w:-]+|aria-[\w:-]+|title)="[^"]*"/gi, '');

  assert.doesNotMatch(publicHtml, /Max-Flix|Max-Fliz|Palczak|Kuleto|Walczak|Króla-Leto|Inspektor Zmiany Kraków|DPD|Johnny Walker|World of Tanks|Netflix|PlayStation|Dark Souls|Elden Ring/i);
  assert.doesNotMatch(intro, /Max-Flix|Max-Fliz|Palczak|Kuleto|Walczak/i);
  assert.doesNotMatch(characters, /name: '(?:Marcin|Grzesiek|Dawid|Mateusz|Piotr)'/);
});
