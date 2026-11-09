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
