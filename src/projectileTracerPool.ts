import * as THREE from 'three';
import type { SurvivalDamageWeaponId } from './survivalDamageStats.ts';
import type { SurvivalFirearmArchetype } from './survivalFirearms.ts';
import type { CharacterId } from './types.ts';

export interface TracerStyle {
  readonly color: number;
  readonly width: number;
  readonly lifeSeconds: number;
  readonly minLength: number;
  readonly opacity: number;
  readonly coreOpacity: number;
  readonly coreWhiteMix: number;
}

interface TracerSlot {
  readonly group: THREE.Group;
  readonly outerMat: THREE.MeshBasicMaterial;
  readonly innerMat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  baseWidth: number;
  length: number;
  baseOpacity: number;
  baseCoreOpacity: number;
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const DIR_SCRATCH = new THREE.Vector3();
const MID_SCRATCH = new THREE.Vector3();
const TAIL_SCRATCH = new THREE.Vector3();
const QUAT_SCRATCH = new THREE.Quaternion();
const COLOR_WHITE = new THREE.Color(0xffffff);
const COLOR_CORE_SCRATCH = new THREE.Color();

const FIREARM_TRACER_PRESETS: Readonly<Record<SurvivalFirearmArchetype, Omit<TracerStyle, 'color'>>> = {
  pistol: { width: 0.064, lifeSeconds: 0.19, minLength: 0.64, opacity: 0.90, coreOpacity: 0.98, coreWhiteMix: 0.56 },
  smg: { width: 0.056, lifeSeconds: 0.17, minLength: 0.66, opacity: 0.88, coreOpacity: 0.96, coreWhiteMix: 0.54 },
  rifle: { width: 0.070, lifeSeconds: 0.24, minLength: 0.98, opacity: 0.92, coreOpacity: 1.0, coreWhiteMix: 0.60 },
  shotgun: { width: 0.060, lifeSeconds: 0.20, minLength: 0.72, opacity: 0.90, coreOpacity: 0.97, coreWhiteMix: 0.56 },
  'heavy-rifle': { width: 0.106, lifeSeconds: 0.34, minLength: 1.38, opacity: 0.96, coreOpacity: 1.0, coreWhiteMix: 0.66 },
  minigun: { width: 0.054, lifeSeconds: 0.17, minLength: 0.80, opacity: 0.88, coreOpacity: 0.98, coreWhiteMix: 0.60 },
  rocket: { width: 0.135, lifeSeconds: 0.38, minLength: 0.92, opacity: 0.88, coreOpacity: 0.94, coreWhiteMix: 0.58 },
  grenade: { width: 0.096, lifeSeconds: 0.30, minLength: 0.64, opacity: 0.84, coreOpacity: 0.90, coreWhiteMix: 0.46 },
  flame: { width: 0.165, lifeSeconds: 0.24, minLength: 0.58, opacity: 0.78, coreOpacity: 0.88, coreWhiteMix: 0.50 },
  plasma: { width: 0.125, lifeSeconds: 0.28, minLength: 0.90, opacity: 0.95, coreOpacity: 1.0, coreWhiteMix: 0.68 },
  gauss: { width: 0.132, lifeSeconds: 0.48, minLength: 1.90, opacity: 1.0, coreOpacity: 1.0, coreWhiteMix: 0.84 },
};

const WEAPON_TRACER_PRESETS: Readonly<Record<SurvivalDamageWeaponId, Omit<TracerStyle, 'color'>>> = {
  pallet_cannon: { width: 0.088, lifeSeconds: 0.24, minLength: 0.66, opacity: 0.82, coreOpacity: 0.90, coreWhiteMix: 0.45 },
  diamond_saw: { width: 0.082, lifeSeconds: 0.22, minLength: 0.74, opacity: 0.86, coreOpacity: 0.94, coreWhiteMix: 0.52 },
  glue_mine: { width: 0.072, lifeSeconds: 0.20, minLength: 0.46, opacity: 0.76, coreOpacity: 0.84, coreWhiteMix: 0.40 },
  kfc_bomber: { width: 0.084, lifeSeconds: 0.22, minLength: 0.54, opacity: 0.80, coreOpacity: 0.88, coreWhiteMix: 0.48 },
  piorun_drone: { width: 0.064, lifeSeconds: 0.20, minLength: 0.58, opacity: 0.84, coreOpacity: 0.94, coreWhiteMix: 0.58 },
  orbit_blades: { width: 0.068, lifeSeconds: 0.16, minLength: 0.48, opacity: 0.80, coreOpacity: 0.90, coreWhiteMix: 0.50 },
  forklift_horn: { width: 0.08, lifeSeconds: 0.18, minLength: 0.5, opacity: 0.78, coreOpacity: 0.88, coreWhiteMix: 0.5 },
  calacatta_shards: { width: 0.068, lifeSeconds: 0.20, minLength: 0.68, opacity: 0.86, coreOpacity: 0.96, coreWhiteMix: 0.62 },
  forklift_bolter: { width: 0.062, lifeSeconds: 0.20, minLength: 0.86, opacity: 0.90, coreOpacity: 0.98, coreWhiteMix: 0.58 },
  scanner_pulse: { width: 0.074, lifeSeconds: 0.24, minLength: 0.78, opacity: 0.88, coreOpacity: 0.96, coreWhiteMix: 0.64 },
  steam_bomb: { width: 0.095, lifeSeconds: 0.24, minLength: 0.52, opacity: 0.76, coreOpacity: 0.86, coreWhiteMix: 0.54 },
  wz_boomerang: { width: 0.072, lifeSeconds: 0.22, minLength: 0.64, opacity: 0.84, coreOpacity: 0.92, coreWhiteMix: 0.50 },
};

export function getFirearmTracerStyle(archetype: SurvivalFirearmArchetype, color: number): TracerStyle {
  return { color, ...FIREARM_TRACER_PRESETS[archetype] };
}

export function getSurvivalWeaponTracerStyle(weaponId: SurvivalDamageWeaponId, color: number): TracerStyle {
  return { color, ...WEAPON_TRACER_PRESETS[weaponId] };
}

export function getOperatorTracerStyle(charId: CharacterId, isThirdCombo: boolean): TracerStyle {
  const palette: Record<CharacterId, number> = {
    marcin: 0x38bdf8,
    grzesiek: 0x22c55e,
    dawid: 0xe0f2fe,
    mateusz: 0xa78bfa,
    piotr: 0xf87171,
  };
  const color = palette[charId] ?? 0xfbbf24;
  return {
    color,
    width: isThirdCombo ? 0.10 : 0.072,
    lifeSeconds: isThirdCombo ? 0.26 : 0.20,
    minLength: isThirdCombo ? 0.82 : 0.64,
    opacity: isThirdCombo ? 0.92 : 0.82,
    coreOpacity: 0.96,
    coreWhiteMix: isThirdCombo ? 0.62 : 0.48,
  };
}

/**
 * Pooled zero-allocation continuous ribbon/beam tracer system for projectiles.
 * Every slot combines a translucent additive sheath with an incandescent inner
 * core filament so shot streaks stay as unmistakable as the projectile itself.
 */
export class ProjectileTracerPool {
  private readonly outerGeo: THREE.CylinderGeometry;
  private readonly innerGeo: THREE.CylinderGeometry;
  private readonly slots: TracerSlot[] = [];
  private readonly activeSlots: TracerSlot[] = [];
  private readonly freeSlots: TracerSlot[] = [];
  private readonly maxTracers: number;
  private evictCursor = 0;
  private disposed = false;

