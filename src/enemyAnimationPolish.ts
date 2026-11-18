import * as THREE from 'three';
import type { EnemyType } from './types.ts';
import { ENEMY_GAIT_PRESETS, ENEMY_VISUAL_PROFILES } from './enemyVisualProfiles.ts';

interface AnatomyProfile {
  torsoWidth: number;
  torsoDepth: number;
  shoulderWidth: number;
  headScale: number;
  armBuild: number;
  legBuild: number;
  neckScale?: number;
  forearmBuild?: number;
  calfBuild?: number;
  hipWidth?: number;
  leftArmScale?: number;
  rightArmScale?: number;
  leftLegScale?: number;
}

/**
 * Subtle bone-space proportions keep the source rig recognisable while making
 * body mass and posture differ before role equipment is added. Values are
 * multipliers, not absolute bone scales, so the source skeleton remains intact.
 */
const ANATOMY: Readonly<Partial<Record<EnemyType, AnatomyProfile>>> = Object.freeze({
  customer: { torsoWidth:1.08, torsoDepth:1.08, shoulderWidth:1.04, headScale:1.04, armBuild:1.02, legBuild:.98 , neckScale:1.02, forearmBuild:1.02, calfBuild:0.98, hipWidth:1.04},
  architect: { torsoWidth:.91, torsoDepth:.94, shoulderWidth:.88, headScale:1.02, armBuild:.94, legBuild:1.02 , neckScale:0.96, forearmBuild:0.92, calfBuild:0.97, hipWidth:0.92},
  inspector: { torsoWidth:1.08, torsoDepth:1.04, shoulderWidth:1.12, headScale:1.00, armBuild:1.06, legBuild:1.02 , neckScale:1.02, forearmBuild:1.08, calfBuild:1.02, hipWidth:1.08},
  kurier: { torsoWidth:.96, torsoDepth:.94, shoulderWidth:.96, headScale:.98, armBuild:.98, legBuild:1.04 , neckScale:0.98, forearmBuild:0.96, calfBuild:1.06, hipWidth:0.96},
  handlowiec: { torsoWidth:.91, torsoDepth:.93, shoulderWidth:.91, headScale:1.02, armBuild:.94, legBuild:1.00 , neckScale:0.96, forearmBuild:0.92, calfBuild:1, hipWidth:0.92},
  monter: { torsoWidth:1.10, torsoDepth:1.06, shoulderWidth:1.13, headScale:1.01, armBuild:1.08, legBuild:1.04 , neckScale:1.02, forearmBuild:1.12, calfBuild:1.08, hipWidth:1.08},
  'przedstawiciel_włoski': { torsoWidth:.93, torsoDepth:.93, shoulderWidth:.92, headScale:1.02, armBuild:.96, legBuild:1.00 , neckScale:0.98, forearmBuild:0.94, calfBuild:0.98, hipWidth:0.92},
  sztaplar_szalony: { torsoWidth:1.18, torsoDepth:1.12, shoulderWidth:1.20, headScale:.98, armBuild:1.12, legBuild:1.08 , neckScale:1, forearmBuild:1.14, calfBuild:1.12, hipWidth:1.16},
  krol_leto: { torsoWidth:1.22, torsoDepth:1.13, shoulderWidth:1.25, headScale:1.09, armBuild:1.16, legBuild:1.12 , neckScale:1.12, forearmBuild:1.18, calfBuild:1.18, hipWidth:1.18},
  pan_roman: { torsoWidth:1.13, torsoDepth:1.08, shoulderWidth:1.10, headScale:1.04, armBuild:1.06, legBuild:1.02 , neckScale:1.02, forearmBuild:1.08, calfBuild:1.06, hipWidth:1.1},
  serwisant: { torsoWidth:.98, torsoDepth:.97, shoulderWidth:.99, headScale:1.00, armBuild:1.00, legBuild:1.00 , neckScale:1, forearmBuild:1, calfBuild:1, hipWidth:1},
  bosman_krakow: { torsoWidth:1.23, torsoDepth:1.10, shoulderWidth:1.24, headScale:1.04, armBuild:1.13, legBuild:1.09 , neckScale:1.06, forearmBuild:1.15, calfBuild:1.08, hipWidth:1.15},
  zombie_pracownik: { torsoWidth:1.00, torsoDepth:1.04, shoulderWidth:1.00, headScale:1.03, armBuild:1.04, legBuild:.98, leftArmScale:.84, rightArmScale:1.12, leftLegScale:.93 , neckScale:1.1, forearmBuild:1.06, calfBuild:0.92, hipWidth:1},
  sebix_m: { torsoWidth:1.16, torsoDepth:1.08, shoulderWidth:1.17, headScale:1.00, armBuild:1.10, legBuild:1.05 , neckScale:1, forearmBuild:1.1, calfBuild:1.05, hipWidth:1.12},
  mutant_gamma_forklift: { torsoWidth:1.30, torsoDepth:1.18, shoulderWidth:1.32, headScale:1.08, armBuild:1.22, legBuild:1.16 , neckScale:1.14, forearmBuild:1.24, calfBuild:1.18, hipWidth:1.22},
  radioactive_pip: { torsoWidth:1.11, torsoDepth:1.14, shoulderWidth:1.10, headScale:1.02, armBuild:1.05, legBuild:1.03 , neckScale:1.08, forearmBuild:1.1, calfBuild:1, hipWidth:1.04},
  cyber_salesman: { torsoWidth:1.08, torsoDepth:1.00, shoulderWidth:1.11, headScale:1.02, armBuild:1.08, legBuild:1.04 , neckScale:1.06, forearmBuild:1.08, calfBuild:1.05, hipWidth:1.08},
  elite_walczak_guard: { torsoWidth:1.20, torsoDepth:1.12, shoulderWidth:1.24, headScale:1.00, armBuild:1.18, legBuild:1.10 , neckScale:1.04, forearmBuild:1.18, calfBuild:1.12, hipWidth:1.18},
  walczak: { torsoWidth:1.31, torsoDepth:1.20, shoulderWidth:1.34, headScale:1.12, armBuild:1.26, legBuild:1.18 , neckScale:1.14, forearmBuild:1.28, calfBuild:1.22, hipWidth:1.25},
});


