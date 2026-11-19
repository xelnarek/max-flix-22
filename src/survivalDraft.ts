export interface SurvivalDraftWeaponState {
  readonly id: string;
  readonly level: number;
  readonly evolved?: boolean;
}

export interface SurvivalDraftContext {
  readonly stacks?: Readonly<Record<string, number>>;
  readonly weapons?: readonly SurvivalDraftWeaponState[];
  readonly evolutions?: readonly string[];
  readonly healthRatio?: number;
  readonly elapsedSeconds?: number;
}

export interface SurvivalDraftOption {
  readonly id: string;
}

type DraftCategory =
  | 'weapon'
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
  readonly evolutionId: string;
  readonly label: string;
}

const WEAPON_EVOLUTION_PASSIVES: Readonly<Record<string, string>> = Object.freeze({
  pallet_cannon: 'damage',
  diamond_saw: 'range',
  glue_mine: 'magnet',
  kfc_bomber: 'scavenger',
  piorun_drone: 'drone',
  forklift_bolter: 'rapid',
  scanner_pulse: 'range',
  orbit_blades: 'armor',
  calacatta_shards: 'damage',
  steam_bomb: 'regen',
  forklift_horn: 'armor',
  wz_boomerang: 'growth',
});

const WEAPON_ROLES: Readonly<Record<string, string>> = Object.freeze({
  pallet_cannon: 'burst',
  diamond_saw: 'pierce',
  glue_mine: 'control',
  kfc_bomber: 'area',
  piorun_drone: 'homing',
  forklift_bolter: 'line',
  scanner_pulse: 'homing',
  orbit_blades: 'orbit',
  calacatta_shards: 'fan',
  steam_bomb: 'control',
  forklift_horn: 'control',
  wz_boomerang: 'return',
});

