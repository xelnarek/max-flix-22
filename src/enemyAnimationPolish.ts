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
  customer: { torsoWidth:1.08, torsoDepth:1.08, shoulderWidth:1.04, headScale:1.04, armBuild:1.02, legBuild:.98 },
  architect: { torsoWidth:.91, torsoDepth:.94, shoulderWidth:.88, headScale:1.02, armBuild:.94, legBuild:1.02 },
  inspector: { torsoWidth:1.08, torsoDepth:1.04, shoulderWidth:1.12, headScale:1.00, armBuild:1.06, legBuild:1.02 },
  kurier: { torsoWidth:.96, torsoDepth:.94, shoulderWidth:.96, headScale:.98, armBuild:.98, legBuild:1.04 },
  handlowiec: { torsoWidth:.91, torsoDepth:.93, shoulderWidth:.91, headScale:1.02, armBuild:.94, legBuild:1.00 },
  monter: { torsoWidth:1.10, torsoDepth:1.06, shoulderWidth:1.13, headScale:1.01, armBuild:1.08, legBuild:1.04 },
  'przedstawiciel_włoski': { torsoWidth:.93, torsoDepth:.93, shoulderWidth:.92, headScale:1.02, armBuild:.96, legBuild:1.00 },
  sztaplar_szalony: { torsoWidth:1.18, torsoDepth:1.12, shoulderWidth:1.20, headScale:.98, armBuild:1.12, legBuild:1.08 },
  krol_leto: { torsoWidth:1.22, torsoDepth:1.13, shoulderWidth:1.25, headScale:1.09, armBuild:1.16, legBuild:1.12 },
  pan_roman: { torsoWidth:1.13, torsoDepth:1.08, shoulderWidth:1.10, headScale:1.04, armBuild:1.06, legBuild:1.02 },
  serwisant: { torsoWidth:.98, torsoDepth:.97, shoulderWidth:.99, headScale:1.00, armBuild:1.00, legBuild:1.00 },
  bosman_krakow: { torsoWidth:1.23, torsoDepth:1.10, shoulderWidth:1.24, headScale:1.04, armBuild:1.13, legBuild:1.09 },
  zombie_pracownik: { torsoWidth:1.00, torsoDepth:1.04, shoulderWidth:1.00, headScale:1.03, armBuild:1.04, legBuild:.98, leftArmScale:.84, rightArmScale:1.12, leftLegScale:.93 },
  sebix_m: { torsoWidth:1.16, torsoDepth:1.08, shoulderWidth:1.17, headScale:1.00, armBuild:1.10, legBuild:1.05 },
  mutant_gamma_forklift: { torsoWidth:1.30, torsoDepth:1.18, shoulderWidth:1.32, headScale:1.08, armBuild:1.22, legBuild:1.16 },
  radioactive_pip: { torsoWidth:1.11, torsoDepth:1.14, shoulderWidth:1.10, headScale:1.02, armBuild:1.05, legBuild:1.03 },
  cyber_salesman: { torsoWidth:1.08, torsoDepth:1.00, shoulderWidth:1.11, headScale:1.02, armBuild:1.08, legBuild:1.04 },
  elite_walczak_guard: { torsoWidth:1.20, torsoDepth:1.12, shoulderWidth:1.24, headScale:1.00, armBuild:1.18, legBuild:1.10 },
  walczak: { torsoWidth:1.31, torsoDepth:1.20, shoulderWidth:1.34, headScale:1.12, armBuild:1.26, legBuild:1.18 },
});

interface RigBones {
  hips: THREE.Bone | null;
  spine: THREE.Bone | null;
  chest: THREE.Bone | null;
  head: THREE.Bone | null;
  leftShoulder: THREE.Bone | null;
  rightShoulder: THREE.Bone | null;
  leftUpperArm: THREE.Bone | null;
  rightUpperArm: THREE.Bone | null;
  leftThigh: THREE.Bone | null;
  rightThigh: THREE.Bone | null;
}

