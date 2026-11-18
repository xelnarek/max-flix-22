export interface RenderInfoLike {
  render?: {
    calls?: number;
    triangles?: number;
    lines?: number;
    points?: number;
  };
  memory?: {
    geometries?: number;
    textures?: number;
  };
}

export interface RenderWindowMetrics {
  callsPerFrame: number;
  trianglesPerFrame: number;
  linesPerFrame: number;
  pointsPerFrame: number;
  geometries: number;
  textures: number;
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Convert counters accumulated with WebGLRenderer.info.autoReset=false into
 * per-frame averages, retaining the current geometry/texture object counts.
 */
export function summarizeRenderWindowMetrics(
  info: RenderInfoLike | null | undefined,
  frameCount: number,
): RenderWindowMetrics {
  const frames = Math.max(1, Math.floor(safeCount(frameCount)));
  const render = info?.render;
  const memory = info?.memory;
  return {
    callsPerFrame: roundMetric(safeCount(render?.calls) / frames),
    trianglesPerFrame: roundMetric(safeCount(render?.triangles) / frames),
    linesPerFrame: roundMetric(safeCount(render?.lines) / frames),
    pointsPerFrame: roundMetric(safeCount(render?.points) / frames),
    geometries: Math.floor(safeCount(memory?.geometries)),
    textures: Math.floor(safeCount(memory?.textures)),
  };
}
