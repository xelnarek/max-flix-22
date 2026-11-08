import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPvpAimAngle,
  pvpAimDirectionFromAngle,
  pvpScreenMovementToWorld,
  calculatePvpAimPreview,
  getPvpSweepAimAngle,
  getPvpAimSweepCenterAngle,
  PVP_AIM_SWEEP_HALF_ARC,
  PVP_AIM_SWEEP_PERIOD_SECONDS,
} from '../src/pvpAim.ts';

test('angle conversions use the engine forward-axis convention', () => {
  const direction = pvpAimDirectionFromAngle(Math.PI / 2);
  assert.ok(Math.abs(direction.x - 1) < 1e-10);
  assert.ok(Math.abs(direction.z) < 1e-10);
  assert.ok(Math.abs(getPvpAimAngle(direction) - Math.PI / 2) < 1e-10);
  assert.ok(Math.abs(getPvpAimAngle({ x: 0, z: -1 }) - Math.PI) < 1e-10);
  assert.deepEqual(pvpAimDirectionFromAngle(Number.NaN), { x: 0, z: 1 });
});

test('Archero timing cursor sweeps left-to-right and returns across the full arc', () => {
  const start = getPvpSweepAimAngle(0, 0);
  const middle = getPvpSweepAimAngle(PVP_AIM_SWEEP_PERIOD_SECONDS * 0.25, 0);
  const farEdge = getPvpSweepAimAngle(PVP_AIM_SWEEP_PERIOD_SECONDS * 0.5, 0);
  const returnMiddle = getPvpSweepAimAngle(PVP_AIM_SWEEP_PERIOD_SECONDS * 0.75, 0);
  const loop = getPvpSweepAimAngle(PVP_AIM_SWEEP_PERIOD_SECONDS, 0);
  assert.ok(Math.abs(start + PVP_AIM_SWEEP_HALF_ARC) < 1e-9);
  assert.ok(Math.abs(middle) < 1e-9);
  assert.ok(Math.abs(farEdge - PVP_AIM_SWEEP_HALF_ARC) < 1e-9);
  assert.ok(Math.abs(returnMiddle) < 1e-9);
  assert.ok(Math.abs(loop - start) < 1e-9);
});

test('PvP sweep direction follows player movement and never tracks the opponent', () => {
  const initialFacing = Math.PI / 2;
  const unchanged = getPvpAimSweepCenterAngle(0, 0, initialFacing);
  const turnedEast = getPvpAimSweepCenterAngle(1, 0, initialFacing);
  const turnedNorth = getPvpAimSweepCenterAngle(0, -1, initialFacing);
  const smallThumbNoise = getPvpAimSweepCenterAngle(0.08, 0.04, initialFacing);
  const malformed = getPvpAimSweepCenterAngle(Number.NaN, 1, initialFacing);
  assert.equal(unchanged, initialFacing);
  assert.ok(Math.abs(turnedEast - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(turnedNorth - Math.PI) < 1e-12);
  assert.equal(smallThumbNoise, initialFacing);
  assert.equal(malformed, initialFacing);
});

test('timing cursor handles invalid values, wrapped angles and custom arc limits', () => {
  const wrapped = getPvpSweepAimAngle(0, Math.PI - 0.1, 0.2, 2);
  const badTime = getPvpSweepAimAngle(Number.NaN, 0.5);
  const badCenter = getPvpSweepAimAngle(1, Number.NaN);
  assert.ok(wrapped >= -Math.PI && wrapped <= Math.PI);
  assert.ok(Math.abs(badTime - (0.5 - PVP_AIM_SWEEP_HALF_ARC)) < 1e-12);
  assert.equal(badCenter, 0);
  assert.ok(Number.isFinite(getPvpSweepAimAngle(Infinity, 0.5, Infinity, -1)));
});

test('PvP timing sweep drives the 3D cursor while movement and firing stay separate', async () => {
  const { readFile } = await import('node:fs/promises');
  const [app, game, html, css, arena] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpArena.ts', import.meta.url), 'utf8'),
  ]);
  assert.ok(app.includes('activePointerId = event.pointerId'));
  assert.ok(app.includes('joystickZone.setPointerCapture(event.pointerId)'));
  assert.ok(!app.includes('activeAimPointerId'));
  assert.ok(app.includes('bindPvpTap(pvpFireButton'));
  assert.ok(app.includes('bindPvpTap(desktopPvpFireButton, triggerPrimaryPvpShot)'));
  assert.ok(game.includes('getPvpSweepAimAngle('));
  assert.ok(game.includes('getPvpAimSweepCenterAngle('));
  assert.ok(game.includes('this.pvpAimSweepCenterAngle - PVP_AIM_SWEEP_HALF_ARC'));
  assert.ok(!/getPvpSweepAimAngle\([\s\S]{0,180}opponentBearing/.test(game));
  assert.ok(game.includes('this.pvpAimArc'));
  assert.ok(game.includes('this.pvpAimSweepPointer'));
  assert.ok(game.includes('wantFire: this.pvpWantFire'));
  assert.ok(arena.includes('player.aimAngle = safeInput.aimAngle'));
  assert.ok(!arena.includes('getPvpAimAssistAngle'));
  assert.ok(html.includes('id="pvp-fire-control"'));
  assert.ok(html.includes('id="btn-pvp-fire"'));
  assert.ok(html.includes('RUCH USTAWIA KIERUNEK'));
  assert.ok(!html.includes('id="pvp-aim-zone"'));
  assert.ok(!html.includes('id="pvp-aim-base"'));
  assert.ok(!css.includes('pvp-aim-zone'));
  assert.ok(!css.includes('pvp-aim-base'));
  assert.ok(!app.includes('pvp-aim-zone'));
  assert.ok(!game.includes('manualAimFiring'));
});

test('portrait PvP camera rotates screen-relative movement to match the arena axis', () => {
  assert.deepEqual(pvpScreenMovementToWorld(1, 0, false), { x: 1, z: 0 });
  assert.deepEqual(pvpScreenMovementToWorld(0, 1, false), { x: 0, z: -1 });
  assert.deepEqual(pvpScreenMovementToWorld(1, 0, true), { x: 0, z: -1 });
  assert.deepEqual(pvpScreenMovementToWorld(0, 1, true), { x: -1, z: 0 });
});

test('PvP camera fit scales to portrait and landscape without clipping arena width', async () => {
  const { calculatePvpCameraFrame } = await import('../src/pvpCamera.ts');
  const bounds = { minX: -22, maxX: 22, minZ: -12, maxZ: 12 };
  for (const viewport of [
    { width: 393, height: 852 },
    { width: 432, height: 768 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1080 },
  ]) {
    const frame = calculatePvpCameraFrame(viewport.width, viewport.height, { x: 4, z: -3 }, bounds);
    assert.equal(frame.portrait, viewport.width / viewport.height < 0.86);
    assert.ok(frame.visibleWidth >= frame.requiredWidth * 1.1, `horizontal arena coverage at ${viewport.width}x${viewport.height}`);
    assert.ok(Math.abs(frame.target.x - 4) < 1e-9);
    assert.ok(Math.abs(frame.target.z + 3) < 1e-9);
    assert.ok(frame.position.x !== frame.target.x || frame.position.z !== frame.target.z);
    assert.ok(frame.fitDistance > 0);
  }
});

test('aim preview stops at the first cover piece instead of drawing through it', () => {
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

test('aim preview marks a target only when it lies on a clear firing ray', () => {
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

test('aim preview remains finite for malformed directions and clips to arena bounds', () => {
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
