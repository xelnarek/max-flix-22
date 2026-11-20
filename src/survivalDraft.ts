export interface SurvivalDraftContext {
  readonly stacks?: Readonly<Record<string, number>>;
  readonly evolutions?: readonly string[];
  readonly healthRatio?: number;
  readonly elapsedSeconds?: number;
}

export interface SurvivalDraftOption {
  readonly id: string;
}

type DraftCategory =
  | 'damage'
  | 'tempo'
  | 'precision'
  | 'mobility'
  | 'ability'
  | 'defence'
  | 'economy'
  | 'support'
  | 'area';

interface DraftSynergy {
  readonly partner: string;
  readonly selfRequired: number;
  readonly partnerRequired: number;
  readonly evolutionId: string;
  readonly label: string;
}

const SYNERGIES: Readonly<Record<string, readonly DraftSynergy[]>> = Object.freeze({
  critical: [{ partner: 'critical_damage', selfRequired: 3, partnerRequired: 2, evolutionId: 'critical_protocol', label: 'Protokół krytyczny' }],
  critical_damage: [{ partner: 'critical', selfRequired: 2, partnerRequired: 3, evolutionId: 'critical_protocol', label: 'Protokół krytyczny' }],
  ability: [{ partner: 'rapid', selfRequired: 3, partnerRequired: 2, evolutionId: 'ultimate_charge_chain', label: 'Łańcuch mocy' }],
  rapid: [
    { partner: 'ability', selfRequired: 2, partnerRequired: 3, evolutionId: 'ultimate_charge_chain', label: 'Łańcuch mocy' },
    { partner: 'damage', selfRequired: 2, partnerRequired: 3, evolutionId: 'overdrive', label: 'Overdrive: linia ognia' },
  ],
  dash: [{ partner: 'boots', selfRequired: 3, partnerRequired: 2, evolutionId: 'ghost_protocol', label: 'Krok widma' }],
  boots: [{ partner: 'dash', selfRequired: 2, partnerRequired: 3, evolutionId: 'ghost_protocol', label: 'Krok widma' }],
  damage: [{ partner: 'rapid', selfRequired: 3, partnerRequired: 2, evolutionId: 'overdrive', label: 'Overdrive: linia ognia' }],
  drone: [{ partner: 'range', selfRequired: 2, partnerRequired: 2, evolutionId: 'piorun_mk2', label: 'Piorun MK II' }],
  range: [{ partner: 'drone', selfRequired: 2, partnerRequired: 2, evolutionId: 'piorun_mk2', label: 'Piorun MK II' }],
  growth: [{ partner: 'scavenger', selfRequired: 2, partnerRequired: 2, evolutionId: 'premium_logistics', label: 'Premium Logistics' }],
  scavenger: [{ partner: 'growth', selfRequired: 2, partnerRequired: 2, evolutionId: 'premium_logistics', label: 'Premium Logistics' }],
  regen: [{ partner: 'armor', selfRequired: 2, partnerRequired: 2, evolutionId: 'bhp_fortress', label: 'Fort BHP' }],
  armor: [{ partner: 'regen', selfRequired: 2, partnerRequired: 2, evolutionId: 'bhp_fortress', label: 'Fort BHP' }],
  ricochet: [
    { partner: 'radiation', selfRequired: 2, partnerRequired: 2, evolutionId: 'chain_reactor', label: 'Reaktor łańcuchowy' },
    { partner: 'shrapnel', selfRequired: 2, partnerRequired: 2, evolutionId: 'crystal_cascade', label: 'Kryształowa kaskada' },
  ],
  radiation: [{ partner: 'ricochet', selfRequired: 2, partnerRequired: 2, evolutionId: 'chain_reactor', label: 'Reaktor łańcuchowy' }],
  shrapnel: [{ partner: 'ricochet', selfRequired: 2, partnerRequired: 2, evolutionId: 'crystal_cascade', label: 'Kryształowa kaskada' }],
});

const PASSIVE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ability: 'Akumulator mocy',
  armor: 'Paleta ochronna',
  boots: 'Buty sprintu',
  critical: 'Precyzyjne trafienie',
  critical_damage: 'Moc krytyczna',
  dash: 'Trening uniku',
  damage: 'Wzmocniona amunicja',
  drone: 'Dron asystujący',
  growth: 'Premia za normę',
  magnet: 'Magnes XP',
  rapid: 'Rytm ataku',
  radiation: 'Pole radiacyjne B4',
  range: 'Zasięg audytu',
  regen: 'Przerwa regeneracyjna',
  ricochet: 'Rykoszet B4',
  scavenger: 'Łowca okazji',
  shrapnel: 'Amunicja odłamkowa',
});

