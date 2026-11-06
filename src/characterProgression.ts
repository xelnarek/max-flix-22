import type { CharacterId } from './types.ts';

export type CharacterTalentEffect = 'attack' | 'defense' | 'speed' | 'jump' | 'cooldown';

export interface CharacterTalentDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  effect: CharacterTalentEffect;
  perRank: number;
  maxRank: 3;
}

export interface CharacterMasteryState {
  level: number;
  xp: number;
  talentRanks: Record<string, number>;
  totalRuns: number;
  totalKills: number;
  totalBosses: number;
}

export interface CharacterMasteryProfile {
  version: 1;
  characters: Record<CharacterId, CharacterMasteryState>;
}

export interface CharacterRunResult {
  kills: number;
  elapsedSeconds: number;
  bossesDefeated: number;
  secretsFound: number;
}

export interface CharacterCombatBonuses {
  attackMultiplier: number;
  damageTakenMultiplier: number;
  speedMultiplier: number;
  jumpMultiplier: number;
  abilityCooldownMultiplier: number;
}

export interface CharacterMasterySummary {
  level: number;
  xp: number;
  xpToNext: number;
  progressPercent: number;
  availableTalentPoints: number;
  spentTalentPoints: number;
  totalRuns: number;
  totalKills: number;
  totalBosses: number;
  isMaxLevel: boolean;
}

export const CHARACTER_TALENTS: Readonly<Record<CharacterId, readonly CharacterTalentDefinition[]>> = Object.freeze({
  marcin: Object.freeze<CharacterTalentDefinition[]>([
    { id: 'audit_protocol', name: 'Protokół audytu', icon: '📑', description: 'Każde zatwierdzone uderzenie jest precyzyjniejsze.', effect: 'attack', perRank: 0.02, maxRank: 3 },
    { id: 'wz_armour', name: 'Pancerz WZ-404', icon: '🛡️', description: 'Dodatkowa redukcja otrzymywanych obrażeń.', effect: 'defense', perRank: 0.02, maxRank: 3 },
    { id: 'dispatch_network', name: 'Sieć dyspozytorska', icon: '📡', description: 'Szybsze ponowne wezwanie konwoju WZ-404.', effect: 'cooldown', perRank: 0.025, maxRank: 3 },
  ]),
  grzesiek: Object.freeze<CharacterTalentDefinition[]>([
    { id: 'hydraulic_impact', name: 'Uderzenie hydrauliczne', icon: '🔩', description: 'Wzmacnia ciężki rzut hantlem i podstawowe trafienia.', effect: 'attack', perRank: 0.025, maxRank: 3 },
    { id: 'reinforced_grip', name: 'Wzmocniony chwyt', icon: '💪', description: 'Lepsza kontrola impetu zmniejsza otrzymywane obrażenia.', effect: 'defense', perRank: 0.015, maxRank: 3 },
    { id: 'heavy_footwork', name: 'Praca nóg siłacza', icon: '🥾', description: 'Krótsza strata tempa po zmianie kierunku.', effect: 'speed', perRank: 0.015, maxRank: 3 },
  ]),
  dawid: Object.freeze<CharacterTalentDefinition[]>([
    { id: 'stretch_tension', name: 'Napięcie stretchu', icon: '🧵', description: 'Wzmacnia ofensywę rolki i kontrolę trafionego celu.', effect: 'attack', perRank: 0.02, maxRank: 3 },
    { id: 'aerial_installation', name: 'Montaż powietrzny', icon: '🪂', description: 'Większa siła wybicia i pewniejszy drugi etap skoku.', effect: 'jump', perRank: 0.02, maxRank: 3 },
    { id: 'agile_layout', name: 'Zwinny układ alejki', icon: '🌀', description: 'Szybsze przenoszenie ciężaru przy unikach i nawrotach.', effect: 'speed', perRank: 0.015, maxRank: 3 },
  ]),
  mateusz: Object.freeze<CharacterTalentDefinition[]>([
    { id: 'overclock_drive', name: 'Overclock napędu', icon: '⚡', description: 'Jeszcze szybsze przyspieszenie i przemieszczanie operatora.', effect: 'speed', perRank: 0.02, maxRank: 3 },
    { id: 'capacitor_cycle', name: 'Cykl kondensatora', icon: '🔋', description: 'Skraca czas ładowania Kociej Armii.', effect: 'cooldown', perRank: 0.025, maxRank: 3 },
    { id: 'shock_calibration', name: 'Kalibracja paralizatora', icon: '🎯', description: 'Zwiększa siłę impulsów elektrycznych.', effect: 'attack', perRank: 0.02, maxRank: 3 },
  ]),
  piotr: Object.freeze<CharacterTalentDefinition[]>([
    { id: 'veteran_grip', name: 'Chwyt weterana B4', icon: '🔧', description: 'Mocniejszy rzut kluczem i skuteczniejszy powrót przez tłum.', effect: 'attack', perRank: 0.02, maxRank: 3 },
    { id: 'veteran_stance', name: 'Postawa weterana', icon: '🪵', description: 'Doświadczenie z hali poprawia odporność operatora.', effect: 'defense', perRank: 0.02, maxRank: 3 },
    { id: 'mafia_protocol', name: 'Protokół MafiKapibar', icon: '🐾', description: 'Rodzina szybciej odpowiada na wezwanie.', effect: 'cooldown', perRank: 0.025, maxRank: 3 },
  ]),
});

