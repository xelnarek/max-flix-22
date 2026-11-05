import { SURVIVAL_MAP_IDS, getSurvivalSecretKeys, type SurvivalMapId } from './survivalMaps.ts';

export interface SurvivalAchievementProgress {
  unlocked: string[];
  mapsVisited: SurvivalMapId[];
  discoveredSecrets: string[];
  bestKills: number;
  bestSurvivalSeconds: number;
  bestBossesDefeated: number;
}

export interface SurvivalAchievementSnapshot {
  mapId: SurvivalMapId;
  kills: number;
  elapsedSeconds: number;
  bossesDefeated: number;
}

export interface SurvivalAchievementCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  current: number;
  target: number;
  progressLabel: string;
}

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  unit: string;
  measure: 'bestKills' | 'bestSurvivalSeconds' | 'bestBossesDefeated' | 'mapsVisited' | 'discoveredSecrets';
}

export const SURVIVAL_ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'first_blood', title: 'Pierwsza zmiana', description: 'Zlikwiduj pierwszego przeciwnika w Survival.', icon: '🎯', target: 1, unit: 'eliminacja', measure: 'bestKills' },
  { id: 'warehouse_veteran', title: 'Norma wyrobiona', description: 'Zdobądź 50 eliminacji podczas jednej rozgrywki.', icon: '⚙️', target: 50, unit: 'eliminacji', measure: 'bestKills' },
  { id: 'long_shift', title: 'Długa zmiana', description: 'Przetrwaj co najmniej 5 minut w jednej rozgrywce.', icon: '⏱️', target: 300, unit: 's', measure: 'bestSurvivalSeconds' },
  { id: 'night_shift', title: 'Nocna zmiana', description: 'Przetrwaj co najmniej 10 minut w jednej rozgrywce.', icon: '🌙', target: 600, unit: 's', measure: 'bestSurvivalSeconds' },
  { id: 'boss_breaker', title: 'Inspektor do odstrzału', description: 'Pokonaj trzech głównych bossów podczas jednej rozgrywki.', icon: '👔', target: 3, unit: 'bossów', measure: 'bestBossesDefeated' },
  { id: 'map_explorer', title: 'Kartograf zmiany', description: 'Rozegraj mecz na każdej z trzech map.', icon: '🗺️', target: 3, unit: 'mapy', measure: 'mapsVisited' },
  { id: 'secret_hunter', title: 'Łowca sekretów', description: 'Odkryj trzy różne sekrety na dowolnych mapach.', icon: '🔎', target: 3, unit: 'sekrety', measure: 'discoveredSecrets' },
  { id: 'secret_archive', title: 'Archiwum B4', description: 'Zbierz wszystkie dziewięć sekretów ukrytych na trzech mapach.', icon: '🏆', target: 9, unit: 'sekretów', measure: 'discoveredSecrets' },
] as const;

export function createInitialSurvivalAchievementProgress(): SurvivalAchievementProgress {
  return {
    unlocked: [],
    mapsVisited: [],
    discoveredSecrets: [],
    bestKills: 0,
    bestSurvivalSeconds: 0,
    bestBossesDefeated: 0,
  };
}

const safeCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

function uniqueValidStrings(values: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  const valid = new Set(allowed);
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && valid.has(value)))];
}

export function sanitizeSurvivalAchievementProgress(value: unknown): SurvivalAchievementProgress {
  if (!value || typeof value !== 'object') return createInitialSurvivalAchievementProgress();
  const raw = value as Partial<SurvivalAchievementProgress>;
  const initial = createInitialSurvivalAchievementProgress();
  const allowedAchievements = SURVIVAL_ACHIEVEMENTS.map((achievement) => achievement.id);
  return {
    unlocked: uniqueValidStrings(raw.unlocked, allowedAchievements),
    mapsVisited: uniqueValidStrings(raw.mapsVisited, SURVIVAL_MAP_IDS) as SurvivalMapId[],
    discoveredSecrets: uniqueValidStrings(raw.discoveredSecrets, getSurvivalSecretKeys()),
    bestKills: safeCount(raw.bestKills),
    bestSurvivalSeconds: safeCount(raw.bestSurvivalSeconds),
    bestBossesDefeated: safeCount(raw.bestBossesDefeated),
  };
}

