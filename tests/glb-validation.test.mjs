import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readGlbDocument,
  sha256ForBytes,
  validateGlbAsset,
} from '../scripts/glbValidation.mjs';

function makeGlb(document) {
  const json = Buffer.from(JSON.stringify(document).padEnd(
    Math.ceil(Buffer.byteLength(JSON.stringify(document)) / 4) * 4,
    ' ',
  ));
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(json.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4);
  const totalLength = 12 + chunkHeader.length + json.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  return Buffer.concat([header, chunkHeader, json]);
}

const baseDocument = {
  asset: { version: '2.0' },
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  skins: [{ joints: [0, 1] }],
  animations: ['Idle', 'Walk', 'Run', 'Death', 'Hit'].map((name) => ({ name })),
};

test('validates actual embedded GLB 2.0 rig and required animation clips', () => {
  const bytes = makeGlb(baseDocument);
  const result = validateGlbAsset(bytes, 'fixture');
  assert.deepEqual(result.clipNames, ['Idle', 'Walk', 'Run', 'Death', 'Hit']);
  assert.equal(readGlbDocument(bytes, 'fixture').asset.version, '2.0');
  assert.match(sha256ForBytes(bytes), /^[a-f0-9]{64}$/);
});

test('rejects invalid magic, truncated files, unsupported versions and incorrect lengths', () => {
  const valid = makeGlb(baseDocument);
  const invalidMagic = Buffer.from(valid);
  invalidMagic.writeUInt32LE(0, 0);
  assert.throws(() => readGlbDocument(invalidMagic), /magic header/);
  assert.throws(() => readGlbDocument(Buffer.alloc(10)), /truncated/);
  const invalidVersion = Buffer.from(valid);
  invalidVersion.writeUInt32LE(1, 4);
  assert.throws(() => readGlbDocument(invalidVersion), /version 1/);
  const invalidLength = Buffer.from(valid);
  invalidLength.writeUInt32LE(valid.length + 16, 8);
  assert.throws(() => readGlbDocument(invalidLength), /declared length/);
});

test('rejects malformed JSON chunks and chunks outside the file boundary', () => {
  const malformed = makeGlb(baseDocument);
  malformed.fill(0x78, 20, 28);
  assert.throws(() => readGlbDocument(malformed), /JSON chunk cannot be parsed/);
  const oversized = Buffer.from(makeGlb(baseDocument));
  oversized.writeUInt32LE(0xfffffff0, 12);
  assert.throws(() => readGlbDocument(oversized), /chunk exceeds/);
});

test('rejects missing mesh, skin and clips or missing catalogue-advertised clips', () => {
  assert.throws(() => validateGlbAsset(makeGlb({ ...baseDocument, meshes: [] }), 'no-mesh'), /no mesh/);
  assert.throws(() => validateGlbAsset(makeGlb({ ...baseDocument, skins: [] }), 'no-skin'), /no skin/);
  assert.throws(() => validateGlbAsset(makeGlb({ ...baseDocument, animations: [] }), 'no-clips'), /no embedded/);
  assert.throws(() => validateGlbAsset(makeGlb({
    ...baseDocument,
    animations: baseDocument.animations.filter((clip) => clip.name !== 'Run'),
  }), 'missing-run'), /Run/);
  assert.throws(
    () => validateGlbAsset(makeGlb(baseDocument), 'catalogue-mismatch', ['Attack']),
    /Attack/,
  );
});
