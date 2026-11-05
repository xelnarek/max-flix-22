import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('game identity is consistently renamed in the title screen and engine boot', async () => {
  const [html, app] = await Promise.all([read('../index.html'), read('../src/index.ts')]);
  assert.match(html, /<title>Paleciaki! Magazyn Chaosu<\/title>/);
  assert.match(html, /PALECIAKI![\s\S]*MAGAZYN[\s\S]*CHAOSU/);
  assert.match(app, /setAppTitle\('Paleciaki! Magazyn Chaosu'\)/);
});

test('the five playable operator cards receive individual hand-drawn vector portraits', async () => {
  const html = await read('../index.html');
  const ids = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];
  for (const id of ids) {
    assert.ok(html.includes('data-char="' + id + '"'));
    assert.ok(html.includes('operator-emblem emblem-' + id), 'missing fallback insignia for ' + id);
  }
  const app = await read('../src/index.ts');
  assert.ok(app.includes('const operatorPortrait = (id: CharacterId): string'));
  assert.ok(app.includes("const badge = card.querySelector<HTMLElement>('.operator-emblem')"));
  assert.ok(app.includes('badge.innerHTML = operatorPortrait(cardId)'));
  assert.ok(app.includes('operatorPortraitRenderCount'));
  assert.ok(app.includes('CHARACTERS[id].name'));
  for (const id of ids) assert.ok(app.includes(id + ': { skin:'), 'missing bespoke portrait design for ' + id);
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
  for (const name of ['Wózek Widłowy', 'Robot AGV', 'Przedstawiciel Włoski', 'Sztaplarz Turbo', 'Pomazaniec', 'Operator Turbo']) {
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
  const end = source.indexOf(String.fromCharCode(10) + 'export function ', start + 10);
  assert.ok(start >= 0 && end > start, 'playable character model factory should exist');
  const model = source.slice(start, end);
  assert.match(model, /new THREE\.SphereGeometry\(0\.145, 20, 14\)/);
  assert.match(model, /new THREE\.CapsuleGeometry\(0\.18, 0\.10, 4, 16\)/);
  assert.match(model, /new THREE\.SphereGeometry\(0\.105, 16, 10\)/);
});


test('main-menu navigation and the single Survival launch action use consistent inline vector icons', async () => {
  const html = await read('../index.html');
  const codexStart = html.indexOf('data-tab="tab-field-guide"');
  const settingsStart = html.indexOf('data-tab="tab-settings"');
  const survivalStart = html.indexOf('id="btn-start-survival"');
  assert.ok(codexStart >= 0 && html.slice(codexStart, codexStart + 500).includes('<svg'));
  assert.ok(settingsStart >= 0 && html.slice(settingsStart, settingsStart + 700).includes('<svg'));
  assert.ok(survivalStart >= 0 && html.slice(survivalStart, survivalStart + 800).includes('menu-cta-icon'));
  assert.doesNotMatch(html, /btn-start-game|btn-open-story-modal|btn-open-cinematic-intro/);
});

test('operator menu portraits use a balanced centred mobile layout and preserve menu actions', async () => {
  const css = await read('../src/visual-polish.css');
  const html = await read('../index.html');
  const app = await read('../src/index.ts');
  assert.ok(css.includes('@media (max-width: 640px)'));
  assert.ok(css.includes('grid-template-columns: repeat(6, minmax(0, 1fr)) !important'));
  assert.ok(css.includes('#title-screen .char-card:nth-child(4) { grid-column: 2 / span 2; }'));
  assert.ok(css.includes('#title-screen .char-card:nth-child(5) { grid-column: 4 / span 2; }'));
  assert.ok(css.includes('#title-screen .char-card[aria-pressed="true"]'));
  assert.ok(css.includes('#title-screen .char-card-badge.operator-emblem .operator-portrait'));
  assert.ok(app.includes("card.setAttribute('aria-pressed', String(cardId === id))"));
  for (const id of ['btn-start-survival']) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.doesNotMatch(html, /btn-start-game|btn-open-story-modal/);
});


