import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('playable operator bodies keep a neutral runtime weapon mount instead of legacy props', async () => {
  const source = await read('src/warehouseAssets.ts');
  const start = source.indexOf('export function createCharacterModel(def: CharacterDef)');
  const end = source.indexOf('\nexport function ', start + 10);
  assert.ok(start >= 0 && end > start, 'operator model factory should exist');
  const model = source.slice(start, end);
  assert.match(model, /accessory\.userData\.weaponMount = true/);
  assert.match(model, /accessory\.userData\.legacyHeldPropsRemoved = true/);
  assert.match(model, /rightArm\.add\(accessory\)/);
  assert.doesNotMatch(model, /const (?:bar|roll|gunBody|wrench) = new THREE\./);
  assert.doesNotMatch(model, /B4 ERP|WZ  ✓  404/);
});

test('operator portraits no longer show old dumbbell or ratchet-wrench artwork', async () => {
  const app = await read('src/index.ts');
  assert.doesNotMatch(app, /Ratchet Wrench B4|<!-- Dumbbell -->/);
  assert.match(app, /B4 veteran shoulder insignia/);
});

test('enemy role kits retire handheld tools previously used as improvised weapons', async () => {
  const source = await read('src/enemyRoleKits.ts');
  assert.match(source, /type Prop = [^;]*'none'/);
  for (const retired of ['wrench', 'jackHandle', 'sceptre', 'pipe', 'baton', 'brick', 'forks', 'sprayer']) {
    assert.doesNotMatch(source, new RegExp("prop:'" + retired + "'"));
    assert.doesNotMatch(source, new RegExp("case '" + retired + "':"));
  }
  assert.match(source, /s\.prop==='none'/);
  assert.match(source, /segmented chest rig/);
  assert.match(source, /high-vis shin bands/);
});

test('enemy procedural role geometry remains merged into the existing rig anchors', async () => {
  const source = await read('src/enemyRoleKits.ts');
  assert.match(source, /mergeGeometries\(parts,false\)/);
  assert.match(source, /actorRigAnchor/);
  assert.match(source, /createEnemyRoleKit\(type:EnemyType,actorRoot:THREE\.Group\)/);
  assert.match(source, /ENEMY_ROLE_KIT_TYPES/);
});
