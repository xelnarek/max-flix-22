export type GobkitActionName =
  | 'Idle' | 'IdleLook' | 'IdleFidget'
  | 'Walk' | 'Run' | 'WalkBackward' | 'StrafeLeft' | 'StrafeRight'
  | 'Jump' | 'Fall' | 'Land'
  | 'Hit' | 'Attack' | 'Special' | 'Death';

type ActionLookup = { has(name: string): boolean };

const ACTION_FALLBACKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  Attack: ['Run', 'Walk', 'Idle'],
  Special: ['Attack', 'Run', 'Walk', 'Idle'],
  Jump: ['Fall', 'Walk', 'Run', 'Idle'],
  Fall: ['Jump', 'Run', 'Walk', 'Idle'],
  Land: ['Idle', 'Walk'],
  WalkBackward: ['Walk', 'Run', 'Idle'],
  StrafeLeft: ['Walk', 'Run', 'Idle'],
  StrafeRight: ['Walk', 'Run', 'Idle'],
  IdleLook: ['Idle', 'Walk'],
  IdleFidget: ['Idle', 'Walk'],
  Hit: ['Idle', 'Walk'],
  Death: ['Idle'],
  Run: ['Walk', 'Idle'],
  Walk: ['Idle'],
  Idle: ['Walk'],
});

export function resolveGobkitActionName(requestedName: string, available: ActionLookup): string {
  if (available.has(requestedName)) return requestedName;
  const fallbacks = ACTION_FALLBACKS[requestedName] ?? ['Idle'];
  return fallbacks.find((name) => available.has(name)) ?? (available.has('Idle') ? 'Idle' : 'Idle');
}

export function getGobkitActionPriority(actionName: string): number {
  switch (actionName) {
    case 'Death': return 5;
    case 'Hit': return 4;
    case 'Special': return 3;
    case 'Attack': return 2;
    case 'Jump':
    case 'Land': return 1;
    default: return 0;
  }
}

export function shouldKeepGobkitAction(activeRemaining: number, activePriority: number, requestedPriority: number): boolean {
  return activeRemaining > 0 && requestedPriority < activePriority;
}

export function clampGobkitActionDuration(durationSeconds: number): number {
  const duration = Number.isFinite(durationSeconds) ? durationSeconds : 0.28;
  return Math.min(1.2, Math.max(0.12, duration));
}

export function isGobkitOneShotAction(actionName: string): boolean {
  return actionName === 'Death' || actionName === 'Hit' ||
    actionName === 'Attack' || actionName === 'Special' ||
    actionName === 'Jump' || actionName === 'Land';
}
