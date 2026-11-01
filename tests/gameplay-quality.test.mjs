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

test('primary campaign CTA starts immediately while briefing stays optional and touch-operable', async () => {
  const [app, html] = await Promise.all([read('../src/index.ts'), read('../index.html')]);
  assert.match(html, /id="story-intro-modal"/);
  assert.match(html, /id="btn-open-story-modal"/);
  assert.match(app, /const launchCampaignGame = async/);
  assert.match(app, /startingGame = true;[\s\S]*?await assetLoader\.waitUntilReady\('Gra 3D'\)/);
  assert.match(app, /this\.engine\.startGame\(this\.selectedLevelId\)/);
  assert.match(app, /const doStartGame = \(e\?: Event\) => \{\s*void launchCampaignGame\(e\);/);
  assert.match(app, /bindTap\(startBtn, doStartGame\)/);
  assert.match(app, /openCampaignBriefing = \(\) => \{/);
  assert.match(app, /bindTap\(btnStoryPlay,[\s\S]*?launchCampaignGame\(event\)/);
  assert.match(app, /campaign-start-error/);
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

test('campaign mega-map always assembles all three connected sectors from every campaign start', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /public startGame\(levelId = 1\)/);
  assert.match(game, /this\.loadLevel\(levelId\)/);
  const loadLevel = game.slice(game.indexOf('public loadLevel(levelId: number)'), game.indexOf('private buildCampaignHighBayDressing'));
  assert.match(loadLevel, /this\.buildLevel1\(\)/);
  assert.match(loadLevel, /this\.buildLevel2\(76\)/);
  assert.match(loadLevel, /this\.buildLevel3\(161\)/);
  assert.match(loadLevel, /minX: -36, maxX: 206/);
  assert.match(loadLevel, /this\.buildSectorGate\(36, 2\)/);
  assert.match(loadLevel, /this\.buildSectorGate\(116, 3\)/);
});

test('camera fades only tagged perimeter walls that intersect the camera-to-player ray', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private registerCameraOccluder\(mesh: THREE\.Mesh\)/);
  assert.match(game, /private updateCameraOcclusion\(dt: number\)/);
  assert.match(game, /cameraOcclusionRaycaster\.intersectObjects\(this\.cameraOccluders, false\)/);
  assert.match(game, /this\.cameraOcclusionCooldown = 0\.075/);
  assert.match(game, /Math\.min\(original\.opacity, 0\.18\)/);
  assert.match(game, /this\.restoreCameraOccluders\(\)/);
  assert.match(game, /this\.updateCameraOcclusion\(dt\)/);
  assert.ok((game.match(/this\.registerCameraOccluder\(backWall\)/g) || []).length >= 3);
});

test('touch Survival HUD wins the final CSS cascade and keeps the camera rail off the playfield', async () => {
  const [css, finalHudCss, html] = await Promise.all([
    read('../src/index.css'), read('../src/hud-layout.css'), read('../index.html')
  ]);
  assert.match(css, /Compact Survival HUD: keep the actual arena visible/);
  assert.match(css, /width: min\(248px, calc\(100vw - 138px\)\)/);
  assert.match(css, /\.survival-weapon-rack,[\s\S]*?display: none !important/);
  assert.match(css, /top: calc\(98px \+ env\(safe-area-inset-top\)\)/);
  assert.match(finalHudCss, /Final Survival mobile HUD owner/);
  assert.match(finalHudCss, /#game-shell\.survival-mode \.survival-hud\s*\{[\s\S]*?right: max\(8px, env\(safe-area-inset-right\)\) !important/);
  assert.match(finalHudCss, /#game-shell\.survival-mode #hud-top \.cam-zoom-slider-container\s*\{\s*display: none !important/);
  assert.ok(html.indexOf('visual-polish.css') < html.indexOf('hud-layout.css'), 'final touch HUD override must load after legacy visual-polish rules');
});

test('Survival menu copy stays synchronized with the actual 60-second wave clock', async () => {
  const [game, html] = await Promise.all([read('../src/game.ts'), read('../index.html')]);
  assert.match(game, /const nextWave = 1 \+ Math\.floor\(this\.survivalElapsed \/ 60\)/);
  assert.match(html, /AUTO-ATAK • FALE CO 60 S/);
  assert.doesNotMatch(html, /FALE CO 42 S/);
});

test('pixel intro has a single mobile-safe launch path and cannot start twice from touch plus synthetic click', async () => {
  const [app, intro] = await Promise.all([read('../src/index.ts'), read('../src/pixelIntro.ts')]);
  assert.match(app, /if \(this\.pixelIntro\?\.isRunning\(\)\) return/);
  assert.match(app, /btn-open-pixel-intro'\)\?\.addEventListener\('click', launchPixelIntro\)/);
  assert.doesNotMatch(app, /btn-open-pixel-intro'\)\?\.addEventListener\('touchend', launchPixelIntro\)/);
  assert.match(intro, /MAX-FLIX I GRANICA ABSURDU/);
  assert.match(intro, /INWENTARYZACJA: 0 BŁĘDÓW/);
});

test('Survival start locks duplicate taps before awaiting shared asset readiness', async () => {
  const app = await read('../src/index.ts');
  const start = app.indexOf('const doStartSurvival = async');
  const end = app.indexOf('const bindTap =', start);
  assert.ok(start >= 0 && end > start, 'Survival startup handler should be present');
  const handler = app.slice(start, end);
  assert.match(handler, /startingGame = true;[\s\S]*?await assetLoader\.waitUntilReady\('Gra 3D'\)/);
  assert.match(handler, /if \(startingGame\) return/);
  assert.match(handler, /finally \{[\s\S]*?startingGame = false/);
  assert.match(handler, /startButton\.disabled = true/);
});


test('mobile campaign and Survival HUD elements occupy separate touch-screen lanes', async () => {
  const [layout, html] = await Promise.all([
    read('../src/hud-layout.css'), read('../index.html')
  ]);
  assert.match(html, /href="\/src\/hud-layout\.css"/);
  assert.match(layout, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(layout, /#game-shell:not\(\.survival-mode\) #minimap-container[\s\S]*?top: calc\(112px/);
  assert.match(layout, /#game-shell:not\(\.survival-mode\) #hud-top \.boss-hud-bar[\s\S]*?top: calc\(112px/);
  assert.match(layout, /#game-shell\.survival-mode #hud-top \.hud-top-stats-row\s*\{\s*display: none !important/);
  assert.match(layout, /#game-shell\.survival-mode #survival-hud[\s\S]*?top: max\(6px/);
  assert.match(layout, /#game-shell\.survival-mode #minimap-container[\s\S]*?top: calc\(52px/);
  assert.match(layout, /#fps-badge\s*\{\s*display: none !important/);
  assert.match(layout, /#game-shell \.touch-actions-zone \.touch-action-btn[\s\S]*?width: clamp\(54px/);
});
