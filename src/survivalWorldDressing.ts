import * as THREE from 'three';
import type { SurvivalMapId } from './survivalMaps.ts';

export interface SurvivalWorldObstacle {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export interface SurvivalWorldDressingLayout {
  readonly craters: readonly {
    id: string;
    x: number;
    z: number;
    radius: number;
    surface: 'concrete' | 'asphalt' | 'ice';
  }[];
  readonly ufo?: {
    x: number;
    z: number;
    scale: number;
    rotation: number;
    halfWidth: number;
    halfDepth: number;
  };
}

export const SURVIVAL_WORLD_DRESSING_LAYOUT: Readonly<Record<SurvivalMapId, SurvivalWorldDressingLayout>> = Object.freeze({
  warehouse_b4: {
    craters: [{ id: 'b4-west-impact-pit', x: -47, z: -8.4, radius: 2.25, surface: 'concrete' }],
  },
  container_terminal: {
    craters: [{ id: 'port-east-impact-pit', x: 47, z: 9.6, radius: 2.85, surface: 'asphalt' }],
  },
  cold_storage: {
    craters: [{ id: 'cold-service-ice-break', x: 48, z: -15, radius: 2.45, surface: 'ice' }],
  },
  night_sorting: {
    ufo: { x: -48, z: -8.4, scale: 1, rotation: -0.18, halfWidth: 3.75, halfDepth: 3.05 },
    craters: [{ id: 'night-east-impact-pit', x: 44, z: 10.8, radius: 1.95, surface: 'asphalt' }],
  },
});

export function getSurvivalWorldDressingLayout(mapId: SurvivalMapId): SurvivalWorldDressingLayout {
  return SURVIVAL_WORLD_DRESSING_LAYOUT[mapId] ?? SURVIVAL_WORLD_DRESSING_LAYOUT.warehouse_b4;
}

function markOwnedTexture(texture: THREE.Texture): THREE.Texture {
  texture.userData.disposeOnObjectCleanup = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function createUfoHullTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return markOwnedTexture(new THREE.CanvasTexture(canvas)) as THREE.CanvasTexture;

  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#d7ded9');
  gradient.addColorStop(0.43, '#647b80');
  gradient.addColorStop(1, '#1c343e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = 'rgba(14, 30, 38, .64)';
  context.lineWidth = 3;
  for (let y = 18; y < 256; y += 48) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(256, y); context.stroke();
  }
  for (let x = 28; x < 256; x += 64) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 256); context.stroke();
  }
  context.fillStyle = 'rgba(245, 158, 11, .88)';
  for (let x = 5; x < 256; x += 42) {
    context.save(); context.translate(x, 214); context.rotate(-0.72);
    context.fillRect(-9, -5, 18, 10); context.restore();
  }
  for (let index = 0; index < 36; index++) {
    const x = (index * 73 + 19) % 248 + 4;
    const y = (index * 47 + 31) % 248 + 4;
    context.fillStyle = index % 3 === 0 ? 'rgba(20, 35, 42, .38)' : 'rgba(244, 246, 230, .42)';
    context.beginPath(); context.arc(x, y, index % 4 === 0 ? 3.2 : 1.6, 0, Math.PI * 2); context.fill();
  }
  const texture = markOwnedTexture(new THREE.CanvasTexture(canvas)) as THREE.CanvasTexture;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

