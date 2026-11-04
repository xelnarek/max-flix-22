import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('mobile install metadata is complete and points to project-relative assets', async () => {
  const [manifestText, html] = await Promise.all([
    read('../public/manifest.webmanifest'),
    read('../index.html'),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, 'Paleciaki! Magazyn Chaosu');
  assert.equal(manifest.short_name, 'Paleciaki!');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some((icon) => icon.src === './icons/b4-icon.svg'));
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /theme-color/);
});

test('service worker keeps remote services and API data outside its cache', async () => {
  const worker = await read('../public/sw.js');
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /\/api\//);
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /MAX_CACHEABLE_BYTES/);
  assert.match(worker, /offline\.html/);
});

test('mobile lifecycle pauses active gameplay when the document is hidden', async () => {
  const app = await read('../src/index.ts');
  assert.match(app, /document\.addEventListener\('visibilitychange'/);
  assert.match(app, /document\.hidden && this\.engine\.getGameState\(\) === 'playing'/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js'/);
});
