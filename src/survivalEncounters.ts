/**
 * A rare Bosman encounter adds a short pressure spike, but duplicate active
 * bosses turn a normal spawn pack into an unfair pile-on. Keep this as a
 * one-at-a-time encounter while allowing a new one after the previous is down.
 */
export function shouldSpawnBosmanKrakow(
  wave: number,
  spawnRoll: number,
  alreadyActive: boolean,
): boolean {
  return Number.isFinite(wave)
    && Number.isFinite(spawnRoll)
    && wave >= 6
    && spawnRoll >= 0
    && spawnRoll < 0.04
    && !alreadyActive;
}
