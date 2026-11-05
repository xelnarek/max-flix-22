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
  assert.match(html, /4 ARENY • RÓŻNE TRASY/);
  assert.match(html, /Palety i regały/);
  assert.match(html, /Kontenery i slalom/);
  assert.match(html, /Agregaty i lód/);
  assert.match(html, /Taśmy i neony/);
  assert.match(app, /survivalMapPreviewTitle.textContent = map.name.toUpperCase()/);
  assert.match(app, /survivalMapPreviewDetail.textContent = map.description/);
  assert.match(css, /survival-map-preview/);
  assert.match(css, /grid-template-columns:\s*repeat(2,\s*minmax(0,\s*1fr))/);
});
