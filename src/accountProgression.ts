export type AccountTalentBranch = 'assault' | 'defense' | 'mobility' | 'tactics';
export type AccountTalentEffect =
  | 'damage'
  | 'damageTaken'
  | 'speed'
  | 'jump'
  | 'cooldown'
  | 'xp';

export interface AccountTalentDefinition {
  id: string;
  branch: AccountTalentBranch;
  tier: 1 | 2 | 3;
  name: string;
  icon: string;
  description: string;
  effect: AccountTalentEffect;
  perRank: number;
  maxRank: 3;
  prerequisiteId?: string;
}

export interface AccountProgressionStats {
  survivalRuns: number;
  pvpMatches: number;
  pvpWins: number;
  survivalKills: number;
  pvpDamage: number;
  bossesDefeated: number;
}

export interface AccountProgressionProfile {
  version: 1;
  level: number;
  xp: number;
  talentRanks: Record<string, number>;
  stats: AccountProgressionStats;
}

export interface AccountProgressionBonuses {
  damageMultiplier: number;
  damageTakenMultiplier: number;
  speedMultiplier: number;
  jumpMultiplier: number;
  abilityCooldownMultiplier: number;
  xpMultiplier: number;
}

export interface AccountProgressionSummary {
  level: number;
  xp: number;
  xpToNext: number;
  progressPercent: number;
  availableSkillPoints: number;
  spentSkillPoints: number;
  rankName: string;
  nextRankName: string;
  nextRankLevel: number;
  isMaxLevel: boolean;
  stats: AccountProgressionStats;
}

export interface AccountSurvivalResult {
  kills: number;
  elapsedSeconds: number;
  bossesDefeated: number;
  secretsFound: number;
  highestWave: number;
}

export interface AccountPvpResult {
  damageDealt: number;
  shotsHit: number;
  knockouts: number;
  roundsWon: number;
  wonMatch: boolean;
}

export interface AccountProgressionUpdate {
  profile: AccountProgressionProfile;
  xpEarned: number;
  levelsGained: number;
  rankUps: string[];
}

export const ACCOUNT_PROGRESS_MAX_LEVEL = 37;
export const ACCOUNT_PROGRESS_MAX_SKILL_POINTS = ACCOUNT_PROGRESS_MAX_LEVEL - 1;
export const ACCOUNT_PROGRESS_STORAGE_KEY = 'paleciaki.account.progression.v1';

export const ACCOUNT_TALENT_BRANCHES: Readonly<Record<AccountTalentBranch, {
  name: string;
  icon: string;
  description: string;
}>> = Object.freeze({
  assault: {
    name: 'ARSENAŁ',
    icon: '⚔️',
    description: 'Wzmacnia podstawowe ataki, zdolności i tempo ofensywy',
  },
  defense: {
    name: 'PANCERZ',
    icon: '🛡️',
    description: 'Zmniejsza obrażenia i poprawia odporność operatora',
  },
  mobility: {
    name: 'MOBILNOŚĆ',
    icon: '🏃',
    description: 'Przyspiesza przemieszczanie, skoki i taktyczne uniki',
  },
  tactics: {
    name: 'TAKTYKA',
    icon: '📡',
    description: 'Zwiększa tempo rozwoju i skuteczność planowania walki',
  },
});

