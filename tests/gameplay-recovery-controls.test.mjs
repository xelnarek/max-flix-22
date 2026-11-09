import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Survival and PvP expose a separate mobile pause control and bind it to the shared pause handler', async () => {
  const [html, app, game] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/game.ts'),
  ]);
  assert.match(html, /id="btn-touch-pause"/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-touch-pause'\), handlePause\)/);
  const pauseHandler = app.slice(app.indexOf('const handlePause = () =>'), app.indexOf("bindTap(document.getElementById('btn-resume')"));
  assert.match(pauseHandler, /this\.engine\.togglePause\(\)/);
  assert.match(pauseHandler, /setTouchControlsVisibility\(false\)/);
  assert.match(game, /this\.pvpSession\?\.setPaused\?\.\(true\)/);
  assert.match(game, /this\.pvpSession\?\.setPaused\?\.\(false\)/);
});

test('resuming a paused run restores only the current mode controls and pause cannot restart PvP as Survival', async () => {
  const app = await read('../src/index.ts');
  const resume = app.slice(app.indexOf("bindTap(document.getElementById('btn-resume')"), app.indexOf("bindTap(document.getElementById('btn-restart-pause')"));
  const restart = app.slice(app.indexOf("bindTap(document.getElementById('btn-restart-pause')"), app.indexOf('const exitPausedRunToMenu'));
  assert.match(resume, /setTouchControlsMode\(activeTouchMode\(\)\)/);
  assert.match(resume, /setTouchControlsVisibility\(true\)/);
  assert.match(restart, /this\.engine\.getGameMode\(\) !== 'survival'/);
  assert.match(app, /this\.pvpSession\?\.dispose\(\)/);
  assert.match(app, /this\.engine\.exitPvp\(\)/);
});

test('Game-over UI appears before optional progression and result reporting, with a guarded fallback', async () => {
  const [app, game] = await Promise.all([read('../src/index.ts'), read('../src/game.ts')]);
  const callbackStart = app.indexOf('onGameOver: (reason) =>');
  const callbackEnd = app.indexOf('onSurvivalUpdate:', callbackStart);
  const callback = app.slice(callbackStart, callbackEnd);
  assert.ok(callback.indexOf('gameoverModal.classList.remove') < callback.indexOf('hideSurvivalAnnouncement'));
  assert.ok(callback.indexOf('gameoverModal.classList.remove') < callback.indexOf('recordCharacterRunResult'));
  assert.match(callback, /catch \(error\)/);
  assert.match(callback, /setTouchControlsVisibility\(false\)/);
  assert.match(game, /try \{\s*this\.callbacks\.onGameOver\(finalReason\);\s*\} catch \(error\)/);
  assert.match(game, /showing the fallback results panel/);
});

test('Survival touch actions use a narrow vertical dock and do not share the joystick lane', async () => {
  const css = await read('../src/index.css');
  assert.match(css, /#touch-controls\.survival-mode:not\(\.hidden\) \.touch-actions-zone[\s\S]*?flex-direction: column !important/);
  assert.match(css, /#touch-controls\.survival-mode:not\(\.hidden\) \.touch-actions-zone \.touch-action-btn[\s\S]*?width: 54px !important/);
  assert.match(css, /#touch-controls \.joystick-zone[\s\S]*?width: min\(48vw, 320px\)/);
  assert.match(css, /\.touch-pause-btn[\s\S]*?z-index: 2147483010/);
});

test('PvP touch controls offer a right-stick aim zone with fire, ability and dash in an independent dock', async () => {
  const [html, app, game, css] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/game.ts'),
    read('../src/index.css'),
  ]);
  assert.match(html, /id="pvp-aim-zone"/);
  assert.match(html, /id="pvp-aim-base"/);
  assert.match(html, /id="pvp-aim-knob"/);
  assert.match(app, /this\.engine\.setPvpAimStickInput\(knobX \/ aimRadius, -knobY \/ aimRadius\)/);
  assert.match(app, /touchActionsZone\.prepend\(pvpFireControl\)/);
  assert.match(game, /public setPvpAimStickInput\(screenX: number, screenY: number\)/);
  assert.match(game, /!this\.manualPvpAimOverride/);
  assert.match(css, /#touch-controls\.pvp-mode \.pvp-aim-zone[\s\S]*?display: flex !important/);
  assert.match(css, /body #touch-controls\.manual-aim-mode:not\(\.hidden\) \.touch-actions-zone[\s\S]*?flex-direction: column-reverse !important/);
});

test('local bot pauses with the practice match and its aim is deliberately imperfect', async () => {
  const [client, tactics] = await Promise.all([
    read('../src/pvpClient.ts'),
    read('../src/pvpBotTactics.ts'),
  ]);
  assert.match(client, /private paused = false/);
  assert.match(client, /if \(this\.paused\) return/);
  assert.match(client, /this\.botRepositionTimer = 0\.46/);
  assert.match(client, /applyPvpBotAimSpread\(decision\.aimAngle, this\.botDecisionTick\)/);
  assert.match(tactics, /PVP_BOT_AIM_SPREAD_RADIANS = 0\.18/);
  assert.match(tactics, /applyPvpBotAimSpread/);
});


test('pause controls are re-enabled for desktop and touch after each gameplay transition', async () => {
  const [html, app, css] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/index.css'),
  ]);
  assert.match(html, /id="btn-top-pause"/);
  assert.match(html, /id="btn-touch-pause"/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-top-pause'\), handlePause\)/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-touch-pause'\), handlePause\)/);
  const visibility = app.slice(app.indexOf('function setTouchControlsVisibility'), app.indexOf('type TouchControlsMode'));
  assert.match(visibility, /topPause\.style\.setProperty\('pointer-events', 'auto', 'important'\)/);
  assert.match(visibility, /touchPause\.style\.setProperty\('display', 'flex', 'important'\)/);
  assert.match(app, /touchActionDock\.appendChild\(touchPauseButton\)/);
  assert.match(css, /#touch-controls \.touch-pause-btn[\s\S]*?min-width: 42px !important/);
});