export interface EnemyRoleMotionAccent {
  /** Neutral head angle; positive values create a recognisable role-specific attitude. */
  readonly headTilt: number;
  /** Amplitude of independent head tracking while the actor breathes or moves. */
  readonly headLook: number;
  /** Lateral torso movement layered over the source locomotion clip. */
  readonly torsoSway: number;
  /** Additional forward/back posture bias. */
  readonly torsoLean: number;
  /** Low-frequency chest breathing / mechanical pulse. */
  readonly chestBreath: number;
  /** Small asymmetry in the resting arm pose. */
  readonly armAsymmetry: number;
}

export interface EnemyCombatMotionProfile {
  readonly attackWindup: number;
  readonly attackFollowThrough: number;
  readonly hitStagger: number;
}

/** Short, bounded action accents keep attacks and impacts distinct by role. */
export const ENEMY_COMBAT_MOTION_PROFILES: Readonly<Partial<Record<EnemyType, EnemyCombatMotionProfile>>> = Object.freeze({
  customer: { attackWindup: 0.055, attackFollowThrough: 0.105, hitStagger: 0.075 },
  walczak: { attackWindup: 0.125, attackFollowThrough: 0.185, hitStagger: 0.052 },
  architect: { attackWindup: 0.045, attackFollowThrough: 0.072, hitStagger: 0.105 },
  inspector: { attackWindup: 0.065, attackFollowThrough: 0.085, hitStagger: 0.082 },
  handlowiec: { attackWindup: 0.052, attackFollowThrough: 0.12, hitStagger: 0.088 },
  monter: { attackWindup: 0.085, attackFollowThrough: 0.14, hitStagger: 0.065 },
  kurier: { attackWindup: 0.048, attackFollowThrough: 0.115, hitStagger: 0.085 },
  'przedstawiciel_włoski': { attackWindup: 0.05, attackFollowThrough: 0.135, hitStagger: 0.095 },
  sztaplar_szalony: { attackWindup: 0.105, attackFollowThrough: 0.17, hitStagger: 0.055 },
  krol_leto: { attackWindup: 0.14, attackFollowThrough: 0.19, hitStagger: 0.045 },
  pan_roman: { attackWindup: 0.072, attackFollowThrough: 0.11, hitStagger: 0.073 },
  serwisant: { attackWindup: 0.06, attackFollowThrough: 0.095, hitStagger: 0.08 },
  bosman_krakow: { attackWindup: 0.11, attackFollowThrough: 0.15, hitStagger: 0.05 },
  zombie_pracownik: { attackWindup: 0.09, attackFollowThrough: 0.155, hitStagger: 0.13 },
  sebix_m: { attackWindup: 0.10, attackFollowThrough: 0.18, hitStagger: 0.075 },
  mutant_gamma_forklift: { attackWindup: 0.15, attackFollowThrough: 0.20, hitStagger: 0.04 },
  radioactive_pip: { attackWindup: 0.075, attackFollowThrough: 0.125, hitStagger: 0.09 },
  cyber_salesman: { attackWindup: 0.082, attackFollowThrough: 0.10, hitStagger: 0.06 },
  elite_walczak_guard: { attackWindup: 0.12, attackFollowThrough: 0.165, hitStagger: 0.042 },
});

