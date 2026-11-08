import * as THREE from 'three';
import {
  getFloorTexture,
  getWallTexture,
  getShowroomMarbleFloorTexture,
  getShowroomWallTexture,
  getTerminalGraniteFloorTexture,
  getHazardStripeTexture,
} from './warehouseAssets.ts';

export interface AssetItem {
  id: string;
  name: string;
  category: 'texture' | 'model' | 'audio';
  execute: () => any;
}

const WAREHOUSE_TIPS = [
  'Wskazówka: Zbieraj worki z fugą i złote palety, by zdobywać punkty i odblokować premie zmiany!',
  'Wózek widłowy z sektora B4 nie wybacza błędów BHP — przeskakuj go w odpowiednim momencie!',
  'Impuls audytu ogłusza wrogów i zatrzymuje pojazdy w promieniu 4 metrów.',
  'Operator 02 z łatwością rozbija palety z towarem i przeszkody.',
  'Energetyczny napój natychmiast odnawia punkty BHP bohatera.',
  'Uważaj na Nadzorcę Zero w Sektorze 3 — w drugiej fazie wpada w szał!',
  'Spieki wielkoformatowe Marmur B4 120x280 w Showroomie wymagają podwójnej ostrożności.',
  'Przycisk C przełącza dynamiczną kamerę 3D: rzut izometryczny lub akcję zza pleców.'
];

export class B4AssetLoader {
  private isLoaded = false;
  private isLoading = false;
  private preloadPromise: Promise<void> | null = null;
  private progress = 0;

  // DOM Elements
  private overlayElem: HTMLElement | null = null;
  private fillElem: HTMLElement | null = null;
  private textElem: HTMLElement | null = null;
  private percentElem: HTMLElement | null = null;
  private categoryBadgeElem: HTMLElement | null = null;
  private tipTextElem: HTMLElement | null = null;
  private spinnerIconElem: HTMLElement | null = null;

  private catPills: Record<string, HTMLElement | null> = {};
  private catCounts: Record<string, HTMLElement | null> = {};

  public loadingManager!: THREE.LoadingManager;
  public textureLoader!: THREE.TextureLoader;
  private loadedAssets: Map<string, { category: string; durationMs: number; success: boolean }> = new Map();
  private assetCache: Map<string, any> = new Map();

  private tipInterval: any = null;
  private tipIndex = 0;

  constructor() {
    this.bindOrBuildOverlayUI();
    this.initLoadingManager();
  }

