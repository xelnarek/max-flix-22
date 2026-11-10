import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'gobkit');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const API_URL = 'https://gobkit.com/api/free';

// These are deliberately role-matched rather than random samples: warehouse
// staff for playable operators, familiar delivery/retail roles for grunts,
// and more distinct silhouettes for elite and late-wave threats.
const REQUIRED_MODELS = [
  'storemanager',
  'firechief',
  'stockclerk',
  'baggagehandler',
  'securityguard',
  'foodcourier',
  'shoplifter',
  'salesrep',
  'officemanager',
  'hazmattech',
  'stitchedbrute',
  'bloodironjuggernaut',
  'nightwitch',
  'androidcommander',
  'werewolfcaptain',
  'forcibleentryfirefighter',
  'bloodirongrunt',
];

const strict = process.argv.includes('--strict');

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'MaxFlix22-AssetBuild/1.0' },
        signal: AbortSignal.timeout(40_000),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const waitMs = Math.min(8000, 650 * (2 ** (attempt - 1)));
        console.warn('[Gobkit] Retry ' + attempt + '/' + attempts + ' in ' + waitMs + ' ms:', String(error));
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError;
}

async function existingFileIsValid(filePath) {
  try {
    const details = await stat(filePath);
    if (details.size < 2048) return false;
    const handle = await readFile(filePath);
    return handle.subarray(0, 4).toString('ascii') === 'glTF';
  } catch {
    return false;
  }
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const apiResponse = await fetchWithRetry(API_URL);
  const catalogue = await apiResponse.json();

  if (!Array.isArray(catalogue.packs) || catalogue.packs.length === 0) {
    throw new Error('Gobkit catalogue did not include packs[].models[] metadata.');
  }

  const catalogueModels = catalogue.packs.flatMap((pack) =>
    (Array.isArray(pack.models) ? pack.models : []).map((model) => ({
      ...model,
      packName: pack.name || pack.id || 'Gobkit Free Pack',
      packLicense: pack.license || '',
    })),
  );
  const resolved = new Map();

  for (const id of REQUIRED_MODELS) {
    const model = catalogueModels.find((entry) => entry.id === id);
    if (!model) throw new Error('Required model is no longer present in the free catalogue: ' + id);
    const license = String(model.license || model.packLicense || '');
    if (!license.includes('CC0 1.0')) {
      throw new Error('Model is not explicitly marked CC0 1.0: ' + id);
    }
    if (model.rigged !== true || model.format !== 'glb' || !Array.isArray(model.animations)) {
      throw new Error('Model is missing its rig, GLB format or named animation metadata: ' + id);
    }
    const clipNames = model.animations.map((clip) => typeof clip === 'string' ? clip : clip?.name).filter(Boolean);
    for (const requiredClip of ['Idle', 'Walk', 'Run', 'Death', 'Hit']) {
      if (!clipNames.includes(requiredClip)) {
        throw new Error('Model ' + id + ' has no named ' + requiredClip + ' animation.');
      }
    }
    const modelUrl = new URL(model.url);
    if (modelUrl.protocol !== 'https:' || modelUrl.hostname !== 'gobkit.com' || !modelUrl.pathname.toLowerCase().endsWith('.glb')) {
      throw new Error('Refusing an unexpected model URL for ' + id);
    }
    resolved.set(id, { ...model, license, clipNames, sourceUrl: modelUrl.href });
  }

  const outputManifest = {
    provider: 'Gobkit',
    catalogueUrl: API_URL,
    catalogueVersion: catalogue.schemaVersion ?? null,
    catalogueModelCount: catalogue.totalFreeModels ?? null,
    retrievedAt: new Date().toISOString(),
    license: 'CC0 1.0',
    models: {},
  };

  let downloaded = 0;
  let reused = 0;
  for (const id of REQUIRED_MODELS) {
    const model = resolved.get(id);
    const filename = id + '.glb';
    const filePath = path.join(OUTPUT_DIR, filename);
    if (await existingFileIsValid(filePath)) {
      reused++;
    } else {
      const response = await fetchWithRetry(model.sourceUrl);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 2048 || bytes.subarray(0, 4).toString('ascii') !== 'glTF') {
        throw new Error('Downloaded file is not a valid binary glTF 2.0 asset: ' + id);
      }
      await writeFile(filePath, bytes);
      downloaded++;
    }

    outputManifest.models[id] = {
      name: model.name,
      filename,
      pack: model.packName,
      sourceUrl: model.sourceUrl,
      license: model.license,
      rigged: true,
      fps: model.fps ?? 30,
      animations: model.clipNames,
    };
    console.log('[Gobkit] ' + (downloaded + reused) + '/' + REQUIRED_MODELS.length + ' • ' + model.name);
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(outputManifest, null, 2) + '\n', 'utf8');
  console.log('[Gobkit] Ready: ' + downloaded + ' downloaded, ' + reused + ' reused. ' + OUTPUT_DIR);
}

run().catch((error) => {
  console.error('[Gobkit] Asset preparation failed:', error);
  if (strict) process.exitCode = 1;
  else console.warn('[Gobkit] Development will continue with the built-in procedural fallback models.');
});
