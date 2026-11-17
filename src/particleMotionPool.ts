import * as THREE from 'three';

/** Preallocated CPU-side motion data paired with one pooled particle mesh. */
export interface ParticleMotionState {
  mesh: THREE.Mesh | null;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  hasGravity: boolean;
  baseScale: number;
  rotVel: THREE.Vector3;
  hasRotation: boolean;
}

/**
 * Fixed-capacity state pool for short-lived combat particles.
 * All records and their vectors are allocated during engine construction;
 * acquire/release only mutate existing objects and never grow a collection.
 */
export class ParticleMotionStatePool {
  private readonly free: ParticleMotionState[] = [];
  private readonly owned = new WeakSet<ParticleMotionState>();
  private readonly available = new WeakSet<ParticleMotionState>();

  constructor(private readonly maxStates = 75) {
    if (!Number.isInteger(maxStates) || maxStates < 1) {
      throw new RangeError('ParticleMotionStatePool capacity must be a positive integer.');
    }

    for (let i = 0; i < maxStates; i++) {
      const state: ParticleMotionState = {
        mesh: null,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        gravity: 0,
        hasGravity: false,
        baseScale: 1,
        rotVel: new THREE.Vector3(),
        hasRotation: false,
      };
      this.free.push(state);
      this.owned.add(state);
      this.available.add(state);
    }
  }

  get capacity(): number {
    return this.maxStates;
  }

  get availableCount(): number {
    return this.free.length;
  }

  acquire(): ParticleMotionState | null {
    const state = this.free.pop();
    if (!state) return null;
    this.available.delete(state);
    return state;
  }

  release(state: ParticleMotionState): boolean {
    if (!this.owned.has(state) || this.available.has(state)) return false;

    state.mesh = null;
    state.vel.set(0, 0, 0);
    state.life = 0;
    state.maxLife = 1;
    state.gravity = 0;
    state.hasGravity = false;
    state.baseScale = 1;
    state.rotVel.set(0, 0, 0);
    state.hasRotation = false;

    this.available.add(state);
    this.free.push(state);
    return true;
  }
}
