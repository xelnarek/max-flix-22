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
import { CinematicIntroManager } from './cinematicIntro.ts';
import { formatLeaderboardTimestamp } from './leaderboard.ts';
import { CharacterId, PerkType } from './types.ts';
import { AssetItem, assetLoader } from './assets.ts';
import { SelectiveBloomPipeline } from './selectiveBloom.ts';
import { ThreeClickTrigger } from './menuInteraction.ts';
import { calculateUiViewport } from './uiViewport.ts';
import { getAdaptiveRenderScale } from './renderQuality.ts';

// warehouseAssets imports moved to assets.ts where they are preloaded

// Global Unhandled Error Logger
window.addEventListener('error', (e) => {
  console.warn('Global Error Captured:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled Rejection Captured:', e.reason);
});

// Operator portraits are role-specific vector character art, not reused emoji or generic busts.
let operatorPortraitRenderCount = 0;
const operatorPortrait = (id: CharacterId): string => {
  const looks: Record<CharacterId, { skin: string; hair: string; beard: string; shirt: string; accent: string; brows: string; hairShape: string; headgear: string; beardShape: string; shoulderDetail: string; badgeShape: string }> = {
    marcin: { skin:'#e9b995', hair:'#3d2b24', beard:'none', shirt:'#173b72', accent:'#f0c46b', brows:'#39291f',
      hairShape:'<path d="M31 48Q25 25 42 20Q60 14 73 30L78 46Q66 37 57 36Q45 42 31 48Z" fill="#3d2b24"/><path d="M37 27Q50 19 64 26" fill="none" stroke="#80604b" stroke-width="2.4" stroke-linecap="round"/>',
      headgear:'<path d="M23 34Q25 11 56 10Q86 10 89 34L82 37Q55 31 29 39Z" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/><path d="M19 33Q55 27 92 34L90 41Q55 36 20 42Z" fill="#dbe7f0" stroke="#94a3b8" stroke-width="1.5"/><path d="M45 17h22" stroke="#94a3b8" stroke-width="2.3" stroke-linecap="round"/>',
      beardShape:'', shoulderDetail:'<path d="M24 93L36 76L47 88L59 76L85 96" fill="none" stroke="#d9e6f0" stroke-width="3"/><path d="M48 89h17" stroke="#f0c46b" stroke-width="4" stroke-linecap="round"/>',
      badgeShape:'<path d="M-7 -4h9l7 7H-2ZM-5 2h13" fill="none" stroke="#f8e3a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
    grzesiek: { skin:'#d9a27f', hair:'#211a17', beard:'#211a17', shirt:'#14583d', accent:'#f5ca45', brows:'#241a15',
      hairShape:'<path d="M29 49Q24 22 49 18Q76 14 82 45L75 51Q66 37 57 37Q43 43 29 49Z" fill="#211a17"/><path d="M37 26Q54 17 69 27" fill="none" stroke="#564238" stroke-width="2.5" stroke-linecap="round"/>',
      headgear:'<path d="M20 35Q23 9 55 8Q87 10 90 35L83 39Q55 33 28 40Z" fill="#f5ca45" stroke="#523f15" stroke-width="2.3"/><path d="M16 34Q55 27 94 35L91 43Q55 37 18 44Z" fill="#d89c22" stroke="#523f15" stroke-width="1.6"/><path d="M27 20L32 15M78 16l6 7" stroke="#fff1b6" stroke-width="2.5" stroke-linecap="round"/>',
      beardShape:'<path d="M31 62Q40 70 55 68Q68 65 77 60L73 81Q65 94 52 94Q37 92 30 80Z" fill="#211a17"/><path d="M38 77Q53 86 69 75" fill="none" stroke="#594137" stroke-width="2.4" stroke-linecap="round"/>',
      shoulderDetail:'<path d="M19 96L31 78L43 91L55 82L73 96" fill="none" stroke="#f5ca45" stroke-width="4"/><path d="M16 78h9M82 78h9" stroke="#f5ca45" stroke-width="5" stroke-linecap="round"/>',
      badgeShape:'<path d="M-9 0h5m18 0h5M-5 -6v12m10-12v12M-5 0h10" stroke="#fff0a6" stroke-width="2.6" stroke-linecap="round"/>' },
    dawid: { skin:'#e4b18d', hair:'#49291d', beard:'#573323', shirt:'#9a4b16', accent:'#f5a04c', brows:'#382219',
      hairShape:'<path d="M30 48Q28 25 47 19Q69 14 79 39L76 49Q65 35 56 36Q45 42 30 48Z" fill="#49291d"/><path d="M40 27Q53 18 67 27" fill="none" stroke="#84513a" stroke-width="2.4" stroke-linecap="round"/>',
      headgear:'<path d="M22 35Q26 10 55 10Q83 12 88 35L80 39Q53 32 29 41Z" fill="#f47b32" stroke="#7c3415" stroke-width="2.2"/><path d="M18 34Q55 27 92 35L88 43Q54 37 20 44Z" fill="#ffb05e" stroke="#7c3415" stroke-width="1.5"/><path d="M34 17l7-4M68 14l8 4" stroke="#ffe1bd" stroke-width="2" stroke-linecap="round"/>',
      beardShape:'<path d="M35 64Q48 72 63 65L70 72Q65 88 52 90Q39 89 34 76Z" fill="#573323"/><path d="M42 78Q53 83 64 76" fill="none" stroke="#9a6244" stroke-width="2.2" stroke-linecap="round"/>',
      shoulderDetail:'<path d="M27 82L38 93L53 83L67 94L82 83" fill="none" stroke="#f5a04c" stroke-width="4"/><path d="M40 85l7 8 7-8" fill="none" stroke="#fff0d8" stroke-width="2"/>',
      badgeShape:'<path d="M-7 -7L7 7M7 -7L-7 7M-9 0h18" stroke="#ffe1b7" stroke-width="2.4" stroke-linecap="round"/>' },
    mateusz: { skin:'#e7b99c', hair:'#30241f', beard:'#47352d', shirt:'#51249a', accent:'#c9a8ff', brows:'#30241f',
      hairShape:'<path d="M29 47Q27 25 47 20Q72 15 79 43L74 48Q62 34 54 36Q41 41 29 47Z" fill="#30241f"/><path d="M39 27Q54 18 68 27" fill="none" stroke="#685247" stroke-width="2.4" stroke-linecap="round"/>',
      headgear:'<path d="M25 34Q27 10 54 10Q79 11 85 31L75 35Q55 29 31 40Z" fill="#6d3ab8" stroke="#251443" stroke-width="2.3"/><path d="M21 34Q52 25 87 33L91 39Q55 34 22 43Z" fill="#a78bfa" stroke="#251443" stroke-width="1.6"/><path d="M31 19Q54 12 73 22" fill="none" stroke="#e9d5ff" stroke-width="2.5" stroke-linecap="round"/><path d="M21 37Q12 43 17 57M86 36Q97 43 91 56" fill="none" stroke="#2c1a55" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="58" r="5" fill="#c4b5fd"/><circle cx="92" cy="57" r="5" fill="#c4b5fd"/>',
      beardShape:'<path d="M37 65Q51 71 65 64L68 73Q63 84 52 85Q41 84 36 74Z" fill="#47352d"/>',
      shoulderDetail:'<path d="M30 84L41 94L53 84L66 94L78 83" fill="none" stroke="#c9a8ff" stroke-width="3.5"/><path d="M47 84l5-8 5 8-5 7Z" fill="#f0abfc"/>',
      badgeShape:'<path d="M1 -10L4 -3L11 -2L5 3L7 10L1 6L-6 10L-4 3L-10 -2L-3 -3Z" fill="#e9d5ff" stroke="#7c3aed" stroke-width="1.2"/>' },
    piotr: { skin:'#d4a585', hair:'#77736d', beard:'#77736d', shirt:'#7f1d1d', accent:'#ef5b5b', brows:'#66615c',
      hairShape:'<path d="M28 49Q24 25 46 19Q72 14 81 42L77 52Q66 34 56 37Q42 44 28 49Z" fill="#77736d"/><path d="M38 27Q54 18 70 27" fill="none" stroke="#bbb5ad" stroke-width="2.4" stroke-linecap="round"/>',
      headgear:'<path d="M21 35Q25 10 55 9Q84 10 89 35L81 39Q55 31 28 41Z" fill="#b91c1c" stroke="#4c1118" stroke-width="2.3"/><path d="M17 34Q55 27 92 35L89 43Q55 36 19 44Z" fill="#ef5b5b" stroke="#4c1118" stroke-width="1.6"/><path d="M47 15h16" stroke="#fecaca" stroke-width="2.5" stroke-linecap="round"/>',
      beardShape:'<path d="M30 62Q49 72 70 61L74 78Q67 94 52 96Q36 93 29 78Z" fill="#77736d"/><path d="M36 75Q52 85 68 75" fill="none" stroke="#c2beb7" stroke-width="2.5" stroke-linecap="round"/>',
      shoulderDetail:'<path d="M23 94L35 80L47 91L60 80L83 95" fill="none" stroke="#fecaca" stroke-width="3"/><path d="M48 83l6 10" stroke="#ef5b5b" stroke-width="4" stroke-linecap="round"/>',
      badgeShape:'<path d="M-8 -7L7 8M7 -8L-8 7M-10 0h20" stroke="#fecaca" stroke-width="2.6" stroke-linecap="round"/>' },
  };
  const p = looks[id];
  const instance = ++operatorPortraitRenderCount;
  const bgId = 'operator-bg-' + id + '-' + instance;
  const faceId = 'operator-face-' + id + '-' + instance;
  const clipId = 'operator-clip-' + id + '-' + instance;
  const goggles = id === 'dawid'
    ? '<path d="M34 48h14m7 0h14" stroke="#7c3415" stroke-width="2.8" stroke-linecap="round"/><rect x="31" y="43" width="17" height="11" rx="4" fill="none" stroke="#f8d6b6" stroke-width="2"/><rect x="53" y="43" width="17" height="11" rx="4" fill="none" stroke="#f8d6b6" stroke-width="2"/>'
    : '';
  const clipboard = id === 'marcin'
    ? '<path d="M43 84h25v17H43z" fill="#dbeafe" stroke="#183b70" stroke-width="1.6"/><path d="M48 89h15M48 94h10" stroke="#315b88" stroke-width="1.6" stroke-linecap="round"/>'
    : '';
  return [
    '<svg class="operator-portrait" viewBox="0 0 112 112" role="img" aria-label="Portret operatora ' + CHARACTERS[id].name + '" xmlns="http://www.w3.org/2000/svg">',
    '<defs><linearGradient id="' + bgId + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p.shirt + '"/><stop offset="1" stop-color="#081321"/></linearGradient>',
    '<linearGradient id="' + faceId + '" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#f4d0ae"/><stop offset="1" stop-color="' + p.skin + '"/></linearGradient>',
    '<clipPath id="' + clipId + '"><rect x="2" y="2" width="108" height="108" rx="24"/></clipPath></defs>',
    '<rect x="2" y="2" width="108" height="108" rx="24" fill="#07111e" stroke="' + p.accent + '" stroke-opacity=".8" stroke-width="2"/>',
    '<g clip-path="url(#' + clipId + ')"><path d="M0 0h112v112H0z" fill="url(#' + bgId + ')"/>',
    '<circle cx="88" cy="19" r="36" fill="' + p.accent + '" opacity=".12"/><path d="M5 102 27 78 42 88 57 75 82 91 108 72v40H5Z" fill="#07111d" opacity=".42"/>',
    '<path d="M10 114Q13 80 34 76L45 72H67L79 77Q100 83 103 114Z" fill="' + p.shirt + '"/>',
    '<path d="M25 112 39 80 55 94 71 80 88 112Z" fill="' + p.accent + '" opacity=".72"/>' + p.shoulderDetail + clipboard,
    '<path d="M43 66h26l4 17-17 13-17-13Z" fill="' + p.skin + '"/>',
    '<path d="M27 48Q26 24 54 21Q82 22 85 51L78 69Q71 81 56 82Q39 79 31 66Z" fill="url(#' + faceId + ')" stroke="#573c31" stroke-opacity=".16" stroke-width="1.5"/>',
    '<ellipse cx="29" cy="54" rx="5" ry="8" fill="' + p.skin + '"/><ellipse cx="83" cy="54" rx="5" ry="8" fill="' + p.skin + '"/>',
    p.hairShape,
    '<path d="M36 48Q43 43 49 47M63 47Q70 43 77 48" fill="none" stroke="' + p.brows + '" stroke-width="3.1" stroke-linecap="round"/>',
    '<ellipse cx="43" cy="54" rx="3.1" ry="3.8" fill="#172235"/><ellipse cx="69" cy="54" rx="3.1" ry="3.8" fill="#172235"/><circle cx="44" cy="53" r="1" fill="#fff"/><circle cx="70" cy="53" r="1" fill="#fff"/>',
    '<path d="M56 54 52 64Q56 67 60 64" fill="none" stroke="#a86f58" stroke-width="2" stroke-linecap="round"/><path d="M47 72Q56 77 65 71" fill="none" stroke="#814b42" stroke-width="2.4" stroke-linecap="round"/>',
    p.beardShape, goggles, p.headgear,
    '<path d="M9 95h20M84 95h19" stroke="#fff" stroke-opacity=".22" stroke-width="1.4"/><path d="M9 16h12M15 10v12" stroke="' + p.accent + '" stroke-opacity=".5" stroke-width="1.5"/>',
    '</g><circle cx="88" cy="86" r="14" fill="#08111d" stroke="' + p.accent + '" stroke-width="2"/><g transform="translate(88 86)" stroke-linecap="round" stroke-linejoin="round">' + p.badgeShape + '</g>',
    '<path d="M11 9h12M9 11v12M101 89v12M89 103h12" stroke="#fff" stroke-opacity=".38" stroke-width="1.4" fill="none"/></svg>'
  ].join('');
};
const escapeLeaderboardText = (value: string): string => value.replace(/[&<>"']/g, (character) => {
  switch (character) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    case "'": return '&#39;';
    default: return character;
  }
});
class MaxFlizScene extends xb.Script {
  private engine!: MaxFlizGameEngine;
  private cinematicIntro: CinematicIntroManager | null = null;
  private selectedCharId: CharacterId = 'marcin';
  private selectedLevelId: number = 1;
  private lastScore: number = 0;
  private lastCoins: number = 0;
  private lastTimeSeconds: number = 0;
  private lastBossDefeated: boolean = false;
  private lastMode: 'campaign' | 'survival' = 'campaign';
  private camera: THREE.PerspectiveCamera;
  private fallbackScene: THREE.Scene;
  private lastLoopTick: number = performance.now();
  private particleSystem: THREE.Points | null = null;
  private lastFpsTime: number = performance.now();
  private frameCount: number = 0;
  private currentFps: number = 60;
  private smoothedFps: number = 60;
  private adaptiveRenderScale: number = 1;
  private adaptiveRecoverySince: number = 0;
  private pausedForVisibility: boolean = false;
  private resetTouchJoystick: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastAdaptiveQualityAt: number = 0;
  private hasAppliedInitialViewport = false;
  private selectiveBloom: SelectiveBloomPipeline | null = null;
  private restoreSelectiveBloomOverride: (() => void) | null = null;

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
      const isTouchViewport = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      const uiProfile = calculateUiViewport(width, height, isTouchViewport);
      const root = document.documentElement;
      root.style.setProperty('--ui-scale', uiProfile.scale.toFixed(3));
      root.style.setProperty('--ui-font-scale', uiProfile.fontScale.toFixed(3));
      root.style.setProperty('--ui-panel-max', uiProfile.panelMaxWidth + 'px');
      root.dataset.uiDensity = uiProfile.density;
      root.dataset.uiLandscapeTouch = String(uiProfile.landscapeTouch);