test('lethal damage is terminal and the result workload yields one frame for the death screen', async () => {
  const [game, app] = await Promise.all([
    read('../src/game.ts'),
    read('../src/index.ts'),
  ]);
  const damage = game.slice(game.indexOf('private takeDamage('), game.indexOf('private checkLevelFinish(', game.indexOf('private takeDamage(')));
  assert.match(damage, /if \(this\.state !== 'playing' \|\| this\.hp <= 0\) return/);
  assert.ok(damage.indexOf("this.state = 'gameover'") < damage.indexOf('this.callbacks.onGameOver(finalReason)'));
  const callbackStart = app.indexOf('onGameOver: (reason) =>');
  const callbackEnd = app.indexOf('onSurvivalUpdate:', callbackStart);
  const callback = app.slice(callbackStart, callbackEnd);
  assert.ok(callback.indexOf('gameoverModal.classList.remove') < callback.indexOf('window.requestAnimationFrame'));
  assert.ok(callback.indexOf('window.requestAnimationFrame') < callback.indexOf('recordCharacterRunResult'));
  assert.ok(callback.includes("setTouchControlsMode('hidden')"));
  assert.ok(callback.includes('const snapshot = this.engine.getSurvivalSnapshot()'));
  assert.ok(callback.includes('const damageReport = this.engine.getSurvivalDamageReport()'));
  assert.ok(!callback.includes('this.engine.selectCharacter(operatorId'));
  assert.ok(callback.indexOf("if (shouldAwardMastery) this.masteryAwardedForRun = true") < callback.indexOf('window.requestAnimationFrame'));
  assert.ok(callback.includes("const shouldAwardMastery = endedMode === 'survival' && !this.masteryAwardedForRun"));
  assert.ok(callback.includes('const endedOperatorId = this.engine.getCharacterDef().id'));
  assert.ok(callback.includes('if (shouldAwardMastery) {'));
  assert.ok(callback.includes('const endedSessionGeneration = this.gameSessionGeneration'));
  assert.ok(callback.includes('endedSessionGeneration !== this.gameSessionGeneration'));
  assert.ok(callback.includes("this.engine.getGameState() !== 'gameover'"));
  assert.match(app, /private gameSessionGeneration = 0/);
  const runStart = app.slice(app.indexOf('const doStartSurvival = async'), app.indexOf('const handlePause ='));
  assert.ok(runStart.includes('updateCharacterUI(this.selectedCharId)'));
});

test('deferred game-over fallback cannot reopen an obsolete result screen after a new session starts', async () => {
  const app = await read('../src/index.ts');
  const callbackStart = app.indexOf('onGameOver: (reason) =>');
  const callbackEnd = app.indexOf('onSurvivalUpdate:', callbackStart);
  const callback = app.slice(callbackStart, callbackEnd);
  const fallbackStart = callback.lastIndexOf('} catch (error) {');
  assert.ok(fallbackStart >= 0, 'deferred game-over fallback catch must exist');
  const fallback = callback.slice(fallbackStart);
  const generationGuard = fallback.indexOf('endedSessionGeneration !== this.gameSessionGeneration');
  const stateGuard = fallback.indexOf("this.engine.getGameState() !== 'gameover'");
  const modalShow = fallback.indexOf("gameoverModal.classList.remove('hidden')");
  assert.ok(generationGuard >= 0 && stateGuard >= 0, 'fallback must reject stale session generations and non-gameover states');
  assert.ok(generationGuard < modalShow && stateGuard < modalShow, 'stale-session guards must run before the fallback paints the modal');
});

