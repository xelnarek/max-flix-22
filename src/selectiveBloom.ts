import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { shouldEnableSelectiveBloom } from './bloomPolicy.ts';

type DarkenableMaterial = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

interface DarkenedMesh {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
}

export class SelectiveBloomPipeline {
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly renderPass: RenderPass;
  private readonly darkMaterialCache = new Map<THREE.Material, THREE.Material>();
  private readonly candidates: THREE.Mesh[] = [];
  private readonly overlayScene = new THREE.Scene();
  private readonly overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly overlayMaterial: THREE.ShaderMaterial;
  private readonly overlayQuad: THREE.Mesh;
  private readonly isMobile: boolean;
  private lastScanAt = 0;
  private enabled = false;
  private disposed = false;
  private failureLogged = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    pixelRatio: number,
    isMobile: boolean
  ) {
    this.isMobile = isMobile;

    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    target.texture.name = 'MaxFliz selective bloom input';

    this.composer = new EffectComposer(renderer, target);
    this.composer.renderToScreen = false;
    this.renderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      isMobile ? 0.68 : 0.88,
      0.42,
      0.78
    );
    this.bloomPass.renderToScreen = false;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);

    this.overlayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        bloomTexture: { value: this.bloomPass.renderTargetsHorizontal[0].texture },
        bloomStrength: { value: isMobile ? 0.34 : 0.42 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D bloomTexture;
        uniform float bloomStrength;
        varying vec2 vUv;
        void main() {
          vec3 bloom = texture2D(bloomTexture, vUv).rgb;
          gl_FragColor = vec4(bloom * bloomStrength, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.overlayQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.overlayMaterial);
    this.overlayQuad.frustumCulled = false;
    this.overlayScene.add(this.overlayQuad);

    this.resize(width, height, pixelRatio);
    this.refreshCandidates(0);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    if (this.disposed) return;
    const scale = this.isMobile ? 0.52 : 0.64;
    const cap = this.isMobile ? 0.9 : 1.15;
    this.composer.setPixelRatio(Math.max(0.35, Math.min(cap, pixelRatio * scale)));
    this.composer.setSize(Math.max(1, width), Math.max(1, height));
  }

  render(camera: THREE.Camera, fps: number, now: number): void {
    if (this.disposed) return;

    this.enabled = shouldEnableSelectiveBloom(fps, this.isMobile, this.enabled);
    this.renderPass.camera = camera;
    if (!this.enabled || this.renderer.xr.isPresenting || camera instanceof THREE.ArrayCamera) {
      this.renderer.render(this.scene, camera);
      return;
    }

    if (now - this.lastScanAt >= 1200) this.refreshCandidates(now);

    const darkened: DarkenedMesh[] = [];
    const previousBackground = this.scene.background;
    const previousAutoClear = this.renderer.autoClear;

    try {
      // Only clearly emissive meshes remain bright. Other opaque geometry is
      // rendered black so it still writes depth and occludes emitters behind it.
      for (const mesh of this.candidates) {
        if (!mesh.visible) continue;
        const original = mesh.material;
        if (this.isEmissive(original)) continue;
        darkened.push({ mesh, original });
        mesh.material = Array.isArray(original)
          ? original.map((material) => this.getDarkMaterial(material))
          : this.getDarkMaterial(original);
      }

      this.scene.background = new THREE.Color(0x000000);
      this.composer.render();
    } catch (error) {
      if (!this.failureLogged) {
        console.warn('Selective Bloom disabled after a render error:', error);
        this.failureLogged = true;
      }
      this.enabled = false;
    } finally {
      for (let i = darkened.length - 1; i >= 0; i--) {
        darkened[i].mesh.material = darkened[i].original;
      }
      this.scene.background = previousBackground;
    }

    // Always draw the actual scene first; the lower-resolution bloom texture
    // is then additively composited without allocating a second full-size composer.
    this.renderer.render(this.scene, camera);
    if (this.enabled) {
      try {
        this.renderer.autoClear = false;
        this.renderer.render(this.overlayScene, this.overlayCamera);
      } catch (error) {
        if (!this.failureLogged) {
          console.warn('Selective Bloom overlay disabled after a render error:', error);
          this.failureLogged = true;
        }
        this.enabled = false;
      } finally {
        this.renderer.autoClear = previousAutoClear;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.composer.dispose();
    this.overlayQuad.removeFromParent();
    this.overlayQuad.geometry.dispose();
    this.overlayMaterial.dispose();
    for (const material of this.darkMaterialCache.values()) material.dispose();
    this.darkMaterialCache.clear();
    this.candidates.length = 0;
  }

  private refreshCandidates(now: number): void {
    this.lastScanAt = now;
    this.candidates.length = 0;
    const liveMaterials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.material) return;
      this.candidates.push(object);
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      entries.forEach((material) => liveMaterials.add(material));
    });
    for (const [original, dark] of this.darkMaterialCache) {
      if (!liveMaterials.has(original)) {
        dark.dispose();
        this.darkMaterialCache.delete(original);
      }
    }
  }

  private isEmissive(material: THREE.Material | THREE.Material[]): boolean {
    const entries = Array.isArray(material) ? material : [material];
    return entries.some((entry) => {
      const candidate = entry as DarkenableMaterial;
      if (!candidate.emissive) return false;
      const intensity = candidate.emissiveIntensity ?? 1;
      const peak = Math.max(candidate.emissive.r, candidate.emissive.g, candidate.emissive.b);
      return intensity >= 0.34 && peak >= 0.15;
    });
  }

  private getDarkMaterial(original: THREE.Material): THREE.Material {
    const cached = this.darkMaterialCache.get(original);
    if (cached) return cached;

    let dark: THREE.Material;
    if (original instanceof THREE.ShaderMaterial) {
      dark = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: original.side,
        transparent: original.transparent,
        opacity: original.opacity,
        depthTest: original.depthTest,
        depthWrite: original.depthWrite,
        blending: original.blending,
        alphaTest: original.alphaTest,
      });
    } else {
      dark = original.clone();
      const candidate = dark as DarkenableMaterial;
      candidate.color?.setRGB(0, 0, 0);
      candidate.emissive?.setRGB(0, 0, 0);
      if (candidate.emissiveIntensity !== undefined) candidate.emissiveIntensity = 0;
    }

    this.darkMaterialCache.set(original, dark);
    return dark;
  }
}