const DEFAULT_ENEMY_COMBAT_MOTION_PROFILE: EnemyCombatMotionProfile = Object.freeze({
  attackWindup: 0.06, attackFollowThrough: 0.11, hitStagger: 0.08,
});

export function getEnemyCombatMotionProfile(type: EnemyType): Readonly<EnemyCombatMotionProfile> {
  return ENEMY_COMBAT_MOTION_PROFILES[type] ?? DEFAULT_ENEMY_COMBAT_MOTION_PROFILE;
}

/**
 * Per-archetype motion accents prevent the shared source rigs from reading as
 * palette swaps. The source clips still own the main gait and combat actions;
 * these small additive offsets supply each role's idle attitude and weight.
 */
export const ENEMY_ROLE_MOTION_ACCENTS: Readonly<Partial<Record<EnemyType, EnemyRoleMotionAccent>>> = Object.freeze({
  customer: { headTilt: 0.035, headLook: 0.13, torsoSway: 0.060, torsoLean: 0.025, chestBreath: 0.020, armAsymmetry: 0.045 },
  walczak: { headTilt: 0.105, headLook: 0.105, torsoSway: 0.074, torsoLean: -0.105, chestBreath: 0.050, armAsymmetry: 0.105 },
  architect: { headTilt: -0.075, headLook: 0.17, torsoSway: 0.026, torsoLean: 0.055, chestBreath: 0.012, armAsymmetry: -0.055 },
  inspector: { headTilt: -0.015, headLook: 0.075, torsoSway: 0.014, torsoLean: -0.025, chestBreath: 0.018, armAsymmetry: -0.012 },
  handlowiec: { headTilt: 0.045, headLook: 0.12, torsoSway: 0.058, torsoLean: -0.018, chestBreath: 0.014, armAsymmetry: -0.035 },
  monter: { headTilt: -0.025, headLook: 0.065, torsoSway: 0.025, torsoLean: -0.050, chestBreath: 0.035, armAsymmetry: -0.065 },
  kurier: { headTilt: -0.010, headLook: 0.085, torsoSway: 0.048, torsoLean: -0.075, chestBreath: 0.028, armAsymmetry: 0.018 },
  'przedstawiciel_włoski': { headTilt: 0.075, headLook: 0.16, torsoSway: 0.072, torsoLean: -0.015, chestBreath: 0.020, armAsymmetry: 0.055 },
  sztaplar_szalony: { headTilt: -0.045, headLook: 0.075, torsoSway: 0.032, torsoLean: -0.105, chestBreath: 0.050, armAsymmetry: -0.085 },
  krol_leto: { headTilt: 0.015, headLook: 0.075, torsoSway: 0.022, torsoLean: -0.085, chestBreath: 0.055, armAsymmetry: -0.085 },
  pan_roman: { headTilt: 0.055, headLook: 0.105, torsoSway: 0.045, torsoLean: 0.005, chestBreath: 0.018, armAsymmetry: -0.025 },
  serwisant: { headTilt: -0.035, headLook: 0.18, torsoSway: 0.020, torsoLean: -0.015, chestBreath: 0.014, armAsymmetry: 0.025 },
  bosman_krakow: { headTilt: -0.005, headLook: 0.060, torsoSway: 0.026, torsoLean: -0.065, chestBreath: 0.045, armAsymmetry: -0.075 },
  zombie_pracownik: { headTilt: 0.145, headLook: 0.105, torsoSway: 0.085, torsoLean: 0.095, chestBreath: 0.030, armAsymmetry: 0.145 },
  sebix_m: { headTilt: 0.055, headLook: 0.115, torsoSway: 0.082, torsoLean: -0.045, chestBreath: 0.030, armAsymmetry: 0.075 },
  mutant_gamma_forklift: { headTilt: 0.085, headLook: 0.095, torsoSway: 0.090, torsoLean: -0.125, chestBreath: 0.065, armAsymmetry: 0.135 },
  radioactive_pip: { headTilt: 0.060, headLook: 0.155, torsoSway: 0.058, torsoLean: 0.045, chestBreath: 0.050, armAsymmetry: 0.045 },
  cyber_salesman: { headTilt: -0.005, headLook: 0.105, torsoSway: 0.018, torsoLean: -0.020, chestBreath: 0.035, armAsymmetry: 0.012 },
  elite_walczak_guard: { headTilt: -0.020, headLook: 0.045, torsoSway: 0.015, torsoLean: -0.070, chestBreath: 0.028, armAsymmetry: -0.095 },
});

