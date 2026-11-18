import type { SurvivalMapId } from './survivalMaps.ts';

export type CampaignStageId = 'b4_intro' | 'port_17' | 'cold_zero' | 'night_sorting' | 'final_audit';
export type CampaignRewardId = 'reinforced_vest' | 'damage_core' | 'rapid_loader' | 'xp_manifest' | 'mobility_boots' | 'reserve_crate';
export type CampaignMasteryMetric = 'perfect_dodges' | 'kill_streak' | 'xp_streak' | 'operator_level';

export interface CampaignMasteryObjective {
  metric: CampaignMasteryMetric;
  target: number;
  label: string;
  description: string;
}

export interface CampaignStageDefinition {
  id: CampaignStageId;
  order: number;
  title: string;
  mapId: SurvivalMapId;
  durationSeconds: number;
  waveIntervalSeconds: number;
  bossSpawnAtSeconds: number;
  bossWave: number;
  bossHpMultiplier: number;
  bonusKillTarget: number;
  mastery: CampaignMasteryObjective;
  bossTitle: string;
  objective: string;
  reward: string;
}

export interface CampaignRewardDefinition {
  id: CampaignRewardId;
  title: string;
  icon: string;
  description: string;
  effect: 'armor' | 'damage' | 'rapid' | 'xp' | 'mobility' | 'reserve';
}

export const CAMPAIGN_PROGRESS_STORAGE_KEY = 'warehouse-maddnes.campaign.progress.v1';

export const CAMPAIGN_STAGES: readonly CampaignStageDefinition[] = [
  {
    id: 'b4_intro', order: 1, title: 'Magazyn B4', mapId: 'warehouse_b4',
    durationSeconds: 90, waveIntervalSeconds: 30, bossSpawnAtSeconds: 52,
    bossWave: 6, bossHpMultiplier: 0.72, bonusKillTarget: 10,
    mastery: { metric: 'perfect_dodges', target: 1, label: 'PERFEKCYJNY UNIK', description: 'Wykonaj 1 perfekcyjny unik' },
    bossTitle: 'Nadzorca Rampy',
    objective: 'Utrzymaj aleję B4 i pokonaj Nadzorcę Rampy.',
    reward: 'Odblokowanie Portu Kontenerowego 17',
  },
  {
    id: 'port_17', order: 2, title: 'Port Kontenerowy 17', mapId: 'container_terminal',
    durationSeconds: 120, waveIntervalSeconds: 30, bossSpawnAtSeconds: 72,
    bossWave: 10, bossHpMultiplier: 0.70, bonusKillTarget: 14,
    mastery: { metric: 'kill_streak', target: 6, label: 'SERIA ELIMINACJI', description: 'Zbuduj serię 6 eliminacji' },
    bossTitle: 'Dyrektor Widmo',
    objective: 'Przebij się przez plac przeładunkowy i pokonaj Dyrektora Widmo.',
    reward: 'Odblokowanie Chłodni Zero',
  },
  {
    id: 'cold_zero', order: 3, title: 'Chłodnia Zero', mapId: 'cold_storage',
    durationSeconds: 150, waveIntervalSeconds: 35, bossSpawnAtSeconds: 92,
    bossWave: 15, bossHpMultiplier: 0.65, bonusKillTarget: 19,
    mastery: { metric: 'xp_streak', target: 3, label: 'ŁAŃCUCH XP', description: 'Zbierz 3 kryształy XP w krótkim łańcuchu' },
    bossTitle: 'Bosman Kraków',
    objective: 'Przetrwaj mroźne strefy i pokonaj Bosmana Kraków.',
    reward: 'Odblokowanie Sortowni Widmowej',
  },
  {
    id: 'night_sorting', order: 4, title: 'Sortownia Widmowa', mapId: 'night_sorting',
    durationSeconds: 180, waveIntervalSeconds: 40, bossSpawnAtSeconds: 116,
    bossWave: 20, bossHpMultiplier: 0.72, bonusKillTarget: 25,
    mastery: { metric: 'operator_level', target: 4, label: 'AWANS OPERATORA', description: 'Osiągnij poziom 4 przed walką z bossem' },
    bossTitle: 'Nadzorca Zero',
    objective: 'Unikaj skanerów i pokonaj Nadzorcę Zero.',
    reward: 'Odblokowanie Audytu Końcowego',
  },
  {
    id: 'final_audit', order: 5, title: 'Audyt Końcowy', mapId: 'night_sorting',
    durationSeconds: 210, waveIntervalSeconds: 42, bossSpawnAtSeconds: 142,
    bossWave: 25, bossHpMultiplier: 0.76, bonusKillTarget: 31,
    mastery: { metric: 'perfect_dodges', target: 3, label: 'SERIA UNIKÓW', description: 'Wykonaj 3 perfekcyjne uniki' },
    bossTitle: 'Dyrektor Ostateczny',
    objective: 'Połącz wszystkie umiejętności i pokonaj Dyrektora Ostatecznego.',
    reward: 'Odznaka Mistrza Zmiany',
  },
] as const;

