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
  assert.match(game, /cameraOcclusionRaycaster\.intersectObjects\(this\.cameraOccluders, false, hits\)/);
  assert.match(game, /this\.cameraOcclusionCooldown = 0\.075/);
  assert.match(game, /Math\.min\(original\.opacity, 0\.18\)/);
  assert.match(game, /this\.restoreCameraOccluders\(\)/);
  assert.match(game, /this\.updateCameraOcclusion\(dt\)/);
  assert.ok((game.match(/this\.registerCameraOccluder\(backWall\)/g) || []).length >= 3);
});

test('touch Survival HUD keeps the zoom slider and 3D camera switch accessible', async () => {
  const [css, finalHudCss, html] = await Promise.all([
    read('../src/index.css'), read('../src/hud-layout.css'), read('../index.html')
  ]);
  assert.match(css, /Compact Survival HUD: keep the actual arena visible/);
  assert.match(css, /width: min\(248px, calc\(100vw - 138px\)\)/);
  assert.match(css, /\.survival-weapon-rack,[\s\S]*?display: none !important/);
  assert.match(css, /top: calc\(98px \+ env\(safe-area-inset-top\)\)/);
  assert.match(finalHudCss, /Final Survival mobile HUD owner/);
  assert.match(finalHudCss, /#game-shell\.survival-mode \.survival-hud\s*\{[\s\S]*?right: max\(8px, env\(safe-area-inset-right\)\) !important/);
  assert.match(finalHudCss, /#game-shell\.survival-mode #hud-top \.hud-top-quick-controls\s*\{[\s\S]*?position: fixed !important/);
  assert.match(finalHudCss, /#game-shell\.survival-mode #hud-top \.cam-zoom-slider-container,[\s\S]*?#game-shell\.survival-mode #hud-top #btn-top-camera\s*\{\s*display: flex !important/);
  assert.match(finalHudCss, /#game-shell\.survival-mode #hud-top #btn-top-event\s*\{\s*display: none !important/);
  const legacyHiddenRuleIndex = finalHudCss.indexOf('display: none !important;', finalHudCss.indexOf('/* The old touch toolbar'));
  const visibleRailRuleIndex = finalHudCss.indexOf('/* Survival camera rail');
  assert.ok(legacyHiddenRuleIndex >= 0 && visibleRailRuleIndex > legacyHiddenRuleIndex, 'the camera rail override must come after the legacy hidden rule');
  assert.match(finalHudCss.slice(visibleRailRuleIndex), /#game-shell\.survival-mode #hud-top \.cam-zoom-slider-container,[\s\S]*?#game-shell\.survival-mode #hud-top #btn-top-camera\s*\{\s*display: flex !important/);
  assert.match(finalHudCss, /@media \(max-width: 390px\)[\s\S]*?#game-shell\.survival-mode #hud-top #btn-top-camera/);
  assert.ok(html.indexOf('visual-polish.css') < html.indexOf('hud-layout.css'), 'final touch HUD override must load after legacy visual-polish rules');
});

test('camera zoom controls stay synchronized with manual zoom and viewport defaults', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private syncCameraZoomControl\(\)/);
  assert.match(game, /this\.camZoomFactor = Math\.min\(2\.2, this\.camZoomFactor \+ 0\.15\)/);
  assert.match(game, /if \(!Number\.isFinite\(val\)\) return/);
  assert.match(game, /this\.hasManualCameraZoom = true/);
  assert.match(game, /if \(!this\.hasManualCameraZoom\)/);
  assert.match(game, /this\.syncCameraZoomControl\(\)/);
});
test('Survival menu copy stays synchronized with the actual 60-second wave clock', async () => {
  const [game, html] = await Promise.all([read('../src/game.ts'), read('../index.html')]);
  assert.match(game, /const nextWave = 1 \+ Math\.floor\(this\.survivalElapsed \/ 60\)/);
  assert.match(html, /AUTO-ATAK • FALE CO 60 S/);
  assert.doesNotMatch(html, /FALE CO 42 S/);
});

test('pixel intro has a single mobile-safe launch path and cannot start twice from touch plus synthetic click', async () => {
  const [app, intro] = await Promise.all([read('../src/index.ts'), read('../src/pixelIntro.ts')]);
  assert.match(app, /if \(this\.pixelIntro\?\.isRunning\(\) \|\| pixelIntroLaunchPending\) return/);
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


test('Campaign and Survival HUD no longer reserve or render a minimap lane', async () => {
  const [layout, html] = await Promise.all([
    read('../src/hud-layout.css'), read('../index.html')
  ]);
  assert.match(html, /href="\/src\/hud-layout\.css"/);
  assert.doesNotMatch(html, /id="minimap-container"|id="minimap-canvas"/);
  assert.match(layout, /#minimap-container,[\s\S]*?\.minimap-container\s*\{[\s\S]*?display: none !important/);
  assert.match(layout, /#game-shell:not\(\.survival-mode\) #hud-top \.boss-hud-bar[\s\S]*?left: max\(6px/);
  assert.match(layout, /#game-shell\.survival-mode #hud-top \.boss-hud-bar[\s\S]*?top: calc\(112px/);
  assert.match(layout, /#game-shell\.survival-mode #hud-top \.hud-top-stats-row\s*\{\s*display: none !important/);
  assert.match(layout, /#game-shell\.survival-mode #survival-hud[\s\S]*?top: calc\(42px/);
  assert.match(layout, /#game-shell\.survival-mode #btn-touch-attack\s*\{\s*display: none !important/);
  assert.match(layout, /#fps-badge\s*\{\s*display: none !important/);
  assert.match(layout, /#game-shell \.touch-actions-zone \.touch-action-btn[\s\S]*?width: clamp\(54px/);
});


test('opening Retro Intro autoplays after boot and always layers above the game shell', async () => {
  const [app, css, intro] = await Promise.all([
    read('../src/index.ts'), read('../src/index.css'), read('../src/pixelIntro.ts')
  ]);
  assert.match(app, /const introButton = document\.getElementById\('btn-open-pixel-intro'\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => resolve\(\)\)\)/);
  assert.match(app, /introButton\.click\(\)/);
  assert.match(intro, /overlay\.style\.zIndex = '20000000'/);
  assert.match(css, /#pixel-intro-overlay\.pixel-intro-overlay\s*\{[\s\S]*?z-index: 20000000 !important/);
  assert.match(css, /#pixel-intro-overlay::before,[\s\S]*?pointer-events: none !important/);
});

test('Retro Intro avoids duplicate touch activation and caps Canvas rendering on mobile', async () => {
  const intro = await read('../src/pixelIntro.ts');
  assert.match(intro, /this\.targetFrameIntervalMs = isMobile \? 1000 \/ 30 : 1000 \/ 45/);
  assert.match(intro, /this\.canvas\.width = mobile \? 960 : 1280/);
  assert.match(intro, /this\.canvas\.height = mobile \? 540 : 720/);
  assert.match(intro, /this\.sceneStepElements = Array\.from\(overlay\.querySelectorAll/);
  assert.match(intro, /INTRO_SUBTITLES\[this\.currentScene\]/);
  assert.doesNotMatch(intro, /addEventListener\('touchend'/);
  assert.match(intro, /if \(this\.animFrameId !== null\) \{[\s\S]*?cancelAnimationFrame\(this\.animFrameId\)/);
});

test('Campaign boss proximity UI is throttled and only updates when its state changes', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /this\.updateSectorProgression\(simDt\)/);
  assert.match(game, /private updateSectorProgression\(dt: number\)/);
  assert.match(game, /this\.bossHudRefreshCooldown = 0\.12/);
  assert.match(game, /const distanceSq = dx \* dx \+ dz \* dz/);
  assert.match(game, /signature !== this\.lastBossHudSignature/);
});

test('minimap is fully removed from the HUD and no longer consumes main-loop time', async () => {
  const [app, html, game] = await Promise.all([
    read('../src/index.ts'), read('../index.html'), read('../src/game.ts')
  ]);
  const tickStart = app.indexOf('private tick(dt: number)');
  const tickEnd = app.indexOf('onSelectEnd(', tickStart);
  assert.ok(tickStart >= 0 && tickEnd > tickStart);
  const tick = app.slice(tickStart, tickEnd);
  assert.doesNotMatch(html, /minimap-container|minimap-canvas/);
  assert.doesNotMatch(app, /minimapCanvasElement|minimapContainerElement|renderMinimap/);
  assert.doesNotMatch(tick, /getClientRects\(\)|minimap/);
  assert.doesNotMatch(game, /e\.code === 'KeyN'/);
});





test('Survival crowd rendering defers distant model attachments and limits shadow casters', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /enemy\.mesh\.userData\.enemyVisualPolishPending = true/);
  assert.match(game, /e\.mesh\.userData\.enemyVisualPolishPending[\s\S]*?distToPlayer <= \(this\.isHandheldViewport \? 15 : 20\)/);
  assert.match(game, /const canCastShadow = \(isBoss \|\| enemy\.type === 'sebix_m'\) && !this\.isHandheldViewport/);
  assert.match(game, /child\.castShadow = canCastShadow/);
  assert.match(game, /this\.dirLight\.shadow\.autoUpdate = !isMobile/);
  assert.match(game, /this\.mobileShadowRefreshCooldown = 1 \/ 24/);
});

test('camera wall fades reuse raycast results and only update materials on state changes', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /cameraOcclusionHits: THREE\.Intersection<THREE\.Object3D>\[\]/);
  assert.match(game, /intersectObjects\(this\.cameraOccluders, false, hits\)/);
  assert.match(game, /if \(shouldFade === state\.isFaded\) continue/);
  assert.match(game, /if \(shaderVariantChanged\) material\.needsUpdate = true/);
  assert.doesNotMatch(game, /const hitMeshes = new Set\(/);
});

test('primary attacks use character-specific range-based projectile lifetimes', async () => {
  const [game, balance] = await Promise.all([read('../src/game.ts'), read('../src/combatBalance.ts')]);
  assert.match(balance, /PRIMARY_ATTACK_RANGE_METERS/);
  assert.match(game, /getPrimaryAttackLifetimeSeconds\('marcin', 14\.2\)/);
  assert.match(game, /getPrimaryAttackLifetimeSeconds\('grzesiek', 14\.6\)/);
  assert.match(game, /getPrimaryAttackLifetimeSeconds\('dawid', 14\.8\)/);
  assert.match(game, /getPrimaryAttackLifetimeSeconds\('mateusz', 19\.5\)/);
  assert.match(game, /getPiotrBoomerangMaxLifeSeconds\(22\.5\)/);
});

test('projectile collision checks the full movement segment rather than only its endpoint', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /previousProjectileX/);
  assert.match(game, /segmentLengthSq/);
  assert.match(game, /const closestX = previousProjectileX \+ segmentX \* projection/);
  assert.match(game, /Math\.abs\(closestY - e\.y\) < 1\.35/);
});

test('fullscreen and orientation changes reset touch input and reflow the viewport', async () => {
  const app = await read('../src/index.ts');
  assert.match(app, /document\.addEventListener\('fullscreenchange', handleFullscreenChange\)/);
  assert.match(app, /document\.addEventListener\('webkitfullscreenchange', handleFullscreenChange\)/);
  assert.match(app, /this\.resetTouchJoystick\?\.\(\)/);
  assert.match(app, /const getJoystickRadius = \(\) =>/);
  assert.match(app, /maxRadius = getJoystickRadius\(\)/);
});


test('Survival spawn candidates prefer clear lanes and fall back to the least crowded point', async () => {
  const [game, spacing] = await Promise.all([
    read('../src/game.ts'),
    read('../src/enemySpacing.ts'),
  ]);
  assert.match(game, /chooseSpacedSpawnPoint\(candidates, this\.enemies, 3\.2\)/);
  assert.match(spacing, /nearestSquared >= minimumSquared/);
  assert.match(spacing, /nearestSquared > bestNearestSquared/);
});

test('campaign chase and Survival steering both apply enemy separation', async () => {
  const game = await read('../src/game.ts');
  assert.ok((game.match(/calculateEnemySeparationVector\(/g) || []).length >= 2);
  assert.match(game, /moveX = dx \/ Math\.max\(0\.1, distToPlayer\) \+ separation\.x \* 1\.2/);
  assert.match(game, /const separationX = separation\.x/);
});


test('campaign and Survival crowd steering use a reusable spatial broad-phase index', async () => {
  const [game, spacing] = await Promise.all([
    read('../src/game.ts'),
    read('../src/enemySpacing.ts'),
  ]);
  assert.match(spacing, /export class EnemySpatialIndex/);
  assert.match(game, /new EnemySpatialIndex<EnemyItem>\(4\.0\)/);
  assert.match(game, /this\.enemySpatialIndex\.rebuild\(this\.enemies\)/);
  assert.match(game, /this\.enemySpatialIndex\.query\(enemy\.x, enemy\.z, 4\.1\)/);
  assert.match(game, /this\.enemySpatialIndex\.query\(e\.x, e\.z, 4\.0\)/);
});


test('enemy hit feedback creates bounded recoil and a smooth pulse envelope', async () => {
  const feedback = await read('../src/enemyCombatFeedback.ts');
  assert.match(feedback, /export function createEnemyHitReaction/);
  assert.match(feedback, /export function getEnemyHitPulse/);
  assert.match(feedback, /Math\.min\(0\.48/);
  assert.match(feedback, /Math\.min\(1\.05/);
});

test('all damaging systems use the shared enemy hit-response path', async () => {
  const [game, types] = await Promise.all([read('../src/game.ts'), read('../src/types.ts')]);
  assert.match(game, /private damageEnemy\(/);
  assert.match(game, /private triggerEnemyHitReaction\(/);
  assert.match(game, /private updateEnemyHitReaction\(/);
  assert.match(game, /this\.updateEnemyHitReaction\(e, dt\)/);
  assert.match(types, /hitBaseScale\?: \{ x: number; y: number; z: number \}/);
  assert.doesNotMatch(game, /(?:enemy|target|other|[e])\.hp\s*-=\s*(?:weaponDamage|1|3|baseDmg|damage|this\.scaleSurvivalDamage)/);
});

test('AGV-9 and Bosman telegraphs match their committed projectile lanes', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /spawnBossLaneTelegraph\(e\.x, e\.z, e\.chargeDir, 14\.0, 1\.8, 0xef4444, 0\.9\)/);
  assert.match(game, /spawnSparkZapProjectile\(e\.x, e\.y \+ 0\.75, e\.z, lockedDirection\)/);
  assert.match(game, /spawnOdprawaClipboardProjectile\(e\.x, e\.y \+ 1\.0, e\.z, lockedDirection\)/);
  assert.match(game, /BOSMAN: ODPRAWA PRZYSPIESZONA — FAZA 2/);
  assert.match(game, /spawnBossLaneTelegraph\(e\.x, e\.z, direction, isPhase2 \? 14\.0 : 11\.5/);
});

test('every eighth Survival kill grants a small collectable XP milestone reward', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('const isShiftMilestone = this.survivalKills % 8 === 0;');
  const end = game.indexOf("if (e.type === 'pomazaniec')", start);
  assert.ok(start >= 0 && end > start, 'eight-kill milestone block should exist');
  const milestone = game.slice(start, end);
  assert.match(milestone, /const isShiftMilestone = this\.survivalKills % 8 === 0/);
  assert.match(milestone, /baseXpDrop \+ \(isShiftMilestone \? 2 : 0\)/);
  assert.doesNotMatch(milestone, /spawnSurvivalXpGem\(e\.x, e\.y, e\.z, 2\)/);
  assert.match(milestone, /NORMA ZMIANY x8 — BONUS \+2 XP DO ZEBRANIA/);
});

test('the removed minimap has no remaining engine state, renderer or DOM hooks', async () => {
  const [game, app] = await Promise.all([read('../src/game.ts'), read('../src/index.ts')]);
  assert.doesNotMatch(game, /minimap|renderMinimap|zoomInMinimap|zoomOutMinimap|toggleMinimap/i);
  assert.doesNotMatch(app, /minimapCanvasElement|minimapContainerElement|renderMinimap|\.minimap-container/);
});

test('Survival rapid-upgrade copy matches its conservative three-percent cooldown effect', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /id: 'rapid', icon: '⚡', title: 'RYTM ATAKU', description: 'Skrócenie czasu między atakami o 3%\.'/);
  assert.match(game, /this\.survivalAttackRateMultiplier = Math\.max\(0\.86, this\.survivalAttackRateMultiplier \* 0\.97\)/);
});


test('Campaign and Survival both separate enemy models from the player after contact handling', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private resolveEnemyPlayerOverlap\(enemy: EnemyItem, minimumDistance: number\)/);
  assert.match(game, /resolveEnemyPlayerSeparation\(/);
  assert.match(game, /Math\.abs\(enemy\.y - this\.playerPos\.y\) >= 1\.1/);
  assert.match(game, /enemy\.mesh\.position\.x = resolved\.x/);
  assert.match(game, /enemy\.mesh\.position\.z = resolved\.z/);
  const contactStart = game.indexOf('// Check collision with player');
  const contactEnd = game.indexOf('private spawnPenaltyNotice', contactStart);
  assert.ok(contactStart >= 0 && contactEnd > contactStart, 'shared contact handler should exist');
  const contact = game.slice(contactStart, contactEnd);
  assert.match(contact, /let stompedThisFrame = false/);
  assert.match(contact, /stompedThisFrame = true/);
  assert.match(contact, /const contactRadius = hitRadius \+ 0\.18/);
  assert.match(contact, /if \(dist < contactRadius\)/);
  assert.match(contact, /if \(dist < hitRadius && this\.playerVel\.y < -0\.8/);
  assert.match(contact, /this\.resolveEnemyPlayerOverlap\(e, contactRadius\)/);
  assert.ok(contact.indexOf('if (dist < contactRadius)') < contact.indexOf('this.resolveEnemyPlayerOverlap(e, contactRadius)'));
});


test('Survival spawn fallback searches distant arena edges instead of a clamped player-relative offset', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const fallbackCandidates: \{ x: number; z: number \}\[\] = \[\]/);
  assert.match(game, /Math\.hypot\(point\.x - this\.playerPos\.x, point\.z - this\.playerPos\.z\) >= 12/);
  assert.match(game, /const fallback = chooseSpacedSpawnPoint\(safeFallbacks, this\.enemies, 3\.2\)/);
  assert.match(game, /Last-resort bounded point: choose the farthest arena corner from the player/);
});


test('campaign ground enemies cache warehouse obstacle footprints for navigation', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /private campaignEnemyObstacles: \{ x: number; z: number; halfWidth: number; halfDepth: number \}\[\] = \[\]/);
  assert.match(game, /this\.campaignEnemyObstacles = this\.platforms[\s\S]*?platform\.type === 'shelf'[\s\S]*?platform\.y <= 1\.65/);
  assert.match(game, /this\.campaignEnemyObstacles = \[\]/);
});

test('campaign chase and lost-target search both use obstacle-aware steering', async () => {
  const game = await read('../src/game.ts');
  assert.ok((game.match(/calculateEnemyObstacleAvoidanceVector\(/g) || []).length >= 2);
  assert.match(game, /calculateEnemyObstacleAvoidanceVector\(e, e\.lastKnownPlayerPos, this\.campaignEnemyObstacles/);
  assert.match(game, /this\.campaignEnemyObstacles,[\s\S]*?4\.6,[\s\S]*?0\.8/);
});


test('campaign bosses use warehouse obstacle-aware pursuit without moving during committed telegraphs', async () => {
  const game = await read('../src/game.ts');
  const walczakStart = game.indexOf("} else if (e.type === 'walczak')");
  const letoStart = game.indexOf("} else if (e.type === 'krol_leto')", walczakStart);
  const genericStart = game.indexOf("      } else {\n        if (e.type === 'sebix_m')", letoStart);
  assert.ok(walczakStart >= 0 && letoStart > walczakStart && genericStart > letoStart);
  const walczak = game.slice(walczakStart, letoStart);
  const leto = game.slice(letoStart, genericStart);
  assert.ok(walczak.includes('calculateEnemyObstacleAvoidanceVector('));
  assert.ok(walczak.includes('this.campaignEnemyObstacles'));
  assert.ok(walczak.includes('5.4,\n              1.25'));
  assert.ok(leto.includes('calculateEnemyObstacleAvoidanceVector('));
  assert.ok(leto.includes('this.campaignEnemyObstacles'));
  assert.ok(leto.includes('5.8,\n              1.35'));
  assert.ok(walczak.indexOf('if (isChargingImpact)') < walczak.indexOf('const avoidance = calculateEnemyObstacleAvoidanceVector('));
  assert.ok(leto.indexOf('if (e.chargeTimer !== undefined)') < leto.indexOf('const avoidance = calculateEnemyObstacleAvoidanceVector('));
});


test('Survival crowd steering routes toward its formation target around obstacles', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private updateSurvivalEnemyTactics');
  const end = game.indexOf('private damageEnemy', start);
  assert.ok(start >= 0 && end > start, 'Survival tactics method should be present');
  const tactics = game.slice(start, end);
  assert.match(tactics, /calculateEnemyObstacleAvoidanceVector\([\s\S]*?\{ x: targetX, z: targetZ \}[\s\S]*?this\.survivalObstacles[\s\S]*?4\.6[\s\S]*?0\.8/);
  assert.match(tactics, /steerX \+= separationX \* 3\.0 \+ obstacleAvoidance\.x \* 1\.25/);
  assert.doesNotMatch(tactics, /for \(const obstacle of this\.survivalObstacles\)/);
  assert.match(tactics, /if \(isTelegraphingRangedBoss\) \{[\s\S]*?steerX = 0;[\s\S]*?steerZ = 0/);
});


test('Survival random boss spawns never stack active Bosman encounters', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /const bosmanAlreadyActive = this\.enemies\.some\(\(enemy\) =>[\s\S]*?enemy\.type === 'bosman_krakow' && enemy\.state !== 'defeated'/);
  assert.match(game, /shouldSpawnBosmanKrakow\(wave, Math\.random\(\), bosmanAlreadyActive\)/);
});


test('campaign roaming rewards use the current mega-map sector while Survival stays arena-centred', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /chooseCampaignRewardSpawnPoint\(this\.currentActiveSector, Math\.random\(\), Math\.random\(\), this\.campaignEnemyObstacles\)/);
  assert.match(game, /this\.gameMode === 'campaign'[\s\S]*?chooseCampaignRewardSpawnPoint[\s\S]*?: \{ x: \(Math\.random\(\) - 0\.5\) \* 44, z: \(Math\.random\(\) - 0\.5\) \* 14 \}/);
  const progression = game.slice(game.indexOf('private updateSectorProgress'), game.indexOf('private updateRandomSpawners'));
  assert.match(progression, /this\.currentActiveSector = newSector/);
});


test('collected pickups are removed from the per-frame collection and magnet pulls avoid zero-distance division', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private updateCollectibles(dt: number)');
  const end = game.indexOf('\n  private ', start + 10);
  assert.ok(start >= 0 && end > start, 'collectible update method should be present');
  const update = game.slice(start, end);

  assert.match(update, /for \(let i = this\.collectibles\.length - 1; i >= 0; i--\)/);
  assert.match(update, /if \(c\.collected \|\| !c\.mesh\) \{\s*this\.collectibles\.splice\(i, 1\);/);
  assert.match(update, /if \(magDist > 0\.001 && magDist < 8\.5\)/);
  assert.doesNotMatch(update, /this\.collectibles\.forEach/);

  const scoreUpdate = update.indexOf('this.callbacks.onScoreUpdate');
  const pickupRemoval = update.indexOf('this.collectibles.splice(i, 1)', scoreUpdate);
  assert.ok(scoreUpdate >= 0 && pickupRemoval > scoreUpdate, 'a picked-up item should be removed after its reward is applied');
});


test('collected pickup models and their owned dynamic textures release GPU resources', async () => {
  const [game, assets] = await Promise.all([
    read('../src/game.ts'),
    read('../src/warehouseAssets.ts'),
  ]);
  const updateStart = game.indexOf('private updateCollectibles(dt: number)');
  const updateEnd = game.indexOf('\n  private ', updateStart + 10);
  assert.ok(updateStart >= 0 && updateEnd > updateStart);
  const update = game.slice(updateStart, updateEnd);
  assert.match(update, /this\.levelRoot\.remove\(c\.mesh\);\s*this\.disposeObjectResources\(c\.mesh\);/);

  assert.match(game, /private disposeObjectResources\(object: THREE\.Object3D\)/);
  assert.match(game, /object\.traverse\(\(child\) => \{[\s\S]*?child\.userData\.dynamicTextures/);
  assert.match(game, /this\.disposeTemporaryObject\(object\);\s*dynamicTextures\.forEach\(\(texture\) => texture\.dispose\(\)\)/);
  assert.match(game, /private disposePomazaniecObject\(object: THREE\.Object3D\) \{\s*this\.disposeObjectResources\(object\);/);

  assert.match(assets, /const bucketTex = new THREE\.CanvasTexture\(canvas\);\s*bucketTex\.colorSpace = THREE\.SRGBColorSpace;\s*group\.userData\.dynamicTextures = \[bucketTex\];/);
});


test('expired and collected dropped-perk crates and opened loot crates dispose their temporary models', async () => {
  const game = await read('../src/game.ts');
  const droppedStart = game.indexOf('private updateDroppedPerks(dt: number)');
  const droppedEnd = game.indexOf('\n  private ', droppedStart + 10);
  const lootStart = game.indexOf('private updateLootCrates(dt: number)');
  const lootEnd = game.indexOf('\n  private ', lootStart + 10);
  assert.ok(droppedStart >= 0 && droppedEnd > droppedStart);
  assert.ok(lootStart >= 0 && lootEnd > lootStart);

  const dropped = game.slice(droppedStart, droppedEnd);
  const loot = game.slice(lootStart, lootEnd);
  assert.ok((dropped.match(/this\.disposeObjectResources\(perk\.mesh\)/g) || []).length >= 3);
  assert.match(dropped, /if \(perk\.life <= 0\) \{[\s\S]*?this\.disposeObjectResources\(perk\.mesh\)/);
  assert.match(dropped, /if \(dist < 1\.15 && dy < 1\.4\) \{[\s\S]*?this\.disposeObjectResources\(perk\.mesh\)/);
  assert.match(loot, /this\.levelRoot\.remove\(crate\.mesh\);\s*this\.disposeObjectResources\(crate\.mesh\);/);
});


test('temporary pickup cleanup preserves the public perk-drop spawn API used by gameplay events', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /public spawnDroppedPerk\(x: number, y: number, z: number, forcedPerkId\?: PerkType\)/);
  assert.match(game, /const mesh = createDroppedPerkCrate\(perkDef\.id, perkDef\.color\)/);
  assert.match(game, /this\.droppedPerks\.push\(dropped\)/);
});


test('level reset disposes remaining collectibles, perk drops, and loot crates before clearing the scene', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private clearLevel()');
  const end = game.indexOf('\n  private ', start + 10);
  assert.ok(start >= 0 && end > start, 'clearLevel method should be present');
  const clear = game.slice(start, end);
  assert.match(clear, /for \(const collectible of this\.collectibles\) \{\s*if \(collectible\.mesh\) this\.disposeObjectResources\(collectible\.mesh\);/);
  assert.match(clear, /for \(const perk of this\.droppedPerks\) \{\s*if \(perk\.mesh\) this\.disposeObjectResources\(perk\.mesh\);/);
  assert.match(clear, /for \(const crate of this\.lootCrates\) \{\s*if \(crate\.mesh\) this\.disposeObjectResources\(crate\.mesh\);/);
  assert.ok(clear.indexOf('this.disposeObjectResources(collectible.mesh)') < clear.indexOf('while (this.levelRoot.children.length > 0)'));
});


test('uncollected roaming espresso expires while fixed map espresso remains persistent', async () => {
  const [game, types] = await Promise.all([
    read('../src/game.ts'),
    read('../src/types.ts'),
  ]);
  assert.match(types, /life\?: number/);

  const addStart = game.indexOf('private addEspressoItem(');
  const addEnd = game.indexOf('\n  private ', addStart + 10);
  assert.ok(addStart >= 0 && addEnd > addStart);
  const addEspresso = game.slice(addStart, addEnd);
  assert.match(addEspresso, /life: id\.startsWith\('rand_esp_'\) \? 90 : undefined/);

  const updateStart = game.indexOf('private updateCollectibles(dt: number)');
  const updateEnd = game.indexOf('\n  private ', updateStart + 10);
  assert.ok(updateStart >= 0 && updateEnd > updateStart);
  const update = game.slice(updateStart, updateEnd);
  assert.match(update, /if \(c\.life !== undefined\) \{[\s\S]*?c\.life -= Math\.max\(0, dt\)/);
  assert.match(update, /if \(c\.life <= 0\) \{[\s\S]*?this\.disposeObjectResources\(c\.mesh\);[\s\S]*?this\.collectibles\.splice\(i, 1\)/);
  assert.match(game, /addEspressoItem\('esp_l1_1'/);
});


test('all transient primary attack projectile models release unique GPU resources on removal and level reset', async () => {
  const game = await read('../src/game.ts');
  const attackMeshes = ['spell', 'dumbbell', 'wrapRoll', 'taserDart', 'tile'];
  for (const mesh of attackMeshes) {
    const start = game.indexOf('mesh: ' + mesh + ',');
    const end = game.indexOf('});', start);
    assert.ok(start >= 0 && end > start, mesh + ' projectile should exist');
    const projectile = game.slice(start, end);
    assert.match(projectile, /disposeOnRemove: true/, mesh + ' projectile should own its disposal lifecycle');
  }

  assert.match(game, /disposeOnRemove\?: boolean/);
  const updateStart = game.indexOf('private updateProjectiles(dt: number)');
  const updateEnd = game.indexOf('\n  private ', updateStart + 10);
  assert.ok(updateStart >= 0 && updateEnd > updateStart);
  const update = game.slice(updateStart, updateEnd);
  assert.ok((update.match(/p\.weaponProjectile \|\| p\.disposeOnRemove/g) || []).length >= 2);

  const clearStart = game.indexOf('private clearLevel()');
  const clearEnd = game.indexOf('\n  private ', clearStart + 10);
  assert.ok(clearStart >= 0 && clearEnd > clearStart);
  const clear = game.slice(clearStart, clearEnd);
  assert.match(clear, /projectile\.weaponProjectile \|\| projectile\.disposeOnRemove/);
});


test('all short-lived enemy notice and ranged projectiles dispose their generated meshes on hit, expiry and level reset', async () => {
  const game = await read('../src/game.ts');
  const spawnFunctions = [
    'spawnPenaltyNotice',
    'spawnDyscyplinarkaNotice',
    'spawnSanitarywareProjectile',
    'spawnSparkZapProjectile',
    'spawnOdprawaClipboardProjectile',
  ];
  for (const name of spawnFunctions) {
    const start = game.indexOf('private ' + name + '(');
    const end = game.indexOf('\n  private ', start + 10);
    assert.ok(start >= 0 && end > start, name + ' should exist');
    assert.match(game.slice(start, end), /enemyProjectiles\.push\(\{[^}]*disposeOnRemove: true/);
  }

  assert.match(game, /disposeOnRemove\?: boolean/);
  const updateStart = game.indexOf('private updateProjectiles(dt: number)');
  const updateEnd = game.indexOf('\n  private ', updateStart + 10);
  const update = game.slice(updateStart, updateEnd);
  assert.ok((update.match(/ep\.kind === 'pomazaniec_lollipop' \|\| ep\.kind === 'sebix_brick' \|\| ep\.disposeOnRemove/g) || []).length >= 2);

  const clearStart = game.indexOf('private clearLevel()');
  const clearEnd = game.indexOf('\n  private ', clearStart + 10);
  const clear = game.slice(clearStart, clearEnd);
  assert.match(clear, /projectile\.kind === 'pomazaniec_lollipop' \|\| projectile\.kind === 'sebix_brick' \|\| projectile\.disposeOnRemove/);
});

 
test('temporary special-effect meshes release generated GPU resources when their animation ends or the level resets', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /disposeOnRemove\?: boolean/);

  const checks = [
    { label: 'fire patch', marker: 'life: 0.58,\n      maxLife: 0.58,\n      disposeOnRemove: true,' },
    { label: 'first shockwave ring', marker: 'this.specialEffects.push({ mesh, life: 0.7, maxLife: 0.7, grow: 7.5, spin: 9.0, disposeOnRemove: true });' },
    { label: 'second shockwave ring', marker: 'this.specialEffects.push({ mesh: ring2, life: 0.6, maxLife: 0.6, grow: 8.5, spin: -7.0, disposeOnRemove: true });' },
    { label: 'Grzesiek claw', marker: 'mesh: armGroup,\n      life: 0.9,\n      maxLife: 0.9,\n      disposeOnRemove: true,' },
    { label: 'fireball flash', marker: 'mesh: flash,\n      life: 0.45,\n      maxLife: 0.45,\n      disposeOnRemove: true,' },
    { label: 'boss defeat ring', marker: 'this.specialEffects.push({ mesh, life: 1.2, maxLife: 1.2, grow: 12.0, spin: 15.0, disposeOnRemove: true });' },
  ];
  for (const item of checks) assert.ok(game.includes(item.marker), item.label + ' should opt into resource disposal');

  const updateStart = game.indexOf('private updateSpecialEffects(dt: number)');
  const updateEnd = game.indexOf('\n  private ', updateStart + 10);
  assert.ok(updateStart >= 0 && updateEnd > updateStart);
  const update = game.slice(updateStart, updateEnd);
  assert.match(update, /if \(effect\.cleanup\) effect\.cleanup\(\);\s*else if \(effect\.disposeOnRemove\) this\.disposeTemporaryObject\(effect\.mesh\)/);

  const clearStart = game.indexOf('private clearLevel()');
  const clearEnd = game.indexOf('\n  private ', clearStart + 10);
  assert.ok(clearStart >= 0 && clearEnd > clearStart);
  const clear = game.slice(clearStart, clearEnd);
  assert.match(clear, /if \(effect\.cleanup\) effect\.cleanup\(\);\s*else if \(effect\.disposeOnRemove\) this\.disposeTemporaryObject\(effect\.mesh\)/);
});

 
test('falling tile, molotov, fire-puddle and explosive-barrel models dispose owned resources on removal', async () => {
  const game = await read('../src/game.ts');

  const fallingStart = game.indexOf('private updateFallingTiles(dt: number)');
  const fallingEnd = game.indexOf('\n  private ', fallingStart + 10);
  const falling = game.slice(fallingStart, fallingEnd);
  assert.ok(fallingStart >= 0 && fallingEnd > fallingStart);
  assert.match(falling, /this\.levelRoot\.remove\(tile\.mesh\);\s*this\.levelRoot\.remove\(tile\.warningRing\);\s*this\.disposeTemporaryObject\(tile\.mesh\);\s*this\.disposeTemporaryObject\(tile\.warningRing\)/);

  const molotovStart = game.indexOf('private updateBimberMolotovs(dt: number)');
  const molotovEnd = game.indexOf('\n  private ', molotovStart + 10);
  const molotov = game.slice(molotovStart, molotovEnd);
  assert.ok(molotovStart >= 0 && molotovEnd > molotovStart);
  assert.match(molotov, /this\.levelRoot\.remove\(b\.mesh\);\s*this\.disposeTemporaryObject\(b\.mesh\);\s*this\.bimberMolotovs\.splice/);

  const puddleStart = game.indexOf('private updateBimberFirePuddles(dt: number)');
  const puddleEnd = game.indexOf('\n  private ', puddleStart + 10);
  const puddle = game.slice(puddleStart, puddleEnd);
  assert.ok(puddleStart >= 0 && puddleEnd > puddleStart);
  assert.match(puddle, /this\.levelRoot\.remove\(p\.group\);\s*this\.disposeTemporaryObject\(p\.group\);\s*this\.bimberFirePuddles\.splice/);

  const barrelStart = game.indexOf('private updateExplosiveBarrels(dt: number)');
  const barrelEnd = game.indexOf('\n  private ', barrelStart + 10);
  const barrels = game.slice(barrelStart, barrelEnd);
  assert.ok(barrelStart >= 0 && barrelEnd > barrelStart);
  assert.match(barrels, /this\.levelRoot\.remove\(b\.mesh\);\s*this\.disposeTemporaryObject\(b\.mesh\);\s*this\.platforms = this\.platforms\.filter\(\(platform\) => platform\.mesh !== b\.mesh\)/);

  const clearStart = game.indexOf('private clearLevel()');
  const clearEnd = game.indexOf('\n  private ', clearStart + 10);
  const clear = game.slice(clearStart, clearEnd);
  assert.match(clear, /for \(const tile of this\.fallingTiles\)[\s\S]*?disposeTemporaryObject\(tile\.mesh\)[\s\S]*?disposeTemporaryObject\(tile\.warningRing\)/);
  assert.match(clear, /for \(const molotov of this\.bimberMolotovs\) this\.disposeTemporaryObject\(molotov\.mesh\)/);
  assert.match(clear, /for \(const puddle of this\.bimberFirePuddles\) this\.disposeTemporaryObject\(puddle\.group\)/);
  assert.match(clear, /for \(const barrel of this\.explosiveBarrels\) this\.disposeTemporaryObject\(barrel\.mesh\)/);
});

 
test('level reset releases every per-level hazard model, not only the newest trap types', async () => {
  const game = await read('../src/game.ts');
  const clearStart = game.indexOf('private clearLevel()');
  const clearEnd = game.indexOf('\n  private ', clearStart + 10);
  assert.ok(clearStart >= 0 && clearEnd > clearStart);
  const clear = game.slice(clearStart, clearEnd);

  const hazardStart = clear.indexOf('for (const hazard of this.hazards)');
  const hazardEnd = clear.indexOf('\n    this.clearSurvivalSurgeRing()', hazardStart);
  assert.ok(hazardStart >= 0 && hazardEnd > hazardStart);
  const hazardCleanup = clear.slice(hazardStart, hazardEnd);
  assert.match(hazardCleanup, /if \(hazard\.mesh\) this\.disposeTemporaryObject\(hazard\.mesh\)/);
  assert.doesNotMatch(hazardCleanup, /hazard\.type ===/);

  for (const [factory, type] of [
    ['createForkliftModel', 'forklift'],
    ['createCementSpillTrapModel', 'cement_spill'],
    ['createStretchFilmBarrierModel', 'stretch_barrier'],
    ['createRollerGateTrapModel', 'roller_gate'],
    ['createLaserCutterTrapModel', 'laser_cutter'],
    ['createSteamGeyserTrapModel', 'steam_geyser'],
    ['createHydraulicPressTrapModel', 'hydraulic_press'],
  ]) {
    assert.ok(game.includes(factory), factory + ' should remain part of the hazard model system');
    assert.ok(game.includes("type: '" + type + "'"), type + ' hazard should be covered by the shared cleanup loop');
  }
});


test('special ability cooldown has a single authoritative timer and Survival-only kill recharge', async () => {
  const game = await read('../src/game.ts');
  const app = await read('../src/index.ts');
  assert.match(game, /private abilityCooldownState: AbilityCooldownState = createAbilityCooldown\(0\)/);
  assert.match(game, /this\.updateAbilityCooldown\(simDt\)/);
  assert.match(game, /this\.rechargeAbilityFromSurvivalKill\(isAbilityRechargeElite\)/);
  assert.doesNotMatch(game, /abilityTimer/);
  assert.match(app, /onAbilityCooldown: \(progress, ready, remainingSeconds, killRechargeEnabled\)/);
  assert.match(app, /GOTOWA \[E\]/);
});

test('both Campaign completion and Survival/Campaign defeat can submit a mode-labelled score', async () => {
  const app = await read('../src/index.ts');
  const html = await read('../index.html');
  assert.match(app, /onLevelComplete: \(levelId, score, timeStr\) => \{[\s\S]*?this\.lastMode = this\.engine\.getGameMode\(\)/);
  assert.match(app, /onGameOver: \(reason\) => \{[\s\S]*?this\.lastScore = this\.engine\.getScore\(\)[\s\S]*?this\.lastMode = this\.engine\.getGameMode\(\)/);
  assert.match(app, /bindScoreSubmission\('btn-submit-score-gameover'/);
  assert.match(app, /mode: this\.lastMode/);
  assert.ok(html.includes('id="btn-submit-score-gameover"'));
  assert.ok(html.includes('id="gameover-score"'));
});

test('Survival earns additional points for harder eliminations and active wave clears, not idle waiting', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /getSurvivalKillScoreMultiplier\(this\.survivalWave\)/);
  assert.match(game, /getSurvivalWaveClearBonus\(this\.survivalWave, previousWaveKills\)/);
  assert.match(game, /if \(waveClearBonus > 0\)[\s\S]*?this\.callbacks\.onScoreUpdate/);
  assert.match(game, /this\.survivalWaveStartKills = this\.survivalKills/);
  assert.match(game, /return Math\.max\(1, Math\.round\(this\.activeElapsedSeconds\)\)/);
});


test('Survival tactical dodge is directional, invulnerable only for a short window, and cooldown-gated', async () => {
  const [game, app, html, css] = await Promise.all([
    read('../src/game.ts'), read('../src/index.ts'), read('../index.html'), read('../src/index.css')
  ]);
  assert.match(game, /if \(e\.code === 'KeyQ'\) \{\s*this\.triggerDash\(\);\s*\}/);
  assert.match(game, /public triggerDash\(\): boolean/);
  assert.match(game, /this\.survivalDashCooldownRemaining > 0\.0001/);
  assert.match(game, /this\.survivalDashDurationRemaining = 0\.22/);
  assert.match(game, /this\.invulnerableTimer = Math\.max\(this\.invulnerableTimer, 0\.32\)/);
  assert.match(game, /this\.playerVel\.x = this\.survivalDashDirection\.x \* 18/);
  assert.match(game, /this\.updateSurvivalDashCooldown\(simDt\)/);
  assert.match(app, /onSurvivalDashUpdate: \(progress, ready, remainingSeconds\)/);
  assert.match(app, /bindTouchAction\('btn-touch-dash', \(\) => this\.engine\.triggerDash\(\)\)/);
  assert.match(html, /id="btn-touch-dash"/);
  assert.match(css, /#game-shell\.survival-mode \.dash-touch-btn\s*\{\s*display: flex !important/);
});

test('critical upgrades are capped, roll once per weapon volley, and can unlock a paired build synergy', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /this\.survivalCriticalChance = Math\.min\(0\.25, this\.survivalCriticalChance \+ 0\.04\)/);
  assert.match(game, /this\.survivalCriticalDamageMultiplier = Math\.min\(2\.45, this\.survivalCriticalDamageMultiplier \+ 0\.20\)/);
  assert.match(game, /this\.survivalDashCooldownMultiplier = Math\.max\(0\.55, this\.survivalDashCooldownMultiplier \* 0\.88\)/);
  assert.match(game, /critical_protocol/);
  assert.match(game, /ghost_protocol/);
  const start = game.indexOf('private fireSurvivalWeapon(weapon: SurvivalWeaponState');
  const end = game.indexOf('\n  private ', start + 20);
  assert.ok(start >= 0 && end > start);
  const weaponFire = game.slice(start, end);
  assert.equal((weaponFire.match(/rollSurvivalCriticalDamage\(/g) || []).length, 1,
    'one roll per volley keeps spread shots and orbit blades consistent');
  assert.match(weaponFire, /const weaponDamage = criticalRoll\.damage/);
  assert.match(weaponFire, /damage: weaponDamage/);
});


test('perfect Survival dodges require the late boss warning window and a lateral exit', async () => {
  const [game, geometry, types, app, html] = await Promise.all([
    read('../src/game.ts'), read('../src/combatTelegraphs.ts'), read('../src/types.ts'),
    read('../src/index.ts'), read('../index.html')
  ]);
  assert.match(game, /remaining > 0\.30/);
  assert.match(game, /isInsideBossAttackLane\(/);
  assert.match(game, /isEffectiveBossLaneDodge\(/);
  assert.match(game, /this\.survivalDashCooldownRemaining - 1\.35/);
  assert.match(game, /advanceAbilityCooldown\(this\.abilityCooldownState, 0\.65\)/);
  assert.match(game, /this\.survivalPerfectDodges\+\+/);
  assert.match(geometry, /lateralTravel < requiredTravel/);
  assert.match(types, /chargeLaneLength\?: number;\s*chargeLaneWidth\?: number;/);
  assert.match(app, /String\(snapshot\.kills\) \+ ' \/ ' \+ String\(snapshot\.perfectDodges\)/);
  assert.match(html, /ELIMINACJE \/ UNIKI/);
});

test('each boss warning stores its owner-specific lane dimensions for dodge validation', async () => {
  const game = await read('../src/game.ts');
  assert.match(game, /owner\.chargeLaneLength = safeLength/);
  assert.match(game, /owner\.chargeLaneWidth = safeWidth/);
  const calls = game.match(/spawnBossLaneTelegraph\([^;]+\);/g) || [];
  assert.ok(calls.length >= 4, 'expected multiple boss lane telegraphs');
  for (const call of calls) {
    assert.match(call, /, (?:enemy|e)\);$/, 'each lane warning must attach its enemy owner');
  }
});
