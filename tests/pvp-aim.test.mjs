import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PVP_AIM_DIRECTION, PVP_AIM_DEADZONE, PVP_AIM_DIRECTION_DEADZONE,
  PVP_AIM_FIRE_START_DEADZONE, PVP_AIM_FIRE_STOP_DEADZONE, getPvpAimAngle,
  isPvpAimInputActive, normalizePvpAimDirection, pvpAimDirectionFromAngle, shouldPvpAimFire,
} from '../src/pvpAim.ts';

test('normalizes diagonal touch aim without amplifying stick length', () => {
  const direction = normalizePvpAimDirection(0.8, 0.8);
  assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - 1) < 1e-10);
  assert.ok(Math.abs(direction.x - Math.SQRT1_2) < 1e-10);
  assert.ok(Math.abs(direction.z - Math.SQRT1_2) < 1e-10);
});

test('neutral touch input preserves the last deliberate aim direction', () => {
  const previous = { x: 1, z: 0 };
  assert.deepEqual(normalizePvpAimDirection(0.02, -0.03, previous), previous);
  assert.deepEqual(normalizePvpAimDirection(0, 0, previous), previous);
});

test('invalid samples never inject NaN into combat direction', () => {
  const previous = { x: 0, z: -1 };
  assert.deepEqual(normalizePvpAimDirection(Number.NaN, 1, previous), previous);
  assert.deepEqual(normalizePvpAimDirection(1, Number.POSITIVE_INFINITY, previous), previous);
  assert.deepEqual(normalizePvpAimDirection(0, 0, { x: Number.NaN, z: 0 }), DEFAULT_PVP_AIM_DIRECTION);
});

test('aim activation respects a radial deadzone', () => {
  assert.equal(isPvpAimInputActive(PVP_AIM_DEADZONE, 0), true);
  assert.equal(isPvpAimInputActive(PVP_AIM_DEADZONE / 2, 0), false);
  assert.equal(isPvpAimInputActive(Number.NaN, 1), false);
});

test('angle conversions use the engine forward-axis convention', () => {
  const direction = pvpAimDirectionFromAngle(Math.PI / 2);
  assert.ok(Math.abs(direction.x - 1) < 1e-10);
  assert.ok(Math.abs(direction.z) < 1e-10);
  assert.ok(Math.abs(getPvpAimAngle(direction) - Math.PI / 2) < 1e-10);
  assert.ok(Math.abs(getPvpAimAngle({ x: 0, z: -1 }) - Math.PI) < 1e-10);
});

test('PvP wiring supports two separate touch pointers and does not snap to a target', async () => {
  const { readFile } = await import('node:fs/promises');
  const [app, game, html, css] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /activePointerId = event\.pointerId/);
  assert.match(app, /activeAimPointerId = event\.pointerId/);
  assert.doesNotMatch(app, /activePointerId !== null \|\| event\.isPrimary === false/);
  assert.doesNotMatch(app, /activeAimPointerId !== null \|\| event\.isPrimary === false/);
  assert.match(app, /this\.engine\.setManualAimInput\(input\.x, input\.y\)/);
  assert.match(app, /this\.engine\.stopManualAimFiring\(\)/);
  assert.match(game, /this\.manualAimFiring && this\.attackCooldownTimer <= 0/);
  assert.match(game, /if \(!this\.manualAimEnabled\) this\.playerRot = Math\.atan2\(this\.survivalDashDirection\.x, this\.survivalDashDirection\.z\)/);
  assert.match(game, /this\.setManualAimMode\(false\);[\s\S]*this\.gameMode = 'survival'/);
  assert.match(game, /if \(this\.state !== 'playing' \|\| this\.gameMode !== 'survival' \|\| this\.manualAimEnabled\) return/);
  assert.match(html, /id="pvp-aim-zone"/);
  assert.match(css, /#touch-controls\.manual-aim-mode \.pvp-aim-zone \{ display: block !important; \}/);
});

test('right-stick aim can adjust direction before firing starts', () => {
  const previous = { x: 0, z: 1 };
  const gentleInput = PVP_AIM_DIRECTION_DEADZONE + 0.02;
  assert.equal(isPvpAimInputActive(gentleInput, 0, PVP_AIM_DIRECTION_DEADZONE), true);
  assert.equal(shouldPvpAimFire(gentleInput, 0, false), false);
  const direction = normalizePvpAimDirection(gentleInput, 0, previous, PVP_AIM_DIRECTION_DEADZONE);
  assert.ok(direction.x > 0.99);
});

test('PvP fire trigger uses hysteresis so thumb jitter does not rapidly toggle shots', () => {
  assert.ok(PVP_AIM_DIRECTION_DEADZONE < PVP_AIM_FIRE_STOP_DEADZONE);
  assert.ok(PVP_AIM_FIRE_STOP_DEADZONE < PVP_AIM_FIRE_START_DEADZONE);
  assert.equal(shouldPvpAimFire(PVP_AIM_FIRE_START_DEADZONE, 0, false), true);
  assert.equal(shouldPvpAimFire(PVP_AIM_FIRE_STOP_DEADZONE + 0.01, 0, true), true);
  assert.equal(shouldPvpAimFire(PVP_AIM_FIRE_STOP_DEADZONE - 0.01, 0, true), false);
  assert.equal(shouldPvpAimFire(0, 0, false), false);
});
