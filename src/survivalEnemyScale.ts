export interface SurvivalEnemySizeProfile {
  scaleMultiplier: number;
  healthMultiplier: number;
  speedMultiplier: number;
  label: string;
}

/** Five size bands keep the crowd visually varied without changing boss rigs. */
export function getSurvivalEnemySizeProfile(roll: number): SurvivalEnemySizeProfile {
  const value = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999999, roll)) : 0.5;
  if (value < 0.12) {
    return { scaleMultiplier: 0.72, healthMultiplier: 0.78, speedMultiplier: 1.18, label: 'KARZEŁ' };
  }
  if (value < 0.32) {
    return { scaleMultiplier: 0.88, healthMultiplier: 0.90, speedMultiplier: 1.08, label: 'DROBIAZG' };
  }
  if (value < 0.90) {
    return { scaleMultiplier: 1, healthMultiplier: 1, speedMultiplier: 1, label: '' };
  }
  if (value < 0.975) {
    return { scaleMultiplier: 1.22, healthMultiplier: 1.25, speedMultiplier: 0.90, label: 'GIGANT' };
  }
  return { scaleMultiplier: 1.38, healthMultiplier: 1.52, speedMultiplier: 0.78, label: 'Kolos B4' };
}