const BASE_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  damage: 58,
  rapid: 60,
  critical: 54,
  critical_damage: 55,
  dash: 53,
  ability: 56,
  boots: 55,
  magnet: 52,
  reinforced: 55,
  medkit: 54,
  range: 54,
  growth: 58,
  scavenger: 52,
  regen: 55,
  drone: 56,
  armor: 54,
  ricochet: 58,
  radiation: 56,
  shrapnel: 56,
});

function isLegacyWeaponOffer(id: string): boolean {
  return id.startsWith('weapon_unlock:') || id.startsWith('weapon_upgrade:') || id.startsWith('weapon_evolve:');
}

function safeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

function getStacks(context: SurvivalDraftContext): Readonly<Record<string, number>> {
  return context.stacks || {};
}

function getEvolutions(context: SurvivalDraftContext): ReadonlySet<string> {
  return new Set(context.evolutions || []);
}

function getCategory(id: string): DraftCategory {
  if (id.startsWith('boss_')) return 'support';
  if (id === 'damage') return 'damage';
  if (id === 'rapid') return 'tempo';
  if (id === 'critical' || id === 'critical_damage') return 'precision';
  if (id === 'dash' || id === 'boots') return 'mobility';
  if (id === 'ability') return 'ability';
  if (id === 'reinforced' || id === 'medkit' || id === 'regen' || id === 'armor') return 'defence';
  if (id === 'magnet' || id === 'growth' || id === 'scavenger') return 'economy';
  if (id === 'drone' || id === 'range') return 'support';
  if (id === 'ricochet' || id === 'radiation' || id === 'shrapnel') return 'area';
  return 'support';
}

interface SynergyProgress {
  readonly beforeSelf: number;
  readonly beforePartner: number;
  readonly afterSelf: number;
  readonly afterPartner: number;
  readonly wasComplete: boolean;
  readonly willComplete: boolean;
  readonly bonus: number;
}

function getSynergyProgress(
  id: string,
  synergy: DraftSynergy,
  context: SurvivalDraftContext,
  plannedIds: ReadonlySet<string>,
): SynergyProgress {
  const stacks = getStacks(context);
  const plannedSelf = [...plannedIds].filter((planned) => planned === id).length;
  const plannedPartner = [...plannedIds].filter((planned) => planned === synergy.partner).length;
  const ownedSelf = safeCount(stacks[id]);
  const ownedPartner = safeCount(stacks[synergy.partner]);
  const beforeSelf = Math.min(synergy.selfRequired, ownedSelf + plannedSelf);
  const beforePartner = Math.min(synergy.partnerRequired, ownedPartner + plannedPartner);
  const afterSelf = Math.min(synergy.selfRequired, beforeSelf + 1);
  const afterPartner = beforePartner;
  const wasComplete = beforeSelf >= synergy.selfRequired && beforePartner >= synergy.partnerRequired;
  const willComplete = afterSelf >= synergy.selfRequired && afterPartner >= synergy.partnerRequired;
  const beforeProgress = beforeSelf / synergy.selfRequired + beforePartner / synergy.partnerRequired;
  const afterProgress = afterSelf / synergy.selfRequired + afterPartner / synergy.partnerRequired;
  const delta = Math.max(0, afterProgress - beforeProgress);
  const bonus = delta * 30 + (!wasComplete && willComplete ? 24 : 0);
  return { beforeSelf, beforePartner, afterSelf, afterPartner, wasComplete, willComplete, bonus };
}

function getPairBonus(
  id: string,
  context: SurvivalDraftContext,
  plannedIds: ReadonlySet<string>,
): number {
  const synergies = SYNERGIES[id] || [];
  if (synergies.length === 0) return 0;
  const stacks = getStacks(context);
  const evolutions = getEvolutions(context);
  let bestBonus = 0;
  for (const synergy of synergies) {
    if (evolutions.has(synergy.evolutionId)) continue;
    const partnerCount = safeCount(stacks[synergy.partner]) +
      [...plannedIds].filter((planned) => planned === synergy.partner).length;
    // Do not reward a passive as a "synergy pick" until its other half is
    // actually owned or selected in this draft.
    if (partnerCount <= 0) continue;
    const progress = getSynergyProgress(id, synergy, context, plannedIds);
    bestBonus = Math.max(bestBonus, progress.bonus);
  }
  return bestBonus;
}

