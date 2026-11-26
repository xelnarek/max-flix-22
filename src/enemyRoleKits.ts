import * as THREE from 'three';
import type { EnemyType } from './types.ts';

/**
 * Humanoid and creature enemy archetypes that previously layered blocky
 * primitive role kits onto base meshes. Preserved for anatomy & motion tests.
 */
export const ENEMY_ROLE_KIT_TYPES: readonly EnemyType[] = Object.freeze(Object.keys({
  customer: 1, architect: 1, inspector: 1, kurier: 1, handlowiec: 1,
  monter: 1, przedstawiciel_włoski: 1, sztaplar_szalony: 1, krol_leto: 1,
  pan_roman: 1, serwisant: 1, bosman_krakow: 1, zombie_pracownik: 1,
  sebix_m: 1, mutant_gamma_forklift: 1, radioactive_pip: 1,
  cyber_salesman: 1, elite_walczak_guard: 1, walczak: 1,
}) as EnemyType[]);

/**
 * Enforce the single cohesive 3D model invariant: never stack procedural
 * blocky role overlays on top of an imported 3D rig. Any stale legacy
 * silhouette attachments found on the actor root are stripped immediately.
 */
export function createEnemyRoleKit(type: EnemyType, actorRoot: THREE.Group): THREE.Group | null {
  const staleOverlays: THREE.Object3D[] = [];
  actorRoot.traverse((object) => {
    if (object.userData.actorRoleSilhouette === true) staleOverlays.push(object);
  });
  for (const overlay of staleOverlays) {
    overlay.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.gobkitSharedGeometry !== true && node.geometry) {
        node.geometry.dispose();
      }
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of mats) {
        if (mat && mat.userData.gobkitSharedMaterial !== true) mat.dispose();
      }
    });
    overlay.removeFromParent();
  }
  actorRoot.userData.enemyRoleKit = type;
  actorRoot.userData.roleKitVersion = 0;
  return null;
}
