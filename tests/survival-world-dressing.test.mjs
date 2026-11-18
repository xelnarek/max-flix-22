import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SURVIVAL_MAPS, SURVIVAL_MAP_IDS } from '../src/survivalMaps.ts';
import { getSurvivalWorldDressingLayout } from '../src/survivalWorldDressing.ts';

test('every Survival map gets scaled impact-pit dressing without covering secret pickups', () => {
  for (const mapId of SURVIVAL_MAP_IDS) {
    const layout = getSurvivalWorldDressingLayout(mapId);
    assert.ok(layout.craters.length >= 1, mapId + ' should have terrain dressing');
    for (const crater of layout.craters) {
      assert.ok(crater.radius >= 1.5 && crater.radius <= 3.2, crater.id + ' scale');
      assert.ok(crater.x - crater.radius * 1.32 >= -56 && crater.x + crater.radius * 1.32 <= 56);
      assert.ok(crater.z - crater.radius * 1.32 >= -22 && crater.z + crater.radius * 1.32 <= 22);
      for (const secret of SURVIVAL_MAPS[mapId].secretLocations) {
        const clearance = Math.hypot(secret.x - crater.x, secret.z - crater.z);
        assert.ok(clearance > crater.radius * 1.32 + 1.2, crater.id + ' must not cover ' + secret.id);
      }
    }
  }
});

test('night sorting has a retro crashed saucer with a sensible collision footprint and accessible secrets', () => {
  const layout = getSurvivalWorldDressingLayout('night_sorting');
  assert.ok(layout.ufo);
  assert.ok(layout.ufo.scale >= 0.85 && layout.ufo.scale <= 1.15);
  assert.ok(layout.ufo.halfWidth >= 3 && layout.ufo.halfWidth <= 4.2);
  assert.ok(layout.ufo.halfDepth >= 2.4 && layout.ufo.halfDepth <= 3.5);
  const nearestSecret = Math.min(...SURVIVAL_MAPS.night_sorting.secretLocations.map((secret) =>
    Math.hypot(secret.x - layout.ufo.x, secret.z - layout.ufo.z)
  ));
  assert.ok(nearestSecret > 9);
});

test('world dressing joins the active map root and owned procedural textures are disposed with it', async () => {
  const [game, module] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/survivalWorldDressing.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /createSurvivalWorldDressing\(mapId\)/);
  assert.match(game, /root\.add\(anomalies\.group\)/);
  assert.match(game, /texture\.userData\.disposeOnObjectCleanup === true/);
  assert.match(module, /texture\.userData\.disposeOnObjectCleanup = true/);
  assert.match(module, /new THREE\.InstancedMesh/);
  assert.match(module, /ufo-alien-energy-cell-prop/);
});


test('all four connected Survival biomes have readable wall-mounted identity signage', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  const landmarksStart = game.indexOf('private buildSurvivalMapLandmarks(');
  const landmarksEnd = game.indexOf('\n  private registerCameraOccludersInGroup', landmarksStart);
  assert.ok(landmarksStart >= 0 && landmarksEnd > landmarksStart);
  const landmarks = game.slice(landmarksStart, landmarksEnd);
  for (const label of [
    "label: 'MAGAZYN B4'",
    "label: 'PORT KONTENEROWY 17'",
    "label: 'CHŁODNIA ZERO  •  -18°C'",
    "label: 'SORTOWNIA WIDMOWA'",
  ]) assert.ok(landmarks.includes(label), 'missing biome identity: ' + label);
  assert.match(landmarks, /const signSide = openEdges\.north \? 1 : -1/);
  assert.match(landmarks, /signGroup\.rotation\.y = signSide > 0 \? Math\.PI : 0/);
  assert.match(landmarks, /this\.registerCameraOccludersInGroup\(root, 0\.14\);[\s\S]*?root\.add\(signGroup\)/);
  assert.match(landmarks, /this\.survivalArenaInstanceGeometries\.add\(signFace\.geometry\)/);
});

test('map signage uses map-specific subtitles and releases cached GPU textures on teardown', async () => {
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /private getSurvivalArenaLabelMaterial\(label: string, accent: string, subtitle = 'CENTRUM B4  •  LOGISTYKA'\)/);
  assert.match(game, /const key = label \+ ':' \+ accent \+ ':' \+ subtitle/);
  assert.match(game, /context\.fillText\(subtitle, 276, 112, 420\)/);
  assert.match(game, /for \(const material of this\.survivalArenaLabelMaterials\.values\(\)\) \{\s*material\.map\?\.dispose\(\);\s*material\.dispose\(\);/);
});

test('enemy role kits add PPE knee pads and steel-toe details without increasing draw calls', async () => {
  const source = await readFile(new URL('../src/enemyRoleKits.ts', import.meta.url), 'utf8');
  const start = source.indexOf('function body(');
  const end = source.indexOf('\nfunction backGear(', start);
  assert.ok(start >= 0 && end > start, 'enemy role body builder should exist');
  const body = source.slice(start, end);
  assert.match(body, /Warehouse PPE: sculpted knee pads/);
  assert.match(body, /for\(const side of \[-1,1\]\)/);
  assert.match(body, /sp\(groups,'legs',dark,\[side\*\.14,\.245,\.228\]/);
  assert.match(body, /bx\(groups,'legs',s\.accent,\[side\*\.14,\.245,\.271\]/);
  assert.match(body, /sp\(groups,'legs',metal,\[side\*\.14,\.105,\.236\]/);
  assert.match(source, /mergeGeometries\(parts,false\)/);
});
