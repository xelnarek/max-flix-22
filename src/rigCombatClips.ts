import * as THREE from 'three';

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
export function createRigCombatClips(root: THREE.Object3D, style: RigCombatStyle = 'tool-melee'): readonly THREE.AnimationClip[] {
  if (style === 'vehicle' || style === 'none') return [];
  const { all, slots } = collectHumanoidBones(root);
  if (all.length < 4) return [];

  const key = skeletonSignature(all, style);
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
    if (style === 'heavy-melee') {
      add(slots.pelvis, AXIS_Y, attackTimes, [0, -0.04, 0.08, 0.02, 0]);
      add(slots.spine || slots.chest, AXIS_X, attackTimes, [0, -0.10, 0.22, 0.08, 0]);
      add(slots.leftUpperArm, AXIS_Z, attackTimes, [0, -0.22, -0.94, -0.44, 0]);
      add(slots.rightUpperArm, AXIS_Z, attackTimes, [0, 0.22, 0.94, 0.44, 0]);
      add(slots.leftLowerArm, AXIS_X, attackTimes, [0, -0.10, -0.76, -0.18, 0]);
      add(slots.rightLowerArm, AXIS_X, attackTimes, [0, -0.10, -0.76, -0.18, 0]);
      add(slots.leftThigh, AXIS_X, attackTimes, [0, 0.04, -0.10, 0.02, 0]);
      add(slots.rightThigh, AXIS_X, attackTimes, [0, 0.04, -0.10, 0.02, 0]);
    } else if (style === 'ranged') {
      add(slots.spine || slots.chest, AXIS_X, attackTimes, [0, -0.03, 0.10, 0.02, 0]);
      add(slots.rightUpperArm, AXIS_Z, attackTimes, [0, 0.08, 0.62, 0.16, 0]);
      add(slots.rightLowerArm, AXIS_X, attackTimes, [0, -0.06, -0.46, -0.08, 0]);
      add(slots.leftUpperArm, AXIS_Z, attackTimes, [0, -0.04, -0.18, -0.03, 0]);
      add(slots.head, AXIS_X, attackTimes, [0, -0.02, 0.05, 0.01, 0]);
    } else {
      add(slots.pelvis, AXIS_Y, attackTimes, [0, -0.03, 0.08, -0.02, 0]);
      add(slots.spine || slots.chest, AXIS_X, attackTimes, [0, -0.06, 0.16, 0.03, 0]);
      add(slots.rightUpperArm, AXIS_Z, attackTimes, [0, 0.12, 1.02, 0.26, 0]);
      add(slots.rightLowerArm, AXIS_X, attackTimes, [0, -0.12, -0.86, -0.12, 0]);
      add(slots.leftUpperArm, AXIS_Z, attackTimes, [0, -0.08, -0.24, -0.04, 0]);
      add(slots.head, AXIS_X, attackTimes, [0, -0.03, 0.08, 0.01, 0]);
    }
  }));

  const specialTimes = [0, 0.12, 0.28, 0.52, 0.72];
  push(createClip('Special', 0.72, (add) => {
    add(slots.pelvis, AXIS_Y, specialTimes, [0, -0.08, 0.14, 0.06, 0]);
    add(slots.spine || slots.chest, AXIS_X, specialTimes, [0, -0.16, 0.30, 0.10, 0]);
    add(slots.leftUpperArm, AXIS_Z, specialTimes, [0, -0.24, -1.18, -0.56, 0]);
    add(slots.rightUpperArm, AXIS_Z, specialTimes, [0, 0.24, 1.18, 0.56, 0]);
    add(slots.leftLowerArm, AXIS_X, specialTimes, [0, 0.10, -0.82, -0.18, 0]);
    add(slots.rightLowerArm, AXIS_X, specialTimes, [0, -0.10, -0.82, -0.18, 0]);
    add(slots.head, AXIS_X, specialTimes, [0, -0.06, 0.12, 0.04, 0]);
  }));

  const hitTimes = [0, 0.055, 0.15, 0.32];
  push(createClip('Hit', 0.32, (add) => {
    add(slots.pelvis, AXIS_Y, hitTimes, [0, 0.12, -0.06, 0]);
    add(slots.spine || slots.chest, AXIS_X, hitTimes, [0, -0.34, 0.12, 0]);
    add(slots.chest, AXIS_Z, hitTimes, [0, 0.08, -0.03, 0]);
    add(slots.head, AXIS_X, hitTimes, [0, 0.16, -0.06, 0]);
    add(slots.leftUpperArm, AXIS_Z, hitTimes, [0, -0.48, -0.14, 0]);
    add(slots.rightUpperArm, AXIS_Z, hitTimes, [0, 0.48, 0.14, 0]);
    add(slots.leftLowerArm, AXIS_X, hitTimes, [0, 0.16, 0.04, 0]);
    add(slots.rightLowerArm, AXIS_X, hitTimes, [0, -0.16, -0.04, 0]);
    add(slots.leftThigh, AXIS_X, hitTimes, [0, 0.12, 0.03, 0]);
    add(slots.rightThigh, AXIS_X, hitTimes, [0, 0.12, 0.03, 0]);
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
