import type { SurvivalWaveMutatorId } from './survivalWaveMutators.ts';

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

function createMutatorContract(
  wave: number,
  tier: number,
  mutatorId: SurvivalWaveMutatorId,
): SurvivalContractState | null {
  const make = (
    kind: SurvivalContractKind,
    title: string,
    target: number,
    description: string,
  ): SurvivalContractState => ({
    wave,
    kind,
    title,
    description,
    target,
    progress: 0,
    remainingSeconds: CONTRACT_DURATION_SECONDS,
    completed: false,
    expired: false,
  });

  switch (mutatorId) {
    case 'rush': {
      const target = 3 + Math.min(3, Math.floor(tier / 2));
      return make(
        'combo',
        'SERIA SZYBKIEJ ZMIANY',
        target,
        'Zbuduj serię eliminacji ×' + target + ' w jednym combo podczas szybkiego natarcia.',
      );
    }
    case 'armored': {
      const target = 7 + tier * 2;
      return make(
        'eliminations',
        'ROZBIJ PANCERNĄ ZMIANĘ',
        target,
        'Zlikwiduj ' + target + ' przeciwników. Uważaj na jednostki z aktywną osłoną.',
      );
    }
    case 'supply': {
      const target = 6 + tier * 2;
      return make(
        'xp',
        'ZABEZPIECZ ZŁOTY ŁADUNEK',
        target,
        'Zbierz ' + target + ' XP z kryształów. Premia dostawy zwiększa wartość łupu.',
      );
    }
    case 'swarm': {
      const target = 9 + tier * 2;
      return make(
        'eliminations',
        'OCZYŚĆ ALEJKĘ SZTURMU',
        target,
        'Zlikwiduj ' + target + ' przeciwników ze szturmu paletowego, zanim zajmą alejki.',
      );
    }
    case 'convoy': {
      const target = 4 + Math.min(4, Math.floor(tier * 0.75));
      return make(
        'xp',
        'ODZYSKAJ ŁADUNEK KONWOJU',
        target,
        'Zbierz ' + target + ' XP z kryształów upuszczanych przez ciężki konwój.',
      );
    }
    case 'ramp_overload': {
      const target = 9 + Math.min(5, tier);
      return make(
        'eliminations',
        'ROZŁADUJ PRZECIĄŻONĄ RAMPĘ',
        target,
        'Zlikwiduj ' + target + ' jednostek z dużych dostaw, zanim zablokują przejście.',
      );
    }
    case 'express_dispatch': {
      const target = 3 + Math.min(3, Math.floor(tier / 2));
      return make(
        'combo',
        'PRZECHWYĆ EKSPRESOWĄ DOSTAWĘ',
        target,
        'Zbuduj serię eliminacji ×' + target + ' podczas szybkich, mniejszych dostaw.',
      );
    }
    default:
      return null;
  }
}

/** Three attainable goals rotate by default; active wave rules can supply a matching objective. */
export function createSurvivalContract(
  wave: number,
  mutatorId?: SurvivalWaveMutatorId,
): SurvivalContractState {
  const safe = safeWave(wave);
  const tier = Math.floor((safe - 1) / 3);
  if (mutatorId && mutatorId !== 'standard') {
    const themed = createMutatorContract(safe, tier, mutatorId);
    if (themed) return themed;
  }
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
