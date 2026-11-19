import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('phone navigation keeps four labelled groups and all eleven destinations without duplicate segment controls', async () => {
  const html = await read('index.html');
  const groups = [...html.matchAll(/class="menu-nav-group" data-menu-group="([^"]+)"/g)].map((match) => match[1]);
  const tabs = [...html.matchAll(/class="menu-tab-btn[^"]*" data-tab="(tab-[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(groups, ['play', 'world', 'progress', 'system']);
  assert.equal(tabs.length, 11);
  assert.equal(new Set(tabs).size, 11);
  assert.doesNotMatch(html, /menu-mobile-segments|menu-mobile-segment/);
});

test('mobile menu has one persistent vertical sidebar and one independent content viewport', async () => {
  const mobileCss = await read('src/crimson-shift-mobile-layout-v3.css');
  const repairCss = await read('src/menu-single-sidebar-repair.css');
  const html = await read('index.html');
  assert.ok(html.indexOf('crimson-shift-mobile-layout-v3.css') > html.indexOf('crimson-shift-functional-menu.css'));
  assert.ok(mobileCss.includes('zoom: 1 !important'));
  assert.ok(repairCss.includes('grid-template-columns: clamp(122px, 31vw, 188px) minmax(0, 1fr) !important;'));
  assert.ok(repairCss.includes('flex-direction: column !important;'));
  assert.ok(repairCss.includes('overflow-y: auto !important;'));
  assert.ok(repairCss.includes('overflow-x: hidden !important;'));
  assert.doesNotMatch(mobileCss + repairCss, /menu-mobile-segments|menu-mobile-segment|menu-nav-group\\[hidden\\]/);
});