  constructor(maxTracers = 340) {
    if (!Number.isInteger(maxTracers) || maxTracers < 1) {
      throw new RangeError('ProjectileTracerPool maxTracers must be a positive integer.');
    }
    this.maxTracers = maxTracers;
    // Open-ended sheath + solid inner core aligned along local +Y of unit length 1.
    this.outerGeo = new THREE.CylinderGeometry(0.42, 1.0, 1.0, 6, 1, true);
    this.innerGeo = new THREE.CylinderGeometry(0.24, 0.68, 1.0, 5, 1, false);
  }

  get activeCount(): number {
    return this.activeSlots.length;
  }

  get allocatedCount(): number {
    return this.slots.length;
  }

  private acquireSlot(): TracerSlot {
    let slot = this.freeSlots.pop();
    if (slot) return slot;

    if (this.slots.length < this.maxTracers) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      outerMat.userData.bloomEmitter = true;
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      innerMat.userData.bloomEmitter = true;
      const outerMesh = new THREE.Mesh(this.outerGeo, outerMat);
      outerMesh.castShadow = false;
      outerMesh.receiveShadow = false;
      outerMesh.renderOrder = 3;

      const innerMesh = new THREE.Mesh(this.innerGeo, innerMat);
      innerMesh.castShadow = false;
      innerMesh.receiveShadow = false;
      innerMesh.renderOrder = 4;

      const group = new THREE.Group();
      group.name = 'projectile-tracer-segment';
      group.frustumCulled = false;
      group.add(outerMesh, innerMesh);

      slot = {
        group,
        outerMat,
        innerMat,
        active: false,
        life: 0,
        maxLife: 0.16,
        baseWidth: 0.06,
        length: 1,
        baseOpacity: 0.85,
        baseCoreOpacity: 0.95,
      };
      this.slots.push(slot);
      return slot;
    }