export const ACCOUNT_TALENTS: readonly AccountTalentDefinition[] = Object.freeze([
  { id: 'weapon_training', branch: 'assault', tier: 1, name: 'Szkolenie bojowe', icon: '🎯', description: 'Zwiększa obrażenia zadawane przeciwnikom.', effect: 'damage', perRank: 0.012, maxRank: 3 },
  { id: 'ability_calibration', branch: 'assault', tier: 2, name: 'Kalibracja zdolności', icon: '⚡', description: 'Wzmacnia obrażenia umiejętności operatora.', effect: 'damage', perRank: 0.012, maxRank: 3, prerequisiteId: 'weapon_training' },
  { id: 'rapid_protocol', branch: 'assault', tier: 3, name: 'Protokół szybkiego ognia', icon: '🔋', description: 'Skraca czas odnowienia ataków i umiejętności.', effect: 'cooldown', perRank: 0.01, maxRank: 3, prerequisiteId: 'ability_calibration' },

  { id: 'reinforced_vest', branch: 'defense', tier: 1, name: 'Kamizelka wzmacniana', icon: '🦺', description: 'Ogranicza obrażenia otrzymywane od wrogów.', effect: 'damageTaken', perRank: 0.012, maxRank: 3 },
  { id: 'impact_bracing', branch: 'defense', tier: 2, name: 'Amortyzacja uderzeń', icon: '🧱', description: 'Dodatkowa redukcja obrażeń po kontakcie z przeciwnikiem.', effect: 'damageTaken', perRank: 0.01, maxRank: 3, prerequisiteId: 'reinforced_vest' },
  { id: 'last_reserve', branch: 'defense', tier: 3, name: 'Rezerwa awaryjna', icon: '❤️', description: 'Dalsza poprawa przeżywalności w długich starciach.', effect: 'damageTaken', perRank: 0.008, maxRank: 3, prerequisiteId: 'impact_bracing' },

  { id: 'light_footwork', branch: 'mobility', tier: 1, name: 'Lekki krok', icon: '👟', description: 'Zwiększa szybkość przemieszczania operatora.', effect: 'speed', perRank: 0.012, maxRank: 3 },
  { id: 'dynamic_stride', branch: 'mobility', tier: 2, name: 'Dynamiczny krok', icon: '💨', description: 'Pozwala szybciej zmieniać pozycję na arenie.', effect: 'speed', perRank: 0.01, maxRank: 3, prerequisiteId: 'light_footwork' },
  { id: 'jump_technique', branch: 'mobility', tier: 3, name: 'Technika wybicia', icon: '🪂', description: 'Zwiększa siłę skoku w Survival.', effect: 'jump', perRank: 0.012, maxRank: 3, prerequisiteId: 'dynamic_stride' },

  { id: 'combat_analysis', branch: 'tactics', tier: 1, name: 'Analiza walki', icon: '📊', description: 'Zapewnia więcej doświadczenia za ukończone rozgrywki.', effect: 'xp', perRank: 0.02, maxRank: 3 },
  { id: 'cooldown_planning', branch: 'tactics', tier: 2, name: 'Planowanie cyklu', icon: '🧭', description: 'Skraca czas odnowienia zdolności i ataków.', effect: 'cooldown', perRank: 0.01, maxRank: 3, prerequisiteId: 'combat_analysis' },
  { id: 'field_intelligence', branch: 'tactics', tier: 3, name: 'Wywiad polowy', icon: '🛰️', description: 'Dodatkowe doświadczenie za aktywną grę w obu trybach.', effect: 'xp', perRank: 0.02, maxRank: 3, prerequisiteId: 'cooldown_planning' },
]);

export const ACCOUNT_RANKS = [
  { level: 1, name: 'REKRUT', subtitle: 'Pierwsze kroki na zmianie', icon: '🔰', reward: 'Odblokowuje wspólne drzewko rozwoju' },
  { level: 5, name: 'OPERATOR', subtitle: 'Samodzielna praca na hali', icon: '🎖️', reward: '+1% doświadczenia z obu trybów' },
  { level: 10, name: 'SPECJALISTA', subtitle: 'Sprawdzona skuteczność', icon: '🎯', reward: '+1% zadawanych obrażeń' },
  { level: 15, name: 'BRYGADZISTA', subtitle: 'Kontrola nad polem walki', icon: '🛡️', reward: '−1% otrzymywanych obrażeń' },
  { level: 20, name: 'KIEROWNIK', subtitle: 'Dowodzenie zmianą', icon: '⭐', reward: '+1% szybkości poruszania' },
  { level: 25, name: 'WETERAN', subtitle: 'Doświadczenie z każdej areny', icon: '🏅', reward: '−1% czasu odnowienia' },
  { level: 30, name: 'ELITA B4', subtitle: 'Najwyższa sprawność operacyjna', icon: '💠', reward: '+2% doświadczenia z obu trybów' },
  { level: 34, name: 'MISTRZ ZMIANY', subtitle: 'Wzór dla całej załogi', icon: '👑', reward: '+1% zadawanych obrażeń' },
  { level: 37, name: 'LEGENDA B4', subtitle: 'Status legendarnego operatora', icon: '🏆', reward: '+2% doświadczenia i odznaka Legenda B4' },
] as const;

export const NEUTRAL_ACCOUNT_BONUSES: Readonly<AccountProgressionBonuses> = Object.freeze({
  damageMultiplier: 1,
  damageTakenMultiplier: 1,
  speedMultiplier: 1,
  jumpMultiplier: 1,
  abilityCooldownMultiplier: 1,
  xpMultiplier: 1,
});

const safeInt = (value: unknown, min = 0, max = 1_000_000): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : min;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

