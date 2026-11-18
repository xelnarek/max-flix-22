export type SurvivalWaveMutatorId = 'standard' | 'rush' | 'armored' | 'supply' | 'swarm' | 'convoy';

export interface SurvivalWaveMutator {
  id: SurvivalWaveMutatorId;
  title: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  healthMultiplier: number;
  speedMultiplier: number;
  xpMultiplier: number;
  /** Multiplies the normal interval between regular enemy groups. */
  spawnIntervalMultiplier: number;
  /** Adds to the normal group size before the device-specific cap is applied. */
  groupSizeBonus: number;
}

const STANDARD: SurvivalWaveMutator = {
  id: 'standard',
  title: 'STANDARDOWA ZMIANA',
  label: 'BEZ MODYFIKATORA',
  description: 'Hala pracuje w normalnym rytmie. Utrzymaj pozycję i buduj zestaw ulepszeń.',
  icon: '📦',
  color: '#64748b',
  healthMultiplier: 1,
  speedMultiplier: 1,
  xpMultiplier: 1,
  spawnIntervalMultiplier: 1,
  groupSizeBonus: 0,
};

const MUTATORS: readonly SurvivalWaveMutator[] = [
  {
    id: 'rush',
    title: 'SZYBKA ZMIANA',
    label: 'PRZYSPIESZONE NATARCIE',
    description: 'Przeciwnicy poruszają się o 18% szybciej i mają nieco mniej zdrowia. Pilnuj wolnych alejek.',
    icon: '⚡',
    color: '#f97316',
    healthMultiplier: 0.92,
    speedMultiplier: 1.18,
    xpMultiplier: 1.05,
    spawnIntervalMultiplier: 1,
    groupSizeBonus: 0,
  },
  {
    id: 'armored',
    title: 'PANCERNA ZMIANA',
    label: 'WZMOCNIONA OCHRONA',
    description: 'Wrogowie mają więcej zdrowia i wolniej nacierają. Część oddziału otrzymuje dodatkową osłonę.',
    icon: '🛡️',
    color: '#38bdf8',
    healthMultiplier: 1.28,
    speedMultiplier: 0.9,
    xpMultiplier: 1.12,
    spawnIntervalMultiplier: 1.08,
    groupSizeBonus: -1,
  },
  {
    id: 'supply',
    title: 'ZŁOTA DOSTAWA',
    label: 'PREMIA DO DOŚWIADCZENIA',
    description: 'Każdy pokonany przeciwnik zostawia o 50% więcej doświadczenia. Wykorzystaj tę zmianę do rozwoju zestawu.',
    icon: '📦',
    color: '#facc15',
    healthMultiplier: 1,
    speedMultiplier: 1,
    xpMultiplier: 1.5,
    spawnIntervalMultiplier: 1,
    groupSizeBonus: 0,
  },
  {
    id: 'swarm',
    title: 'SZTURM PALETOWY',
    label: 'WIĘKSZE I CZĘSTSZE GRUPY',
    description: 'Do alejek wjeżdżają większe, częściej dostarczane grupy. Pojedynczy przeciwnicy są słabsi, a łupy dają więcej XP.',
    icon: '🚚',
    color: '#fb923c',
    healthMultiplier: 0.9,
    speedMultiplier: 1.06,
    xpMultiplier: 1.35,
    spawnIntervalMultiplier: 0.86,
    groupSizeBonus: 2,
  },
  {
    id: 'convoy',
    title: 'KONWÓJ PREMIUM',
    label: 'CIĘŻKI ŁADUNEK • WYSOKA NAGRODA',
    description: 'Mniejszy konwój pancernych jednostek naciera wolniej. Każda eliminacja zapewnia znacznie więcej doświadczenia.',
    icon: '🏗️',
    color: '#a78bfa',
    healthMultiplier: 1.18,
    speedMultiplier: 0.92,
    xpMultiplier: 1.65,
    spawnIntervalMultiplier: 1.14,
    groupSizeBonus: -1,
  },
] as const;

/** Waves 1–2 are the baseline. From wave 3, five distinct warehouse shifts rotate. */
export function getSurvivalWaveMutator(wave: number): SurvivalWaveMutator {
  const safeWave = Number.isFinite(wave) ? Math.max(1, Math.floor(wave)) : 1;
  if (safeWave < 3) return STANDARD;
  return MUTATORS[(safeWave - 3) % MUTATORS.length];
}

export interface SurvivalEnemyWaveStats {
  maxHp: number;
  speed: number;
  xpMultiplier: number;
}

/** Apply bounded, integer-HP wave tuning without mutating the source enemy. */
export function applySurvivalWaveMutator(
  stats: { maxHp: number; speed: number },
  mutator: SurvivalWaveMutator,
): SurvivalEnemyWaveStats {
  const hp = Number.isFinite(stats.maxHp) ? Math.max(1, stats.maxHp) : 1;
  const speed = Number.isFinite(stats.speed) ? Math.max(0.1, stats.speed) : 0.1;
  const hpMultiplier = Number.isFinite(mutator.healthMultiplier)
    ? Math.max(0.75, Math.min(1.5, mutator.healthMultiplier))
    : 1;
  const speedMultiplier = Number.isFinite(mutator.speedMultiplier)
    ? Math.max(0.75, Math.min(1.25, mutator.speedMultiplier))
    : 1;
  const xpMultiplier = Number.isFinite(mutator.xpMultiplier)
    ? Math.max(1, Math.min(1.75, mutator.xpMultiplier))
    : 1;

  return {
    maxHp: Math.max(1, Math.ceil(hp * hpMultiplier)),
    speed: Math.max(0.1, speed * speedMultiplier),
    xpMultiplier,
  };
}

export interface SurvivalWaveSpawnTuning {
  spawnIntervalSeconds: number;
  groupSize: number;
}

/**
 * Convert the active wave rule into a bounded delivery schedule. Group caps
 * always come from the runtime performance budget, not from this mutator.
 */
export function getSurvivalWaveSpawnTuning(
  baseSpawnIntervalSeconds: number,
  baseGroupSize: number,
  mutator: SurvivalWaveMutator,
  maxGroupSize: number,
): SurvivalWaveSpawnTuning {
  const baseInterval = Number.isFinite(baseSpawnIntervalSeconds)
    ? Math.max(0.25, baseSpawnIntervalSeconds)
    : 5;
  const intervalMultiplier = Number.isFinite(mutator.spawnIntervalMultiplier)
    ? Math.max(0.75, Math.min(1.25, mutator.spawnIntervalMultiplier))
    : 1;
  const safeGroupCap = Number.isFinite(maxGroupSize)
    ? Math.max(1, Math.floor(maxGroupSize))
    : 1;
  const safeBaseGroup = Number.isFinite(baseGroupSize)
    ? Math.max(1, Math.floor(baseGroupSize))
    : 1;
  const groupBonus = Number.isFinite(mutator.groupSizeBonus)
    ? Math.max(-2, Math.min(3, Math.floor(mutator.groupSizeBonus)))
    : 0;

  return {
    spawnIntervalSeconds: Math.max(1.5, Math.min(15, baseInterval * intervalMultiplier)),
    groupSize: Math.max(1, Math.min(safeGroupCap, safeBaseGroup + groupBonus)),
  };
}
