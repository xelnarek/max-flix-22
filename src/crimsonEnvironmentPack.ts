import * as THREE from 'three';
import { applyCrimsonTexture } from './crimsonTexturePack.ts';

export type CrimsonPropKind = 'rack' | 'palletStack' | 'barrelCluster' | 'conveyor' | 'coldCompressor' | 'container';
export type CrimsonEnemyKind = 'stalker' | 'armoredForeman' | 'toxicInspector';

const mat = (color: number, roughness = 0.78, metalness = 0.12) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group, cast = true) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = cast;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function box(parent: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  return mesh(new THREE.BoxGeometry(...size), material, ...position, parent);
}

function cylinder(parent: THREE.Group, radiusTop: number, radiusBottom: number, height: number, position: [number, number, number], material: THREE.Material, segments = 12) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, ...position, parent);
}

/** Detailed three-bay selective pallet rack. Decorative only: collision is supplied by the map layout. */
export function createCrimsonRack(width = 5.4, height = 3.6, depth = 1.45): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-rack-3bay';
  const upright = mat(0x315d83, 0.46, 0.62), beam = mat(0xd36a32, 0.52, 0.42);
  applyCrimsonTexture(upright, 'rackUpright', 1, 2, 0.48);\n  const deck = mat(0x687887, 0.72, 0.55), bolt = mat(0xb4bdc5, 0.3, 0.88);
  const halfW = width / 2, halfD = depth / 2;
  const postGeo = new THREE.BoxGeometry(0.13, height, 0.14);
  for (const x of [-halfW, -halfW / 3, halfW / 3, halfW]) {
    for (const z of [-halfD, halfD]) {
      mesh(postGeo, upright, x, height / 2, z, g);
      box(g, [0.26, 0.055, 0.28], [x, 0.04, z], deck);
      cylinder(g, 0.025, 0.025, 0.025, [x, 0.078, z], bolt, 8);
    }
  }
  for (const y of [1.15, 2.35, 3.45]) {
    for (const z of [-halfD, halfD]) {
      box(g, [width, 0.14, 0.10], [0, y, z], beam);
    }
    box(g, [width - 0.12, 0.055, depth - 0.12], [0, y - 0.08, 0], deck);
  }
  const brace = mat(0x8c9aa6, 0.5, 0.72);
  for (const z of [-halfD - 0.06, halfD + 0.06]) {
    for (let bay = 0; bay < 3; bay++) {
      const x0 = -halfW + bay * width / 3 + 0.08, x1 = x0 + width / 3 - 0.16;
      const a = new THREE.Vector3(x0, 0.18, z), b = new THREE.Vector3(x1, height - 0.18, z);
      const d = new THREE.Vector3().subVectors(b, a);
      const rod = mesh(new THREE.CylinderGeometry(0.022, 0.022, d.length(), 7), brace, 0, 0, 0, g);
      rod.position.copy(a).add(b).multiplyScalar(0.5);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
  }
  const loadMat = mat(0x9b6847, 0.9, 0.02);
  applyCrimsonTexture(loadMat as THREE.MeshStandardMaterial, 'palletTimber', 1.2, 1.2, 0.9);
  for (const y of [1.25, 2.45]) {
    for (const x of [-width / 3, 0, width / 3]) {
      box(g, [1.25, 0.82, 1.05], [x, y + 0.46, 0], loadMat);
      box(g, [1.31, 0.045, 1.1], [x, y + 0.89, 0], beam);
    }
  }
  g.userData.assetPack = 'MAX-FLIX-CRIMSON';
  g.userData.visualOnly = true;
  return g;
}