function createCraterTexture(surface: SurvivalWorldDressingLayout['craters'][number]['surface'] | 'asphalt'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, 256, 256);
    const tint = surface === 'ice' ? '90, 215, 236' : surface === 'asphalt' ? '94, 78, 70' : '100, 92, 78';
    const radial = context.createRadialGradient(128, 128, 26, 128, 128, 126);
    radial.addColorStop(0, 'rgba(3, 8, 15, .96)');
    radial.addColorStop(0.48, 'rgba(12, 18, 26, .92)');
    radial.addColorStop(0.68, 'rgba(' + tint + ', .72)');
    radial.addColorStop(0.82, 'rgba(' + tint + ', .36)');
    radial.addColorStop(1, 'rgba(' + tint + ', 0)');
    context.fillStyle = radial;
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = surface === 'ice' ? 'rgba(190, 247, 255, .62)' : 'rgba(7, 12, 18, .72)';
    context.lineWidth = 4;
    for (let index = 0; index < 9; index++) {
      const angle = index * Math.PI * 2 / 9 + 0.18;
      context.beginPath();
      context.moveTo(128 + Math.cos(angle) * 58, 128 + Math.sin(angle) * 58);
      context.lineTo(128 + Math.cos(angle + 0.08) * (104 + index % 3 * 8), 128 + Math.sin(angle + 0.08) * (104 + index % 3 * 8));
      context.stroke();
    }
  }
  const texture = markOwnedTexture(new THREE.CanvasTexture(canvas)) as THREE.CanvasTexture;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function addUfoDebris(group: THREE.Group, material: THREE.Material): void {
  const debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.34, 0), material, 9);
  const transform = new THREE.Object3D();
  const positions = [
    [-3.6, 0.16, -1.4], [-3.1, 0.20, 1.3], [-2.2, 0.11, 2.9],
    [2.9, 0.14, 2.1], [3.5, 0.13, -0.8], [2.1, 0.16, -3.0],
    [-0.8, 0.10, 3.6], [0.5, 0.12, -3.8], [4.0, 0.11, 1.2],
  ];
  positions.forEach((position, index) => {
    transform.position.set(position[0], position[1], position[2]);
    transform.rotation.set(index * 0.17, index * 0.61, index * 0.29);
    transform.scale.set(0.72 + (index % 3) * 0.22, 0.35 + (index % 2) * 0.18, 0.8 + (index % 4) * 0.12);
    transform.updateMatrix();
    debris.setMatrixAt(index, transform.matrix);
  });
  debris.instanceMatrix.needsUpdate = true;
  debris.castShadow = false;
  debris.receiveShadow = true;
  group.add(debris);
}

function createImpactCrater(
  id: string,
  radius: number,
  surface: SurvivalWorldDressingLayout['craters'][number]['surface'] | 'asphalt',
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'survival-impact-pit-' + id;
  const scorch = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.32, 36),
    new THREE.MeshBasicMaterial({
      map: createCraterTexture(surface), transparent: true, opacity: 0.94,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
  );
  scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.018; scorch.renderOrder = 2;
  group.add(scorch);

  const pitFloor = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.58, 32),
    new THREE.MeshStandardMaterial({
      color: surface === 'ice' ? 0x0a2635 : 0x111820,
      roughness: surface === 'ice' ? 0.24 : 0.96,
      metalness: surface === 'ice' ? 0.18 : 0.02,
      emissive: surface === 'ice' ? 0x063c4d : 0x05080c,
      emissiveIntensity: surface === 'ice' ? 0.18 : 0.08,
    }),
  );
  pitFloor.rotation.x = -Math.PI / 2; pitFloor.position.y = 0.026;
  group.add(pitFloor);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: surface === 'ice' ? 0x8ee8f4 : surface === 'asphalt' ? 0x4e5054 : 0x77736b,
    roughness: surface === 'ice' ? 0.28 : 0.88,
    metalness: surface === 'ice' ? 0.22 : 0.06,
    emissive: surface === 'ice' ? 0x0c5260 : 0x08090a,
    emissiveIntensity: surface === 'ice' ? 0.16 : 0.02,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.76, radius * 0.10, 7, 36), rimMaterial);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.075; rim.scale.z = 0.9;
  group.add(rim);

  const rubbleMaterial = new THREE.MeshStandardMaterial({
    color: surface === 'ice' ? 0x8ddce8 : surface === 'asphalt' ? 0x6a5d54 : 0x77766e,
    roughness: 0.9, metalness: surface === 'ice' ? 0.12 : 0.04,
  });
  const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.16, 0), rubbleMaterial, 12);
  const transform = new THREE.Object3D();
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI * 2 / 12 + 0.13;
    const ring = radius * (0.76 + (index % 3) * 0.055);
    transform.position.set(Math.cos(angle) * ring, 0.05 + (index % 2) * 0.045, Math.sin(angle) * ring);
    transform.rotation.set(index * 0.22, index * 0.58, index * 0.31);
    transform.scale.set(0.8 + (index % 4) * 0.16, 0.55 + (index % 3) * 0.20, 0.9 + (index % 2) * 0.18);
    transform.updateMatrix(); rubble.setMatrixAt(index, transform.matrix);
  }
  rubble.instanceMatrix.needsUpdate = true; rubble.castShadow = false; rubble.receiveShadow = false;
  group.add(rubble);

  if (surface === 'ice') {
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc, roughness: 0.22, metalness: 0.16,
      emissive: 0x0e7490, emissiveIntensity: 0.20,
    });
    const shards = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.62, 5), shardMaterial, 5);
    const transform = new THREE.Object3D();
    for (let index = 0; index < 5; index++) {
      const angle = index * Math.PI * 2 / 5;
      transform.position.set(Math.cos(angle) * radius * 0.93, 0.23, Math.sin(angle) * radius * 0.93);
      transform.rotation.set(0.12, angle, (index - 2) * 0.10);
      transform.scale.set(0.8, 0.85 + (index % 2) * 0.35, 0.8);
      transform.updateMatrix(); shards.setMatrixAt(index, transform.matrix);
    }
    shards.instanceMatrix.needsUpdate = true; shards.castShadow = false;
    group.add(shards);
  }
  return group;
}