test('desktop operator selection remains visibly highlighted without hover', async () => {
  const css = await read('../src/visual-polish.css');
  const desktopStart = css.lastIndexOf('@media (min-width: 641px)');
  assert.ok(desktopStart >= 0, 'desktop-only operator selection rule should exist');
  const desktop = css.slice(desktopStart);
  assert.match(desktop, /#title-screen \.char-card\[aria-pressed="true"\]/);
  assert.match(desktop, /border-color: var\(--operator-accent\)/);
  assert.match(desktop, /radial-gradient\(ellipse at 50% 0%/);
  assert.match(desktop, /\.char-card\[aria-pressed="true"\] \.operator-emblem/);
});


test('operator attack and ability controls use distinct vector SVG icons with role-specific accents', async () => {
  const [app, css, html] = await Promise.all([
    read('../src/index.ts'),
    read('../src/index.css'),
    read('../index.html'),
  ]);
  assert.ok((app.match(/class='operator-action-svg'/g) || []).length >= 10, 'five operators should have separate attack and ability glyphs');
  assert.match(app, /abilityIcon\.innerHTML = abilityIcons\[id\]/);
  assert.match(app, /attackIconElem\.innerHTML = attackIcons\[id\]/);
  assert.match(app, /abilityIcon\.dataset\.operatorIcon = id/);
  assert.match(app, /attackIconElem\.dataset\.operatorIcon = id/);
  assert.match(css, /\.operator-action-svg\s*\{[\s\S]*?width: 24px[\s\S]*?height: 24px/);
  for (const accent of ['#f0c46b', '#f5ca45', '#f5a04c', '#c9a8ff', '#ff777e']) {
    assert.ok(css.includes(accent), 'every operator should keep an individual icon accent');
  }
  assert.ok(html.includes('id="attack-icon"') && html.includes('id="ability-icon"'));
});


test('every operator 3D model has a distinct silhouette, skin tone and role-specific gear', async () => {
  const source = await read('../src/warehouseAssets.ts');
  assert.match(source, /const silhouette: Record<CharacterId/);
  for (const id of ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']) {
    assert.match(source, new RegExp(id + ':\\s*\\{ torsoWidth:'));
  }
  assert.match(source, /skinColors: Record<CharacterId/);
  assert.match(source, /goggleFrame/);
  assert.match(source, /headsetAccent/);
  assert.match(source, /cylinderMat/);
  assert.match(source, /profile\.shoulderSize/);
  assert.match(source, /profile\.torsoWidth/);
});

test('operator selector populates five unique face portraits instead of static shared badges', async () => {
  const [app, html] = await Promise.all([read('../src/index.ts'), read('../index.html')]);
  assert.match(app, /const operatorPortrait = \(id: CharacterId\): string/);
  assert.match(app, /document\.querySelectorAll<HTMLElement>\('\.char-card\[data-char\]'\)/);
  assert.match(app, /badge\.innerHTML = operatorPortrait\(cardId\)/);
  assert.match(app, /if \(heroAvatar\) heroAvatar\.innerHTML = operatorPortrait\(id\)/);
  assert.match(html, /data-char="marcin"/);
  assert.match(html, /data-char="grzesiek"/);
  assert.match(html, /data-char="dawid"/);
  assert.match(html, /data-char="mateusz"/);
  assert.match(html, /data-char="piotr"/);
});


test('Piotr ability badge uses the pentagram icon and the character description names MafiKapibar', async () => {
  const [app, characters] = await Promise.all([
    read('../src/index.ts'), read('../src/characters.ts')
  ]);
  const iconStart = app.indexOf("piotr: \"<svg class='operator-action-svg'");
  assert.ok(iconStart >= 0, 'Piotr ability icon should be present');
  const icon = app.slice(iconStart, app.indexOf('",', iconStart));
  assert.match(icon, /circle cx='24' cy='24' r='19'/);
  assert.match(icon, /M24 5 35 38 6 18h36/);
  assert.match(characters, /Rytuał MafiKapibar — Pentagram B4/);
  assert.doesNotMatch(characters, /Potrójna Salwa Płonących Butli/);
});


test('menu portraits give each operator a different face outline and signature detail', async () => {
  const app = await read('../src/index.ts');
  assert.match(app, /const faceShapes: Record<CharacterId, string>/);
  assert.match(app, /const faceSignatures: Record<CharacterId, string>/);
  assert.match(app, /marcin: '<path/);
  assert.match(app, /grzesiek: '<path/);
  assert.match(app, /dawid: '<path/);
  assert.match(app, /mateusz: '<path/);
  assert.match(app, /piotr: '<path/);
  assert.match(app, /faceShapes\[id\]/);
  assert.match(app, /faceSignatures\[id\]/);
  assert.match(app, /if \(heroAvatar\) heroAvatar\.innerHTML = operatorPortrait\(id\)/);
  assert.match(app, /badge\.innerHTML = operatorPortrait\(cardId\)/);
});

test('the 3D player models use distinct face proportions, expressions and signature details', async () => {
  const source = await read('../src/warehouseAssets.ts');
  assert.match(source, /const faceProfile: Record<CharacterId/);
  assert.match(source, /eyeSpacing: 0\.069/);
  assert.match(source, /eyeSpacing: 0\.078/);
  assert.match(source, /glassesMat/);
  assert.match(source, /frecklesMat/);
  assert.match(source, /micStem/);
  assert.match(source, /creaseMat/);
  assert.match(source, /const beardScale: Record/);
  assert.match(source, /headWidth: 1\.12/);
  assert.match(source, /headWidth: 0\.90/);
});

test('cinematic team reveal draws five recognizable operator busts instead of acronym badges', async () => {
  const intro = await read('../src/cinematicIntro.ts');
  assert.match(intro, /private drawOperatorPortrait\(/);
  assert.match(intro, /const labels = \['DOWÓDCA', 'SIŁACZ', 'FORMAT', 'GAMER', 'WETERAN'\]/);
  assert.match(intro, /const codes = \['LOG-01', 'HYD-44', 'GRS-28', 'SYS-99', 'WET-70'\]/);
  assert.match(intro, /this\.drawOperatorPortrait\(ctx, x, y - cardHeight \* 0\.08, portraitSize \* 0\.94, i, t\)/);
  assert.match(intro, /const portraitMode = w \/ Math\.max\(1, h\) < 0\.85/);
  assert.doesNotMatch(intro, /const symbols = \['WZ', '44', 'XL'/);
});


test('Oniric Dream builds a rabbit-hole landmark and triggers a 15-second pixel-art corruption', async () => {
  const [app, game, css, maps] = await Promise.all([
    read('../src/index.ts'),
    read('../src/game.ts'),
    read('../src/index.css'),
    read('../src/survivalMaps.ts'),
  ]);
  assert.match(maps, /name: 'Oniryczny sen'/);
  assert.match(maps, /style: 'rabbit_hole'/);
  assert.match(game, /white-rabbit-guide/);
  assert.match(game, /ZA KRÓLIKIEM/);
  assert.match(game, /WEJDŹ DO NORKI/);
  assert.match(app, /secretId === 'oniric_dream'/);
  assert.match(app, /}, 15000\)/);
  assert.match(css, /image-rendering: pixelated/);
  assert.match(css, /oniric-dream-active/);
});


test('the Survival archive directory exposes all four arenas and the sixteen-secret total', async () => {
  const [html, css] = await Promise.all([read('../index.html'), read('../src/index.css')]);
  for (const mapId of ['warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting']) {
    assert.ok(html.includes('data-map-visited="' + mapId + '"'), 'missing map directory entry: ' + mapId);
  }
  assert.match(html, /SEKRETY 0 \/ 16/);
  assert.match(html, /SEKRETY 0\/4/, 'the in-game HUD must start with four secrets per map');
  assert.match(css, /\.map-night\s*\{/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
});