/** A transparent relevance score used to rank choices, not to change their effect. */
export function scoreSurvivalDraftOption(
  id: string,
  context: SurvivalDraftContext = {},
  plannedIds: readonly string[] = [],
): number {
  const stacks = getStacks(context);
  const planned = new Set(plannedIds);
  if (isLegacyWeaponOffer(id)) return Number.NEGATIVE_INFINITY;

  let score = BASE_WEIGHTS[id] ?? 50;
  const stackCount = safeCount(stacks[id]);
  score += Math.min(4, stackCount) * 1.5;
  score += getPairBonus(id, context, planned);

  const healthRatio = Number.isFinite(context.healthRatio)
    ? Math.max(0, Math.min(1, context.healthRatio as number))
    : 1;
  if (healthRatio <= 0.45) {
    if (id === 'medkit') score += 28;
    if (id === 'reinforced') score += 20;
    if (id === 'armor') score += 13;
    if (id === 'regen') score += 10;
  } else if (healthRatio >= 0.9 && id === 'medkit') {
    score -= 7;
  }

  const elapsed = Number.isFinite(context.elapsedSeconds)
    ? Math.max(0, context.elapsedSeconds as number)
    : 0;
  if (id === 'growth' && elapsed < 240) score += 8;
  if (id === 'magnet' && elapsed < 90) score += 4;

  return score;
}

function boundedRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
}

/**
 * Pick one high-value weapon offer (when available) and two distinct tactical
 * options. Existing build synergies and missing combat roles influence ranking;
 * category diversity prevents three near-identical cards appearing together.
 */
export function selectSurvivalDraftOptions<T extends SurvivalDraftOption>(
  options: readonly T[],
  context: SurvivalDraftContext = {},
  random: () => number = Math.random,
): T[] {
  if (options.length === 0) return [];
  const unique = new Map<string, T>();
  for (const option of options) {
    if (option && typeof option.id === 'string' && option.id.length > 0 && !unique.has(option.id)) {
      unique.set(option.id, option);
    }
  }
  const remaining = [...unique.values()].filter((option) => !isLegacyWeaponOffer(option.id));
  if (remaining.length === 0) return [];

  const tieBreak = new Map(remaining.map((option) => [option.id, boundedRandom(random)]));
  const selected: T[] = [];

  const selectedIds = new Set(selected.map((option) => option.id));
  const chosenCategories = new Map<DraftCategory, number>();
  for (const option of selected) {
    const category = getCategory(option.id);
    chosenCategories.set(category, (chosenCategories.get(category) || 0) + 1);
  }

  while (selected.length < Math.min(3, remaining.length)) {
    let best: T | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const plannedIds = selected.map((option) => option.id);

    for (const option of remaining) {
      if (selectedIds.has(option.id)) continue;
      const category = getCategory(option.id);
      const repeatedCategoryCount = chosenCategories.get(category) || 0;
      const diversityPenalty = repeatedCategoryCount * 15;
      const pairBonus = getPairBonus(option.id, context, new Set(plannedIds));
      const score = scoreSurvivalDraftOption(option.id, context, plannedIds) - diversityPenalty + (pairBonus > 0 && repeatedCategoryCount === 0 ? 4 : 0);
      const candidateScore = score + (tieBreak.get(option.id) || 0);
      if (candidateScore > bestScore) {
        best = option;
        bestScore = candidateScore;
      }
    }

    if (!best) break;
    selected.push(best);
    selectedIds.add(best.id);
    const category = getCategory(best.id);
    chosenCategories.set(category, (chosenCategories.get(category) || 0) + 1);
  }

  return selected;
}

/** Add a small, honest card hint when a real synergy is active or completed by this draft. */
export function getSurvivalDraftSynergyHint(
  id: string,
  context: SurvivalDraftContext = {},
  plannedIds: readonly string[] = [],
): string | null {
  if (isLegacyWeaponOffer(id)) return null;

  const planned = new Set(plannedIds);
  const synergies = SYNERGIES[id] || [];
  const candidates = synergies
    .filter((synergy) => !getEvolutions(context).has(synergy.evolutionId))
    .map((synergy) => ({
      synergy,
      progress: getSynergyProgress(id, synergy, context, planned),
    }))
    .filter(({ synergy, progress }) =>
      !progress.wasComplete &&
      progress.bonus > 0 &&
      (
        safeCount(getStacks(context)[synergy.partner]) > 0 ||
        planned.has(synergy.partner) ||
        progress.willComplete
      )
    )
    .sort((a, b) => b.progress.bonus - a.progress.bonus);

  const best = candidates[0];
  if (!best) return null;
  const { synergy, progress } = best;
  const selfLabel = PASSIVE_LABELS[id] || id;
  const partnerLabel = PASSIVE_LABELS[synergy.partner] || synergy.partner;
  const counts = selfLabel + ' ' + progress.afterSelf + '/' + synergy.selfRequired +
    ' • ' + partnerLabel + ' ' + progress.afterPartner + '/' + synergy.partnerRequired;

  if (progress.willComplete && !progress.wasComplete) {
    return 'DOMKNIESZ SYNERGIĘ: ' + synergy.label + ' — ' + counts + '.';
  }
  return 'POSTĘP SYNERGII: ' + synergy.label + ' — ' + counts + '.';
}
