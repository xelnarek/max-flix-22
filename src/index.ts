import * as THREE from 'three';
import * as xb from 'xrblocks';
import { CHARACTERS } from './characters.ts';
import {
  ensureLeaderboardServices,
  submitScore,
  getTopLeaderboard,
  testFirestoreConnection,
} from './firebase.ts';
import { MaxFlizGameEngine, type SurvivalSnapshot, type SurvivalUpgradeOption } from './game.ts';
import { sound } from './sound.ts';
import { PixelIntroManager } from './pixelIntro.ts';
import { CharacterId, PerkType } from './types.ts';
import { AssetItem, assetLoader } from './assets.ts';

// warehouseAssets imports moved to assets.ts where they are preloaded

// Global Unhandled Error Logger
window.addEventListener('error', (e) => {
  console.warn('Global Error Captured:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled Rejection Captured:', e.reason);
});

// Portraits are hand-authored vector caricatures: real faces and workwear, not generic role emoji.
const operatorPortrait = (id: CharacterId): string => {
  const people: Record<CharacterId, { skin: string; hair: string; shirt: string; accent: string; helmet: string; beard: string; brows: string; cap?: boolean }> = {
    marcin: { skin: '#e9b995', hair: '#49342a', shirt: '#1e3a8a', accent: '#f0f4f8', helmet: '#f8fafc', beard: '', brows: '#49342a' },
    grzesiek: { skin: '#d9a27f', hair: '#2c211c', shirt: '#166534', accent: '#facc15', helmet: '#facc15', beard: '#29201d', brows: '#29201d' },
    dawid: { skin: '#e4b18d', hair: '#4a2c20', shirt: '#b45309', accent: '#fb923c', helmet: '#f97316', beard: '#4b2d22', brows: '#382219' },
    mateusz: { skin: '#e7b99c', hair: '#362820', shirt: '#5b21b6', accent: '#c4b5fd', helmet: '#7c3aed', beard: '#45362f', brows: '#362820', cap: true },
    piotr: { skin: '#d4a585', hair: '#77736d', shirt: '#7f1d1d', accent: '#ef4444', helmet: '#dc2626', beard: '#77736d', brows: '#66615c' },
  };
  const p = people[id];
  const helmet = p.cap
    ? `<path d="M22 27 Q26 8 50 12 Q68 15 67 31 L54 29 Q41 25 22 32Z" fill="${p.helmet}" stroke="#111827" stroke-opacity=".5" stroke-width="2"/><path d="M54 26 Q70 25 75 33 Q62 38 49 32Z" fill="${p.accent}"/><path d="M27 17 Q19 6 15 15" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round"/>`
    : `<path d="M17 31 Q18 9 48 8 Q77 9 79 31 L75 34 Q49 25 21 35Z" fill="${p.helmet}" stroke="#172033" stroke-opacity=".62" stroke-width="2"/><path d="M15 29 Q48 22 81 30 L82 36 Q47 31 14 38Z" fill="${p.accent}" stroke="#172033" stroke-opacity=".45" stroke-width="1.5"/><path d="M33 20 L61 20" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>`;
  const beard = p.beard
    ? `<path d="M28 60 Q48 70 68 60 L65 76 Q58 87 48 87 Q36 86 30 75Z" fill="${p.beard}"/>`
    : '';
  const capExtra = p.cap
    ? `<path d="M25 22 Q45 17 64 25" fill="none" stroke="#e9d5ff" stroke-width="2.5"/><circle cx="68" cy="30" r="3" fill="#f472b6"/>`
    : `<rect x="39" y="29" width="18" height="5" rx="2.5" fill="${p.accent}" opacity=".95"/>`;
  return `<svg class="operator-portrait" viewBox="0 0 96 96" role="img" aria-label="Portret operatora ${id}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="op-bg-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.shirt}"/><stop offset="1" stop-color="#0b1420"/></linearGradient><linearGradient id="op-face-${id}" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#f4d0ae"/><stop offset="1" stop-color="${p.skin}"/></linearGradient></defs>
    <rect x="2" y="2" width="92" height="92" rx="19" fill="url(#op-bg-${id})"/>
    <path d="M8 96 Q10 74 30 69 L66 69 Q87 75 89 96Z" fill="${p.shirt}"/>
    <path d="M27 75 L38 65 L58 65 L70 76 L64 96 L32 96Z" fill="${p.accent}" opacity=".82"/>
    <path d="M40 61 L56 61 L59 73 L48 81 L37 73Z" fill="${p.skin}"/>
    <ellipse cx="48" cy="45" rx="24" ry="27" fill="url(#op-face-${id})"/>
    <path d="M24 43 Q20 16 47 16 Q75 16 72 44 Q66 32 58 30 Q43 34 28 29Z" fill="${p.hair}"/>
    <ellipse cx="23" cy="47" rx="4.2" ry="7" fill="${p.skin}"/><ellipse cx="73" cy="47" rx="4.2" ry="7" fill="${p.skin}"/>
    <path d="M32 43 Q38 39 43 43 M54 43 Q60 39 65 43" fill="none" stroke="${p.brows}" stroke-width="3.4" stroke-linecap="round"/>
    <ellipse cx="38" cy="48" rx="2.8" ry="3.3" fill="#152033"/><ellipse cx="59" cy="48" rx="2.8" ry="3.3" fill="#152033"/>
    <path d="M48 48 L45 57 Q48 60 51 57" fill="none" stroke="#a86f58" stroke-width="2" stroke-linecap="round"/>
    <path d="M39 63 Q48 68 58 62" fill="none" stroke="#713d36" stroke-width="2.5" stroke-linecap="round"/>
    ${beard}
    ${helmet}
    ${capExtra}
    <path d="M9 85 L28 77 M87 85 L68 77" stroke="#e2e8f0" stroke-opacity=".45" stroke-width="2"/>
    <circle cx="78" cy="77" r="4" fill="${p.accent}" stroke="#f8fafc" stroke-opacity=".7" stroke-width="1"/>
  </svg>`;
};

class MaxFlizScene extends xb.Script {
  private engine!: MaxFlizGameEngine;
  private pixelIntro: PixelIntroManager | null = null;
  private selectedCharId: CharacterId = 'marcin';
  private selectedLevelId: number = 1;
  private lastScore: number = 0;
  private lastCoins: number = 0;
  private lastTimeSeconds: number = 0;
  private lastBossDefeated: boolean = false;
  private camera: THREE.PerspectiveCamera;
  private fallbackScene: THREE.Scene;
  private lastLoopTick: number = performance.now();
  private particleSystem: THREE.Points | null = null;
  private lastFpsTime: number = performance.now();
  private frameCount: number = 0;
  private currentFps: number = 60;
  private lastMinimapRenderAt: number = 0;
  private pausedForVisibility: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastAdaptiveQualityAt: number = 0;

  // Duplicate init() and update() removed from here. Handled at the bottom of the class.

  constructor() {
    super();
    this.fallbackScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.setupUIAndEngine();
  }

