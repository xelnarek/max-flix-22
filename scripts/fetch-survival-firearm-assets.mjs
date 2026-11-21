import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'survival-firearms');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const strict = process.argv.includes('--strict');
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

const ASSETS = [
  { file: 'pistol.glb', id: 'fps-compact-pistol-19430', url: 'https://cdn.3dassets.dev/assets/19430/v1/model.glb', label: 'Compact pistol · FPS Guns and Shooting Range', triangles: 10024 },
  { file: 'smg.glb', id: 'fps-compact-smg-19433', url: 'https://cdn.3dassets.dev/assets/19433/v1/model.glb', label: 'Compact submachine gun · FPS Guns and Shooting Range', triangles: 11324 },
  { file: 'rifle.glb', id: 'fps-assault-carbine-19436', url: 'https://cdn.3dassets.dev/assets/19436/v1/model.glb', label: 'Assault carbine · FPS Guns and Shooting Range', triangles: 11324 },
  { file: 'shotgun.glb', id: 'fps-pump-shotgun-19439', url: 'https://cdn.3dassets.dev/assets/19439/v1/model.glb', label: 'Pump shotgun · FPS Guns and Shooting Range', triangles: 9984 },
  { file: 'heavy-rifle.glb', id: 'fps-battle-rifle-19437', url: 'https://cdn.3dassets.dev/assets/19437/v1/model.glb', label: 'Battle rifle · FPS Guns and Shooting Range', triangles: 11324 },
  { file: 'rocket.glb', id: 'arena-rocket-launcher-23139', url: 'https://cdn.3dassets.dev/assets/23139/v1/model.glb', label: 'Rocket Launcher Pickup · Arena Shooter Map Kit', triangles: 4600 },
  { file: 'plasma.glb', id: 'arena-plasma-gun-23143', url: 'https://cdn.3dassets.dev/assets/23143/v1/model.glb', label: 'Plasma Gun Pickup · Arena Shooter Map Kit', triangles: 5448 },
  { file: 'gauss.glb', id: 'arena-rail-gun-23142', url: 'https://cdn.3dassets.dev/assets/23142/v1/model.glb', label: 'Rail Gun Pickup · Arena Shooter Map Kit', triangles: 3000 },
  { file: 'grenade.glb', id: 'arena-grenade-launcher-23140', url: 'https://cdn.3dassets.dev/assets/23140/v1/model.glb', label: 'Grenade Launcher Pickup · Arena Shooter Map Kit', triangles: 3000 },
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function inspectGlb(bytes, assetId) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.length > MAX_ASSET_BYTES) {
    throw new Error('Unexpected GLB size for ' + assetId + ': ' + (bytes?.length ?? 0));
  }
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error('Invalid GLB 2.0 header or length for ' + assetId);
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.length) throw new Error('GLB chunk exceeds file boundary: ' + assetId);
    if (chunkType === 0x4e4f534a) {
      const document = JSON.parse(bytes.toString('utf8', chunkStart, chunkEnd).trim());
      if (document.asset?.version !== '2.0' || !Array.isArray(document.meshes) || document.meshes.length === 0) {
        throw new Error('GLB has no valid glTF 2.0 mesh scene: ' + assetId);
      }
      const animations = Array.isArray(document.animations)
        ? document.animations.map((clip) => clip?.name).filter((name) => typeof name === 'string' && name.length > 0)
        : [];
      return { meshCount: document.meshes.length, animations };
    }
    offset = chunkEnd;
  }
  throw new Error('GLB has no JSON chunk: ' + assetId);
}

async function fetchWithRetry(url, assetId, attempts = 4) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'cdn.3dassets.dev' || !parsed.pathname.endsWith('/model.glb')) {
    throw new Error('Refusing unexpected asset URL for ' + assetId);
  }
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'MaxFlix22-SurvivalFirearms/1.0' },
        signal: AbortSignal.timeout(35_000),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + assetId);
      const bytes = Buffer.from(await response.arrayBuffer());
      inspectGlb(bytes, assetId);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const delay = Math.min(6000, 600 * (2 ** (attempt - 1)));
        console.warn('[Firearm assets] retry ' + attempt + '/' + attempts + ' for ' + assetId + ' in ' + delay + ' ms');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function existingAssetIsValid(filePath, assetId) {
  try {
    const details = await stat(filePath);
    if (details.size < 2048 || details.size > MAX_ASSET_BYTES) return false;
    inspectGlb(await readFile(filePath), assetId);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const manifest = {
    provider: '3DAssets.dev',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    aiDisclosure: 'Source pages identify the selected models as AI-generated using Claude Fable 5.1.',
    retrievedAt: new Date().toISOString(),
    assets: {},
  };

  let downloaded = 0;
  let reused = 0;
  for (const asset of ASSETS) {
    const filePath = path.join(OUTPUT_DIR, asset.file);
    const bytes = await existingAssetIsValid(filePath, asset.id)
      ? await readFile(filePath)
      : await fetchWithRetry(asset.url, asset.id);
    if (bytes.length < 2048) throw new Error('Downloaded GLB is unexpectedly small: ' + asset.id);
    if (await existingAssetIsValid(filePath, asset.id)) reused++;
    else {
      await writeFile(filePath, bytes);
      downloaded++;
    }
    const validation = inspectGlb(bytes, asset.id);
    manifest.assets[asset.id] = {
      file: asset.file,
      label: asset.label,
      sourceUrl: asset.url,
      license: 'CC0-1.0',
      aiGenerated: true,
      byteLength: bytes.length,
      sha256: sha256(bytes),
      triangles: asset.triangles,
      meshes: validation.meshCount,
      animations: validation.animations,
    };
    console.log('[Firearm assets] ' + asset.id + ' • ' + validation.meshCount + ' meshes • ' + validation.animations.length + ' animation clips');
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('[Firearm assets] Ready: ' + downloaded + ' downloaded, ' + reused + ' validated reused. ' + OUTPUT_DIR);
}

run().catch((error) => {
  console.error('[Firearm assets] Preparation failed:', error);
  if (strict) process.exitCode = 1;
  else console.warn('[Firearm assets] Development keeps procedural weapon models as fallback.');
});