function getMeasureValue(
  progress: SurvivalAchievementProgress,
  measure: AchievementDefinition['measure'],
): number {
  switch (measure) {
    case 'bestKills': return progress.bestKills;
    case 'bestSurvivalSeconds': return progress.bestSurvivalSeconds;
    case 'bestBossesDefeated': return progress.bestBossesDefeated;
    case 'mapsVisited': return progress.mapsVisited.length;
    case 'discoveredSecrets': return progress.discoveredSecrets.length;
  }
}

function unlockCompletedAchievements(
  progress: SurvivalAchievementProgress,
): { progress: SurvivalAchievementProgress; newlyUnlocked: string[] } {
  const unlocked = new Set(progress.unlocked);
  const newlyUnlocked: string[] = [];
  for (const achievement of SURVIVAL_ACHIEVEMENTS) {
    if (getMeasureValue(progress, achievement.measure) < achievement.target || unlocked.has(achievement.id)) continue;
    unlocked.add(achievement.id);
    newlyUnlocked.push(achievement.id);
  }
  return {
    progress: { ...progress, unlocked: [...unlocked] },
    newlyUnlocked,
  };
}

export function updateSurvivalAchievementProgress(
  current: SurvivalAchievementProgress,
  snapshot: SurvivalAchievementSnapshot,
): { progress: SurvivalAchievementProgress; newlyUnlocked: string[] } {
  const normalized = sanitizeSurvivalAchievementProgress(current);
  const visited = new Set(normalized.mapsVisited);
  if (SURVIVAL_MAP_IDS.includes(snapshot.mapId)) visited.add(snapshot.mapId);
  const next: SurvivalAchievementProgress = {
    ...normalized,
    mapsVisited: [...visited],
    bestKills: Math.max(normalized.bestKills, safeCount(snapshot.kills)),
    bestSurvivalSeconds: Math.max(normalized.bestSurvivalSeconds, safeCount(snapshot.elapsedSeconds)),
    bestBossesDefeated: Math.max(normalized.bestBossesDefeated, safeCount(snapshot.bossesDefeated)),
  };
  return unlockCompletedAchievements(next);
}

export function recordSurvivalSecretDiscovery(
  current: SurvivalAchievementProgress,
  mapId: SurvivalMapId,
  secretId: string,
): { progress: SurvivalAchievementProgress; newlyUnlocked: string[]; added: boolean } {
  const normalized = sanitizeSurvivalAchievementProgress(current);
  const key = mapId + ':' + secretId;
  const allowedKeys = new Set(getSurvivalSecretKeys());
  if (!allowedKeys.has(key) || normalized.discoveredSecrets.includes(key)) {
    return { progress: normalized, newlyUnlocked: [], added: false };
  }
  const next = { ...normalized, discoveredSecrets: [...normalized.discoveredSecrets, key] };
  const unlocked = unlockCompletedAchievements(next);
  return { ...unlocked, added: true };
}

export function getSurvivalAchievementCards(
  value: SurvivalAchievementProgress,
): SurvivalAchievementCard[] {
  const progress = sanitizeSurvivalAchievementProgress(value);
  const unlocked = new Set(progress.unlocked);
  return SURVIVAL_ACHIEVEMENTS.map((achievement) => {
    const current = Math.min(achievement.target, getMeasureValue(progress, achievement.measure));
    const progressLabel = achievement.measure === 'bestSurvivalSeconds'
      ? Math.floor(current / 60) + ' / ' + Math.floor(achievement.target / 60) + ' min'
      : current + ' / ' + achievement.target + ' ' + achievement.unit;
    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      unlocked: unlocked.has(achievement.id),
      current,
      target: achievement.target,
      progressLabel,
    };
  });
}

export function getSurvivalAchievementSummary(value: SurvivalAchievementProgress): {
  unlocked: number;
  total: number;
  discoveredSecrets: number;
  totalSecrets: number;
} {
  const progress = sanitizeSurvivalAchievementProgress(value);
  return {
    unlocked: progress.unlocked.length,
    total: SURVIVAL_ACHIEVEMENTS.length,
    discoveredSecrets: progress.discoveredSecrets.length,
    totalSecrets: getSurvivalSecretKeys().length,
  };
}
