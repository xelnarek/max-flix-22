import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('phone navigation starts with four clear segments and preserves the eleven existing destinations', async () => {
  const html = await read('index.html');
  const groups = [...html.matchAll(/class="menu-nav-group" data-menu-group="([^"]+)"/g)].map((match) => match[1]);
  const segments = [...html.matchAll(/class="menu-mobile-segment[^"]*" data-menu-segment="([^"]+)"/g)].map((match) => match[1]);
  const tabs = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(groups, ['play', 'world', 'progress', 'system']);
  assert.deepEqual(segments, ['play', 'world', 'progress', 'system']);
  assert.equal(tabs.length, 11);
  assert.equal(new Set(tabs).size, 11);
});

test('mobile menu has one navigation surface and one independent vertical content viewport', async () => {
  const css = await read('src/crimson-shift-mobile-layout-v3.css');
  const html = await read('index.html');

  assert.ok(html.indexOf('crimson-shift-mobile-layout-v3.css') > html.indexOf('crimson-shift-functional-menu.css'));
  assert.match(css, /#title-screen \.title-sheet\s*\{[^}]*zoom:\s*1\s*!important/s);
  assert.match(css, /\.menu-mobile-segments\s*\{[^}]*display:\s*grid\s*!important/s);
  assert.match(css, /\.menu-nav-group\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /\.menu-tab-content-area\s*\{[^}]*overflow-y:\s*auto\s*!important/s);
  assert.match(css, /\.menu-tab-content-area\s*\{[^}]*overflow-x:\s*hidden\s*!important/s);
  assert.doesNotMatch(css, /\.menu-tabs-bar\s*\{[^}]*overflow-x:\s*auto\s*!important/s);
});