const SYNERGIES: Readonly<Record<string, readonly DraftSynergy[]>> = Object.freeze({
  critical: [{ partner: 'critical_damage', evolutionId: 'critical_protocol', label: 'Protokół krytyczny' }],
  critical_damage: [{ partner: 'critical', evolutionId: 'critical_protocol', label: 'Protokół krytyczny' }],
  ability: [{ partner: 'rapid', evolutionId: 'ultimate_charge_chain', label: 'Łańcuch mocy' }],
  rapid: [
    { partner: 'ability', evolutionId: 'ultimate_charge_chain', label: 'Łańcuch mocy' },
    { partner: 'damage', evolutionId: 'overdrive', label: 'Overdrive: linia ognia' },
  ],
  dash: [{ partner: 'boots', evolutionId: 'ghost_protocol', label: 'Krok widma' }],
  boots: [{ partner: 'dash', evolutionId: 'ghost_protocol', label: 'Krok widma' }],
  damage: [{ partner: 'rapid', evolutionId: 'overdrive', label: 'Overdrive: linia ognia' }],
  drone: [{ partner: 'range', evolutionId: 'piorun_mk2', label: 'Piorun MK II' }],
  range: [{ partner: 'drone', evolutionId: 'piorun_mk2', label: 'Piorun MK II' }],
  growth: [{ partner: 'scavenger', evolutionId: 'premium_logistics', label: 'Premium Logistics' }],
  scavenger: [{ partner: 'growth', evolutionId: 'premium_logistics', label: 'Premium Logistics' }],
  regen: [{ partner: 'armor', evolutionId: 'bhp_fortress', label: 'Fort BHP' }],
  armor: [{ partner: 'regen', evolutionId: 'bhp_fortress', label: 'Fort BHP' }],
  ricochet: [
    { partner: 'radiation', evolutionId: 'chain_reactor', label: 'Reaktor łańcuchowy' },
    { partner: 'shrapnel', evolutionId: 'crystal_cascade', label: 'Kryształowa kaskada' },
  ],
  radiation: [{ partner: 'ricochet', evolutionId: 'chain_reactor', label: 'Reaktor łańcuchowy' }],
  shrapnel: [{ partner: 'ricochet', evolutionId: 'crystal_cascade', label: 'Kryształowa kaskada' }],
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

function safeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

function getStacks(context: SurvivalDraftContext): Readonly<Record<string, number>> {
  return context.stacks || {};
}

function getEvolutions(context: SurvivalDraftContext): ReadonlySet<string> {
  return new Set(context.evolutions || []);
}

function parseWeaponOffer(id: string): { kind: 'unlock' | 'upgrade' | 'evolve'; weaponId: string } | null {
  for (const kind of ['unlock', 'upgrade', 'evolve'] as const) {
    const prefix = 'weapon_' + kind + ':';
    if (id.startsWith(prefix)) return { kind, weaponId: id.slice(prefix.length) };
  }
  return null;
}

function getCategory(id: string): DraftCategory {
  const weapon = parseWeaponOffer(id);
  if (weapon || id.startsWith('boss_')) return 'weapon';
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

function getPairBonus(
  id: string,
  context: SurvivalDraftContext,
  plannedIds: ReadonlySet<string>,
): number {
  const synergies = SYNERGIES[id] || [];
  const stacks = getStacks(context);
  let bestBonus = 0;
  for (const synergy of synergies) {
    if (getEvolutions(context).has(synergy.evolutionId)) continue;
    const partnerOwned = safeCount(stacks[synergy.partner]);
    const partnerPlanned = plannedIds.has(synergy.partner);
    if (partnerOwned > 0 || partnerPlanned) {
      bestBonus = Math.max(bestBonus, 25 + Math.min(2, partnerOwned) * 5 + (partnerPlanned ? 8 : 0));
    }
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
  const weapon = parseWeaponOffer(id);

  if (weapon) {
    const ownedWeapon = context.weapons?.find((entry) => entry.id === weapon.weaponId);
    if (weapon.kind === 'evolve') return 420;
    if (weapon.kind === 'upgrade') {
      const level = Math.max(1, Math.min(5, safeCount(ownedWeapon?.level) || 1));
      return 150 + level * 4 + (level >= 4 ? 12 : 0);
    }
    const passive = WEAPON_EVOLUTION_PASSIVES[weapon.weaponId];
    const passiveStacks = passive ? safeCount(stacks[passive]) : 0;
    const role = WEAPON_ROLES[weapon.weaponId];
    const ownedRoles = new Set((context.weapons || []).map((entry) => WEAPON_ROLES[entry.id]).filter(Boolean));
    const roleBonus = role && !ownedRoles.has(role) ? 14 : -10;
    return 300 + passiveStacks * 18 + (passiveStacks >= 2 ? 8 : 0) + roleBonus;
  }

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
  const remaining = [...unique.values()];
  if (remaining.length === 0) return [];

  const tieBreak = new Map(remaining.map((option) => [option.id, boundedRandom(random)]));
  const weaponOffers = remaining.filter((option) => parseWeaponOffer(option.id) !== null);
  const selected: T[] = [];

  if (weaponOffers.length > 0) {
    weaponOffers.sort((a, b) =>
      scoreSurvivalDraftOption(b.id, context) - scoreSurvivalDraftOption(a.id, context) ||
      (tieBreak.get(b.id) || 0) - (tieBreak.get(a.id) || 0),
    );
    selected.push(weaponOffers[0]);
  }

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
      if (selectedIds.has(option.id) || parseWeaponOffer(option.id)) continue;
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
  const weapon = parseWeaponOffer(id);
  if (weapon) {
    const passive = WEAPON_EVOLUTION_PASSIVES[weapon.weaponId];
    const passiveStacks = passive ? safeCount(getStacks(context)[passive]) : 0;
    const passivePlanned = passive ? plannedIds.includes(passive) : false;
    if (weapon.kind !== 'evolve' && passive && (passiveStacks > 0 || passivePlanned)) {
      const labels: Readonly<Record<string, string>> = {
        damage: 'Wzmocniona amunicja',
        range: 'Zasięg audytu',
        magnet: 'Magnes XP',
        scavenger: 'Łowca okazji',
        drone: 'Dron asystujący',
        rapid: 'Rytm ataku',
        armor: 'Paleta ochronna',
        regen: 'Przerwa regeneracyjna',
        growth: 'Premia za normę',
      };
      const source = passivePlanned ? 'wybierasz teraz moduł „' : 'masz już moduł „';
      return 'SYNERGIA BRONI: ' + source + (labels[passive] || passive) + '”, potrzebny do jej ewolucji.';
    }
    if (weapon.kind === 'evolve') return 'EWOLUCJA GOTOWA: wymagane połączenie broni i modułu jest już kompletne.';
  }

  const synergies = SYNERGIES[id] || [];
  for (const synergy of synergies) {
    const partnerOwned = safeCount(getStacks(context)[synergy.partner]) > 0;
    const partnerPlanned = plannedIds.includes(synergy.partner);
    if (!partnerOwned && !partnerPlanned) continue;
    if (getEvolutions(context).has(synergy.evolutionId)) {
      return 'EWOLUCJA ODBLOKOWANA: ' + synergy.label + '.';
    }
    return 'ZGRANIE ZESTAWU: zbliża do ewolucji „' + synergy.label + '”.';
  }
  return null;
}
