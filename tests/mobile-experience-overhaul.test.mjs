import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the branded loader keeps one progress system and every asset callback target', async () => {
  const [html, assets, css] = await Promise.all([
    read('../index.html'), read('../src/assets.ts'), read('../src/quality-overhaul.css')
  ]);
  for (const id of [
    'asset-loader-overlay', 'loader-spinner-icon', 'loader-subtitle',
    'cat-pill-textures', 'cat-pill-models', 'cat-pill-audio', 'cat-pill-engine',
    'cat-count-textures', 'cat-count-models', 'cat-count-audio', 'cat-count-engine',
    'loader-fill', 'loader-status-text', 'loader-percent', 'loader-category-badge',
    'loader-tip-text',
  ]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
    assert.ok(assets.includes('id="' + id + '"'), 'fallback loader missing ' + id);
  }
  assert.match(html, /WAREHOUSE\s*<span>MaDDnes<\/span>/);
  assert.match(html, /loader-art/);
  assert.match(html, /role="progressbar"/);
  assert.match(assets, /WAREHOUSE\s*<span>MaDDnes<\/span>/);
  assert.match(assets, /setAttribute\('aria-valuenow'/);
  assert.doesNotMatch(html, /CENTRUM B4 3D LOGISTICS ENGINE/);
  assert.match(css, /\.loader-modal-card\.loader-maddnes-card/);
});

test('Survival radio chatter is lifted above the thumb zone and hidden under timed event cards', async () => {
  const [app, css] = await Promise.all([
    read('../src/index.ts'), read('../src/quality-overhaul.css')
  ]);
  assert.match(app, /if \(activeEvent\?\.classList\.contains\('is-visible'\)\) return/);
  assert.match(app, /dialogue-container'\)\?\.classList\.add\('covered-by-event'\)/);
  assert.match(app, /dialogue-container'\)\?\.classList\.remove\('covered-by-event'\)/);
  assert.match(css, /#game-shell\.survival-mode #dialogue-container\s*\{[\s\S]*?top: max\(72px[\s\S]*?bottom: auto !important[\s\S]*?width: min\(212px/);
  assert.match(css, /#game-shell\.survival-mode #dialogue-container\.covered-by-event/);
});

test('PvP scoreboard is portaled above WebGL and remains readable on portrait phones', async () => {
  const [app, css, html] = await Promise.all([
    read('../src/index.ts'), read('../src/quality-overhaul.css'), read('../index.html')
  ]);
  assert.match(app, /if \(pvpHud && pvpHud\.parentElement !== document\.body\)\s*\{\s*document\.body\.appendChild\(pvpHud\)/);
  assert.match(app, /pvpHud\?\.setAttribute\('aria-hidden', 'false'\)/);
  assert.match(css, /body > #pvp-hud:not\(\.hidden\)\s*\{[\s\S]*?position: fixed !important[\s\S]*?z-index: 2147483002/);
  assert.match(css, /body > #pvp-hud \.pvp-hud-main\s*\{[\s\S]*?display: grid !important/);
  assert.match(html, /id="pvp-p1-hp-fill"/);
  assert.match(html, /id="pvp-p2-hp-fill"/);
  assert.match(html, /id="pvp-round-indicator"/);
});

test('the last stylesheet loads the mobile quality overrides after legacy cascade rules', async () => {
  const html = await read('../index.html');
  assert.ok(html.indexOf('/src/quality-overhaul.css') > html.indexOf('/src/responsive-gameplay-polish.css'));
});

test('loader and radio presentation honour system reduced-motion settings', async () => {
  const css = await read('../src/quality-overhaul.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /loader-icon-spinner/);
});

test('portrait Survival camera framing makes operators more readable without changing Campaign or PvP', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /this\.gameMode === 'survival' && this\.viewportAspect < 0\.78/);
  assert.match(game, /baseOffsetY = 14\.6;\s*baseOffsetZ = 9\.55/);
  assert.match(game, /cameraMode === 'iso'[\s\S]*?baseOffsetY = 15\.8;\s*baseOffsetZ = 10\.2/);
});

test('combat quality systems remain wired: swept shots, obstacle blocking, telegraphed AI and role animations', async () => {
  const [game, arena, impact, telegraphs, animation] = await Promise.all([
    read('../src/game.ts'),
    read('../src/pvpArena.ts'),
    read('../src/projectileImpact.ts'),
    read('../src/enemyMeleeTelegraphs.ts'),
    read('../src/gobkitAnimation.ts'),
  ]);
  assert.match(game, /findFirstProjectileEnemyImpact\(/);
  assert.match(game, /findFirstProjectileBodyImpact\(/);
  assert.match(arena, /firstProjectileObstacleHit\(/);
  assert.match(arena, /pointSegmentDistanceSq\(/);
  assert.match(impact, /horizontalStart[\s\S]*?verticalStart/);
  assert.match(telegraphs, /warningText/);
  assert.match(game, /advanceEnemyAttackTelegraph\(/);
  assert.match(game, /advanceEnemyMeleeAttackTelegraph\(/);
  assert.match(game, /calculateEnemyProjectileDodge\(/);
  assert.match(game, /updateGobkitAnimations\(/);
  assert.match(animation, /shouldKeepGobkitAction/);
});

test('PvP scoreboard uses individual operator portraits and exposes hidden state accessibly', async () => {
  const app = await read('../src/index.ts');
  assert.match(app, /pvpHud\?\.setAttribute\('aria-hidden', String\(!activePvp\)\)/);
  assert.match(app, /p1Avatar\.innerHTML = operatorPortrait\(state\.p1\.operatorId\)/);
  assert.match(app, /p2Avatar\.innerHTML = operatorPortrait\(state\.p2\.operatorId\)/);
});
