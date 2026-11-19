import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

async function collectFiles(directory) {
  const entries = await readdir(new URL('../' + directory + '/', import.meta.url), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = directory + '/' + entry.name;
    if (entry.isDirectory()) files.push(...await collectFiles(child));
    else files.push(child);
  }
  return files;
}

test('archived AI Studio reference screenshots are retained in source but excluded from distribution output', async () => {
  const [packageJson, pruneScript] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('scripts/prune-distribution-assets.mjs'),
  ]);
  assert.equal(packageJson.scripts.postbuild, 'node scripts/prune-distribution-assets.mjs');
  assert.match(pruneScript, /resolve\('dist', 'assets', 'aistudio'\)/);
  assert.match(pruneScript, /rm\(archivedReferenceAssets, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(pruneScript, /resolve\('public'/);

  const archivedFiles = await collectFiles('public/assets/aistudio');
  assert.ok(archivedFiles.length > 0, 'source reference files must remain in the repository');

  const sourceFiles = [
    'index.html',
    ...await collectFiles('src'),
    ...await collectFiles('scripts'),
  ];
  const sources = await Promise.all(sourceFiles.map((path) => read(path)));
  const forbiddenReferences = archivedFiles.filter((path) => {
    const baseName = path.split('/').pop();
    return sources.some((source) => source.includes(path.replace(/^public\//, '')) || source.includes(baseName));
  });
  assert.deepEqual(forbiddenReferences, [], 'no runtime source should depend on archived screenshots');
});
