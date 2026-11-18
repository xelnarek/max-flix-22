import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRenderWindowMetrics } from '../src/renderTelemetry.ts';

test('render telemetry averages every render pass over the sampling window', () => {
  assert.deepEqual(summarizeRenderWindowMetrics({
    render: { calls: 2400, triangles: 120000, lines: 600, points: 300 },
    memory: { geometries: 84, textures: 26 },
  }, 60), {
    callsPerFrame: 40,
    trianglesPerFrame: 2000,
    linesPerFrame: 10,
    pointsPerFrame: 5,
    geometries: 84,
    textures: 26,
  });
});

test('render telemetry retains object counts while clamping malformed counters', () => {
  assert.deepEqual(summarizeRenderWindowMetrics({
    render: { calls: Number.NaN, triangles: -2, lines: Number.POSITIVE_INFINITY, points: 3.25 },
    memory: { geometries: -1, textures: 7.9 },
  }, 10), {
    callsPerFrame: 0,
    trianglesPerFrame: 0,
    linesPerFrame: 0,
    pointsPerFrame: 0.3,
    geometries: 0,
    textures: 7,
  });
});

test('empty windows and absent renderer counters fail safely without NaN output', () => {
  assert.deepEqual(summarizeRenderWindowMetrics(undefined, 0), {
    callsPerFrame: 0,
    trianglesPerFrame: 0,
    linesPerFrame: 0,
    pointsPerFrame: 0,
    geometries: 0,
    textures: 0,
  });
});