function createInitialStats(): AccountProgressionStats {
  return { survivalRuns: 0, pvpMatches: 0, pvpWins: 0, survivalKills: 0, pvpDamage: 0, bossesDefeated: 0 };
}

export function createInitialAccountProgressionProfile(): AccountProgressionProfile {
  return { version: 1, level: 1, xp: 0, talentRanks: {}, stats: createInitialStats() };
}

export function getAccountXpRequirement(level: number): number {
  const safeLevel = safeInt(level, 1, ACCOUNT_PROGRESS_MAX_LEVEL);
  return safeLevel >= ACCOUNT_PROGRESS_MAX_LEVEL ? 0 : 75 + (safeLevel - 1) * 22;
}

function sanitizeAccountStats(value: unknown): AccountProgressionStats {
  if (!value || typeof value !== 'object') return createInitialStats();
  const raw = value as Partial<AccountProgressionStats>;
  return {
    survivalRuns: safeInt(raw.survivalRuns),
    pvpMatches: safeInt(raw.pvpMatches),
    pvpWins: safeInt(raw.pvpWins),
    survivalKills: safeInt(raw.survivalKills),
    pvpDamage: safeInt(raw.pvpDamage),
    bossesDefeated: safeInt(raw.bossesDefeated),
  };
}

export function sanitizeAccountProgressionProfile(value: unknown): AccountProgressionProfile {
  const initial = createInitialAccountProgressionProfile();
  if (!value || typeof value !== 'object') return initial;
  const raw = value as Partial<AccountProgressionProfile>;
  const level = safeInt(raw.level, 1, ACCOUNT_PROGRESS_MAX_LEVEL);
  const requirement = getAccountXpRequirement(level);
  const xp = level >= ACCOUNT_PROGRESS_MAX_LEVEL ? 0 : safeInt(raw.xp, 0, requirement - 1);
  const talentRanks: Record<string, number> = {};
  const rawRanks = raw.talentRanks && typeof raw.talentRanks === 'object'
    ? raw.talentRanks as Record<string, unknown>
    : {};
  let remainingPoints = Math.max(0, level - 1);
  for (const talent of ACCOUNT_TALENTS) {
    const requestedRank = safeInt(rawRanks[talent.id], 0, talent.maxRank);
    if (requestedRank <= 0 || remainingPoints <= 0) continue;
    if (talent.prerequisiteId) {
      const prerequisite = ACCOUNT_TALENTS.find((entry) => entry.id === talent.prerequisiteId);
      if (!prerequisite || (talentRanks[prerequisite.id] || 0) < prerequisite.maxRank) continue;
    }
    const kept = Math.min(requestedRank, remainingPoints);
    if (kept > 0) talentRanks[talent.id] = kept;
    remainingPoints -= kept;
  }
  return { version: 1, level, xp, talentRanks, stats: sanitizeAccountStats(raw.stats) };
}

export function getAccountRankInfo(level: number) {
  const current = safeInt(level, 1, ACCOUNT_PROGRESS_MAX_LEVEL);
  let active = ACCOUNT_RANKS[0];
  let next = ACCOUNT_RANKS[1] || null;
  for (let i = 0; i < ACCOUNT_RANKS.length; i++) {
    const rank = ACCOUNT_RANKS[i]!;
    if (rank.level <= current) {
      active = rank;
      next = ACCOUNT_RANKS[i + 1] || null;
    }
  }
  return {
    rankName: active.name,
    rankIcon: active.icon,
    rankSubtitle: active.subtitle,
    rankReward: active.reward,
    nextRankName: next?.name ?? 'MAKSYMALNA RANGA',
    nextRankLevel: next?.level ?? ACCOUNT_PROGRESS_MAX_LEVEL,
    isMaxRank: current >= ACCOUNT_PROGRESS_MAX_LEVEL,
  };
}

export function getAccountProgressionSummary(value: unknown): AccountProgressionSummary {
  const profile = sanitizeAccountProgressionProfile(value);
  const spentSkillPoints = Object.values(profile.talentRanks).reduce((sum, rank) => sum + rank, 0);
  const xpToNext = getAccountXpRequirement(profile.level);
  const rank = getAccountRankInfo(profile.level);
  return {
    level: profile.level,
    xp: profile.xp,
    xpToNext,
    progressPercent: xpToNext > 0 ? clamp(profile.xp / xpToNext * 100, 0, 100) : 100,
    availableSkillPoints: Math.max(0, Math.min(ACCOUNT_PROGRESS_MAX_SKILL_POINTS, profile.level - 1) - spentSkillPoints),
    spentSkillPoints,
    rankName: rank.rankName,
    nextRankName: rank.nextRankName,
    nextRankLevel: rank.nextRankLevel,
    isMaxLevel: profile.level >= ACCOUNT_PROGRESS_MAX_LEVEL,
    stats: { ...profile.stats },
  };
}

