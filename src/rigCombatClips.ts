import * as THREE from 'three';
import type { EnemyType } from './types.ts';

export type RigCombatStyle = 'tool-melee' | 'heavy-melee' | 'ranged' | 'vehicle' | 'none';

interface HumanoidBones {
  pelvis?: THREE.Bone;
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  head?: THREE.Bone;
  leftUpperArm?: THREE.Bone;
  rightUpperArm?: THREE.Bone;
  leftLowerArm?: THREE.Bone;
  rightLowerArm?: THREE.Bone;
  leftThigh?: THREE.Bone;
  rightThigh?: THREE.Bone;
  leftCalf?: THREE.Bone;
  rightCalf?: THREE.Bone;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const combatClipCache = new Map<string, readonly THREE.AnimationClip[]>();

export interface RigCombatMotionProfile {
  /** Animation-only impact strength. This never changes enemy damage or HP. */
  readonly power: number;
  /** How far the actor loads its weight before the contact frame. */
  readonly windup: number;
  /** Local torso rotation that makes the attack read as a full-body action. */
  readonly torsoTwist: number;
  /** Short head dip/anticipation in radians. */
  readonly headDip: number;
  /** Dominant side: -1 = left, 1 = right. */
  readonly leadSide: -1 | 1;
  /** Large/heavy roles use both arms for the main attack. */
  readonly twoHanded: boolean;
  /** Visible flinch intensity, independent of actual damage and stun duration. */
  readonly stagger: number;
}

/**
 * Animation-only combat signatures. Each humanoid enemy has a deliberately
 * different rhythm/leading side so attacks are not just recoloured copies.
 * Values affect authored poses only; AI, hitboxes, damage and cooldowns stay intact.
 */
export const RIG_COMBAT_MOTION_PROFILES: Readonly<Partial<Record<EnemyType, RigCombatMotionProfile>>> = Object.freeze({
  customer: { power:1.10, windup:1.22, torsoTwist:0.30, headDip:0.14, leadSide:1, twoHanded:true, stagger:1.08 },
  architect: { power:0.76, windup:0.92, torsoTwist:0.34, headDip:0.06, leadSide:-1, twoHanded:false, stagger:0.72 },
  inspector: { power:0.88, windup:1.04, torsoTwist:0.16, headDip:0.05, leadSide:1, twoHanded:false, stagger:0.74 },
  kurier: { power:1.00, windup:0.82, torsoTwist:0.23, headDip:0.07, leadSide:1, twoHanded:false, stagger:0.86 },
  handlowiec: { power:0.91, windup:1.18, torsoTwist:0.30, headDip:0.08, leadSide:-1, twoHanded:false, stagger:0.78 },
  monter: { power:1.10, windup:1.08, torsoTwist:0.13, headDip:0.12, leadSide:1, twoHanded:true, stagger:0.92 },
  'przedstawiciel_włoski': { power:0.86, windup:1.26, torsoTwist:0.38, headDip:0.05, leadSide:-1, twoHanded:false, stagger:0.76 },
  sztaplar_szalony: { power:1.23, windup:1.24, torsoTwist:0.18, headDip:0.16, leadSide:1, twoHanded:true, stagger:1.12 },
  krol_leto: { power:1.28, windup:1.22, torsoTwist:0.16, headDip:0.15, leadSide:1, twoHanded:true, stagger:0.72 },
  pan_roman: { power:1.02, windup:0.94, torsoTwist:0.26, headDip:0.10, leadSide:-1, twoHanded:false, stagger:0.90 },
  serwisant: { power:0.82, windup:0.88, torsoTwist:0.13, headDip:0.04, leadSide:1, twoHanded:false, stagger:0.66 },
  bosman_krakow: { power:1.12, windup:1.02, torsoTwist:0.21, headDip:0.10, leadSide:-1, twoHanded:false, stagger:0.74 },
  zombie_pracownik: { power:1.08, windup:0.72, torsoTwist:0.22, headDip:0.18, leadSide:-1, twoHanded:true, stagger:1.26 },
  sebix_m: { power:1.20, windup:1.08, torsoTwist:0.35, headDip:0.13, leadSide:1, twoHanded:false, stagger:1.08 },
  mutant_gamma_forklift: { power:1.32, windup:1.20, torsoTwist:0.12, headDip:0.17, leadSide:1, twoHanded:true, stagger:0.84 },
  radioactive_pip: { power:0.94, windup:1.04, torsoTwist:0.11, headDip:0.06, leadSide:-1, twoHanded:false, stagger:0.86 },
  cyber_salesman: { power:0.90, windup:0.82, torsoTwist:0.08, headDip:0.03, leadSide:1, twoHanded:false, stagger:0.48 },
  elite_walczak_guard: { power:1.16, windup:0.98, torsoTwist:0.17, headDip:0.08, leadSide:-1, twoHanded:false, stagger:0.76 },
  walczak: { power:1.30, windup:1.18, torsoTwist:0.14, headDip:0.18, leadSide:1, twoHanded:true, stagger:0.70 },
});

const DEFAULT_RIG_COMBAT_MOTION_PROFILE: RigCombatMotionProfile = Object.freeze({
  power:1, windup:1, torsoTwist:0.18, headDip:0.08, leadSide:1, twoHanded:true, stagger:1,
});

export function getRigCombatMotionProfile(enemyType?: EnemyType): Readonly<RigCombatMotionProfile> {
  return (enemyType && RIG_COMBAT_MOTION_PROFILES[enemyType]) || DEFAULT_RIG_COMBAT_MOTION_PROFILE;
}

function normalizeBoneName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sideMatches(name: string, side: 'left' | 'right'): boolean {
  const token = side === 'left' ? 'left' : 'right';
  const short = side === 'left' ? 'l' : 'r';
  return name.includes(token) || name.startsWith(short) || name.endsWith(short);
}

function findSideBone(
  bones: readonly THREE.Bone[],
  side: 'left' | 'right',
  kind: 'upperArm' | 'lowerArm' | 'thigh' | 'calf',
): THREE.Bone | undefined {
  return bones.find((bone) => {
    const name = normalizeBoneName(bone.name);
    if (!sideMatches(name, side)) return false;
    if (kind === 'upperArm') return name.includes('upperarm') || (name.includes('arm') && !name.includes('fore') && !name.includes('lower'));
    if (kind === 'lowerArm') return name.includes('forearm') || name.includes('lowerarm');
    if (kind === 'thigh') return name.includes('thigh') || name.includes('upleg') || name.includes('upperleg');
    return (name.includes('calf') || name.includes('lowerleg') || name.endsWith('leg')) &&
      !name.includes('upper') && !name.includes('thigh') && !name.includes('upleg') && !name.includes('foot');
  });
}

function collectHumanoidBones(root: THREE.Object3D): { all: THREE.Bone[]; slots: HumanoidBones } {
  const all: THREE.Bone[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Bone) all.push(object);
  });
  const normalized = all.map((bone) => ({ bone, name: normalizeBoneName(bone.name) }));
  const first = (predicate: (name: string) => boolean) => normalized.find(({ name }) => predicate(name))?.bone;

  const slots: HumanoidBones = {
    pelvis: first((name) => name === 'hips' || name.endsWith('hips') || name.includes('pelvis')),
    spine: first((name) => name.includes('spine') && !name.includes('spine2') && !name.includes('spine3')),
    chest: first((name) => name.includes('spine2') || name.includes('spine3') || name.includes('chest') || name.includes('upperchest')),
    head: first((name) => name === 'head' || name.endsWith('head')),
    leftUpperArm: findSideBone(all, 'left', 'upperArm'),
    rightUpperArm: findSideBone(all, 'right', 'upperArm'),
    leftLowerArm: findSideBone(all, 'left', 'lowerArm'),
    rightLowerArm: findSideBone(all, 'right', 'lowerArm'),
    leftThigh: findSideBone(all, 'left', 'thigh'),
    rightThigh: findSideBone(all, 'right', 'thigh'),
    leftCalf: findSideBone(all, 'left', 'calf'),
    rightCalf: findSideBone(all, 'right', 'calf'),
  };
  return { all, slots };
}

