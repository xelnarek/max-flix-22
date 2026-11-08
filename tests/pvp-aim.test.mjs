import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PVP_AIM_DIRECTION, PVP_AIM_DEADZONE, PVP_AIM_DIRECTION_DEADZONE,
  PVP_AIM_FIRE_START_DEADZONE, PVP_AIM_FIRE_STOP_DEADZONE, getPvpAimAngle,
  isPvpAimInputActive, normalizePvpAimDirection, pvpAimDirectionFromAngle, shouldPvpAimFire,
  pvpScreenAimToWorld, pvpScreenMovementToWorld, calculatePvpAimPreview,
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
  assert.match(app, /bindPvpTap\(pvpFireButton/);
  assert.match(game, /this\.pvpWantFire = true/);
  assert.match(game, /wantFire: this\.pvpWantFire/);
  assert.doesNotMatch(game, /shouldPvpAimFire\(x, z, this\.manualAimFiring\)/);
  assert.match(game, /if \(!this\.manualAimEnabled\) this\.playerRot = Math\.atan2\(this\.survivalDashDirection\.x, this\.survivalDashDirection\.z\)/);
  assert.match(game, /this\.setManualAimMode\(false\);[\s\S]*this\.gameMode = 'survival'/);
  assert.match(game, /if \(this\.state !== 'playing' \|\| this\.gameMode !== 'survival' \|\| this\.manualAimEnabled\) return/);
  assert.match(html, /id="pvp-aim-zone"/);
  assert.match(html, /pvp-stick-caption pvp-move-caption/);
  assert.match(html, /pvp-aim-center-label/);
  assert.match(html, /pvp-control-guide/);
  assert.match(html, /id="btn-pvp-fire"/);
  assert.match(css, /#touch-controls\.manual-aim-mode \.pvp-fire-btn/);
  assert.match(css, /body #touch-controls\.manual-aim-mode:not\(\.hidden\) \.pvp-aim-base/);
  assert.match(css, /flex-wrap: nowrap !important/);
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


test('portrait PvP camera rotates screen-relative movement and aiming to match the rotated arena', () => {
  assert.deepEqual(pvpScreenMovementToWorld(1, 0, false), { x: 1, z: 0 });
  assert.deepEqual(pvpScreenMovementToWorld(0, 1, false), { x: 0, z: -1 });
  assert.deepEqual(pvpScreenMovementToWorld(1, 0, true), { x: 0, z: -1 });
  assert.deepEqual(pvpScreenMovementToWorld(0, 1, true), { x: -1, z: 0 });
  assert.deepEqual(pvpScreenAimToWorld(1, 0, false), { x: 1, z: 0 });
  assert.deepEqual(pvpScreenAimToWorld(0, -1, false), { x: 0, z: -1 });
  assert.deepEqual(pvpScreenAimToWorld(1, 0, true), { x: 0, z: -1 });
  assert.deepEqual(pvpScreenAimToWorld(0, -1, true), { x: -1, z: 0 });
});


test('PvP camera fit scales to portrait and landscape viewports without clipping arena width', async () => {
  const { calculatePvpCameraFrame } = await import('../src/pvpCamera.ts');
  const bounds = { minX: -22, maxX: 22, minZ: -12, maxZ: 12 };
  for (const viewport of [{ width: 393, height: 852 }, { width: 432, height: 768 }, { width: 1280, height: 720 }, { width: 2560, height: 1080 }]) {
    const frame = calculatePvpCameraFrame(viewport.width, viewport.height, { x: 4, z: -3 }, bounds);
    assert.equal(frame.portrait, viewport.width / viewport.height < 0.86);
    assert.ok(frame.visibleWidth >= frame.requiredWidth * 1.1, `horizontal arena coverage should have a margin at ${viewport.width}x${viewport.height}`);
    assert.ok(Math.abs(frame.target.x - 4) < 1e-9);
    assert.ok(Math.abs(frame.target.z + 3) < 1e-9);
    assert.ok(frame.position.x !== frame.target.x || frame.position.z !== frame.target.z);
    assert.ok(frame.fitDistance > 0);
  }
});


test('aim preview stops before the first cover piece instead of drawing through it', () => {
  const preview = calculatePvpAimPreview(
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { minX: -10, maxX: 10, minZ: -8, maxZ: 8 },
    [{ x: 3, z: 0, width: 2, depth: 4 }],
    { x: 8, z: 0 },
  );
  assert.equal(preview.blocked, true);
  assert.equal(preview.onTarget, false);
  assert.equal(preview.impact, 'cover');
  assert.ok(preview.x < 2 && preview.x > 0);
});

test('aim preview confirms a target only when it lies on a clear manual firing ray', () => {
  const aligned = calculatePvpAimPreview(
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { minX: -10, maxX: 10, minZ: -8, maxZ: 8 },
    [],
    { x: 6, z: 0.4 },
  );
  const misaligned = calculatePvpAimPreview(
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { minX: -10, maxX: 10, minZ: -8, maxZ: 8 },
    [],
    { x: 6, z: 2.2 },
  );
  assert.equal(aligned.onTarget, true);
  assert.equal(aligned.blocked, false);
  assert.equal(misaligned.onTarget, false);
  assert.equal(aligned.impact, 'boundary');
});

test('aim preview returns finite points for malformed directions and clips to the arena boundary', () => {
  const preview = calculatePvpAimPreview(
    { x: 9, z: 0 },
    { x: Number.NaN, z: 0 },
    { minX: -10, maxX: 10, minZ: -8, maxZ: 8 },
    [],
  );
  assert.ok(Number.isFinite(preview.x) && Number.isFinite(preview.z));
  assert.ok(preview.x <= 10);
  assert.equal(preview.impact, 'boundary');
});
