import type { EnemyType } from './types.ts';

export interface EnemyRangedAttackTelegraphProfile {
  readonly windupSeconds: number;
  readonly laneWidth: number;
  readonly color: number;
  readonly warningText: string;
}

const PROFILES: Readonly<Partial<Record<EnemyType, EnemyRangedAttackTelegraphProfile>>> = Object.freeze({
  pomazaniec: {
    windupSeconds: 0.52, laneWidth: 1.55, color: 0xf472b6,
    warningText: '🍭 POMAZANIEC CELOWAŁ — ZMIEŃ KIERUNEK!',
  },
  handlowiec: {
    windupSeconds: 0.48, laneWidth: 1.15, color: 0xf59e0b,
    warningText: '📑 HANDLOWIEC ŁADUJE OFERTĘ — ZEJDŹ Z LINII!',
  },
  'przedstawiciel_włoski': {
    windupSeconds: 0.50, laneWidth: 1.10, color: 0x22c55e,
    warningText: '🇮🇹 ARMATURA DE LUX — UNIKAJ STRZAŁU!',
  },
  pan_roman: {
    windupSeconds: 0.56, laneWidth: 1.65, color: 0xf97316,
    warningText: '📦 PAN ROMAN PODNOSI UMYWALKĘ — ZMIEŃ ALEJKĘ!',
  },
  serwisant: {
    windupSeconds: 0.42, laneWidth: 0.92, color: 0x22d3ee,
    warningText: '⚡ SERWISANT ŁADUJE ISKRĘ — ZEJDŹ Z LINII!',
  },
  cyber_salesman: {
    windupSeconds: 0.46, laneWidth: 1.05, color: 0xa855f7,
    warningText: '💻 CYBER-KATALOG NAMIERZA — ZRÓB UNIK!',
  },
});

export function getEnemyRangedAttackTelegraphProfile(
  type: EnemyType,
): Readonly<EnemyRangedAttackTelegraphProfile> | null {
  return PROFILES[type] ?? null;
}

/** Keep the number of simultaneous enemy attack cues readable on small screens. */
export function getEnemyAttackTelegraphConcurrencyLimit(isHandheld: boolean): number {
  return isHandheld ? 2 : 4;
}

/** Reject malformed counts rather than accidentally opening an unlimited warning budget. */
export function hasEnemyAttackTelegraphCapacity(activeCount: number, isHandheld: boolean): boolean {
  if (!Number.isFinite(activeCount)) return false;
  return Math.max(0, Math.floor(activeCount)) < getEnemyAttackTelegraphConcurrencyLimit(isHandheld);
}

export interface EnemyAttackTelegraphTick {
  readonly remainingSeconds: number;
  readonly progress: number;
  readonly completed: boolean;
}

/** Advance an attack warning in bounded steps so a frame hitch cannot skip its tell. */
export function advanceEnemyAttackTelegraph(
  remainingSeconds: number,
  durationSeconds: number,
  deltaSeconds: number,
): EnemyAttackTelegraphTick {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { remainingSeconds: 0, progress: 1, completed: false };
  }
  const duration = Math.max(0.12, Math.min(1.2, durationSeconds));
  if (!Number.isFinite(remainingSeconds)) {
    return { remainingSeconds: duration, progress: 0, completed: false };
  }
  if (remainingSeconds <= 0) {
    return { remainingSeconds: 0, progress: 1, completed: true };
  }
  const current = Math.min(duration, remainingSeconds);
  if (!Number.isFinite(deltaSeconds)) {
    return { remainingSeconds: current, progress: 1 - current / duration, completed: false };
  }
  const step = Math.max(0, Math.min(0.25, deltaSeconds));
  const remaining = Math.max(0, current - step);
  return {
    remainingSeconds: remaining,
    progress: Math.max(0, Math.min(1, 1 - remaining / duration)),
    completed: remaining <= 1e-6,
  };
}
