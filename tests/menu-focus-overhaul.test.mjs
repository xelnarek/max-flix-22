import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('menu starts in compact mode and exposes one sticky full-description switch', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/menu-focus-overhaul.css'),
  ]);
  assert.match(html, /data-menu-density="compact"/);
  assert.match(html, /menu-focus-overhaul\.css/);
  assert.match(app, /menuContentArea\.insertBefore\(toolbar, menuContentArea\.firstChild\)/);
  assert.match(app, /densityButton\.textContent = expanded \? 'WIDOK ZWIĘZŁY' : 'PEŁNE OPISY'/);
  assert.match(app, /menuRootElement\.dataset\.menuDensity = expanded \? 'full' : 'compact'/);
  assert.match(css, /\.menu-density-toolbar\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(css, /data-menu-density="compact"[\s\S]*?#tab-enemies/);
  assert.match(css, /data-menu-density="full"[\s\S]*?#tab-enemies/);
});

test('operator roster uses five compact selectable cards instead of oversized portraits', async () => {
  const [css, app] = await Promise.all([
    read('../src/menu-focus-overhaul.css'),
    read('../src/index.ts'),
  ]);
  assert.match(css, /#tab-team > \.char-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.char-card-badge\.operator-emblem\s*\{[\s\S]*?width:\s*34px/);
  assert.match(css, /\.char-card-ability,[\s\S]*?display:\s*none/);
  assert.match(app, /if \(nameLabel\) nameLabel\.textContent = definition\.name/);
});

test('operator profile, abilities and mastery are separate accessible views', async () => {
  const [app, css] = await Promise.all([
    read('../src/index.ts'),
    read('../src/menu-focus-overhaul.css'),
  ]);
  for (const view of ['profile', 'abilities', 'mastery']) {
    assert.ok(app.includes("id: '" + view + "'"), 'missing operator view ' + view);
    assert.ok(css.includes('data-char-view="' + view + '"'), 'missing view-specific layout ' + view);
  }
  assert.match(app, /setCharacterDetailView\('profile'\)/);
  assert.match(app, /button\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(css, /#character-mastery-panel\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test('compact descriptions preserve full copy when the global full-description mode is enabled', async () => {
  const css = await read('../src/menu-focus-overhaul.css');
  for (const selector of [
    '#tab-enemies .enemy-guide-desc',
    '#tab-perks .perk-card-desc',
    '#tab-field-guide .field-guide-callout',
  ]) assert.ok(css.includes(selector), 'missing compact treatment for ' + selector);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /data-menu-density="full"[\s\S]*?overflow:\s*visible/);
});