function createCrashedUfo(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'survival-crashed-retro-ufo';
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: createUfoHullTexture(), metalness: 0.72, roughness: 0.52,
  });
  const darkHull = new THREE.MeshStandardMaterial({ color: 0x263d47, metalness: 0.76, roughness: 0.48 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb18b4f, metalness: 0.82, roughness: 0.3, emissive: 0x38250a, emissiveIntensity: 0.12 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x173e4d, metalness: 0.44, roughness: 0.18, transparent: true, opacity: 0.86,
    emissive: 0x0b7380, emissiveIntensity: 0.24,
  });
  const alienGlow = new THREE.MeshBasicMaterial({ color: 0x5eead4, toneMapped: false });

  const scorch = new THREE.Mesh(
    new THREE.CircleGeometry(4.9, 40),
    new THREE.MeshBasicMaterial({
      map: createCraterTexture('asphalt'), transparent: true, opacity: 0.96,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
  );
  scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.016; group.add(scorch);

  const saucer = new THREE.Group();
  saucer.name = 'ufo-bent-saucer-hull';
  saucer.rotation.z = -0.14; saucer.rotation.x = 0.045; saucer.position.set(0, 0.42, 0);
  group.add(saucer);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 3.35, 0.56, 32), hullMaterial);
  body.scale.z = 0.86; body.castShadow = false; body.receiveShadow = true; saucer.add(body);
  const underside = new THREE.Mesh(new THREE.CylinderGeometry(2.22, 2.75, 0.34, 28), darkHull);
  underside.position.y = -0.36; underside.scale.z = 0.86; saucer.add(underside);
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(2.98, 0.12, 8, 36), brass);
  outerRim.rotation.x = Math.PI / 2; outerRim.position.y = 0.02; outerRim.scale.z = 0.86; saucer.add(outerRim);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.10, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = 0.34; dome.scale.set(1.1, 0.83, 0.92); saucer.add(dome);
  const domeRim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.075, 7, 24), brass);
  domeRim.rotation.x = Math.PI / 2; domeRim.position.y = 0.37; saucer.add(domeRim);

  const viewports = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 8, 6), alienGlow, 12);
  const viewportTransform = new THREE.Object3D();
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI * 2 / 12;
    viewportTransform.position.set(Math.cos(angle) * 2.72, -0.035, Math.sin(angle) * 2.34);
    viewportTransform.rotation.set(0, -angle, 0);
    viewportTransform.scale.set(1, 0.72, 0.55);
    viewportTransform.updateMatrix(); viewports.setMatrixAt(index, viewportTransform.matrix);
  }
  viewports.instanceMatrix.needsUpdate = true; saucer.add(viewports);

  const strutMaterial = new THREE.MeshStandardMaterial({ color: 0x627780, metalness: 0.78, roughness: 0.48 });
  const strutPositions = [
    { x: -2.05, z: 0.12, length: 0.88, rotation: -0.28 },
    { x: 1.96, z: -0.7, length: 0.56, rotation: 0.48 },
    { x: 0.45, z: 2.25, length: 0.74, rotation: -0.56 },
  ];
  for (const leg of strutPositions) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.12, leg.length, 7), strutMaterial);
    strut.position.set(leg.x, -0.40, leg.z); strut.rotation.z = leg.rotation; saucer.add(strut);
  }
  const brokenPanel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.13, 0.62), hullMaterial);
  brokenPanel.position.set(2.75, 0.12, -1.08); brokenPanel.rotation.set(0.24, -0.3, 0.46); saucer.add(brokenPanel);
  const antennaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, 0.28, 8), brass);
  antennaBase.position.set(-0.30, 0.38, -2.28); antennaBase.rotation.x = 0.25; saucer.add(antennaBase);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.055, 0.72, 6), darkHull);
  antenna.position.set(-0.30, 0.78, -2.42); antenna.rotation.z = -0.24; saucer.add(antenna);

  addUfoDebris(group, new THREE.MeshStandardMaterial({ color: 0x53646b, metalness: 0.76, roughness: 0.62 }));
  const detachedFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 1.48), hullMaterial);
  detachedFin.position.set(3.65, 0.12, -0.1); detachedFin.rotation.set(0.3, -0.48, 0.18); group.add(detachedFin);

  const energyCell = new THREE.Group();
  energyCell.name = 'ufo-alien-energy-cell-prop';
  const cellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.70, 8), darkHull);
  cellBody.position.y = 0.36; energyCell.add(cellBody);
  const cellCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), alienGlow);
  cellCore.position.y = 0.75; energyCell.add(cellCore);
  const cellRim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 14), brass);
  cellRim.rotation.x = Math.PI / 2; cellRim.position.y = 0.54; energyCell.add(cellRim);
  energyCell.position.set(-4.1, 0.03, 1.1); energyCell.rotation.z = -0.22; group.add(energyCell);

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false; object.receiveShadow = false; object.frustumCulled = true;
  });
  return group;
}

export function createSurvivalWorldDressing(mapId: SurvivalMapId): {
  group: THREE.Group;
  obstacles: SurvivalWorldObstacle[];
} {
  const layout = getSurvivalWorldDressingLayout(mapId);
  const group = new THREE.Group();
  group.name = 'survival-world-anomalies-' + mapId;
  const obstacles: SurvivalWorldObstacle[] = [];
  for (const crater of layout.craters) {
    const pit = createImpactCrater(crater.id, crater.radius, crater.surface);
    pit.position.set(crater.x, 0, crater.z);
    group.add(pit);
  }
  if (layout.ufo) {
    const wreck = createCrashedUfo();
    wreck.position.set(layout.ufo.x, 0, layout.ufo.z);
    wreck.rotation.y = layout.ufo.rotation;
    wreck.scale.setScalar(layout.ufo.scale);
    group.add(wreck);
    obstacles.push({
      x: layout.ufo.x, z: layout.ufo.z,
      halfWidth: layout.ufo.halfWidth * layout.ufo.scale,
      halfDepth: layout.ufo.halfDepth * layout.ufo.scale,
    });
  }
  return { group, obstacles };
}
