import { createHash } from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const REQUIRED_RIG_CLIPS = Object.freeze(['Idle', 'Walk', 'Run', 'Death', 'Hit']);

/** Read and validate the JSON chunk in a GLB 2.0 binary. */
export function readGlbDocument(bytes, modelId = 'unknown') {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20) {
    throw new Error('GLB is truncated or is not a Buffer: ' + modelId);
  }
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('GLB magic header is invalid: ' + modelId);
  }
  const version = bytes.readUInt32LE(4);
  if (version !== 2) {
    throw new Error('Expected GLB 2.0, received version ' + version + ': ' + modelId);
  }
  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    throw new Error('GLB declared length does not match downloaded bytes: ' + modelId);
  }

  let offset = 12;
  let document;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.length) {
      throw new Error('GLB chunk exceeds the file boundary: ' + modelId);
    }
    if (chunkType === GLB_JSON_CHUNK) {
      try {
        document = JSON.parse(bytes.toString('utf8', chunkStart, chunkEnd).trim());
      } catch (error) {
        throw new Error('GLB JSON chunk cannot be parsed for ' + modelId + ': ' + String(error));
      }
      break;
    }
    offset = chunkEnd;
  }

  if (!document || document.asset?.version !== '2.0') {
    throw new Error('GLB does not contain a valid glTF 2.0 JSON chunk: ' + modelId);
  }
  return document;
}

/** Validate the embedded mesh, skin and all required/catalogue-advertised clips. */
export function validateGlbAsset(bytes, modelId, expectedClipNames = []) {
  const document = readGlbDocument(bytes, modelId);
  if (!Array.isArray(document.meshes) || document.meshes.length === 0) {
    throw new Error('GLB has no mesh primitives: ' + modelId);
  }
  if (!Array.isArray(document.skins) || document.skins.length === 0) {
    throw new Error('GLB has no skin/skeleton: ' + modelId);
  }
  if (!Array.isArray(document.animations) || document.animations.length === 0) {
    throw new Error('GLB has no embedded animation clips: ' + modelId);
  }
  const clipNames = document.animations
    .map((clip) => typeof clip?.name === 'string' ? clip.name : '')
    .filter(Boolean);
  const missing = [...new Set([...REQUIRED_RIG_CLIPS, ...expectedClipNames])]
    .filter((name) => !clipNames.includes(name));
  if (missing.length > 0) {
    throw new Error('GLB ' + modelId + ' is missing embedded animation clips: ' + missing.join(', '));
  }
  return { document, clipNames };
}

export function sha256ForBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