/** Wrapped mixed-cargo pallet with timber runners, corner guards and two straps. */
export function createCrimsonPalletStack(scale = 1): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-wrapped-pallet-stack';
  const wood = mat(0x9c704c, 0.92, 0.02), wrap = new THREE.MeshStandardMaterial({ color: 0xa8b7bd, roughness: 0.24, metalness: 0.08, transparent: true, opacity: 0.72 });
  const strap = mat(0xd27b34, 0.55, 0.28), carton = mat(0x9d8061, 0.88, 0.02);
  for (const z of [-0.55, 0, 0.55]) box(g, [2.2, 0.13, 0.16], [0, 0.09, z], wood);
  for (const z of [-0.58, -0.29, 0, 0.29, 0.58]) box(g, [2.35, 0.09, 0.22], [0, 0.2, z], wood);
  box(g, [2.02, 1.12, 1.42], [0, 0.82, 0], carton);
  box(g, [2.08, 0.035, 1.48], [0, 1.38, 0], strap);
  for (const x of [-0.72, 0.72]) box(g, [0.065, 1.08, 1.48], [x, 0.82, 0], strap);
  applyCrimsonTexture(wrap as THREE.MeshStandardMaterial, 'plasticPallet', 1.2, 1.2, 0.24);\n  const film = mesh(new THREE.BoxGeometry(2.08, 1.16, 1.48), wrap, 0, 0.82, 0, g, false);
  film.material.side = THREE.DoubleSide;
  g.scale.setScalar(scale);
  g.userData.collisionFootprint = { halfWidth: 1.2 * scale, halfDepth: 0.78 * scale };
  return g;
}

/** Three steel drums with rolled rims and a visible hazard band. */
export function createCrimsonBarrelCluster(): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-drum-cluster';
  const body = mat(0x7c343b, 0.58, 0.52), rim = mat(0x9ba6ad, 0.3, 0.84), hazard = mat(0xe5a13b, 0.64, 0.22);
  for (const [x, z] of [[-0.42, -0.2], [0.42, -0.2], [0, 0.52]] as const) {
    cylinder(g, 0.34, 0.34, 1.08, [x, 0.56, z], body, 16);
    cylinder(g, 0.35, 0.35, 0.045, [x, 0.13, z], rim, 16);
    cylinder(g, 0.35, 0.35, 0.045, [x, 1.0, z], rim, 16);
    cylinder(g, 0.345, 0.345, 0.13, [x, 0.62, z], hazard, 16);
    cylinder(g, 0.055, 0.055, 0.025, [x + 0.12, 1.035, z - 0.08], rim, 10);
  }
  g.userData.collisionFootprint = { halfWidth: 0.82, halfDepth: 0.9 };
  return g;
}

/** Low-profile roller conveyor: readable from a steep top-down camera without blocking combat silhouettes. */
export function createCrimsonConveyor(length = 5.2, width = 1.45): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-roller-conveyor';
  const frame = mat(0x354453, 0.5, 0.72), roller = mat(0x9aa6ad, 0.3, 0.82), feet = mat(0x1d2935, 0.62, 0.48);
  box(g, [length, 0.2, width], [0, 0.64, 0], frame);
  const count = Math.max(8, Math.floor(length * 3));
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + 0.16 + i * (length - 0.32) / (count - 1);
    const r = cylinder(g, 0.055, 0.055, width - 0.12, [x, 0.78, 0], roller, 10);
    r.rotation.x = Math.PI / 2;
  }
  for (const x of [-length * 0.38, length * 0.38]) {
    for (const z of [-width * 0.36, width * 0.36]) box(g, [0.14, 0.62, 0.14], [x, 0.31, z], feet);
  }
  g.userData.collisionFootprint = { halfWidth: length / 2, halfDepth: width / 2 };
  return g;
}

/** Compact refrigeration unit with fan grille, insulated pipes and warning beacon. */
export function createCrimsonColdCompressor(): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-cold-compressor';
  const shell = mat(0x8ca9b2, 0.52, 0.28), dark = mat(0x263b49, 0.62, 0.42), ice = mat(0x8be2ef, 0.28, 0.2), red = mat(0xb33e46, 0.42, 0.22);
  applyCrimsonTexture(shell, 'coldFrost', 1.4, 1.0, 0.34);\n  box(g, [2.6, 1.45, 1.55], [0, 0.78, 0], shell);
  box(g, [2.64, 0.12, 1.6], [0, 0.08, 0], dark);
  cylinder(g, 0.42, 0.42, 0.08, [0.42, 0.82, 0.79], dark, 24);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    box(g, [0.055, 0.72, 0.045], [0.42 + Math.cos(angle) * 0.23, 0.82, 0.84 + Math.sin(angle) * 0.23], ice);
  }
  for (const x of [-0.92, 0.92]) {
    cylinder(g, 0.075, 0.075, 0.7, [x, 1.62, -0.42], ice, 10);
    cylinder(g, 0.12, 0.12, 0.16, [x, 2.02, -0.42], red, 12);
  }
  g.userData.collisionFootprint = { halfWidth: 1.38, halfDepth: 0.86 };
  return g;
}

