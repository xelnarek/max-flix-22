import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE44_ENEMY_ASSETS } from '../src/base44EnemyAssets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'base44-enemies');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const strict = process.argv.includes('--strict');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readGlbDocument(bytes, modelId) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20) {
    throw new Error('GLB is truncated: ' + modelId);
  }
  if (bytes.readUInt32LE(0) !== 0x46546c67) {
    throw new Error('Invalid GLB magic header: ' + modelId);
  }
  if (bytes.readUInt32LE(4) !== 2) {
    throw new Error('Expected GLB 2.0: ' + modelId);
  }
  if (bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error('GLB declared length does not match file size: ' + modelId);
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.length) throw new Error('GLB chunk exceeds file boundary: ' + modelId);
    if (chunkType === 0x4e4f534a) {
      const document = JSON.parse(bytes.toString('utf8', chunkStart, chunkEnd).trim());
      if (document.asset?.version !== '2.0') throw new Error('Invalid glTF document: ' + modelId);
      if (!Array.isArray(document.meshes) || document.meshes.length === 0) {
        throw new Error('GLB contains no renderable meshes: ' + modelId);
      }
      if (!Array.isArray(document.animations) || document.animations.length === 0) {
        throw new Error('GLB contains no embedded animation clips: ' + modelId);
      }
      return {
        meshCount: document.meshes.length,
        skinCount: Array.isArray(document.skins) ? document.skins.length : 0,
        clips: document.animations.map((clip) => clip?.name).filter((name) => typeof name === 'string' && name.length > 0),
      };
    }
    offset = chunkEnd;
  }
  throw new Error('GLB has no JSON chunk: ' + modelId);
}

async function fetchWithRetry(url, modelId, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'MaxFlix22-Base44Assets/1.0' },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' while fetching ' + modelId);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 2048) throw new Error('Downloaded file is unexpectedly small: ' + modelId);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const delay = Math.min(8_000, 700 * (2 ** (attempt - 1)));
        console.warn('[Base44 assets] retry ' + attempt + '/' + attempts + ' for ' + modelId + ' in ' + delay + ' ms');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function existingAssetIsValid(filePath, expectedSha, modelId) {
  try {
    const details = await stat(filePath);
    if (details.size < 2048) return false;
    const bytes = await readFile(filePath);
    readGlbDocument(bytes, modelId);
    return !expectedSha || sha256(bytes) === expectedSha;
  } catch {
    return false;
  }
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  let previousManifest = {};
  try {
    previousManifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')).models || {};
  } catch {
    previousManifest = {};
  }

  const manifest = {
    provider: 'Base44 · Absurd Enemy Asset Lab',
    source: 'User-authored assets from the Base44 media library',
    retrievedAt: new Date().toISOString(),
    models: {},
  };
  let downloaded = 0;
  let reused = 0;

  for (const [id, asset] of Object.entries(BASE44_ENEMY_ASSETS)) {
    const filePath = path.join(OUTPUT_DIR, asset.file);
    const oldEntry = previousManifest[id];
    let bytes;
    if (await existingAssetIsValid(filePath, oldEntry?.sha256, id)) {
      bytes = await readFile(filePath);
      reused++;
    } else {
      bytes = await fetchWithRetry(asset.url, id);
      await writeFile(filePath, bytes);
      downloaded++;
    }

    const validation = readGlbDocument(bytes, id);
    manifest.models[id] = {
      file: asset.file,
      sourceUrl: asset.url,
      label: asset.label,
      bytes: bytes.length,
      sha256: sha256(bytes),
      meshes: validation.meshCount,
      skins: validation.skinCount,
      animations: validation.clips,
    };
    console.log('[Base44 assets] ' + asset.label + ' • ' + validation.meshCount + ' meshes • ' +
      validation.clips.length + ' animation clips');
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('[Base44 assets] Ready: ' + downloaded + ' downloaded, ' + reused + ' checksum-validated reused. ' + OUTPUT_DIR);
}

run().catch((error) => {
  console.error('[Base44 assets] Preparation failed:', error);
  if (strict) process.exitCode = 1;
  else console.warn('[Base44 assets] Development can still load the public Base44 CDN URLs; built-in enemy rigs remain the fallback.');
});