const DEFAULT_ENEMY_ROLE_MOTION_ACCENT: EnemyRoleMotionAccent = Object.freeze({
  headTilt: 0,
  headLook: 0.055,
  torsoSway: 0.015,
  torsoLean: -0.01,
  chestBreath: 0.01,
  armAsymmetry: 0,
});

interface RigBones {
  hips: THREE.Bone | null;
  spine: THREE.Bone | null;
  chest: THREE.Bone | null;
  head: THREE.Bone | null;
  neck: THREE.Bone | null;
  leftShoulder: THREE.Bone | null;
  rightShoulder: THREE.Bone | null;
  leftUpperArm: THREE.Bone | null;
  rightUpperArm: THREE.Bone | null;
  leftForearm: THREE.Bone | null;
  rightForearm: THREE.Bone | null;
  leftThigh: THREE.Bone | null;
  rightThigh: THREE.Bone | null;
  leftCalf: THREE.Bone | null;
  rightCalf: THREE.Bone | null;
}

const rigCache = new WeakMap<THREE.Group, RigBones>();
const appliedAnatomy = new WeakSet<THREE.Group>();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const ROTATION_OFFSET = new THREE.Quaternion();
interface AppliedOffset { bone: THREE.Bone; axis: THREE.Vector3; angle: number; }
interface AppliedOffsetBuffer {
  readonly entries: AppliedOffset[];
  used: number;
}
const previousOffsets = new WeakMap<THREE.Group, AppliedOffsetBuffer>();

/** Keep one reusable reversible-offset buffer per rig instead of allocating a
 * new array and one object for every animated joint on every mixer tick. */
function getAppliedOffsetBuffer(root: THREE.Group): AppliedOffsetBuffer {
  let buffer = previousOffsets.get(root);
  if (!buffer) {
    buffer = { entries: [], used: 0 };
    previousOffsets.set(root, buffer);
  }
  buffer.used = 0;
  return buffer;
}


function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function sideMatch(name: string, side: 'left' | 'right'): boolean {
  return name.includes(side) || name.startsWith(side === 'left' ? 'l' : 'r') ||
    name.endsWith(side === 'left' ? 'l' : 'r');
}
function findRigBones(root: THREE.Group): RigBones {
  const cached = rigCache.get(root);
  if (cached) return cached;
  const all: THREE.Bone[] = [];
  root.traverse((node) => { if (node instanceof THREE.Bone) all.push(node); });
  const entries = all.map((bone) => ({ bone, name: normalize(bone.name) }));
  const first = (match: (name: string) => boolean): THREE.Bone | null =>
    entries.find((entry) => match(entry.name))?.bone || null;
  const side = (which: 'left' | 'right', kind: 'shoulder' | 'upperArm' | 'forearm' | 'thigh' | 'calf'): THREE.Bone | null =>
    entries.find(({ name }) => sideMatch(name, which) && (
      kind === 'shoulder'
        ? name.includes('shoulder') || name.includes('clavicle')
        : kind === 'upperArm'
          ? name.includes('upperarm') || (name.includes('arm') && !name.includes('lower') && !name.includes('fore') && !name.includes('hand'))
          : kind === 'forearm'
            ? name.includes('forearm') || name.includes('lowerarm')
            : kind === 'thigh'
              ? name.includes('thigh') || name.includes('upleg') || name.includes('upperleg')
              : name.includes('calf') || name.includes('lowerleg') || name.includes('shin')
    ))?.bone || null;
  const spine = first((name) => name.includes('spine') && !name.includes('spine2') && !name.includes('spine3')) ||
    first((name) => name.includes('pelvis') || name === 'hips' || name.endsWith('hips'));
  const chest = first((name) => name.includes('spine3') || name.includes('spine2') ||
    name.includes('upperchest') || name === 'chest');
  const bones: RigBones = {
    hips: first((name) => name.includes('pelvis') || name === 'hips' || name.endsWith('hips')),
    spine,
    chest,
    head: first((name) => name === 'head' || name.endsWith('head')),
    neck: first((name) => name.includes('neck')),
    leftShoulder: side('left', 'shoulder'),
    rightShoulder: side('right', 'shoulder'),
    leftUpperArm: side('left', 'upperArm'),
    rightUpperArm: side('right', 'upperArm'),
    leftForearm: side('left', 'forearm'),
    rightForearm: side('right', 'forearm'),
    leftThigh: side('left', 'thigh'),
    rightThigh: side('right', 'thigh'),
    leftCalf: side('left', 'calf'),
    rightCalf: side('right', 'calf'),
  };
  rigCache.set(root, bones);
  return bones;
}

