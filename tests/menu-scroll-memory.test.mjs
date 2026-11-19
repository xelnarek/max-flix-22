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

test('menu tab switching saves and restores positions without resetting every panel to zero', async () => {
  const [menu, css, html] = await Promise.all([
    read('../src/index.ts'),
    read('../src/menu-scroll-repair.css'),
    read('../index.html'),
  ]);
  assert.match(menu, /new MenuScrollMemory\(\)/);
  assert.match(menu, /menuScrollMemory\.save\(currentMenuTargetId, menuContentArea\.scrollTop\)/);
  assert.match(menu, /menuScrollMemory\.restore\(targetId\)/);
  assert.match(menu, /menuTabList\.scrollTo\(\{ left:/);
  assert.match(menu, /menuTabList\.scrollTo\(\{ top:/);
  assert.match(css, /\.menu-tab-content-area[\s\S]{0,500}overflow-y: auto !important/);
  assert.match(css, /@media \(min-width: 761px\) and \(pointer: fine\)[\s\S]{0,350}flex-direction: column/);
  const touchLayout = css.slice(css.indexOf('@media (max-width: 760px), (pointer: coarse)'));
  assert.match(touchLayout, /display: grid !important/);
  assert.match(touchLayout, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/);
  assert.match(touchLayout, /overflow: visible !important/);
  assert.match(touchLayout, /touch-action: manipulation !important/);
  assert.doesNotMatch(touchLayout.slice(0, touchLayout.indexOf('/* Landscape phones')), /overflow-x: auto/);
  assert.match(html, /menu-scroll-repair\.css/);
});
