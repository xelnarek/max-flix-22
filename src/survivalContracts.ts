export type SurvivalContractKind = 'eliminations' | 'xp' | 'combo';
export type SurvivalContractAction = SurvivalContractKind;

export interface SurvivalContractState {
  wave: number;
  kind: SurvivalContractKind;
  title: string;
  description: string;
  target: number;
  progress: number;
  remainingSeconds: number;
  completed: boolean;
  expired: boolean;
}

export interface SurvivalContractResult {
  state: SurvivalContractState;
  completedNow: boolean;
  expiredNow: boolean;
}

const CONTRACT_DURATION_SECONDS = 60;

function safeWave(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Three attainable, different goals rotate with each warehouse shift. */
export function createSurvivalContract(wave: number): SurvivalContractState {
  const safe = safeWave(wave);
  const tier = Math.floor((safe - 1) / 3);
  const cycle = (safe - 1) % 3;

  if (cycle === 0) {
    const target = 7 + tier * 2;
    return {
      wave: safe,
      kind: 'eliminations',
      title: 'NORMA ZMIANY',
      description: 'Zlikwiduj ' + target + ' przeciwników przed końcem fali.',
      target,
      progress: 0,
      remainingSeconds: CONTRACT_DURATION_SECONDS,
      completed: false,
      expired: false,
    };
  }

  if (cycle === 1) {
    const target = 6 + tier * 2;
    return {
      wave: safe,
      kind: 'xp',
      title: 'ZABEZPIECZ ŁADUNEK',
      description: 'Zbierz ' + target + ' XP z kryształów.',
      target,
      progress: 0,
      remainingSeconds: CONTRACT_DURATION_SECONDS,
      completed: false,
      expired: false,
    };
  }

  const target = safe >= 6 ? 4 : 3;
  return {
    wave: safe,
    kind: 'combo',
    title: 'ŁAŃCUCH ELIMINACJI',
    description: 'Zbuduj serię eliminacji ×' + target + ' w jednym combo.',
    target,
    progress: 0,
    remainingSeconds: CONTRACT_DURATION_SECONDS,
    completed: false,
    expired: false,
  };
}

/** Advance the contract clock using simulation seconds, with finite bounds. */
export function advanceSurvivalContract(
  state: SurvivalContractState,
  deltaSeconds: number,
): SurvivalContractResult {
  if (state.completed || state.expired) {
    return { state, completedNow: false, expiredNow: false };
  }

  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const remainingSeconds = Math.max(0, state.remainingSeconds - dt);
  const expired = remainingSeconds <= 0;
  return {
    state: { ...state, remainingSeconds, expired },
    completedNow: false,
    expiredNow: expired,
  };
}

/**
 * Register a completed game action. Combo progress stores the best streak,
 * while eliminations and collected XP accumulate during the current wave.
 */
export function registerSurvivalContractAction(
  state: SurvivalContractState,
  action: SurvivalContractAction,
  amount = 1,
): SurvivalContractResult {
  if (state.completed || state.expired || state.kind !== action) {
    return { state, completedNow: false, expiredNow: false };
  }

  const safe = safeAmount(amount);
  const progress = action === 'combo'
    ? Math.max(state.progress, safe)
    : Math.min(state.target, state.progress + safe);
  const completed = progress >= state.target;
  return {
    state: { ...state, progress, completed },
    completedNow: completed,
    expiredNow: false,
  };
}