const rigCache = new WeakMap<THREE.Group, RigBones>();
const appliedAnatomy = new WeakSet<THREE.Group>();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const ROTATION_OFFSET = new THREE.Quaternion();
interface AppliedOffset { bone: THREE.Bone; axis: THREE.Vector3; angle: number; }
const previousOffsets = new WeakMap<THREE.Group, AppliedOffset[]>();


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
  const side = (which: 'left' | 'right', kind: 'shoulder' | 'upperArm' | 'thigh'): THREE.Bone | null =>
    entries.find(({ name }) => sideMatch(name, which) && (
      kind === 'shoulder'
        ? name.includes('shoulder') || name.includes('clavicle')
        : kind === 'upperArm'
          ? name.includes('upperarm') || (name.includes('arm') && !name.includes('lower') && !name.includes('fore') && !name.includes('hand'))
          : name.includes('thigh') || name.includes('upleg') || name.includes('upperleg')
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
    leftShoulder: side('left', 'shoulder'),
    rightShoulder: side('right', 'shoulder'),
    leftUpperArm: side('left', 'upperArm'),
    rightUpperArm: side('right', 'upperArm'),
    leftThigh: side('left', 'thigh'),
    rightThigh: side('right', 'thigh'),
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
  root.updateMatrixWorld(true);
  return true;
}

function rotate(
  bone: THREE.Bone | null,
  axis: THREE.Vector3,
  angle: number,
  record?: AppliedOffset[],
): void {
  if (!bone || !Number.isFinite(angle) || Math.abs(angle) < 1e-5) return;
  ROTATION_OFFSET.setFromAxisAngle(axis, angle);
  bone.quaternion.multiply(ROTATION_OFFSET).normalize();
  record?.push({ bone, axis, angle });
}

/**
 * Remove only the exact local offsets applied by the previous role-motion tick.
 * This is called before AnimationMixer.update so bones absent from a source clip
 * cannot accumulate procedural rotation over time.
 */
export function clearEnemyRoleSecondaryMotion(root: THREE.Group): void {
  const offsets = previousOffsets.get(root);
  if (!offsets) return;
  for (let i = offsets.length - 1; i >= 0; i--) {
    const offset = offsets[i];
    rotate(offset.bone, offset.axis, -offset.angle);
  }
  previousOffsets.delete(root);
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
function stablePhase(type: EnemyType): number {
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) | 0;
  return ((hash >>> 0) % 997) / 997 * Math.PI * 2;
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
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return phase;
  const bones = findRigBones(root);
  const gaitStyle = ENEMY_VISUAL_PROFILES[type]?.gaitStyle;
  if (!gaitStyle) return phase;
  const gait = ENEMY_GAIT_PRESETS[gaitStyle];
  const isIdle = action === 'Idle';
  const isMoving = action === 'Walk' || action === 'Run' ||
    action === 'WalkBackward' || action === 'StrafeLeft' || action === 'StrafeRight';
  if (!isIdle && !isMoving) return phase;

  const tempo = gait.rate * (isIdle ? 0.42 : clamp(speed / 2.2, 0.62, 1.75));
  const nextPhase = phase + deltaSeconds * tempo * Math.PI * 2;
  const wave = Math.sin(nextPhase);
  const counterWave = Math.sin(nextPhase + Math.PI);
  const activity = isIdle ? 0.13 : clamp(speed / 2.3, 0.22, 1.15);
  const asymmetry = type === 'zombie_pracownik' ? 1 : 0;

  const applied: AppliedOffset[] = [];
  // Pelvis and chest counter-rotation sells weight transfer without changing root physics.
  rotate(bones.hips, AXIS_X, wave * gait.legSwing * 0.018 * activity);
  rotate(bones.hips, AXIS_Z, wave * gait.armSway * 0.08 * activity);
  const forwardLean = gaitStyle === 'heavy' ? -0.055 :
    gaitStyle === 'aggressive' ? -0.075 :
    gaitStyle === 'shambling' ? 0.065 :
    gaitStyle === 'brisk' ? -0.035 :
    gaitStyle === 'robotic' ? -0.018 : -0.012;
  rotate(bones.spine, AXIS_X, forwardLean * activity + wave * 0.012 * activity);
  rotate(bones.chest, AXIS_Y, wave * gait.armSway * 0.075 * activity);
  rotate(bones.chest, AXIS_Z, counterWave * gait.armSway * 0.035 * activity);

  // A head never moves as a rigid statue: it makes small independent corrections.
  const look = Math.sin(nextPhase * 0.31 + stablePhase(type));
  rotate(bones.head, AXIS_Y, look * (isIdle ? 0.026 : 0.014) * (gaitStyle === 'robotic' ? 0.45 : 1));
  rotate(bones.head, AXIS_Z, Math.sin(nextPhase * 0.5) * (gait.headBob * 0.65 + 0.006) * activity);

  // Existing walk clips already swing the limbs. These are deliberately secondary,
  // role-weighted offsets; the zombie's hanging left arm and uneven step remain special.
  const armAmplitude = gait.armSwing * (isIdle ? 0.012 : 0.060) * activity;
  const leftArmBias = asymmetry ? 0.18 : gaitStyle === 'heavy' ? -0.025 : 0;
  const rightArmBias = asymmetry ? -0.08 : gaitStyle === 'aggressive' ? 0.025 : 0;
  rotate(bones.leftUpperArm, AXIS_Z, wave * armAmplitude + leftArmBias * activity);
  rotate(bones.rightUpperArm, AXIS_Z, counterWave * armAmplitude + rightArmBias * activity);

  const legAmplitude = gait.legSwing * (isIdle ? 0.006 : 0.032) * activity;
  rotate(bones.leftThigh, AXIS_X, wave * legAmplitude);
  rotate(bones.rightThigh, AXIS_X, counterWave * legAmplitude * (asymmetry ? 0.56 : 1));

  if (gaitStyle === 'shambling') {
    rotate(bones.spine, AXIS_Z, 0.065 * activity);
    rotate(bones.head, AXIS_Z, 0.038 * activity);
  } else if (gaitStyle === 'limping') {
    rotate(bones.hips, AXIS_Z, 0.048 * wave * activity);
    rotate(bones.rightThigh, AXIS_X, 0.038 * activity);
  } else if (gaitStyle === 'robotic') {
    const servo = Math.sin(nextPhase * 0.5) > 0 ? 1 : -1;
    rotate(bones.chest, AXIS_Y, servo * 0.012 * activity);
    rotate(bones.head, AXIS_Y, -servo * 0.008 * activity);
  } else if (gaitStyle === 'theatrical') {
    rotate(bones.chest, AXIS_Y, Math.sin(nextPhase * 0.4) * 0.045 * activity);
    rotate(bones.head, AXIS_Y, Math.sin(nextPhase * 0.27 + 1) * 0.038 * activity);
  }
  previousOffsets.set(root, applied);
  return nextPhase;
}

/** Exposed profile data makes the intended silhouette differences directly testable. */
export function getEnemyAnatomyProfile(type: EnemyType): Readonly<AnatomyProfile> | null {
  return ANATOMY[type] || null;
}
