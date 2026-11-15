import * as THREE from 'three';

export interface CthulhuBossModel {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  tentacles: THREE.Group[];
  wings: THREE.Group[];
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  position: THREE.Vector3,
  scale?: THREE.Vector3,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.copy(position);
  if (scale) object.scale.copy(scale);
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

function tube(
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const object = mesh(new THREE.TubeGeometry(curve, 18, radius, 7, false), material, name, new THREE.Vector3());
  return object;
}

function createWing(side: -1 | 1, membrane: THREE.Material, rib: THREE.Material): THREE.Group {
  const wing = new THREE.Group();
  wing.name = side < 0 ? 'cthulhu-left-wing' : 'cthulhu-right-wing';
  wing.position.set(side * 0.54, 2.55, -0.24);
  wing.rotation.y = side * -0.10;
  wing.rotation.z = side * -0.06;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.18);
  shape.quadraticCurveTo(side * 0.58, 0.82, side * 1.58, 0.98);
  shape.quadraticCurveTo(side * 1.47, 0.48, side * 1.18, 0.04);
  shape.quadraticCurveTo(side * 1.06, -0.22, side * 0.78, -0.12);
  shape.quadraticCurveTo(side * 0.52, -0.54, side * 0.30, -0.24);
  shape.quadraticCurveTo(side * 0.12, -0.18, 0, 0.18);

  const skin = mesh(
    new THREE.ShapeGeometry(shape, 12),
    membrane,
    wing.name + '-membrane',
    new THREE.Vector3(0, 0, -0.015),
  );
  wing.add(skin);

  const ribs = [
    [new THREE.Vector3(0, 0.12, 0.015), new THREE.Vector3(side * 0.42, 0.42, 0.02), new THREE.Vector3(side * 0.96, 0.74, 0.02), new THREE.Vector3(side * 1.48, 0.91, 0.02)],
    [new THREE.Vector3(0, 0.08, 0.02), new THREE.Vector3(side * 0.40, 0.03, 0.02), new THREE.Vector3(side * 0.92, 0.02, 0.02), new THREE.Vector3(side * 1.20, 0.01, 0.02)],
    [new THREE.Vector3(0, 0.06, 0.02), new THREE.Vector3(side * 0.30, -0.08, 0.02), new THREE.Vector3(side * 0.54, -0.25, 0.02), new THREE.Vector3(side * 0.75, -0.20, 0.02)],
  ];
  ribs.forEach((points, index) => wing.add(tube(points, 0.027, rib, wing.name + '-rib-' + index)));
  return wing;
}

/**
 * Procedural, locally generated Cthulhu boss. It uses no external character
 * assets: squid-like head/tentacles, bat wings, heavy arms and glowing elder
 * sigils are assembled from lightweight Three.js geometry.
 */
