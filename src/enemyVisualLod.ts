import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnemyType } from './types.ts';
import { ENEMY_VISUAL_PROFILES, type EnemyVisualCategory } from './enemyVisualProfiles.ts';

export interface EnemyVisualLodPalette {
  readonly body: number;
  readonly trim: number;
  readonly accent: number;
}

export interface EnemyVisualLodThresholds {
  readonly enterProxyDistance: number;
  readonly exitProxyDistance: number;
}

const PALETTES: Readonly<Record<EnemyType, EnemyVisualLodPalette>> = Object.freeze({
  customer: { body: 0xb8b5a7, trim: 0x536474, accent: 0xf3c45c },
  walczak: { body: 0x4a202b, trim: 0x20252d, accent: 0xc74448 },
  forklift: { body: 0xd18b24, trim: 0x273746, accent: 0xf6d35d },
  architect: { body: 0x5d6678, trim: 0x242b39, accent: 0xd3a7d8 },
  inspector: { body: 0xd8c14a, trim: 0x35475a, accent: 0xf2f0d7 },
  agv_robot: { body: 0x516d7a, trim: 0x1b2934, accent: 0x43d6e8 },
  handlowiec: { body: 0x263e69, trim: 0x111c30, accent: 0xd6b878 },
  monter: { body: 0x9a5c31, trim: 0x303b43, accent: 0xe0b45d },
  piorun_dron: { body: 0x34465d, trim: 0x111b28, accent: 0x70e7f4 },
  elite_walczak_guard: { body: 0x596a7a, trim: 0x202a37, accent: 0xe5b75b },
  kurier: { body: 0xc86b32, trim: 0x39485a, accent: 0xf4d7a4 },
  'przedstawiciel_włoski': { body: 0x8e3437, trim: 0x242b39, accent: 0xd9c59a },
  sztaplar_szalony: { body: 0x527247, trim: 0x222c31, accent: 0xe5a642 },
  krol_leto: { body: 0x59406e, trim: 0x1e2331, accent: 0xd9a849 },
  pan_roman: { body: 0x9b6d38, trim: 0x344354, accent: 0xf3c84b },
  serwisant: { body: 0x367b91, trim: 0x243342, accent: 0xe0b34e },
  bosman_krakow: { body: 0x263d59, trim: 0x152231, accent: 0xd5ad5a },
  zombie_pracownik: { body: 0x66744d, trim: 0x343e36, accent: 0xb3d866 },
  pomazaniec: { body: 0x6d4b9b, trim: 0x28233f, accent: 0xf3a6d2 },
  sebix_m: { body: 0x85424a, trim: 0x2b2930, accent: 0xe0b75d },
  mutant_gamma_forklift: { body: 0x526445, trim: 0x252f31, accent: 0xd3db5b },
  radioactive_pip: { body: 0x6d9148, trim: 0x2b3930, accent: 0xc5ec58 },
  cyber_salesman: { body: 0x344e65, trim: 0x1d2936, accent: 0x52d7eb },
});

const geometryCache = new Map<EnemyType, THREE.BufferGeometry>();
const proxyMaterial = new THREE.MeshStandardMaterial({
  name: 'enemy-distance-lod-vertex-palette',
  vertexColors: true,
  roughness: 0.84,
  metalness: 0.06,
});
proxyMaterial.userData.actorLodSharedMaterial = true;

