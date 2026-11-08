import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { disposePvpObjectTree } from '../src/pvpResourceCleanup.ts';

test('disposes shared PvP geometry, material and texture exactly once', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

  let geometryDisposals = 0;
  let textureDisposals = 0;
  let materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  texture.addEventListener('dispose', () => textureDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);

  disposePvpObjectTree(root);

  assert.equal(geometryDisposals, 1);
  assert.equal(textureDisposals, 1);
  assert.equal(materialDisposals, 1);
});

test('collects textures from material arrays and shader uniform values', () => {
  const root = new THREE.Group();
  const textureA = new THREE.Texture();
  const textureB = new THREE.Texture();
  const uniformTexture = new THREE.Texture();
  const arrayMaterial = [
    new THREE.MeshBasicMaterial({ map: textureA }),
    new THREE.MeshBasicMaterial({ alphaMap: textureB }),
  ];
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), arrayMaterial));
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: uniformTexture } },
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
  });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shaderMaterial));

  const disposed = new Map([[textureA, 0], [textureB, 0], [uniformTexture, 0]]);
  for (const texture of disposed.keys()) texture.addEventListener('dispose', () => disposed.set(texture, disposed.get(texture) + 1));

  disposePvpObjectTree(root);

  assert.equal(disposed.get(textureA), 1);
  assert.equal(disposed.get(textureB), 1);
  assert.equal(disposed.get(uniformTexture), 1);
});

test('arena rebuild and exit clean up arena and projectile resources', async () => {
  const { readFile } = await import('node:fs/promises');
  const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.match(game, /disposePvpObjectTree\(this\.pvpArenaRoot\)/);
  assert.match(game, /disposePvpObjectTree\(mesh\)/);
  assert.match(game, /const palletMat = new THREE\.MeshStandardMaterial/);
  assert.match(game, /const barrierMat = new THREE\.MeshStandardMaterial/);
  assert.match(game, /const pillarMat = new THREE\.MeshStandardMaterial/);
});
