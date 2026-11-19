import * as THREE from 'three';
import { disposeActorOwnedRenderResources } from './actorResourceDisposal.ts';

function isRenderable(object: THREE.Object3D): boolean {
  return object instanceof THREE.Mesh ||
    object instanceof THREE.Line ||
    object instanceof THREE.Points ||
    object instanceof THREE.Sprite;
}

function hasRenderableDescendant(object: THREE.Object3D): boolean {
  if (isRenderable(object)) return true;
  return object.children.some(hasRenderableDescendant);
}

function hasPreservedDescendant(object: THREE.Object3D): boolean {
  if (object.userData.gobkitKeep === true ||
      object.userData.actorVisualRoot === true ||
      object.userData.actorLodProxy === true) return true;
  return object.children.some(hasPreservedDescendant);
}

/**
 * Remove the procedural enemy body after its replacement GLB has loaded.
 *
 * Hiding the old meshes is not sufficient: procedural animation and repeated
 * asynchronous LOD/model attachment can leave hidden fallback geometry in the
 * live scene graph. Once a full rig is ready, remove that old body entirely,
 * while keeping explicitly referenced HUD, telegraph and cosmetic overlays.
 */
export function removeLegacyEnemyBodyVisuals(
  container: THREE.Group,
  preservedRoots: readonly THREE.Object3D[] = [],
): number {
  container.updateWorldMatrix(true, false);
  const requestedRoots = [...new Set(preservedRoots)];
  const requestedRootSet = new Set(requestedRoots);
  // A child such as hpFill may also be listed separately while already living
  // inside hpBar. Move only the highest preserved ancestor; keep that complete
  // overlay subtree intact rather than pulling its children out of alignment.
  const topLevelPreservedRoots = requestedRoots.filter((preserved) => {
    let ancestor = preserved.parent;
    while (ancestor && ancestor !== container) {
      if (requestedRootSet.has(ancestor)) return false;
      ancestor = ancestor.parent;
    }
    return true;
  });

  for (const preserved of topLevelPreservedRoots) {
    // A status marker can be parented to a legacy body part. Detach it first,
    // preserving its world transform, so pruning the old body cannot hide it.
    let ancestor = preserved.parent;
    let belongsToContainer = false;
    while (ancestor) {
      if (ancestor === container) {
        belongsToContainer = true;
        break;
      }
      ancestor = ancestor.parent;
    }
    if (belongsToContainer && preserved.parent !== container) {
      preserved.updateWorldMatrix(true, false);
      container.attach(preserved);
    }
    preserved.traverse((object) => { object.userData.gobkitKeep = true; });
  }

  let removedRenderables = 0;
  const prune = (parent: THREE.Object3D): void => {
    for (const child of [...parent.children]) {
      if (child.userData.gobkitKeep === true ||
          child.userData.actorVisualRoot === true ||
          child.userData.actorLodProxy === true) continue;

      const hasKeptDescendant = hasPreservedDescendant(child);
      if (!hasKeptDescendant && hasRenderableDescendant(child)) {
        // The disposer ignores shared GLB/role-kit resources used by other actors.
        disposeActorOwnedRenderResources(child);
        child.removeFromParent();
        removedRenderables += 1;
        continue;
      }

      if (isRenderable(child)) {
        // A renderable parent may own a separately preserved overlay child.
        // Keep the overlay branch, but never render the old body surface.
        child.visible = false;
        removedRenderables += 1;
      }
      prune(child);
    }
  };

  prune(container);
  return removedRenderables;
}
