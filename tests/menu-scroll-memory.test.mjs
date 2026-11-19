import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { MenuScrollMemory } from '../src/menuScrollMemory.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('menu tabs retain independent vertical scroll positions', () => {
  const memory = new MenuScrollMemory();
  memory.save('tab-team', 380.5);
  memory.save('tab-map', 124);
  assert.equal(memory.restore('tab-team'), 380.5);
  assert.equal(memory.restore('tab-map'), 124);
  assert.equal(memory.restore('tab-pvp'), 0);
});

test('invalid scroll values cannot poison the remembered position', () => {
  const memory = new MenuScrollMemory();
  memory.save('tab-team', 250);
  memory.save('tab-team', Number.NaN);
  memory.save('tab-team', Number.POSITIVE_INFINITY);
  memory.save('', 999);
  assert.equal(memory.restore('tab-team'), 250);
  assert.equal(memory.restore(''), 0);
});

test('negative scroll values are clamped and tab memory can be cleared', () => {
  const memory = new MenuScrollMemory();
  memory.save('tab-team', -80);
  memory.save('tab-map', 510);
  assert.equal(memory.restore('tab-team'), 0);
  memory.clear('tab-map');
  assert.equal(memory.restore('tab-map'), 0);
  memory.clear();
  assert.equal(memory.restore('tab-team'), 0);
});

test('menu tab switching preserves panel scroll and the left sidebar scrolls vertically', async () => {
  const [menu, css, html] = await Promise.all([
    read('../src/index.ts'),
    read('../src/menu-single-sidebar-repair.css'),
    read('../index.html'),
  ]);
  assert.match(menu, /new MenuScrollMemory\(\)/);
  assert.match(menu, /menuScrollMemory\.save\(currentMenuTargetId, menuContentArea\.scrollTop\)/);
  assert.match(menu, /menuScrollMemory\.restore\(targetId\)/);
  assert.match(menu, /menuTabList\.scrollTo\(\{ top:/);
  assert.doesNotMatch(menu, /menuTabList\.scrollTo\(\{ left:/);
  assert.match(css, /#title-screen \.menu-tabs-bar\s*\{[\s\S]*?flex-direction: column !important[\s\S]*?overflow-y: auto !important/);
  assert.match(css, /#title-screen \.menu-tab-content-area\s*\{[\s\S]*?overflow-y: auto !important/);
  assert.match(html, /menu-single-sidebar-repair\.css/);
});
