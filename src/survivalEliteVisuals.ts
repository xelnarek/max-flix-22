import * as THREE from 'three';

export type SurvivalEliteRole = 'controller' | 'courier';

interface EliteRoleVisual {
  readonly color: number;
  readonly secondaryColor: number;
  readonly baseRadius: number;
  readonly spinSpeed: number;
}

/** Colour and silhouette contract for the two roulette elite archetypes. */
export const ELITE_ROLE_VISUALS: Readonly<Record<SurvivalEliteRole, EliteRoleVisual>> = Object.freeze({
  controller: {
    color: 0xf97316,
    secondaryColor: 0xffc078,
    baseRadius: 1.02,
    spinSpeed: 0.62,
  },
  courier: {
    color: 0xfacc15,
    secondaryColor: 0xfff0a6,
    baseRadius: 0.82,
    spinSpeed: 1.42,
  },
});

/**
 * Create a low-cost role marker from owned Three.js meshes.
 * The controller uses a fortified triple-pylon crown; the courier uses
 * twin forward chevrons. The floor ring makes both readable at phone scale.
 */
export function createSurvivalEliteInsignia(role: SurvivalEliteRole): THREE.Group {
  const profile = ELITE_ROLE_VISUALS[role];
  const root = new THREE.Group();
  root.name = 'survival-elite-insignia';
  root.userData.eliteRole = role;
  root.userData.spinSpeed = profile.spinSpeed;

  const primary = new THREE.MeshBasicMaterial({
    color: profile.color,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    toneMapped: false,
  });
  const secondary = new THREE.MeshBasicMaterial({
    color: profile.secondaryColor,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    toneMapped: false,
  });

  const groundRing = new THREE.Mesh(
    new THREE.TorusGeometry(profile.baseRadius, 0.052, 7, 32),
    primary,
  );
  groundRing.name = role + '-ground-ring';
  groundRing.rotation.x = Math.PI / 2;
  groundRing.position.y = 0.075;
  groundRing.renderOrder = 5;
  root.add(groundRing);

  if (role === 'controller') {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.70, 0.025, 6, 28),
      secondary,
    );
    innerRing.name = 'controller-inner-ring';
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.09;
    innerRing.renderOrder = 5;
    root.add(innerRing);

    for (let index = 0; index < 3; index++) {
      const angle = index / 3 * Math.PI * 2;
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.095, 0.38, 6),
        secondary,
      );
      pylon.name = 'controller-pylon-' + index;
      pylon.position.set(Math.cos(angle) * 0.76, 0.24, Math.sin(angle) * 0.76);
      pylon.renderOrder = 5;
      root.add(pylon);
    }

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), secondary);
    core.name = 'controller-core';
    core.position.y = 1.95;
    core.renderOrder = 6;
    root.add(core);
  } else {
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.025, 6, 28),
      secondary,
    );
    innerRing.name = 'courier-inner-ring';
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.09;
    innerRing.renderOrder = 5;
    root.add(innerRing);

    for (const side of [-1, 1] as const) {
      const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.38, 3),
        secondary,
      );
      chevron.name = side < 0 ? 'courier-arrow-left' : 'courier-arrow-right';
      chevron.position.set(side * 0.24, 1.78, 0.30);
      chevron.rotation.x = Math.PI / 2;
      chevron.renderOrder = 6;
      root.add(chevron);
    }
  }

  return root;
}