export const CAMPAIGN_REWARDS: readonly CampaignRewardDefinition[] = [
  { id: 'reinforced_vest', title: 'Kamizelka BHP', icon: '🛡️', description: '+1 maksymalne HP i natychmiastowe uzupełnienie tego punktu', effect: 'armor' },
  { id: 'damage_core', title: 'Rdzeń Uderzeniowy', icon: '💥', description: '+12% obrażeń ataków podstawowych, umiejętności i broni', effect: 'damage' },
  { id: 'rapid_loader', title: 'Podwójna Kawa', icon: '☕', description: '+8% szybkości ataku i przeładowania broni', effect: 'rapid' },
  { id: 'xp_manifest', title: 'Manifest XP', icon: '📦', description: '+20% wartości zbieranych kryształów doświadczenia', effect: 'xp' },
  { id: 'mobility_boots', title: 'Buty Magazynowe', icon: '👟', description: '+8% prędkości ruchu i szybsze odnowienie uniku', effect: 'mobility' },
  { id: 'reserve_crate', title: 'Skrzynia Rezerwowa', icon: '🎁', description: '+1 przerzut i +1 pominięcie przy wyborze ulepszeń', effect: 'reserve' },
] as const;

export type CampaignStageResult = {
  bestStars: number;
  bestKills: number;
  bestTimeSeconds: number;
  bestMasteryValue: number;
  completions: number;
};

export interface CampaignProgress {
  version: 1;
  unlockedStageIds: CampaignStageId[];
  completedStages: Partial<Record<CampaignStageId, CampaignStageResult>>;
  pendingRewardId: CampaignRewardId | null;
  pendingRewardStageId: CampaignStageId | null;
}

export interface CampaignMasteryStats {
  perfectDodges?: number;
  killStreak?: number;
  xpStreak?: number;
  level?: number;
}

export interface CampaignMasteryProgress {
  metric: CampaignMasteryMetric;
  label: string;
  description: string;
  value: number;
  target: number;
  completed: boolean;
}

export function getCampaignStageDefinition(id: CampaignStageId | string | null | undefined): CampaignStageDefinition | null {
  return CAMPAIGN_STAGES.find((stage) => stage.id === id) ?? null;
}

export function getCampaignRewardDefinition(id: CampaignRewardId | string | null | undefined): CampaignRewardDefinition | null {
  return CAMPAIGN_REWARDS.find((reward) => reward.id === id) ?? null;
}

export function createInitialCampaignProgress(): CampaignProgress {
  return {
    version: 1,
    unlockedStageIds: [CAMPAIGN_STAGES[0]!.id],
    completedStages: {},
    pendingRewardId: null,
    pendingRewardStageId: null,
  };
}

function safeInt(value: unknown, min = 0, max = 1000000): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : min;
}

