import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivalFloorAtlasSample } from '../src/survivalFloorAtlas.ts';

function channels(color) {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

function colorDistance(a, b) {
  const left = channels(a);
  const right = channels(b);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

test('each connected Survival biome has a distinct restrained floor surface', () => {
  const centres = [
    getSurvivalFloorAtlasSample(-60, -20),
    getSurvivalFloorAtlasSample(60, -20),
    getSurvivalFloorAtlasSample(60, 20),
    getSurvivalFloorAtlasSample(-60, 20),
  ];
  const colours = centres.map((sample) => sample.color);
  assert.equal(new Set(colours).size, 4, 'each biome centre should have its own floor signature');
  for (const sample of centres) {
    assert.ok(channels(sample.color).every((channel) => channel >= 0 && channel <= 132));
    assert.ok(sample.alpha >= 0.68 && sample.alpha <= 0.76);
  }
});

test('horizontal and vertical biome seams blend continuously without a pale strip', () => {
  for (const [left, right] of [
    [getSurvivalFloorAtlasSample(-0.1, -20), getSurvivalFloorAtlasSample(0.1, -20)],
    [getSurvivalFloorAtlasSample(60, -0.1), getSurvivalFloorAtlasSample(60, 0.1)],
    [getSurvivalFloorAtlasSample(-0.1, 20), getSurvivalFloorAtlasSample(0.1, 20)],
    [getSurvivalFloorAtlasSample(-60, -0.1), getSurvivalFloorAtlasSample(-60, 0.1)],
  ]) {
    assert.ok(colorDistance(left.color, right.color) < 18.0);
    assert.ok(Math.max(...channels(left.color), ...channels(right.color)) < 132);
    assert.ok(Math.abs(left.alpha - right.alpha) < 0.015);
  }
});

test('the four-way junction mixes all biome materials and returns finite bounded samples', () => {
  const sample = getSurvivalFloorAtlasSample(0, 0);
  assert.ok(Number.isFinite(sample.color));
  assert.ok(Number.isFinite(sample.alpha));
  assert.ok(sample.alpha >= 0.68 && sample.alpha <= 0.76);
  assert.ok(Math.max(...channels(sample.color)) < 132);

  for (const point of [[-120, -40], [120, -40], [-120, 40], [120, 40], [0, 0]]) {
    const edge = getSurvivalFloorAtlasSample(point[0], point[1]);
    assert.ok(edge.color >= 0 && edge.color <= 0xffffff);
    assert.ok(edge.alpha >= 0 && edge.alpha <= 1);
  }
});

test('the four arenas have visible, biome-specific painted floor markings', () => {
  const samples = [
    { lane: getSurvivalFloorAtlasSample(-60, -5.1), plain: getSurvivalFloorAtlasSample(-60, -6.8), channel: 'amber' },
    { lane: getSurvivalFloorAtlasSample(60, -7.3), plain: getSurvivalFloorAtlasSample(60, -4.0), channel: 'amber' },
    { lane: getSurvivalFloorAtlasSample(30, 20), plain: getSurvivalFloorAtlasSample(34.2, 20), channel: 'ice' },
    { lane: getSurvivalFloorAtlasSample(-60, 20), plain: getSurvivalFloorAtlasSample(-60, 22.2), channel: 'scanner' },
  ];
  for (const { lane, plain, channel } of samples) {
    const laneRgb = channels(lane.color);
    const plainRgb = channels(plain.color);
    if (channel === 'amber') {
      assert.ok(laneRgb[0] - plainRgb[0] >= 8, channel + ' marking should lift red');
      assert.ok(laneRgb[1] - plainRgb[1] >= 5, channel + ' marking should lift green');
    } else if (channel === 'ice') {
      assert.ok(laneRgb[2] - plainRgb[2] >= 8, channel + ' marking should lift blue');
    } else {
      assert.ok(laneRgb[0] - plainRgb[0] >= 8, channel + ' marking should lift red');
      assert.ok(laneRgb[2] - plainRgb[2] >= 10, channel + ' marking should lift blue');
    }
  }
});

test('painted floor markings stay within the existing dark industrial exposure budget', () => {
  const points = [
    [-60, -5.1], [60, -7.3], [30, 20], [-60, 20],
    [-48, -2.7], [108, -7.3], [90, 36.2], [-24, 37.25],
  ];
  for (const [x, z] of points) {
    const rgb = channels(getSurvivalFloorAtlasSample(x, z).color);
    assert.ok(Math.max(...rgb) <= 132, 'floor markings must not become a pale emissive patch');
    assert.ok(rgb.every((channel) => Number.isFinite(channel) && channel >= 0));
  }
});