export function canSpendAccountTalentPoint(value: unknown, talentId: string): boolean {
  const profile = sanitizeAccountProgressionProfile(value);
  const talent = ACCOUNT_TALENTS.find((entry) => entry.id === talentId);
  if (!talent) return false;
  const summary = getAccountProgressionSummary(profile);
  if (summary.availableSkillPoints <= 0) return false;
  const currentRank = profile.talentRanks[talentId] || 0;
  if (currentRank >= talent.maxRank) return false;
  if (talent.prerequisiteId) {
    const prerequisite = ACCOUNT_TALENTS.find((entry) => entry.id === talent.prerequisiteId);
    if (!prerequisite || (profile.talentRanks[prerequisite.id] || 0) < prerequisite.maxRank) return false;
  }
  return true;
}

export function spendAccountTalentPoint(
  value: unknown,
  talentId: string,
): { profile: AccountProgressionProfile; purchased: boolean } {
  const profile = sanitizeAccountProgressionProfile(value);
  if (!canSpendAccountTalentPoint(profile, talentId)) return { profile, purchased: false };
  const currentRank = profile.talentRanks[talentId] || 0;
  profile.talentRanks[talentId] = currentRank + 1;
  return { profile, purchased: true };
}

function getNodeBonuses(profile: AccountProgressionProfile): AccountProgressionBonuses {
  const totals: Record<AccountTalentEffect, number> = {
    damage: 0,
    damageTaken: 0,
    speed: 0,
    jump: 0,
    cooldown: 0,
    xp: 0,
  };
  for (const talent of ACCOUNT_TALENTS) {
    totals[talent.effect] += (profile.talentRanks[talent.id] || 0) * talent.perRank;
  }
  return {
    damageMultiplier: 1 + totals.damage,
    damageTakenMultiplier: Math.max(0.92, 1 - totals.damageTaken),
    speedMultiplier: Math.min(1.06, 1 + totals.speed),
    jumpMultiplier: Math.min(1.06, 1 + totals.jump),
    abilityCooldownMultiplier: Math.max(0.90, 1 - totals.cooldown),
    xpMultiplier: Math.min(1.12, 1 + totals.xp),
  };
}

function getRankBonuses(level: number): AccountProgressionBonuses {
  const bonuses = { ...NEUTRAL_ACCOUNT_BONUSES };
  const unlock = (required: number) => level >= required;
  if (unlock(5)) bonuses.xpMultiplier *= 1.01;
  if (unlock(10)) bonuses.damageMultiplier *= 1.01;
  if (unlock(15)) bonuses.damageTakenMultiplier *= 0.99;
  if (unlock(20)) bonuses.speedMultiplier *= 1.01;
  if (unlock(25)) bonuses.abilityCooldownMultiplier *= 0.99;
  if (unlock(30)) bonuses.xpMultiplier *= 1.02;
  if (unlock(34)) bonuses.damageMultiplier *= 1.01;
  if (unlock(37)) bonuses.xpMultiplier *= 1.02;
  return bonuses;
}

export function getAccountProgressionBonuses(value: unknown): AccountProgressionBonuses {
  const profile = sanitizeAccountProgressionProfile(value);
  const nodes = getNodeBonuses(profile);
  const ranks = getRankBonuses(profile.level);
  return {
    damageMultiplier: clamp(nodes.damageMultiplier * ranks.damageMultiplier, 1, 1.08),
    damageTakenMultiplier: clamp(nodes.damageTakenMultiplier * ranks.damageTakenMultiplier, 0.90, 1),
    speedMultiplier: clamp(nodes.speedMultiplier * ranks.speedMultiplier, 1, 1.06),
    jumpMultiplier: clamp(nodes.jumpMultiplier, 1, 1.06),
    abilityCooldownMultiplier: clamp(nodes.abilityCooldownMultiplier * ranks.abilityCooldownMultiplier, 0.90, 1),
    xpMultiplier: clamp(nodes.xpMultiplier * ranks.xpMultiplier, 1, 1.18),
  };
}

