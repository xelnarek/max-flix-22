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

export type SurvivalBossVariant = 'walczak' | 'krol_leto' | 'bosman_krakow';

/**
 * Rotate the major Survival boss visual/mechanics across three distinct rigs.
 * The 5-minute cadence stays unchanged: 5/10/15 minutes cycle Walczak,
 * Dyrektor Widmo and Bosman Kraków, then repeat.
 */
export function getSurvivalBossVariant(wave: number): SurvivalBossVariant {
  const safeWave = Number.isFinite(wave) ? Math.max(5, Math.floor(wave)) : 5;
  const cycle = Math.max(0, Math.floor(safeWave / 5) - 1) % 3;
  if (cycle === 1) return 'krol_leto';
  if (cycle === 2) return 'bosman_krakow';
  return 'walczak';
}


/** Shared classification for the three rotating major Survival boss rigs. */
export function isMajorSurvivalBossType(type: string): boolean {
  return type === 'walczak' || type === 'krol_leto' || type === 'bosman_krakow';
}
