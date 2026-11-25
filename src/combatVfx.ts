import * as THREE from 'three';

let cachedSoftGlowTexture: THREE.CanvasTexture | null = null;
let cachedMuzzleStarTexture: THREE.CanvasTexture | null = null;
let cachedShockwaveRingTexture: THREE.CanvasTexture | null = null;
let cachedScorchMarkTexture: THREE.CanvasTexture | null = null;
let cachedHorizontalQuadGeometry: THREE.PlaneGeometry | null = null;
let cachedBillboardQuadGeometry: THREE.PlaneGeometry | null = null;

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function finalizeVfxTexture(canvas: HTMLCanvasElement, name: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.userData.sharedCombatVfxTexture = true;
  texture.needsUpdate = true;
  return texture;
}

/** Smooth radial glow for title embers, lamp haloes, energy cores and explosion fireballs. */
export function getSoftGlowTexture(): THREE.CanvasTexture | null {
  if (cachedSoftGlowTexture) return cachedSoftGlowTexture;
  const surface = createCanvas(128);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const half = canvas.width * 0.5;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.18, 'rgba(255, 250, 236, 0.92)');
  gradient.addColorStop(0.42, 'rgba(255, 224, 178, 0.42)');
  gradient.addColorStop(0.74, 'rgba(255, 190, 130, 0.10)');
  gradient.addColorStop(1.0, 'rgba(255, 180, 120, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cachedSoftGlowTexture = finalizeVfxTexture(canvas, 'combat-vfx-soft-glow');
  return cachedSoftGlowTexture;
}

/** Crisp 4-point muzzle star flare with hot incandescent center. */
export function getMuzzleStarTexture(): THREE.CanvasTexture | null {
  if (cachedMuzzleStarTexture) return cachedMuzzleStarTexture;
  const surface = createCanvas(128);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const half = canvas.width * 0.5;

  const core = ctx.createRadialGradient(half, half, 0, half, half, half * 0.62);
  core.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  core.addColorStop(0.24, 'rgba(255, 248, 220, 0.88)');
  core.addColorStop(0.60, 'rgba(255, 210, 140, 0.22)');
  core.addColorStop(1.0, 'rgba(255, 180, 90, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Horizontal & vertical star spikes
  for (let pass = 0; pass < 2; pass++) {
    ctx.save();
    ctx.translate(half, half);
    if (pass === 1) ctx.rotate(Math.PI * 0.5);
    const spike = ctx.createLinearGradient(-half, 0, half, 0);
    spike.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    spike.addColorStop(0.32, 'rgba(255, 238, 200, 0.36)');
    spike.addColorStop(0.5, 'rgba(255, 255, 255, 0.96)');
    spike.addColorStop(0.68, 'rgba(255, 238, 200, 0.36)');
    spike.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = spike;
    ctx.beginPath();
    ctx.moveTo(-half * 0.96, 0);
    ctx.quadraticCurveTo(0, -half * 0.16, half * 0.96, 0);
    ctx.quadraticCurveTo(0, half * 0.16, -half * 0.96, 0);
    ctx.fill();
    ctx.restore();
  }

  cachedMuzzleStarTexture = finalizeVfxTexture(canvas, 'combat-vfx-muzzle-star');
  return cachedMuzzleStarTexture;
}

/** Crisp expanding energy/pressure shockwave ring texture. */
export function getShockwaveRingTexture(): THREE.CanvasTexture | null {
  if (cachedShockwaveRingTexture) return cachedShockwaveRingTexture;
  const surface = createCanvas(128);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const half = canvas.width * 0.5;
  const ring = ctx.createRadialGradient(half, half, half * 0.35, half, half, half);
  ring.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  ring.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
  ring.addColorStop(0.68, 'rgba(255, 255, 255, 0.62)');
  ring.addColorStop(0.84, 'rgba(255, 255, 255, 0.96)');
  ring.addColorStop(0.94, 'rgba(255, 255, 255, 0.35)');
  ring.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = ring;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cachedShockwaveRingTexture = finalizeVfxTexture(canvas, 'combat-vfx-shockwave-ring');
  return cachedShockwaveRingTexture;
}

/** Feathered ground blast scorch decal texture (fades cleanly after explosions). */
export function getScorchMarkTexture(): THREE.CanvasTexture | null {
  if (cachedScorchMarkTexture) return cachedScorchMarkTexture;
  const surface = createCanvas(128);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const half = canvas.width * 0.5;
  const soot = ctx.createRadialGradient(half, half, 0, half, half, half);
  soot.addColorStop(0.0, 'rgba(10, 12, 16, 0.88)');
  soot.addColorStop(0.38, 'rgba(16, 18, 24, 0.66)');
  soot.addColorStop(0.70, 'rgba(24, 24, 30, 0.26)');
  soot.addColorStop(1.0, 'rgba(16, 18, 24, 0.0)');
  ctx.fillStyle = soot;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle radial soot streaks for explosive crater texture
  ctx.strokeStyle = 'rgba(12, 14, 18, 0.38)';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.11;
    const inner = half * 0.16;
    const outer = half * (0.64 + (i % 4) * 0.07);
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(angle) * inner, half + Math.sin(angle) * inner);
    ctx.lineTo(half + Math.cos(angle) * outer, half + Math.sin(angle) * outer);
    ctx.stroke();
  }

  cachedScorchMarkTexture = finalizeVfxTexture(canvas, 'combat-vfx-scorch-mark');
  return cachedScorchMarkTexture;
}