function multiplyBoneScale(
  bone: THREE.Bone | null,
  x: number,
  y = 1,
  z = x,
): void {
  if (!bone) return;
  bone.scale.x *= x;
  bone.scale.y *= y;
  bone.scale.z *= z;
}

/** Apply a once-only role anatomy pass to the cloned enemy skeleton. */
export function applyEnemyRoleAnatomy(root: THREE.Group, type: EnemyType): boolean {
  if (appliedAnatomy.has(root)) return false;
  appliedAnatomy.add(root);
  const profile = ANATOMY[type];
  if (!profile) return false;
  const bones = findRigBones(root);
  multiplyBoneScale(bones.spine, profile.torsoWidth, 1, profile.torsoDepth);
  if (bones.chest !== bones.spine) multiplyBoneScale(bones.chest, profile.torsoWidth, 1, profile.torsoDepth);
  multiplyBoneScale(bones.leftShoulder, profile.shoulderWidth);
  multiplyBoneScale(bones.rightShoulder, profile.shoulderWidth);
  multiplyBoneScale(bones.leftUpperArm, profile.armBuild * (profile.leftArmScale ?? 1), 1, profile.armBuild);
  multiplyBoneScale(bones.rightUpperArm, profile.armBuild * (profile.rightArmScale ?? 1), 1, profile.armBuild);
  multiplyBoneScale(bones.leftThigh, profile.legBuild * (profile.leftLegScale ?? 1));
  multiplyBoneScale(bones.rightThigh, profile.legBuild);
  if (bones.head) bones.head.scale.multiplyScalar(profile.headScale);
  if (bones.neck) bones.neck.scale.multiplyScalar(profile.neckScale ?? 1);
  if (bones.hips && bones.hips !== bones.spine) {
    const hipWidth = profile.hipWidth ?? 1;
    multiplyBoneScale(bones.hips, hipWidth, 1, hipWidth);
  }
  multiplyBoneScale(bones.leftForearm, profile.forearmBuild ?? 1);
  multiplyBoneScale(bones.rightForearm, profile.forearmBuild ?? 1);
  multiplyBoneScale(bones.leftCalf, profile.calfBuild ?? 1);
  multiplyBoneScale(bones.rightCalf, profile.calfBuild ?? 1);
  root.updateMatrixWorld(true);
  return true;
}

function rotate(
  bone: THREE.Bone | null,
  axis: THREE.Vector3,
  angle: number,
  record?: AppliedOffsetBuffer,
): void {
  if (!bone || !Number.isFinite(angle) || Math.abs(angle) < 1e-5) return;
  ROTATION_OFFSET.setFromAxisAngle(axis, angle);
  bone.quaternion.multiply(ROTATION_OFFSET).normalize();
  if (!record) return;

  const index = record.used++;
  let offset = record.entries[index];
  if (!offset) {
    offset = { bone, axis, angle };
    record.entries.push(offset);
  } else {
    offset.bone = bone;
    offset.axis = axis;
    offset.angle = angle;
  }
}

/**
 * Remove only the exact local offsets applied by the previous role-motion tick.
 * This is called before AnimationMixer.update so bones absent from a source clip
 * cannot accumulate procedural rotation over time.
 */