  private initLoadingManager() {
    this.loadingManager = new THREE.LoadingManager();

    this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
      console.log(`%c[AssetLoader:LoadingManager] 🚀 Start kolejki ładowania (${itemsTotal} pozycji)...`, 'color: #38bdf8; font-weight: bold;');
    };

    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const pct = Math.round((itemsLoaded / itemsTotal) * 100);
      this.updateProgress(pct, `Wczytywanie: ${url.split('/').pop()} (${pct}%)`);
    };

    this.loadingManager.onLoad = () => {
      console.log(`%c[AssetLoader:LoadingManager] ✅ Wszystkie zarejestrowane zasoby zostały przetworzone.`, 'color: #22c55e; font-weight: bold;');
      this.isLoaded = true;
    };

    this.loadingManager.onError = (url) => {
      console.warn(`%c[AssetLoader:LoadingManager] ⚠️ Fallback zasobu: ${url}`, 'color: #ef4444; font-weight: bold;');
    };

    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
  }

  private bindOrBuildOverlayUI() {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('asset-loader-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'asset-loader-overlay';
      overlay.className = 'asset-loader-overlay';
      overlay.innerHTML = `
        <div class="loader-modal-card">
          <div class="loader-icon-spinner" id="loader-spinner-icon">🏗️</div>
          <div class="loader-header">CENTRUM B4 3D LOGISTICS ENGINE</div>
          <div class="loader-subtitle" id="loader-subtitle">Inicjalizacja zasobów 3D, tekstur i silnika fizyki...</div>
          
          <div class="loader-categories-grid">
            <div class="loader-category-pill" id="cat-pill-textures">
              <span class="cat-icon">🎨</span>
              <div class="cat-info">
                <span class="cat-name">Tekstury</span>
                <span class="cat-count" id="cat-count-textures">0/6</span>
              </div>
            </div>
            <div class="loader-category-pill" id="cat-pill-models">
              <span class="cat-icon">🗿</span>
              <div class="cat-info">
                <span class="cat-name">Modele 3D</span>
                <span class="cat-count" id="cat-count-models">NA ŻĄDANIE</span>
              </div>
            </div>
            <div class="loader-category-pill" id="cat-pill-audio">
              <span class="cat-icon">🔊</span>
              <div class="cat-info">
                <span class="cat-name">Audio</span>
                <span class="cat-count" id="cat-count-audio">PO DOTKNIĘCIU</span>
              </div>
            </div>
            <div class="loader-category-pill" id="cat-pill-engine">
              <span class="cat-icon">⚙️</span>
              <div class="cat-info">
                <span class="cat-name">Silnik 3D</span>
                <span class="cat-count" id="cat-count-engine">OK</span>
              </div>
            </div>
          </div>

          <div class="loader-track">
            <div id="loader-fill" class="loader-fill" style="width: 0%"></div>
          </div>

          <div class="loader-meta">
            <div class="loader-status-col">
              <span id="loader-category-badge" class="loader-category-badge badge-engine">SYSTEM</span>
              <span id="loader-status-text" class="loader-status-text">Inicjalizacja systemu...</span>
            </div>
            <span id="loader-percent" class="loader-percent tabular-nums">0%</span>
          </div>

          <div class="loader-tip-box">
            <span class="tip-icon">💡</span>
            <span id="loader-tip-text" class="tip-text">Wskazówka: Zbieraj worki z fugą i złote palety, by zdobywać punkty i odblokować premie zmiany!</span>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    this.overlayElem = overlay;
    this.fillElem = document.getElementById('loader-fill');
    this.textElem = document.getElementById('loader-status-text');
    this.percentElem = document.getElementById('loader-percent');
    this.categoryBadgeElem = document.getElementById('loader-category-badge');
    this.tipTextElem = document.getElementById('loader-tip-text');
    this.spinnerIconElem = document.getElementById('loader-spinner-icon');

    this.catPills = {
      texture: document.getElementById('cat-pill-textures'),
      model: document.getElementById('cat-pill-models'),
      audio: document.getElementById('cat-pill-audio'),
      engine: document.getElementById('cat-pill-engine'),
    };

    this.catCounts = {
      texture: document.getElementById('cat-count-textures'),
      model: document.getElementById('cat-count-models'),
      audio: document.getElementById('cat-count-audio'),
      engine: document.getElementById('cat-count-engine'),
    };
  }

  public show(message: string = 'Wczytywanie...', initialPercent?: number) {
    if (this.overlayElem) {
      this.overlayElem.classList.remove('hidden', 'fade-out');
      this.overlayElem.style.display = 'flex';
    }
    if (initialPercent !== undefined) {
      this.progress = initialPercent;
    }
    this.updateProgress(this.progress, message);
    this.startTipsRotation();
  }

  public hide() {
    this.stopTipsRotation();
    if (!this.overlayElem) return;

    this.overlayElem.classList.add('fade-out');
    setTimeout(() => {
      if (this.overlayElem) {
        this.overlayElem.classList.add('hidden');
        this.overlayElem.style.display = 'none';
      }
    }, 420);
  }

  public updateCategory(category: 'texture' | 'model' | 'audio' | 'engine', current: number, total: number) {
    const countElem = this.catCounts[category];
    if (countElem) {
      if (category === 'engine') {
        countElem.textContent = current >= total ? 'GOTOWY' : `${current}/${total}`;
      } else {
        countElem.textContent = `${current}/${total}`;
      }
    }

    const pillElem = this.catPills[category];
    if (pillElem) {
      if (current >= total && total > 0) {
        pillElem.classList.remove('active');
        pillElem.classList.add('complete');
      } else if (current > 0) {
        pillElem.classList.add('active');
      }
    }
  }

  public updateProgress(
    percent: number,
    message: string,
    category: 'texture' | 'model' | 'audio' | 'engine' = 'engine',
    badgeText?: string
  ) {
    this.progress = Math.min(Math.max(percent, 0), 100);

    if (this.fillElem) {
      this.fillElem.style.width = `${this.progress}%`;
    }
    if (this.textElem) {
      this.textElem.textContent = message;
    }
    if (this.percentElem) {
      this.percentElem.textContent = `${Math.round(this.progress)}%`;
    }

    if (this.categoryBadgeElem) {
      this.categoryBadgeElem.className = `loader-category-badge badge-${category}`;
      const defaultLabels: Record<string, string> = {
        texture: 'TEKSTURA',
        model: 'MODEL 3D',
        audio: 'DŹWIĘK',
        engine: 'SILNIK',
      };
      this.categoryBadgeElem.textContent = badgeText || defaultLabels[category] || 'SYSTEM';
    }

    // Switch icon depending on active category
    if (this.spinnerIconElem) {
      const icons: Record<string, string> = {
        texture: '🎨',
        model: '🗿',
        audio: '🔊',
        engine: '⚙️',
      };
      this.spinnerIconElem.textContent = icons[category] || '🏗️';
    }
  }

  public setTip(text: string) {
    if (this.tipTextElem) {
      this.tipTextElem.textContent = text;
    }
  }

  private startTipsRotation() {
    if (this.tipInterval) return;
    this.tipInterval = setInterval(() => {
      this.tipIndex = (this.tipIndex + 1) % WAREHOUSE_TIPS.length;
      this.setTip(WAREHOUSE_TIPS[this.tipIndex]);
    }, 2800);
  }

  private stopTipsRotation() {
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
      this.tipInterval = null;
    }
  }

  public preloadAll(): Promise<void> {
    if (this.isLoaded) return Promise.resolve();
    if (this.preloadPromise) return this.preloadPromise;

    this.isLoading = true;
    this.show('Inicjalizacja zasobów 3D...');

    this.preloadPromise = (async () => {
      const overallStartTime = performance.now();
      console.group('%c[AssetLoader] 🔍 INSPEKCJA ZASOBÓW: Inicjalizacja modeli 3D i tekstur', 'color: #38bdf8; font-weight: bold;');

      // Warm only the six procedural textures that are referenced by the runtime.
      // Operators, bosses and props are created on demand; prebuilding every model
      // here duplicated GPU resources before the player had even opened the menu.
      // WebAudio is also initialized lazily from the first user gesture.
      const assetList: AssetItem[] = [
        { id: 'textures/floor_epoxy_warehouse.canvas', name: 'Polerowana Posadzka Epoksydowa (Sektor 1)', category: 'texture', execute: () => getFloorTexture() },
        { id: 'textures/wall_corrugated_metal.canvas', name: 'Blacha Przemysłowa Magazynu', category: 'texture', execute: () => getWallTexture() },
        { id: 'textures/showroom_marble_calacatta.canvas', name: 'Spiek Biały Marmur (Showroom)', category: 'texture', execute: () => getShowroomMarbleFloorTexture() },
        { id: 'textures/showroom_oak_slat_wall.canvas', name: 'Ściany Lamele Dębowe', category: 'texture', execute: () => getShowroomWallTexture() },
        { id: 'textures/terminal_granite_floor.canvas', name: 'Granit Przemysłowy Rampy B1', category: 'texture', execute: () => getTerminalGraniteFloorTexture() },
        { id: 'textures/hazard_warning_stripes.canvas', name: 'Pasy Ostrzegawcze BHP Żółto-Czarne', category: 'texture', execute: () => getHazardStripeTexture() }
      ];

      const totalTextures = assetList.length;
      let loadedTextures = 0;

      // Sequential batch processing with visual rendering yields
      const batchSize = 2;
      for (let i = 0; i < assetList.length; i += batchSize) {
        const batch = assetList.slice(i, i + batchSize);

        for (const item of batch) {
          const itemStartTime = performance.now();
          this.loadingManager.itemStart(item.id);

          try {
            const result = item.execute();
            const duration = Math.round(performance.now() - itemStartTime);
            this.loadedAssets.set(item.id, { category: item.category, durationMs: duration, success: true });
            if (result) {
              this.assetCache.set(item.id, result);
            }
            this.loadingManager.itemEnd(item.id);

            loadedTextures++;
            this.updateCategory('texture', loadedTextures, totalTextures);

            // Texture warming covers 0% to 70% of engine bootstrap.
            const currentPct = Math.round((loadedTextures / totalTextures) * 70);
            this.updateProgress(currentPct, `Wczytano: ${item.name}`, item.category);

          } catch (err) {
            console.warn(`[AssetLoader] ⚠️ Safe mode fallback dla zasobu ${item.id}:`, err);
            this.loadedAssets.set(item.id, { category: item.category, durationMs: 0, success: false });
            this.loadingManager.itemError(item.id);
            this.loadingManager.itemEnd(item.id);
          }

          // Small yield to allow browser DOM paint and smooth CSS animation
          await new Promise(r => setTimeout(r, 20));
        }

        // Do not gate boot on requestAnimationFrame: browsers pause RAF when
        // a mobile tab/app is backgrounded, which can leave the loader frozen
        // forever after returning to the game. A short task yield is reliable.
        await new Promise<void>(resolve => setTimeout(resolve, 16));
      }

      const totalTime = Math.round(performance.now() - overallStartTime);
      console.log(`%c[AssetLoader] 🏁 Załadowano ${assetList.length} zasobów w ${totalTime} ms.`, 'color: #22c55e; font-weight: bold;');
      console.groupEnd();

      this.updateCategory('texture', totalTextures, totalTextures);

      this.isLoaded = true;
      this.isLoading = false;
    })();

    return this.preloadPromise;
  }

  public async waitUntilReady(actionName: string = 'Uruchamianie'): Promise<void> {
    if (this.isLoaded) return;
    this.show(`Przygotowywanie zasobów (${actionName})...`);
    await this.preloadAll();
  }

  public getAsset<T = any>(id: string): T | null {
    return this.assetCache.get(id) || null;
  }

  public getClone<T = any>(id: string): T | null {
    const asset = this.assetCache.get(id);
    if (!asset) return null;
    if (asset.clone && typeof asset.clone === 'function') {
      return asset.clone(true) as unknown as T;
    }
    return asset as unknown as T;
  }
}

export const assetLoader = new B4AssetLoader();
