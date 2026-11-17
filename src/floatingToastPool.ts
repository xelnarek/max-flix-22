import * as THREE from 'three';

export type FloatingToastType = 'points' | 'vip' | 'easter-egg' | 'damage' | 'perk' | 'combo';

export interface FloatingToastEntry {
  element: HTMLElement;
  worldPos: THREE.Vector3;
  type: FloatingToastType;
  age: number;
  maxAge: number;
}

/**
 * Fixed-capacity pool for damage/score labels.
 * DOM nodes and world-space vectors are created once during UI setup; acquiring,
 * updating and releasing a toast only mutates preallocated entries. When the
 * pool is full, extra labels are dropped rather than growing the DOM or
 * allocating more Three.js objects during a horde.
 */
export class FloatingToastPool {
  readonly active: Array<FloatingToastEntry | undefined>;
  private readonly available: Array<FloatingToastEntry | undefined>;
  private activeEntries = 0;
  private availableEntries: number;
  private disposed = false;

  constructor(container: HTMLElement, capacity = 36) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('FloatingToastPool capacity must be a positive integer.');
    }
    if (!container || typeof container.appendChild !== 'function') {
      throw new TypeError('FloatingToastPool requires a DOM container.');
    }

    this.active = new Array<FloatingToastEntry | undefined>(capacity);
    this.available = new Array<FloatingToastEntry | undefined>(capacity);
    this.availableEntries = capacity;

    for (let i = 0; i < capacity; i++) {
      const element = document.createElement('div');
      element.className = 'floating-score-toast';
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.willChange = 'transform, opacity';
      element.style.pointerEvents = 'none';
      element.style.display = 'none';
      container.appendChild(element);

      this.available[i] = {
        element,
        worldPos: new THREE.Vector3(),
        type: 'points',
        age: 0,
        maxAge: 1,
      };
    }
  }

  get activeCount(): number {
    return this.activeEntries;
  }

  get availableCount(): number {
    return this.availableEntries;
  }

  get capacity(): number {
    return this.active.length;
  }

  acquire(
    text: string,
    x: number,
    y: number,
    z: number,
    type: FloatingToastType,
    duration: number
  ): FloatingToastEntry | null {
    if (this.disposed || this.availableEntries === 0) return null;
    if (![x, y, z, duration].every(Number.isFinite) || duration <= 0) return null;

    const entryIndex = --this.availableEntries;
    const entry = this.available[entryIndex];
    this.available[entryIndex] = undefined;
    if (!entry) return null;

    entry.element.className = `floating-score-toast ${type}`;
    entry.element.textContent = text;
    entry.element.style.display = 'flex';
    entry.element.style.opacity = '1';
    entry.element.style.transform = 'translate3d(-10000px, -10000px, 0px) translate(-50%, -50%)';
    entry.worldPos.set(x, y, z);
    entry.type = type;
    entry.age = 0;
    entry.maxAge = duration;

    this.active[this.activeEntries++] = entry;
    return entry;
  }

  /** Release one active entry and compact the active prefix without splice(). */
  releaseAt(index: number): boolean {
    if (index < 0 || index >= this.activeEntries || this.disposed) return false;
    const entry = this.active[index];
    const lastIndex = --this.activeEntries;
    const lastEntry = this.active[lastIndex];
    if (!entry || !lastEntry) {
      this.activeEntries++;
      return false;
    }

    if (index !== lastIndex) this.active[index] = lastEntry;
    this.active[lastIndex] = undefined;

    entry.element.style.display = 'none';
    entry.element.style.opacity = '0';
    entry.element.textContent = '';
    entry.element.className = 'floating-score-toast';
    entry.worldPos.set(0, 0, 0);
    entry.age = 0;
    entry.maxAge = 1;
    this.available[this.availableEntries++] = entry;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    while (this.activeEntries > 0) this.releaseAt(this.activeEntries - 1);
    this.disposed = true;

    for (let i = 0; i < this.availableEntries; i++) {
      this.available[i]?.element.remove();
      this.available[i] = undefined;
    }
    this.availableEntries = 0;
  }
}