/** ISO container segment with corrugation ribs, corner castings and lock bars. */
export function createCrimsonContainer(length = 6.0, height = 2.35, depth = 2.45, paint = 0x7e343d): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-iso-container';
  const shell = mat(paint, 0.62, 0.55), rib = mat(0x293642, 0.5, 0.72), casting = mat(0xa4adb3, 0.34, 0.82);
  applyCrimsonTexture(shell, 'containerSteel', Math.max(1, length / 2), 1.2, 0.62);\n  box(g, [length, height, depth], [0, height / 2, 0], shell);
  const count = Math.max(18, Math.floor(length * 5));
  for (let i = 0; i <= count; i++) {
    const x = -length / 2 + i * length / count;
    box(g, [0.035, height * 0.94, depth + 0.035], [x, height / 2, 0], rib);
  }
  for (const x of [-length / 2 + 0.12, length / 2 - 0.12]) {
    for (const z of [-depth / 2, depth / 2]) {
      box(g, [0.18, height + 0.08, 0.18], [x, height / 2, z], casting);
    }
  }
  g.userData.collisionFootprint = { halfWidth: length / 2, halfDepth: depth / 2 };
  return g;
}

function makeEnemyBase(name: string, bodyColor: number, armorColor: number): THREE.Group {
  const g = new THREE.Group(); g.name = 'crimson-enemy-' + name;
  const body = mat(bodyColor, 0.76, 0.04), armor = mat(armorColor, 0.5, 0.42), dark = mat(0x20232a, 0.72, 0.18);
  // Compact humanoid silhouette: torso, head, shoulders and boots remain legible from the gameplay camera.
  box(g, [0.56, 0.66, 0.34], [0, 0.64, 0], body);
  cylinder(g, 0.19, 0.2, 0.25, [0, 1.1, 0.02], armor, 12);
  for (const x of [-0.38, 0.38]) {
    box(g, [0.25, 0.24, 0.38], [x, 0.82, 0], armor);
    box(g, [0.2, 0.24, 0.25], [x * 0.78, 0.16, 0.03], dark);
  }
  return g;
}

/** Three distinct low-poly fallback silhouettes for top-down readability. */
export function createCrimsonEnemyModel(kind: CrimsonEnemyKind): THREE.Group {
  if (kind === 'stalker') {
    const g = makeEnemyBase('stalker', 0x552d38, 0x8e394b);
    const claw = mat(0xc5b6a5, 0.38, 0.28);
    for (const x of [-0.5, 0.5]) {
      const talon = mesh(new THREE.ConeGeometry(0.095, 0.42, 6), claw, x, 0.52, 0.16, g);
      talon.rotation.z = x < 0 ? -0.7 : 0.7;
    }
    const eye = new THREE.MeshBasicMaterial({ color: 0xff3b52 });
    for (const x of [-0.075, 0.075]) mesh(new THREE.SphereGeometry(0.035, 8, 6), eye, x, 1.16, 0.18, g, false);
    return g;
  }
  if (kind === 'armoredForeman') {
    const g = makeEnemyBase('armored-foreman', 0x303c4b, 0xc87937);
    const plate = mat(0x9aa6b1, 0.32, 0.82);
    box(g, [0.82, 0.18, 0.48], [0, 0.95, 0], plate);
    const baton = cylinder(g, 0.055, 0.055, 0.72, [0.57, 0.5, 0.08], mat(0xe6b25d, 0.42, 0.52), 8);
    baton.rotation.z = Math.PI / 4;
    return g;
  }
  const g = makeEnemyBase('toxic-inspector', 0x667b48, 0xcedb9a);
  const mask = mat(0x293d2e, 0.42, 0.22), glow = new THREE.MeshBasicMaterial({ color: 0x9cff5a });
  box(g, [0.48, 0.28, 0.22], [0, 1.02, 0.17], mask);
  for (const x of [-0.12, 0.12]) mesh(new THREE.SphereGeometry(0.045, 8, 6), glow, x, 1.04, 0.29, g, false);
  const tank = cylinder(g, 0.16, 0.16, 0.48, [0, 0.68, -0.22], mat(0x9ccf65, 0.34, 0.18), 10);
  tank.rotation.x = Math.PI / 2;
  return g;
}