      if (this.camera) {
        // Keep resize-time framing in sync with the in-game camera profile.
        // This avoids a second, visible FOV correction on the next gameplay frame.
        if (aspect < 0.65) {
          this.camera.fov = 60;
        } else if (aspect < 1.0) {
          this.camera.fov = 54;
        } else if (aspect < 1.35) {
          this.camera.fov = 48;
        } else {
          this.camera.fov = 45;
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
        const dpr = Math.max(0.85, Math.min(window.devicePixelRatio || 1, isMobile ? 1.65 : 2.0) * this.adaptiveRenderScale);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        this.selectiveBloom?.resize(width, height, renderer.getPixelRatio());
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
      this.resetTouchJoystick?.();
      window.setTimeout(() => {
        this.resetTouchJoystick?.();
        scheduleResize();
      }, 180);
    }, { passive: true });

    const handleFullscreenChange = () => {
      this.resetTouchJoystick?.();
      scheduleResize();
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // Older WebKit builds expose the prefixed event alongside the standard one.
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
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
    const hudPerksRow = document.getElementById('hud-perks-row');
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
      const containerElem = document.getElementById('dialogue-container');
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

        const floatSpeed = t.type === 'easter-egg' ? 0.28 : 0.8;
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
        onAbilityCooldown: (progress, ready, remainingSeconds, killRechargeEnabled) => {
          if (abilityCooldownOverlay) {
            abilityCooldownOverlay.style.width = `${(1 - progress) * 100}%`;
          }
          const btn = document.getElementById('btn-ability') as HTMLButtonElement | null;
          const hint = btn?.querySelector<HTMLElement>('.ability-hint');
          if (btn) {
            btn.disabled = !ready;
            btn.style.opacity = ready ? '1' : '0.72';
            btn.classList.toggle('is-ready', ready);
            btn.setAttribute('aria-label', ready
              ? 'Umiejętność specjalna gotowa'
              : `Umiejętność ładuje się przez ${Math.ceil(remainingSeconds)} sekund`);
          }
          if (hint) {
            hint.textContent = ready
              ? 'GOTOWA [E]'
              : killRechargeEnabled
                ? `ŁADOWANIE ${Math.ceil(remainingSeconds)}s • ELIMINACJE ŁADUJĄ`
                : `ŁADOWANIE ${Math.ceil(remainingSeconds)}s`;
          }
        },
        onSurvivalDashUpdate: (progress, ready, remainingSeconds) => {
          const dashButton = document.getElementById('btn-touch-dash') as HTMLButtonElement | null;
          if (!dashButton) return;
          dashButton.disabled = !ready;
          dashButton.textContent = ready ? '↗ UNIK' : Math.ceil(remainingSeconds) + 's';
          dashButton.style.opacity = ready ? '1' : '0.72';
          dashButton.style.setProperty('--dash-progress', (Math.max(0, Math.min(1, progress)) * 100) + '%');
          dashButton.setAttribute('aria-label', ready
            ? 'Unik taktyczny gotowy. Naciśnij Q lub przycisk.'
            : 'Unik taktyczny ładuje się przez ' + Math.ceil(remainingSeconds) + ' sekund.');
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
          const hasVisiblePerk = Boolean(hudPerksRow && hudPerksRow.querySelector('.perk-badge:not(.hidden)'));
          hudPerksRow?.classList.toggle('hidden', !hasVisiblePerk);
        },
        onLevelComplete: (levelId, score, timeStr) => {
          this.lastScore = score;
          this.lastCoins = this.engine.getCollectedVipCount();
          this.lastTimeSeconds = this.engine.getElapsedSeconds();
          this.lastBossDefeated = this.engine.isBossDefeated();
          this.lastMode = this.engine.getGameMode();

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
          hudPerksRow?.classList.add('hidden');
          survivalHud?.classList.add('hidden');
          survivalLevelUp?.classList.add('hidden');

          this.prepareScoreSubmissionForm(
            'player-nickname-input',
            'btn-submit-score',
            'submit-feedback-msg'
          );

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
          this.lastScore = this.engine.getScore();
          this.lastCoins = this.engine.getCollectedVipCount();
          this.lastTimeSeconds = this.engine.getElapsedSeconds();
          this.lastBossDefeated = this.engine.isBossDefeated();
          this.lastMode = this.engine.getGameMode();

          const finalScore = document.getElementById('gameover-score');
          const finalTime = document.getElementById('gameover-time');
          const finalMode = document.getElementById('gameover-mode-summary');
          const runDetail = document.getElementById('gameover-run-detail');
          if (finalScore) finalScore.textContent = this.lastScore.toLocaleString('pl-PL');
          if (finalTime) {
            const minutes = Math.floor(this.lastTimeSeconds / 60);
            const seconds = this.lastTimeSeconds % 60;
            finalTime.textContent = minutes + ':' + String(seconds).padStart(2, '0');
          }
          if (finalMode) finalMode.textContent = this.lastMode === 'survival' ? 'SURVIVAL SHIFT' : 'KAMPANIA';
          if (this.lastMode === 'survival') {
            const snapshot = this.engine.getSurvivalSnapshot();
            if (runDetail) runDetail.textContent = `FALA ${snapshot.wave} • ${snapshot.kills} ELIMINACJI • POZIOM ${snapshot.level}`;
          } else if (runDetail) {
            runDetail.textContent = `SEKTOR ${this.selectedLevelId} • ŁADUNEK VIP: ${this.lastCoins}`;
          }
          this.prepareScoreSubmissionForm(
            'player-nickname-gameover',
            'btn-submit-score-gameover',
            'submit-feedback-gameover'
          );

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
          hudPerksRow?.classList.add('hidden');
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
          if (survivalKillsElem) {
            survivalKillsElem.textContent = String(snapshot.kills) + ' / ' + String(snapshot.perfectDodges) + (snapshot.counterattackReady ? ' ✦' : '');
            survivalKillsElem.title = snapshot.counterattackReady
              ? 'Kontratak naładowany: następna salwa broni zada +1 obrażenie.'
              : 'Eliminacje / idealne uniki';
          }
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

    // The 2D intro is created lazily on first use; the boot sequence requests
    // its first run after the renderer and title UI are fully ready.
    this.cinematicIntro = null;

    const updateCharacterUI = (id: CharacterId) => {
      this.selectedCharId = id;
      const def = CHARACTERS[id];
      if (hudHeroName) hudHeroName.textContent = def.name;
      if (hudHeroRole) hudHeroRole.textContent = def.role;
      if (abilityName) abilityName.textContent = def.abilityName;

      const abilityIcons: Record<CharacterId, string> = {
        marcin: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M15 10h18a4 4 0 0 1 4 4v25H11V14a4 4 0 0 1 4-4Z'/><path d='M19 10V7h10v3M17 19h12M17 26l3 3 5-6M29 27h4M17 34h15'/><path d='m33 15 1.6 2.4 2.8.8-2.8.9-1.6 2.4-1.5-2.4-2.8-.9 2.8-.8Z' fill='currentColor' stroke='none'/></svg>",
        grzesiek: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M8 19v10M13 15v18M35 15v18M40 19v10M13 24h22'/><path d='M6 14v20M42 14v20'/><path d='m24 8 2.4 5.2 5.7.8-4.1 4 1 5.7-5-2.7-5 2.7 1-5.7-4.1-4 5.7-.8Z' fill='currentColor' stroke='none' opacity='.28'/></svg>",
        dawid: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M24 6 39 12v11c0 9-6.5 15-15 19C15.5 38 9 32 9 23V12Z'/><path d='M15 17h18M13 23h22M16 29h16M19 35h10'/><path d='m30 12 4 4-4 4M18 27l-4 4 4 4' opacity='.78'/></svg>",
        mateusz: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='m9 18 3-10 9 7h6l9-7 3 10v11c0 8-7 12-15 12S9 37 9 29Z'/><path d='M17 25h.1M31 25h.1M19 33q5 4 10 0'/><path d='m27 16-5 10h5l-3 8 9-12h-5l3-6Z' fill='currentColor' stroke='none'/></svg>",
        piotr: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M27 10a10 10 0 0 0 11 13L24 37a4 4 0 0 1-6-6l15-14A10 10 0 0 0 27 10Z'/><path d='m30 8 5-4 8 8-4 5M18 30l-3-3M14 34l-3-3'/></svg>",
      };
      if (heroAvatar) heroAvatar.innerHTML = operatorPortrait(id);
      // The menu and HUD share the same bespoke portrait; each operator keeps
      // an individual accent and an accessible selected-card state.
      document.querySelectorAll<HTMLElement>('.char-card[data-char]').forEach((card) => {
        const cardId = card.dataset.char as CharacterId | undefined;
        if (!cardId || !CHARACTERS[cardId]) return;
        const definition = CHARACTERS[cardId];
        const accent = definition.color.toString(16).padStart(6, '0');
        const badge = card.querySelector<HTMLElement>('.operator-emblem');
        card.style.setProperty('--operator-accent', `#${accent}`);
        card.setAttribute('aria-pressed', String(cardId === id));
        card.setAttribute('aria-label', `${definition.name} — ${definition.role}`);
        if (badge) badge.innerHTML = operatorPortrait(cardId);
      });
      if (abilityIcon) { abilityIcon.innerHTML = abilityIcons[id] || abilityIcons.marcin; abilityIcon.dataset.operatorIcon = id; }

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
        marcin: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 9h19l6 6v24H12Z'/><path d='M31 9v7h6M18 22h12M18 28h8M18 34h10'/><path d='m34 22 1.7 3 3.3 1-3.3 1-1.7 3-1.7-3-3.3-1 3.3-1Z' fill='currentColor' stroke='none'/></svg>",
        grzesiek: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M10 17h7v14h-7zM31 17h7v14h-7zM17 24h14'/><path d='M6 14v20M42 14v20M21 8l3 4 3-4M21 40l3-4 3 4'/><path d='M8 9 4 5M40 9l4-4' opacity='.75'/></svg>",
        dawid: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M13 11h22v27H13z'/><path d='M13 18h22M13 31h22M19 11v27M29 11v27'/><path d='M18 7h12M21 4h6'/><path d='m34 22 7 2-7 3' /><path d='m14 25-7 2 7 3'/></svg>",
        mateusz: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='m27 5-16 22h11l-2 16 18-25H27Z' fill='currentColor' stroke='none'/><path d='M7 14 11 17M37 8l-3 5M40 34l-5-2' opacity='.8'/></svg>",
        piotr: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M27 9a10 10 0 0 0 11 13L24 36a4.5 4.5 0 0 1-6-6l14-15A10 10 0 0 0 27 9Z'/><path d='m30 8 5-4 8 8-4 5'/><path d='m9 40 4-4m-7 0 4-4' opacity='.8'/></svg>",
      };
      const attackDescriptions: Record<CharacterId, string> = {
        marcin: 'Wysyła świetlny znak-zlecenie z programu Optima. Trafiony cel zostaje ogłuszony, a co trzeci czar tworzy mocniejszą pieczęć audytu.',
        grzesiek: 'Miota ciężkim stalowym hantlem. Co trzeci rzut jest większy, mocniej odrzuca i przebija kilku przeciwników.',
        dawid: 'Rzuca rolką folii stretch, która owija i spowalnia przeciwników. Co trzeci rzut mocniej wiąże cel.',
        mateusz: 'Strzela pojedynczym impulsem paralizatora. Trafiony przeciwnik dostaje elektryczny stun; co trzeci impuls jest mocniejszy.',
        piotr: 'Miota ciężkim kluczem grzechotkowym B4. Wiruje, przebija kilka celów i wraca przez tłum do Piotra; co trzeci rzut jest mocniejszy i rozgrzany do czerwoności.',
      };
      if (attackNameElem) attackNameElem.textContent = attackNames[id] || 'Atak';
      if (attackIconElem) { attackIconElem.innerHTML = attackIcons[id] || attackIcons.marcin; attackIconElem.dataset.operatorIcon = id; }

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
            const safePlayerName = escapeLeaderboardText(entry.playerName);
            const safeHeroName = escapeLeaderboardText(entry.hero);
            const modeLabel = entry.mode === 'survival' ? 'SURVIVAL' : 'KAMPANIA';
            const modeClass = entry.mode === 'survival' ? 'survival' : 'campaign';
            const syncBadge = entry.syncStatus === 'pending' ? '<span class="leaderboard-sync-pill pending">OCZEKUJE ONLINE</span>' : '';
            const mins = Math.floor(entry.timeSeconds / 60);
            const secs = entry.timeSeconds % 60;
            const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            const recordTimestamp = formatLeaderboardTimestamp(entry.createdAt);

            const row = document.createElement('div');
            row.className = `leaderboard-item ${idx < 3 ? 'top-' + (idx + 1) : ''}`;
            row.innerHTML = `
              <div class="leaderboard-rank">${rankDisplay}</div>
              <div class="leaderboard-hero-tag">${heroIcon}</div>
              <div class="leaderboard-player-info">
                <div class="leaderboard-player-name">${safePlayerName} ${bossBadge}</div>
                <div class="leaderboard-player-subline"><span class="leaderboard-mode-pill ${modeClass}">${modeLabel}</span>${syncBadge}</div>
                <div class="leaderboard-player-meta">${safeHeroName} • Czas: ${timeFormatted} • VIP: ${entry.coins}</div>
                <div class="leaderboard-record-time">REKORD: ${recordTimestamp}</div>
              </div>
              <div class="leaderboard-score-cluster">
                <div class="leaderboard-score-val">${entry.score.toLocaleString('pl-PL')} pkt</div>
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

    document.querySelectorAll<HTMLElement>('.char-card').forEach((card) => {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      const selectChar = (e?: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        document.querySelectorAll('.char-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const charId = card.getAttribute('data-char') as CharacterId;
        if (charId) updateCharacterUI(charId);
      };
      card.addEventListener('click', selectChar);
      card.addEventListener('touchend', selectChar);
      card.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') selectChar(event);
      });
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
    const launchCampaignGame = async (e?: Event) => {
      if (startingGame) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Lock immediately, before awaiting asset readiness. This prevents two
      // quick taps from starting two independent campaign transitions.
      startingGame = true;
      const startButton = document.getElementById('btn-start-game') as HTMLButtonElement | null;
      if (startButton) {
        startButton.disabled = true;
        startButton.setAttribute('aria-busy', 'true');
      }

      try {
        await assetLoader.waitUntilReady('Gra 3D');

        if (!this.engine || typeof this.engine.startGame !== 'function') {
          throw new Error('Silnik gry nie jest jeszcze gotowy.');
        }

        if (this.cinematicIntro?.isRunning()) this.cinematicIntro.stop(false, false);
        this.engine.setLevelVisible(true);
        // Start the engine before dismissing the menu. If initialization fails,
        // the player remains on the menu and can retry instead of seeing a dead screen.
        this.engine.startGame(this.selectedLevelId);

        document.getElementById('story-intro-modal')?.classList.add('hidden');
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

        document.getElementById('campaign-start-error')?.remove();
      } catch (error) {
        console.error('[Campaign] Nie udało się uruchomić kampanii:', error);
        document.getElementById('story-intro-modal')?.classList.add('hidden');
        titleScreen?.classList.remove('hidden');
        titleScreen?.style.setProperty('display', 'flex', 'important');
        hudTop?.classList.add('hidden');
        hudBottom?.classList.add('hidden');
        touchControls?.classList.add('hidden');

        let errorBanner = document.getElementById('campaign-start-error');
        if (!errorBanner && titleScreen) {
          errorBanner = document.createElement('div');
          errorBanner.id = 'campaign-start-error';
          errorBanner.setAttribute('role', 'alert');
          errorBanner.style.cssText = 'position:relative;z-index:10000002;max-width:min(92vw,620px);margin:12px auto;padding:12px 16px;border:1px solid rgba(248,113,113,.65);border-radius:12px;background:rgba(69,10,10,.94);color:#fee2e2;font:600 13px/1.45 system-ui,sans-serif;text-align:center;';
          titleScreen.appendChild(errorBanner);
        }
        if (errorBanner) {
          errorBanner.textContent = 'Kampania nie wystartowała. Silnik zgłosił błąd — sprawdź połączenie i spróbuj ponownie.';
        }
      } finally {
        startingGame = false;
        if (startButton) {
          startButton.disabled = false;
          startButton.removeAttribute('aria-busy');
        }
      }
    };

    // The primary CTA starts the campaign immediately. The briefing remains
    // available as an optional archive so it can never block entry to the game.
    let openCampaignBriefing = () => {
      document.getElementById('story-intro-modal')?.classList.remove('hidden');
    };
    const doStartGame = (e?: Event) => {
      void launchCampaignGame(e);
    };

    const doStartSurvival = async (e?: Event) => {
      if (startingGame) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Lock before waiting for assets, just like the campaign route. Without
      // this, two taps separated by more than the tap debounce can both resume
      // here and construct duplicate Survival arenas.
      startingGame = true;
      const startButton = document.getElementById('btn-start-survival') as HTMLButtonElement | null;
      if (startButton) {
        startButton.disabled = true;
        startButton.setAttribute('aria-busy', 'true');
      }

      try {
        await assetLoader.waitUntilReady('Gra 3D');

        if (!this.engine || typeof this.engine.startSurvival !== 'function') {
          throw new Error('Silnik Survival Shift nie jest jeszcze gotowy.');
        }

        if (this.cinematicIntro?.isRunning()) this.cinematicIntro.stop(false, false);
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
      } finally {
        // Keep the lock briefly after the synchronous scene swap so late touch
        // and synthetic click events cannot immediately start another arena.
        setTimeout(() => {
          startingGame = false;
          if (startButton) {
            startButton.disabled = false;
            startButton.removeAttribute('aria-busy');
          }
        }, 600);
      }
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


    // Secret menu interaction: three deliberate taps/clicks on the title reveal
    // the Capybara Mafia. The sequence resets after a short pause.
    const capybaraTrigger = new ThreeClickTrigger(2400, 3);
    const menuTitleTrigger = document.querySelector<HTMLElement>('.menu-game-title');
    const capybaraModal = document.getElementById('capybara-mafia-easter-egg');
    const capybaraCloseButtons = capybaraModal?.querySelectorAll<HTMLElement>('[data-capybara-close]');
    const closeCapybaraMeeting = () => {
      if (!capybaraModal) return;
      capybaraModal.classList.add('hidden');
      capybaraModal.setAttribute('aria-hidden', 'true');
      menuTitleTrigger?.focus();
    };
    menuTitleTrigger?.addEventListener('click', () => {
      if (!capybaraModal || !capybaraTrigger.register(Date.now())) return;
      capybaraModal.classList.remove('hidden');
      capybaraModal.setAttribute('aria-hidden', 'false');
      capybaraModal.querySelector<HTMLButtonElement>('.capybara-easter-close')?.focus();
    });
    capybaraCloseButtons?.forEach((button) => button.addEventListener('click', closeCapybaraMeeting));
    capybaraModal?.addEventListener('click', (event) => {
      if (event.target === capybaraModal || (event.target as HTMLElement).dataset.capybaraClose === 'true') {
        closeCapybaraMeeting();
      }
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && capybaraModal && !capybaraModal.classList.contains('hidden')) {
        closeCapybaraMeeting();
      }
    });

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

    let cinematicIntroLaunchPending = false;
    const launchCinematicIntro = async (e?: Event) => {
      if (this.cinematicIntro?.isRunning() || cinematicIntroLaunchPending) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      cinematicIntroLaunchPending = true;
      try {
        await assetLoader.waitUntilReady('Cinematic Intro');

        if (!this.cinematicIntro) {
          this.cinematicIntro = new CinematicIntroManager({
            onComplete: () => {
              this.engine.setLevelVisible(true);
              if (titleScreen) {
                titleScreen.classList.remove('hidden');
                titleScreen.style.setProperty('display', 'flex', 'important');
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
        this.cinematicIntro.start();
      } catch (error) {
        console.error('[CinematicIntro] Nie udało się uruchomić intro:', error);
        assetLoader.hide();
        this.engine?.setLevelVisible(true);
        titleScreen?.classList.remove('hidden');
        titleScreen?.style.setProperty('display', 'flex', 'important');
      } finally {
        cinematicIntroLaunchPending = false;
      }
    };

    document.getElementById('btn-open-cinematic-intro')?.addEventListener('click', launchCinematicIntro);

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

    openCampaignBriefing = () => {
      updateStorySlides(0);
      storyModal?.classList.remove('hidden');
      storyModal?.querySelector<HTMLButtonElement>('#btn-close-story')?.focus();
    };

    bindTap(document.getElementById('btn-open-story-modal'), () => {
      openCampaignBriefing();
    });

    bindTap(btnCloseStory, () => {
      storyModal?.classList.add('hidden');
    });

    bindTap(btnStoryPrev, () => {
      updateStorySlides(currentSlide - 1);
    });

    bindTap(btnStoryNext, () => {
      updateStorySlides(currentSlide + 1);
    });

    bindTap(btnStoryPlay, (event) => {
      void launchCampaignGame(event);
    });

    storyDots.forEach((dot) => {
      bindTap(dot as HTMLElement, () => {
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
      hudPerksRow?.classList.add('hidden');
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

    const bindScoreSubmission = (buttonId: string, inputId: string, feedbackId: string) => {
      const submitBtn = document.getElementById(buttonId) as HTMLButtonElement | null;
      const nickInput = document.getElementById(inputId) as HTMLInputElement | null;
      const feedbackMsg = document.getElementById(feedbackId);

      submitBtn?.addEventListener('click', async () => {
        const playerName = nickInput?.value.trim().slice(0, 32) ||
          `Kierownik ${CHARACTERS[this.selectedCharId].name}`;
        try { localStorage.setItem('maxfliz_player_nick', playerName); } catch { /* private browsing */ }

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ ZAPISYWANIE...';
        if (feedbackMsg) {
          feedbackMsg.className = 'submit-feedback';
          feedbackMsg.textContent = 'Wysyłanie wyniku do rankingu globalnego...';
          feedbackMsg.classList.remove('hidden');
        }

        try {
          const result = await submitScore({
            playerName,
            hero: CHARACTERS[this.selectedCharId].name,
            mode: this.lastMode,
            score: this.lastScore,
            coins: this.lastCoins,
            timeSeconds: this.lastTimeSeconds,
            bossDefeated: this.lastBossDefeated,
          });

          if (result.status === 'online') {
            submitBtn.textContent = '✅ ZAPISANO ONLINE';
            if (feedbackMsg) {
              feedbackMsg.className = 'submit-feedback success';
              feedbackMsg.textContent = 'Wynik jest już w globalnym rankingu online.';
            }
          } else {
            submitBtn.textContent = '⏳ W KOLEJCE';
            if (feedbackMsg) {
              feedbackMsg.className = 'submit-feedback';
              feedbackMsg.textContent = 'Wynik zabezpieczono lokalnie. Zostanie wysłany do rankingu, gdy połączenie wróci.';
            }
          }
          renderLeaderboard();
        } catch (error) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'RETRY 💾';
          if (feedbackMsg) {
            feedbackMsg.className = 'submit-feedback error';
            feedbackMsg.textContent = 'Nie udało się zapisać wyniku. Spróbuj ponownie.';
          }
          console.warn('Score submission failed:', error);
        }
      });
    };

    bindScoreSubmission('btn-submit-score', 'player-nickname-input', 'submit-feedback-msg');
    bindScoreSubmission('btn-submit-score-gameover', 'player-nickname-gameover', 'submit-feedback-gameover');

    ensureLeaderboardServices().catch(console.warn);
    renderLeaderboard();
    window.addEventListener('online', () => {
      ensureLeaderboardServices().then(() => renderLeaderboard()).catch(console.warn);
    });

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

    const syncGameSpeedButtons = () => {
      for (const [id, value] of [['btn-speed-1x', 1], ['btn-speed-2x', 2]] as const) {
        const button = document.getElementById(id) as HTMLButtonElement | null;
        if (!button) continue;
        const active = this.engine.getTimeScale() === value;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', active ? `Szybkość ${value}x aktywna` : `Ustaw szybkość ${value}x`);
      }
    };
    document.getElementById('btn-speed-1x')?.addEventListener('click', () => {
      this.engine.setTimeScale(1);
      syncGameSpeedButtons();
    });
    document.getElementById('btn-speed-2x')?.addEventListener('click', () => {
      this.engine.setTimeScale(2);
      syncGameSpeedButtons();
    });
    syncGameSpeedButtons();

    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.display = 'flex';
    }
    this.engine.startTitle();
    // The intro is the actual opening beat now, not an obsolete menu demo.
    window.setTimeout(() => { void launchCinematicIntro(); }, 220);
  }

  private prepareScoreSubmissionForm(inputId: string, buttonId: string, feedbackId: string) {
    const nickInput = document.getElementById(inputId) as HTMLInputElement | null;
    const submitBtn = document.getElementById(buttonId) as HTMLButtonElement | null;
    const feedbackMsg = document.getElementById(feedbackId);
    let savedNick = '';
    try { savedNick = localStorage.getItem('maxfliz_player_nick') || ''; } catch { /* private browsing */ }

    if (nickInput) nickInput.value = savedNick || `Kierownik ${CHARACTERS[this.selectedCharId].name}`;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 ZAPISZ W RANKINGU';
    }
    if (feedbackMsg) {
      feedbackMsg.className = 'submit-feedback hidden';
      feedbackMsg.textContent = '';
    }
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
    let maxRadius = 36;
    const getJoystickRadius = () => {
      const baseRect = joystickBase.getBoundingClientRect();
      const knobRect = joystickKnob.getBoundingClientRect();
      const baseSize = Math.min(baseRect.width || 112, baseRect.height || 112);
      const knobSize = Math.min(knobRect.width || 46, knobRect.height || 46);
      return Math.max(20, Math.min(56, (baseSize - knobSize) * 0.5 - 4));
    };

    const resetJoystick = () => {
      activePointerId = null;
      joystickBase.classList.remove('active');
      joystickKnob.style.transform = 'translate(0px, 0px)';
      this.engine.setVirtualInput(0, 0);
    };
    this.resetTouchJoystick = resetJoystick;

    const handleStart = (event: PointerEvent) => {
      if (activePointerId !== null || event.button > 0) return;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      maxRadius = getJoystickRadius();

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
    bindTouchAction('btn-touch-dash', () => this.engine.triggerDash());
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
    const activeRenderer = xb.core?.renderer;
    const renderer = activeRenderer instanceof THREE.WebGLRenderer ? activeRenderer : null;
    if (renderer) {
      const isMobile = width < 900 || ('ontouchstart' in window);
      renderer.setPixelRatio(Math.max(0.85, Math.min(window.devicePixelRatio || 1, isMobile ? 1.65 : 2.0) * this.adaptiveRenderScale));
      renderer.setSize(width, height, false);
    }

    const scene = xb.core?.scene || this.fallbackScene;
    const camera = (xb.core?.camera as THREE.PerspectiveCamera) || this.camera;

    // Replace any simulator backdrop, but leave fog distances and sector colour
    // under the game engine's control. Overwriting fog here crushed the far map
    // into near-black and removed the sense of depth in every warehouse sector.
    if (scene) {
      scene.background = new THREE.Color(0x07131d);
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
    // Apply the initial viewport profile immediately; waiting for the next
    // resize event leaves portrait devices with the desktop camera distance.
    this.engine.applyAutoCameraScaleForViewport();

    // The selective bloom hook uses XR Blocks' supported scene-render override.
    // Non-WebGL backends retain their normal render path.
    const core = xb.core;
    if (renderer && core && scene && renderer.extensions.has('EXT_color_buffer_float')) {
      this.restoreSelectiveBloomOverride?.();
      this.restoreSelectiveBloomOverride = null;
      this.selectiveBloom?.dispose();
      this.selectiveBloom = null;
      try {
        const isMobile = width < 900 || ('ontouchstart' in window);
        const pipeline = new SelectiveBloomPipeline(
          renderer, scene, camera, width, height, renderer.getPixelRatio(), isMobile
        );
        const previousOverride = core.renderSceneOverride;
        const renderOverride: NonNullable<typeof core.renderSceneOverride> = (activeRenderer, activeScene, activeCamera) => {
          if (this.selectiveBloom === pipeline && activeRenderer instanceof THREE.WebGLRenderer && activeScene === scene) {
            // Selective bloom adds a second scene pass. Keep Campaign polish,
            // but bypass that pass in the crowd-heavy Survival mode.
            const renderFps = this.engine?.getGameMode() === 'survival' ? 0 : this.currentFps;
            pipeline.render(activeCamera, renderFps, performance.now());
          } else if (previousOverride) {
            previousOverride(activeRenderer, activeScene, activeCamera);
          } else {
            const fallbackRenderer = activeRenderer as unknown as { render?: (targetScene: THREE.Scene, targetCamera: THREE.Camera) => void };
            fallbackRenderer.render?.(activeScene, activeCamera);
          }
        };
        this.selectiveBloom = pipeline;
        core.renderSceneOverride = renderOverride;
        this.restoreSelectiveBloomOverride = () => {
          if (core.renderSceneOverride === renderOverride) core.renderSceneOverride = previousOverride;
        };
      } catch (error) {
        this.selectiveBloom?.dispose();
        this.selectiveBloom = null;
        console.warn('Selective Bloom unavailable; keeping the standard renderer:', error);
      }
    } else if (renderer && core && !renderer.extensions.has('EXT_color_buffer_float')) {
      console.info('Selective Bloom skipped: this GPU does not expose half-float render targets.');
    }
  }


  private applyInitialViewportProfile() {
    const width = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth));
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight));
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const profile = calculateUiViewport(width, height, isTouch);
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', profile.scale.toFixed(3));
    root.style.setProperty('--ui-font-scale', profile.fontScale.toFixed(3));
    root.style.setProperty('--ui-panel-max', profile.panelMaxWidth + 'px');
    root.dataset.uiDensity = profile.density;
    root.dataset.uiLandscapeTouch = String(profile.landscapeTouch);

    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.65 ? 60 : aspect < 1 ? 54 : aspect < 1.35 ? 48 : 45;
    this.camera.updateProjectionMatrix();

    const renderer = (xb.core?.renderer as THREE.WebGLRenderer) || null;
    if (renderer) {
      const isMobile = width < 900 || isTouch;
      renderer.setPixelRatio(Math.max(0.85, Math.min(window.devicePixelRatio || 1, isMobile ? 1.65 : 2.0) * this.adaptiveRenderScale));
      renderer.setSize(width, height, false);
      this.selectiveBloom?.resize(width, height, renderer.getPixelRatio());
    }
    this.engine?.applyAutoCameraScaleForViewport();
  }

  update() {
    if (!this.hasAppliedInitialViewport && xb.core?.renderer) {
      this.hasAppliedInitialViewport = true;
      this.applyInitialViewportProfile();
    }
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

    // The game engine owns the scene palette and sector fog. Do not force a
    // black background/fog every frame: it overrides each sector's lighting
    // profile and creates avoidable per-frame Color allocations.
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
    const isSurvival = this.engine?.getGameMode() === 'survival';

    // Survival reaches the heaviest simultaneous crowd/effect load, so mobile
    // resolution steps down earlier and takes longer to recover between waves.
    const recoveryFloor = isMobile && isSurvival
      ? (this.adaptiveRenderScale < 0.76 ? 43 : this.adaptiveRenderScale < 0.85 ? 51 : 59)
      : this.adaptiveRenderScale < 0.76
        ? (isMobile ? 37 : 36)
        : this.adaptiveRenderScale < 0.85
          ? (isMobile ? 45 : 43)
          : (isMobile ? 57 : 54);
    if (this.smoothedFps >= recoveryFloor) {
      if (this.adaptiveRecoverySince === 0) this.adaptiveRecoverySince = now;
    } else {
      this.adaptiveRecoverySince = 0;
    }

    const stableRecoveryMs = this.adaptiveRecoverySince > 0 ? now - this.adaptiveRecoverySince : 0;
    const nextScale = getAdaptiveRenderScale(
      this.smoothedFps,
      isMobile,
      this.adaptiveRenderScale,
      stableRecoveryMs,
      isSurvival
    );
    if (nextScale > this.adaptiveRenderScale) {
      // Each recovery is one tier; the next tier must earn its own stable window.
      this.adaptiveRecoverySince = now;
    } else if (nextScale < this.adaptiveRenderScale) {
      this.adaptiveRecoverySince = 0;
    }
    this.adaptiveRenderScale = nextScale;

    const deviceCap = isMobile ? (isSurvival ? 1.42 : 1.65) : 2.0;
    const targetDpr = Math.max(0.85, Math.min(window.devicePixelRatio || 1, deviceCap) * nextScale);

    // Drawing-buffer changes are deliberately infrequent and only happen at
    // meaningful tier transitions, never on individual FPS samples.
    if (Math.abs(renderer.getPixelRatio() - targetDpr) < 0.12) return;
    renderer.setPixelRatio(targetDpr);
    renderer.setSize(width, height, false);
    this.selectiveBloom?.resize(width, height, renderer.getPixelRatio());
  }

  private tick(dt: number) {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 350) {
      this.currentFps = Math.round((this.frameCount * 1000) / Math.max(1, now - this.lastFpsTime));
      this.smoothedFps = this.smoothedFps * 0.68 + this.currentFps * 0.32;
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
      if (this.cinematicIntro && this.cinematicIntro.isRunning()) {
        // Pixel intro owns a throttled Canvas RAF; skip the hidden 3D game update.
      } else if (this.engine) {
        this.engine.update(dt);
      }
      (this as any)._updateToasts?.(dt);
    } catch (err) {
      console.warn('Loop Error:', err);
    }
  }

  onSelectEnd(event: xb.SelectEvent) {
    this.engine?.triggerAbility();
  }

  override dispose(): void {
    this.engine?.dispose();

    this.restoreSelectiveBloomOverride?.();
    this.restoreSelectiveBloomOverride = null;
    this.selectiveBloom?.dispose();
    this.selectiveBloom = null;
    super.dispose();
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
    .hud-layer button, .hud-cluster, .cam-zoom-slider-container, .cam-zoom-slider {
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
    options.setAppTitle('Max-FliX i granica Absurdu');
    
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
        r.setPixelRatio(Math.max(0.85, Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.65 : 2.0)));
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.08;
        r.shadowMap.enabled = true;
        r.shadowMap.type = isMobileDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      }

      // Keep the simulator environment out of view without replacing the
      // game's fog profile; each sector controls its own atmospheric colour.
      if (xb.core.scene) {
        xb.core.scene.background = new THREE.Color(0x07131d);
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

    // Let the browser paint the ready menu once, then launch the 20-second
    // opening sequence automatically. The intro itself is still skippable.
    const introButton = document.getElementById('btn-open-cinematic-intro') as HTMLButtonElement | null;
    if (introButton && !document.hidden) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      introButton.click();
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