test('fullscreen transitions release movement, aim and positioned fire input on Android WebViews', async () => {
  const app = await read('../src/index.ts');
  const fullscreenHandler = app.slice(
    app.indexOf('const handleFullscreenChange = () =>'),
    app.indexOf("document.addEventListener('fullscreenchange', handleFullscreenChange)"),
  );
  assert.match(fullscreenHandler, /this\.resetTouchJoystick\?\.\(\)/);
  assert.match(fullscreenHandler, /resetPvpFireControlPosition\(\)/);
  const aimControls = app.slice(
    app.indexOf('const resetAimStick = () =>'),
    app.indexOf('const handleStart = (event: PointerEvent) =>'),
  );
  assert.match(aimControls, /document\.addEventListener\('fullscreenchange', resetAimStick\)/);
  assert.match(aimControls, /document\.addEventListener\('webkitfullscreenchange', resetAimStick\)/);
});

test('visibility return keeps the game paused until the player presses Resume', async () => {
  const [moduleSource, app] = await Promise.all([
    read('../src/visibilityPause.ts'),
    read('../src/index.ts'),
  ]);
  assert.match(moduleSource, /if \(documentHidden && gameState === 'playing'\) return 'pause'/);
  assert.doesNotMatch(moduleSource, /return 'resume'/);
  const handler = app.slice(app.indexOf("document.addEventListener('visibilitychange', () => {\n      const action = getVisibilityPauseAction"), app.indexOf('this.setupTouchControls();'));
  assert.match(handler, /Aplikacja wróciła z tła[\s\S]*naciśnij WZNÓW GRĘ/);
  assert.doesNotMatch(handler, /action === 'resume'/);
  assert.match(app, /bindTap\(document.getElementById\('btn-resume'\), \(\) => \{/);
});

test('generic game-over results are mode-aware and never submit PvP as a Survival score', async () => {
  const [app, html] = await Promise.all([
    read('../src/index.ts'),
    read('../index.html'),
  ]);
  const start = app.indexOf('onGameOver: (reason) =>');
  const end = app.indexOf('onSurvivalUpdate:', start);
  const callback = app.slice(start, end);
  assert.match(callback, /endedMode === 'pvp'[\s\S]*?ARENA PvP/);
  assert.match(callback, /endedMode === 'campaign'[\s\S]*?KAMPANIA/);
  assert.match(callback, /damagePanel\?\.classList\.toggle\('hidden', !isSurvivalResult\)/);
  assert.match(callback, /survivalRankingPanel\?\.classList\.toggle\('hidden', !isSurvivalResult\)/);
  assert.match(callback, /survivalRetryButton\?\.classList\.toggle\('hidden', !isSurvivalResult\)/);
  assert.match(callback, /POJEDYNEK 1v1 • WYNIK/);
  assert.doesNotMatch(app, /mode: this\.lastMode === 'pvp' \? 'survival'/);
  assert.match(app, /if \(submittedMode === 'pvp'\)[\s\S]*?Wyniki PvP są zapisywane/);
  assert.match(html, /id="gameover-modal"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /id="gameover-modal-title"/);
});

test('score submission snapshots the completed run before asynchronous leaderboard loading', async () => {
  const app = await read('../src/index.ts');
  const start = app.indexOf('const bindScoreSubmission =');
  const end = app.indexOf('bindScoreSubmission(\'btn-submit-score\'', start);
  const handler = app.slice(start, end);
  for (const key of [
    'submittedMode',
    'submittedScore',
    'submittedCoins',
    'submittedTimeSeconds',
    'submittedBossDefeated',
    'submittedCharacterId',
  ]) assert.ok(handler.indexOf(`const ${key} =`) < handler.indexOf('await loadFirebaseLeaderboardServices()'), `${key} must be captured before async work`);
  assert.match(handler, /mode: submittedMode/);
  assert.match(handler, /score: submittedScore/);
  assert.match(handler, /hero: CHARACTERS\[submittedCharacterId\]\.name/);
  assert.match(handler, /if \(submittedMode === 'pvp'\)/);
});