export function clearEnemyRoleSecondaryMotion(root: THREE.Group): void {
  const offsets = previousOffsets.get(root);
  if (!offsets || offsets.used === 0) return;
  for (let i = offsets.used - 1; i >= 0; i--) {
    const offset = offsets.entries[i];
    rotate(offset.bone, offset.axis, -offset.angle);
  }
  // Retain the buffer and its entries for the next animation tick. WeakMap
  // ownership still lets the whole buffer disappear with its rig.
  offsets.used = 0;
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
const stablePhaseCache = new Map<EnemyType, number>();


export interface EnemyCombatMotionEnvelope {
  readonly windup: number;
  readonly impact: number;
  readonly recovery: number;
}

function smoothMotion(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function pulseMotion(progress: number, start: number, peak: number, end: number): number {
  if (progress <= start || progress >= end) return 0;
  if (progress < peak) return smoothMotion((progress - start) / Math.max(0.001, peak - start));
  return 1 - smoothMotion((progress - peak) / Math.max(0.001, end - peak));
}

/** Normalized, clip-time combat envelope: load, contact and follow-through occur in order. */
export function getEnemyCombatMotionEnvelope(
  action: string,
  actionProgress = 0.5,
): EnemyCombatMotionEnvelope {
  const progress = clamp(actionProgress, 0, 1);
  if (action === 'Attack') {
    return {
      windup: pulseMotion(progress, 0.01, 0.22, 0.56),
      impact: pulseMotion(progress, 0.24, 0.47, 0.74),
      recovery: pulseMotion(progress, 0.48, 0.78, 1),
    };
  }
  if (action === 'Hit') {
    return {
      windup: 0,
      impact: 1 - smoothMotion(progress / 0.9),
      recovery: smoothMotion((progress - 0.24) / 0.76),
    };
  }
  return { windup: 0, impact: 0, recovery: 0 };
}

function stablePhase(type: EnemyType): number {
  const cached = stablePhaseCache.get(type);
  if (cached !== undefined) return cached;
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) | 0;
  const phase = ((hash >>> 0) % 997) / 997 * Math.PI * 2;
  stablePhaseCache.set(type, phase);
  return phase;
}

/**
 * Adds a small, non-accumulating secondary pose after the authored mixer update.
 * The next AnimationMixer tick restores its clip pose before this offset is applied.
 * This gives each enemy family a recognisable weight and rhythm without replacing
 * source clips or changing AI movement.
 */
export function applyEnemyRoleSecondaryMotion(
  root: THREE.Group,
  type: EnemyType,
  phase: number,
  deltaSeconds: number,
  speed: number,
  action: string,
  actionProgress = 0.5,
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return phase;
  const bones = findRigBones(root);
  const gaitStyle = ENEMY_VISUAL_PROFILES[type]?.gaitStyle;
  if (!gaitStyle) return phase;
  const gait = ENEMY_GAIT_PRESETS[gaitStyle];
  const isIdle = action === 'Idle';
  const isMoving = action === 'Walk' || action === 'Run' ||
    action === 'WalkBackward' || action === 'StrafeLeft' || action === 'StrafeRight';
  const isAttack = action === 'Attack';
  const isHit = action === 'Hit';
  if (!isIdle && !isMoving && !isAttack && !isHit) return phase;

  const tempo = gait.rate * (isIdle ? 0.42 : isMoving ? clamp(speed / 2.2, 0.62, 1.75) : isAttack ? 1.35 : 1.7);
  const nextPhase = phase + deltaSeconds * tempo * Math.PI * 2;
  const wave = Math.sin(nextPhase);
  const counterWave = Math.sin(nextPhase + Math.PI);
  const activity = isIdle ? 0.13 : isMoving ? clamp(speed / 2.3, 0.22, 1.15) : 1;
  const combatProfile = getEnemyCombatMotionProfile(type);
  const combatEnvelope = getEnemyCombatMotionEnvelope(action, actionProgress);
  const asymmetry = type === 'zombie_pracownik' ? 1 : 0;
  const roleAccent = ENEMY_ROLE_MOTION_ACCENTS[type] ?? DEFAULT_ENEMY_ROLE_MOTION_ACCENT;

  const applied = getAppliedOffsetBuffer(root);

  // The source clip owns the main pose; these small reversible offsets add
  // anticipation, follow-through and a role-specific reaction to confirmed hits.
  if (isAttack) {
    const { windup, impact, recovery } = combatEnvelope;
    // The secondary brace follows the imported/generated Attack clip itself:
    // load first, a crisp contact accent second, then a restrained recovery.
    rotate(bones.spine, AXIS_X,
      -combatProfile.attackWindup * 0.72 * windup +
      combatProfile.attackFollowThrough * 0.16 * impact, applied);
    rotate(bones.chest, AXIS_X,
      combatProfile.attackFollowThrough * (0.42 * impact + 0.18 * recovery), applied);
    rotate(bones.chest, AXIS_Z,
      (impact - recovery * 0.42) * combatProfile.attackFollowThrough * 0.20, applied);
    rotate(bones.rightUpperArm, AXIS_X,
      -combatProfile.attackWindup * 0.64 * windup +
      combatProfile.attackFollowThrough * 0.28 * impact, applied);
    rotate(bones.leftUpperArm, AXIS_X,
      -combatProfile.attackWindup * 0.26 * windup -
      combatProfile.attackFollowThrough * 0.16 * recovery, applied);
    rotate(bones.head, AXIS_Y,
      -(impact - windup * 0.35) * combatProfile.attackWindup * 0.24, applied);
    previousOffsets.set(root, applied);
    return nextPhase;
  }
  if (isHit) {
    const stagger = combatEnvelope.impact;
    const settle = combatEnvelope.recovery;
    rotate(bones.spine, AXIS_X, combatProfile.hitStagger * stagger, applied);
    rotate(bones.spine, AXIS_Z, -combatProfile.hitStagger * 0.14 * settle, applied);
    rotate(bones.chest, AXIS_X, combatProfile.hitStagger * 0.56 * stagger, applied);
    rotate(bones.head, AXIS_Z, -combatProfile.hitStagger * 0.55 * stagger, applied);
    rotate(bones.leftUpperArm, AXIS_Z, -combatProfile.hitStagger * 0.70 * stagger, applied);
    rotate(bones.rightUpperArm, AXIS_Z, combatProfile.hitStagger * 0.70 * stagger, applied);
    previousOffsets.set(root, applied);
    return nextPhase;
  }

  // Pelvis and chest counter-rotation sells weight transfer without changing root physics.
  rotate(bones.hips, AXIS_X, wave * gait.legSwing * 0.018 * activity, applied);
  rotate(bones.hips, AXIS_Z, wave * gait.armSway * 0.08 * activity, applied);
  const forwardLean = gaitStyle === 'heavy' ? -0.055 :
    gaitStyle === 'aggressive' ? -0.075 :
    gaitStyle === 'stalking' ? -0.10 :
    gaitStyle === 'braced' ? -0.048 :
    gaitStyle === 'nervous' ? -0.028 :
    gaitStyle === 'swagger' ? -0.008 :
    gaitStyle === 'uneven' ? 0.035 :
    gaitStyle === 'shambling' ? 0.065 :
    gaitStyle === 'brisk' ? -0.035 :
    gaitStyle === 'robotic' ? -0.018 : -0.012;
  rotate(bones.spine, AXIS_X, forwardLean * activity + wave * 0.012 * activity, applied);
  rotate(bones.chest, AXIS_Y, wave * gait.armSway * 0.075 * activity, applied);
  rotate(bones.chest, AXIS_Z, counterWave * gait.armSway * 0.035 * activity, applied);

  // A head never moves as a rigid statue: it makes small independent corrections.
  const look = Math.sin(nextPhase * 0.31 + stablePhase(type));
  rotate(bones.head, AXIS_Y, look * (isIdle ? 0.026 : 0.014) * (gaitStyle === 'robotic' ? 0.45 : 1), applied);
  rotate(bones.head, AXIS_Z, Math.sin(nextPhase * 0.5) * (gait.headBob * 0.65 + 0.006) * activity, applied);

  // Existing walk clips already swing the limbs. These are deliberately secondary,
  // role-weighted offsets; the zombie's hanging left arm and uneven step remain special.
  const armAmplitude = gait.armSwing * (isIdle ? 0.012 : 0.060) * activity;
  const leftArmBias = asymmetry ? 0.18 : gaitStyle === 'heavy' ? -0.025 : 0;
  const rightArmBias = asymmetry ? -0.08 : gaitStyle === 'aggressive' ? 0.025 : 0;
  rotate(bones.leftUpperArm, AXIS_Z, wave * armAmplitude + leftArmBias * activity, applied);
  rotate(bones.rightUpperArm, AXIS_Z, counterWave * armAmplitude + rightArmBias * activity, applied);

  const legAmplitude = gait.legSwing * (isIdle ? 0.006 : 0.032) * activity;
  rotate(bones.leftThigh, AXIS_X, wave * legAmplitude, applied);
  rotate(bones.rightThigh, AXIS_X, counterWave * legAmplitude * (asymmetry ? 0.56 : 1), applied);

  if (gaitStyle === 'shambling') {
    rotate(bones.spine, AXIS_Z, 0.065 * activity, applied);
    rotate(bones.head, AXIS_Z, 0.038 * activity, applied);
  } else if (gaitStyle === 'limping') {
    rotate(bones.hips, AXIS_Z, 0.048 * wave * activity, applied);
    rotate(bones.rightThigh, AXIS_X, 0.038 * activity, applied);
  } else if (gaitStyle === 'robotic') {
    const servo = Math.sin(nextPhase * 0.5) > 0 ? 1 : -1;
    rotate(bones.chest, AXIS_Y, servo * 0.012 * activity, applied);
    rotate(bones.head, AXIS_Y, -servo * 0.008 * activity, applied);
  } else if (gaitStyle === 'theatrical') {
    rotate(bones.chest, AXIS_Y, Math.sin(nextPhase * 0.4) * 0.045 * activity, applied);
    rotate(bones.head, AXIS_Y, Math.sin(nextPhase * 0.27 + 1) * 0.038 * activity, applied);
  } else if (gaitStyle === 'nervous') {
    const twitch = Math.sin(nextPhase * 2.25 + stablePhase(type));
    rotate(bones.chest, AXIS_Z, twitch * 0.024 * activity, applied);
    rotate(bones.head, AXIS_Y, Math.sin(nextPhase * 1.55) * 0.045 * activity, applied);
    rotate(bones.leftUpperArm, AXIS_X, Math.max(0, twitch) * 0.045 * activity, applied);
  } else if (gaitStyle === 'swagger') {
    const hipRoll = Math.sin(nextPhase * 0.62 + stablePhase(type));
    rotate(bones.hips, AXIS_Z, hipRoll * 0.075 * activity, applied);
    rotate(bones.chest, AXIS_Z, -hipRoll * 0.040 * activity, applied);
    rotate(bones.head, AXIS_Z, 0.022 * activity, applied);
  } else if (gaitStyle === 'braced') {
    rotate(bones.chest, AXIS_X, -0.026 * activity, applied);
    rotate(bones.leftUpperArm, AXIS_Z, -0.028 * activity, applied);
    rotate(bones.rightUpperArm, AXIS_Z, 0.028 * activity, applied);
  } else if (gaitStyle === 'uneven') {
    rotate(bones.hips, AXIS_Z, wave * 0.070 * activity, applied);
    rotate(bones.spine, AXIS_Z, counterWave * 0.035 * activity, applied);
    rotate(bones.leftThigh, AXIS_X, wave * 0.025 * activity, applied);
    rotate(bones.rightThigh, AXIS_X, counterWave * 0.048 * activity, applied);
  } else if (gaitStyle === 'stalking') {
    rotate(bones.spine, AXIS_X, -0.028 * activity, applied);
    rotate(bones.chest, AXIS_X, 0.014 * activity, applied);
    rotate(bones.head, AXIS_X, 0.022 * activity, applied);
  }

  // These offsets are intentionally visible at normal gameplay distance but
  // remain subordinate to authored clips. Different frequencies keep each
  // role from sharing the same mechanical head-bob and shoulder rhythm.
  const roleBreath = Math.sin(nextPhase * 0.47 + stablePhase(type) * 0.35);
  const roleSway = Math.sin(nextPhase * 0.79 + stablePhase(type));
  const roleLook = Math.sin(nextPhase * 0.29 + stablePhase(type) * 1.7);
  const idleWeight = isIdle ? 1 : clamp(speed / 2.3, 0.28, 0.95);
  const roleWeight = isIdle ? 1 : idleWeight;
  rotate(bones.spine, AXIS_X, roleAccent.torsoLean * roleWeight, applied);
  rotate(bones.spine, AXIS_Z, roleSway * roleAccent.torsoSway * roleWeight, applied);
  rotate(bones.chest, AXIS_X, roleBreath * roleAccent.chestBreath * (0.55 + activity), applied);
  rotate(bones.head, AXIS_Z, roleAccent.headTilt * roleWeight +
    roleSway * roleAccent.headTilt * 0.20 * roleWeight, applied);
  rotate(bones.head, AXIS_Y, roleLook * roleAccent.headLook * roleWeight, applied);
  rotate(bones.leftUpperArm, AXIS_Z, roleAccent.armAsymmetry * roleWeight, applied);
  rotate(bones.rightUpperArm, AXIS_Z, -roleAccent.armAsymmetry * 0.42 * roleWeight, applied);

  previousOffsets.set(root, applied);
  return nextPhase;
}

/** Exposed profile data makes the intended silhouette differences directly testable. */
export function getEnemyAnatomyProfile(type: EnemyType): Readonly<AnatomyProfile> | null {
  return ANATOMY[type] || null;
}
