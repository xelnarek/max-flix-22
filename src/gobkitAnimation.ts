export type GobkitActionName =
  | 'Idle'
  | 'Walk'
  | 'Run'
  | 'Jump'
  | 'Hit'
  | 'Attack'
  | 'Special'
  | 'Death';

type ActionLookup = {
  has(name: string): boolean;
};

const ACTION_FALLBACKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // Base catalogue models have no authored Attack clip; use a forward gait instead of a damage-flinch pose.
  Attack: ['Run', 'Walk', 'Idle'],
  Special: ['Attack', 'Run', 'Walk', 'Idle'],
  // The approved base asset pack guarantees Walk but not Jump; use the looping gait instead of a frozen idle pose in mid-air.
  Jump: ['Walk', 'Run', 'Idle'],
  Hit: ['Idle', 'Walk'],
  Death: ['Idle'],
  Run: ['Walk', 'Idle'],
  Walk: ['Idle'],
  Idle: ['Walk'],
});

/** Resolve a missing optional clip without leaving an actor on an empty pose. */
export function resolveGobkitActionName(requestedName: string, available: ActionLookup): string {
  if (available.has(requestedName)) return requestedName;
  const fallbacks = ACTION_FALLBACKS[requestedName] ?? ['Idle'];
  return fallbacks.find((name) => available.has(name)) ?? (available.has('Idle') ? 'Idle' : 'Idle');
}

/** Death outranks damage, damage outranks special attacks, and attacks outrank locomotion. */
export function getGobkitActionPriority(actionName: string): number {
  switch (actionName) {
    case 'Death': return 4;
    case 'Hit': return 3;
    case 'Special': return 2;
    case 'Attack': return 1;
    default: return 0;
  }
}

/** Do not let a lower-priority action interrupt a more important active reaction. */
export function shouldKeepGobkitAction(
  activeRemaining: number,
  activePriority: number,
  requestedPriority: number,
): boolean {
  return activeRemaining > 0 && requestedPriority < activePriority;
}

/** Clamp external animation windows so invalid data cannot stall or snap the action state. */
export function clampGobkitActionDuration(durationSeconds: number): number {
  const duration = Number.isFinite(durationSeconds) ? durationSeconds : 0.28;
  return Math.min(1.2, Math.max(0.12, duration));
}

/** Jump is airborne locomotion and must loop until landing; combat reactions are one-shots. */
export function isGobkitOneShotAction(actionName: string): boolean {
  return actionName === 'Death' ||
    actionName === 'Hit' ||
    actionName === 'Attack' ||
    actionName === 'Special';
}
