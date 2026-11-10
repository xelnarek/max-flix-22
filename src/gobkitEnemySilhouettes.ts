import * as THREE from 'three';
import type { EnemyType } from './types.ts';

type Point3 = readonly [number, number, number];

function makeMaterial(color: number, roughness = 0.72, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Point3,
  rotation: Point3 = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  root.add(mesh);
  return mesh;
}

function addHardhat(root: THREE.Group, color = 0xfacc15): void {
  const shell = makeMaterial(color, 0.36, 0.08);
  const dark = makeMaterial(0x292524, 0.88);
  addMesh(root, new THREE.SphereGeometry(0.185, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), shell, [0, 1.13, 0]);
  addMesh(root, new THREE.CylinderGeometry(0.225, 0.225, 0.035, 16), shell, [0, 1.105, 0]);
  addMesh(root, new THREE.BoxGeometry(0.16, 0.025, 0.045), dark, [0, 1.18, 0.145]);
}

function addClipboard(root: THREE.Group, position: Point3, color = 0x78350f): void {
  const board = makeMaterial(color, 0.78);
  const paper = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const clip = makeMaterial(0x94a3b8, 0.3, 0.78);
  const boardMesh = addMesh(root, new THREE.BoxGeometry(0.21, 0.29, 0.035), board, position, [0.16, 0, -0.16]);
  addMesh(boardMesh as unknown as THREE.Group, new THREE.BoxGeometry(0.17, 0.235, 0.01), paper, [0, 0, 0.021]);
  addMesh(boardMesh as unknown as THREE.Group, new THREE.BoxGeometry(0.07, 0.025, 0.016), clip, [0, 0.125, 0.03]);
  for (let i = 0; i < 3; i++) {
    addMesh(boardMesh as unknown as THREE.Group, new THREE.BoxGeometry(0.11, 0.008, 0.008), makeMaterial(0x64748b), [-0.015, 0.045 - i * 0.045, 0.028]);
  }
}

