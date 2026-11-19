export type GobkitActionName =
  | 'Idle' | 'IdleLook' | 'IdleFidget'
  | 'Walk' | 'Run' | 'WalkBackward' | 'StrafeLeft' | 'StrafeRight'
  | 'Jump' | 'Fall' | 'Land'
  | 'Hit' | 'Attack' | 'Special' | 'Death';

type ActionLookup = { has(name: string): boolean };

/**
 * Map common DCC / Mixamo / Blender clip labels to the runtime action contract.
 * Imported GLBs often prefix clips with an armature name or suffix them with
 * an index; exact-name lookup alone silently left those rigs without locomotion.
 */
export function canonicalizeGobkitClipName(sourceName: string): string | null {
  const name = String(sourceName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!name) return null;
  if (/(death|dead|dying|defeat|knockout)/.test(name)) return 'Death';
  if (/(special|ultimate|powerattack)/.test(name)) return 'Special';
  if (/(hit|hurt|damage|flinch|stagger)/.test(name)) return 'Hit';
  if (/(attack|strike|punch|melee|slash|swing|shoot|fire)/.test(name)) return 'Attack';
  if (/(walkbackward|walkback|backwalk|reversewalk)/.test(name)) return 'WalkBackward';
  if (/(strafeleft|leftstrafe|sidestepleft)/.test(name)) return 'StrafeLeft';
  if (/(straferight|rightstrafe|sidestepright)/.test(name)) return 'StrafeRight';
  if (/(run|sprint|jog)/.test(name)) return 'Run';
  if (/(idlelook|lookaround|lookidle)/.test(name)) return 'IdleLook';
  if (/(fidget|idlebusy)/.test(name)) return 'IdleFidget';
  if (/(walk|locomotion|move)/.test(name)) return 'Walk';
  if (/(idle|stand|breath|rest)/.test(name)) return 'Idle';
  return null;
}

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