export const CHARACTER_MASTERY_MAX_LEVEL = 15;
// Three talents per operator, each capped at rank three: no points can be wasted.
export const CHARACTER_MASTERY_TALENT_POINT_CAP = 9;

export const NEUTRAL_CHARACTER_COMBAT_BONUSES: Readonly<CharacterCombatBonuses> = Object.freeze({
  attackMultiplier: 1,
  damageTakenMultiplier: 1,
  speedMultiplier: 1,
  jumpMultiplier: 1,
  abilityCooldownMultiplier: 1,
});

const CHARACTER_IDS: readonly CharacterId[] = ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr'];

const safeInt = (value: unknown, min = 0, max = 1_000_000): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : min;

const createEmptyCharacter = (): CharacterMasteryState => ({
  level: 1,
  xp: 0,
  talentRanks: {},
  totalRuns: 0,
  totalKills: 0,
  totalBosses: 0,
});

export function createInitialCharacterMasteryProfile(): CharacterMasteryProfile {
  return {
    version: 1,
    characters: {
      marcin: createEmptyCharacter(),
      grzesiek: createEmptyCharacter(),
      dawid: createEmptyCharacter(),
      mateusz: createEmptyCharacter(),
      piotr: createEmptyCharacter(),
    },
  };
}

export function getCharacterMasteryXpRequirement(level: number): number {
  const safeLevel = safeInt(level, 1, CHARACTER_MASTERY_MAX_LEVEL);
  if (safeLevel >= CHARACTER_MASTERY_MAX_LEVEL) return 0;
  return 70 + (safeLevel - 1) * 28;
}

function sanitizeCharacterState(id: CharacterId, value: unknown): CharacterMasteryState {
  if (!value || typeof value !== 'object') return createEmptyCharacter();
  const raw = value as Partial<CharacterMasteryState> & { talentRanks?: unknown };
  const allowed = new Set(CHARACTER_TALENTS[id].map((talent) => talent.id));
  const talentRanks: Record<string, number> = {};
  if (raw.talentRanks && typeof raw.talentRanks === 'object') {
    for (const talent of CHARACTER_TALENTS[id]) {
      const rank = safeInt((raw.talentRanks as Record<string, unknown>)[talent.id], 0, talent.maxRank);
      if (rank > 0) talentRanks[talent.id] = rank;
    }
  }
  // Drop unrecognised keys rather than allowing an old/corrupt save to grant bonuses.
  for (const key of Object.keys(talentRanks)) {
    if (!allowed.has(key)) delete talentRanks[key];
  }
  const level = safeInt(raw.level, 1, CHARACTER_MASTERY_MAX_LEVEL);
  const xpToNext = getCharacterMasteryXpRequirement(level);
  const xp = level >= CHARACTER_MASTERY_MAX_LEVEL ? 0 : safeInt(raw.xp, 0, xpToNext - 1);
  const spent = Object.values(talentRanks).reduce((sum, rank) => sum + rank, 0);
  const availableBudget = Math.min(CHARACTER_MASTERY_TALENT_POINT_CAP, Math.max(0, level - 1));
  if (spent > availableBudget) {
    let remaining = availableBudget;
    for (const talent of CHARACTER_TALENTS[id]) {
      const kept = Math.min(talentRanks[talent.id] || 0, remaining);
      if (kept > 0) talentRanks[talent.id] = kept;
      else delete talentRanks[talent.id];
      remaining -= kept;
    }
  }
  return {
    level,
    xp,
    talentRanks,
    totalRuns: safeInt(raw.totalRuns),
    totalKills: safeInt(raw.totalKills),
    totalBosses: safeInt(raw.totalBosses),
  };
}