function skeletonSignature(bones: readonly THREE.Bone[], style: RigCombatStyle): string {
  return style + '|' + bones.map((bone) => {
    const q = bone.quaternion;
    return bone.name + ':' + q.x.toFixed(3) + ',' + q.y.toFixed(3) + ',' + q.z.toFixed(3) + ',' + q.w.toFixed(3);
  }).join('|');
}

/**
 * Build reusable combat and airborne clips for a rig whose source pack only
 * contains locomotion, hit and death clips. Clips are authored against the
 * imported skeleton's rest pose, cached per rig signature and never modify
 * physics, damage, hitboxes or model assets.
 */
export function createRigCombatClips(
  root: THREE.Object3D,
  style: RigCombatStyle = 'tool-melee',
  enemyType?: EnemyType,
): readonly THREE.AnimationClip[] {
  if (style === 'vehicle' || style === 'none') return [];
  const { all, slots } = collectHumanoidBones(root);
  if (all.length < 4) return [];

  const key = skeletonSignature(all, style) + '|' + (enemyType ?? 'generic');
  const motion = getRigCombatMotionProfile(enemyType);
  const cached = combatClipCache.get(key);
  if (cached) return cached;

  const createClip = (
    name: string,
    duration: number,
    author: (add: (bone: THREE.Bone | undefined, axis: THREE.Vector3, times: number[], angles: number[]) => void) => void,
  ): THREE.AnimationClip | null => {
    const tracks: THREE.KeyframeTrack[] = [];
    const add = (bone: THREE.Bone | undefined, axis: THREE.Vector3, times: number[], angles: number[]) => {
      if (!bone || times.length !== angles.length || times.length < 2) return;
      const rest = bone.quaternion.clone();
      const values: number[] = [];
      for (const angle of angles) {
        const frame = rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).normalize();
        values.push(frame.x, frame.y, frame.z, frame.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(bone.name + '.quaternion', times, values));
    };
    author(add);
    return tracks.length ? new THREE.AnimationClip(name, duration, tracks) : null;
  };

  const clips: THREE.AnimationClip[] = [];
  const push = (clip: THREE.AnimationClip | null) => { if (clip) clips.push(clip); };

  const attackTimes = [0, 0.09, 0.20, 0.32, 0.46];
  push(createClip('Attack', 0.46, (add) => {
    const side = motion.leadSide;
    const power = motion.power;
    const load = motion.windup;
    const twist = motion.torsoTwist;
    const torsoBone = slots.spine || slots.chest;
    const chestTwist = slots.chest && slots.chest !== torsoBone ? slots.chest : undefined;
    add(slots.pelvis, AXIS_Y, attackTimes, [0, -side * twist * 0.18 * load, side * twist * 0.65, side * twist * 0.22, 0]);
    add(torsoBone, AXIS_X, attackTimes, [0, -0.10 * load, 0.22 * power, 0.08 * power, 0]);
    add(chestTwist, AXIS_Y, attackTimes, [0, -side * twist * 0.28, side * twist, side * twist * 0.30, 0]);
    add(slots.head, AXIS_X, attackTimes, [0, -motion.headDip * load, motion.headDip * 0.45, -motion.headDip * 0.12, 0]);

    if (style === 'heavy-melee') {
      if (motion.twoHanded) {
        const pairedPower = power * 0.94;
        add(slots.leftUpperArm, AXIS_Z, attackTimes, [0, -0.22 * load, -0.94 * pairedPower, -0.44 * pairedPower, 0]);
        add(slots.rightUpperArm, AXIS_Z, attackTimes, [0, 0.22 * load, 0.94 * power, 0.44 * power, 0]);
        add(slots.leftLowerArm, AXIS_X, attackTimes, [0, -0.10 * load, -0.76 * power, -0.18 * power, 0]);
        add(slots.rightLowerArm, AXIS_X, attackTimes, [0, -0.10 * load, -0.76 * power, -0.18 * power, 0]);
      } else {
        const leadUpper = side < 0 ? slots.leftUpperArm : slots.rightUpperArm;
        const supportUpper = side < 0 ? slots.rightUpperArm : slots.leftUpperArm;
        const leadLower = side < 0 ? slots.leftLowerArm : slots.rightLowerArm;
        const supportLower = side < 0 ? slots.rightLowerArm : slots.leftLowerArm;
        add(leadUpper, AXIS_Z, attackTimes, [0, side * 0.20 * load, side * 0.94 * power, side * 0.30 * power, 0]);
        add(leadLower, AXIS_X, attackTimes, [0, -0.10 * load, -0.70 * power, -0.16 * power, 0]);
        add(supportUpper, AXIS_Z, attackTimes, [0, -side * 0.16 * load, -side * 0.30 * power, -side * 0.10 * power, 0]);
        add(supportLower, AXIS_X, attackTimes, [0, 0.04, -0.18 * power, -0.04, 0]);
      }
      add(slots.leftThigh, AXIS_X, attackTimes, [0, 0.04 * load, -0.10 * power, 0.02, 0]);
      add(slots.rightThigh, AXIS_X, attackTimes, [0, 0.04 * load, -0.10 * power, 0.02, 0]);
    } else if (style === 'ranged') {
      const leadUpper = side < 0 ? slots.leftUpperArm : slots.rightUpperArm;
      const supportUpper = side < 0 ? slots.rightUpperArm : slots.leftUpperArm;
      const leadLower = side < 0 ? slots.leftLowerArm : slots.rightLowerArm;
      add(leadUpper, AXIS_Z, attackTimes, [0, side * 0.08 * load, side * 0.62 * power, side * 0.16 * power, 0]);
      add(leadLower, AXIS_X, attackTimes, [0, -0.06 * load, -0.46 * power, -0.08 * power, 0]);
      add(supportUpper, AXIS_Z, attackTimes, [0, -side * 0.04, -side * 0.18 * power, -side * 0.03, 0]);
      add(slots.head, AXIS_X, attackTimes, [0, -motion.headDip * 0.3, motion.headDip * 0.62, 0.01, 0]);
    } else {
      const leadUpper = side < 0 ? slots.leftUpperArm : slots.rightUpperArm;
      const supportUpper = side < 0 ? slots.rightUpperArm : slots.leftUpperArm;
      const leadLower = side < 0 ? slots.leftLowerArm : slots.rightLowerArm;
      const supportLower = side < 0 ? slots.rightLowerArm : slots.leftLowerArm;
      add(leadUpper, AXIS_Z, attackTimes, [0, side * 0.12 * load, side * 1.02 * power, side * 0.26 * power, 0]);
      add(leadLower, AXIS_X, attackTimes, [0, -0.12 * load, -0.86 * power, -0.12 * power, 0]);
      add(supportUpper, AXIS_Z, attackTimes, [0, -side * 0.08 * load, -side * 0.24 * power, -side * 0.04 * power, 0]);
      add(supportLower, AXIS_X, attackTimes, [0, -0.02, -0.16 * power, 0, 0]);
    }
  }));

  const specialTimes = [0, 0.12, 0.28, 0.52, 0.72];
  push(createClip('Special', 0.72, (add) => {
    const side = motion.leadSide;
    const power = motion.power * 1.08;
    const twist = motion.torsoTwist * 1.12;
    const torsoBone = slots.spine || slots.chest;
    const chestTwist = slots.chest && slots.chest !== torsoBone ? slots.chest : undefined;
    add(slots.pelvis, AXIS_Y, specialTimes, [0, -side * twist * 0.42, side * twist * 1.10, side * twist * 0.40, 0]);
    add(torsoBone, AXIS_X, specialTimes, [0, -0.16 * motion.windup, 0.30 * power, 0.10 * power, 0]);
    add(chestTwist, AXIS_Y, specialTimes, [0, -side * twist * 0.35, side * twist, side * twist * 0.42, 0]);
    add(slots.leftUpperArm, AXIS_Z, specialTimes, [0, -0.24 * motion.windup, -1.18 * power, -0.56 * power, 0]);
    add(slots.rightUpperArm, AXIS_Z, specialTimes, [0, 0.24 * motion.windup, 1.18 * power, 0.56 * power, 0]);
    add(slots.leftLowerArm, AXIS_X, specialTimes, [0, 0.10, -0.82 * power, -0.18 * power, 0]);
    add(slots.rightLowerArm, AXIS_X, specialTimes, [0, -0.10, -0.82 * power, -0.18 * power, 0]);
    add(slots.head, AXIS_X, specialTimes, [0, -motion.headDip, 0.12 * power, 0.04, 0]);
  }));

  const hitTimes = [0, 0.055, 0.15, 0.32];
  push(createClip('Hit', 0.32, (add) => {
    const side = motion.leadSide;
    const stagger = motion.stagger;
    const torsoBone = slots.spine || slots.chest;
    const chestTwist = slots.chest && slots.chest !== torsoBone ? slots.chest : undefined;
    add(slots.pelvis, AXIS_Y, hitTimes, [0, side * 0.12 * stagger, -side * 0.06 * stagger, 0]);
    add(torsoBone, AXIS_X, hitTimes, [0, -0.34 * stagger, 0.12 * stagger, 0]);
    add(chestTwist, AXIS_Y, hitTimes, [0, -side * 0.15 * stagger, side * 0.04 * stagger, 0]);
    add(slots.chest, AXIS_Z, hitTimes, [0, 0.08 * stagger, -0.03 * stagger, 0]);
    add(slots.head, AXIS_X, hitTimes, [0, 0.16 * stagger, -0.06 * stagger, 0]);
    const leftFlinch = side < 0 ? 1 : 0.72;
    const rightFlinch = side > 0 ? 1 : 0.72;
    add(slots.leftUpperArm, AXIS_Z, hitTimes, [0, -0.48 * stagger * leftFlinch, -0.14 * stagger * leftFlinch, 0]);
    add(slots.rightUpperArm, AXIS_Z, hitTimes, [0, 0.48 * stagger * rightFlinch, 0.14 * stagger * rightFlinch, 0]);
    add(slots.leftLowerArm, AXIS_X, hitTimes, [0, 0.16 * stagger, 0.04 * stagger, 0]);
    add(slots.rightLowerArm, AXIS_X, hitTimes, [0, -0.16 * stagger, -0.04 * stagger, 0]);
    add(slots.leftThigh, AXIS_X, hitTimes, [0, 0.12 * stagger, 0.03 * stagger, 0]);
    add(slots.rightThigh, AXIS_X, hitTimes, [0, 0.12 * stagger, 0.03 * stagger, 0]);
  }));

    const jumpTimes = [0, 0.08, 0.24, 0.44, 0.62];
  push(createClip('Jump', 0.62, (add) => {
    add(slots.pelvis, AXIS_X, jumpTimes, [0, -0.08, 0.02, 0.08, 0]);
    add(slots.spine || slots.chest, AXIS_X, jumpTimes, [0, -0.10, -0.14, 0.04, 0]);
    add(slots.leftUpperArm, AXIS_Z, jumpTimes, [0, -0.18, -0.58, -0.42, -0.24]);
    add(slots.rightUpperArm, AXIS_Z, jumpTimes, [0, 0.18, 0.58, 0.42, 0.24]);
    add(slots.leftThigh, AXIS_X, jumpTimes, [0, -0.06, -0.46, -0.28, -0.18]);
    add(slots.rightThigh, AXIS_X, jumpTimes, [0, -0.06, -0.42, -0.26, -0.16]);
    add(slots.leftCalf, AXIS_X, jumpTimes, [0, 0.04, 0.24, 0.12, 0.08]);
    add(slots.rightCalf, AXIS_X, jumpTimes, [0, 0.04, 0.22, 0.11, 0.07]);
  }));

  const fallTimes = [0, 0.30, 0.60];
  push(createClip('Fall', 0.60, (add) => {
    add(slots.spine || slots.chest, AXIS_X, fallTimes, [0, 0.08, 0]);
    add(slots.leftUpperArm, AXIS_Z, fallTimes, [0, -0.42, 0]);
    add(slots.rightUpperArm, AXIS_Z, fallTimes, [0, 0.42, 0]);
    add(slots.leftThigh, AXIS_X, fallTimes, [0, -0.18, 0]);
    add(slots.rightThigh, AXIS_X, fallTimes, [0, -0.16, 0]);
  }));

  const landTimes = [0, 0.07, 0.18, 0.34, 0.42];
  push(createClip('Land', 0.42, (add) => {
    add(slots.pelvis, AXIS_X, landTimes, [0, 0.12, 0.22, -0.04, 0]);
    add(slots.spine || slots.chest, AXIS_X, landTimes, [0, -0.24, -0.36, 0.06, 0]);
    add(slots.leftUpperArm, AXIS_Z, landTimes, [0, -0.16, -0.34, -0.08, 0]);
    add(slots.rightUpperArm, AXIS_Z, landTimes, [0, 0.16, 0.34, 0.08, 0]);
    add(slots.leftThigh, AXIS_X, landTimes, [0, 0.12, 0.36, 0.04, 0]);
    add(slots.rightThigh, AXIS_X, landTimes, [0, 0.12, 0.32, 0.04, 0]);
    add(slots.leftCalf, AXIS_X, landTimes, [0, -0.08, -0.18, -0.02, 0]);
    add(slots.rightCalf, AXIS_X, landTimes, [0, -0.08, -0.16, -0.02, 0]);
  }));

  const result = Object.freeze(clips);
  combatClipCache.set(key, result);
  if (combatClipCache.size > 96) combatClipCache.delete(combatClipCache.keys().next().value as string);
  return result;
}
