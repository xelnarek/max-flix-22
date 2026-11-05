export type SurvivalShiftEventAction = 'kills' | 'xp' | 'combo';

export interface SurvivalShiftEvent {
  id: 'xp_sweep' | 'clean_lane' | 'combo_chain';
  title: string;
  description: string;
  action: SurvivalShiftEventAction;
  target: number;
  progress: number;
  remainingSeconds: number;
}

export interface SurvivalShiftEventState {
  active: SurvivalShiftEvent | null;
  nextAt: number;
  sequence: number;
  successStreak: number;
}

export interface SurvivalShiftEventResult {
  state: SurvivalShiftEventState;
  started: SurvivalShiftEvent | null;
  expired: SurvivalShiftEvent | null;
  completed: SurvivalShiftEvent | null;
}

const EVENT_DURATION_SECONDS = 34;
const EVENT_GAP_SECONDS = 52;

const EVENT_ROTATION: Array<Omit<SurvivalShiftEvent, 'progress' | 'remainingSeconds'>> = [
  { id: 'xp_sweep', title: 'EKSPRESOWY AUDYT XP', description: 'Zbierz 9 XP, zanim audytor zamknie terminal.', action: 'xp', target: 9 },
  { id: 'clean_lane', title: 'CZYSTA ALEJKA', description: 'Zlikwiduj 11 przeciwników i utrzymaj drożność magazynu.', action: 'kills', target: 11 },
  { id: 'combo_chain', title: 'ŁAŃCUCH BEZ PRZERWY', description: 'Zbuduj serię eliminacji ×5 bez utraty tempa.', action: 'combo', target: 5 },
];

export function createSurvivalShiftEventState(): SurvivalShiftEventState {
  return { active: null, nextAt: 70, sequence: 0, successStreak: 0 };
}

/** Starts one rotating side objective and advances its clock using simulation time. */
export function advanceSurvivalShiftEvent(
  state: SurvivalShiftEventState,
  elapsedSeconds: number,
  deltaSeconds: number,
): SurvivalShiftEventResult {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;

  if (state.active) {
    const remainingSeconds = Math.max(0, state.active.remainingSeconds - dt);
    if (remainingSeconds <= 0) {
      return { state: { ...state, active: null, nextAt: elapsed + EVENT_GAP_SECONDS, successStreak: 0 }, started: null, expired: state.active, completed: null };
    }
    return { state: { ...state, active: { ...state.active, remainingSeconds } }, started: null, expired: null, completed: null };
  }

  if (elapsed < state.nextAt) return { state, started: null, expired: null, completed: null };
  const template = EVENT_ROTATION[state.sequence % EVENT_ROTATION.length];
  const active: SurvivalShiftEvent = { ...template, progress: 0, remainingSeconds: EVENT_DURATION_SECONDS };
  return { state: { ...state, active, sequence: state.sequence + 1 }, started: active, expired: null, completed: null };
}

/** Tracks only the action requested by the active event; combo records its best streak. */
export function registerSurvivalShiftEventAction(
  state: SurvivalShiftEventState,
  action: SurvivalShiftEventAction,
  amount = 1,
  elapsedSeconds = 0,
): SurvivalShiftEventResult {
  const event = state.active;
  if (!event || event.action !== action || !Number.isFinite(amount)) {
    return { state, started: null, expired: null, completed: null };
  }

  const safeAmount = Math.max(0, Math.floor(amount));
  const progress = action === 'combo' ? Math.max(event.progress, safeAmount) : Math.min(event.target, event.progress + safeAmount);
  const updated = { ...event, progress };
  if (progress < event.target) return { state: { ...state, active: updated }, started: null, expired: null, completed: null };

  return {
    state: { ...state, active: null, nextAt: Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0) + EVENT_GAP_SECONDS, successStreak: state.successStreak + 1 },
    started: null,
    expired: null,
    completed: updated,
  };
}
