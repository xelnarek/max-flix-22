import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('map picker has a dedicated live preview and accurate route labels', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'), read('../src/index.ts'), read('../src/menu-layout-fixes.css')
  ]);
  for (const id of ['survival-map-preview-title', 'survival-map-preview-detail']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
  }
  assert.ok(html.includes('4 ARENY • RÓŻNE TRASY'));
  assert.ok(html.includes('Palety i regały'));
  assert.ok(html.includes('Kontenery i slalom'));
  assert.ok(html.includes('Agregaty i lód'));
  assert.ok(html.includes('Taśmy i neony'));
  assert.ok(app.includes('survivalMapPreviewTitle.textContent = map.name.toUpperCase()'));
  assert.ok(app.includes('survivalMapPreviewDetail.textContent = map.description'));
  assert.ok(css.includes('survival-map-preview'));
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
});
