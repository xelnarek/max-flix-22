export type GameSpeed = 1 | 2;

export function normalizeGameSpeed(value: unknown): GameSpeed {
  return value === 2 || value === '2' ? 2 : 1;
}

/**
 * Clamp long frame stalls before applying the selected simulation multiplier.
 * This keeps 2x responsive without allowing a background-tab hitch to teleport
 * the player or skip several combat telegraphs in one update.
 */
export function getScaledSimulationDelta(realDeltaSeconds: number, speed: unknown): number {
  const safeDelta = Number.isFinite(realDeltaSeconds)
    ? Math.min(1 / 30, Math.max(0, realDeltaSeconds))
    : 0;
  return safeDelta * normalizeGameSpeed(speed);
}