function addCaricature(root: THREE.Group, type: EnemyType): void {
  const orange = makeMaterial(0xf97316, 0.55);
  const yellow = makeMaterial(0xfacc15, 0.42, 0.05);
  const blue = makeMaterial(0x0284c7, 0.5);
  const navy = makeMaterial(0x172554, 0.72);
  const red = makeMaterial(0xdc2626, 0.62);
  const white = makeMaterial(0xf8fafc, 0.5);
  const metal = makeMaterial(0x94a3b8, 0.26, 0.82);
  const charcoal = makeMaterial(0x18181b, 0.68);
  const gold = makeMaterial(0xfbbf24, 0.3, 0.75);

  switch (type) {
    case 'architect': {
      // A deliberately theatrical interior designer: beret, huge round frames,
      // oversized sample fan and a rolled plan — readable from the gameplay camera.
      addMesh(root, new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), charcoal, [0, 1.14, 0]);
      addMesh(root, new THREE.TorusGeometry(0.067, 0.013, 7, 16), gold, [-0.064, 0.99, 0.17]);
      addMesh(root, new THREE.TorusGeometry(0.067, 0.013, 7, 16), gold, [0.064, 0.99, 0.17]);
      addMesh(root, new THREE.BoxGeometry(0.045, 0.014, 0.018), gold, [0, 0.99, 0.18]);
      const swatchColors = [0xfde68a, 0xe7e5e4, 0x94a3b8, 0x0ea5e9, 0x84cc16];
      swatchColors.forEach((color, index) => {
        addMesh(root, new THREE.BoxGeometry(0.075, 0.22, 0.018), makeMaterial(color, 0.38), [0.30 + index * 0.018, 0.79, 0.15], [0, 0, (index - 2) * 0.16]);
      });
      addMesh(root, new THREE.CylinderGeometry(0.055, 0.055, 0.34, 10), white, [-0.28, 0.88, -0.13], [0, 0, Math.PI / 2]);
      break;
    }
    case 'inspector': {
      addHardhat(root, 0xfbbf24);
      addMesh(root, new THREE.BoxGeometry(0.40, 0.45, 0.035), orange, [0, 0.70, 0.145]);
      addMesh(root, new THREE.BoxGeometry(0.405, 0.045, 0.045), white, [0, 0.73, 0.17]);
      addMesh(root, new THREE.BoxGeometry(0.405, 0.035, 0.045), white, [0, 0.56, 0.17]);
      addClipboard(root, [-0.28, 0.67, 0.17], 0x7c2d12);
      addMesh(root, new THREE.CylinderGeometry(0.018, 0.022, 0.08, 8), gold, [0.02, 0.91, 0.19], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'kurier': {
      // Oversized insulated delivery pack and a parcel stack make this silhouette
      // read as a courier instead of another generic office worker.
      addMesh(root, new THREE.BoxGeometry(0.47, 0.54, 0.25), blue, [0, 0.83, -0.23]);
      addMesh(root, new THREE.BoxGeometry(0.49, 0.055, 0.27), yellow, [0, 0.91, -0.09]);
      addMesh(root, new THREE.BoxGeometry(0.26, 0.20, 0.20), makeMaterial(0xb45309), [0.27, 0.52, -0.05], [0, 0, -0.12]);
      addMesh(root, new THREE.BoxGeometry(0.035, 0.21, 0.21), red, [0.27, 0.52, 0.055], [0, 0, -0.12]);
      addMesh(root, new THREE.CylinderGeometry(0.16, 0.16, 0.055, 12), blue, [0, 1.14, 0]);
      addMesh(root, new THREE.BoxGeometry(0.22, 0.018, 0.13), blue, [0, 1.105, 0.14]);
      break;
    }
    case 'handlowiec': {
      addMesh(root, new THREE.BoxGeometry(0.085, 0.34, 0.035), red, [0, 0.79, 0.155], [0.06, 0, 0]);
      addMesh(root, new THREE.BoxGeometry(0.12, 0.075, 0.04), white, [0, 0.99, 0.15]);
      addMesh(root, new THREE.BoxGeometry(0.28, 0.24, 0.12), navy, [0.31, 0.43, 0.12]);
      addMesh(root, new THREE.BoxGeometry(0.13, 0.035, 0.135), gold, [0.31, 0.56, 0.12]);
      addMesh(root, new THREE.BoxGeometry(0.12, 0.045, 0.035), metal, [0.31, 0.43, 0.19]);
      break;
    }
    case 'customer': {
      // Oversized complaint/reklamacja board: the enemy's defining prop.
      addMesh(root, new THREE.BoxGeometry(0.27, 0.35, 0.035), red, [-0.29, 0.78, 0.14], [0, 0, -0.12]);
      addMesh(root, new THREE.BoxGeometry(0.225, 0.30, 0.012), white, [-0.29, 0.78, 0.165], [0, 0, -0.12]);
      addMesh(root, new THREE.BoxGeometry(0.14, 0.025, 0.018), red, [-0.29, 0.86, 0.18]);
      for (let i = 0; i < 3; i++) {
        addMesh(root, new THREE.BoxGeometry(0.14, 0.009, 0.008), charcoal, [-0.29, 0.80 - i * 0.045, 0.18]);
      }
      addMesh(root, new THREE.BoxGeometry(0.26, 0.045, 0.035), gold, [0, 0.98, 0.16]);
      break;
    }
    case 'monter':
    case 'serwisant': {
      addHardhat(root, type === 'monter' ? 0x2563eb : 0xeab308);
      addMesh(root, new THREE.BoxGeometry(0.44, 0.09, 0.27), gold, [0, 0.48, 0]);
      addMesh(root, new THREE.BoxGeometry(0.11, 0.10, 0.07), charcoal, [-0.14, 0.52, 0.17]);
      addMesh(root, new THREE.BoxGeometry(0.11, 0.10, 0.07), charcoal, [0.13, 0.52, 0.17]);
      if (type === 'monter') {
        addMesh(root, new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), makeMaterial(0xb45309), [0.31, 0.68, 0.15], [0, 0, -0.45]);
        addMesh(root, new THREE.CylinderGeometry(0.075, 0.075, 0.23, 10), charcoal, [0.40, 0.83, 0.15], [0, 0, Math.PI / 2]);
      } else {
        addMesh(root, new THREE.BoxGeometry(0.10, 0.25, 0.06), blue, [0.30, 0.71, 0.14]);
        addMesh(root, new THREE.BoxGeometry(0.18, 0.035, 0.04), yellow, [0.30, 0.86, 0.14]);
        addMesh(root, new THREE.CylinderGeometry(0.018, 0.018, 0.29, 8), metal, [-0.30, 0.78, 0.13], [0, 0, Math.PI / 2]);
      }
      break;
    }
    case 'zombie_pracownik': {
      // Preserve the internet-sourced stitched undead rig and reinforce the
      // silhouette with sickly eyes, exposed ribs and torn hi-vis remnants.
      const infected = new THREE.MeshBasicMaterial({ color: 0xd9ff43 });
      const bone = makeMaterial(0xd6d3a8, 0.92);
      const wound = makeMaterial(0x7f1d1d, 0.92);
      addMesh(root, new THREE.SphereGeometry(0.035, 8, 6), infected, [-0.065, 0.99, 0.17]);
      addMesh(root, new THREE.SphereGeometry(0.035, 8, 6), infected, [0.065, 0.99, 0.17]);
      for (let i = 0; i < 4; i++) {
        const y = 0.73 - i * 0.065;
        addMesh(root, new THREE.BoxGeometry(0.30 - i * 0.025, 0.026, 0.022), bone, [0, y, 0.18], [0, 0, i % 2 ? 0.06 : -0.06]);
      }
      addMesh(root, new THREE.BoxGeometry(0.11, 0.16, 0.025), wound, [-0.17, 0.62, 0.16], [0, 0, -0.32]);
      addMesh(root, new THREE.BoxGeometry(0.12, 0.13, 0.025), wound, [0.17, 0.70, 0.16], [0, 0, 0.28]);
      break;
    }
    default:
      if (type === 'sztaplar_szalony' || type === 'elite_walczak_guard') {
        addMesh(root, new THREE.BoxGeometry(0.46, 0.13, 0.24), yellow, [0, 0.49, 0]);
        addMesh(root, new THREE.BoxGeometry(0.12, 0.17, 0.05), metal, [0.22, 0.78, 0.14]);
      }
      break;
  }
}

/** Add a small, role-specific caricature kit to a CC0, rigged Gobkit enemy. */
export function createGobkitEnemyRoleSilhouette(type: EnemyType): THREE.Group | null {
  const root = new THREE.Group();
  root.name = 'gobkit-role-silhouette-' + type;
  root.userData.actorRoleSilhouette = true;
  addCaricature(root, type);
  if (root.children.length === 0) return null;
  return root;
}