export function getHorizontalVfxQuadGeometry(): THREE.PlaneGeometry {
  if (!cachedHorizontalQuadGeometry) {
    cachedHorizontalQuadGeometry = new THREE.PlaneGeometry(1, 1);
    cachedHorizontalQuadGeometry.rotateX(-Math.PI / 2);
  }
  return cachedHorizontalQuadGeometry;
}

export function getBillboardVfxQuadGeometry(): THREE.PlaneGeometry {
  if (!cachedBillboardQuadGeometry) {
    cachedBillboardQuadGeometry = new THREE.PlaneGeometry(1, 1);
  }
  return cachedBillboardQuadGeometry;
}

export function disposeCombatVfxResources(): void {
  cachedSoftGlowTexture?.dispose();
  cachedSoftGlowTexture = null;
  cachedMuzzleStarTexture?.dispose();
  cachedMuzzleStarTexture = null;
  cachedShockwaveRingTexture?.dispose();
  cachedShockwaveRingTexture = null;
  cachedScorchMarkTexture?.dispose();
  cachedScorchMarkTexture = null;
  cachedHorizontalQuadGeometry?.dispose();
  cachedHorizontalQuadGeometry = null;
  cachedBillboardQuadGeometry?.dispose();
  cachedBillboardQuadGeometry = null;
}

/** Detects software WebGL adapters where costly multi-pass bloom should be skipped. */
export function isSoftwareWebGLRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    if (!gl) return false;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rawRenderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return /SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(String(rawRenderer ?? ''));
  } catch {
    return false;
  }
}

interface FlashLightSlot {
  readonly light: THREE.PointLight;
  life: number;
  maxLife: number;
  peakIntensity: number;
}

/**
 * Fixed zero-allocation dynamic PointLight pool for muzzle flashes and explosions.
 * Lights remain attached to a single persistent group so Three.js never triggers
 * shader recompilation when shots fire mid-wave.
 */
export class CombatFlashLightPool {
  readonly group = new THREE.Group();
  private readonly slots: FlashLightSlot[] = [];
  private disposed = false;

  constructor(capacity = 3) {
    const safeCapacity = Math.max(1, Math.min(4, Math.floor(capacity)));
    this.group.name = 'combat-flash-light-pool';
    for (let i = 0; i < safeCapacity; i++) {
      const light = new THREE.PointLight(0xffedd5, 0, 10, 1.8);
      light.castShadow = false;
      this.group.add(light);
      this.slots.push({ light, life: 0, maxLife: 0.1, peakIntensity: 0 });
    }
  }

  get activeCount(): number {
    let count = 0;
    for (const slot of this.slots) {
      if (slot.life > 0 && slot.light.intensity > 0.001) count++;
    }
    return count;
  }

  flash(
    x: number,
    y: number,
    z: number,
    color: number,
    intensity: number,
    distance: number,
    durationSeconds: number,
    adaptiveTier = 0,
  ): boolean {
    if (this.disposed || adaptiveTier >= 2) return false;
    if (!Number.isFinite(x + y + z + intensity + distance + durationSeconds)) return false;

    const maxAllowedSlots = adaptiveTier === 1 ? 1 : this.slots.length;
    let chosen = this.slots[0];
    let lowestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < maxAllowedSlots; i++) {
      const slot = this.slots[i];
      if (slot.life <= 0) {
        chosen = slot;
        break;
      }
      const score = slot.light.intensity;
      if (score < lowestScore) {
        lowestScore = score;
        chosen = slot;
      }
    }

    chosen.light.position.set(x, y, z);
    chosen.light.color.setHex(color);
    chosen.light.distance = THREE.MathUtils.clamp(distance, 2.5, 22);
    chosen.peakIntensity = THREE.MathUtils.clamp(intensity, 0.2, 24);
    chosen.light.intensity = chosen.peakIntensity;
    chosen.maxLife = THREE.MathUtils.clamp(durationSeconds, 0.04, 0.45);
    chosen.life = chosen.maxLife;
    return true;
  }

  update(dt: number): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.life <= 0) {
        if (slot.light.intensity !== 0) slot.light.intensity = 0;
        continue;
      }
      slot.life = Math.max(0, slot.life - dt);
      const ratio = slot.life / Math.max(0.001, slot.maxLife);
      slot.light.intensity = slot.peakIntensity * ratio * ratio;
    }
  }

  clear(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].life = 0;
      this.slots[i].peakIntensity = 0;
      this.slots[i].light.intensity = 0;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    for (const slot of this.slots) {
      slot.light.removeFromParent();
      slot.light.dispose?.();
    }
    this.slots.length = 0;
    this.group.removeFromParent();
  }
}