function addColoredPart(
  parts: THREE.BufferGeometry[],
  geometry: THREE.BufferGeometry,
  color: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
  rotation: readonly [number, number, number] = [0, 0, 0],
): void {
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])),
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
  geometry.applyMatrix4(transform);
  const tint = new THREE.Color(color);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index++) {
    const offset = index * 3;
    colors[offset] = tint.r;
    colors[offset + 1] = tint.g;
    colors[offset + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  parts.push(geometry);
}

function createHumanoidGeometry(type: EnemyType, palette: EnemyVisualLodPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const category: EnemyVisualCategory = ENEMY_VISUAL_PROFILES[type].category;
  const heavy = category === 'boss-creature' || type === 'sztaplar_szalony' || type === 'sebix_m';
  const hunched = category === 'undead' || type === 'radioactive_pip' || type === 'mutant_gamma_forklift';
  const width = heavy ? 1.24 : 1;
  const torsoDepth = heavy ? 1.14 : 1;

  addColoredPart(
    parts,
    new THREE.CapsuleGeometry(heavy ? 0.29 : 0.235, heavy ? 0.62 : 0.56, 2, 7),
    palette.body,
    [0, hunched ? 0.91 : 0.98, 0],
    [width, 1, torsoDepth],
    [hunched ? 0.13 : 0, 0, 0],
  );
  addColoredPart(
    parts,
    new THREE.SphereGeometry(0.17, 8, 6),
    palette.body,
    [0, hunched ? 1.48 : 1.52, 0.015],
    [1, 1.06, 0.96],
  );
  addColoredPart(
    parts,
    new THREE.BoxGeometry(0.48, 0.18, 0.115),
    palette.trim,
    [0, 1.06, 0.17],
    [width, 1, 1],
  );

  for (const side of [-1, 1]) {
    addColoredPart(
      parts,
      new THREE.CylinderGeometry(0.075, 0.095, heavy ? 0.48 : 0.43, 6),
      palette.body,
      [side * (heavy ? 0.36 : 0.30), 0.88, 0],
      [1, 1, 1],
      [0, 0, side * 0.10],
    );
    addColoredPart(
      parts,
      new THREE.CylinderGeometry(0.095, 0.12, 0.47, 6),
      palette.trim,
      [side * 0.125, 0.26, 0],
    );
    addColoredPart(
      parts,
      new THREE.BoxGeometry(0.14, 0.075, 0.23),
      palette.trim,
      [side * 0.125, 0.045, 0.035],
    );
  }

  addColoredPart(
    parts,
    new THREE.BoxGeometry(0.18, 0.095, 0.065),
    palette.accent,
    [0, 1.08, 0.235],
  );
  if (heavy) {
    for (const side of [-1, 1]) {
      addColoredPart(
        parts,
        new THREE.SphereGeometry(0.16, 7, 5),
        palette.trim,
        [side * 0.34, 1.20, 0],
        [1.1, 0.72, 1.02],
      );
    }
  }
  if (category === 'undead' || category === 'mutant') {
    addColoredPart(
      parts,
      new THREE.ConeGeometry(0.07, 0.23, 5),
      palette.accent,
      [0.12, 1.25, 0.08],
      [1, 1, 1],
      [0.18, 0.15, -0.3],
    );
  }

  const merged = mergeGeometries(parts, false);
  for (const geometry of parts) geometry.dispose();
  if (!merged) throw new Error('Could not merge enemy distance LOD geometry for ' + type);
  merged.computeBoundingSphere();
  merged.userData.actorLodSharedGeometry = true;
  return merged;
}

function createMachineGeometry(type: EnemyType, palette: EnemyVisualLodPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  addColoredPart(parts, new THREE.BoxGeometry(0.62, 0.56, 0.42), palette.body, [0, 0.78, 0]);
  addColoredPart(parts, new THREE.BoxGeometry(0.43, 0.22, 0.30), palette.trim, [0, 1.16, 0]);
  addColoredPart(parts, new THREE.BoxGeometry(0.18, 0.07, 0.035), palette.accent, [0, 1.18, 0.17]);
  for (const side of [-1, 1]) {
    addColoredPart(parts, new THREE.CylinderGeometry(0.105, 0.105, 0.48, 6), palette.trim, [side * 0.19, 0.31, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  const merged = mergeGeometries(parts, false);
  for (const geometry of parts) geometry.dispose();
  if (!merged) throw new Error('Could not merge machine LOD geometry for ' + type);
  merged.computeBoundingSphere();
  merged.userData.actorLodSharedGeometry = true;
  return merged;
}

function getCachedGeometry(type: EnemyType): THREE.BufferGeometry {
  const cached = geometryCache.get(type);
  if (cached) return cached;
  const palette = PALETTES[type] ?? PALETTES.customer;
  const category = ENEMY_VISUAL_PROFILES[type].category;
  const geometry = category === 'machine'
    ? createMachineGeometry(type, palette)
    : createHumanoidGeometry(type, palette);
  geometryCache.set(type, geometry);
  return geometry;
}

export function getEnemyVisualLodPalette(type: EnemyType): EnemyVisualLodPalette {
  return PALETTES[type] ?? PALETTES.customer;
}

/** Enter the proxy further away than the distance at which it is restored. */
export function getEnemyVisualLodThresholds(isMobile: boolean): EnemyVisualLodThresholds {
  return isMobile
    ? { enterProxyDistance: 25, exitProxyDistance: 19 }
    : { enterProxyDistance: 34, exitProxyDistance: 26 };
}

/**
 * Combat-critical actors retain the full imported rig regardless of distance.
 * Hysteresis prevents a full rig and a proxy from flickering at the threshold.
 */
export function shouldUseEnemyVisualLodProxy(
  distanceSquared: number,
  isMobile: boolean,
  currentlyUsingProxy: boolean,
  combatCritical: boolean,
): boolean {
  if (combatCritical || !Number.isFinite(distanceSquared) || distanceSquared < 0) return false;
  const thresholds = getEnemyVisualLodThresholds(isMobile);
  const threshold = currentlyUsingProxy ? thresholds.exitProxyDistance : thresholds.enterProxyDistance;
  return distanceSquared >= threshold * threshold;
}

/** One draw-call low-poly silhouette; imported rig, role gear and hitboxes remain untouched. */
export function createEnemyVisualLodProxy(type: EnemyType): THREE.Group {
  const root = new THREE.Group();
  root.name = 'enemy-distance-lod-proxy-' + type;
  root.userData.actorLodProxy = true;
  const mesh = new THREE.Mesh(getCachedGeometry(type), proxyMaterial);
  const targetHeight = THREE.MathUtils.clamp(ENEMY_VISUAL_PROFILES[type].targetHeight, 0.9, 2.2);
  mesh.scale.set(1, targetHeight / 1.55, 1);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  mesh.userData.actorLodSharedGeometry = true;
  root.add(mesh);
  root.visible = false;
  return root;
}

/** Small silhouette motion keeps distant crowds from turning into rigid statues. */
export function updateEnemyVisualLodProxy(root: THREE.Group, gaitPhase: number, moving: boolean): void {
  const phase = Number.isFinite(gaitPhase) ? gaitPhase : 0;
  root.position.y = moving ? Math.sin(phase * 2.1) * 0.025 : Math.sin(phase * 0.45) * 0.008;
  root.rotation.z = moving ? Math.sin(phase * 1.05) * 0.018 : Math.sin(phase * 0.25) * 0.004;
}