    // Ring eviction keeps intense minigun / shotgun bursts crisp without stalls.
    const index = this.evictCursor % this.slots.length;
    this.evictCursor = (this.evictCursor + 1) % this.slots.length;
    slot = this.slots[index];
    slot.group.removeFromParent();
    const activeIdx = this.activeSlots.indexOf(slot);
    if (activeIdx >= 0) {
      const last = this.activeSlots.length - 1;
      if (activeIdx !== last) this.activeSlots[activeIdx] = this.activeSlots[last];
      this.activeSlots.pop();
    }
    slot.active = false;
    return slot;
  }

  emitSegment(
    parent: THREE.Object3D,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    style: TracerStyle,
  ): boolean {
    if (this.disposed) return false;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const dist = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(dist) || dist < 0.0008) return false;

    const invDist = 1 / dist;
    DIR_SCRATCH.set(dx * invDist, dy * invDist, dz * invDist);
    const segmentLength = Math.max(dist, style.minLength);
    // Keep leading tip anchored at (x1, y1, z1) and extend tail slightly backward
    // when frame displacement is shorter than minLength so high-FPS play never hides streaks.
    TAIL_SCRATCH.set(
      x1 - DIR_SCRATCH.x * segmentLength,
      y1 - DIR_SCRATCH.y * segmentLength,
      z1 - DIR_SCRATCH.z * segmentLength,
    );
    MID_SCRATCH.set(
      (TAIL_SCRATCH.x + x1) * 0.5,
      (TAIL_SCRATCH.y + y1) * 0.5,
      (TAIL_SCRATCH.z + z1) * 0.5,
    );

    if (DIR_SCRATCH.y < -0.9999) {
      QUAT_SCRATCH.set(1, 0, 0, 0);
    } else {
      QUAT_SCRATCH.setFromUnitVectors(UP_AXIS, DIR_SCRATCH);
    }

    const slot = this.acquireSlot();
    slot.active = true;
    slot.life = style.lifeSeconds;
    slot.maxLife = style.lifeSeconds;
    slot.baseWidth = style.width;
    slot.length = segmentLength;
    slot.baseOpacity = style.opacity;
    slot.baseCoreOpacity = style.coreOpacity;

    slot.outerMat.color.setHex(style.color);
    slot.outerMat.opacity = style.opacity;

    COLOR_CORE_SCRATCH.setHex(style.color).lerp(COLOR_WHITE, style.coreWhiteMix);
    slot.innerMat.color.copy(COLOR_CORE_SCRATCH);
    slot.innerMat.opacity = style.coreOpacity;

    slot.group.position.copy(MID_SCRATCH);
    slot.group.quaternion.copy(QUAT_SCRATCH);
    slot.group.scale.set(style.width, segmentLength, style.width);
    slot.group.visible = true;
    if (slot.group.parent !== parent) parent.add(slot.group);

    this.activeSlots.push(slot);
    return true;
  }

  update(dt: number): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;

    for (let i = this.activeSlots.length - 1; i >= 0; i--) {
      const slot = this.activeSlots[i];
      slot.life -= dt;
      if (slot.life <= 0) {
        slot.active = false;
        slot.group.visible = false;
        slot.group.removeFromParent();
        const last = this.activeSlots.length - 1;
        if (i !== last) this.activeSlots[i] = this.activeSlots[last];
        this.activeSlots.pop();
        this.freeSlots.push(slot);
        continue;
      }

      const ratio = THREE.MathUtils.clamp(slot.life / Math.max(0.001, slot.maxLife), 0, 1);
      const radialScale = slot.baseWidth * (0.34 + 0.66 * ratio);
      slot.group.scale.set(radialScale, slot.length, radialScale);
      slot.outerMat.opacity = slot.baseOpacity * ratio * ratio;
      slot.innerMat.opacity = slot.baseCoreOpacity * ratio;
    }
  }

  clear(): void {
    for (let i = 0; i < this.activeSlots.length; i++) {
      const slot = this.activeSlots[i];
      slot.active = false;
      slot.group.visible = false;
      slot.group.removeFromParent();
      this.freeSlots.push(slot);
    }
    this.activeSlots.length = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    for (const slot of this.slots) {
      slot.group.removeFromParent();
      slot.outerMat.dispose();
      slot.innerMat.dispose();
    }
    this.slots.length = 0;
    this.freeSlots.length = 0;
    this.outerGeo.dispose();
    this.innerGeo.dispose();
  }
}