function isCampaignStageId(value: unknown): value is CampaignStageId {
  return typeof value === 'string' && CAMPAIGN_STAGES.some((stage) => stage.id === value);
}

function isCampaignRewardId(value: unknown): value is CampaignRewardId {
  return typeof value === 'string' && CAMPAIGN_REWARDS.some((reward) => reward.id === value);
}

export function getCampaignMasteryProgress(
  stage: CampaignStageDefinition,
  stats: CampaignMasteryStats,
): CampaignMasteryProgress {
  const objective = stage.mastery;
  let value = 0;
  switch (objective.metric) {
    case 'perfect_dodges': value = safeInt(stats.perfectDodges); break;
    case 'kill_streak': value = safeInt(stats.killStreak); break;
    case 'xp_streak': value = safeInt(stats.xpStreak); break;
    case 'operator_level': value = safeInt(stats.level, 1); break;
  }
  const target = safeInt(objective.target, 1, 100000);
  return {
    metric: objective.metric,
    label: objective.label,
    description: objective.description,
    value,
    target,
    completed: value >= target,
  };
}

export function sanitizeCampaignProgress(value: unknown): CampaignProgress {
  if (!value || typeof value !== 'object') return createInitialCampaignProgress();

  const raw = value as Partial<CampaignProgress>;
  const records = raw.completedStages && typeof raw.completedStages === 'object'
    ? raw.completedStages as Record<string, unknown>
    : {};
  const completedStages: CampaignProgress['completedStages'] = {};

  for (const stage of CAMPAIGN_STAGES) {
    const record = records[stage.id];
    if (!record || typeof record !== 'object') continue;
    const entry = record as Partial<CampaignStageResult>;
    const stars = safeInt(entry.bestStars, 0, 3);
    if (stars <= 0) continue;
    completedStages[stage.id] = {
      bestStars: stars,
      bestKills: safeInt(entry.bestKills),
      bestTimeSeconds: safeInt(entry.bestTimeSeconds),
      // Older v1 saves did not store the mastery objective value.
      bestMasteryValue: safeInt(entry.bestMasteryValue),
      completions: Math.max(1, safeInt(entry.completions)),
    };
  }

  const unlockedStageIds: CampaignStageId[] = [CAMPAIGN_STAGES[0]!.id];
  for (let index = 0; index < CAMPAIGN_STAGES.length - 1; index += 1) {
    if (!completedStages[CAMPAIGN_STAGES[index]!.id]) break;
    unlockedStageIds.push(CAMPAIGN_STAGES[index + 1]!.id);
  }

  const pendingRewardId = isCampaignRewardId(raw.pendingRewardId) ? raw.pendingRewardId : null;
  const pendingRewardStageId = isCampaignStageId(raw.pendingRewardStageId)
    && unlockedStageIds.includes(raw.pendingRewardStageId)
    && pendingRewardId
    ? raw.pendingRewardStageId
    : null;

  return {
    version: 1,
    unlockedStageIds,
    completedStages,
    pendingRewardId: pendingRewardStageId ? pendingRewardId : null,
    pendingRewardStageId,
  };
}

export function readCampaignProgress(storage: Pick<Storage, 'getItem'>): CampaignProgress {
  try {
    const raw = storage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY);
    return raw ? sanitizeCampaignProgress(JSON.parse(raw)) : createInitialCampaignProgress();
  } catch {
    return createInitialCampaignProgress();
  }
}

export function writeCampaignProgress(storage: Pick<Storage, 'setItem'>, value: unknown): boolean {
  try {
    storage.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, JSON.stringify(sanitizeCampaignProgress(value)));
    return true;
  } catch {
    return false;
  }
}

export function evaluateCampaignStars(
  stage: CampaignStageDefinition,
  result: { bossDefeated: boolean; kills: number } & CampaignMasteryStats,
): number {
  if (!result.bossDefeated) return 0;
  const kills = safeInt(result.kills);
  if (kills < stage.bonusKillTarget) return 1;
  return getCampaignMasteryProgress(stage, result).completed ? 3 : 2;
}

