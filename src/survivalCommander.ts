import { getSurvivalCoalitionRole, type SurvivalCoalitionRole } from './survivalCoalition.ts';

export type SurvivalCommanderBossType = 'walczak' | 'krol_leto' | 'bosman_krakow' | 'sebix_m';

export interface SurvivalCommanderUnit {
  id: string;
  type: string;
  x: number;
  z: number;
  state: string;
  role?: SurvivalCoalitionRole;
}

export interface SurvivalCommanderProfile {
  title: string;
  callout: string;
  radius: number;
  cooldownSeconds: number;
  durationSeconds: number;
  moveSpeedMultiplier: number;
  maxTargets: number;
  rolePriority: readonly SurvivalCoalitionRole[];
}

const BOSS_TYPES = new Set<SurvivalCommanderBossType>([
  'walczak',
  'krol_leto',
  'bosman_krakow',
  'sebix_m',
]);

const NEVER_COMMAND_TARGETS = new Set([
  ...BOSS_TYPES,
  'piorun_dron',
]);

const BASE_PROFILES: Record<SurvivalCommanderBossType, Omit<SurvivalCommanderProfile, 'cooldownSeconds' | 'durationSeconds' | 'moveSpeedMultiplier'>> = {
  walczak: {
    title: 'NADZORCA ZERO',
    callout: 'ROZKAZ FRONTOWY',
    radius: 11.5,
    maxTargets: 3,
    rolePriority: ['bruiser', 'flanker'],
  },
  krol_leto: {
    title: 'DYREKTOR WIDMO',
    callout: 'ZAMKNIĘCIE OKRĄŻENIA',
    radius: 12.5,
    maxTargets: 3,
    rolePriority: ['flanker', 'ranged'],
  },
  bosman_krakow: {
    title: 'BOSMAN KRAKÓW',
    callout: 'ODPRAWA RAMPY',
    radius: 13.0,
    maxTargets: 3,
    rolePriority: ['ranged', 'support'],
  },
  sebix_m: {
    title: 'OPERATOR TURBO',
    callout: 'RAJD TARANU',
    radius: 10.5,
    maxTargets: 2,
    rolePriority: ['bruiser', 'flanker'],
  },
};

/** Return the bounded command profile for a Survival boss and its current phase. */
export function getSurvivalCommanderProfile(
  bossType: string,
  phase: number,
): SurvivalCommanderProfile | null {
  if (!BOSS_TYPES.has(bossType as SurvivalCommanderBossType)) return null;
  const type = bossType as SurvivalCommanderBossType;
  const base = BASE_PROFILES[type];
  const enraged = Number.isFinite(phase) && phase >= 2;

  const timing = {
    walczak: { cooldown: enraged ? 12.0 : 14.0, duration: enraged ? 4.3 : 3.8, speed: enraged ? 1.18 : 1.14 },
    krol_leto: { cooldown: enraged ? 12.5 : 14.5, duration: enraged ? 4.8 : 4.2, speed: enraged ? 1.16 : 1.12 },
    bosman_krakow: { cooldown: enraged ? 12.0 : 14.0, duration: enraged ? 5.3 : 4.8, speed: enraged ? 1.15 : 1.12 },
    sebix_m: { cooldown: enraged ? 10.8 : 12.5, duration: enraged ? 3.7 : 3.2, speed: enraged ? 1.22 : 1.18 },
  }[type];

  return {
    ...base,
    cooldownSeconds: timing.cooldown,
    durationSeconds: timing.duration,
    moveSpeedMultiplier: timing.speed,
  };
}

/**
 * Select a small, deterministic group for a boss command. Role priority makes
 * the order read as a tactical instruction, while distance and ID break ties.
 */
export function selectSurvivalCommanderTargets(
  commander: SurvivalCommanderUnit,
  candidates: readonly SurvivalCommanderUnit[],
  profile: SurvivalCommanderProfile,
): string[] {
  if (
    !commander.id ||
    !Number.isFinite(commander.x) ||
    !Number.isFinite(commander.z) ||
    !Number.isFinite(profile.radius) ||
    !Number.isFinite(profile.maxTargets)
  ) return [];

  const radius = Math.max(0, Math.min(18, profile.radius));
  const targetCap = Math.max(0, Math.min(3, Math.floor(profile.maxTargets)));
  if (radius <= 0 || targetCap <= 0 || profile.rolePriority.length === 0) return [];

  const priority = new Map(profile.rolePriority.map((role, index) => [role, index]));
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (
        !candidate.id ||
        candidate.id === commander.id ||
        seen.has(candidate.id) ||
        candidate.state === 'defeated' ||
        NEVER_COMMAND_TARGETS.has(candidate.type) ||
        !Number.isFinite(candidate.x) ||
        !Number.isFinite(candidate.z)
      ) return false;
      seen.add(candidate.id);
      const role = candidate.role ?? getSurvivalCoalitionRole(candidate.type);
      return priority.has(role);
    })
    .map((candidate) => {
      const role = candidate.role ?? getSurvivalCoalitionRole(candidate.type);
      return {
        candidate,
        roleRank: priority.get(role) ?? Number.MAX_SAFE_INTEGER,
        distance: Math.hypot(candidate.x - commander.x, candidate.z - commander.z),
      };
    })
    .filter((entry) => Number.isFinite(entry.distance) && entry.distance <= radius)
    .sort((a, b) =>
      a.roleRank - b.roleRank ||
      a.distance - b.distance ||
      a.candidate.id.localeCompare(b.candidate.id)
    )
    .slice(0, targetCap)
    .map((entry) => entry.candidate.id);
}
