import * as THREE from 'three';
import floorUrl from './visuals/b4-floor-concrete.svg?url';
import palletUrl from './visuals/b4-pallet-wood.svg?url';
import cartonUrl from './visuals/b4-freight-carton.svg?url';
import steelUrl from './visuals/b4-corrugated-steel.svg?url';
import hazardUrl from './visuals/b4-hazard-chevron.svg?url';
import spriteAtlasUrl from './visuals/b4-sprite-atlas.svg?url';

export type B4VisualTextureKind = 'floor' | 'pallet' | 'carton' | 'steel' | 'hazard' | 'spriteAtlas';
export type B4SpriteKind = 'worker' | 'zombie' | 'forklift' | 'pallet';

interface B4TextureEntry {
  texture: THREE.Texture;
  ready: Promise<THREE.Texture>;
}

const textureUrls: Record<B4VisualTextureKind, string> = {
  floor: floorUrl,
  pallet: palletUrl,
  carton: cartonUrl,
  steel: steelUrl,
  hazard: hazardUrl,
  spriteAtlas: spriteAtlasUrl,
};

const textureCache = new Map<B4VisualTextureKind, B4TextureEntry>();
const textureLoader = new THREE.TextureLoader();

/**
 * Original Max Flix visual pack. SVGs are bundled by Vite, loaded once and
 * shared by Campaign props, Survival cover and the PvP arena.
 */
function createEntry(kind: B4VisualTextureKind): B4TextureEntry {
  const url = textureUrls[kind];
  let resolveReady!: (texture: THREE.Texture) => void;
  const ready = new Promise<THREE.Texture>((resolve) => { resolveReady = resolve; });
  const texture = textureLoader.load(
    url,
    () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolveReady(texture);
    },
    undefined,
    (error) => {
      console.warn('[B4 Asset Pack] Visual texture could not be loaded:', kind, error);
      // The texture is already a valid Three.js object. Resolve fail-soft so
      // asset loading never blocks the first playable frame.
      resolveReady(texture);
    },
  );
  texture.name = 'max-flix-b4-' + kind;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = kind === 'spriteAtlas' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapT = kind === 'spriteAtlas' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(kind, { texture, ready });
  return textureCache.get(kind)!;
}

/** Synchronous handle for materials; the returned texture finishes loading in the background. */
export function getB4VisualTexture(kind: B4VisualTextureKind): THREE.Texture {
  return (textureCache.get(kind) || createEntry(kind)).texture;
}

/** Await this from the asset warm-up path to ensure the SVG is decoded before gameplay. */
export function preloadB4VisualTexture(kind: B4VisualTextureKind): Promise<THREE.Texture> {
  return (textureCache.get(kind) || createEntry(kind)).ready;
}

const spriteFrames: Record<B4SpriteKind, { x: number; y: number }> = {
  worker: { x: 0, y: 0.5 },
  zombie: { x: 0.5, y: 0.5 },
  forklift: { x: 0, y: 0 },
  pallet: { x: 0.5, y: 0 },
};

/** Creates a crisp alpha-cut sprite from the original four-frame B4 atlas. */
export function createB4SpriteDecal(kind: B4SpriteKind, width = 0.32, height = 0.32): THREE.Mesh {
  const texture = getB4VisualTexture('spriteAtlas').clone();
  const frame = spriteFrames[kind];
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(0.5, 0.5);
  texture.offset.set(frame.x, frame.y);
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  decal.name = 'b4-sprite-decal-' + kind;
  decal.renderOrder = 3;
  return decal;
}

/** A detailed modular stack for new cargo cover and background dressing. */
export function createB4FreightStack(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'b4-original-freight-stack';

  const wood = new THREE.MeshStandardMaterial({
    map: getB4VisualTexture('pallet'),
    color: 0xd29a62,
    roughness: 0.9,
    metalness: 0.02,
  });
  const carton = new THREE.MeshStandardMaterial({
    map: getB4VisualTexture('carton'),
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.01,
  });
  const steel = new THREE.MeshStandardMaterial({
    map: getB4VisualTexture('steel'),
    color: 0x9bb0c4,
    roughness: 0.55,
    metalness: 0.52,
  });
  const safety = new THREE.MeshStandardMaterial({
    map: getB4VisualTexture('hazard'),
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.08,
  });

  // Three separated pallet runners and a timber deck.
  for (const z of [-0.72, 0, 0.72]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.2), wood);
    runner.position.set(0, 0.09, z);
    runner.castShadow = true;
    runner.receiveShadow = true;
    group.add(runner);
  }
  for (const z of [-0.78, -0.39, 0, 0.39, 0.78]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.1, 0.32), wood);
    board.position.set(0, 0.23, z);
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);
  }

  const boxes = [
    { x: -0.63, y: 0.78, z: -0.28, w: 1.18, h: 0.96, d: 1.05 },
    { x: 0.62, y: 0.72, z: 0.30, w: 1.1, h: 0.84, d: 0.92 },
    { x: -0.05, y: 1.62, z: 0.22, w: 1.18, h: 0.8, d: 0.98 },
  ];
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), carton);
    mesh.position.set(box.x, box.y, box.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(box.w + 0.018, 0.06, box.d + 0.018),
      i === 1 ? safety : steel,
    );
    strap.position.set(box.x, box.y + box.h * 0.24, box.z);
    group.add(strap);

    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.055, box.h * 0.86, 0.055), steel);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const rail = corner.clone();
      rail.position.set(box.x + sx * (box.w * 0.5 - 0.035), box.y, box.z + sz * (box.d * 0.5 - 0.035));
      group.add(rail);
    }
  }

  const badge = createB4SpriteDecal('pallet', 0.42, 0.42);
  badge.position.set(-0.63, 0.78, 0.252);
  group.add(badge);
  const warning = createB4SpriteDecal('worker', 0.34, 0.34);
  warning.position.set(0.62, 0.72, 0.765);
  group.add(warning);

  return group;
}

/** Thin wall-mounted signage for the arena and warehouse route landmarks. */
export function createB4WallSprite(kind: B4SpriteKind, width = 1.25, height = 1.25): THREE.Sprite {
  const mesh = createB4SpriteDecal(kind, width, height);
  const material = mesh.material as THREE.MeshBasicMaterial;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: material.map,
    transparent: true,
    alphaTest: 0.12,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.name = 'b4-world-sprite-' + kind;
  sprite.scale.set(width, height, 1);
  mesh.geometry.dispose();
  material.dispose();
  return sprite;
}
