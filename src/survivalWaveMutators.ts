export type SurvivalWaveMutatorId = 'standard' | 'rush' | 'armored' | 'supply';

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
};

const MUTATORS: readonly SurvivalWaveMutator[] = [
  {
    id: 'rush',
    title: 'SZYBKA ZMIANA',
    label: 'PRZYSPIESZONE NATARCIE',
    description: 'Przeciwnicy poruszają się o 18% szybciej, ale mają nieco mniej zdrowia. Pilnuj wolnych alejek.',
    icon: '⚡',
    color: '#f97316',
    healthMultiplier: 0.92,
    speedMultiplier: 1.18,
    xpMultiplier: 1,
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
    xpMultiplier: 1,
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
  },
] as const;

/** Waves 1–2 are the baseline. From wave 3, the three warehouse shifts rotate. */
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
