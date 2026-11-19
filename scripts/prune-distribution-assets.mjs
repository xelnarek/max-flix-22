import { rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const archivedReferenceAssets = resolve('dist', 'assets', 'aistudio');

try {
  const info = await stat(archivedReferenceAssets);
  if (info.isDirectory()) {
    await rm(archivedReferenceAssets, { recursive: true, force: true });
    console.log('[Build hygiene] Removed archived AI Studio screenshots from distribution output.');
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