export function createCthulhuBossModel(): CthulhuBossModel {
  const group = new THREE.Group();
  group.name = 'cthulhu-elder-god-boss';

  const skin = new THREE.MeshStandardMaterial({
    color: 0x244f50, roughness: 0.46, metalness: 0.08,
    emissive: 0x062a2d, emissiveIntensity: 0.36,
  });
  const skinLight = new THREE.MeshStandardMaterial({
    color: 0x397777, roughness: 0.40, metalness: 0.12,
    emissive: 0x0b4948, emissiveIntensity: 0.24,
  });
  const membrane = new THREE.MeshStandardMaterial({
    color: 0x183a48, roughness: 0.68, metalness: 0.05,
    emissive: 0x062d3b, emissiveIntensity: 0.38,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x101e2e, roughness: 0.52, metalness: 0.25,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0x9b8050, roughness: 0.34, metalness: 0.82,
    emissive: 0x3d2b0b, emissiveIntensity: 0.22,
  });
  const biolume = new THREE.MeshStandardMaterial({
    color: 0x65f0d0, roughness: 0.24, metalness: 0.12,
    emissive: 0x15d8b5, emissiveIntensity: 2.1,
  });
  const eye = new THREE.MeshBasicMaterial({ color: 0xb8ff9c, toneMapped: false });
  const mouthMaterial = new THREE.MeshStandardMaterial({
    color: 0x081b25, roughness: 0.28, metalness: 0.08,
  });

  const pelvis = new THREE.Group();
  pelvis.name = 'cthulhu-pelvis-pivot';
  pelvis.position.y = 0.88;
  group.add(pelvis);
  pelvis.add(mesh(
    new THREE.SphereGeometry(0.58, 16, 12),
    skin,
    'cthulhu-lower-mantle',
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(1.08, 0.90, 0.78),
  ));

  const torso = new THREE.Group();
  torso.name = 'cthulhu-torso';
  torso.position.y = 1.48;
  group.add(torso);
  torso.add(mesh(
    new THREE.SphereGeometry(0.72, 18, 14),
    skin,
    'cthulhu-barrel-chest',
    new THREE.Vector3(0, 0.24, 0),
    new THREE.Vector3(1.05, 1.10, 0.74),
  ));
  torso.add(mesh(
    new THREE.SphereGeometry(0.47, 14, 10),
    skinLight,
    'cthulhu-throat-plate',
    new THREE.Vector3(0, 0.70, 0.28),
    new THREE.Vector3(0.88, 0.62, 0.42),
  ));

  const chestSigil = mesh(
    new THREE.TorusGeometry(0.30, 0.036, 7, 32),
    biolume,
    'cthulhu-elder-sigil',
    new THREE.Vector3(0, 0.37, 0.60),
  );
  chestSigil.scale.set(1, 1.12, 0.55);
  torso.add(chestSigil);
  for (let index = 0; index < 3; index++) {
    const rune = mesh(
      new THREE.OctahedronGeometry(0.075 - index * 0.008, 0),
      brass,
      'cthulhu-chest-rune-' + index,
      new THREE.Vector3((index - 1) * 0.19, 0.35, 0.64),
    );
    rune.rotation.z = index * 0.44;
    torso.add(rune);
  }

  const head = new THREE.Group();
  head.name = 'cthulhu-head-pivot';
  head.position.set(0, 2.75, 0.08);
  group.add(head);
  head.add(mesh(
    new THREE.SphereGeometry(0.62, 20, 16),
    skinLight,
    'cthulhu-cephalopod-skull',
    new THREE.Vector3(0, 0.05, 0),
    new THREE.Vector3(1.03, 0.94, 0.91),
  ));
  head.add(mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    mouthMaterial,
    'cthulhu-shadowed-mouth',
    new THREE.Vector3(0, -0.22, 0.40),
    new THREE.Vector3(1.05, 0.72, 0.48),
  ));
  for (const side of [-1, 1] as const) {
    const eyeSocket = mesh(
      new THREE.SphereGeometry(0.145, 12, 8),
      dark,
      side < 0 ? 'cthulhu-left-eye-socket' : 'cthulhu-right-eye-socket',
      new THREE.Vector3(side * 0.235, 0.095, 0.52),
      new THREE.Vector3(1.0, 0.78, 0.42),
    );
    head.add(eyeSocket);
    head.add(mesh(
      new THREE.SphereGeometry(0.082, 12, 8),
      eye,
      side < 0 ? 'cthulhu-left-glowing-eye' : 'cthulhu-right-glowing-eye',
      new THREE.Vector3(side * 0.235, 0.095, 0.685),
    ));
  }

  // Crown ridges and the unmistakable cephalopod facial fringe.
  for (let index = 0; index < 5; index++) {
    const side = index - 2;
    const horn = mesh(
      new THREE.ConeGeometry(0.11, 0.46 + (2 - Math.abs(side)) * 0.055, 7),
      skin,
      'cthulhu-crown-spine-' + index,
      new THREE.Vector3(side * 0.18, 0.58 - Math.abs(side) * 0.045, -0.03),
    );
    horn.rotation.z = -side * 0.24;
    head.add(horn);
  }

  const tentacles: THREE.Group[] = [];
  for (let index = 0; index < 7; index++) {
    const side = index - 3;
    const fan = new THREE.Group();
    fan.name = 'cthulhu-face-tentacle-' + index;
    fan.position.set(side * 0.105, -0.28 + Math.abs(side) * 0.025, 0.43);
    fan.rotation.y = side * 0.14;
    const spread = side * 0.16;
    const curve = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(spread * 0.35, -0.18, 0.11),
      new THREE.Vector3(spread, -0.38 - (index % 2) * 0.05, 0.16),
      new THREE.Vector3(spread * 1.55, -0.50 - (index % 3) * 0.045, 0.06),
    ];
    fan.add(tube(curve, 0.065, skinLight, fan.name + '-flesh'));
    const tip = mesh(
      new THREE.SphereGeometry(0.064, 8, 6),
      biolume,
      fan.name + '-glowing-tip',
      curve[curve.length - 1].clone(),
      new THREE.Vector3(0.8, 0.9, 0.8),
    );
    fan.add(tip);
    for (let sucker = 0; sucker < 3; sucker++) {
      const socket = mesh(
        new THREE.SphereGeometry(0.028, 7, 5),
        brass,
        fan.name + '-sucker-' + sucker,
        new THREE.Vector3(spread * (0.42 + sucker * 0.25), -0.18 - sucker * 0.095, 0.205),
      );
      fan.add(socket);
    }
    head.add(fan);
    tentacles.push(fan);
  }

  const wings = ([-1, 1] as const).map((side) => {
    const wing = createWing(side, membrane, brass);
    group.add(wing);
    return wing;
  });

  const armL = new THREE.Group();
  armL.name = 'cthulhu-left-arm-pivot';
  armL.position.set(-0.80, 2.05, 0.02);
  armL.rotation.z = -0.20;
  const armR = new THREE.Group();
  armR.name = 'cthulhu-right-arm-pivot';
  armR.position.set(0.80, 2.05, 0.02);
  armR.rotation.z = 0.20;
  for (const [arm, side] of [[armL, -1], [armR, 1]] as const) {
    arm.add(mesh(
      new THREE.CapsuleGeometry(0.22, 0.70, 5, 9),
      skin,
      'cthulhu-upper-arm-' + side,
      new THREE.Vector3(0, -0.37, 0),
      new THREE.Vector3(1.05, 1.0, 0.92),
    ));
    arm.add(mesh(
      new THREE.CapsuleGeometry(0.17, 0.48, 4, 8),
      skinLight,
      'cthulhu-forearm-' + side,
      new THREE.Vector3(side * 0.04, -0.93, 0.04),
      new THREE.Vector3(1.0, 1.0, 0.9),
    ));
    arm.add(mesh(
      new THREE.SphereGeometry(0.24, 12, 9),
      skin,
      'cthulhu-claw-palm-' + side,
      new THREE.Vector3(side * 0.05, -1.23, 0.15),
    ));
    for (let claw = 0; claw < 3; claw++) {
      const digitSide = claw - 1;
      const talon = mesh(
        new THREE.ConeGeometry(0.065, 0.34, 7),
        brass,
        'cthulhu-talon-' + side + '-' + claw,
        new THREE.Vector3(digitSide * 0.14, -1.43, 0.25),
      );
      talon.rotation.x = -0.36;
      talon.rotation.z = digitSide * -0.20;
      arm.add(talon);
    }
  }
  group.add(armL, armR);

  const legL = new THREE.Group();
  legL.name = 'cthulhu-left-leg-pivot';
  legL.position.set(-0.34, 0.93, 0);
  const legR = new THREE.Group();
  legR.name = 'cthulhu-right-leg-pivot';
  legR.position.set(0.34, 0.93, 0);
  for (const [leg, side] of [[legL, -1], [legR, 1]] as const) {
    leg.add(mesh(
      new THREE.CapsuleGeometry(0.22, 0.66, 5, 8),
      skin,
      'cthulhu-thigh-' + side,
      new THREE.Vector3(0, -0.34, 0),
    ));
    leg.add(mesh(
      new THREE.SphereGeometry(0.28, 12, 8),
      skinLight,
      'cthulhu-webbed-foot-' + side,
      new THREE.Vector3(0, -0.81, 0.18),
      new THREE.Vector3(1.0, 0.54, 1.44),
    ));
    for (let claw = 0; claw < 2; claw++) {
      leg.add(mesh(
        new THREE.ConeGeometry(0.055, 0.21, 6),
        brass,
        'cthulhu-foot-claw-' + side + '-' + claw,
        new THREE.Vector3((claw - 0.5) * 0.17, -0.83, 0.40),
      ));
    }
  }
  group.add(legL, legR);

  // Fin-like tendrils trail from the waist, framing the silhouette.
  for (let index = 0; index < 4; index++) {
    const side = index - 1.5;
    const tail = new THREE.Group();
    tail.name = 'cthulhu-back-tendril-' + index;
    tail.position.set(side * 0.22, 1.20, -0.32);
    tail.add(tube([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.24, -0.35, -0.12),
      new THREE.Vector3(side * 0.42, -0.68, -0.24),
      new THREE.Vector3(side * 0.60, -0.78, -0.44),
    ], 0.075, skin, tail.name + '-body'));
    group.add(tail);
    tentacles.push(tail);
  }

  const aura = mesh(
    new THREE.TorusGeometry(1.34, 0.045, 7, 64),
    biolume,
    'cthulhu-ground-aura',
    new THREE.Vector3(0, 0.08, 0),
  );
  aura.rotation.x = Math.PI / 2;
  group.add(aura);

  // The model is intentionally hand-built and shadowless to keep the boss
  // readable without spending a mobile shadow-map draw call per limb.
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  group.userData.cthulhuTentacles = tentacles;
  group.userData.cthulhuWings = wings;
  group.userData.cthulhuAura = aura;

  return { group, legL, legR, armL, armR, head, tentacles, wings };
}
