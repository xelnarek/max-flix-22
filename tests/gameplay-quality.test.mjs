import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival surge uses an even ring, not direct straight-line runner movement', async () => {
  const [game, horde] = await Promise.all([read('../src/game.ts'), read('../src/survivalHorde.ts')]);
  assert.match(game, /beginSurvivalHordeSurge\(\)/);
  assert.match(game, /survival_horde_closing_ring/);
  assert.match(game, /getHordeRingPoint\(/);
  assert.match(game, /inHordeRing\s*=\s*!!enemy\.surgeRunner/);
  assert.match(game, /preferredRadius\s*=\s*inHordeRing\s*\?\s*this\.survivalSurgeCurrentRadius/);
  assert.match(game, /anchorX\s*\+\s*Math\.sin\(angle\)\s*\*\s*preferredRadius/);
  assert.match(game, /anchorZ\s*\+\s*Math\.cos\(angle\)\s*\*\s*preferredRadius\s*\*\s*\(inHordeRing\s*\?\s*0\.62\s*:\s*1\)/);
  assert.doesNotMatch(game, /if\s*\(enemy\.surgeRunner\)\s*\{\s*const dx = this\.playerPos\.x - enemy\.x/);
  assert.match(horde, /verticalScale\s*=\s*1/);
});

test('the horde ring tracks the player and contracts over the event duration', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /this\.survivalSurgeCenterX = THREE\.MathUtils\.clamp\(\s*this\.playerPos\.x/);
  assert.match(game, /this\.survivalSurgeCenterZ = THREE\.MathUtils\.clamp\(\s*this\.playerPos\.z/);
  assert.match(game, /ringGroup\.position\.set\(this\.survivalSurgeCenterX/);
  assert.match(game, /this\.survivalSurgeCurrentRadius = radius/);
  assert.match(game, /getHordeRingRadius\(progress, initialRadius, finalRadius\)/);
  assert.match(game, /durationSeconds/);
});

test('the old green adhesive puddle is removed from all live trap data', async () => {
  const [game, types, assets] = await Promise.all([
    read('../src/game.ts'), read('../src/types.ts'), read('../src/warehouseAssets.ts')
  ]);
  assert.doesNotMatch(game, /addGlueSpillTrap|createGlueSpillTrapModel|glue_spill/);
  assert.doesNotMatch(types, /glue_spill/);
  assert.doesNotMatch(assets, /createGlueSpillTrapModel|trap_glue_spill/);
  assert.match(game, /type: 'stretch_barrier'/);
  assert.match(game, /type: 'roller_gate'/);
  assert.match(game, /h\.type === 'stretch_barrier'/);
  assert.match(game, /h\.type === 'roller_gate'/);
});

test('new physical hazards are included in both campaign and Survival trap cycles', async () => {
  const game = await read('../src/game.ts');
  const assets = await read('../src/warehouseAssets.ts');
  assert.match(assets, /export function createStretchFilmBarrierModel/);
  assert.match(assets, /export function createRollerGateTrapModel/);
  assert.match(game, /addStretchFilmBarrierTrap\('stretch_l1_1'/);
  assert.match(game, /addRollerGateTrap\('roller_l1_1'/);
  assert.match(game, /addStretchFilmBarrierTrap\('stretch_l2_1'/);
  assert.match(game, /addRollerGateTrap\('roller_l2_1'/);
  assert.match(game, /addStretchFilmBarrierTrap\('stretch_l3_1'/);
  assert.match(game, /addRollerGateTrap\('roller_l3_1'/);
  assert.match(game, /switch \(this\.survivalHazardSequence % 6\)/);
  assert.match(game, /this\.addRollerGateTrap\(id, x, z/);
  assert.match(game, /spawnedTrap\.life = 36/);
});

test('steam geyser no longer overwrites jump velocity with an extreme vertical impulse', async () => {
  const game = await read('../src/game.ts');
  assert.doesNotMatch(game, /playerVel\.y\s*=\s*16\.5/);
  assert.match(game, /PODMUCH PARY — ODSKOCZ W BOK/);
  assert.match(game, /this\.playerVel\.x \+= directionX \* 3\.2/);
  assert.match(game, /this\.playerVel\.z \+= directionZ \* 3\.2/);
  assert.match(game, /const horizontalSpeed = Math\.hypot\(this\.playerVel\.x, this\.playerVel\.z\)/);
});

test('campaign map receives instanced warehouse structure without per-frame creation', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /this\.buildCampaignHighBayDressing\(\)/);
  assert.match(game, /private buildCampaignHighBayDressing\(\)/);
  assert.match(game, /new THREE\.InstancedMesh/);
  assert.match(game, /this\.addSurvivalArenaInstance\(crossTrusses\)/);
  assert.match(game, /this\.addSurvivalArenaInstance\(fixtures\)/);
  assert.match(game, /private disposeSurvivalArenaInstances\(\)/);
});

test('campaign start opens the five-act briefing and the final action starts the game', async () => {
  const [app, html] = await Promise.all([read('../src/index.ts'), read('../index.html')]);
  assert.match(html, /id="story-intro-modal"/);
  assert.match(html, /id="btn-open-story-modal"/);
  assert.match(app, /const launchCampaignGame = async/);
  assert.match(app, /const doStartGame = \(e\?: Event\) =>/);
  assert.match(app, /openCampaignBriefing\(\);/);
  assert.match(app, /openCampaignBriefing = \(\) => \{/);
  assert.match(app, /btnStoryPlay\?\.addEventListener\('click',[\s\S]*?launchCampaignGame\(\)/);
});

test('device-aware viewport profile is applied immediately after the renderer becomes available', async () => {
  const [app, css, viewport] = await Promise.all([
    read('../src/index.ts'), read('../src/visual-polish.css'), read('../src/uiViewport.ts')
  ]);
  assert.match(app, /calculateUiViewport\(width, height, isTouch\)/);
  assert.match(app, /hasAppliedInitialViewport/);
  assert.match(app, /this\.applyInitialViewportProfile\(\)/);
  assert.match(app, /root\.dataset\.uiDensity = profile\.density/);
  assert.match(css, /data-ui-density="compact"/);
  assert.match(css, /data-ui-density="wide"/);
  assert.match(css, /data-ui-landscape-touch="true"/);
  assert.match(viewport, /export function calculateUiViewport/);
});