/** Return three repeatable, unique reward choices for this clear. */
export function getCampaignRewardChoices(stageId: CampaignStageId, completionNumber = 1): CampaignRewardDefinition[] {
  const stage = getCampaignStageDefinition(stageId);
  if (!stage) return [];
  const pool = [...CAMPAIGN_REWARDS];
  let seed = (stage.order * 7919 + safeInt(completionNumber, 1, 100000) * 104729) >>> 0;
  const choices: CampaignRewardDefinition[] = [];

  while (choices.length < 3 && pool.length > 0) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const index = seed % pool.length;
    choices.push(pool.splice(index, 1)[0]!);
  }

  return choices;
}

/** Save a reward for one exact next stage; unrelated stage starts cannot consume it. */
export function setPendingCampaignReward(value: unknown, stageId: CampaignStageId, rewardId: CampaignRewardId): CampaignProgress {
  const progress = sanitizeCampaignProgress(value);
  if (!progress.unlockedStageIds.includes(stageId) || !getCampaignRewardDefinition(rewardId)) return progress;
  progress.pendingRewardId = rewardId;
  progress.pendingRewardStageId = stageId;
  return sanitizeCampaignProgress(progress);
}

/** Consume the carried reward once, only when the matching next stage starts. */
export function consumePendingCampaignReward(
  value: unknown,
  stageId: CampaignStageId,
): { progress: CampaignProgress; rewardId: CampaignRewardId | null } {
  const progress = sanitizeCampaignProgress(value);
  if (progress.pendingRewardStageId !== stageId || !progress.pendingRewardId) {
    return { progress, rewardId: null };
  }

  const rewardId = progress.pendingRewardId;
  progress.pendingRewardId = null;
  progress.pendingRewardStageId = null;
  return { progress: sanitizeCampaignProgress(progress), rewardId };
}

export function recordCampaignStageResult(
  value: unknown,
  id: CampaignStageId,
  result: { bossDefeated: boolean; kills: number; elapsedSeconds: number } & CampaignMasteryStats,
): CampaignProgress {
  const progress = sanitizeCampaignProgress(value);
  const index = CAMPAIGN_STAGES.findIndex((stage) => stage.id === id);
  const stage = CAMPAIGN_STAGES[index];
  if (!stage || !progress.unlockedStageIds.includes(id) || !result.bossDefeated) return progress;

  const stars = evaluateCampaignStars(stage, result);
  if (!stars) return progress;

  const mastery = getCampaignMasteryProgress(stage, result);
  const previous = progress.completedStages[id];
  const elapsed = Math.max(1, safeInt(result.elapsedSeconds));
  progress.completedStages[id] = {
    bestStars: Math.max(previous?.bestStars ?? 0, stars),
    bestKills: Math.max(previous?.bestKills ?? 0, safeInt(result.kills)),
    bestTimeSeconds: previous?.bestTimeSeconds ? Math.min(previous.bestTimeSeconds, elapsed) : elapsed,
    bestMasteryValue: Math.max(previous?.bestMasteryValue ?? 0, mastery.value),
    completions: (previous?.completions ?? 0) + 1,
  };

  const nextStage = CAMPAIGN_STAGES[index + 1];
  if (nextStage && !progress.unlockedStageIds.includes(nextStage.id)) {
    progress.unlockedStageIds.push(nextStage.id);
  }
  return sanitizeCampaignProgress(progress);
}

export function getNextCampaignStageId(value: unknown, id: CampaignStageId): CampaignStageId | null {
  const progress = sanitizeCampaignProgress(value);
  const index = CAMPAIGN_STAGES.findIndex((stage) => stage.id === id);
  const nextStage = CAMPAIGN_STAGES[index + 1];
  return nextStage && progress.unlockedStageIds.includes(nextStage.id) ? nextStage.id : null;
}
