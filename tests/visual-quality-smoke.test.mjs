import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('game identity is consistently renamed in the title screen and engine boot', async () => {
  const [html, app] = await Promise.all([read('../index.html'), read('../src/index.ts')]);
  assert.match(html, /<title>Max-FliX i granica Absurdu<\/title>/);
  assert.match(html, /MAX-FLIX[\s\S]*granica[\s\S]*Absurdu/);
  assert.match(app, /setAppTitle\('Max-FliX i granica Absurdu'\)/);
});

test('the five playable operator cards retain five bespoke SVG emblems', async () => {
  const html = await read('../index.html');
  const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];
  for (const id of ids) {
    assert.match(html, new RegExp('data-char="' + id + '"[\\s\\S]*?operator-emblem emblem-' + id));
  }
  const app = await read('../src/index.ts');
  assert.doesNotMatch(app, /badge\.innerHTML = operatorPortrait\(cardId\)/);
});

test('playable operator face model no longer creates moustache meshes over the face', async () => {
  const source = await read('../src/warehouseAssets.ts');
  assert.doesNotMatch(source, /moustacheLeft|moustacheRight/);
  assert.match(source, /beard\.position\.set\(0, 0\.805, 0\.058\)/);
});

test('the title easter egg requires a three-click sequence and includes a dismissible dialog', async () => {
  const [html, app] = await Promise.all([read('../index.html'), read('../src/index.ts')]);
  assert.match(html, /id="capybara-mafia-easter-egg"/);
  assert.match(html, /DON KAPIBARA/);
  assert.match(html, /CAPO KREMÓWKA/);
  assert.match(html, /WUJEK CHRUP/);
  assert.match(app, /new ThreeClickTrigger\(2400, 3\)/);
  assert.match(app, /data-capybara-close/);
});

test('codex contains the previously missing enemy families', async () => {
  const html = await read('../index.html');
  for (const name of ['Wózek Widłowy', 'Robot AGV', 'Przedstawiciel Włoski', 'Zdzichu', 'Pomazaniec', 'Sebix M.']) {
    assert.ok(html.includes(name), 'missing codex entry: ' + name);
  }
});

test('all five character bios have expanded beyond the short menu summary', async () => {
  const source = await read('../src/characters.ts');
  const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];
  for (const id of ids) {
    const start = source.indexOf('  ' + id + ': {');
    const next = source.indexOf('\n  },', start + 4);
    const block = source.slice(start, next === -1 ? source.length : next);
    const bio = block.match(/bio: '([^']+)'/);
    assert.ok(bio, 'missing bio for ' + id);
    assert.ok(bio[1].length > 260, 'bio not sufficiently expanded for ' + id);
  }
});


test('warehouse map textures keep bounded high-detail anisotropic filtering on mobile and desktop', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const targetAnisotropy = Math.max\(1, Math.min\(maxAnisotropy, isMobile \? 10 : 16\)\)/);
  assert.match(game, /this\.levelRoot\.traverse\(\(object\) =>/);
  assert.match(game, /texture\.anisotropy = targetAnisotropy/);
  assert.match(game, /texture\.needsUpdate = true/);
});


test('enemy model accents use smoother curves without adding draw-call objects', async () => {
  const game = await read('../src/game.ts');
  const polishStart = game.indexOf('private applyEnemyVisualPolish(enemy: EnemyItem)');
  const polishEnd = game.indexOf('private applyStorybookStyle(root: THREE.Object3D)', polishStart);
  assert.ok(polishStart >= 0 && polishEnd > polishStart, 'enemy visual polish method should exist');
  const polish = game.slice(polishStart, polishEnd);
  assert.match(polish, /new THREE\.SphereGeometry\(0\.13 \* scale, 14, 10\)/);
  assert.match(polish, /new THREE\.SphereGeometry\(0\.13 \* scale, 18, 12\)/);
  assert.match(polish, /new THREE\.SphereGeometry\(0\.18 \* scale, 16, 12\)/);
  assert.match(polish, /without adding extra objects or draw calls/);
});


test('playable operator models use refined curved surfaces at close camera range', async () => {
  const source = await read('../src/warehouseAssets.ts');
  const start = source.indexOf('export function createCharacterModel(def: CharacterDef)');
  const end = source.indexOf('\\nexport function ', start + 10);
  assert.ok(start >= 0 && end > start, 'playable character model factory should exist');
  const model = source.slice(start, end);
  assert.match(model, /new THREE\.SphereGeometry\(0\.145, 20, 14\)/);
  assert.match(model, /new THREE\.CapsuleGeometry\(0\.18, 0\.10, 4, 16\)/);
  assert.match(model, /new THREE\.SphereGeometry\(0\.105, 16, 10\)/);
});