  private setupUIAndEngine() {
    const handleResize = () => {
      // visualViewport reflects the usable viewport on mobile browsers when browser chrome changes size.
      const width = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth));
      const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight));
      const aspect = width / height;
      // Use the Poco F6's ~393 CSS-pixel portrait width as the baseline.
      // Avoid shrinking the entire interface on modern 6.6–6.7 inch phones.
      const uiScale = Math.min(1.12, Math.max(0.90, Math.min(width / 390, height / 780)));
      document.documentElement.style.setProperty('--ui-scale', uiScale.toFixed(3));

      if (this.camera) {
        if (aspect < 0.75) {
          this.camera.fov = 64;
        } else if (aspect < 1.0) {
          this.camera.fov = 58;
        } else if (aspect < 1.35) {
          this.camera.fov = 50;
        } else {
          this.camera.fov = 44;
        }
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
      }

      const renderer = (xb.core?.renderer as THREE.WebGLRenderer) || null;
      if (renderer) {
        // Set DPR before dimensions so Three.js recreates the drawing buffer at the final scale.
        const isMobile = width < 900 || ('ontouchstart' in window);
        // High-density mobile rendering: sharper textures and silhouettes on Poco F6.
        // The cap is intentional to prevent fill-rate spikes during dense survival waves.
        const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.65 : 2.0);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
      }

      if (this.engine && typeof this.engine.applyAutoCameraScaleForViewport === 'function') {
        this.engine.applyAutoCameraScaleForViewport();
      }
    };

    let resizeFrame = 0;
    const scheduleResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        handleResize();
      });
    };

    window.addEventListener('resize', scheduleResize, { passive: true });
    window.addEventListener('orientationchange', () => {
      window.setTimeout(scheduleResize, 180);
    }, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
    // Do not call handleResize() immediately here because xb.core.renderer is not ready yet.
    // It will be handled in the init() method below.

    const hudHeroName = document.getElementById('hud-hero-name');
    const hudHeroRole = document.getElementById('hud-hero-role');
    const heroAvatar = document.getElementById('hero-avatar');
    const hudHpRow = document.getElementById('hud-hp-row');
    const hudScore = document.getElementById('hud-score');
    const hudVip = document.getElementById('hud-vip');
    const hudTimer = document.getElementById('hud-timer');
    const abilityName = document.getElementById('ability-name');
    const abilityCooldownOverlay = document.getElementById('ability-cooldown-overlay');
    const abilityIcon = document.getElementById('ability-icon');

    const titleScreen = document.getElementById('title-screen');
    const gameShell = document.getElementById('game-shell');
    const hudTop = document.getElementById('hud-top');
    const hudBottom = document.getElementById('hud-bottom');
    const touchControls = document.getElementById('touch-controls');
    const pauseModal = document.getElementById('pause-modal');
    const victoryModal = document.getElementById('victory-modal');
    const gameoverModal = document.getElementById('gameover-modal');
    const survivalHud = document.getElementById('survival-hud');
    const survivalLevelUp = document.getElementById('survival-levelup');
    const survivalUpgradeOptions = document.getElementById('survival-upgrade-options');
    const survivalTimeElem = document.getElementById('survival-time');
    const survivalWaveElem = document.getElementById('survival-wave');
    const survivalLevelElem = document.getElementById('survival-level');
    const survivalXpElem = document.getElementById('survival-xp');
    const survivalXpFill = document.getElementById('survival-xp-fill');
    const survivalKillsElem = document.getElementById('survival-kills');
    const survivalEnemiesElem = document.getElementById('survival-enemies');
    const survivalRerollBtn = document.getElementById('btn-survival-reroll') as HTMLButtonElement | null;
    const survivalSkipBtn = document.getElementById('btn-survival-skip') as HTMLButtonElement | null;

    const victoryScore = document.getElementById('victory-score');
    const victoryTime = document.getElementById('victory-time');
    const gameoverReason = document.getElementById('gameover-reason');

    const bossHudBar = document.getElementById('boss-hud-bar');
    const bossNameElem = document.getElementById('boss-name');
    const bossHpTextElem = document.getElementById('boss-hp-text');
    const bossHpFillElem = document.getElementById('boss-hp-fill');

    const perkBadgeShield = document.getElementById('perk-badge-shield');
    const perkBadgeJump = document.getElementById('perk-badge-jump');
    const perkJumpTimer = document.getElementById('perk-jump-timer');
    const perkBadgeMagnet = document.getElementById('perk-badge-magnet');
    const perkMagnetTimer = document.getElementById('perk-magnet-timer');
    const perkBadgeSpeed = document.getElementById('perk-badge-speed');
    const perkSpeedTimer = document.getElementById('perk-speed-timer');
    const perkBadgeKfc = document.getElementById('perk-badge-kfc');
    const perkKfcTimer = document.getElementById('perk-kfc-timer');
    const perkBadgeBulldozer = document.getElementById('perk-badge-bulldozer');
    const perkBulldozerTimer = document.getElementById('perk-bulldozer-timer');

    const container = document.getElementById('game-canvas-container');
    if (container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(scheduleResize);
      this.resizeObserver.observe(container);
    }

    interface ActiveToast {
      element: HTMLElement;
      worldPos: THREE.Vector3;
      type: string;
      age: number;
      maxAge: number;
    }
    const activeToasts: ActiveToast[] = [];
    let globalLastDialogueTime = 0;

    const createDialogueCard = (text: string, speakerType: string, side: 'left' | 'right' = 'right', speakerName?: string) => {
      const containerElem = document.getElementById(side === 'left' ? 'dialogue-container-left' : 'dialogue-container-right');
      if (!containerElem) return;

      const now = Date.now();
      // Anti-spam: enforce global cooldown so dialogues don't stack and clutter the screen
      if (now - globalLastDialogueTime < 2600) return;
      globalLastDialogueTime = now;

      containerElem.replaceChildren();

      const card = document.createElement('div');
      const isHero = side === 'left';
      card.className = `dialogue-box-card ${isHero ? 'hero-style' : 'enemy-style'}`;

      const baseMeta = isHero ? getHeroMeta() : getEnemyMeta(speakerType);
      const meta = { ...baseMeta, name: speakerName || baseMeta.name };
      const avatar = document.createElement('div');
      avatar.className = 'dialogue-box-avatar';
      if (isHero) avatar.innerHTML = operatorPortrait(this.selectedCharId);
      else avatar.textContent = meta.avatar;
      const content = document.createElement('div');
      content.className = 'dialogue-box-content';
      const header = document.createElement('div');
      header.className = 'dialogue-box-header';
      const name = document.createElement('span');
      name.className = 'dialogue-box-name';
      name.textContent = meta.name;
      const role = document.createElement('span');
      role.className = 'dialogue-box-role';
      role.textContent = meta.role;
      header.append(name, role);
      const quote = document.createElement('p');
      quote.className = 'dialogue-box-text';
      quote.textContent = text;
      content.append(header, quote);
      card.append(avatar, content);
      containerElem.appendChild(card);

      setTimeout(() => {
        card.classList.add('fading-out');
        setTimeout(() => {
          if (card.parentElement === containerElem) card.remove();
        }, 300);
      }, 2600);
    };

    const getHeroMeta = () => {
      const def = CHARACTERS[this.selectedCharId];
      return {
        name: def.name,
        role: 'BOHATER LOGISTYKI',
        avatar: operatorPortrait(this.selectedCharId),
      };
    };

    const getEnemyMeta = (type: string) => {
      const metaMap: Record<string, { name: string; role: string; avatar: string }> = {
        kurier: { name: 'Rudy z DPD', role: 'Johnny Walker Express', avatar: '🚚' },
        walczak: { name: 'Walczak', role: 'Były Kierownik', avatar: '👔' },
        krol_leto: { name: 'Król-Leto', role: 'Dyrektor Generalny', avatar: '👑' },
        architect: { name: 'Architektka', role: 'Design & Beż', avatar: '🎨' },
        customer: { name: 'Klient', role: 'Awantura o Fugi', avatar: '📑' },
        handlowiec: { name: 'Handlowiec', role: 'Rabat 3%', avatar: '💼' },
        monter: { name: 'Monter', role: 'Glazurnik Pro', avatar: '🪚' },
        inspector: { name: 'Inspektor', role: 'BHP / PIP', avatar: '📋' },
        sztaplar_szalony: { name: 'Zdzichu', role: 'Mistrz Sztaplarki', avatar: '🚜' },
        pan_roman: { name: 'Pan Roman', role: 'Dostawa bez awiza', avatar: '📦' },
        serwisant: { name: 'Serwisant', role: 'Zgłoszenie 404', avatar: '🧰' },
        przedstawiciel_włoski: { name: 'Włoski dostawca', role: 'Mamma mia / armatura', avatar: '🇮🇹' },
        elite_walczak_guard: { name: 'Strażnik Walczaka', role: 'Ochrona Calacatty', avatar: '🛡️' },
        bosman_krakow: { name: 'Bosman z Krakowa', role: 'Odprawa 3-MSC', avatar: '📋' },
        agv_robot: { name: 'Robot AGV', role: 'Zgubiona trasa', avatar: '🤖' },
        piorun_dron: { name: 'PIORUN', role: 'Dron AI', avatar: '⚡' },
        zombie_pracownik: { name: 'Zombie-Magazynier', role: 'Głód KFC', avatar: '🧟' },
        pomazaniec: { name: 'Pomazaniec', role: 'Rowerowy rajd / lizaki', avatar: '🚲' },
        sebix_m: { name: 'Sebix M.', role: 'Taran B4 / cegły', avatar: '🔥' },
      };
      return metaMap[type] || { name: 'Pracownik', role: 'Magazyn', avatar: '👷' };
    };

    const spawnFloatingToast = (
      text: string,
      x: number,
      y: number,
      z: number,
      type: 'points' | 'vip' | 'easter-egg' | 'damage' | 'perk' | 'combo' | 'enemy_shout' = 'points',
      metadata?: any
    ) => {
      if (type === 'enemy_shout') {
        createDialogueCard(text, metadata?.enemyType || 'customer', 'right', metadata?.enemyName);
        return;
      }

      const popupsLayer = document.getElementById('floating-popups-layer');
      if (!popupsLayer) return;

      const toast = document.createElement('div');
      toast.className = `floating-score-toast ${type}`;
      toast.textContent = text;
      toast.style.position = 'absolute';
      toast.style.top = '0';
      toast.style.left = '0';
      toast.style.willChange = 'transform, opacity';
      popupsLayer.appendChild(toast);

      const duration = type === 'easter-egg' ? 3.6 : type === 'combo' ? 2.0 : 1.6;

      activeToasts.push({
        element: toast,
        worldPos: new THREE.Vector3(x, y, z),
        type,
        age: 0,
        maxAge: duration,
      });
    };

    (this as any)._updateToasts = (dt: number) => {
      const tempVec = new THREE.Vector3();
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      for (let i = activeToasts.length - 1; i >= 0; i--) {
        const t = activeToasts[i];
        t.age += dt;

        if (t.age >= t.maxAge) {
          t.element.remove();
          activeToasts.splice(i, 1);
          continue;
        }

        const floatSpeed = t.type === 'enemy_shout' ? 0.22 : t.type === 'easter-egg' ? 0.28 : 0.8;
        t.worldPos.y += dt * floatSpeed;

        tempVec.copy(t.worldPos);
        tempVec.project(this.camera);

        if (
          tempVec.z > 1.0 ||
          tempVec.x < -1.3 ||
          tempVec.x > 1.3 ||
          tempVec.y < -1.3 ||
          tempVec.y > 1.3
        ) {
          t.element.style.display = 'none';
          continue;
        }

        t.element.style.display = 'flex';
        const sx = (tempVec.x * 0.5 + 0.5) * screenW;
        const sy = (-(tempVec.y * 0.5) + 0.5) * screenH;

        t.element.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0px) translate(-50%, -50%)`;

        const progress = t.age / t.maxAge;
        let opacity = 1;
        if (progress < 0.08) {
          opacity = progress / 0.08;
        } else if (progress > 0.82) {
          opacity = (1 - progress) / 0.18;
        }
        t.element.style.opacity = opacity.toFixed(2);
      }
    };

    const showPerkDropBanner = (name: string, icon: string, desc: string, color: string) => {
      const banner = document.getElementById('perk-drop-banner');
      if (!banner) return;
      banner.style.borderColor = color;
      banner.style.boxShadow = `0 10px 30px -5px ${color}66`;
      banner.innerHTML = `
        <div class="perk-banner-icon">${icon}</div>
        <div class="perk-banner-text">
          <div class="perk-banner-title" style="color: ${color}">⚡ ZDOBYTO PERK: ${name.toUpperCase()}!</div>
          <div class="perk-banner-desc">${desc}</div>
        </div>
      `;
      banner.classList.remove('hidden');
      clearTimeout((banner as any)._timeout);
      (banner as any)._timeout = setTimeout(() => {
        banner.classList.add('hidden');
      }, 1800);
    };

    const hideSurvivalAnnouncement = () => {
      const announcement = document.getElementById('survival-event-announcement');
      if (!announcement) return;
      clearTimeout((announcement as any)._timeout);
      announcement.classList.add('hidden');
      announcement.classList.remove('is-visible');
    };

    const showSurvivalAnnouncement = (title: string, subtitle: string, detail: string) => {
      const announcement = document.getElementById('survival-event-announcement');
      const titleElement = document.getElementById('survival-event-title');
      const subtitleElement = document.getElementById('survival-event-subtitle');
      const detailElement = document.getElementById('survival-event-detail');
      if (!announcement || !titleElement || !subtitleElement || !detailElement) return;

      // textContent keeps event dialogue safe and avoids reparsing dynamic text as HTML.
      titleElement.textContent = title;
      subtitleElement.textContent = subtitle;
      detailElement.textContent = detail;
      clearTimeout((announcement as any)._timeout);
      announcement.classList.add('hidden');
      announcement.classList.remove('is-visible');
      void announcement.offsetWidth;
      announcement.classList.remove('hidden');
      announcement.classList.add('is-visible');
      (announcement as any)._timeout = window.setTimeout(() => {
        announcement.classList.add('hidden');
        announcement.classList.remove('is-visible');
      }, 6100);
    };

    this.engine = new MaxFlizGameEngine(
      this as unknown as THREE.Scene,
      this.camera,
      (container || document.body) as HTMLElement,
      {
        onFloatingText: (text, x, y, z, type, metadata) => {
          spawnFloatingToast(text, x, y, z, type, metadata);
        },
        onPerkDropBanner: (name, icon, desc, color) => {
          showPerkDropBanner(name, icon, desc, color);
        },
        onSurvivalAnnouncement: (title, subtitle, detail) => {
          showSurvivalAnnouncement(title, subtitle, detail);
        },
        onScoreUpdate: (score, collectedVip, totalVip) => {
          if (hudScore) hudScore.textContent = score.toString();
          if (hudVip) hudVip.textContent = `${collectedVip} / ${totalVip}`;
        },
        onHpUpdate: (hp, maxHp) => {
          if (!hudHpRow) return;
          hudHpRow.innerHTML = '';
          for (let i = 0; i < maxHp; i++) {
            const span = document.createElement('span');
            span.className = `hp-mug ${i < hp ? '' : 'lost'}`;
            span.textContent = '☕';
            hudHpRow.appendChild(span);
          }
        },
        onAbilityCooldown: (progress, ready) => {
          if (abilityCooldownOverlay) {
            abilityCooldownOverlay.style.width = `${(1 - progress) * 100}%`;
          }
          const btn = document.getElementById('btn-ability');
          if (btn) {
            btn.style.opacity = ready ? '1' : '0.6';
          }
        },
        onSpeechBubble: (text) => {
          if (text) {
            createDialogueCard(text, 'hero', 'left');
          }
        },
        onPerksUpdate: (perks) => {
          if (perkBadgeShield) {
            perkBadgeShield.classList.toggle('hidden', !perks.shield);
          }
          if (perkBadgeJump && perkJumpTimer) {
            if (perks.doubleJump > 0) {
              perkBadgeJump.classList.remove('hidden');
              perkJumpTimer.textContent = `${Math.ceil(perks.doubleJump)}s`;
            } else {
              perkBadgeJump.classList.add('hidden');
            }
          }
          if (perkBadgeMagnet && perkMagnetTimer) {
            if (perks.magnet > 0) {
              perkBadgeMagnet.classList.remove('hidden');
              perkMagnetTimer.textContent = `${Math.ceil(perks.magnet)}s`;
            } else {
              perkBadgeMagnet.classList.add('hidden');
            }
          }
          if (perkBadgeSpeed && perkSpeedTimer) {
            if (perks.speedBoost > 0) {
              perkBadgeSpeed.classList.remove('hidden');
              perkSpeedTimer.textContent = `${Math.ceil(perks.speedBoost)}s`;
            } else {
              perkBadgeSpeed.classList.add('hidden');
            }
          }
          if (perkBadgeKfc && perkKfcTimer) {
            const kfcTime = perks.kfcBerserk ?? 0;
            if (kfcTime > 0) {
              perkBadgeKfc.classList.remove('hidden');
              perkKfcTimer.textContent = `${Math.ceil(kfcTime)}s`;
            } else {
              perkBadgeKfc.classList.add('hidden');
            }
          }
          if (perkBadgeBulldozer && perkBulldozerTimer) {
            const bullTime = perks.bulldozer ?? 0;
            if (bullTime > 0) {
              perkBadgeBulldozer.classList.remove('hidden');
              perkBulldozerTimer.textContent = `${Math.ceil(bullTime)}s`;
            } else {
              perkBadgeBulldozer.classList.add('hidden');
            }
          }
          const perkTimers: Array<[string, number | undefined]> = [
            ['perk-badge-haste', perks.attackHaste],
            ['perk-badge-drone', perks.arcDrone],
            ['perk-badge-xp', perks.xpSurge],
            ['perk-badge-ward', perks.damageWard],
          ];
          for (const [id, remaining] of perkTimers) {
            const badge = document.getElementById(id);
            const timer = badge?.querySelector('.perk-timer');
            if (!badge) continue;
            badge.classList.toggle('hidden', !(remaining && remaining > 0));
            if (timer && remaining) timer.textContent = `${Math.ceil(remaining)}s`;
          }
        },
        onLevelComplete: (levelId, score, timeStr) => {
          this.lastScore = score;
          this.lastCoins = this.engine.getCollectedVipCount();
          this.lastTimeSeconds = this.engine.getElapsedSeconds();
          this.lastBossDefeated = this.engine.isBossDefeated();

          const victoryTitle = document.getElementById('victory-title');
          if (victoryTitle) {
            victoryTitle.textContent = levelId < 3 ? `SEKTOR ${levelId} ZALICZONY!` : 'MAGAZYN OPANOWANY!';
          }

          const btnNext = document.getElementById('btn-next-level');
          if (btnNext) {
            if (levelId < 3) {
              btnNext.classList.remove('hidden');
              btnNext.textContent = `WEJDŹ DO SEKTORA ${levelId + 1} ➡️`;
            } else {
              btnNext.classList.add('hidden');
            }
          }

          if (victoryScore) victoryScore.textContent = score.toString();
          if (victoryTime) victoryTime.textContent = timeStr;
          victoryModal?.classList.remove('hidden');
          hudTop?.classList.add('hidden');
          hudBottom?.classList.add('hidden');
          touchControls?.classList.add('hidden');
          bossHudBar?.classList.add('hidden');
          survivalHud?.classList.add('hidden');
          survivalLevelUp?.classList.add('hidden');

          const nickInput = document.getElementById('player-nickname-input') as HTMLInputElement | null;
          const submitBtn = document.getElementById('btn-submit-score') as HTMLButtonElement | null;
          const feedbackMsg = document.getElementById('submit-feedback-msg');
          if (nickInput) {
            const savedNick = localStorage.getItem('maxfliz_player_nick');
            nickInput.value = savedNick || `Kierownik ${CHARACTERS[this.selectedCharId].name}`;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 ZAPISZ W RANKINGU';
          }
          if (feedbackMsg) {
            feedbackMsg.className = 'submit-feedback hidden';
            feedbackMsg.textContent = '';
          }

          if (levelId < 3) {
            setTimeout(() => {
              if (victoryModal && !victoryModal.classList.contains('hidden')) {
                this.selectedLevelId = levelId + 1;
                this.engine.startGame(this.selectedLevelId);
                victoryModal.classList.add('hidden');
                hudTop?.classList.remove('hidden');
                hudBottom?.classList.remove('hidden');
                touchControls?.classList.remove('hidden');
              }
            }, 6500);
          }
        },
        onGameOver: (reason) => {
          hideSurvivalAnnouncement();
          if (gameoverReason) gameoverReason.textContent = reason;
          const container = document.getElementById('game-canvas-container');
          if (container) container.style.transform = '';
          if (gameoverModal) {
            gameoverModal.classList.remove('hidden');
            gameoverModal.style.setProperty('display', 'flex', 'important');
            gameoverModal.style.setProperty('pointer-events', 'auto', 'important');
          }
          hudTop?.classList.add('hidden');
          hudBottom?.classList.add('hidden');
          touchControls?.classList.add('hidden');
          bossHudBar?.classList.add('hidden');
          survivalHud?.classList.add('hidden');
          survivalLevelUp?.classList.add('hidden');
        },
        onSurvivalUpdate: (snapshot: SurvivalSnapshot) => {
          const minutes = Math.floor(snapshot.elapsedSeconds / 60);
          const seconds = snapshot.elapsedSeconds % 60;
          if (survivalTimeElem) survivalTimeElem.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
          if (survivalWaveElem) survivalWaveElem.textContent = String(snapshot.wave);
          if (survivalLevelElem) survivalLevelElem.textContent = String(snapshot.level);
          if (survivalXpElem) survivalXpElem.textContent = snapshot.xp + ' / ' + snapshot.xpToNext + ' XP';
          if (survivalXpFill) survivalXpFill.style.width = Math.min(100, (snapshot.xp / Math.max(1, snapshot.xpToNext)) * 100) + '%';
          if (survivalKillsElem) survivalKillsElem.textContent = String(snapshot.kills);
          if (survivalEnemiesElem) survivalEnemiesElem.textContent = String(snapshot.aliveEnemies);
          const weaponRack = document.getElementById('survival-weapons-list');
          if (weaponRack) {
            // The Survival snapshot refreshes four times per second; rebuild chips only when the arsenal changes.
            const signature = snapshot.weapons.map((weapon) => weapon.id + ':' + weapon.level + ':' + Number(weapon.evolved)).join('|');
            if (weaponRack.dataset.signature !== signature) {
              weaponRack.dataset.signature = signature;
              weaponRack.replaceChildren();
              if (!snapshot.weapons.length) {
                const starter = document.createElement('span');
                starter.className = 'survival-weapon-chip starter';
                starter.textContent = '🥊 Operator';
                starter.title = 'Broń operatora • broń podstawowa';
                weaponRack.appendChild(starter);
              }
              for (const weapon of snapshot.weapons) {
                const chip = document.createElement('span');
                chip.className = 'survival-weapon-chip' + (weapon.evolved ? ' evolved' : '');
                const fullLabel = weapon.icon + ' ' + weapon.name + ' • poziom ' + weapon.level + '/5' + (weapon.evolved ? ' • ewolucja' : '');
                chip.textContent = weapon.icon + ' ' + weapon.name + ' ' + weapon.level + '/5' + (weapon.evolved ? ' ✦' : '');
                chip.title = fullLabel;
                chip.setAttribute('aria-label', fullLabel);
                weaponRack.appendChild(chip);
              }
            }
          }
          if (survivalRerollBtn) {
            survivalRerollBtn.textContent = '🔄 PRZELOSUJ (' + snapshot.rerolls + ')';
            survivalRerollBtn.disabled = snapshot.rerolls <= 0;
          }
          if (survivalSkipBtn) {
            survivalSkipBtn.textContent = '⏭ POMIŃ (' + snapshot.skips + ')';
            survivalSkipBtn.disabled = snapshot.skips <= 0;
          }
        },
        onSurvivalLevelUp: (options: SurvivalUpgradeOption[]) => {
          if (!survivalUpgradeOptions || !survivalLevelUp) return;
          survivalUpgradeOptions.replaceChildren();
          for (const option of options) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'survival-upgrade-card';
            const icon = document.createElement('span');
            icon.className = 'survival-upgrade-icon';
            icon.textContent = option.icon;
            const title = document.createElement('span');
            title.className = 'survival-upgrade-title';
            title.textContent = option.title;
            const description = document.createElement('span');
            description.className = 'survival-upgrade-description';
            description.textContent = option.description;
            card.append(icon, title, description);
            card.addEventListener('click', () => {
              survivalLevelUp.classList.add('hidden');
              if (!this.engine.chooseSurvivalUpgrade(option.id)) {
                survivalLevelUp.classList.remove('hidden');
              }
            });
            survivalUpgradeOptions.appendChild(card);
          }
          survivalLevelUp.classList.remove('hidden');
        },
        onBossUpdate: (name, hp, maxHp, visible, phase) => {
          if (!bossHudBar || !bossNameElem || !bossHpTextElem || !bossHpFillElem) return;
          if (visible && hp > 0) {
            bossHudBar.classList.remove('hidden');
            bossHudBar.classList.toggle('phase-2', phase === 2);
            bossNameElem.textContent = phase === 2 ? `👔 ${name} (SZAŁ!)` : `👔 ${name}`;
            bossHpTextElem.textContent = `${hp} / ${maxHp}`;
            bossHpFillElem.style.width = `${(hp / maxHp) * 100}%`;
          } else {
            bossHudBar.classList.add('hidden');
            bossHudBar.classList.remove('phase-2');
          }
        },
      }
    );

    survivalRerollBtn?.addEventListener('click', () => this.engine.rerollSurvivalUpgrades());
    survivalSkipBtn?.addEventListener('click', () => {
      if (this.engine.skipSurvivalUpgrade()) survivalLevelUp?.classList.add('hidden');
    });

    // Retro Arcade remains optional and is instantiated only when requested.
    this.pixelIntro = null;

    const updateCharacterUI = (id: CharacterId) => {
      this.selectedCharId = id;
      const def = CHARACTERS[id];
      if (hudHeroName) hudHeroName.textContent = def.name;
      if (hudHeroRole) hudHeroRole.textContent = def.role;
      if (abilityName) abilityName.textContent = def.abilityName;

      const abilityIcons: Record<CharacterId, string> = {
        marcin: '🚜', grzesiek: '💥', dawid: '🧱', mateusz: '🐈', piotr: '🔧',
      };
      if (heroAvatar) heroAvatar.innerHTML = operatorPortrait(id);
      document.querySelectorAll<HTMLElement>('.char-card[data-char]').forEach((card) => {
        const cardId = card.dataset.char as CharacterId | undefined;
        const badge = card.querySelector<HTMLElement>('.char-card-badge');
        if (cardId && badge) badge.innerHTML = operatorPortrait(cardId);
      });
      if (abilityIcon) abilityIcon.textContent = abilityIcons[id] || '⚡';

      const attackNameElem = document.getElementById('attack-name');
      const attackIconElem = document.getElementById('attack-icon');
      const attackNames: Record<CharacterId, string> = {
        marcin: 'Zaklęcia Optima',
        grzesiek: 'Rzut hantlem 44 cm',
        dawid: 'Rzut rolką stretchu',
        mateusz: 'Paralizator',
        piotr: 'Klucz Grzechotkowy B4',
      };
      const attackIcons: Record<CharacterId, string> = {
        marcin: '🔮', grzesiek: '🏋️', dawid: '📦', mateusz: '⚡', piotr: '🔧',
      };
      const attackDescriptions: Record<CharacterId, string> = {
        marcin: 'Wysyła świetlny znak-zlecenie z programu Optima. Trafiony cel zostaje ogłuszony, a co trzeci czar tworzy mocniejszą pieczęć audytu.',
        grzesiek: 'Miota ciężkim stalowym hantlem. Co trzeci rzut jest większy, mocniej odrzuca i przebija kilku przeciwników.',
        dawid: 'Rzuca rolką folii stretch, która owija i spowalnia przeciwników. Co trzeci rzut mocniej wiąże cel.',
        mateusz: 'Strzela pojedynczym impulsem paralizatora. Trafiony przeciwnik dostaje elektryczny stun; co trzeci impuls jest mocniejszy.',
        piotr: 'Miota ciężkim kluczem grzechotkowym B4. Wiruje, przebija kilka celów i wraca przez tłum do Piotra; co trzeci rzut jest mocniejszy i rozgrzany do czerwoności.',
      };
      if (attackNameElem) attackNameElem.textContent = attackNames[id] || 'Atak';
      if (attackIconElem) attackIconElem.textContent = attackIcons[id] || '🥊';

      const detailTitle = document.getElementById('char-detail-title');
      const detailBio = document.getElementById('char-detail-bio');
      const detailAttack = document.getElementById('char-detail-attack');
      const detailSkill = document.getElementById('char-detail-skill');
      const detailPassive = document.getElementById('char-detail-passive');
      if (detailTitle && detailBio && detailSkill) {
        detailTitle.textContent = `${def.name} – ${def.title}`;
        detailBio.textContent = def.bio;
        if (detailAttack) {
          detailAttack.innerHTML = `<strong>🥊 Atak Podstawowy [F / Klik]:</strong> ${attackNames[id]} – ${attackDescriptions[id]}`;
        }
        detailSkill.innerHTML = `<strong>⚡ Super Umiejętność [E]:</strong> ${def.abilityName} – ${def.abilityDescription}`;
        if (detailPassive) {
          detailPassive.innerHTML = `<strong>🛡️ Zdolność Pasywna:</strong> ${def.passiveName} – ${def.passiveDescription}`;
        }
      }

      const statBarSpeed = document.getElementById('stat-bar-speed');
      const statValSpeed = document.getElementById('stat-val-speed');
      const statBarJump = document.getElementById('stat-bar-jump');
      const statValJump = document.getElementById('stat-val-jump');
      const statBarPower = document.getElementById('stat-bar-power');
      const statValPower = document.getElementById('stat-val-power');
      const statBarDefense = document.getElementById('stat-bar-defense');
      const statValDefense = document.getElementById('stat-val-defense');

      if (statBarSpeed && statValSpeed) {
        statBarSpeed.style.width = `${(def.stats.speed / 5) * 100}%`;
        statValSpeed.textContent = `${def.stats.speed} / 5`;
      }
      if (statBarJump && statValJump) {
        statBarJump.style.width = `${(def.stats.jump / 5) * 100}%`;
        statValJump.textContent = `${def.stats.jump} / 5`;
      }
      if (statBarPower && statValPower) {
        statBarPower.style.width = `${(def.stats.power / 5) * 100}%`;
        statValPower.textContent = `${def.stats.power} / 5`;
      }
      if (statBarDefense && statValDefense) {
        statBarDefense.style.width = `${(def.stats.defense / 5) * 100}%`;
        statValDefense.textContent = `${def.stats.defense} / 5`;
      }

      this.engine.selectCharacter(id);
    };

    updateCharacterUI('marcin');

    const leaderboardLoading = document.getElementById('leaderboard-loading');
    const leaderboardList = document.getElementById('leaderboard-list');
    const btnRefreshLeaderboard = document.getElementById('btn-refresh-leaderboard') as HTMLButtonElement | null;
    const firestoreStatusBadge = document.getElementById('firestore-status-badge');
    const firestoreStatusText = document.getElementById('firestore-status-text');

    const updateFirestoreStatusUI = (status: 'checking' | 'online' | 'offline', customMsg?: string) => {
      if (!firestoreStatusBadge || !firestoreStatusText) return;
      firestoreStatusBadge.className = `firestore-status-badge ${status}`;
      if (status === 'checking') {
        firestoreStatusText.textContent = customMsg || 'Sprawdzanie bazy...';
      } else if (status === 'online') {
        firestoreStatusText.textContent = customMsg || 'Baza Firestore: Online';
      } else {
        firestoreStatusText.textContent = customMsg || 'Baza Firestore: Offline';
      }
    };

    const renderLeaderboard = async () => {
      if (!leaderboardLoading || !leaderboardList) return;

      if (btnRefreshLeaderboard) {
        btnRefreshLeaderboard.disabled = true;
        btnRefreshLeaderboard.textContent = '⏳ Odświeżanie...';
      }

      updateFirestoreStatusUI('checking', 'Testowanie połączenia...');
      leaderboardLoading.classList.remove('hidden');
      leaderboardLoading.textContent = 'Łączenie z bazą Firebase Firestore...';
      leaderboardList.classList.add('hidden');
      leaderboardList.innerHTML = '';

      try {
        // Direct connectivity check against singleton db instance
        const isConnected = await testFirestoreConnection();
        if (isConnected) {
          updateFirestoreStatusUI('online', 'Baza Firestore: Online');
        } else {
          updateFirestoreStatusUI('offline', 'Baza Firestore: Tryb Offline');
        }

        const topScores = await getTopLeaderboard(15);
        leaderboardLoading.classList.add('hidden');
        leaderboardList.classList.remove('hidden');

        if (topScores.length === 0) {
          leaderboardList.innerHTML = `
            <div class="leaderboard-status-msg">
              Brak jeszcze wyników na tej zmianie! Bądź pierwszym magazynierem, który załaduje zamówienie VIP i zapisze wynik.
            </div>
          `;
        } else {
          topScores.forEach((entry, idx) => {
            const rankIcons = ['🥇', '🥈', '🥉'];
            const rankDisplay = idx < 3 ? rankIcons[idx] : `${idx + 1}.`;
            const heroIds: Record<string, CharacterId> = {
              Marcin: 'marcin', Grzesiek: 'grzesiek', Dawid: 'dawid', Mateusz: 'mateusz', Piotr: 'piotr',
            };
            const heroId = heroIds[entry.hero];
            const heroIcon = heroId ? operatorPortrait(heroId) : '👷‍♂️';
            const bossBadge = entry.bossDefeated ? '<span title="Były Kierownik Walczak skasowany!">👔💥</span>' : '';
            const mins = Math.floor(entry.timeSeconds / 60);
            const secs = entry.timeSeconds % 60;
            const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            const row = document.createElement('div');
            row.className = `leaderboard-item ${idx === 0 ? 'top-1' : ''}`;
            row.innerHTML = `
              <div class="leaderboard-rank">${rankDisplay}</div>
              <div class="leaderboard-hero-tag">${heroIcon}</div>
              <div class="leaderboard-player-info">
                <div class="leaderboard-player-name">${entry.playerName} ${bossBadge}</div>
                <div class="leaderboard-player-meta">${entry.hero} • Czas: ${timeFormatted} • VIP: ${entry.coins}</div>
              </div>
              <div class="leaderboard-score-cluster">
                <div class="leaderboard-score-val">${entry.score} pkt</div>
              </div>
            `;
            leaderboardList.appendChild(row);
          });
        }

        if (btnRefreshLeaderboard) {
          btnRefreshLeaderboard.disabled = false;
          btnRefreshLeaderboard.textContent = '🔄 Odśwież';
        }
      } catch (err) {
        updateFirestoreStatusUI('offline', 'Baza Firestore: Błąd połączenia');
        leaderboardLoading.classList.remove('hidden');
        leaderboardLoading.textContent = '❌ Nie udało się pobrać rankingu. Sprawdź połączenie z bazą Firebase.';
        console.warn('Leaderboard error:', err);

        if (btnRefreshLeaderboard) {
          btnRefreshLeaderboard.disabled = false;
          btnRefreshLeaderboard.textContent = '🔄 Spróbuj ponownie';
        }
      }
    };

    btnRefreshLeaderboard?.addEventListener('click', () => {
      renderLeaderboard();
    });

    document.querySelectorAll('.menu-tab-btn').forEach((tabBtn) => {
      const activateTab = (e?: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        document.querySelectorAll('.menu-tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        tabBtn.classList.add('active');
        const targetId = tabBtn.getAttribute('data-tab');
        if (targetId) {
          document.getElementById(targetId)?.classList.add('active');
          if (targetId === 'tab-leaderboard') {
            renderLeaderboard();
            ensureLeaderboardServices().catch(console.warn);
          }
        }
      };
      tabBtn.addEventListener('click', activateTab);
      tabBtn.addEventListener('touchend', activateTab);
    });

    document.querySelectorAll('.char-card').forEach((card) => {
      const selectChar = (e?: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        document.querySelectorAll('.char-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const charId = card.getAttribute('data-char') as CharacterId;
        if (charId) {
          updateCharacterUI(charId);
        }
      };
      card.addEventListener('click', selectChar);
      card.addEventListener('touchend', selectChar);
    });

    document.querySelectorAll('.btn-perk-activate').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const btnEl = e.currentTarget as HTMLElement;
        const perkId = btnEl.getAttribute('data-perk') as PerkType | null;
        if (perkId && this.engine) {
          const pPos = this.engine.getPlayerPos();
          this.engine.spawnDroppedPerk(pPos.x + 1.8, 0.5, pPos.z, perkId);
        }
        const originalText = btnEl.textContent || 'DROP W GRZE';
        btnEl.textContent = 'ZRZUCONO OBOK! 📦';
        btnEl.classList.add('activated');
        setTimeout(() => {
          btnEl.textContent = originalText;
          btnEl.classList.remove('activated');
        }, 2200);
      });
    });

    const refreshZoneLocks = () => {
      const unlocked = this.engine.getUnlockedSector();
      document.querySelectorAll<HTMLElement>('.zone-card').forEach((card) => {
        const level = Number(card.getAttribute('data-level') || '1');
        const locked = level > unlocked;
        card.classList.toggle('locked', locked);
        card.setAttribute('aria-disabled', locked ? 'true' : 'false');
        const pill = card.querySelector<HTMLElement>('.zone-checkpoint-pill');
        if (!pill) return;
        if (locked && level === 2) pill.textContent = 'ZAMKNIĘTY • POKONAJ BOSMANA';
        else if (locked && level === 3) pill.textContent = 'ZAMKNIĘTY • POKONAJ KRÓLA-LETO';
        else if (level === 1) pill.textContent = 'START GŁÓWNY';
        else pill.textContent = 'CHECKPOINT ODBLOKOWANY';
      });
    };
    document.querySelectorAll('.zone-card').forEach((card) => {
      const selectZone = (e?: Event) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const level = parseInt(card.getAttribute('data-level') || '1', 10);
        if (level > this.engine.getUnlockedSector()) {
          const pill = card.querySelector<HTMLElement>('.zone-checkpoint-pill');
          if (pill) {
            pill.textContent = level === 2
              ? 'WYMAGANE: POKONAJ BOSMANA W SEKTORZE A'
              : 'WYMAGANE: POKONAJ KRÓLA-LETO W SEKTORZE B';
          }
          return;
        }
        document.querySelectorAll('.zone-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedLevelId = level;
      };
      card.addEventListener('click', selectZone);
      card.addEventListener('touchend', selectZone);
    });
    refreshZoneLocks();

    let startingGame = false;
    const doStartGame = async (e?: Event) => {
      if (startingGame) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      await assetLoader.waitUntilReady('Gra 3D');

      startingGame = true;
      if (this.pixelIntro && this.pixelIntro.isRunning()) {
        this.pixelIntro.stop();
      }
      this.engine.setLevelVisible(true);

      const storyModal = document.getElementById('story-intro-modal');
      storyModal?.classList.add('hidden');
      if (titleScreen) {
        titleScreen.classList.add('hidden');
        titleScreen.style.setProperty('display', 'none', 'important');
      }
      pauseModal?.classList.add('hidden');
      victoryModal?.classList.add('hidden');
      gameoverModal?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      survivalHud?.classList.add('hidden');

      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      touchControls?.classList.remove('hidden');

      gameShell?.classList.remove('survival-mode');
      this.engine.startGame(this.selectedLevelId);
      setTimeout(() => { startingGame = false; }, 600);
    };

    const doStartSurvival = async (e?: Event) => {
      if (startingGame) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      await assetLoader.waitUntilReady('Gra 3D');

      startingGame = true;
      if (this.pixelIntro && this.pixelIntro.isRunning()) this.pixelIntro.stop();
      this.engine.setLevelVisible(true);

      const storyModal = document.getElementById('story-intro-modal');
      storyModal?.classList.add('hidden');
      if (titleScreen) {
        titleScreen.classList.add('hidden');
        titleScreen.style.setProperty('display', 'none', 'important');
      }
      pauseModal?.classList.add('hidden');
      victoryModal?.classList.add('hidden');
      gameoverModal?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');

      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      touchControls?.classList.remove('hidden');
      survivalHud?.classList.remove('hidden');
      gameShell?.classList.add('survival-mode');

      this.engine.startSurvival();
      setTimeout(() => { startingGame = false; }, 600);
    };

    const bindTap = (elem: HTMLElement | null, fn: (e: Event) => void) => {
      if (!elem) return;
      let lastTrigger = 0;
      const handler = (e: Event) => {
        const now = Date.now();
        if (now - lastTrigger < 250) return;
        lastTrigger = now;
        if (e && e.cancelable && e.type !== 'click') {
          e.preventDefault();
        }
        fn(e);
      };
      elem.addEventListener('click', handler);
      elem.addEventListener('touchend', handler, { passive: false });
      elem.addEventListener('pointerdown', (e) => {
        // Only trigger on actual touch/pen to avoid double clicks from mouse pointerdown
        if (e.pointerType !== 'mouse') {
           handler(e);
        }
      }, { passive: false });
    };

    const startBtn = document.getElementById('btn-start-game');
    bindTap(startBtn, doStartGame);
    bindTap(document.getElementById('btn-start-survival'), doStartSurvival);

    window.addEventListener('keydown', (e) => {
      const storyModal = document.getElementById('story-intro-modal');
      const modalVisible = storyModal && !storyModal.classList.contains('hidden');
      if (titleScreen && !titleScreen.classList.contains('hidden')) {
        if ((e.code === 'Enter' || e.code === 'Space') && !modalVisible) {
          doStartGame();
          e.preventDefault();
        }
      }
    });

    const launchPixelIntro = async (e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      assetLoader.show('Przygotowywanie Retro Intro 2D...', 85);
      assetLoader.updateProgress(90, 'Inicjalizacja renderera retro VHS...', 'engine', 'RETRO 2D');
      await assetLoader.waitUntilReady('Pixel Intro');
      
      if (!this.pixelIntro) {
        this.pixelIntro = new PixelIntroManager({
          onComplete: () => {
            this.engine.setLevelVisible(true);
            if (titleScreen) {
              titleScreen.classList.remove('hidden');
              titleScreen.style.display = 'flex';
            }
            this.engine.startTitle();
          },
          onStartGame: () => {
            this.engine.setLevelVisible(true);
            doStartGame();
          },
        });
      }

      if (titleScreen) {
        titleScreen.classList.add('hidden');
        titleScreen.style.setProperty('display', 'none', 'important');
      }
      document.getElementById('story-intro-modal')?.classList.add('hidden');
      this.engine.setLevelVisible(false);
      this.pixelIntro.start();
    };

    document.getElementById('btn-open-pixel-intro')?.addEventListener('click', launchPixelIntro);
    document.getElementById('btn-open-pixel-intro')?.addEventListener('touchend', launchPixelIntro);

    document.getElementById('btn-attack')?.addEventListener('click', () => {
      this.engine.triggerAttack();
    });

    document.getElementById('btn-ability')?.addEventListener('click', () => {
      this.engine.triggerAbility();
    });

    const zoomSlider = document.getElementById('cam-zoom-slider') as HTMLInputElement | null;
    if (zoomSlider) {
      zoomSlider.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        this.engine.setCamZoomFactor(val);
      });
    }

    const handleCameraToggle = () => {
      const mode = this.engine.toggleCameraMode();
      if (mode === 'tpp') {
        spawnFloatingToast('📐 KAMERA: PODWYŻSZONY WIDOK TAKTYCZNY', this.engine.getPlayerPos().x, this.engine.getPlayerPos().y + 1.2, this.engine.getPlayerPos().z, 'combo');
      } else if (mode === 'close') {
        spawnFloatingToast('📐 KAMERA: BLISKA AKCJA ZZA RAMIENIA', this.engine.getPlayerPos().x, this.engine.getPlayerPos().y + 1.2, this.engine.getPlayerPos().z, 'perk');
      } else {
        spawnFloatingToast('📐 KAMERA: SZEROKI PRZEGLĄD (ISO)', this.engine.getPlayerPos().x, this.engine.getPlayerPos().y + 1.2, this.engine.getPlayerPos().z, 'vip');
      }
      if (zoomSlider) zoomSlider.value = this.engine.getCamZoomFactor().toString();
    };

    bindTap(document.getElementById('btn-top-camera'), handleCameraToggle);
    bindTap(document.getElementById('btn-camera'), handleCameraToggle);

    const handleEventTrigger = () => {
      this.engine.triggerTimedWarehouseEvent();
    };
    bindTap(document.getElementById('btn-top-event'), handleEventTrigger);
    bindTap(document.getElementById('btn-event'), handleEventTrigger);

    bindTap(document.getElementById('btn-top-zoom-in'), () => {
      this.engine.zoomInCamera();
      if (zoomSlider) zoomSlider.value = this.engine.getCamZoomFactor().toString();
    });
    bindTap(document.getElementById('btn-top-zoom-out'), () => {
      this.engine.zoomOutCamera();
      if (zoomSlider) zoomSlider.value = this.engine.getCamZoomFactor().toString();
    });

    bindTap(document.getElementById('btn-minimap-zoom-in'), () => {
      this.engine.zoomInMinimap();
    });
    bindTap(document.getElementById('btn-minimap-zoom-out'), () => {
      this.engine.zoomOutMinimap();
    });
    bindTap(document.getElementById('btn-minimap-toggle'), () => {
      this.engine.toggleMinimap();
    });

    const topSoundIcon = document.getElementById('top-sound-icon');
    const soundIcon = document.getElementById('sound-icon');
    const updateSoundIcons = () => {
      const icon = sound.getMuted() ? '🔇' : '🔊';
      if (topSoundIcon) topSoundIcon.textContent = icon;
      if (soundIcon) soundIcon.textContent = icon;
    };
    const handleSoundToggle = () => {
      sound.toggleMute();
      updateSoundIcons();
    };
    bindTap(document.getElementById('btn-top-sound'), handleSoundToggle);
    bindTap(document.getElementById('btn-sound'), handleSoundToggle);
    updateSoundIcons();

    const masterVolumeInput = document.getElementById('audio-master-volume') as HTMLInputElement | null;
    const musicVolumeInput = document.getElementById('audio-music-volume') as HTMLInputElement | null;
    const effectsVolumeInput = document.getElementById('audio-effects-volume') as HTMLInputElement | null;
    const masterVolumeOutput = document.getElementById('audio-master-value');
    const musicVolumeOutput = document.getElementById('audio-music-value');
    const effectsVolumeOutput = document.getElementById('audio-effects-value');

    const syncAudioSettingsUI = () => {
      const settings = sound.getAudioSettings();
      if (masterVolumeInput) masterVolumeInput.value = String(Math.round(settings.master * 100));
      if (musicVolumeInput) musicVolumeInput.value = String(Math.round(settings.music * 100));
      if (effectsVolumeInput) effectsVolumeInput.value = String(Math.round(settings.effects * 100));
      if (masterVolumeOutput) masterVolumeOutput.textContent = Math.round(settings.master * 100) + '%';
      if (musicVolumeOutput) musicVolumeOutput.textContent = Math.round(settings.music * 100) + '%';
      if (effectsVolumeOutput) effectsVolumeOutput.textContent = Math.round(settings.effects * 100) + '%';
    };

    const bindVolumeControl = (
      input: HTMLInputElement | null,
      output: HTMLElement | null,
      apply: (value: number) => void
    ) => {
      if (!input || !output) return;
      input.addEventListener('input', () => {
        const value = Math.min(100, Math.max(0, Number(input.value) || 0));
        apply(value / 100);
        output.textContent = Math.round(value) + '%';
      });
    };

    bindVolumeControl(masterVolumeInput, masterVolumeOutput, (value) => sound.setMasterVolume(value));
    bindVolumeControl(musicVolumeInput, musicVolumeOutput, (value) => sound.setMusicVolume(value));
    bindVolumeControl(effectsVolumeInput, effectsVolumeOutput, (value) => sound.setEffectsVolume(value));
    document.getElementById('btn-audio-reset')?.addEventListener('click', () => {
      sound.setAudioSettings({ master: 0.82, music: 0.48, effects: 0.82 });
      syncAudioSettingsUI();
    });
    syncAudioSettingsUI();

    const handlePause = () => {
      this.engine.togglePause();
      const pauseModal = document.getElementById('pause-modal');
      pauseModal?.classList.remove('hidden');
    };
    bindTap(document.getElementById('btn-top-pause'), handlePause);
    bindTap(document.getElementById('btn-pause'), handlePause);

    const storyModal = document.getElementById('story-intro-modal');
    const btnCloseStory = document.getElementById('btn-close-story');
    const btnStoryPrev = document.getElementById('btn-story-prev') as HTMLButtonElement | null;
    const btnStoryNext = document.getElementById('btn-story-next') as HTMLButtonElement | null;
    const btnStoryPlay = document.getElementById('btn-story-play');
    const storySlides = document.querySelectorAll('.story-slide');
    const storyDots = document.querySelectorAll('.story-progress-dots .dot');
    let currentSlide = 0;

    const updateStorySlides = (index: number) => {
      currentSlide = Math.max(0, Math.min(index, storySlides.length - 1));
      storySlides.forEach((slide, i) => {
        if (i === currentSlide) {
          slide.classList.remove('hidden');
          slide.classList.add('active');
        } else {
          slide.classList.add('hidden');
          slide.classList.remove('active');
        }
      });
      storyDots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
      });

      if (btnStoryPrev) btnStoryPrev.disabled = currentSlide === 0;
      if (btnStoryNext && btnStoryPlay) {
        if (currentSlide === storySlides.length - 1) {
          btnStoryNext.classList.add('hidden');
          btnStoryPlay.classList.remove('hidden');
        } else {
          btnStoryNext.classList.remove('hidden');
          btnStoryPlay.classList.add('hidden');
        }
      }
    };

    bindTap(document.getElementById('btn-open-story-modal'), () => {
      updateStorySlides(0);
      storyModal?.classList.remove('hidden');
    });

    btnCloseStory?.addEventListener('click', () => {
      storyModal?.classList.add('hidden');
    });

    btnStoryPrev?.addEventListener('click', () => {
      updateStorySlides(currentSlide - 1);
    });

    btnStoryNext?.addEventListener('click', () => {
      updateStorySlides(currentSlide + 1);
    });

    btnStoryPlay?.addEventListener('click', () => {
      storyModal?.classList.add('hidden');
      doStartGame();
    });

    storyDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const slideIdx = parseInt(dot.getAttribute('data-slide') || '0', 10);
        updateStorySlides(slideIdx);
      });
    });

    bindTap(document.getElementById('btn-resume'), () => {
      pauseModal?.classList.add('hidden');
      this.engine.togglePause();
    });

    bindTap(document.getElementById('btn-restart-pause'), () => {
      const restartSurvival = this.engine.getGameMode() === 'survival';
      pauseModal?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      survivalHud?.classList.toggle('hidden', !restartSurvival);
      gameShell?.classList.toggle('survival-mode', restartSurvival);
      if (restartSurvival) this.engine.startSurvival();
      else this.engine.startGame(this.selectedLevelId);
    });

    bindTap(document.getElementById('btn-menu-pause'), () => {
      pauseModal?.classList.add('hidden');
      survivalHud?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      gameShell?.classList.remove('survival-mode');
      hudTop?.classList.add('hidden');
      hudBottom?.classList.add('hidden');
      touchControls?.classList.add('hidden');
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      refreshZoneLocks();
      this.engine.startTitle();
    });

    bindTap(document.getElementById('btn-next-level'), () => {
      victoryModal?.classList.add('hidden');
      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      touchControls?.classList.remove('hidden');
      this.selectedLevelId = (this.selectedLevelId % 3) + 1;
      this.engine.startGame(this.selectedLevelId);
    });

    bindTap(document.getElementById('btn-replay-level'), () => {
      victoryModal?.classList.add('hidden');
      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      touchControls?.classList.remove('hidden');
      this.engine.startGame(this.selectedLevelId);
    });

    bindTap(document.getElementById('btn-menu-victory'), () => {
      victoryModal?.classList.add('hidden');
      survivalHud?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      gameShell?.classList.remove('survival-mode');
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      refreshZoneLocks();
      this.engine.startTitle();
    });

    bindTap(document.getElementById('btn-retry'), () => {
      const retrySurvival = this.engine.getGameMode() === 'survival';
      gameoverModal?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      touchControls?.classList.remove('hidden');
      survivalHud?.classList.toggle('hidden', !retrySurvival);
      gameShell?.classList.toggle('survival-mode', retrySurvival);
      if (retrySurvival) this.engine.startSurvival();
      else this.engine.startGame(this.selectedLevelId);
    });

    bindTap(document.getElementById('btn-menu-gameover'), () => {
      gameoverModal?.classList.add('hidden');
      survivalHud?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      gameShell?.classList.remove('survival-mode');
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      refreshZoneLocks();
      this.engine.startTitle();
    });

    const submitBtn = document.getElementById('btn-submit-score') as HTMLButtonElement | null;
    const nickInput = document.getElementById('player-nickname-input') as HTMLInputElement | null;
    const feedbackMsg = document.getElementById('submit-feedback-msg');

    submitBtn?.addEventListener('click', async () => {
      const playerName = nickInput?.value.trim() || `Kierownik ${CHARACTERS[this.selectedCharId].name}`;
      localStorage.setItem('maxfliz_player_nick', playerName);

      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ ZAPISYWANIE...';
      if (feedbackMsg) {
        feedbackMsg.className = 'submit-feedback';
        feedbackMsg.textContent = 'Wysyłanie wyniku do Firebase Firestore...';
        feedbackMsg.classList.remove('hidden');
      }

      try {
        await submitScore({
          playerName,
          hero: CHARACTERS[this.selectedCharId].name,
          score: this.lastScore,
          coins: this.lastCoins,
          timeSeconds: this.lastTimeSeconds,
          bossDefeated: this.lastBossDefeated,
        });

        submitBtn.textContent = '✅ ZAPISANO!';
        if (feedbackMsg) {
          feedbackMsg.className = 'submit-feedback success';
          feedbackMsg.textContent = '🎉 Sukces! Wynik pomyślnie zapisany w rankingu Firebase!';
        }
        renderLeaderboard();
      } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'RETRY 💾';
        if (feedbackMsg) {
          feedbackMsg.className = 'submit-feedback error';
          feedbackMsg.textContent = 'Błąd zapisu w Firebase. Spróbuj ponownie!';
        }
      }
    });

    ensureLeaderboardServices().catch(console.warn);
    renderLeaderboard();

    // Do not let a backgrounded mobile browser continue a live run invisibly.
    // Resume only when this handler itself caused the pause; manual pauses stay paused.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.engine?.getGameState() === 'playing') {
          this.engine.togglePause();
          this.pausedForVisibility = true;
        }
      } else if (this.pausedForVisibility && this.engine?.getGameState() === 'paused') {
        this.engine.togglePause();
        this.pausedForVisibility = false;
      }
    });

    this.setupTouchControls();

    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.display = 'flex';
    }
    this.engine.startTitle();
  }

  private setupTouchControls() {
    const joystickZone = document.getElementById('touch-joystick-zone');
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    if (!joystickZone || !joystickBase || !joystickKnob) return;

    // Pointer Events unify touch, pen and mouse. Mixing Touch + Pointer listeners
    // caused duplicate starts and occasional stuck movement on Android browsers.
    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    const maxRadius = 52;

    const resetJoystick = () => {
      activePointerId = null;
      joystickBase.classList.remove('active');
      joystickKnob.style.transform = 'translate(0px, 0px)';
      this.engine.setVirtualInput(0, 0);
    };

    const handleStart = (event: PointerEvent) => {
      if (activePointerId !== null || event.button > 0) return;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;

      joystickBase.style.left = `${startX}px`;
      joystickBase.style.top = `${startY}px`;
      joystickBase.classList.add('active');
      joystickKnob.style.transform = 'translate(0px, 0px)';
      this.engine.setVirtualInput(0, 0);

      try {
        joystickZone.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; window listeners remain as a fallback.
      }
      if (event.cancelable) event.preventDefault();
    };

    const handleMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const nx = Math.cos(angle) * clampedDist;
      const ny = Math.sin(angle) * clampedDist;

      joystickKnob.style.transform = `translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`;
      this.engine.setVirtualInput(nx / maxRadius, ny / maxRadius);
      if (event.cancelable) event.preventDefault();
    };

    const handleEnd = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      resetJoystick();
    };

    joystickZone.addEventListener('pointerdown', handleStart, { passive: false });
    joystickZone.addEventListener('lostpointercapture', (event) => {
      if (activePointerId === event.pointerId) resetJoystick();
    });
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleEnd, { passive: true });
    window.addEventListener('pointercancel', handleEnd, { passive: true });
    window.addEventListener('blur', resetJoystick);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetJoystick();
    });

    const bindTouchAction = (id: string, action: () => void) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let lastTrigger = 0;
      const trigger = (event: Event) => {
        const now = Date.now();
        if (now - lastTrigger < 120) return;
        lastTrigger = now;
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        action();
      };

      if ('PointerEvent' in window) {
        btn.addEventListener('pointerdown', trigger, { passive: false });
        // Keep keyboard and assistive-technology activation without replaying
        // the synthetic click emitted after a pointer interaction.
        btn.addEventListener('click', (event) => {
          if ((event as MouseEvent).detail === 0) trigger(event);
        });
      } else {
        btn.addEventListener('click', trigger);
      }
    };

    bindTouchAction('btn-touch-attack', () => this.engine.triggerAttack());
    bindTouchAction('btn-touch-jump', () => this.engine.triggerJump());
    bindTouchAction('btn-touch-ability', () => this.engine.triggerAbility());
  }

  init() {
    // 1. Particle System Setup (from top init)
    const geometry = new THREE.BufferGeometry();
    const count = 1000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.15, transparent: true, opacity: 0.4 });
    this.particleSystem = new THREE.Points(geometry, material);
    this.add(this.particleSystem);

    // 2. Initial resize now that xb.core is ready
    const width = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth));
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight));
    const renderer = (xb.core?.renderer as THREE.WebGLRenderer) || null;
    if (renderer) {
      const isMobile = width < 900 || ('ontouchstart' in window);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.65 : 2.0));
      renderer.setSize(width, height, false);
    }

    const scene = xb.core?.scene || this.fallbackScene;
    const camera = (xb.core?.camera as THREE.PerspectiveCamera) || this.camera;

    // AGGRESSIVE BACKGROUND CLEANUP
    if (scene) {
      scene.background = new THREE.Color(0x020408);
      scene.fog = new THREE.Fog(0x020408, 1, 60);
    }

    if (this.engine) {
      // Give the engine the live renderer before traversing scene materials so
      // anisotropy can be capped to the device's actual GPU support.
      if (renderer) this.engine.threeRenderer = renderer;
      this.engine.setScene(scene);
      this.engine.setCamera(camera);
    }

    this.camera = camera;
    this.engine.startTitle();
  }


  update() {
    this.lastLoopTick = performance.now();
    const rawDt = xb.getDeltaTime();
    const dt = Math.min(Math.max(rawDt || 0.016, 0.001), 0.08);

    // 1. Particle System Rotation (from top update)
    if (this.particleSystem) {
      const gameState = this.engine?.getGameState() || 'title';
      if (gameState === 'title') {
        this.particleSystem.visible = true;
        this.particleSystem.rotation.y += 0.0005;
        this.particleSystem.rotation.x += 0.0002;
      } else {
        this.particleSystem.visible = false;
      }
    }

    // 2. PERSISTENT BACKGROUND ENFORCEMENT
    if (xb.core.scene) {
       const info = (xb.core.renderer as any)?.info;
       const frame = info?.render?.frame || 0;
       const gameState = this.engine?.getGameState() || 'title';
       
         if (gameState === 'title' || frame < 120) {
           xb.core.scene.background = new THREE.Color(0x020408);
           if (xb.core.scene.fog instanceof THREE.Fog) {
              xb.core.scene.fog.color.setHex(0x020408);
           }
         }
    }

    this.tick(dt);
  }

  private updateAdaptiveRenderQuality(now: number) {
    if (now - this.lastAdaptiveQualityAt < 2500) return;
    this.lastAdaptiveQualityAt = now;

    const renderer = (xb.core?.renderer as THREE.WebGLRenderer) || null;
    if (!renderer) return;

    const width = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth));
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight));
    const isMobile = width < 900 || ('ontouchstart' in window);
    const deviceCap = isMobile ? 1.65 : 2.0;
    const fpsScale = this.currentFps < 34 ? 0.72 : this.currentFps < 44 ? 0.82 : this.currentFps < 52 ? 0.92 : 1;
    const targetDpr = Math.max(0.85, Math.min(window.devicePixelRatio || 1, deviceCap) * fpsScale);

    // Change drawing-buffer resolution only when the target differs meaningfully.
    // This avoids reallocating GPU buffers on every frame or on tiny FPS fluctuations.
    if (Math.abs(renderer.getPixelRatio() - targetDpr) < 0.12) return;
    renderer.setPixelRatio(targetDpr);
    renderer.setSize(width, height, false);
  }

  private tick(dt: number) {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 350) {
      this.currentFps = Math.round((this.frameCount * 1000) / Math.max(1, now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      const fpsValueElem = document.getElementById('fps-value');
      if (fpsValueElem) {
        fpsValueElem.textContent = this.currentFps.toString();
        if (this.currentFps >= 55) {
          fpsValueElem.style.color = '#34d399';
        } else if (this.currentFps >= 30) {
          fpsValueElem.style.color = '#facc15';
        } else {
          fpsValueElem.style.color = '#f87171';
        }
      }
    }

    this.updateAdaptiveRenderQuality(now);

    try {
      if (this.pixelIntro && this.pixelIntro.isRunning()) {
        // Pixel intro updates internally via its own canvas RAF
      } else if (this.engine) {
        this.engine.update(dt);
        const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
        const now = performance.now();
        // Canvas minimap is intentionally capped at 10 Hz; drawing it every
        // rendered frame wastes CPU on phones without making navigation clearer.
        if (minimapCanvas && now - this.lastMinimapRenderAt >= 100) {
          this.engine.renderMinimap(minimapCanvas);
          this.lastMinimapRenderAt = now;
        }
      }
      (this as any)._updateToasts?.(dt);
    } catch (err) {
      console.warn('Loop Error:', err);
    }
  }

  onSelectEnd(event: xb.SelectEvent) {
    this.engine?.triggerAbility();
  }
}

// Visual Polish / Theme Injections (Integrated to ensure execution)
const injectThemeStyles = () => {
  if (document.getElementById('maxfliz-inline-theme')) return;
  
  // Set theme variables
  const root = document.documentElement;
  root.style.setProperty('--maxfliz-bg-1', '#050b14');
  root.style.setProperty('--maxfliz-bg-2', '#0b1220');
  root.style.setProperty('--maxfliz-accent', '#f59e0b');
  root.style.setProperty('--maxfliz-blue', '#38bdf8');

  const style = document.createElement('style');
  style.id = 'maxfliz-inline-theme';
  style.textContent = `
    #game-canvas-container {
      z-index: 1 !important;
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: auto !important;
    }
    #game-canvas-container canvas, canvas {
      z-index: 1 !important;
      pointer-events: auto !important;
    }
    #game-shell {
      z-index: 999999 !important;
      position: fixed !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      pointer-events: none !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .game-screen {
      z-index: 1000000 !important;
      position: fixed !important;
      inset: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: auto !important;
      background: rgba(11, 15, 25, 0.82) !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .game-screen.hidden, #title-screen.hidden, .hidden {
      display: none !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
    .game-modal {
      z-index: 1000001 !important;
      pointer-events: auto !important;
    }
    .hud-layer {
      pointer-events: none !important;
    }
    .hud-layer button, .hud-layer .minimap-container, .hud-cluster, .cam-zoom-slider-container, .cam-zoom-slider {
      pointer-events: auto !important;
    }
    #asset-loader-overlay {
      z-index: 2000000 !important;
      background: #0b0f19 !important;
    }
  `;
  document.head.appendChild(style);
};

async function startApp() {
  console.log('%c[App:Boot] 🚀 Rozpoczynanie sekwencji startowej Max-Fliz 3D...', 'color: #38bdf8; font-weight: bold;');
  injectThemeStyles();

  const titleScreen = document.getElementById('title-screen');
  const shell = document.getElementById('game-shell');

  // Safety fallback: reveal UI even if loading hangs
  const safetyTimeout = setTimeout(() => {
    console.warn('[App:Boot] ⚠️ Przekroczono czas ładowania (Safety Timeout 12s). Wymuszanie wyświetlenia interfejsu.');
    assetLoader.hide();
    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.setProperty('display', 'flex', 'important');
      titleScreen.style.setProperty('z-index', '10000000', 'important');
    }
    if (shell) {
      shell.classList.remove('hidden');
      shell.style.setProperty('display', 'flex', 'important');
      shell.style.setProperty('z-index', '9999999', 'important');
    }
  }, 12000);

  try {
    // 1. Show Asset Loader immediately
    assetLoader.show('Inicjalizacja systemu...', 0);
    assetLoader.updateCategory('engine', 0, 4);

    // 2. Preload all procedural textures, 3D models and audio context (covers 0% - 70%)
    console.log('[App:Boot] ⏳ Wstępne ładowanie zasobów...');
    await assetLoader.preloadAll();
    console.log('[App:Boot] ✅ Zasoby załadowane.');

    // 3. Ensure canvas in container
    assetLoader.updateProgress(74, 'Konfiguracja płótna WebGL i bufora klatek...', 'engine', 'PŁÓTNO 3D');
    assetLoader.updateCategory('engine', 1, 4);
    await new Promise(r => setTimeout(r, 40));

    const canvasContainer = document.getElementById('game-canvas-container');
    let canvas = canvasContainer?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas && canvasContainer) {
      canvas = document.createElement('canvas');
      canvas.id = 'maxfliz-3d-canvas';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvasContainer.appendChild(canvas);
    }

    // 4. Initialize Engine Options (Core 3D Engine)
    assetLoader.updateProgress(82, 'Inicjalizacja silnika 3D...', 'engine', 'CORE ENGINE');
    assetLoader.updateCategory('engine', 2, 4);
    await new Promise(r => setTimeout(r, 40));

    console.log('[App:Boot] 🛠️ Inicjalizacja silnika 3D (XR Blocks Core)...');
    const options = new xb.Options();
    options.setAppTitle('Max-Fliz Magazyn Showdown 3D');
    
    // Explicitly disable all AR/XR features for desktop-only gameplay
    options.reticles.enabled = false;
    options.enableSimulator = false;
    
    if (canvas) {
      options.canvas = canvas;
    }

    // 5. Create Scene Script
    assetLoader.updateProgress(90, 'Kompilacja oświetlenia magazynu i cieni PBR...', 'engine', 'SCENA 3D');
    assetLoader.updateCategory('engine', 3, 4);
    await new Promise(r => setTimeout(r, 40));

    const sceneScript = new MaxFlizScene();
    xb.add(sceneScript);

    // 6. Init Engine
    try {
      console.log('[App:Boot] 🔗 Łączenie z silnikiem renderingu...');
      
      await xb.init(options);
      console.log('[App:Boot] ✅ Silnik 3D zainicjalizowany.');
      
      // High fidelity rendering configuration
      if (xb.core.renderer) {
        const r = xb.core.renderer as THREE.WebGLRenderer;
        const isMobileDevice = window.innerWidth < 900 || ('ontouchstart' in window);
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.65 : 2.0));
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.08;
        r.shadowMap.enabled = true;
        r.shadowMap.type = isMobileDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      }

      // PERSISTENT BACKGROUND ENFORCEMENT: Fight simulator environment default (trees/living room)
      if (xb.core.scene) {
        xb.core.scene.background = new THREE.Color(0x020408);
        xb.core.scene.fog = new THREE.Fog(0x020408, 1, 60);
      }

      // Ensure the container itself is opaque black to hide any leaking simulator UI
      const container = document.getElementById('game-canvas-container');
      if (container) {
        container.style.backgroundColor = '#020408';
        container.style.zIndex = '1';
      }
    } catch (e) {
      console.warn('[App:Boot] ⚠️ Uwaga inicjalizacji XR:', e);
    }

    assetLoader.updateProgress(98, 'Synchronizacja bazy Firestore i gotowość...', 'engine', 'FIRESTORE');
    assetLoader.updateCategory('engine', 4, 4);
    await new Promise(r => setTimeout(r, 40));

    assetLoader.updateProgress(100, 'Zasoby gotowe! Witamy na magazynie Max-Fliz!', 'engine', 'GOTOWE!');
    await new Promise(r => setTimeout(r, 320));

    clearTimeout(safetyTimeout);
    assetLoader.hide();

    // 7. Reveal UI with high priority
    if (shell) {
      shell.classList.remove('hidden');
      shell.style.setProperty('display', 'flex', 'important');
      shell.style.setProperty('z-index', '9999999', 'important');
    }

    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.setProperty('display', 'flex', 'important');
      titleScreen.style.setProperty('z-index', '10000000', 'important');
      console.log('[App:Boot] 🎉 Ekran tytułowy gotowy.');
    }

  } catch (err) {
    console.error('[App:Boot] ❌ KRYTYCZNY BŁĄD STARTU:', err);
    clearTimeout(safetyTimeout);
    assetLoader.hide();
    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.setProperty('display', 'flex', 'important');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void startApp());
} else {
  void startApp();
}