export function sanitizeCharacterMasteryProfile(value: unknown): CharacterMasteryProfile {
  const initial = createInitialCharacterMasteryProfile();
  if (!value || typeof value !== 'object') return initial;
  const raw = value as { characters?: unknown };
  const characters = raw.characters && typeof raw.characters === 'object'
    ? raw.characters as Record<string, unknown>
    : {};
  return {
    version: 1,
    characters: {
      marcin: sanitizeCharacterState('marcin', characters.marcin),
      grzesiek: sanitizeCharacterState('grzesiek', characters.grzesiek),
      dawid: sanitizeCharacterState('dawid', characters.dawid),
      mateusz: sanitizeCharacterState('mateusz', characters.mateusz),
      piotr: sanitizeCharacterState('piotr', characters.piotr),
    },
  };
}

export function calculateCharacterMasteryXp(result: CharacterRunResult): number {
  const kills = safeInt(result.kills);
  const seconds = safeInt(result.elapsedSeconds);
  const bosses = safeInt(result.bossesDefeated);
  const secrets = safeInt(result.secretsFound);
  return kills + Math.floor(seconds / 30) + bosses * 15 + secrets * 10;
}

export function recordCharacterRunResult(
  current: CharacterMasteryProfile,
  characterId: CharacterId,
  result: CharacterRunResult,
): { profile: CharacterMasteryProfile; xpEarned: number; levelsGained: number } {
  const profile = sanitizeCharacterMasteryProfile(current);
  const previous = profile.characters[characterId];
  const xpEarned = calculateCharacterMasteryXp(result);
  let level = previous.level;
  let xp = previous.xp + xpEarned;
  let levelsGained = 0;

  while (level < CHARACTER_MASTERY_MAX_LEVEL) {
    const requirement = getCharacterMasteryXpRequirement(level);
    if (xp < requirement) break;
    xp -= requirement;
    level++;
    levelsGained++;
  }

  if (level >= CHARACTER_MASTERY_MAX_LEVEL) xp = 0;
  profile.characters[characterId] = {
    ...previous,
    level,
    xp,
    totalRuns: previous.totalRuns + 1,
    totalKills: previous.totalKills + safeInt(result.kills),
    totalBosses: previous.totalBosses + safeInt(result.bossesDefeated),
  };
  return { profile, xpEarned, levelsGained };
}

export function getCharacterMasterySummary(
  value: unknown,
  characterId: CharacterId,
): CharacterMasterySummary {
  const state = sanitizeCharacterMasteryProfile(value).characters[characterId];
  const spentTalentPoints = Object.values(state.talentRanks).reduce((sum, rank) => sum + rank, 0);
  const xpToNext = getCharacterMasteryXpRequirement(state.level);
  return {
    level: state.level,
    xp: state.xp,
    xpToNext,
    progressPercent: xpToNext > 0 ? Math.min(100, state.xp / xpToNext * 100) : 100,
    availableTalentPoints: Math.max(0, Math.min(CHARACTER_MASTERY_TALENT_POINT_CAP, state.level - 1) - spentTalentPoints),
    spentTalentPoints,
    totalRuns: state.totalRuns,
    totalKills: state.totalKills,
    totalBosses: state.totalBosses,
    isMaxLevel: state.level >= CHARACTER_MASTERY_MAX_LEVEL,
  };
}

export function spendCharacterTalentPoint(
  current: CharacterMasteryProfile,
  characterId: CharacterId,
  talentId: string,
): { profile: CharacterMasteryProfile; purchased: boolean } {
  const profile = sanitizeCharacterMasteryProfile(current);
  const state = profile.characters[characterId];
  const talent = CHARACTER_TALENTS[characterId].find((entry) => entry.id === talentId);
  if (!talent) return { profile, purchased: false };

  const summary = getCharacterMasterySummary(profile, characterId);
  const currentRank = state.talentRanks[talentId] || 0;
  if (summary.availableTalentPoints <= 0 || currentRank >= talent.maxRank) {
    return { profile, purchased: false };
  }

  profile.characters[characterId] = {
    ...state,
    talentRanks: { ...state.talentRanks, [talentId]: currentRank + 1 },
  };
  return { profile, purchased: true };
}

export function getCharacterTalentBonuses(
  value: unknown,
  characterId: CharacterId,
): CharacterCombatBonuses {
  const state = sanitizeCharacterMasteryProfile(value).characters[characterId];
  const totals: Record<CharacterTalentEffect, number> = {
    attack: 0,
    defense: 0,
    speed: 0,
    jump: 0,
    cooldown: 0,
  };
  for (const talent of CHARACTER_TALENTS[characterId]) {
    totals[talent.effect] += (state.talentRanks[talent.id] || 0) * talent.perRank;
  }
  return {
    attackMultiplier: 1 + totals.attack,
    damageTakenMultiplier: Math.max(0.90, 1 - totals.defense),
    speedMultiplier: Math.min(1.08, 1 + totals.speed),
    jumpMultiplier: Math.min(1.08, 1 + totals.jump),
    abilityCooldownMultiplier: Math.max(0.90, 1 - totals.cooldown),
  };
}