/** Adapter for the server-authoritative PvP profile; jump and XP remain account-level effects. */
export function getAccountPvpProgressionBonuses(value: unknown) {
  const bonuses = getAccountProgressionBonuses(value);
  return {
    damageMultiplier: bonuses.damageMultiplier,
    damageTakenMultiplier: bonuses.damageTakenMultiplier,
    speedMultiplier: bonuses.speedMultiplier,
    cooldownMultiplier: bonuses.abilityCooldownMultiplier,
  };
}

function addAccountXp(
  value: unknown,
  baseXp: number,
  updateStats: (stats: AccountProgressionStats) => void,
  xpMultiplier = 1,
): AccountProgressionUpdate {
  const profile = sanitizeAccountProgressionProfile(value);
  updateStats(profile.stats);
  const safeBaseXp = safeInt(baseXp, 0, 100_000);
  const multiplier = clamp(xpMultiplier, 1, 1.18);
  const xpEarned = Math.min(2_000, Math.round(safeBaseXp * multiplier));
  const previousRank = getAccountRankInfo(profile.level).rankName;
  let level = profile.level;
  let xp = profile.xp + xpEarned;
  let levelsGained = 0;
  while (level < ACCOUNT_PROGRESS_MAX_LEVEL) {
    const requirement = getAccountXpRequirement(level);
    if (xp < requirement) break;
    xp -= requirement;
    level++;
    levelsGained++;
  }
  if (level >= ACCOUNT_PROGRESS_MAX_LEVEL) xp = 0;
  const updated: AccountProgressionProfile = { ...profile, level, xp };
  const rankUps = ACCOUNT_RANKS
    .filter((rank) => rank.level > profile.level && rank.level <= level)
    .map((rank) => rank.name);
  return { profile: updated, xpEarned, levelsGained, rankUps };
}

export function recordAccountSurvivalRun(
  value: unknown,
  result: AccountSurvivalResult,
): AccountProgressionUpdate {
  const kills = safeInt(result.kills);
  const seconds = safeInt(result.elapsedSeconds);
  const bosses = safeInt(result.bossesDefeated);
  const secrets = safeInt(result.secretsFound);
  const wave = safeInt(result.highestWave);
  const baseXp = kills * 2 + Math.floor(seconds / 20) * 2 + bosses * 40 + secrets * 20 + wave * 5;
  const bonus = getAccountProgressionBonuses(value);
  return addAccountXp(value, baseXp, (stats) => {
    stats.survivalRuns += 1;
    stats.survivalKills += kills;
    stats.bossesDefeated += bosses;
  }, bonus.xpMultiplier);
}

export function recordAccountPvpMatch(
  value: unknown,
  result: AccountPvpResult,
): AccountProgressionUpdate {
  const damage = safeInt(result.damageDealt);
  const hits = safeInt(result.shotsHit);
  const knockouts = safeInt(result.knockouts);
  const roundsWon = safeInt(result.roundsWon, 0, 3);
  const baseXp = Math.min(50, Math.floor(damage / 40))
    + Math.min(40, hits * 2)
    + Math.min(45, knockouts * 15)
    + roundsWon * 12
    + (result.wonMatch ? 25 : 0);
  const bonus = getAccountProgressionBonuses(value);
  return addAccountXp(value, baseXp, (stats) => {
    stats.pvpMatches += 1;
    if (result.wonMatch) stats.pvpWins += 1;
    stats.pvpDamage += damage;
  }, bonus.xpMultiplier);
}

/** Adapt account-wide upgrades to the existing operator mastery interface (PvE). */
export function combineAccountAndCharacterBonuses(
  character: {
    attackMultiplier: number;
    damageTakenMultiplier: number;
    speedMultiplier: number;
    jumpMultiplier: number;
    abilityCooldownMultiplier: number;
  },
  account: AccountProgressionBonuses,
) {
  return {
    attackMultiplier: clamp(character.attackMultiplier * account.damageMultiplier, 1, 1.08),
    damageTakenMultiplier: clamp(character.damageTakenMultiplier * account.damageTakenMultiplier, 0.90, 1),
    speedMultiplier: clamp(character.speedMultiplier * account.speedMultiplier, 1, 1.08),
    jumpMultiplier: clamp(character.jumpMultiplier * account.jumpMultiplier, 1, 1.08),
    abilityCooldownMultiplier: clamp(character.abilityCooldownMultiplier * account.abilityCooldownMultiplier, 0.90, 1),
  };
}
