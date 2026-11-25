import './pwa-update.css';
import { shouldAnnounceServiceWorkerUpdate } from './pwaUpdateNotice.ts';
import * as THREE from 'three';
import * as xb from 'xrblocks';
import { CHARACTERS } from './characters.ts';
import { PaleciakiGameEngine, type SurvivalSnapshot, type SurvivalUpgradeOption } from './game.ts';
import { sound } from './sound.ts';
import { CinematicIntroManager } from './cinematicIntro.ts';
import { formatLeaderboardTimestamp } from './leaderboard.ts';
import {
  initializeGameAds,
  areGameAdsReady,
  showAdPrivacyOptions,
  showRewardedRerollAd,
  showInterstitialAfterRun,
} from './ads.ts';
import { CharacterId, PerkType } from './types.ts';
import { PvpNetworkSession, PvpLocalBotSession, type IPvpSession } from './pvpClient.ts';
import { getPvpFirearmAttackCooldown, PVP_OPERATOR_PROFILES, PVP_RAPID_FIRE_COOLDOWN_MULTIPLIER } from './pvpArena.ts';
import type { PvpArenaState, PvpSlot } from './pvpArena.ts';
import { AssetItem, assetLoader } from './assets.ts';
import { SelectiveBloomPipeline } from './selectiveBloom.ts';
import { disposeCombatVfxResources, getSoftGlowTexture, isSoftwareWebGLRenderer } from './combatVfx.ts';
import { ThreeClickTrigger } from './menuInteraction.ts';
import { calculateUiViewport, shouldShowTouchControls } from './uiViewport.ts';
import { getAdaptiveEffectsTier, getAdaptiveRenderScale, getDeviceRenderProfile, shouldApplyPixelRatioChange, type AdaptiveEffectsTier } from './renderQuality.ts';
import { summarizeRenderWindowMetrics } from './renderTelemetry.ts';
import { calculateVirtualJoystickInput } from './virtualJoystick.ts';

import { clampTouchJoystickOrigin } from './touchControlLayout.ts';
import {
  createInitialSurvivalAchievementProgress,
  getSurvivalAchievementCards,
  getSurvivalAchievementSummary,
  recordSurvivalSecretDiscovery,
  sanitizeSurvivalAchievementProgress,
  updateSurvivalAchievementProgress,
} from './survivalAchievements.ts';
import { SURVIVAL_MAPS, type SurvivalMapId } from './survivalMaps.ts';
import { getSurvivalFirearmAmmoAlert, SURVIVAL_FIREARM_DEFS, SURVIVAL_FIREARM_DROP_POLICY } from './survivalFirearms.ts';
import { getSurvivalFirearmBalance } from './survivalFirearmBalance.ts';
import { CAMPAIGN_STAGES, createInitialCampaignProgress, consumePendingCampaignReward, consumePendingCampaignXpBonus, getCampaignMasteryProgress, getCampaignRewardChoices, getCampaignSideOrderProgress, getCampaignStageDefinition, getNextCampaignStageId, readCampaignProgress, recordCampaignStageResult, setPendingCampaignReward, writeCampaignProgress, type CampaignProgress, type CampaignRewardDefinition, type CampaignRewardId, type CampaignStageId } from './campaignProgression.ts';
import { launchOniricPlatformer } from './oniricPlatformer.ts';
import { launchCthulhuRetroArena } from './cthulhuRetroArena.ts';
import { getMenuTabIndexForKey } from './menuTabNavigation.ts';
import { MenuScrollMemory } from './menuScrollMemory.ts';
import { getMenuSegmentForTab, MENU_SEGMENTS, type MenuSegmentId } from './menuSegments.ts';
import { getVisibilityPauseAction } from './visibilityPause.ts';
import { observeWebGLContextRecovery } from './webglContextRecovery.ts';
import { FloatingToastPool } from './floatingToastPool.ts';
// Firestore is only needed for the optional leaderboard. Keep its large SDK
// outside the initial game/menu load and fetch it when the player opens ranking.
type FirebaseLeaderboardServices = typeof import('./firebase.ts');
let firebaseLeaderboardServicesPromise: Promise<FirebaseLeaderboardServices> | null = null;

const loadFirebaseLeaderboardServices = (): Promise<FirebaseLeaderboardServices> => {
  if (!firebaseLeaderboardServicesPromise) {
    firebaseLeaderboardServicesPromise = import('./firebase.ts').catch((error: unknown) => {
      // A transient chunk/network failure must not poison future retries.
      firebaseLeaderboardServicesPromise = null;
      throw error;
    });
  }
  return firebaseLeaderboardServicesPromise;
};

import {
  ACCOUNT_PROGRESS_MAX_LEVEL,
  ACCOUNT_PROGRESS_STORAGE_KEY,
  ACCOUNT_RANKS,
  ACCOUNT_TALENTS,
  ACCOUNT_TALENT_BRANCHES,
  canSpendAccountTalentPoint,
  combineAccountAndCharacterBonuses,
  createInitialAccountProgressionProfile,
  getAccountProgressionBonuses,
  getAccountPvpProgressionBonuses,
  mergeAccountProgressionProfiles,
  getAccountProgressionSummary,
  getAccountRankInfo,
  recordAccountPvpMatch,
  recordAccountSurvivalRun,
  sanitizeAccountProgressionProfile,
  spendAccountTalentPoint,
} from './accountProgression.ts';

// Set the mobile control layer as a single, explicit UI state. Removing the
/**
 * Keep touch controls and critical dialogs inside the active fullscreen element.
 * Browsers render only descendants of document.fullscreenElement while fullscreen
 * is active; a body-level portal otherwise disappears even though it remains visible
 * in the DOM. In normal mode they share body as one predictable stacking context.
 */
function portalOverlayLayers(): void {
  const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
  const fullscreenElement = document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
  const portalRoot = fullscreenElement instanceof HTMLElement ? fullscreenElement : document.body;
  const overlayIds = [
    'touch-controls',
    'pause-modal',
    'gameover-modal',
    'victory-modal',
    'pvp-lobby-modal',
    'pvp-match-end-modal',
    'pvp-network-status',
    'webgl-recovery-notice',
  ];
  for (const id of overlayIds) {
    const element = document.getElementById(id);
    if (element && element.parentElement !== portalRoot) portalRoot.appendChild(element);
  }
}

// class alone is insufficient in some Android WebViews after the DOM portal
// move, so restore the inline presentation state whenever gameplay begins.
function setTouchControlsVisibility(visible: boolean): void {
  const layer = document.getElementById('touch-controls');
  if (!layer) return;

  // Reassert pause hit-targets after every mode/viewport transition. A few
  // legacy HUD rules can override display or pointer-events in Android WebView.
  const topPause = document.getElementById('btn-top-pause') as HTMLButtonElement | null;
  if (topPause) {
    topPause.classList.remove('hidden');
    topPause.disabled = false;
    topPause.style.setProperty('display', 'inline-flex', 'important');
    topPause.style.setProperty('visibility', 'visible', 'important');
    topPause.style.setProperty('opacity', '1', 'important');
    topPause.style.setProperty('pointer-events', 'auto', 'important');
    topPause.style.setProperty('z-index', '2147483010', 'important');
    topPause.setAttribute('aria-label', 'Wstrzymaj rozgrywkę');
  }

  const touchPause = document.getElementById('btn-touch-pause') as HTMLButtonElement | null;
  if (touchPause) {
    touchPause.classList.remove('hidden');
    touchPause.disabled = false;
    touchPause.style.setProperty('display', 'flex', 'important');
    touchPause.style.setProperty('visibility', 'visible', 'important');
    touchPause.style.setProperty('opacity', '1', 'important');
    touchPause.style.setProperty('pointer-events', 'auto', 'important');
    touchPause.style.setProperty('z-index', '2147483010', 'important');
  }

  // Reconcile the portal with the current fullscreen root on every transition.
  // A body-level child is invisible while a nested game shell owns fullscreen.
  portalOverlayLayers();
  layer.style.setProperty('position', 'fixed', 'important');
  layer.style.setProperty('inset', '0', 'important');
  layer.style.setProperty('width', '100vw', 'important');
  layer.style.setProperty('height', '100vh', 'important');
  layer.style.setProperty('height', '100dvh', 'important');
  layer.style.setProperty('z-index', '2147483000', 'important');
  layer.style.setProperty('pointer-events', 'none', 'important');
  layer.style.setProperty('isolation', 'isolate', 'important');

  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const touchCapable = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches === true;
  const finePointer = window.matchMedia?.('(pointer: fine)').matches === true;
  const shouldShowTouchLayer = shouldShowTouchControls(visible, viewportWidth, touchCapable, finePointer);

  if (shouldShowTouchLayer) {
    layer.classList.remove('hidden');
    layer.style.setProperty('display', 'block', 'important');
    layer.style.setProperty('visibility', 'visible', 'important');
    layer.style.setProperty('opacity', '1', 'important');
    layer.style.setProperty('pointer-events', 'none', 'important');
  } else {
    layer.classList.add('hidden');
    layer.style.removeProperty('display');
    layer.style.removeProperty('visibility');
    layer.style.removeProperty('opacity');
    layer.style.setProperty('pointer-events', 'none', 'important');
  }
}

/** Restore the CSS default anchor after leaving PvP or changing viewport geometry. */
function resetPvpFireControlPosition(): void {
  const control = document.getElementById('pvp-fire-control') as HTMLElement | null;
  if (!control) return;
  for (const property of ['left', 'right', 'top', 'bottom', 'transform']) {
    control.style.removeProperty(property);
  }
}

type TouchControlsMode = 'survival' | 'pvp' | 'hidden';

/**
 * Touch UI is mode-scoped. Because the layer is portaled to body, both it and
 * the WebGL shell must receive the same state or stale PvP controls can leak
 * into Survival after a scene transition on Android.
 */
function setTouchControlsMode(mode: TouchControlsMode): void {
  const layer = document.getElementById('touch-controls');
  const shell = document.getElementById('game-shell');
  const activePvp = mode === 'pvp';
  const activeSurvival = mode === 'survival';

  for (const root of [layer, shell]) {
    if (!root) continue;
    root.classList.toggle('pvp-mode', activePvp);
    root.classList.toggle('manual-aim-mode', activePvp);
    root.classList.toggle('survival-mode', activeSurvival);
  }

  const pvpHud = document.getElementById('pvp-hud');
  pvpHud?.classList.toggle('hidden', !activePvp);
  pvpHud?.setAttribute('aria-hidden', String(!activePvp));
  document.getElementById('survival-hud')?.classList.toggle('hidden', !activeSurvival);

  if (!activePvp) {
    resetPvpFireControlPosition();
    const fireButton = document.getElementById('btn-pvp-fire') as HTMLButtonElement | null;
    fireButton?.classList.add('hidden');
    if (fireButton) {
      fireButton.disabled = true;
      fireButton.dataset.roundActive = 'false';
      fireButton.dataset.operator = '';
      fireButton.classList.remove('is-reloading');
      fireButton.style.setProperty('--pvp-fire-progress', '0%');
      const label = fireButton.querySelector<HTMLElement>('.pvp-fire-label');
      const state = fireButton.querySelector<HTMLElement>('.pvp-fire-state');
      if (label) label.textContent = 'STRZAŁ';
      if (state) state.textContent = 'GOTOWY';
    }
    document.getElementById('pvp-match-end-modal')?.classList.add('hidden');
  }
}

import {
  CHARACTER_TALENTS,
  createInitialCharacterMasteryProfile,
  getCharacterMasterySummary,
  getCharacterTalentBonuses,
  recordCharacterRunResult,
  sanitizeCharacterMasteryProfile,
  spendCharacterTalentPoint,
} from './characterProgression.ts';

// warehouseAssets imports moved to assets.ts where they are preloaded


const SURVIVAL_ACHIEVEMENTS_STORAGE_KEY = 'paleciaki.survival.achievements.v1';
const CHARACTER_MASTERY_STORAGE_KEY = 'paleciaki.character.mastery.v1';

const loadAccountProgressionProfile = () => {
  try {
    const saved = localStorage.getItem(ACCOUNT_PROGRESS_STORAGE_KEY);
    return saved
      ? sanitizeAccountProgressionProfile(JSON.parse(saved))
      : createInitialAccountProgressionProfile();
  } catch {
    return createInitialAccountProgressionProfile();
  }
};

let accountProgressionProfile = loadAccountProgressionProfile();

const persistAccountProgressionProfile = () => {
  try {
    localStorage.setItem(ACCOUNT_PROGRESS_STORAGE_KEY, JSON.stringify(accountProgressionProfile));
  } catch (error) {
    console.warn('[Account progression] Local save unavailable:', error);
  }
};



const loadCharacterMasteryProfile = () => {
  try {
    const saved = localStorage.getItem(CHARACTER_MASTERY_STORAGE_KEY);
    return saved
      ? sanitizeCharacterMasteryProfile(JSON.parse(saved))
      : createInitialCharacterMasteryProfile();
  } catch {
    return createInitialCharacterMasteryProfile();
  }
};

let characterMasteryProfile = loadCharacterMasteryProfile();

const persistCharacterMasteryProfile = () => {
  try {
    localStorage.setItem(CHARACTER_MASTERY_STORAGE_KEY, JSON.stringify(characterMasteryProfile));
  } catch (error) {
    console.warn('[Mastery] Local save unavailable:', error);
  }
};


const loadSurvivalAchievementProgress = () => {
  try {
    const saved = localStorage.getItem(SURVIVAL_ACHIEVEMENTS_STORAGE_KEY);
    return saved
      ? sanitizeSurvivalAchievementProgress(JSON.parse(saved))
      : createInitialSurvivalAchievementProgress();
  } catch {
    return createInitialSurvivalAchievementProgress();
  }
};

let survivalAchievementProgress = loadSurvivalAchievementProgress();

const showAchievementUnlockToast = (achievementId: string) => {
  const achievement = getSurvivalAchievementCards(survivalAchievementProgress)
    .find((item) => item.id === achievementId);
  if (!achievement) return;
  const toast = document.createElement('div');
  toast.className = 'achievement-unlock-toast';
  const icon = document.createElement('span');
  icon.className = 'achievement-unlock-icon';
  icon.textContent = achievement.icon;
  const copy = document.createElement('div');
  copy.className = 'achievement-unlock-copy';
  const label = document.createElement('strong');
  label.textContent = 'OSIĄGNIĘCIE ODBLOKOWANE';
  const title = document.createElement('span');
  title.textContent = achievement.title;
  copy.append(label, title);
  toast.append(icon, copy);
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
};

const renderSurvivalAchievements = () => {
  const list = document.getElementById('survival-achievement-list');
  const count = document.getElementById('survival-achievements-count');
  const fill = document.getElementById('survival-achievements-fill') as HTMLElement | null;
  const secretCount = document.getElementById('survival-secret-archive-count');
  if (!list) return;

  const summary = getSurvivalAchievementSummary(survivalAchievementProgress);
  if (count) count.textContent = summary.unlocked + ' / ' + summary.total;
  if (fill) fill.style.width = (summary.unlocked / Math.max(1, summary.total) * 100) + '%';
  if (secretCount) secretCount.textContent = 'SEKRETY ' + summary.discoveredSecrets + ' / ' + summary.totalSecrets;

  const visited = new Set(survivalAchievementProgress.mapsVisited);
  document.querySelectorAll<HTMLElement>('[data-map-visited]').forEach((element) => {
    const mapId = element.dataset.mapVisited;
    const isVisited = Boolean(mapId && visited.has(mapId as keyof typeof SURVIVAL_MAPS));
    element.textContent = isVisited ? 'ODWIEDZONA' : 'NIEODKRYTA';
    element.classList.toggle('is-visited', isVisited);
  });

  list.replaceChildren();
  for (const achievement of getSurvivalAchievementCards(survivalAchievementProgress)) {
    const card = document.createElement('article');
    card.className = 'survival-achievement-card' + (achievement.unlocked ? ' is-unlocked' : '');
    const top = document.createElement('div');
    top.className = 'survival-achievement-top';
    const icon = document.createElement('span');
    icon.className = 'survival-achievement-icon';
    icon.textContent = achievement.unlocked ? achievement.icon : '🔒';
    const title = document.createElement('strong');
    title.textContent = achievement.title;
    const status = document.createElement('span');
    status.className = 'survival-achievement-status';
    status.textContent = achievement.unlocked ? 'ZDOBYTE' : 'W TOKU';
    top.append(icon, title, status);
    const description = document.createElement('p');
    description.textContent = achievement.description;
    const progress = document.createElement('div');
    progress.className = 'survival-achievement-progress';
    const progressLabel = document.createElement('span');
    progressLabel.textContent = achievement.progressLabel;
    const track = document.createElement('span');
    track.className = 'survival-achievement-track';
    const bar = document.createElement('span');
    bar.style.width = (achievement.current / Math.max(1, achievement.target) * 100) + '%';
    track.appendChild(bar);
    progress.append(progressLabel, track);
    card.append(top, description, progress);
    list.appendChild(card);
  }
};

const persistSurvivalAchievementResult = (result: { progress: typeof survivalAchievementProgress; newlyUnlocked: string[] }) => {
  const changed = JSON.stringify(result.progress) !== JSON.stringify(survivalAchievementProgress);
  if (!changed) return;
  survivalAchievementProgress = result.progress;
  try {
    localStorage.setItem(SURVIVAL_ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(survivalAchievementProgress));
  } catch (error) {
    console.warn('[Achievements] Local save unavailable:', error);
  }
  renderSurvivalAchievements();
  for (const achievementId of result.newlyUnlocked) showAchievementUnlockToast(achievementId);
};

const trackSurvivalAchievementSnapshot = (snapshot: SurvivalSnapshot) => {
  persistSurvivalAchievementResult(updateSurvivalAchievementProgress(survivalAchievementProgress, {
    mapId: snapshot.mapId,
    kills: snapshot.kills,
    elapsedSeconds: snapshot.elapsedSeconds,
    bossesDefeated: snapshot.bossesDefeated,
  }));
};

const trackSurvivalSecretAchievement = (mapId: keyof typeof SURVIVAL_MAPS, secretId: string) => {
  const result = recordSurvivalSecretDiscovery(survivalAchievementProgress, mapId, secretId);
  if (result.added) persistSurvivalAchievementResult(result);
};

// Keep ad actions and privacy controls in sync with the latest UMP decision.
const syncAdMobSettings = (consent: { enabled: boolean; privacyOptionsRequired: boolean }) => {
  document.getElementById('btn-survival-ad-reroll')?.classList.toggle('hidden', !consent.enabled);
  document.getElementById('btn-ad-privacy-options')?.classList.toggle('hidden', !consent.privacyOptionsRequired);
};

const currentDeviceRenderProfile = (viewportWidth = window.innerWidth) => {
  const device = navigator as Navigator & { deviceMemory?: number };
  const isTouch = navigator.maxTouchPoints > 0 || ('ontouchstart' in window);
  return getDeviceRenderProfile(
    viewportWidth < 900 || isTouch,
    device.deviceMemory,
    navigator.hardwareConcurrency
  );
};

// Global Unhandled Error Logger
window.addEventListener('error', (e) => {
  console.warn('Global Error Captured:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled Rejection Captured:', e.reason);
});

// Operator portraits are authentic retro-arcade pixel-art character portraits (32x32 crisp matrix).
let operatorPortraitRenderCount = 0;
const operatorPortrait = (id: CharacterId): string => {
  const meta: Record<CharacterId, { name: string; accent: string; secondary: string }> = {
    marcin: { name: 'Operator 01 (Marcin)', accent: '#62c6e8', secondary: '#f59e0b' },
    grzesiek: { name: 'Operator 02 (Grzesiek)', accent: '#5bd59a', secondary: '#22c55e' },
    dawid: { name: 'Operator 03 (Dawid)', accent: '#e9a65b', secondary: '#f97316' },
    mateusz: { name: 'Operator 04 (Mateusz)', accent: '#b49af5', secondary: '#ec4899' },
    piotr: { name: 'Operator 05 (Piotr)', accent: '#f07178', secondary: '#ef4444' },
  };
  const m = meta[id] || meta.marcin;
  const instance = ++operatorPortraitRenderCount;
  const clipId = `pixel-clip-${id}-${instance}`;

  // Pixel art pixel blocks crafted on a 32x32 arcade canvas
  let pixelLayers = '';

  if (id === 'marcin') {
    // Marcin: Safety helmet with visor, spectacles, navy collar, tie, and WZ document
    pixelLayers = `
      <!-- Helmet -->
      <rect x="8" y="3" width="16" height="3" fill="#f59e0b"/>
      <rect x="6" y="6" width="20" height="4" fill="#fbbf24"/>
      <rect x="4" y="9" width="24" height="2" fill="#d97706"/>
      <!-- Face & Hair -->
      <rect x="5" y="11" width="3" height="4" fill="#3e2723"/>
      <rect x="24" y="11" width="3" height="4" fill="#3e2723"/>
      <rect x="8" y="11" width="16" height="9" fill="#edc19b"/>
      <!-- Glasses (Cyan Wireframe) -->
      <rect x="9" y="13" width="5" height="4" fill="#075985"/>
      <rect x="10" y="14" width="3" height="2" fill="#38bdf8"/>
      <rect x="14" y="14" width="4" height="1" fill="#0284c7"/>
      <rect x="18" y="13" width="5" height="4" fill="#075985"/>
      <rect x="19" y="14" width="3" height="2" fill="#38bdf8"/>
      <!-- Eyes & Brows -->
      <rect x="9" y="12" width="5" height="1" fill="#1e293b"/>
      <rect x="18" y="12" width="5" height="1" fill="#1e293b"/>
      <rect x="11" y="15" width="1" height="1" fill="#0f172a"/>
      <rect x="20" y="15" width="1" height="1" fill="#0f172a"/>
      <!-- Mouth -->
      <rect x="13" y="18" width="6" height="1" fill="#b45309"/>
      <!-- Suit & Tie -->
      <rect x="6" y="20" width="20" height="11" fill="#1e3a8a"/>
      <rect x="12" y="20" width="8" height="5" fill="#f8fafc"/>
      <rect x="15" y="21" width="2" height="10" fill="#f59e0b"/>
      <rect x="14" y="23" width="4" height="3" fill="#d97706"/>
      <!-- WZ Document in Hand -->
      <rect x="22" y="19" width="8" height="12" fill="#ffffff"/>
      <rect x="23" y="20" width="6" height="10" fill="#f1f5f9"/>
      <rect x="24" y="21" width="4" height="1" fill="#94a3b8"/>
      <rect x="24" y="23" width="4" height="1" fill="#94a3b8"/>
      <rect x="24" y="25" width="4" height="1" fill="#94a3b8"/>
      <rect x="25" y="27" width="3" height="3" fill="#ef4444"/>
    `;
  } else if (id === 'grzesiek') {
    // Grzesiek: Green sweatband, square jaw, stubble, massive 44cm flexed bicep & dumbbell
    pixelLayers = `
      <!-- Hair & Buzzcut -->
      <rect x="9" y="3" width="14" height="3" fill="#1c1917"/>
      <!-- Green Sweatband -->
      <rect x="7" y="6" width="18" height="3" fill="#22c55e"/>
      <rect x="9" y="7" width="14" height="1" fill="#86efac"/>
      <!-- Face & Stubble Jaw -->
      <rect x="8" y="9" width="16" height="11" fill="#dba27c"/>
      <rect x="8" y="16" width="16" height="4" fill="#d97706" opacity="0.4"/>
      <!-- Eyes & Heavy Brows -->
      <rect x="9" y="11" width="5" height="2" fill="#1c1917"/>
      <rect x="18" y="11" width="5" height="2" fill="#1c1917"/>
      <rect x="10" y="13" width="3" height="2" fill="#0f172a"/>
      <rect x="19" y="13" width="3" height="2" fill="#0f172a"/>
      <rect x="11" y="13" width="1" height="1" fill="#ffffff"/>
      <rect x="20" y="13" width="1" height="1" fill="#ffffff"/>
      <rect x="13" y="17" width="6" height="1" fill="#78350f"/>
      <!-- Tank Top & Body -->
      <rect x="6" y="20" width="20" height="11" fill="#15803d"/>
      <rect x="12" y="20" width="8" height="4" fill="#dba27c"/>
      <!-- Massive Flexed 44cm Bicep -->
      <rect x="22" y="14" width="7" height="6" fill="#f59e0b"/>
      <rect x="24" y="13" width="5" height="8" fill="#fbbf24"/>
      <rect x="25" y="16" width="3" height="1" fill="#ef4444" opacity="0.6"/> <!-- Vein -->
      <!-- Dumbbell -->
      <rect x="26" y="8" width="4" height="3" fill="#64748b"/>
      <rect x="27" y="11" width="2" height="3" fill="#94a3b8"/>
      <rect x="26" y="14" width="4" height="3" fill="#64748b"/>
    `;
  } else if (id === 'dawid') {
    // Dawid: Orange cap backwards, panoramic yellow goggles, massive 120x280 marble tile
    pixelLayers = `
      <!-- Backwards Orange Cap -->
      <rect x="8" y="4" width="16" height="4" fill="#ea580c"/>
      <rect x="6" y="7" width="20" height="3" fill="#f97316"/>
      <rect x="4" y="9" width="5" height="2" fill="#c2410c"/> <!-- Cap Strap -->
      <!-- Face -->
      <rect x="8" y="10" width="16" height="10" fill="#d6a17d"/>
      <!-- Yellow Safety Goggles -->
      <rect x="7" y="11" width="18" height="5" fill="#ca8a04"/>
      <rect x="8" y="12" width="7" height="3" fill="#fef08a"/>
      <rect x="17" y="12" width="7" height="3" fill="#fef08a"/>
      <rect x="10" y="13" width="3" height="1" fill="#ffffff"/>
      <rect x="19" y="13" width="3" height="1" fill="#ffffff"/>
      <!-- Beard & Smile -->
      <rect x="10" y="17" width="12" height="3" fill="#9a3412" opacity="0.45"/>
      <rect x="13" y="18" width="6" height="1" fill="#78350f"/>
      <!-- Vest -->
      <rect x="6" y="20" width="20" height="11" fill="#c2410c"/>
      <rect x="11" y="20" width="10" height="11" fill="#e2e8f0"/>
      <!-- Massive 120x280 Marble Slab on Shoulder -->
      <rect x="21" y="4" width="9" height="26" fill="#f8fafc"/>
      <rect x="22" y="5" width="7" height="24" fill="#e2e8f0"/>
      <rect x="23" y="8" width="5" height="1" fill="#94a3b8"/>
      <rect x="24" y="14" width="4" height="1" fill="#cbd5e1"/>
      <rect x="23" y="20" width="5" height="1" fill="#94a3b8"/>
      <rect x="20" y="2" width="3" height="3" fill="#38bdf8"/> <!-- Sparkle -->
    `;
  } else if (id === 'mateusz') {
    // Mateusz: Cyber-purple hoodie, RGB glowing gamer headset, electric lightning & gamepad
    pixelLayers = `
      <!-- Purple Gamer Hoodie -->
      <rect x="8" y="3" width="16" height="5" fill="#6b21a8"/>
      <rect x="6" y="6" width="20" height="5" fill="#7c3aed"/>
      <!-- RGB Headset Band -->
      <rect x="9" y="3" width="14" height="2" fill="#ec4899"/>
      <!-- Face & Bangs -->
      <rect x="9" y="10" width="14" height="9" fill="#e5b79a"/>
      <rect x="10" y="9" width="4" height="3" fill="#3b0764"/>
      <rect x="18" y="9" width="4" height="2" fill="#3b0764"/>
      <!-- RGB Earcups & Mic Boom -->
      <rect x="4" y="10" width="4" height="7" fill="#06b6d4"/>
      <rect x="5" y="11" width="2" height="5" fill="#a5f3fc"/>
      <rect x="24" y="10" width="4" height="7" fill="#ec4899"/>
      <rect x="25" y="11" width="2" height="5" fill="#fbcfe8"/>
      <rect x="6" y="17" width="5" height="1" fill="#0891b2"/> <!-- Mic wire -->
      <rect x="11" y="17" width="2" height="2" fill="#06b6d4"/> <!-- Mic capsule -->
      <!-- Eyes & Gamer Stare -->
      <rect x="10" y="13" width="4" height="2" fill="#1e1b4b"/>
      <rect x="18" y="13" width="4" height="2" fill="#1e1b4b"/>
      <rect x="12" y="13" width="1" height="1" fill="#67e8f9"/>
      <rect x="20" y="13" width="1" height="1" fill="#67e8f9"/>
      <!-- Hoodie Body -->
      <rect x="6" y="19" width="20" height="12" fill="#581c87"/>
      <rect x="13" y="19" width="6" height="12" fill="#7c3aed"/>
      <!-- Lightning bolt accent -->
      <rect x="2" y="5" width="2" height="3" fill="#facc15"/>
      <rect x="1" y="8" width="2" height="3" fill="#facc15"/>
      <rect x="3" y="7" width="2" height="1" fill="#ffffff"/>
    `;
  } else {
    // Piotr: Crimson tactical beret, golden B4 pin, veteran mustache, ratchet wrench & capybara
    pixelLayers = `
      <!-- Crimson Tactical Beret -->
      <rect x="8" y="4" width="18" height="4" fill="#b91c1c"/>
      <rect x="6" y="7" width="20" height="3" fill="#dc2626"/>
      <rect x="10" y="6" width="3" height="3" fill="#facc15"/> <!-- Golden B4 Pin -->
      <!-- Face & Grizzled Hair -->
      <rect x="7" y="10" width="3" height="4" fill="#78716c"/>
      <rect x="22" y="10" width="3" height="4" fill="#78716c"/>
      <rect x="9" y="10" width="14" height="10" fill="#d4a486"/>
      <!-- Stern Eyes & Brows -->
      <rect x="10" y="12" width="4" height="1" fill="#44403c"/>
      <rect x="18" y="12" width="4" height="1" fill="#44403c"/>
      <rect x="11" y="13" width="2" height="2" fill="#1c1917"/>
      <rect x="19" y="13" width="2" height="2" fill="#1c1917"/>
      <rect x="12" y="13" width="1" height="1" fill="#ffffff"/>
      <rect x="20" y="13" width="1" height="1" fill="#ffffff"/>
      <!-- Thick Veteran Mustache -->
      <rect x="10" y="16" width="12" height="3" fill="#57534e"/>
      <rect x="9" y="17" width="14" height="2" fill="#78716c"/>
      <!-- Tactical Jacket -->
      <rect x="6" y="20" width="20" height="11" fill="#292524"/>
      <rect x="13" y="20" width="6" height="11" fill="#991b1b"/>
      <!-- Ratchet Wrench B4 -->
      <rect x="22" y="12" width="4" height="4" fill="#94a3b8"/>
      <rect x="23" y="16" width="2" height="14" fill="#cbd5e1"/>
      <rect x="22" y="28" width="4" height="3" fill="#dc2626"/> <!-- Handle grip -->
      <!-- Golden Capybara Silhouette Pin -->
      <rect x="8" y="22" width="4" height="3" fill="#facc15"/>
      <rect x="7" y="23" width="2" height="2" fill="#facc15"/>
    `;
  }

  const signatureDetails: Record<CharacterId, string> = {
    marcin: '<path d="M9 17h5m4 0h5M13 20h6" stroke="#9f674d" stroke-width="0.7"/><path d="M7 22h18" stroke="#9bd6e7" stroke-opacity=".42" stroke-width=".8"/><path d="M24 22h5" stroke="#fff4d3" stroke-opacity=".75" stroke-width=".8"/>',
    grzesiek: '<path d="M25 15l-2 2 2 1-2 2M24 17l-1 .5M27 18l-2 1" fill="none" stroke="#8b3d32" stroke-width=".9"/><path d="M23 14l3-1" stroke="#ffe2bf" stroke-width=".8"/><path d="M8 24h16" stroke="#bbf7d0" stroke-opacity=".38" stroke-width=".8"/>',
    dawid: '<path d="M8 12h5m6 0h5M10 14h3m7 0h3" stroke="#fff9dc" stroke-opacity=".9" stroke-width=".8"/><path d="M23 6l2-2 2 2" fill="none" stroke="#fff2cf" stroke-width=".8"/><path d="M23 23l5 5" stroke="#a3b4c0" stroke-width=".7"/>',
    mateusz: '<path d="M5 11v5M27 11v5" stroke="#a5f3fc" stroke-width="1"/><path d="M6 18h4l2 2" fill="none" stroke="#67e8f9" stroke-width=".9"/><path d="M19 24l-2 3h2l-1 2 4-5h-2z" fill="#fde68a"/>',
    piotr: '<path d="M10 17h4m4 0h4" stroke="#292524" stroke-width="1"/><path d="M8 6l4-1m10 1-4-1" stroke="#ffb4a9" stroke-width=".8"/><path d="M24 13v7m-2-7h4" stroke="#e2e8f0" stroke-width=".8"/>'
  };
  return [
    '<svg class="operator-portrait pixel-art-portrait" viewBox="0 0 32 32" role="img" aria-label="Portret pixel art ' + m.name + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">',
    '<defs>',
    '<clipPath id="' + clipId + '"><rect x="1" y="1" width="30" height="30" rx="4"/></clipPath>',
    '</defs>',
    '<!-- CRT Arcade Background & Neon Frame -->',
    '<rect x="0" y="0" width="32" height="32" rx="5" fill="#07111e" stroke="' + m.accent + '" stroke-width="1.5"/>',
    '<g clip-path="url(#' + clipId + ')">',
    '<rect x="0" y="0" width="32" height="32" fill="#050c17"/>',
    '<!-- Arcade Scanline Texture -->',
    '<line x1="0" y1="4" x2="32" y2="4" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="0" y1="8" x2="32" y2="8" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="0" y1="12" x2="32" y2="12" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="0" y1="16" x2="32" y2="16" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="0" y1="20" x2="32" y2="20" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="0" y1="24" x2="32" y2="24" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="0" y1="28" x2="32" y2="28" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>',
    '<circle cx="16" cy="12" r="13" fill="' + m.accent + '" opacity=".08"/>',
    pixelLayers,
    signatureDetails[id] || '',
    '<path d="M2 22H30" stroke="#ffffff" stroke-opacity=".045" stroke-width=".5"/>',
    '</g>',
    '<!-- Arcade Neon Corner Accents -->',
    '<path d="M2 5V2H5M27 2H30V5M30 27V30H27M5 30H2V27" fill="none" stroke="' + m.secondary + '" stroke-width="1.2" shape-rendering="crispEdges"/>',
    '</svg>'
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
class PaleciakiScene extends xb.Script {
  private engine!: PaleciakiGameEngine;
  private pvpFireCooldownMultiplier = 1;
  private pvpFirearmCooldownSeconds = 3.0;
  private cinematicIntro: CinematicIntroManager | null = null;
  private selectedCharId: CharacterId = 'marcin';
  private lastScore: number = 0;
  private lastCoins: number = 0;
  private lastTimeSeconds: number = 0;
  private lastBossDefeated: boolean = false;
  private lastMode: 'campaign' | 'survival' | 'pvp' = 'survival';
  private masteryAwardedForRun = false;
  // Invalidates deferred game-over UI work when a new run or title screen starts.
  private gameSessionGeneration = 0;
  private renderAccountProgressionUi: () => void = () => {};
  private accountPvpAwardedForMatch = false;
  private accountCloudSyncInFlight: Promise<void> | null = null;
  private pvpSession: IPvpSession | null = null;
  private selectedPvpOperator: CharacterId = 'marcin';
  private pvpRoomCode: string = '';
  private pvpLocalSlot: PvpSlot = 'p1';
  private pvpIsHost: boolean = false;
  private pvpLocalReady: boolean = false;
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
  private adaptiveEffectsTier: AdaptiveEffectsTier = 0;
  private adaptiveEffectsRecoverySince: number = 0;
  private telemetryRenderer: THREE.WebGLRenderer | null = null;
  private renderTelemetryFrames: number = 0;
  private lastRenderTelemetryAt: number = 0;
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

  /**
   * A WebGL context loss freezes the renderer independently from gameplay.
   * Pause the active run before the browser attempts to restore the GPU context.
   */
  public pauseForWebGLRecovery(): boolean {
    if (this.engine.getGameState() !== 'playing') return false;
    const pauseButton = document.getElementById('btn-top-pause') as HTMLButtonElement | null;
    if (pauseButton) pauseButton.click();
    else this.engine.togglePause();
    return this.engine.getGameState() === 'paused';
  }

  /** Resume only a run that this recovery flow itself paused, and only on user input. */
  public resumeAfterWebGLRecovery(shouldResume: boolean): void {
    if (!shouldResume || this.engine.getGameState() !== 'paused') return;
    const resumeButton = document.getElementById('btn-resume') as HTMLButtonElement | null;
    if (resumeButton) resumeButton.click();
    else this.engine.togglePause();
  }

  private setupUIAndEngine() {
    let renderCharacterMasteryPanel: (id: CharacterId) => void = () => {};
    let renderAccountProgressionPanels: () => void = () => {};
    let campaignProgress: CampaignProgress;
    try { campaignProgress = readCampaignProgress(window.localStorage); } catch { campaignProgress = createInitialCampaignProgress(); }
    let selectedCampaignStageId: CampaignStageId | null = null;
    let lastCampaignStageId: CampaignStageId | null = null;
    let nextCampaignStageId: CampaignStageId | null = null;
    let campaignRewardChoices: CampaignRewardDefinition[] = [];
    let campaignRewardTargetStageId: CampaignStageId | null = null;
    let campaignRewardSelectionId: CampaignRewardId | null = null;
    const saveCampaignProgress = () => { try { writeCampaignProgress(window.localStorage, campaignProgress); } catch { /* Keep current session progress when storage is unavailable. */ } };
    const consumeCampaignRewardForStage = (stageId: CampaignStageId): CampaignRewardId | null => {
      const consumed = consumePendingCampaignReward(campaignProgress, stageId);
      campaignProgress = consumed.progress;
      if (consumed.rewardId) saveCampaignProgress();
      return consumed.rewardId;
    };
    const consumeCampaignXpBonusForStage = (stageId: CampaignStageId): number => {
      const consumed = consumePendingCampaignXpBonus(campaignProgress, stageId);
      campaignProgress = consumed.progress;
      if (consumed.bonusXp > 0) saveCampaignProgress();
      return consumed.bonusXp;
    };
    const renderCampaignRewardPanel = () => {
      const panel = document.getElementById('campaign-reward-panel');
      const optionsRoot = document.getElementById('campaign-reward-options');
      const note = document.getElementById('campaign-reward-note');
      const count = document.getElementById('campaign-reward-count');
      const visible = Boolean(campaignRewardTargetStageId && campaignRewardChoices.length);
      panel?.classList.toggle('hidden', !visible);
      if (!optionsRoot) return;
      optionsRoot.replaceChildren();
      const hasBonusChoice = campaignRewardChoices.length === 4;
      optionsRoot.classList.toggle('has-bonus', hasBonusChoice);
      if (count) count.textContent = hasBonusChoice ? '4 KARTY • BONUS ZA ZLECENIE' : '3 KARTY • 1 WYBÓR';
      if (!visible) return;

      for (const reward of campaignRewardChoices) {
        const selected = reward.id === campaignRewardSelectionId;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'campaign-reward-card' + (selected ? ' is-selected' : '');
        button.dataset.campaignReward = reward.id;
        button.setAttribute('aria-pressed', String(selected));

        const icon = document.createElement('span');
        icon.className = 'campaign-reward-icon';
        icon.textContent = reward.icon;
        const copy = document.createElement('span');
        copy.className = 'campaign-reward-copy';
        const title = document.createElement('strong');
        title.textContent = reward.title;
        const description = document.createElement('small');
        description.textContent = reward.description;
        copy.append(title, description);
        const state = document.createElement('span');
        state.className = 'campaign-reward-state';
        state.textContent = selected ? 'WYBRANO' : 'WYBIERZ';
        button.append(icon, copy, state);
        optionsRoot.append(button);
      }

      if (note) {
        const selectedReward = campaignRewardChoices.find((reward) => reward.id === campaignRewardSelectionId);
        note.textContent = selectedReward
          ? 'Wybrano: ' + selectedReward.title + '. Premia zostanie zastosowana przy rozpoczęciu następnego etapu.'
          : 'Wybierz jedną premię dla następnego etapu.';
        if (hasBonusChoice) note.textContent += ' Zlecenie specjalne odblokowało czwartą kartę.';
        if (campaignProgress.pendingBonusXpStageId === campaignRewardTargetStageId && campaignProgress.pendingBonusXp > 0) {
          note.textContent += ' Dodatkowo otrzymasz +' + campaignProgress.pendingBonusXp + ' XP na start następnej misji.';
        }
      }
    };

    document.getElementById('campaign-reward-options')?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>('[data-campaign-reward]');
      const rewardId = button?.dataset.campaignReward as CampaignRewardId | undefined;
      const stageId = campaignRewardTargetStageId;
      if (!rewardId || !stageId || !campaignRewardChoices.some((reward) => reward.id === rewardId)) return;
      campaignRewardSelectionId = rewardId;
      campaignProgress = setPendingCampaignReward(campaignProgress, stageId, rewardId);
      saveCampaignProgress();
      renderCampaignRewardPanel();
    });

    const renderCampaignBoard = () => {
      const unlocked = new Set(campaignProgress.unlockedStageIds);
      const completedStages = CAMPAIGN_STAGES.filter((stage) => (campaignProgress.completedStages[stage.id]?.bestStars ?? 0) > 0);
      const completed = completedStages.length;
      const status = document.getElementById('campaign-board-progress');
      if (status) status.textContent = 'ODKRYTE ETAPY: ' + unlocked.size + '/' + CAMPAIGN_STAGES.length + ' • UKOŃCZONE: ' + completed + '/' + CAMPAIGN_STAGES.length;

      // Continue at the first unlocked stage that has not been cleared yet.
      // If the whole story is complete, offer a replay of the final mission.
      const allComplete = completed === CAMPAIGN_STAGES.length;
      const continueStage = CAMPAIGN_STAGES.find((stage) => unlocked.has(stage.id) && !campaignProgress.completedStages[stage.id]?.bestStars)
        ?? (allComplete ? CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1] : [...CAMPAIGN_STAGES].reverse().find((stage) => unlocked.has(stage.id)))
        ?? CAMPAIGN_STAGES[0];
      const continueButton = document.getElementById('btn-campaign-continue') as HTMLButtonElement | null;
      const continueTitle = document.getElementById('campaign-continue-title');
      const continueSubtitle = document.getElementById('campaign-continue-subtitle');
      if (continueButton) {
        const isInitialStart = completed === 0 && continueStage.order === 1;
        continueButton.disabled = !unlocked.has(continueStage.id);
        continueButton.setAttribute('aria-label', (allComplete ? 'Powtórz finał kampanii' : isInitialStart ? 'Rozpocznij kampanię' : 'Kontynuuj kampanię')
          + ': etap ' + continueStage.order + ', ' + continueStage.title);
        if (continueTitle) continueTitle.textContent = allComplete ? 'POWTÓRZ FINAŁ' : isInitialStart ? 'ROZPOCZNIJ KAMPANIĘ' : 'KONTYNUUJ KAMPANIĘ';
        if (continueSubtitle) {
          const bestStars = campaignProgress.completedStages[continueStage.id]?.bestStars ?? 0;
          continueSubtitle.textContent = 'ETAP ' + String(continueStage.order).padStart(2, '0') + ' • ' + continueStage.title.toUpperCase()
            + (allComplete ? ' • WSZYSTKIE MISJE UKOŃCZONE' : bestStars ? ' • POWTÓRKA / POPRAWA WYNIKU' : ' • NASTĘPNA MISJA');
        }
      }

      for (const button of document.querySelectorAll<HTMLButtonElement>('[data-campaign-stage]')) {
        const id = button.dataset.campaignStage as CampaignStageId | undefined;
        if (!id) continue;
        const stage = getCampaignStageDefinition(id);
        if (!stage) continue;
        const available = unlocked.has(id), result = campaignProgress.completedStages[id];
        button.disabled = !available;
        button.classList.toggle('is-locked', !available);
        button.classList.toggle('is-complete', Boolean(result?.bestStars));
        button.setAttribute('aria-disabled', String(!available));
        const label = button.querySelector<HTMLElement>('.campaign-stage-status');
        const stars = button.querySelector<HTMLElement>('.campaign-stage-stars');
        const description = button.querySelector<HTMLElement>('small');
        if (label) label.textContent = result?.bestStars ? 'UKOŃCZONO • ' + (result.completions > 1 ? result.completions + ' PRÓBY' : 'REKORD ZAPISANY') : available ? 'DOSTĘPNY' : 'ZABLOKOWANY';
        if (stars) stars.textContent = '★'.repeat(result?.bestStars ?? 0) + '☆'.repeat(3 - (result?.bestStars ?? 0));
        if (description) {
          const masteryRecord = result?.bestMasteryValue ? ' • REKORD 3★: ' + result.bestMasteryValue : '';
          const orderRecord = result?.bestSideOrderCompleted ? ' • ZLECENIE ZALICZONE • BONUS XP' : '';
          description.textContent = stage.objective + ' 3★: ' + stage.mastery.description + masteryRecord
            + ' • ZLECENIE: ' + stage.sideOrder.description + orderRecord;
        }
        button.title = available
          ? stage.objective + ' Cel 3★: ' + stage.mastery.description + ' Zlecenie: ' + stage.sideOrder.description
          : 'Najpierw ukończ poprzedni etap.';
      }
    };
    renderCampaignBoard();
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
        const renderProfile = currentDeviceRenderProfile(width);
        root.dataset.renderTier = renderProfile.tier;
        const isSurvival = this.engine?.getGameMode() === 'survival';
        const dprCap = isSurvival ? renderProfile.survivalPixelRatioCap : renderProfile.pixelRatioCap;
        // High-density phones keep sharper edges; low-memory GPUs spend fewer pixels per frame.
        const dpr = Math.max(0.78, Math.min(window.devicePixelRatio || 1, dprCap) * this.adaptiveRenderScale);
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
      // Fullscreen transitions are not guaranteed to emit a matching resize in
      // every Android WebView. Release the movement stick and restore any
      // pointer-positioned fire control before the next frame.
      this.resetTouchJoystick?.();
      resetPvpFireControlPosition();
      portalOverlayLayers();
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
    const gameoverModal = document.getElementById('gameover-modal');
    const survivalHud = document.getElementById('survival-hud');
    const survivalLevelUp = document.getElementById('survival-levelup');
    const survivalUpgradeOptions = document.getElementById('survival-upgrade-options');
    const survivalTimeElem = document.getElementById('survival-time');
    const survivalWaveElem = document.getElementById('survival-wave');
    const survivalLevelElem = document.getElementById('survival-level');
    const survivalRankElem = document.getElementById('survival-rank');
    const survivalXpElem = document.getElementById('survival-xp');
    const survivalXpFill = document.getElementById('survival-xp-fill');
    const survivalKillsElem = document.getElementById('survival-kills');
    const survivalEnemiesElem = document.getElementById('survival-enemies');
    const survivalContractElem = document.getElementById('survival-contract');
    const survivalContractTitleElem = document.getElementById('survival-contract-title');
    const survivalContractDetailElem = document.getElementById('survival-contract-detail');
    const survivalContractMetaElem = document.getElementById('survival-contract-meta');
    const survivalContractFillElem = document.getElementById('survival-contract-fill');
    const survivalEventElem = document.getElementById('survival-event');
    const survivalEventTitleElem = document.getElementById('survival-event-title');
    const survivalEventDetailElem = document.getElementById('survival-event-detail');
    const survivalEventMetaElem = document.getElementById('survival-event-meta');
    const survivalEventFillElem = document.getElementById('survival-event-fill');
    const survivalRerollBtn = document.getElementById('btn-survival-reroll') as HTMLButtonElement | null;
    const survivalSkipBtn = document.getElementById('btn-survival-skip') as HTMLButtonElement | null;

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

    const popupsLayer = document.getElementById('floating-popups-layer');
    // Prewarm a fixed set of floating combat labels. Reusing nodes and vectors
    // avoids per-hit DOM/Three.js allocation during long Survival waves.
    const floatingToastPool = popupsLayer ? new FloatingToastPool(popupsLayer, 36) : null;
    let globalLastDialogueTime = 0;

    const createDialogueCard = (text: string, speakerType: string, side: 'left' | 'right' = 'right', speakerName?: string) => {
      const containerElem = document.getElementById('dialogue-container');
      if (!containerElem) return;
      // A timed event card owns the top information lane. Drop chatter while it
      // is visible instead of stacking radio captions over the event objective.
      const activeEvent = document.getElementById('survival-event-announcement');
      if (activeEvent?.classList.contains('is-visible')) return;
      containerElem.classList.remove('covered-by-event');

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
        kurier: { name: 'Kurier Ekspresowy', role: 'Kurier Express', avatar: '🚚' },
        walczak: { name: 'Nadzorca Zero', role: 'Zbuntowany Nadzorca', avatar: '👔' },
        krol_leto: { name: 'Dyrektor Widmo', role: 'Dyrektor Generalny', avatar: '👑' },
        architect: { name: 'Architektka', role: 'Design & Beż', avatar: '🎨' },
        customer: { name: 'Klient', role: 'Awantura o Fugi', avatar: '📑' },
        handlowiec: { name: 'Handlowiec', role: 'Rabat 3%', avatar: '💼' },
        monter: { name: 'Monter', role: 'Glazurnik Pro', avatar: '🪚' },
        inspector: { name: 'Inspektor', role: 'BHP / PIP', avatar: '📋' },
        sztaplar_szalony: { name: 'Sztaplarz Turbo', role: 'Mistrz Sztaplarki', avatar: '🚜' },
        pan_roman: { name: 'Dostawca Sanitarny', role: 'Dostawa bez awiza', avatar: '📦' },
        serwisant: { name: 'Serwisant', role: 'Zgłoszenie 404', avatar: '🧰' },
        przedstawiciel_włoski: { name: 'Włoski dostawca', role: 'Mamma mia / armatura', avatar: '🇮🇹' },
        elite_walczak_guard: { name: 'Strażnik Nadzorcy Zero', role: 'Ochrona sektora VIP', avatar: '🛡️' },
        bosman_krakow: { name: 'Inspektor Zmiany', role: 'Odprawa 3-MSC', avatar: '📋' },
        agv_robot: { name: 'Robot AGV', role: 'Zgubiona trasa', avatar: '🤖' },
        piorun_dron: { name: 'PIORUN', role: 'Dron AI', avatar: '⚡' },
        zombie_pracownik: { name: 'Zombie-Magazynier', role: 'Głód Przekąsek', avatar: '🧟' },
        pomazaniec: { name: 'Pomazaniec', role: 'Rowerowy rajd / lizaki', avatar: '🚲' },
        sebix_m: { name: 'Operator Turbo', role: 'Taran B4 / cegły', avatar: '🔥' },
        mutant_gamma_forklift: { name: 'Mutant Gamma-Sztaplarka', role: 'Radioaktywny Taran B4', avatar: '☣️' },
        radioactive_pip: { name: 'Radioaktywny Inspektor PIP', role: 'Protokół Skażenia', avatar: '☢️' },
        cyber_salesman: { name: 'Cyber-Handlowiec 3.0', role: 'Oferta z Metawersum', avatar: '💻' },
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

      const duration = type === 'damage' ? 0.7 : type === 'easter-egg' ? 3.6 : type === 'combo' ? 2.0 : 1.6;
      floatingToastPool?.acquire(text, x, y, z, type, duration);
    };

    // The projection scratch is created once; each active toast reuses its
    // preallocated world vector and pooled DOM element for its whole lifetime.
    const toastProjectionScratch = new THREE.Vector3();
    (this as any)._updateToasts = (dt: number) => {
      if (!floatingToastPool) return;
      const activeToasts = floatingToastPool.active;
      const tempVec = toastProjectionScratch;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      for (let i = floatingToastPool.activeCount - 1; i >= 0; i--) {
        const t = activeToasts[i]!;
        t.age += dt;

        if (t.age >= t.maxAge) {
          floatingToastPool.releaseAt(i);
          // Reverse iteration has already visited any entry swapped from the tail.
          continue;
        }

        const floatSpeed = t.type === 'damage' ? 0.35 : t.type === 'easter-egg' ? 0.28 : 0.8;
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
          if (t.element.style.display !== 'none') t.element.style.display = 'none';
          continue;
        }

        if (t.element.style.display !== 'flex') t.element.style.display = 'flex';
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
      document.getElementById('dialogue-container')?.classList.remove('covered-by-event');
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
      document.getElementById('dialogue-container')?.classList.add('covered-by-event');
      clearTimeout((announcement as any)._timeout);
      announcement.classList.add('hidden');
      announcement.classList.remove('is-visible');
      void announcement.offsetWidth;
      announcement.classList.remove('hidden');
      announcement.classList.add('is-visible');
      (announcement as any)._timeout = window.setTimeout(() => {
        announcement.classList.add('hidden');
        announcement.classList.remove('is-visible');
        document.getElementById('dialogue-container')?.classList.remove('covered-by-event');
      }, 5100);
    };


    this.engine = new PaleciakiGameEngine(
      this as unknown as THREE.Scene,
      this.camera,
      (container || document.body) as HTMLElement,
      {
        // Legacy engine callback contract: Survival never completes a sector.
        onLevelComplete: () => {},
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

          // Mirror the exact cooldown state on the mobile special-action button.
          // This prevents blind taps and makes kill-based recharge visible in both
          // desktop and touch layouts instead of hiding the only useful feedback.
          const touchAbilityButton = document.getElementById('btn-touch-ability') as HTMLButtonElement | null;
          if (touchAbilityButton) {
            const secondsLeft = Math.ceil(Math.max(0, remainingSeconds));
            const accessibilityLabel = ready
              ? 'Umiejętność specjalna gotowa. Naciśnij, aby użyć.'
              : `Umiejętność specjalna ładuje się przez ${secondsLeft} sekund.${killRechargeEnabled ? ' Eliminacje skracają czas ładowania.' : ''}`;
            touchAbilityButton.disabled = !ready;
            touchAbilityButton.classList.toggle('is-ready', ready);
            touchAbilityButton.classList.toggle('is-charging', !ready);
            touchAbilityButton.style.setProperty(
              '--ability-cooldown-progress',
              `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
            );
            touchAbilityButton.textContent = ready ? '⚡ MOC' : `⚡ ${secondsLeft}s`;
            touchAbilityButton.setAttribute('aria-label', accessibilityLabel);
            touchAbilityButton.title = ready
              ? 'Superumiejętność gotowa'
              : killRechargeEnabled
                ? `Ładowanie: ${secondsLeft}s. Eliminacje skracają czas ładowania.`
                : `Ładowanie: ${secondsLeft}s`;
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
        onGameOver: (reason) => {
          if (gameoverReason) gameoverReason.textContent = reason;
          if (gameoverModal) {
            gameoverModal.classList.remove('hidden');
            gameoverModal.setAttribute('aria-hidden', 'false');
            gameoverModal.style.setProperty('display', 'flex', 'important');
            gameoverModal.style.setProperty('pointer-events', 'auto', 'important');
            gameoverModal.style.setProperty('z-index', '2147483012', 'important');
          }
          hudTop?.classList.add('hidden');
          hudBottom?.classList.add('hidden');
          bossHudBar?.classList.add('hidden');
          hudPerksRow?.classList.add('hidden');
          survivalHud?.classList.add('hidden');
          survivalLevelUp?.classList.add('hidden');
          try {
            setTouchControlsVisibility(false);
          } catch (visibilityError) {
            console.warn('[GameOver UI] Touch layer could not be hidden.', visibilityError);
          }

          this.resetTouchJoystick?.();
          setTouchControlsMode('hidden');
          const endedMode = this.engine.getGameMode();
          const isSurvivalResult = endedMode === 'survival';
          const endedSessionGeneration = this.gameSessionGeneration;
          const endedOperatorId = this.engine.getCharacterDef().id;
          const endedScore = this.engine.getScore();
          const endedCoins = this.engine.getCollectedVipCount();
          const endedTimeSeconds = this.engine.getElapsedSeconds();
          const endedBossDefeated = this.engine.isBossDefeated();
          const shouldAwardMastery = endedMode === 'survival' && !this.masteryAwardedForRun;
          // Claim the award synchronously: a very fast Retry must not reset this
          // flag before the deferred results callback processes the previous run.
          if (shouldAwardMastery) this.masteryAwardedForRun = true;

          this.lastScore = endedScore;
          this.lastCoins = endedCoins;
          this.lastTimeSeconds = endedTimeSeconds;
          this.lastBossDefeated = endedBossDefeated;
          this.lastMode = endedMode;
          // The general results panel is shared by engine fallback paths, while
          // normal PvP endings use the dedicated head-to-head result modal.
          const damagePanel = document.getElementById('gameover-damage-panel');
          const survivalRankingPanel = document.querySelector<HTMLElement>('.gameover-submit-box');
          const survivalRetryButton = document.getElementById('btn-retry');
          damagePanel?.classList.toggle('hidden', !isSurvivalResult);
          survivalRankingPanel?.classList.toggle('hidden', !isSurvivalResult);
          survivalRetryButton?.classList.toggle('hidden', !isSurvivalResult);
          if (endedMode === 'pvp') document.getElementById('pvp-hud')?.classList.add('hidden');
          // Freeze the ended run's data before any retry can start a new run.
          const snapshot = this.engine.getSurvivalSnapshot();
          const damageReport = this.engine.getSurvivalDamageReport();
          lastCampaignStageId = snapshot.campaignStageId;
          nextCampaignStageId = null;
          campaignRewardChoices = [];
          campaignRewardTargetStageId = null;
          campaignRewardSelectionId = null;
          if (snapshot.campaignStageId && snapshot.campaignSuccess) {
            campaignProgress = recordCampaignStageResult(campaignProgress, snapshot.campaignStageId, {
              bossDefeated: true,
              kills: snapshot.kills,
              elapsedSeconds: snapshot.elapsedSeconds,
              perfectDodges: snapshot.perfectDodges,
              killStreak: snapshot.killStreak,
              xpStreak: snapshot.xpStreak,
              level: snapshot.level,
              xpPickups: snapshot.xpPickups,
              secretsFound: snapshot.secretsFound,
              playerHpPercent: snapshot.playerHpPercent,
              bossKillSeconds: snapshot.campaignBossKillSeconds,
            });
            nextCampaignStageId = getNextCampaignStageId(campaignProgress, snapshot.campaignStageId);
            if (nextCampaignStageId) {
              const savedStageResult = campaignProgress.completedStages[snapshot.campaignStageId];
              const completions = savedStageResult?.completions ?? 1;
              campaignRewardChoices = getCampaignRewardChoices(snapshot.campaignStageId, completions, savedStageResult?.bestSideOrderCompleted === true);
              campaignRewardTargetStageId = nextCampaignStageId;
              const savedReward = campaignProgress.pendingRewardStageId === nextCampaignStageId
                ? campaignRewardChoices.find((reward) => reward.id === campaignProgress.pendingRewardId)
                : undefined;
              const defaultReward = savedReward ?? campaignRewardChoices[0];
              if (defaultReward) {
                campaignRewardSelectionId = defaultReward.id;
                campaignProgress = setPendingCampaignReward(campaignProgress, nextCampaignStageId, defaultReward.id);
              }
            }
            saveCampaignProgress();
            renderCampaignBoard();
          }
          renderCampaignRewardPanel();
          const resultRetryButton = document.getElementById('btn-retry');
          if (resultRetryButton) resultRetryButton.textContent = snapshot.campaignStageId ? (nextCampaignStageId ? 'NASTĘPNY ETAP' : 'POWTÓRZ ETAP') : 'SPRÓBUJ PONOWNIE';
          const resultMenuButton = document.getElementById('btn-menu-gameover');
          if (resultMenuButton) resultMenuButton.textContent = snapshot.campaignStageId ? 'MAPA KAMPANII' : 'MENU GŁÓWNE';
          survivalRankingPanel?.classList.toggle('hidden', !isSurvivalResult || Boolean(snapshot.campaignStageId));

          // Paint the death/result screen before optional progression, local
          // persistence and damage-report rendering run on the main thread.
          window.requestAnimationFrame(() => {
            window.setTimeout(() => {
              try {
                hideSurvivalAnnouncement();
                const finalScore = document.getElementById('gameover-score');
          const finalTime = document.getElementById('gameover-time');
          const finalMode = document.getElementById('gameover-mode-summary');
          const runDetail = document.getElementById('gameover-run-detail');
          if (finalScore) finalScore.textContent = endedScore.toLocaleString('pl-PL');
          if (finalTime) {
            const minutes = Math.floor(endedTimeSeconds / 60);
            const seconds = endedTimeSeconds % 60;
            finalTime.textContent = minutes + ':' + String(seconds).padStart(2, '0');
          }
          if (finalMode) {
            finalMode.textContent = snapshot.campaignStageId
              ? 'KAMPANIA ZMIAN'
              : endedMode === 'pvp'
                ? 'ARENA PvP'
                : endedMode === 'campaign'
                  ? 'KAMPANIA'
                  : 'SURVIVAL SHIFT';
          }
          if (runDetail) {
            runDetail.textContent = snapshot.campaignStageId
              ? (snapshot.campaignSuccess
                ? (snapshot.campaignStageTitle ?? 'ETAP') + ' • ' + '★'.repeat(snapshot.campaignStars) + '☆'.repeat(3 - snapshot.campaignStars) + ' • ' + snapshot.kills + ' ELIMINACJI'
                : (snapshot.campaignStageTitle ?? 'ETAP') + ' • PRÓBA NIEUDANA • ' + snapshot.kills + ' ELIMINACJI')
              : isSurvivalResult
                ? `FALA ${snapshot.wave} • ${snapshot.kills} ELIMINACJI • POZIOM ${snapshot.level}`
                : endedMode === 'pvp'
                ? `POJEDYNEK 1v1 • WYNIK ${endedScore.toLocaleString('pl-PL')} PKT`
                : `KAMPANIA • WYNIK ${endedScore.toLocaleString('pl-PL')} PKT`;
          }

          // Award mastery exactly once when a Survival run ends. A retry starts a fresh award window.
          if (shouldAwardMastery) {
            const operatorId = endedOperatorId;
            const masteryResult = recordCharacterRunResult(characterMasteryProfile, operatorId, {
              kills: snapshot.kills,
              elapsedSeconds: snapshot.elapsedSeconds,
              bossesDefeated: snapshot.bossesDefeated,
              secretsFound: snapshot.secretsFound,
            });
            characterMasteryProfile = masteryResult.profile;
            persistCharacterMasteryProfile();
            renderCharacterMasteryPanel(operatorId);
            if (masteryResult.xpEarned > 0) {
              const masteryToast = document.createElement('div');
              masteryToast.className = 'achievement-unlock-toast';
              masteryToast.textContent = '🎖️ ' + CHARACTERS[operatorId].name +
                ' • +' + masteryResult.xpEarned + ' MASTERY XP' +
                (masteryResult.levelsGained > 0 ? ' • AWANS MISTRZOSTWA: +' + masteryResult.levelsGained : '');
              document.body.appendChild(masteryToast);
              window.setTimeout(() => masteryToast.remove(), 3900);
            }

            const accountResult = recordAccountSurvivalRun(accountProgressionProfile, {
              kills: snapshot.kills,
              elapsedSeconds: snapshot.elapsedSeconds,
              bossesDefeated: snapshot.bossesDefeated,
              secretsFound: snapshot.secretsFound,
              highestWave: snapshot.wave,
            });
            accountProgressionProfile = accountResult.profile;
            persistAccountProgressionProfile();
            void this.syncAccountProgressionWithCloud();
            // The next Survival launch applies the new bonuses through updateCharacterUI.
            // Never rebuild the player mesh from this deferred result callback.
            renderAccountProgressionPanels();
            if (accountResult.xpEarned > 0) {
              const accountToast = document.createElement('div');
              accountToast.className = 'achievement-unlock-toast';
              accountToast.textContent = '🌳 POSTĘP KONTA • +' + accountResult.xpEarned + ' XP' +
                (accountResult.levelsGained > 0 ? ' • AWANS +' + accountResult.levelsGained + ' • +1 PKT ZA KAŻDY POZIOM' : '') +
                (accountResult.rankUps.length ? ' • NOWA RUNGA: ' + accountResult.rankUps.join(', ') : '');
              document.body.appendChild(accountToast);
              window.setTimeout(() => accountToast.remove(), 4300);
            }
          }


          // An immediate Retry/menu exit may begin another session while this
          // results task is deferred. Keep its earned reward, but never repaint
          // an obsolete game-over modal over the new session.
          if (
            endedSessionGeneration !== this.gameSessionGeneration ||
            this.engine.getGameState() !== 'gameover'
          ) return;

          // The damage table is derived from actual enemy HP removed, not projectile counts.
          const damageTotal = document.getElementById('gameover-total-damage');
          const damageList = document.getElementById('gameover-damage-breakdown');
          if (damageTotal) damageTotal.textContent = damageReport.totalDamage.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' HP';
          if (damageList) {
            damageList.replaceChildren();
            if (damageReport.entries.length === 0) {
              const empty = document.createElement('p');
              empty.className = 'gameover-damage-empty';
              empty.textContent = 'Brak zarejestrowanych obrażeń zadanych przeciwnikom.';
              damageList.appendChild(empty);
            } else {
              for (const entry of damageReport.entries) {
                const row = document.createElement('div');
                row.className = 'gameover-damage-row';
                row.style.setProperty('--damage-accent', '#' + entry.color.toString(16).padStart(6, '0'));

                const top = document.createElement('div');
                top.className = 'gameover-damage-row-top';
                const identity = document.createElement('div');
                identity.className = 'gameover-damage-identity';
                const category = document.createElement('span');
                category.className = 'gameover-damage-category';
                category.textContent = entry.category;
                const label = document.createElement('strong');
                label.className = 'gameover-damage-name';
                label.textContent = entry.label;
                identity.append(category, label);

                const values = document.createElement('div');
                values.className = 'gameover-damage-values';
                const amount = document.createElement('strong');
                amount.textContent = entry.damage.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' HP';
                const percentage = document.createElement('span');
                percentage.textContent = entry.percentage.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
                values.append(amount, percentage);
                top.append(identity, values);

                const track = document.createElement('div');
                track.className = 'gameover-damage-track';
                const fill = document.createElement('div');
                fill.className = 'gameover-damage-fill';
                fill.style.width = Math.max(0, Math.min(100, entry.percentage)) + '%';
                track.appendChild(fill);
                const activity = document.createElement('small');
                activity.className = 'gameover-damage-meta';
                activity.textContent =
                  entry.hits.toLocaleString('pl-PL') + ' skut. trafień • ' +
                  entry.eliminations.toLocaleString('pl-PL') + ' dobicia';
                row.append(top, track, activity);
                damageList.appendChild(row);
              }
            }
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
          setTouchControlsVisibility(false);
          bossHudBar?.classList.add('hidden');
          hudPerksRow?.classList.add('hidden');
          survivalHud?.classList.add('hidden');
          survivalLevelUp?.classList.add('hidden');
          } catch (error) {
            // An exception in deferred result rendering must not resurrect the
            // previous run's modal after Retry, menu navigation or a new match.
            if (
              endedSessionGeneration !== this.gameSessionGeneration ||
              this.engine.getGameState() !== 'gameover'
            ) return;
            console.error('[GameOver UI] Optional result processing failed; the results screen remains available.', error);
            if (gameoverReason) gameoverReason.textContent = reason;
            if (gameoverModal) {
              gameoverModal.classList.remove('hidden');
              gameoverModal.style.setProperty('display', 'flex', 'important');
              gameoverModal.style.setProperty('pointer-events', 'auto', 'important');
              gameoverModal.style.setProperty('z-index', '2147483012', 'important');
            }
            hudTop?.classList.add('hidden');
            hudBottom?.classList.add('hidden');
            setTouchControlsVisibility(false);
            survivalHud?.classList.add('hidden');
            survivalLevelUp?.classList.add('hidden');
              }
            }, 0);
          });
        },
        onSurvivalUpdate: (snapshot: SurvivalSnapshot) => {
          trackSurvivalAchievementSnapshot(snapshot);
          const campaignHud = document.getElementById('campaign-stage-hud');
          campaignHud?.classList.toggle('hidden', !snapshot.campaignStageId);
          if (snapshot.campaignStageId) {
            const stage = getCampaignStageDefinition(snapshot.campaignStageId);
            const title = document.getElementById('campaign-stage-title');
            const progress = document.getElementById('campaign-stage-progress');
            const clock = document.getElementById('campaign-stage-clock');
            const orderLabel = document.getElementById('campaign-stage-order');
            if (title && stage) title.textContent = 'ETAP ' + stage.order + '/5 • ' + stage.title.toUpperCase();
            if (progress && stage) {
              const mastery = getCampaignMasteryProgress(stage, {
                perfectDodges: snapshot.perfectDodges,
                killStreak: snapshot.killStreak,
                xpStreak: snapshot.xpStreak,
                level: snapshot.level,
              });
              const primaryGoal = snapshot.campaignBossSpawned
                ? stage.bossTitle.toUpperCase()
                : 'ELIMINACJE ' + snapshot.kills + '/' + stage.bonusKillTarget;
              progress.textContent = primaryGoal + ' • ' + mastery.label + ' ' + mastery.value + '/' + mastery.target;
              progress.title = mastery.description + ' • ' + mastery.value + '/' + mastery.target;
            }
            if (orderLabel && stage) {
              const sideOrder = getCampaignSideOrderProgress(stage, {
                xpPickups: snapshot.xpPickups,
                killStreak: snapshot.killStreak,
                secretsFound: snapshot.secretsFound,
                playerHpPercent: snapshot.playerHpPercent,
                bossKillSeconds: snapshot.campaignBossKillSeconds,
                bossDefeated: snapshot.campaignSuccess,
              });
              const valueText = sideOrder.metric === 'boss_kill_seconds'
                ? (snapshot.campaignBossSpawned ? snapshot.campaignBossKillSeconds + '/' + sideOrder.target + ' s' : '≤ ' + sideOrder.target + ' s')
                : sideOrder.metric === 'player_hp_percent'
                  ? snapshot.playerHpPercent + '/' + sideOrder.target + '% HP'
                  : sideOrder.value + '/' + sideOrder.target;
              orderLabel.textContent = (snapshot.campaignSideOrderCompleted ? '✓ ZLECENIE ZALICZONE' : 'ZLECENIE: ' + sideOrder.label + ' • ' + valueText);
              orderLabel.title = sideOrder.description + ' • ' + valueText;
              orderLabel.classList.toggle('is-complete', snapshot.campaignSideOrderCompleted);
            }
            if (clock && snapshot.campaignRemainingSeconds !== null) { const left = Math.max(0, snapshot.campaignRemainingSeconds); clock.textContent = 'CEL ' + String(Math.floor(left / 60)).padStart(2,'0') + ':' + String(left % 60).padStart(2,'0'); }
          }
          const mapNameElem = document.getElementById('survival-map-name');
          if (mapNameElem) {
            mapNameElem.textContent = snapshot.mapName.toUpperCase();
            mapNameElem.setAttribute('title', snapshot.mapSubtitle);
          }
          const secretCountElem = document.getElementById('survival-secret-count');
          if (secretCountElem) secretCountElem.textContent = 'SEKRETY ' + snapshot.secretsFound + '/' + snapshot.totalSecrets;
          const minutes = Math.floor(snapshot.elapsedSeconds / 60);
          const seconds = snapshot.elapsedSeconds % 60;
          if (survivalTimeElem) survivalTimeElem.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
          if (survivalWaveElem) survivalWaveElem.textContent = String(snapshot.wave);
          if (survivalLevelElem) survivalLevelElem.textContent = String(snapshot.level);
           if (survivalRankElem) {
             survivalRankElem.textContent = snapshot.rankName;
             survivalRankElem.title = 'Następna ranga: ' + snapshot.nextRankName + ' • poziom ' + snapshot.nextRankLevel;
           }
          if (survivalXpElem) survivalXpElem.textContent = snapshot.xp + ' / ' + snapshot.xpToNext + ' XP';
          if (survivalXpFill) survivalXpFill.style.width = Math.min(100, (snapshot.xp / Math.max(1, snapshot.xpToNext)) * 100) + '%';
          if (survivalKillsElem) {
            const chainLabel = snapshot.killStreak >= 2 ? ' • ×' + snapshot.killStreak : '';
            const overdriveLabel = snapshot.overdriveRemainingSeconds > 0
              ? ' ⚡' + Math.ceil(snapshot.overdriveRemainingSeconds) + 's'
              : '';
            survivalKillsElem.textContent = String(snapshot.kills) + ' / ' + String(snapshot.perfectDodges) +
              chainLabel + overdriveLabel + (snapshot.counterattackReady ? ' ✦' : '');
            survivalKillsElem.title = snapshot.overdriveRemainingSeconds > 0
              ? 'OVERDRIVE B4: +12% obrażeń, +18% tempa ataku i +7% prędkości przez ' + Math.ceil(snapshot.overdriveRemainingSeconds) + ' s.'
              : snapshot.counterattackReady
                ? 'Kontratak naładowany: następna salwa broni zada +1 obrażenie.'
                : snapshot.killStreak > 0
                  ? 'Seria eliminacji: ' + snapshot.killStreak + '/6. Utrzymaj tempo, zanim licznik serii wygaśnie.'
                  : 'Eliminacje / idealne uniki. Sześć szybkich eliminacji uruchamia krótki Overdrive.';
          }
          if (survivalEnemiesElem) survivalEnemiesElem.textContent = String(snapshot.aliveEnemies);
          const contract = snapshot.contract;
          if (survivalContractTitleElem) {
            survivalContractTitleElem.textContent = (contract.completed ? '✓ ' : contract.expired ? '× ' : 'KONTRAKT • ') + contract.title;
          }
          if (survivalContractDetailElem) {
            survivalContractDetailElem.textContent = contract.completed
              ? 'Zaliczone. Premia XP czeka przy operatorze.'
              : contract.expired
                ? 'Czas minął. Nowy kontrakt pojawi się w kolejnej fali.'
                : contract.description;
          }
          if (survivalContractMetaElem) {
            survivalContractMetaElem.textContent = contract.progress + ' / ' + contract.target + ' • ' +
              Math.ceil(contract.remainingSeconds) + ' s';
          }
          if (survivalContractFillElem) {
            survivalContractFillElem.style.width =
              Math.min(100, (contract.progress / Math.max(1, contract.target)) * 100) + '%';
          }
          if (survivalContractElem) {
            survivalContractElem.classList.toggle('is-complete', contract.completed);
            survivalContractElem.classList.toggle('is-expired', contract.expired);
            survivalContractElem.setAttribute('aria-label',
              contract.title + ': ' + contract.progress + ' z ' + contract.target +
              ', pozostało ' + Math.ceil(contract.remainingSeconds) + ' sekund.');
          }
          const event = snapshot.event;
          if (survivalEventElem) survivalEventElem.classList.toggle('hidden', !event);
          if (event) {
            if (survivalEventTitleElem) survivalEventTitleElem.textContent = event.title;
            if (survivalEventDetailElem) survivalEventDetailElem.textContent = event.description;
            if (survivalEventMetaElem) survivalEventMetaElem.textContent = event.progress + ' / ' + event.target + ' • ' + Math.ceil(event.remainingSeconds) + ' s';
            if (survivalEventFillElem) survivalEventFillElem.style.width = Math.min(100, (event.progress / Math.max(1, event.target)) * 100) + '%';
            if (survivalEventElem) survivalEventElem.setAttribute('aria-label', event.title + ': ' + event.progress + ' z ' + event.target + ', pozostało ' + Math.ceil(event.remainingSeconds) + ' sekund.');
          }
          const primaryFirearm = snapshot.primaryFirearm;
          const firearmStatus = document.getElementById('survival-firearm-status');
          if (firearmStatus && primaryFirearm) {
            const reloading = primaryFirearm.reloadRemainingSeconds > 0;
            const cycling = !reloading && primaryFirearm.fireCooldownSeconds > 0;
            const reloadProgress = reloading
              ? Math.max(0, Math.min(1, 1 - primaryFirearm.reloadRemainingSeconds / Math.max(0.01, primaryFirearm.reloadDurationSeconds)))
              : 0;
            const cycleProgress = cycling
              ? Math.max(0, Math.min(1, 1 - primaryFirearm.fireCooldownSeconds / Math.max(0.01, primaryFirearm.fireIntervalSeconds)))
              : 0;
            const ammoProgress = primaryFirearm.ammoInMagazine / Math.max(1, primaryFirearm.magazineSize);
            const ammoAlert = reloading
              ? 'ready'
              : getSurvivalFirearmAmmoAlert(primaryFirearm.ammoInMagazine, primaryFirearm.magazineSize);
            const signature = [
              primaryFirearm.id, primaryFirearm.ammoInMagazine,
              Math.ceil(primaryFirearm.reloadRemainingSeconds * 4),
              Math.ceil(primaryFirearm.fireCooldownSeconds * 4),
            ].join(':');
            if (firearmStatus.dataset.signature !== signature) {
              firearmStatus.dataset.signature = signature;
              const icon = document.getElementById('survival-firearm-icon');
              const name = document.getElementById('survival-firearm-name');
              const ammo = document.getElementById('survival-firearm-ammo');
              const action = document.getElementById('survival-firearm-reload');
              const ammoFill = document.getElementById('survival-firearm-ammo-fill');
              const actionFill = document.getElementById('survival-firearm-action-fill');
              const reloadButton = document.getElementById('btn-survival-reload') as HTMLButtonElement | null;
              if (icon) icon.textContent = primaryFirearm.icon;
              if (name) name.textContent = primaryFirearm.name.toUpperCase();
              if (ammo) ammo.textContent = reloading
                ? '— / ' + primaryFirearm.magazineSize
                : primaryFirearm.ammoInMagazine + ' / ' + primaryFirearm.magazineSize;
              if (action) {
                action.textContent = reloading
                  ? 'PRZEŁADOWANIE ' + primaryFirearm.reloadRemainingSeconds.toFixed(1) + ' s'
                  : cycling
                    ? 'CYKL ZAMKA ' + primaryFirearm.fireCooldownSeconds.toFixed(1) + ' s'
                    : ammoAlert === 'low'
                      ? 'MAŁO AMUNICJI • R'
                      : ammoAlert === 'critical'
                        ? 'KOŃCÓWKA AMUNICJI • R'
                        : ammoAlert === 'empty'
                          ? 'PUSTY MAGAZYNEK'
                          : 'GOTOWY';
              }
              if (ammoFill) ammoFill.style.width = (ammoProgress * 100).toFixed(1) + '%';
              if (actionFill) actionFill.style.width = ((reloading ? reloadProgress : cycleProgress) * 100).toFixed(1) + '%';
              if (reloadButton) {
                reloadButton.disabled = reloading || primaryFirearm.ammoInMagazine >= primaryFirearm.magazineSize;
                reloadButton.classList.toggle('is-ready', !reloading && primaryFirearm.ammoInMagazine > 0 && primaryFirearm.ammoInMagazine < primaryFirearm.magazineSize);
                reloadButton.classList.toggle('is-low-ammo', ammoAlert === 'low');
                reloadButton.classList.toggle('is-critical-ammo', ammoAlert === 'critical' || ammoAlert === 'empty');
                reloadButton.setAttribute('aria-label', reloading
                  ? 'Broń jest przeładowywana'
                  : primaryFirearm.ammoInMagazine >= primaryFirearm.magazineSize
                    ? 'Magazynek jest pełny'
                    : 'Ręcznie przeładuj broń (R)');
              }
              firearmStatus.style.setProperty('--firearm-color', '#' + primaryFirearm.color.toString(16).padStart(6, '0'));
              firearmStatus.classList.toggle('is-reloading', reloading);
              firearmStatus.classList.toggle('is-cycling', cycling);
              firearmStatus.classList.toggle('is-low-ammo', ammoAlert === 'low');
              firearmStatus.classList.toggle('is-critical-ammo', ammoAlert === 'critical');
              firearmStatus.classList.toggle('is-empty-ammo', ammoAlert === 'empty');
              const firearmReadinessLabel = reloading
                ? ', przeładowanie magazynka'
                : cycling
                  ? ', cykl broni'
                  : ammoAlert === 'low'
                    ? ', mało amunicji'
                    : ammoAlert === 'critical'
                      ? ', końcówka magazynka'
                      : ammoAlert === 'empty'
                        ? ', pusty magazynek'
                        : ', gotowa';
              firearmStatus.setAttribute('aria-label', primaryFirearm.name + ', amunicja ' + primaryFirearm.ammoInMagazine + ' na ' + primaryFirearm.magazineSize + firearmReadinessLabel);
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
        onSurvivalLevelUp: (options: SurvivalUpgradeOption[], context: 'levelup' | 'rank-up' | 'boss-reward' | 'chaos-roulette' = 'levelup') => {
          if (!survivalUpgradeOptions || !survivalLevelUp) return;
          const isBossReward = context === 'boss-reward';
          const isRankUp = context === 'rank-up';
          const isChaosRoulette = context === 'chaos-roulette';
          const currentRank = survivalRankElem?.textContent || 'OPERATOR';
          survivalLevelUp.dataset.mode = context;
          const titleElement = document.getElementById('survival-levelup-title');
          const descriptionElement = document.getElementById('survival-levelup-desc');
          const iconElement = document.getElementById('survival-levelup-icon');
          const hintElement = document.getElementById('survival-levelup-hint');
          if (titleElement) titleElement.textContent = isChaosRoulette
            ? 'JEDNORĘKI BANDYTA B4'
            : isBossReward
              ? 'NAGRODA ZA POKONANIE BOSS-A'
              : isRankUp ? 'AWANS RANGI: ' + currentRank : 'AWANS OPERATORA';
          if (descriptionElement) descriptionElement.textContent = isChaosRoulette
            ? 'Co trzeci poziom: 17 możliwych wyników — premie bojowe, leczenie, kontrola tłumu, deszcz XP, łupy i dostawy przeciwników.'
            : isBossReward
              ? 'Boss pokonany. Wybierz jedno z trzech legendarnych wzmocnień operatora: moc, mobilność albo obronę.'
              : isRankUp
                ? 'Awansujesz do rangi ' + currentRank + '. Jedna karta ma gwarantowaną wyższą rzadkość, a zapas przerzutów zwiększono o 1.'
                : 'Wybierz jeden z trzech modułów. Rzadkie, epickie i legendarne wersje wzmacniają ten sam efekt.';
          if (iconElement) iconElement.textContent = isChaosRoulette ? '🎰' : isBossReward ? '🏆' : isRankUp ? '🎖️' : '⬆';
          if (hintElement) hintElement.textContent = isChaosRoulette
            ? 'Jeden spin, bez cofania wyniku. Łącznie 9% puli stanowi nieproszona dostawa wrogów; pozostałe pola oferują premie, kontrolę tłumu i łupy.'
            : isBossReward
              ? 'Nagroda jest obowiązkowa i nie podlega przerzuceniu ani pominięciu. Akcja pozostaje wstrzymana do wyboru.'
              : isRankUp
                ? 'Awans co 5 poziomów: karta ma co najmniej Rare, Epic lub Legendary zależnie od rangi. Dodatkowy przerzut jest ograniczony do 3.'
                : 'Wybór zatrzymuje akcję. Rzadkość wzmacnia efekt wybranego perku operatora.';
          survivalRerollBtn?.classList.toggle('hidden', isBossReward || isChaosRoulette);
          survivalSkipBtn?.classList.toggle('hidden', isBossReward || isChaosRoulette);
          survivalUpgradeOptions.replaceChildren();
          if (isChaosRoulette) {
            const machine = document.createElement('div');
            machine.className = 'survival-chaos-machine';
            machine.innerHTML = `
              <div class="survival-chaos-marquee" aria-hidden="true">
                <span class="survival-chaos-lamp"></span>
                <strong>MAGAZYN B4 • JACKPOT ZMIANY</strong>
                <span class="survival-chaos-lamp"></span>
              </div>
              <div class="survival-chaos-reels" aria-hidden="true">
                <div class="survival-chaos-reel-window"><span class="survival-chaos-reel-symbol">💎</span></div>
                <div class="survival-chaos-reel-window"><span class="survival-chaos-reel-symbol">⚡</span></div>
                <div class="survival-chaos-reel-window"><span class="survival-chaos-reel-symbol">☢️</span></div>
              </div>
              <div class="survival-chaos-machine-caption">17 WYNIKÓW <i>•</i> WIĘCEJ RNG <i>•</i> JEDEN SPIN</div>
              <div class="survival-chaos-result" aria-live="polite">NAGRODA CZEKA NA LOS</div>
            `;
            machine.setAttribute('aria-label', 'Jednoręki bandyta B4. Trzy obracające się bębny, siedemnaście możliwych wyników, jeden spin');
            const reelSymbols = [
              { icon: '💎', accent: '#38bdf8' }, { icon: '⚡', accent: '#facc15' },
              { icon: '☢️', accent: '#4ade80' }, { icon: '👾', accent: '#fb7185' },
              { icon: '🛡️', accent: '#22c55e' }, { icon: '❤️', accent: '#f87171' },
              { icon: '💥', accent: '#fb923c' }, { icon: '✹', accent: '#c084fc' },
              { icon: '✨', accent: '#67e8f9' }, { icon: '🪙', accent: '#fbbf24' },
              { icon: '⏱️', accent: '#93c5fd' }, { icon: '🚨', accent: '#f43f5e' },
              { icon: '🧲', accent: '#60a5fa' }, { icon: '📈', accent: '#a3e635' },
              { icon: '📦', accent: '#fbbf24' }, { icon: '🧹', accent: '#67e8f9' },
              { icon: '🎲', accent: '#fb7185' }, { icon: '🔧', accent: '#cbd5e1' },
            ];
            const rewardStyles: Record<string, { category: string; accent: string }> = {
              skill: { category: 'ULEPSZENIE', accent: '#38bdf8' },
              perk: { category: 'PERK SPECJALNY', accent: '#c084fc' },
              shield: { category: 'OSŁONA GAMMA', accent: '#4ade80' },
              heal: { category: 'RATUNEK HP', accent: '#fb7185' },
              explosion: { category: 'WYBUCH', accent: '#fb923c' },
              nova: { category: 'NOVA', accent: '#d8b4fe' },
              enemy_pack: { category: 'NIEPROSZENI GOŚCIE', accent: '#fb7185' },
              xp_rain: { category: 'DESZCZ XP', accent: '#67e8f9' },
              overdrive: { category: 'OVERDRIVE', accent: '#facc15' },
              bounty: { category: 'PREMIA', accent: '#fbbf24' },
              time_lock: { category: 'ZAMROŻENIE FALI', accent: '#93c5fd' },
              elite_delivery: { category: 'DOSTAWA ELITY', accent: '#f43f5e' },
              magnet_surge: { category: 'MAGNES TURBO', accent: '#60a5fa' },
              xp_surge: { category: 'DOPALACZ XP', accent: '#a3e635' },
              golden_crate: { category: 'ZŁOTA PALETA', accent: '#fbbf24' },
              hazard_clear: { category: 'CZYSZCZENIE ZAGROŻEŃ', accent: '#67e8f9' },
              double_or_nothing: { category: 'PODWÓJNE ALBO NIC', accent: '#fb7185' },
            };
            const reelNodes = Array.from(machine.querySelectorAll<HTMLElement>('.survival-chaos-reel-symbol'));
            const resultNode = machine.querySelector<HTMLElement>('.survival-chaos-result');
            const spinButton = document.createElement('button');
            spinButton.type = 'button';
            spinButton.className = 'survival-chaos-spin';
            spinButton.textContent = '🎰 ZAKRĘĆ AUTOMATEM';
            spinButton.setAttribute('aria-label', 'Uruchom losowanie jednorękiego bandyty');
            spinButton.addEventListener('click', () => {
              if (spinButton.disabled) return;
              spinButton.disabled = true;
              spinButton.textContent = 'LOSOWANIE…';
              machine.classList.remove('is-jackpot', 'is-risk', 'has-result');
              machine.classList.add('is-spinning');
              sound.playRouletteSpin();
              if (resultNode) {
                resultNode.textContent = 'BĘBNY W RUCHU…';
                resultNode.classList.remove('is-visible');
              }

              const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
              const stopAt = reducedMotion ? [80, 150, 220] : [1420, 1960, 2520];
              let stoppedReels = 0;
              reelNodes.forEach((reel, index) => {
                reel.classList.remove('is-locked');
                const tick = window.setInterval(() => {
                  const symbol = reelSymbols[Math.floor(Math.random() * reelSymbols.length)];
                  reel.textContent = symbol.icon;
                  reel.style.setProperty('--reel-accent', symbol.accent);
                }, reducedMotion ? 160 : 72);
                window.setTimeout(() => {
                  window.clearInterval(tick);
                  reel.classList.add('is-locked');
                  sound.playRouletteStop(index);
                  stoppedReels += 1;
                  if (stoppedReels !== reelNodes.length) return;

                  const spun = this.engine.spinSurvivalChaosRoulette();
                  const result = this.engine.getSurvivalChaosRouletteLastResult();
                  if (!spun || !result) {
                    machine.classList.remove('is-spinning');
                    spinButton.disabled = false;
                    spinButton.textContent = '🎰 SPRÓBUJ JESZCZE RAZ';
                    if (resultNode) resultNode.textContent = 'AUTOMAT NIE ZŁAPAŁ SYGNAŁU';
                    return;
                  }

                  const style = rewardStyles[result.kind] || { category: 'WYNIK B4', accent: '#fbbf24' };
                  machine.style.setProperty('--roulette-accent', style.accent);
                  machine.dataset.result = result.kind;
                  machine.classList.remove('is-spinning');
                  const isRisk = result.kind === 'enemy_pack' || result.kind === 'elite_delivery' || result.kind === 'double_or_nothing';
                  machine.classList.add('has-result', isRisk ? 'is-risk' : 'is-jackpot');
                  sound.playRouletteResult(isRisk);
                  reelNodes.forEach((node) => {
                    node.textContent = result.icon;
                    node.style.setProperty('--reel-accent', style.accent);
                    node.classList.add('is-locked');
                  });
                  if (resultNode) {
                    resultNode.textContent = result.icon + ' ' + result.title + '  •  ' + style.category;
                    resultNode.classList.add('is-visible');
                  }
                  spinButton.textContent = result.kind === 'enemy_pack' || result.kind === 'elite_delivery'
                    ? '⚠️ WYNIK LOSOWANIA'
                    : '🏆 NAGRODA WYLOSOWANA';
                  survivalLevelUp.classList.add('roulette-reveal');
                  window.setTimeout(() => {
                    if (survivalLevelUp.dataset.mode === 'chaos-roulette') {
                      survivalLevelUp.classList.add('hidden');
                      survivalLevelUp.classList.remove('roulette-reveal');
                    }
                  }, 2300);
                }, stopAt[index]);
              });
            });
            survivalUpgradeOptions.append(machine, spinButton);
            survivalLevelUp.classList.remove('hidden');
            return;
          }
          for (const option of options) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'survival-upgrade-card rarity-' + option.rarity;
            card.dataset.rarity = option.rarity;
            card.setAttribute('aria-label', option.rarityLabel + ': ' + option.title + '. ' + option.description);
            const rarityBadge = document.createElement('span');
            rarityBadge.className = 'survival-upgrade-rarity';
            rarityBadge.textContent = option.rarityLabel;
            const icon = document.createElement('span');
            icon.className = 'survival-upgrade-icon';
            icon.textContent = option.icon;
            const title = document.createElement('span');
            title.className = 'survival-upgrade-title';
            title.textContent = option.title;
            const description = document.createElement('span');
            description.className = 'survival-upgrade-description';
            description.textContent = option.description;
            card.append(rarityBadge, icon, title, description);
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
        onSurvivalSecretFound: (mapId, secretId, secretName) => {
          trackSurvivalSecretAchievement(mapId, secretId);
          console.info('[Secrets] Odkryto:', secretName, mapId + ':' + secretId);

          if (secretId === 'oniric_dream') {
            const engine = this.engine;
            if (engine?.getGameState() === 'playing') engine.togglePause();

            launchOniricPlatformer({
              onComplete: (result) => {
                const activeEngine = this.engine;
                if (!activeEngine) return;
                if (result.won) {
                  const bonus = 1200 + result.collected * 250;
                  activeEngine.grantOniricDreamReward(bonus);
                  showSurvivalAnnouncement(
                    'NORKA ZDOBYTA',
                    'KRÓLIK ZWRACA ZEGAREK',
                    'Udało się przejść sekret. Odebrano ' + bonus + ' punktów oraz dodatkowe życie.',
                  );
                } else {
                  showSurvivalAnnouncement(
                    'POWRÓT Z NORKI',
                    'SEKRET ODKRYTY',
                    'Nie udało się zebrać wszystkich zegarków. Rozgrywka magazynowa jest gotowa do wznowienia.',
                  );
                }
                if (activeEngine.getGameState() === 'paused') activeEngine.togglePause();
              },
            });
          }

          if (secretId === 'necronomicon') {
            const engine = this.engine;
            if (engine?.getGameState() === 'playing') engine.togglePause();

            launchCthulhuRetroArena({
              onComplete: (result) => {
                const activeEngine = this.engine;
                if (!activeEngine) return;
                if (result.won) {
                  activeEngine.grantCthulhuRetroReward(6000);
                } else {
                  showSurvivalAnnouncement(
                    'POWRÓT Z R’LYEH',
                    'NECRONOMICON MILKNIE',
                    'Tym razem Cthulhu nie został pokonany. Możesz wrócić do magazynu i kontynuować rozgrywkę.',
                  );
                }
                if (activeEngine.getGameState() === 'paused') activeEngine.togglePause();
              },
            });
          }
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
        onPvpUpdate: (state, slot) => {
          this.updatePvpScoreboard(state, slot);
        },
        onPvpMatchEnd: (state, slot) => {
          this.handlePvpMatchEnd(state, slot);
        },
      }
    );

    survivalRerollBtn?.addEventListener('click', () => this.engine.rerollSurvivalUpgrades());

    const rewardedRerollButton = document.getElementById('btn-survival-ad-reroll') as HTMLButtonElement | null;
    rewardedRerollButton?.addEventListener('click', async () => {
      if (!areGameAdsReady() || rewardedRerollButton.disabled) return;
      rewardedRerollButton.disabled = true;
      const originalLabel = rewardedRerollButton.textContent || '🎬 OGLĄDAJ REKLAMĘ • +1 PRZERZUT';
      rewardedRerollButton.textContent = 'ŁADOWANIE NAGRODY...';
      try {
        const earned = await showRewardedRerollAd();
        if (earned && this.engine.grantSurvivalRerollFromAd()) {
          rewardedRerollButton.textContent = '✅ DODATKOWY PRZERZUT ODEBRANY';
          rewardedRerollButton.setAttribute('aria-label', 'Dodatkowy przerzut za reklamę odebrany');
        } else {
          rewardedRerollButton.textContent = 'BRAK NAGRODY — SPRÓBUJ PONOWNIE';
        }
      } finally {
        rewardedRerollButton.disabled = false;
        window.setTimeout(() => {
          if (rewardedRerollButton.isConnected) {
            rewardedRerollButton.textContent = originalLabel;
            rewardedRerollButton.removeAttribute('aria-label');
          }
        }, 2400);
      }
    });

    document.getElementById('btn-ad-privacy-options')?.addEventListener('click', () => {
      void showAdPrivacyOptions().then(syncAdMobSettings);
    });
    survivalSkipBtn?.addEventListener('click', () => {
      if (this.engine.skipSurvivalUpgrade()) survivalLevelUp?.classList.add('hidden');
    });

    // The 2D intro is created lazily on first use; the boot sequence requests
    // its first run after the renderer and title UI are fully ready.
    this.cinematicIntro = null;

    renderCharacterMasteryPanel = (id: CharacterId) => {
      const summary = getCharacterMasterySummary(characterMasteryProfile, id);
      const state = characterMasteryProfile.characters[id];
      const title = document.getElementById('character-mastery-title');
      const level = document.getElementById('character-mastery-level');
      const xp = document.getElementById('character-mastery-xp');
      const points = document.getElementById('character-mastery-points');
      const fill = document.getElementById('character-mastery-fill') as HTMLElement | null;
      const record = document.getElementById('character-mastery-record');
      const list = document.getElementById('character-talent-list');

      if (title) title.textContent = summary.isMaxLevel
        ? 'MISTRZOSTWO • MAKSIMUM'
        : 'MISTRZOSTWO • ' + CHARACTERS[id].className.toUpperCase();
      if (level) level.textContent = String(summary.level);
      if (xp) xp.textContent = summary.isMaxLevel
        ? 'MAKSYMALNE MISTRZOSTWO'
        : summary.xp + ' / ' + summary.xpToNext + ' MASTERY XP';
      if (points) {
        const pointLabel = summary.availableTalentPoints === 1 ? 'PUNKT TALENTU' : 'PUNKTY TALENTU';
        points.textContent = summary.availableTalentPoints + ' ' + pointLabel;
      }
      if (fill) fill.style.width = summary.progressPercent + '%';
      if (record) record.textContent =
        state.totalRuns + ' zmian • ' + state.totalKills.toLocaleString('pl-PL') +
        ' eliminacji • ' + state.totalBosses + ' bossów';

      // Show mastery on all five selection cards, not only the currently selected operator.
      document.querySelectorAll<HTMLElement>('.char-card[data-char]').forEach((card) => {
        const cardId = card.dataset.char as CharacterId | undefined;
        if (!cardId || !CHARACTERS[cardId]) return;
        let badge = card.querySelector<HTMLElement>('.char-card-mastery');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'char-card-mastery';
          card.appendChild(badge);
        }
        badge.textContent = 'M' + characterMasteryProfile.characters[cardId].level;
        badge.title = 'Mistrzostwo: poziom ' + characterMasteryProfile.characters[cardId].level + ' / 15';
      });

      if (!list) return;
      list.replaceChildren();
      const effectLabels: Record<string, string> = {
        attack: 'SIŁA ATAKU',
        defense: 'ODPORNOŚĆ',
        speed: 'SZYBKOŚĆ',
        jump: 'SIŁA SKOKU',
        cooldown: 'CZAS SUPERUMIEJĘTNOŚCI',
      };
      for (const talent of CHARACTER_TALENTS[id]) {
        const rank = state.talentRanks[talent.id] || 0;
        const card = document.createElement('article');
        card.className = 'character-talent-card' + (rank >= talent.maxRank ? ' is-maxed' : '');
        const heading = document.createElement('div');
        heading.className = 'character-talent-heading';
        const icon = document.createElement('span');
        icon.className = 'character-talent-icon';
        icon.textContent = talent.icon;
        const name = document.createElement('strong');
        name.textContent = talent.name;
        heading.append(icon, name);
        const rankLabel = document.createElement('span');
        rankLabel.className = 'character-talent-rank';
        rankLabel.textContent = rank + ' / ' + talent.maxRank;
        const description = document.createElement('p');
        description.className = 'character-talent-description';
        description.textContent = talent.description;
        const effect = document.createElement('span');
        effect.className = 'character-talent-effect';
        const bonusPercent = (talent.perRank * 100 * rank).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
        const sign = talent.effect === 'defense' || talent.effect === 'cooldown' ? '−' : '+';
        effect.textContent = effectLabels[talent.effect] + ' ' + sign + bonusPercent + '%';
        const pips = document.createElement('div');
        pips.className = 'character-talent-pips';
        for (let index = 0; index < talent.maxRank; index++) {
          const pip = document.createElement('span');
          pip.classList.toggle('is-filled', index < rank);
          pips.appendChild(pip);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'character-talent-upgrade';
        button.disabled = rank >= talent.maxRank || summary.availableTalentPoints <= 0;
        button.textContent = rank >= talent.maxRank
          ? 'MAKSIMUM'
          : summary.availableTalentPoints > 0 ? 'ROZWIŃ • 1 PUNKT' : 'BRAK PUNKTÓW';
        button.setAttribute('aria-label', 'Rozwiń talent ' + talent.name + ', aktualny poziom ' + rank + ' z ' + talent.maxRank);
        button.addEventListener('click', () => {
          const result = spendCharacterTalentPoint(characterMasteryProfile, id, talent.id);
          if (!result.purchased) return;
          characterMasteryProfile = result.profile;
          persistCharacterMasteryProfile();
          this.engine.selectCharacter(id, combineAccountAndCharacterBonuses(
            getCharacterTalentBonuses(characterMasteryProfile, id),
            getAccountProgressionBonuses(accountProgressionProfile),
          ));
          renderCharacterMasteryPanel(id);
          const toast = document.createElement('div');
          toast.className = 'achievement-unlock-toast';
          toast.textContent = talent.icon + ' TALENT ROZWINIĘTY • ' + talent.name + ' ' + (rank + 1) + '/' + talent.maxRank;
          document.body.appendChild(toast);
          window.setTimeout(() => toast.remove(), 2600);
        });
        card.append(heading, rankLabel, description, effect, pips, button);
        list.appendChild(card);
      }
    };

    renderAccountProgressionPanels = () => {
      const summary = getAccountProgressionSummary(accountProgressionProfile);
      const rankInfo = getAccountRankInfo(accountProgressionProfile.level);
      const bonuses = getAccountProgressionBonuses(accountProgressionProfile);
      const level = document.getElementById('account-progress-level');
      const rank = document.getElementById('account-progress-rank');
      const xp = document.getElementById('account-progress-xp');
      const points = document.getElementById('account-progress-points');
      const fill = document.getElementById('account-progress-fill') as HTMLElement | null;
      const statline = document.getElementById('account-progress-statline');
      const tree = document.getElementById('account-tree-grid');
      const currentRank = document.getElementById('account-rank-current');
      const nextRank = document.getElementById('account-rank-next');
      const rankTrack = document.getElementById('account-rank-track');
      const bonusList = document.getElementById('account-rank-bonuses');

      if (level) level.textContent = String(summary.level);
      if (rank) rank.textContent = rankInfo.rankName;
      if (xp) xp.textContent = summary.isMaxLevel
        ? 'MAKSYMALNY POZIOM • 37 / 37'
        : summary.xp.toLocaleString('pl-PL') + ' / ' + summary.xpToNext.toLocaleString('pl-PL') + ' XP';
      if (points) points.textContent = summary.availableSkillPoints + ' / ' + (ACCOUNT_PROGRESS_MAX_LEVEL - 1) + ' DOSTĘPNYCH PUNKTÓW';
      if (fill) fill.style.width = summary.progressPercent + '%';
      if (statline) statline.textContent =
        summary.stats.survivalRuns + ' zmian Survival • ' +
        summary.stats.pvpMatches + ' pojedynków PvP • ' +
        summary.stats.pvpWins + ' zwycięstw';

      if (tree) {
        tree.replaceChildren();
        for (const branchId of Object.keys(ACCOUNT_TALENT_BRANCHES) as Array<keyof typeof ACCOUNT_TALENT_BRANCHES>) {
          const branch = ACCOUNT_TALENT_BRANCHES[branchId];
          const section = document.createElement('section');
          section.className = 'account-tree-branch branch-' + branchId;
          const header = document.createElement('div');
          header.className = 'account-branch-heading';
          const icon = document.createElement('span');
          icon.className = 'account-branch-icon';
          icon.textContent = branch.icon;
          const copy = document.createElement('div');
          copy.className = 'account-branch-copy';
          const title = document.createElement('strong');
          title.textContent = branch.name;
          const description = document.createElement('p');
          description.textContent = branch.description;
          copy.append(title, description);
          header.append(icon, copy);
          const nodes = document.createElement('div');
          nodes.className = 'account-branch-nodes';

          for (const talent of ACCOUNT_TALENTS.filter((entry) => entry.branch === branchId)) {
            const currentRank = accountProgressionProfile.talentRanks[talent.id] || 0;
            const prerequisite = talent.prerequisiteId
              ? ACCOUNT_TALENTS.find((entry) => entry.id === talent.prerequisiteId)
              : undefined;
            const prerequisiteRank = prerequisite
              ? accountProgressionProfile.talentRanks[prerequisite.id] || 0
              : 0;
            const isLocked = Boolean(prerequisite && prerequisiteRank < prerequisite.maxRank);
            const canPurchase = canSpendAccountTalentPoint(accountProgressionProfile, talent.id);
            const node = document.createElement('article');
            node.className = 'account-talent-node' +
              (isLocked ? ' is-locked' : '') +
              (currentRank >= talent.maxRank ? ' is-maxed' : '');
            const top = document.createElement('div');
            top.className = 'account-talent-node-top';
            const nodeIcon = document.createElement('span');
            nodeIcon.className = 'account-talent-icon';
            nodeIcon.textContent = talent.icon;
            const tier = document.createElement('span');
            tier.className = 'account-talent-tier';
            tier.textContent = 'POZIOM ' + talent.tier;
            top.append(nodeIcon, tier);
            const name = document.createElement('strong');
            name.className = 'account-talent-name';
            name.textContent = talent.name;
            const detail = document.createElement('p');
            detail.className = 'account-talent-description';
            detail.textContent = talent.description;
            const percent = talent.perRank * currentRank * 100;
            const sign = talent.effect === 'damageTaken' || talent.effect === 'cooldown' ? '−' : '+';
            const effect = document.createElement('span');
            effect.className = 'account-talent-effect';
            effect.textContent = sign + percent.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + '% • NA RANGĘ ' +
              (talent.perRank * 100).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + '%';
            const progress = document.createElement('div');
            progress.className = 'account-talent-pips';
            for (let index = 0; index < talent.maxRank; index++) {
              const pip = document.createElement('span');
              pip.classList.toggle('is-filled', index < currentRank);
              progress.appendChild(pip);
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'account-talent-upgrade';
            button.disabled = !canPurchase;
            button.textContent = currentRank >= talent.maxRank
              ? 'MAKSIMUM'
              : isLocked
                ? 'WYMAGANY POPRZEDNI WĘZEŁ'
                : summary.availableSkillPoints > 0
                  ? (currentRank > 0 ? 'ROZWIŃ • 1 PUNKT' : 'ODKRYJ • 1 PUNKT')
                  : 'BRAK PUNKTÓW';
            button.addEventListener('click', () => {
              const result = spendAccountTalentPoint(accountProgressionProfile, talent.id);
              if (!result.purchased) return;
              accountProgressionProfile = result.profile;
              persistAccountProgressionProfile();
              void this.syncAccountProgressionWithCloud();
              this.engine.selectCharacter(
                this.selectedCharId,
                combineAccountAndCharacterBonuses(
                  getCharacterTalentBonuses(characterMasteryProfile, this.selectedCharId),
                  getAccountProgressionBonuses(accountProgressionProfile),
                ),
              );
              renderCharacterMasteryPanel(this.selectedCharId);
              renderAccountProgressionPanels();
              const toast = document.createElement('div');
              toast.className = 'achievement-unlock-toast';
              toast.textContent = talent.icon + ' ROZWÓJ KONTA • ' + talent.name + ' ' + (currentRank + 1) + '/' + talent.maxRank;
              document.body.appendChild(toast);
              window.setTimeout(() => toast.remove(), 3000);
            });
            node.append(top, name, detail, effect, progress, button);
            nodes.appendChild(node);
          }
          section.append(header, nodes);
          tree.appendChild(section);
        }
      }

      if (currentRank) currentRank.textContent = rankInfo.rankIcon + ' ' + rankInfo.rankName + ' • POZIOM ' + summary.level;
      if (nextRank) nextRank.textContent = summary.isMaxLevel
        ? 'Osiągnięto najwyższą rangę konta.'
        : 'Następna ranga: ' + rankInfo.nextRankName + ' • poziom ' + rankInfo.nextRankLevel + ' • ' +
          (rankInfo.nextRankLevel - summary.level) + ' poziomów do awansu';
      if (rankTrack) {
        rankTrack.replaceChildren();
        for (const rankEntry of ACCOUNT_RANKS) {
          const card = document.createElement('article');
          const unlocked = summary.level >= rankEntry.level;
          const active = rankInfo.rankName === rankEntry.name;
          card.className = 'account-rank-card' + (unlocked ? ' is-unlocked' : '') + (active ? ' is-current' : '');
          const top = document.createElement('div');
          top.className = 'account-rank-card-top';
          const emblem = document.createElement('span');
          emblem.className = 'account-rank-icon';
          emblem.textContent = unlocked ? rankEntry.icon : '🔒';
          const levelTag = document.createElement('small');
          levelTag.textContent = 'POZIOM ' + rankEntry.level;
          top.append(emblem, levelTag);
          const title = document.createElement('strong');
          title.textContent = rankEntry.name;
          const subtitle = document.createElement('p');
          subtitle.textContent = rankEntry.subtitle;
          const reward = document.createElement('span');
          reward.className = 'account-rank-reward';
          reward.textContent = (unlocked ? 'ODBLOKOWANO • ' : 'NAGRODA • ') + rankEntry.reward;
          card.append(top, title, subtitle, reward);
          rankTrack.appendChild(card);
        }
      }
      if (bonusList) {
        bonusList.replaceChildren();
        const entries: Array<[string, string]> = [
          ['Obrażenia', '+' + ((bonuses.damageMultiplier - 1) * 100).toFixed(1) + '%'],
          ['Redukcja obrażeń', ((1 - bonuses.damageTakenMultiplier) * 100).toFixed(1) + '%'],
          ['Szybkość ruchu', '+' + ((bonuses.speedMultiplier - 1) * 100).toFixed(1) + '%'],
          ['Siła skoku • Survival', '+' + ((bonuses.jumpMultiplier - 1) * 100).toFixed(1) + '%'],
          ['Czas odnowienia', ((1 - bonuses.abilityCooldownMultiplier) * 100).toFixed(1) + '% szybciej'],
          ['Zdobywane doświadczenie', '+' + ((bonuses.xpMultiplier - 1) * 100).toFixed(1) + '%'],
        ];
        for (const [labelText, valueText] of entries) {
          const item = document.createElement('div');
          item.className = 'account-bonus-row';
          const label = document.createElement('span');
          label.textContent = labelText;
          const value = document.createElement('strong');
          value.textContent = valueText;
          item.append(label, value);
          bonusList.appendChild(item);
        }
      }
    };
    this.renderAccountProgressionUi = renderAccountProgressionPanels;

    const updateCharacterUI = (id: CharacterId) => {
      this.selectedCharId = id;
      this.engine.selectCharacter(id, combineAccountAndCharacterBonuses(
        getCharacterTalentBonuses(characterMasteryProfile, id),
        getAccountProgressionBonuses(accountProgressionProfile),
      ));
      renderCharacterMasteryPanel(id);
      const def = CHARACTERS[id];
      if (hudHeroName) hudHeroName.textContent = def.name;
      if (hudHeroRole) hudHeroRole.textContent = def.className;
      if (abilityName) {
        abilityName.textContent = def.abilityName;
        abilityName.title = def.abilityDescription;
      }
      // Restore the Survival/standard ability accessibility text after PvP has
      // temporarily replaced it with the arena-specific ability presentation.
      const standardAbilityButton = document.getElementById('btn-ability') as HTMLButtonElement | null;
      standardAbilityButton?.setAttribute('aria-label', `${def.abilityName}. ${def.abilityDescription}`);
      if (standardAbilityButton) {
        standardAbilityButton.title = `${def.abilityName} — ${def.abilityDescription} (E / Shift / przycisk)`;
      }

      const abilityIcons: Record<CharacterId, string> = {
        marcin: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M15 10h18a4 4 0 0 1 4 4v25H11V14a4 4 0 0 1 4-4Z'/><path d='M19 10V7h10v3M17 19h12M17 26l3 3 5-6M29 27h4M17 34h15'/><path d='m33 15 1.6 2.4 2.8.8-2.8.9-1.6 2.4-1.5-2.4-2.8-.9 2.8-.8Z' fill='currentColor' stroke='none'/></svg>",
        grzesiek: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='M8 32c0-8 4-13 11-13h3l3-6c1-2 4-1 4 1v5h7c3 0 5 2 5 5v6c0 6-4 10-10 10H19C12 40 8 37 8 32Z'/><path d='m13 20 2-7c1-3 5-2 5 1v5M25 18l2 6M30 18l2 6M35 19l2 5'/><path d='M17 27h15' opacity='.5'/></svg>",
        dawid: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M24 6 39 12v11c0 9-6.5 15-15 19C15.5 38 9 32 9 23V12Z'/><path d='M15 17h18M13 23h22M16 29h16M19 35h10'/><path d='m30 12 4 4-4 4M18 27l-4 4 4 4' opacity='.78'/></svg>",
        mateusz: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M11 6h18l8 8v28H11z'/><path d='M29 6v9h8M16 21h16M16 26h10'/><path d='m22 32-4 4 4 4M28 32l4 4-4 4'/><path d='m20 29 3 3-3 3 3 3' stroke-dasharray='2 3'/></svg>",
        piotr: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'><circle cx='24' cy='24' r='19' opacity='.7'/><path d='M24 5 35 38 6 18h36L13 38 24 5Z' stroke-width='2.8'/><path d='M24 17v14M17 24h14' opacity='.9'/><circle cx='24' cy='24' r='3.2' fill='currentColor' stroke='none'/><path d='M9 9l3 2M39 9l-3 2M9 39l3-2M39 39l-3-2' opacity='.8'/></svg>",
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
        const nameLabel = card.querySelector<HTMLElement>('.char-card-name');
        const roleLabel = card.querySelector<HTMLElement>('.char-card-role');
        const identityLabel = card.querySelector<HTMLElement>('.char-card-ability');
        card.style.setProperty('--operator-accent', `#${accent}`);
        if (nameLabel) nameLabel.textContent = definition.name;
        if (roleLabel) roleLabel.textContent = definition.className;
        if (identityLabel) identityLabel.textContent = definition.combatIdentity;
        let modelLabel = card.querySelector<HTMLElement>('.char-card-model-label');
        if (!modelLabel) {
          modelLabel = document.createElement('span');
          modelLabel.className = 'char-card-model-label';
          card.appendChild(modelLabel);
        }
        modelLabel.textContent = 'MODEL 3D • ' + (definition.visualModelName || 'MODEL OPERATORA');
        card.setAttribute('aria-pressed', String(cardId === id));
        card.setAttribute('aria-label', `${definition.name} — ${definition.role}`);
        if (badge) badge.innerHTML = operatorPortrait(cardId);
      });
      if (abilityIcon) { abilityIcon.innerHTML = abilityIcons[id] || abilityIcons.marcin; abilityIcon.dataset.operatorIcon = id; }

      const attackNameElem = document.getElementById('attack-name');
      const attackIconElem = document.getElementById('attack-icon');
      const attackNames: Record<CharacterId, string> = {
        marcin: 'Zaklęcia system ERP',
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
        marcin: 'Wysyła świetlny znak-zlecenie z systemu ERP. Trafiony cel zostaje ogłuszony, a co trzeci czar tworzy mocniejszą pieczęć audytu.',
        grzesiek: 'Miota ciężkim stalowym hantlem. Co trzeci rzut jest większy, mocniej odrzuca i przebija kilku przeciwników.',
        dawid: 'Rzuca rolką folii stretch, która owija i spowalnia przeciwników. Co trzeci rzut mocniej wiąże cel.',
        mateusz: 'Strzela pojedynczym impulsem paralizatora. Trafiony przeciwnik dostaje elektryczny stun; co trzeci impuls jest mocniejszy.',
        piotr: 'Miota ciężkim kluczem grzechotkowym B4. Wiruje, przebija kilka celów i wraca przez tłum do operatora; co trzeci rzut jest mocniejszy i rozgrzany do czerwoności.',
      };
      if (attackNameElem) attackNameElem.textContent = attackNames[id] || 'Atak';
      if (attackIconElem) { attackIconElem.innerHTML = attackIcons[id] || attackIcons.marcin; attackIconElem.dataset.operatorIcon = id; }

      const detailTitle = document.getElementById('char-detail-title');
      const detailClass = document.getElementById('char-detail-class');
      const detailMovement = document.getElementById('char-detail-movement');
      const detailBio = document.getElementById('char-detail-bio');
      const detailAttack = document.getElementById('char-detail-attack');
      const detailSkill = document.getElementById('char-detail-skill');
      const detailPassive = document.getElementById('char-detail-passive');
      if (detailTitle && detailBio && detailSkill) {
        detailTitle.textContent = `${def.name} – ${def.title}`;
        if (detailClass) detailClass.textContent = def.combatIdentity;
        if (detailMovement) detailMovement.textContent = def.movementIdentity;
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
      const statBarHealth = document.getElementById('stat-bar-health');
      const statValHealth = document.getElementById('stat-val-health');

      if (statBarSpeed && statValSpeed) {
        statBarSpeed.style.width = `${(def.stats.speed / 5) * 100}%`;
        statValSpeed.textContent = `${def.speed.toFixed(1)}`;
      }
      if (statBarJump && statValJump) {
        statBarJump.style.width = `${(def.stats.jump / 5) * 100}%`;
        statValJump.textContent = `${def.jumpForce.toFixed(1)}`;
      }
      if (statBarPower && statValPower) {
        statBarPower.style.width = `${(def.stats.power / 5) * 100}%`;
        statValPower.textContent = `×${def.basicAttackDamageMultiplier.toFixed(2)}`;
      }
      if (statBarDefense && statValDefense) {
        statBarDefense.style.width = `${(def.stats.defense / 5) * 100}%`;
        const mitigationPercent = Math.round((1 - def.damageTakenMultiplier) * 100);
        statValDefense.textContent = mitigationPercent > 0
          ? `−${mitigationPercent}%`
          : mitigationPercent < 0 ? `+${Math.abs(mitigationPercent)}%` : '0%';
      }
      if (statBarHealth && statValHealth) {
        statBarHealth.style.width = `${(def.maxHp / 5) * 100}%`;
        statValHealth.textContent = `${def.maxHp} HP`;
      }

      const showcasePortrait = document.getElementById('char-showcase-portrait');
      if (showcasePortrait) {
        showcasePortrait.innerHTML = operatorPortrait(id);
      }
    };

    updateCharacterUI('marcin');

    const btnPreviewVoiceline = document.getElementById('btn-preview-voiceline');
    if (btnPreviewVoiceline) {
      btnPreviewVoiceline.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const charDef = CHARACTERS[this.selectedCharId];
        if (!charDef || !charDef.voiceLines || charDef.voiceLines.length === 0) return;
        const randomQuote = charDef.voiceLines[Math.floor(Math.random() * charDef.voiceLines.length)];
        globalLastDialogueTime = 0;
        sound.playAbility(this.selectedCharId);
        createDialogueCard(randomQuote, 'hero', 'left', `${charDef.name} [Okrzyk]`);

        btnPreviewVoiceline.classList.add('playing');
        setTimeout(() => btnPreviewVoiceline.classList.remove('playing'), 650);
      });
    }

    const leaderboardLoading = document.getElementById('leaderboard-loading');
    const leaderboardList = document.getElementById('leaderboard-list');
    const btnRefreshLeaderboard = document.getElementById('btn-refresh-leaderboard') as HTMLButtonElement | null;
    const firestoreStatusBadge = document.getElementById('firestore-status-badge');
    const firestoreStatusText = document.getElementById('firestore-status-text');

    let leaderboardRenderInFlight = false;
    let leaderboardHasBeenOpened = false;

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

    renderAccountProgressionPanels();

    const renderLeaderboard = async () => {
      if (!leaderboardLoading || !leaderboardList || leaderboardRenderInFlight) return;
      leaderboardRenderInFlight = true;

      if (btnRefreshLeaderboard) {
        btnRefreshLeaderboard.disabled = true;
        btnRefreshLeaderboard.textContent = '⏳ Odświeżanie...';
      }

      const hasExistingRows = leaderboardList.childElementCount > 0;
      updateFirestoreStatusUI('checking', 'Odświeżanie rankingu z Firestore...');
      leaderboardLoading.classList.remove('hidden');
      leaderboardLoading.textContent = hasExistingRows
        ? 'Aktualizuję ranking. Poprzednie wyniki pozostają widoczne.'
        : 'Łączenie z bazą Firebase Firestore...';
      if (!hasExistingRows) leaderboardList.classList.add('hidden');

      try {
        const services = await loadFirebaseLeaderboardServices();
        const topScores = await services.getTopSurvivalLeaderboard(15);
        const readStatus = services.getSurvivalLeaderboardReadStatus();
        const isConnected = readStatus.source === 'firestore';
        updateFirestoreStatusUI(
          isConnected ? 'online' : 'offline',
          isConnected ? 'Firestore: ranking pobrany z serwera' : `Firestore: pokazano zapis lokalny (${readStatus.errorCode || 'brak połączenia'})`,
        );
        leaderboardLoading.classList.add('hidden');
        leaderboardList.classList.remove('hidden');
        leaderboardList.replaceChildren();

        if (topScores.length === 0) {
          const emptyState = isConnected
            ? 'Brak rekordów Survival. Rozpocznij zmianę i zapisz pierwszy wynik.'
            : 'Nie udało się połączyć z rankingiem online. Nie ma jeszcze lokalnych rekordów do wyświetlenia; spróbuj odświeżyć po powrocie połączenia.';
          const message = document.createElement('div');
          message.className = 'leaderboard-status-msg';
          message.textContent = emptyState;
          leaderboardList.replaceChildren(message);
        } else {
          topScores.forEach((entry, idx) => {
            const rankIcons = ['🥇', '🥈', '🥉'];
            const rankDisplay = idx < 3 ? rankIcons[idx] : `${idx + 1}.`;
            const heroIds: Record<string, CharacterId> = {
              'Operator 01': 'marcin', 'Operator 02': 'grzesiek', 'Operator 03': 'dawid', 'Operator 04': 'mateusz', 'Operator 05': 'piotr',
              // Legacy values are resolved internally only; the public label always comes
              // from the neutral CharacterDef name below, never from the stored old string.
              marcin: 'marcin', grzesiek: 'grzesiek', dawid: 'dawid', mateusz: 'mateusz', piotr: 'piotr',
              Marcin: 'marcin', Grzesiek: 'grzesiek', Dawid: 'dawid', Mateusz: 'mateusz', Piotr: 'piotr',
              Atlas: 'marcin', Forge: 'grzesiek', Vector: 'dawid', Volt: 'mateusz', Rook: 'piotr',
            };
            const heroId = heroIds[entry.hero];
            const heroIcon = heroId ? operatorPortrait(heroId) : '👷‍♂️';
            const bossBadge = entry.bossDefeated ? '<span title="Nadzorca Zero pokonany!">👔💥</span>' : '';
            const safePlayerName = escapeLeaderboardText(entry.playerName);
            const safeHeroName = escapeLeaderboardText(heroId ? CHARACTERS[heroId].name : 'Operator');
            const modeLabel = 'SURVIVAL';
            const modeClass = 'survival';
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
        leaderboardLoading.textContent = leaderboardList.childElementCount > 0
          ? '⚠️ Odświeżenie nie powiodło się. Zachowano ostatnio wyświetlone wyniki.'
          : '❌ Nie udało się pobrać rankingu. Sprawdź połączenie z bazą Firebase.';
        leaderboardList.classList.toggle('hidden', leaderboardList.childElementCount === 0);
        console.warn('Leaderboard error:', err);

        if (btnRefreshLeaderboard) {
          btnRefreshLeaderboard.disabled = false;
          btnRefreshLeaderboard.textContent = '🔄 Spróbuj ponownie';
        }
      } finally {
        leaderboardRenderInFlight = false;
      }
    };

    btnRefreshLeaderboard?.addEventListener('click', () => {
      renderLeaderboard();
    });

    const menuTabList = document.querySelector<HTMLElement>('.menu-tabs-bar');
    // The menu uses one vertical sidebar on desktop, tablet and mobile.
    // No viewport-dependent segment filtering is used.
    menuTabList?.setAttribute('role', 'navigation');
    menuTabList?.setAttribute('aria-label', 'Nawigacja menu głównego');
    const menuTabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-tab-btn'));
    const menuMobileSegmentButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-mobile-segment'));
    const menuNavigationGroups = Array.from(document.querySelectorAll<HTMLElement>('.menu-nav-group'));
    let currentMenuTargetId = menuTabButtons.find((button) => button.classList.contains('active'))?.getAttribute('data-tab') || 'tab-team';
    let activeMobileSegmentId: MenuSegmentId = getMenuSegmentForTab(currentMenuTargetId)?.id || 'play';
    const menuScrollMemory = new MenuScrollMemory();
    const menuContentArea = document.querySelector<HTMLElement>('.menu-tab-content-area');

    const renderSurvivalFirearmCatalogIcon = (() => {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(180, 120, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1.5, 0.1, 30);
    camera.position.set(3.1, 2.35, 4.6);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7dd3fc, 1.25);
    rim.position.set(-4, 1, -3);
    scene.add(rim);
  } catch {
    renderer?.dispose();
    renderer = null;
  }

  const renderIcon = (archetype: string, color: number): string | null => {
    if (!renderer || !scene || !camera) return null;
    const accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.38, metalness: 0.68, roughness: 0.27 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x182333, metalness: 0.78, roughness: 0.32 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.2 });
    const gun = new THREE.Group();
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, material = dark) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      gun.add(mesh);
    };
    const barrel = (radius: number, length: number, x: number, y: number, z: number, material = steel) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, length, 12), material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z);
      gun.add(mesh);
    };
    const grip = () => box(0.16, 0.34, 0.22, 0.02, -0.25, -0.12, dark);
    const stock = () => box(0.18, 0.16, 0.48, 0, 0.02, -0.48, steel);
    box(0.34, 0.2, 0.66, 0, 0, 0, dark);
    switch (archetype) {
      case 'pistol':
        barrel(0.055, 0.56, 0, 0.03, 0.56, steel);
        box(0.36, 0.11, 0.72, 0, 0.14, 0.03, steel);
        box(0.24, 0.06, 0.36, 0, -0.09, 0.36, accent);
        box(0.05, 0.06, 0.06, 0, 0.21, 0.31, glow);
        grip();
        break;
      case 'smg':
        barrel(0.052, 0.52, 0, 0.02, 0.54, steel);
        barrel(0.088, 0.42, 0, 0.02, 0.94, dark);
        box(0.22, 0.1, 0.48, 0, 0.17, -0.02, accent);
        box(0.14, 0.12, 0.24, 0, 0.26, 0.04, glow);
        box(0.15, 0.34, 0.18, 0, -0.25, 0.1, steel);
        grip();
        stock();
        break;
      case 'rifle':
        barrel(0.045, 1.06, 0, 0.02, 0.84, steel);
        barrel(0.072, 0.16, 0, 0.02, 1.38, accent);
        box(0.22, 0.14, 0.56, 0, 0.05, 0.52, dark);
        box(0.18, 0.1, 0.58, 0, 0.18, 0.08, accent);
        box(0.14, 0.26, 0.18, 0, -0.24, 0.14, steel);
        grip();
        stock();
        break;
      case 'shotgun':
        barrel(0.072, 0.98, 0, 0.05, 0.82, steel);
        barrel(0.052, 0.84, 0, -0.07, 0.74, dark);
        box(0.24, 0.18, 0.64, 0, 0.01, 0.04, accent);
        box(0.22, 0.13, 0.36, 0, -0.1, 0.56, accent);
        box(0.07, 0.12, 0.22, 0.15, 0.02, 0.04, glow);
        grip();
        stock();
        break;
      case 'heavy-rifle':
        barrel(0.068, 1.28, 0, 0.03, 0.96, steel);
        box(0.18, 0.14, 0.16, 0, 0.03, 1.56, accent);
        box(0.16, 0.16, 0.44, 0, 0.22, 0.12, accent);
        box(0.12, 0.13, 0.38, 0, 0.33, 0.05, glow);
        box(0.06, 0.24, 0.06, -0.16, -0.15, 0.72, steel);
        box(0.06, 0.24, 0.06, 0.16, -0.15, 0.72, steel);
        grip();
        stock();
        break;
      case 'minigun': {
        for (let n = 0; n < 6; n++) {
          const angle = (n / 6) * Math.PI * 2;
          barrel(0.034, 1.12, Math.cos(angle) * 0.11, 0.03 + Math.sin(angle) * 0.11, 0.9, n % 2 ? accent : steel);
        }
        barrel(0.16, 0.12, 0, 0.03, 1.32, dark);
        box(0.46, 0.27, 0.58, 0, 0, -0.05, dark);
        box(0.26, 0.12, 0.36, 0, 0.22, -0.08, accent);
        const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.28, 16), accent);
        ammoDrum.rotation.z = Math.PI / 2;
        ammoDrum.position.set(0, -0.26, 0.08);
        gun.add(ammoDrum);
        grip();
        break;
      }
      case 'rocket':
        barrel(0.17, 1.28, 0, 0.03, 0.8, dark);
        barrel(0.22, 0.14, 0, 0.03, 1.42, accent);
        barrel(0.19, 0.12, 0, 0.03, -0.45, steel);
        box(0.12, 0.15, 0.3, -0.21, 0.12, 0.42, glow);
        stock();
        box(0.32, 0.18, 0.3, 0, -0.17, 0.08, steel);
        break;
      case 'flame':
        barrel(0.11, 0.78, 0, 0.02, 0.72, steel);
        barrel(0.14, 0.12, 0, 0.02, 1.12, glow);
        box(0.26, 0.34, 0.36, -0.28, 0.03, -0.08, accent);
        box(0.26, 0.34, 0.36, 0.28, 0.03, -0.08, accent);
        box(0.14, 0.12, 0.34, 0, 0.16, 0.58, dark);
        grip();
        break;
      case 'plasma':
        barrel(0.085, 0.92, 0, 0.04, 0.78, glow);
        box(0.32, 0.24, 0.52, 0, 0.12, 0.08, accent);
        box(0.4, 0.08, 0.24, 0, 0.26, 0.04, glow);
        box(0.14, 0.18, 0.34, 0, 0.04, 0.82, dark);
        grip();
        stock();
        break;
      case 'grenade': {
        barrel(0.105, 1.02, 0, 0.04, 0.82, steel);
        box(0.34, 0.22, 0.56, 0, 0.02, 0.05, dark);
        box(0.25, 0.13, 0.31, 0, 0.21, 0.04, accent);
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.28, 18), accent);
        drum.rotation.z = Math.PI / 2;
        drum.position.set(-0.23, -0.03, -0.06);
        gun.add(drum);
        barrel(0.13, 0.085, 0, 0.04, 1.35, glow);
        box(0.12, 0.1, 0.22, 0, 0.28, 0.16, glow);
        grip(); stock();
        break;
      }
      case 'gauss':
        barrel(0.042, 1.56, 0, 0.03, 1.12, glow);
        box(0.06, 0.06, 1.32, -0.11, 0.03, 0.98, steel);
        box(0.06, 0.06, 1.32, 0.11, 0.03, 0.98, steel);
        for (let n = 0; n < 5; n++) barrel(0.085, 0.075, 0, 0.03, 0.48 + n * 0.22, accent);
        box(0.24, 0.16, 0.62, 0, 0.14, 0.02, steel);
        grip();
        stock();
        break;
      default:
        barrel(0.05, 0.7, 0, 0.02, 0.62, accent); grip(); stock();
    }
    gun.rotation.set(-0.16, -0.42, 0.08);
    gun.scale.setScalar(0.78);
    scene.add(gun);
    try {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    } catch {
      return null;
    } finally {
      scene.remove(gun);
      gun.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      for (const material of [accent, dark, steel, glow]) material.dispose();
    }
  };
  const disposeRenderer = () => {
    if (!renderer) return;
    try {
      const gl = renderer.getContext();
      renderer.dispose();
      (gl?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.();
    } catch {
      // Context already lost or unavailable.
    }
    renderer = null;
    scene = null;
    camera = null;
  };
  return Object.assign(renderIcon, { dispose: disposeRenderer });
})();

// Build the armory from the same runtime definitions that drive weapon behaviour.
    // Drop-rate copy is generated from the exact policy used by the simulation.
    const firearmDropPolicyElement = document.getElementById('armory-drop-policy');
    if (firearmDropPolicyElement) {
      const policy = SURVIVAL_FIREARM_DROP_POLICY;
      const normalPercent = Math.round(policy.normalChance * 100);
      const elitePercent = Math.round(policy.eliteChance * 100);
      firearmDropPolicyElement.textContent =
        `ZRZUTY PVE • od ${policy.minimumKills} eliminacji i ${policy.unlockElapsedSeconds} s: zwykły wróg ${normalPercent}% · elita ${elitePercent}% · boss 100%. Po ${policy.pityMisses} nieudanych losowaniach następne kwalifikowane jest gwarantowane. Maks. ${policy.maximumActiveDrops} aktywny zasobnik, minimum ${policy.minimumIntervalSeconds} s między zrzutami. Każda dostępna broń ma równą szansę; pistolet startowy i aktualna broń są wykluczone.`;
    }

    const firearmCatalogGrid = document.getElementById('firearm-catalog-grid');
    if (firearmCatalogGrid && firearmCatalogGrid.dataset.rendered !== 'true') {
      firearmCatalogGrid.dataset.rendered = 'true';
      firearmCatalogGrid.setAttribute('role', 'list');
      for (const firearm of Object.values(SURVIVAL_FIREARM_DEFS)) {
        const card = document.createElement('article');
        card.className = 'armory-card';
        card.setAttribute('role', 'listitem');
        card.style.setProperty('--armory-color', '#' + firearm.color.toString(16).padStart(6, '0'));

        const header = document.createElement('div');
        header.className = 'armory-card-head';
        const iconData = renderSurvivalFirearmCatalogIcon(firearm.archetype, firearm.color);
        const icon = document.createElement(iconData ? 'img' : 'span');
        icon.className = 'armory-card-icon';
        icon.setAttribute('aria-hidden', 'true');
        if (iconData && icon instanceof HTMLImageElement) {
          icon.alt = '';
          icon.src = iconData;
        } else {
          icon.textContent = firearm.icon;
          icon.classList.add('armory-card-icon-fallback');
        }
        const heading = document.createElement('div');
        heading.className = 'armory-card-title-wrap';
        const title = document.createElement('h3');
        title.textContent = firearm.name.toUpperCase();
        const role = document.createElement('span');
        role.className = 'armory-card-role';
        const firearmRoleLabels: Record<string, string> = {
          pistol: 'BROŃ REZERWOWA',
          smg: 'KRÓTKI DYSTANS',
          rifle: 'UNIWERSALNA',
          shotgun: 'OBRAŻENIA Z BLISKA',
          'heavy-rifle': 'PRECYZJA I PRZEBICIE',
          minigun: 'KONTROLA TŁUMU',
          rocket: 'OBRAŻENIA OBSZAROWE',
          flame: 'OGIEŃ I PRESJA',
          plasma: 'ENERGIA / OBSZAR',
          gauss: 'SNIPER / PENETRACJA',
          grenade: 'BALISTYKA / OBSZAR',
        };
        role.textContent = firearmRoleLabels[firearm.archetype] || firearm.archetype.toUpperCase();
        heading.append(title, role);
        header.append(icon, heading);

        const description = document.createElement('p');
        description.className = 'armory-card-description';
        description.textContent = firearm.roleDescription;

        const balance = getSurvivalFirearmBalance(firearm);
        const damageValue = firearm.damage.toFixed(2).replace('.', ',') +
          (firearm.id === 'shotgun_12g' ? ' / śrut × ' + firearm.pellets : firearm.pellets > 1 ? ' / cząstki × ' + firearm.pellets : ' / pocisk');
        const salvoValue = balance.damagePerTrigger.toFixed(2).replace('.', ',');
        const sustainedDpsValue = balance.sustainedDirectDps.toFixed(2).replace('.', ',') + ' DPS';
        const rateValue = (1 / firearm.fireIntervalSeconds).toFixed(1).replace('.', ',') +
          (firearm.pellets > 1 ? ' salw/s' : ' strz./s');
        const burstDps = (firearm.damage * firearm.pellets) / firearm.fireIntervalSeconds;
        const dpsValue = burstDps.toFixed(1).replace('.', ',') + ' / s';
        const metrics = document.createElement('div');
        metrics.className = 'armory-card-stats';
        const metricRows: Array<[string, string]> = [
          ['OBRAŻENIA BAZOWE', damageValue],
          ['SALWA • PEŁNE TRAFIENIE', salvoValue],
          ['DPS • Z PRZEŁADOWANIEM', sustainedDpsValue],
          ['OBRAŻENIA / S', dpsValue],
          ['ZASIĘG BAZOWY', firearm.rangeMeters + ' m'],
          ['SZYBKOSTRZELNOŚĆ', rateValue],
          ['MAGAZYNEK', firearm.magazineSize + ' nab.'],
          ['PRZEŁADOWANIE', firearm.reloadSeconds.toFixed(2).replace('.', ',') + ' s'],
        ];
        for (const [label, value] of metricRows) {
          const metric = document.createElement('div');
          metric.className = 'armory-stat';
          const metricLabel = document.createElement('span');
          metricLabel.textContent = label;
          const metricValue = document.createElement('strong');
          metricValue.textContent = value;
          metric.append(metricLabel, metricValue);
          metrics.appendChild(metric);
        }

        const traits = document.createElement('div');
        traits.className = 'armory-card-traits';
        const traitLabels: string[] = [];
        if (firearm.pellets > 1) traitLabels.push(firearm.pellets + ' pocisków na salwę');
        if (firearm.pierce > 0) traitLabels.push('Przebicie: ' + firearm.pierce);
        if (firearm.aoeRadius > 0) traitLabels.push('Obszar: ' + firearm.aoeRadius.toFixed(1).replace('.', ',') + ' m');
        if (firearm.igniteOnHit) traitLabels.push('Podpalenie');
        if (traitLabels.length === 0) traitLabels.push('Pojedynczy cel');
        for (const label of traitLabels) {
          const chip = document.createElement('span');
          chip.className = 'armory-trait';
          chip.textContent = label;
          traits.appendChild(chip);
        }
        card.append(header, description, metrics, traits);
        firearmCatalogGrid.appendChild(card);
      }
    }
    renderSurvivalFirearmCatalogIcon.dispose();
    const menuRootElement = document.getElementById('title-screen');
    let setActiveMobileSegment: (segmentId: MenuSegmentId) => void = () => undefined;
    if (menuRootElement) menuRootElement.dataset.menuDensity = 'compact';

    // One persistent density control keeps long reference copy out of the way
    // until the player explicitly asks for full descriptions.
    if (menuContentArea && !menuContentArea.querySelector('.menu-density-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.className = 'menu-density-toolbar';
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', 'Gęstość informacji w menu');
      const densityLabel = document.createElement('span');
      densityLabel.className = 'menu-density-label';
      densityLabel.textContent = 'WIDOK MENU';
      const densityButton = document.createElement('button');
      densityButton.className = 'menu-density-toggle';
      densityButton.type = 'button';
      densityButton.textContent = 'PEŁNE OPISY';
      densityButton.setAttribute('aria-pressed', 'false');
      densityButton.setAttribute('aria-label', 'Pokaż pełne opisy we wszystkich sekcjach menu');
      densityButton.addEventListener('click', () => {
        const expanded = menuRootElement?.dataset.menuDensity !== 'full';
        if (menuRootElement) menuRootElement.dataset.menuDensity = expanded ? 'full' : 'compact';
        densityButton.textContent = expanded ? 'WIDOK ZWIĘZŁY' : 'PEŁNE OPISY';
        densityButton.setAttribute('aria-pressed', String(expanded));
        densityButton.setAttribute('aria-label', expanded
          ? 'Przełącz menu na widok zwięzły'
          : 'Pokaż pełne opisy we wszystkich sekcjach menu');
      });
      toolbar.append(densityLabel, densityButton);
      menuContentArea.insertBefore(toolbar, menuContentArea.firstChild);
    }

    // Operator information is split into three focused views. The existing
    // profile, combat descriptions and mastery tree remain intact in the DOM.
    const characterDetailsBox = document.getElementById('char-details-box');
    const characterViewButtons = new Map<string, HTMLButtonElement>();
    const setCharacterDetailView = (view: 'profile' | 'abilities' | 'mastery') => {
      if (!characterDetailsBox) return;
      characterDetailsBox.dataset.charView = view;
      characterViewButtons.forEach((button, id) => {
        const active = id === view;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };
    if (characterDetailsBox && !characterDetailsBox.querySelector('.char-detail-view-nav')) {
      const viewNav = document.createElement('div');
      viewNav.className = 'char-detail-view-nav';
      viewNav.setAttribute('role', 'group');
      viewNav.setAttribute('aria-label', 'Informacje o wybranym operatorze');
      const views = [
        { id: 'profile', label: 'PROFIL' },
        { id: 'abilities', label: 'ZDOLNOŚCI' },
        { id: 'mastery', label: 'MISTRZOSTWO' },
      ] as const;
      for (const view of views) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'char-detail-view-btn';
        button.textContent = view.label;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => setCharacterDetailView(view.id));
        characterViewButtons.set(view.id, button);
        viewNav.appendChild(button);
      }
      characterDetailsBox.insertBefore(viewNav, characterDetailsBox.firstChild);
      setCharacterDetailView('profile');
    }

    menuContentArea?.addEventListener('scroll', () => {
      menuScrollMemory.save(currentMenuTargetId, menuContentArea.scrollTop);
    }, { passive: true });

    const ensureMenuTabVisible = (tab: HTMLButtonElement) => {
      if (!menuTabList) return;
      const rail = menuTabList.getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      if (menuTabList.scrollHeight > menuTabList.clientHeight + 1) {
        const top = menuTabList.scrollTop + tabBounds.top - rail.top -
          Math.max(8, (menuTabList.clientHeight - tabBounds.height) / 2);
        menuTabList.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    };

    // One selected destination owns the content viewport on every device.
    // Mobile no longer expands eleven panels into one long dashboard.
    const syncMenuPanelPresentation = (targetId: string) => {
      const titleScreenRoot = document.getElementById('title-screen');
      if (titleScreenRoot) titleScreenRoot.dataset.activeMenuTab = targetId;
      menuTabList?.setAttribute('role', 'navigation');

      menuTabButtons.forEach((button) => {
        const active = button.getAttribute('data-tab') === targetId;
        button.classList.toggle('active', active);
        button.setAttribute('role', 'tab');
        button.removeAttribute('aria-pressed');
        button.setAttribute('aria-selected', String(active));
        button.setAttribute('aria-controls', button.getAttribute('data-tab') || '');
        button.tabIndex = active ? 0 : -1;
      });

      document.querySelectorAll<HTMLElement>('.tab-panel').forEach((panel) => {
        const active = panel.id === targetId;
        const controllingTab = menuTabButtons.find((button) => button.getAttribute('data-tab') === panel.id);
        panel.classList.toggle('active', active);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-hidden', String(!active));
        if (controllingTab) panel.setAttribute('aria-labelledby', controllingTab.id);
        panel.removeAttribute('aria-label');
        panel.inert = !active;
      });

      if (menuContentArea) menuContentArea.scrollTop = menuScrollMemory.restore(targetId);
    };

    document.getElementById('btn-account-cloud-sync')?.addEventListener('click', () => {
      void this.syncAccountProgressionWithCloud();
    });
    document.getElementById('btn-account-google-connect')?.addEventListener('click', () => {
      void this.connectAccountProgressionToGoogle();
    });

    const activateMenuTab = (selectedTab: HTMLButtonElement) => {
      const targetId = selectedTab.getAttribute('data-tab');
      if (!targetId) return;
      const changingTab = targetId !== currentMenuTargetId;
      if (changingTab && menuContentArea) {
        menuScrollMemory.save(currentMenuTargetId, menuContentArea.scrollTop);
      }
      currentMenuTargetId = targetId;
      const owningSegment = getMenuSegmentForTab(targetId);
      if (owningSegment) setActiveMobileSegment(owningSegment.id);
      ensureMenuTabVisible(selectedTab);

      // Clear the destination before panel sync: syncMenuPanelPresentation restores
      // scrollTop immediately. Clearing after it would leave the stale offset active
      // for this frame and make the campaign board appear far below an empty viewport.
      if (changingTab) menuScrollMemory.clear(targetId);

      // The selected section owns the accent color and mode-specific launch action.
      syncMenuPanelPresentation(targetId);
      if (changingTab && menuContentArea) menuContentArea.scrollTop = 0;

      if (targetId === 'tab-leaderboard') {
        leaderboardHasBeenOpened = true;
        renderLeaderboard();
      } else if (targetId === 'tab-achievements') {
        renderSurvivalAchievements();
      } else if (targetId === 'tab-talent-tree' || targetId === 'tab-ranks') {
        renderAccountProgressionPanels();
        void this.syncAccountProgressionWithCloud();
      }
    };

    // Keep every destination visible in the left rail at every viewport size.
    // Selecting a tab changes only its matching content panel; groups are visual
    // labels and never act as a second navigation layer.
    setActiveMobileSegment = (segmentId: MenuSegmentId) => {
      const segment = MENU_SEGMENTS.find((item) => item.id === segmentId);
      if (!segment) return;

      activeMobileSegmentId = segment.id;
      if (menuRootElement) menuRootElement.dataset.activeMenuSegment = segment.id;

      menuMobileSegmentButtons.forEach((button) => {
        const active = button.dataset.menuSegment === segment.id;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      menuNavigationGroups.forEach((group) => {
        group.hidden = false;
        group.inert = false;
        group.dataset.activeGroup = String(group.dataset.menuGroup === segment.id);
        group.setAttribute('aria-hidden', 'false');
        group.setAttribute('role', 'tablist');
        group.setAttribute('aria-orientation', 'vertical');
      });
    };

    menuMobileSegmentButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const segmentId = button.dataset.menuSegment as MenuSegmentId | undefined;
        const segment = MENU_SEGMENTS.find((item) => item.id === segmentId);
        if (!segment) return;

        setActiveMobileSegment(segment.id);
        const firstTab = menuTabButtons.find((tab) => tab.dataset.tab === segment.tabIds[0]);
        if (!firstTab) return;
        activateMenuTab(firstTab);
        firstTab.focus();
      });
    });

    menuTabButtons.forEach((tabBtn, index) => {
      const targetId = tabBtn.getAttribute('data-tab');
      tabBtn.id = tabBtn.id || (targetId ? 'menu-' + targetId : 'menu-tab-' + index);
      tabBtn.setAttribute('role', 'tab');
      if (targetId) {
        tabBtn.setAttribute('aria-controls', targetId);
        const panel = document.getElementById(targetId);
        panel?.setAttribute('role', 'tabpanel');
        panel?.setAttribute('aria-labelledby', tabBtn.id);
        panel?.setAttribute('tabindex', '0');
        panel?.setAttribute('aria-hidden', String(!panel.classList.contains('active')));
        if (panel) panel.inert = !panel.classList.contains('active');
      }
      const initiallyActive = tabBtn.getAttribute('data-tab') === currentMenuTargetId;
      tabBtn.setAttribute('aria-selected', String(initiallyActive));
      tabBtn.tabIndex = initiallyActive ? 0 : -1;

      // A native click is generated for touch input; a second touchend handler
      // caused the same selection and lazy panel work to run twice on phones.
      tabBtn.addEventListener('click', () => {
        activateMenuTab(tabBtn);
        ensureMenuTabVisible(tabBtn);
      });
      tabBtn.addEventListener('keydown', (event: KeyboardEvent) => {
        const navigationTabs = menuTabButtons;
        const currentNavigationIndex = navigationTabs.indexOf(tabBtn);
        const nextIndex = getMenuTabIndexForKey(event.key, currentNavigationIndex, navigationTabs.length, 'vertical');
        if (nextIndex === null) return;
        event.preventDefault();
        const nextTab = navigationTabs[nextIndex];
        if (!nextTab) return;
        activateMenuTab(nextTab);
        nextTab.focus();
        ensureMenuTabVisible(nextTab);
      });
    });

    setActiveMobileSegment(activeMobileSegmentId);
    syncMenuPanelPresentation(currentMenuTargetId);

    document.querySelectorAll<HTMLElement>('.char-card').forEach((card) => {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      const selectChar = (e?: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        document.querySelectorAll<HTMLElement>('.char-card').forEach((item) => {
          item.classList.remove('active');
          item.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('active');
        card.setAttribute('aria-pressed', 'true');
        setCharacterDetailView('profile');
        const charId = card.getAttribute('data-char') as CharacterId;
        if (charId) updateCharacterUI(charId);
      };
      card.setAttribute('aria-pressed', String(card.classList.contains('active')));
      card.addEventListener('click', selectChar);
      card.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectChar(event);
        }
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

    let startingGame = false;
    const doStartSurvival = async (e?: Event) => {
      if (startingGame) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Lock before waiting for assets. This prevents two rapid taps from
      // constructing duplicate Survival arenas.
      startingGame = true;
      const startButton = document.getElementById('btn-start-survival') as HTMLButtonElement | null;
      if (startButton) {
        startButton.disabled = true;
        startButton.setAttribute('aria-busy', 'true');
      }

      try {
        await assetLoader.waitUntilReady('Gra 3D');

        // Ads and consent are optional services. Never hold the Play action,
        // the scene transition or touch-control activation while a provider responds.
        void initializeGameAds()
          .then(syncAdMobSettings)
          .catch((error: unknown) => console.warn('[AdMob] Nie blokuje startu rozgrywki:', error));

        if (!this.engine || typeof this.engine.startSurvival !== 'function') {
          throw new Error('Silnik Survival Shift nie jest jeszcze gotowy.');
        }

        if (this.cinematicIntro?.isRunning()) this.cinematicIntro.stop(false, false);
        this.engine.setLevelVisible(true);

        if (titleScreen) {
          titleScreen.classList.add('hidden');
          titleScreen.style.setProperty('display', 'none', 'important');
        }
        pauseModal?.classList.add('hidden');
        gameoverModal?.classList.add('hidden');
        survivalLevelUp?.classList.add('hidden');

        hudTop?.classList.remove('hidden');
        hudBottom?.classList.remove('hidden');
        setTouchControlsMode('survival');
        setTouchControlsVisibility(true);

        this.masteryAwardedForRun = false;
        // Restore the Survival-specific ability label/icon after leaving PvP.
        updateCharacterUI(this.selectedCharId);
      this.gameSessionGeneration++;
      if (selectedCampaignStageId) {
        const chosenStage = selectedCampaignStageId;
        selectedCampaignStageId = null;
        const campaignRewardId = consumeCampaignRewardForStage(chosenStage);
        const campaignBonusXp = consumeCampaignXpBonusForStage(chosenStage);
        lastCampaignStageId = null;
        nextCampaignStageId = null;
        campaignRewardChoices = [];
        campaignRewardTargetStageId = null;
        campaignRewardSelectionId = null;
        renderCampaignRewardPanel();
        if (!this.engine.startCampaignStage(chosenStage, campaignRewardId, campaignBonusXp)) throw new Error('Nie udało się uruchomić etapu kampanii.');
      } else {
        lastCampaignStageId = null;
        nextCampaignStageId = null;
        this.engine.startSurvival();
      }
        // Re-assert visibility and exclusive mode after the scene transition.
        setTouchControlsMode('survival');
        setTouchControlsVisibility(true);
      } catch (error) {
        console.error('[Survival] Nie udało się uruchomić rozgrywki:', error);
        titleScreen?.classList.remove('hidden');
        titleScreen?.style.setProperty('display', 'flex', 'important');
        hudTop?.classList.add('hidden');
        hudBottom?.classList.add('hidden');
        setTouchControlsMode('hidden');
        setTouchControlsVisibility(false);
        let errorBanner = document.getElementById('survival-start-error');
        if (!errorBanner && titleScreen) {
          errorBanner = document.createElement('div');
          errorBanner.id = 'survival-start-error';
          errorBanner.setAttribute('role', 'alert');
          errorBanner.style.cssText = 'position:relative;z-index:10000002;max-width:min(92vw,620px);margin:12px auto;padding:12px 16px;border:1px solid rgba(248,113,113,.65);border-radius:12px;background:rgba(69,10,10,.94);color:#fee2e2;font:600 13px/1.45 system-ui,sans-serif;text-align:center;';
          titleScreen.appendChild(errorBanner);
        }
        if (errorBanner) errorBanner.textContent = 'Nie udało się uruchomić Survival. Spróbuj ponownie.';
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

    bindTap(document.getElementById('btn-open-campaign'), (event) => {
      event.preventDefault();
      const campaignTab = menuTabButtons.find((tab) => tab.getAttribute('data-tab') === 'tab-map');
      if (campaignTab) activateMenuTab(campaignTab);
    });

    bindTap(document.getElementById('btn-campaign-continue'), (event) => {
      event.preventDefault();
      if (startingGame) return;
      const unlocked = new Set(campaignProgress.unlockedStageIds);
      const allComplete = CAMPAIGN_STAGES.every((stage) => (campaignProgress.completedStages[stage.id]?.bestStars ?? 0) > 0);
      const nextStage = CAMPAIGN_STAGES.find((stage) => unlocked.has(stage.id) && !campaignProgress.completedStages[stage.id]?.bestStars)
        ?? (allComplete ? CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1] : [...CAMPAIGN_STAGES].reverse().find((stage) => unlocked.has(stage.id)))
        ?? CAMPAIGN_STAGES[0];
      if (!nextStage || !unlocked.has(nextStage.id)) return;
      selectedCampaignStageId = nextStage.id;
      void doStartSurvival(event);
    });

    bindTap(document.getElementById('btn-start-survival'), (event) => {
      if (startingGame) return;
      selectedCampaignStageId = null;
      doStartSurvival(event);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-campaign-stage]').forEach((button) => {
      bindTap(button, (event) => {
        event.preventDefault();
        if (startingGame) return;
        const id = button.dataset.campaignStage as CampaignStageId | undefined;
        if (!id || !campaignProgress.unlockedStageIds.includes(id)) return;
        selectedCampaignStageId = id;
        doStartSurvival(event);
      });
    });

    window.addEventListener('keydown', (e) => {
      if (!titleScreen || titleScreen.classList.contains('hidden')) return;
      if (e.code !== 'Enter' && e.code !== 'Space') return;

      // Let focused menu controls keep their native keyboard activation.
      // The global quick-start shortcut only applies to the non-interactive
      // title-screen background, never to Campaign or PvP buttons.
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')) return;

      selectedCampaignStageId = null;
      void doStartSurvival();
      e.preventDefault();
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
                titleScreen.style.removeProperty('display');
                titleScreen.style.setProperty('display', 'flex', 'important');
                titleScreen.style.setProperty('z-index', '1000000', 'important');
              }
    this.gameSessionGeneration++;
    this.engine.startTitle();
            },
            onStartGame: () => {
              this.engine.setLevelVisible(true);
              doStartSurvival();
            },
          });
        }

        // Keep titleScreen ready so that if the overlay is blocked by mobile adblockers
        // (such as com.hsv.freeadblockerbrowser), the player is NEVER stranded in a blank void.
        // The cinematic overlay is styled with z-index: 20000000 and solid background.
        if (titleScreen) {
          titleScreen.classList.remove('hidden');
          titleScreen.style.removeProperty('display');
          titleScreen.style.setProperty('display', 'flex', 'important');
        }
        this.cinematicIntro.start();
      } catch (error) {
        console.error('[CinematicIntro] Nie udało się uruchomić intro:', error);
        assetLoader.hide();
        this.engine?.setLevelVisible(true);
        if (titleScreen) {
          titleScreen.classList.remove('hidden');
          titleScreen.style.removeProperty('display');
          titleScreen.style.setProperty('display', 'flex', 'important');
          titleScreen.style.setProperty('z-index', '1000000', 'important');
        }
      } finally {
        cinematicIntroLaunchPending = false;
      }
    };

    // The boot sequence is in a different method scope; bridge it with a private DOM event.
    document.addEventListener('paleciaki:launch-intro', () => { void launchCinematicIntro(); }, { once: true });
    document.getElementById('btn-open-intro')?.addEventListener('click', (e) => void launchCinematicIntro(e));


    document.getElementById('btn-attack')?.addEventListener('click', () => {
      // In PvP this dock slot is rebound to the one-shot timing fire action.
      // Survival keeps its original direct attack.
      if (this.engine.getGameMode() !== 'pvp') this.engine.triggerAttack();
    });

    document.getElementById('btn-survival-reload')?.addEventListener('click', () => {
      this.engine.requestSurvivalFirearmReload();
    });
    document.getElementById('btn-pvp-reload')?.addEventListener('click', () => {
      this.engine.requestSurvivalFirearmReload();
    });

    document.getElementById('btn-ability')?.addEventListener('click', () => {
      if (this.engine.getGameMode() === 'pvp') {
        this.engine.triggerPvpAbility();
      } else {
        this.engine.triggerAbility();
      }
    });

    const zoomSlider = document.getElementById('cam-zoom-slider') as HTMLInputElement | null;
    if (zoomSlider) {
      zoomSlider.value = this.engine.getCamZoomFactor().toFixed(2);
      zoomSlider.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        this.engine.setCamZoomFactor(val);
      });
    }

    // Two-finger pinch zoom works directly on the 3D playfield. It is intentionally
    // disabled in PvP, where the camera auto-frames both duelists and their arena.
    const pinchPointers = new Map<number, { x: number; y: number }>();
    let lastPinchDistance = 0;
    const getPinchDistance = (): number => {
      const points = [...pinchPointers.values()];
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    const resetPinchZoom = () => {
      pinchPointers.clear();
      lastPinchDistance = 0;
    };
    const pinchTarget = document.getElementById('game-canvas-container');
    if (pinchTarget) {
      pinchTarget.addEventListener('pointerdown', (event: PointerEvent) => {
        if (event.pointerType !== 'touch' || this.engine.getGameState() !== 'playing' ||
            this.engine.getGameMode() === 'pvp') return;
        pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinchPointers.size === 2) lastPinchDistance = getPinchDistance();
      }, { passive: true });

      window.addEventListener('pointermove', (event: PointerEvent) => {
        const point = pinchPointers.get(event.pointerId);
        if (!point) return;
        point.x = event.clientX;
        point.y = event.clientY;
        if (pinchPointers.size < 2 || this.engine.getGameState() !== 'playing' ||
            this.engine.getGameMode() === 'pvp') return;
        const distance = getPinchDistance();
        if (lastPinchDistance > 0 && distance > 0) {
          const delta = THREE.MathUtils.clamp((lastPinchDistance - distance) * 0.0028, -0.08, 0.08);
          if (Math.abs(delta) >= 0.004) {
            const nextZoom = this.engine.getCamZoomFactor() + delta;
            this.engine.setCamZoomFactor(nextZoom);
            if (zoomSlider) zoomSlider.value = this.engine.getCamZoomFactor().toFixed(2);
          }
        }
        lastPinchDistance = distance;
        if (event.cancelable) event.preventDefault();
      }, { passive: false });

      const finishPinchPointer = (event: PointerEvent) => {
        if (!pinchPointers.delete(event.pointerId)) return;
        lastPinchDistance = pinchPointers.size === 2 ? getPinchDistance() : 0;
      };
      window.addEventListener('pointerup', finishPinchPointer, { passive: true });
      window.addEventListener('pointercancel', finishPinchPointer, { passive: true });
      window.addEventListener('blur', resetPinchZoom);
      window.addEventListener('pagehide', resetPinchZoom);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetPinchZoom();
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


    const activeTouchMode = (): TouchControlsMode =>
      this.engine.getGameMode() === 'pvp' ? 'pvp' : 'survival';

    const handlePause = () => {
      if (this.engine.getGameState() !== 'playing') return;
      this.resetTouchJoystick?.();
      this.engine.togglePause();
      setTouchControlsVisibility(false);
      pauseModal?.classList.remove('hidden');
      pauseModal?.setAttribute('aria-hidden', 'false');
      pauseModal?.style.setProperty('display', 'flex', 'important');
      pauseModal?.style.setProperty('z-index', '2147483012', 'important');

      const isPvp = this.engine.getGameMode() === 'pvp';
      const restartButton = document.getElementById('btn-restart-pause');
      restartButton?.classList.toggle('hidden', isPvp);
      const pauseDescription = pauseModal?.querySelector<HTMLElement>('.modal-desc');
      if (pauseDescription) {
        pauseDescription.textContent = isPvp && !(this.pvpSession?.isLocalBot)
          ? 'Lokalny ekran został wstrzymany. W pojedynku online przeciwnik i serwer mogą nadal wykonywać ruchy.'
          : 'Rozgrywka jest wstrzymana. Wznów ją, rozpocznij próbę od nowa albo wróć do menu.';
      }
      (document.getElementById('btn-resume') as HTMLButtonElement | null)?.focus();
    };
    bindTap(document.getElementById('btn-top-pause'), handlePause);
    bindTap(document.getElementById('btn-pause'), handlePause);
    bindTap(document.getElementById('btn-touch-pause'), handlePause);

    // Campaign briefing UI has been retired; Survival is the only playable mode.

    bindTap(document.getElementById('btn-resume'), () => {
      if (this.engine.getGameState() !== 'paused') return;
      this.engine.togglePause();
      pauseModal?.classList.add('hidden');
      pauseModal?.setAttribute('aria-hidden', 'true');
      pauseModal?.style.removeProperty('display');
      const restartButton = document.getElementById('btn-restart-pause');
      restartButton?.classList.toggle('hidden', this.engine.getGameMode() === 'pvp');
      setTouchControlsMode(activeTouchMode());
      setTouchControlsVisibility(true);
    });

    bindTap(document.getElementById('btn-restart-pause'), () => {
      if (this.engine.getGameMode() !== 'survival') return;
      pauseModal?.classList.add('hidden');
      pauseModal?.setAttribute('aria-hidden', 'true');
      pauseModal?.style.removeProperty('display');
      survivalLevelUp?.classList.add('hidden');
      setTouchControlsMode('survival');
      this.masteryAwardedForRun = false;
      this.gameSessionGeneration++;
      this.engine.startSurvival();
      setTouchControlsMode('survival');
      setTouchControlsVisibility(true);
    });

    const exitPausedRunToMenu = () => {
      const leavingPvp = this.engine.getGameMode() === 'pvp';
      const networkNotice = document.getElementById('pvp-network-status');
      networkNotice?.classList.add('hidden');
      networkNotice?.setAttribute('aria-hidden', 'true');
      if (networkNotice) networkNotice.dataset.state = 'hidden';
      pauseModal?.classList.add('hidden');
      pauseModal?.setAttribute('aria-hidden', 'true');
      pauseModal?.style.removeProperty('display');
      hudPerksRow?.classList.add('hidden');
      survivalHud?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      setTouchControlsMode('hidden');
      hudTop?.classList.add('hidden');
      hudBottom?.classList.add('hidden');
      document.getElementById('pvp-hud')?.classList.add('hidden');
      setTouchControlsVisibility(false);
      if (leavingPvp) {
        this.pvpSession?.dispose();
        this.pvpSession = null;
        this.engine.exitPvp();
      }
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      this.gameSessionGeneration++;
      this.engine.startTitle();
    };
    bindTap(document.getElementById('btn-menu-pause'), exitPausedRunToMenu);

    bindTap(document.getElementById('btn-retry'), () => {
      if (this.lastMode !== 'survival') return;
      gameoverModal?.classList.add('hidden');
      gameoverModal?.setAttribute('aria-hidden', 'true');
      survivalLevelUp?.classList.add('hidden');
      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      setTouchControlsVisibility(true);
      setTouchControlsMode('survival');
      this.masteryAwardedForRun = false;
      this.gameSessionGeneration++;
      const retryStageId = nextCampaignStageId ?? lastCampaignStageId;
      if (retryStageId) {
        const campaignRewardId = consumeCampaignRewardForStage(retryStageId);
        const campaignBonusXp = consumeCampaignXpBonusForStage(retryStageId);
        this.engine.startCampaignStage(retryStageId, campaignRewardId, campaignBonusXp);
        nextCampaignStageId = null;
        campaignRewardChoices = [];
        campaignRewardTargetStageId = null;
        campaignRewardSelectionId = null;
        renderCampaignRewardPanel();
      } else {
        this.engine.startSurvival();
      }
        // Re-assert visibility and exclusive mode after the scene transition.
        setTouchControlsMode('survival');
        setTouchControlsVisibility(true);
    });

    bindTap(document.getElementById('btn-menu-gameover'), () => {
      gameoverModal?.classList.add('hidden');
      gameoverModal?.setAttribute('aria-hidden', 'true');
      if (this.engine.getGameMode() === 'pvp') {
        document.getElementById('pvp-hud')?.classList.add('hidden');
        this.engine.exitPvp();
        this.pvpSession = null;
      }
      survivalHud?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      setTouchControlsMode('hidden');
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      this.gameSessionGeneration++;
      this.engine.startTitle();
      // Campaign results promise a direct route back to the stage board.
      // Reuse the existing menu activation path so desktop tabs, mobile
      // overview scrolling and ARIA/inert state stay synchronized.
      if (lastCampaignStageId) {
        const campaignMapTab = menuTabButtons.find((button) => button.getAttribute('data-tab') === 'tab-map');
        if (campaignMapTab) activateMenuTab(campaignMapTab);
      }
      void showInterstitialAfterRun();
    });

    const bindScoreSubmission = (buttonId: string, inputId: string, feedbackId: string) => {
      const submitBtn = document.getElementById(buttonId) as HTMLButtonElement | null;
      const nickInput = document.getElementById(inputId) as HTMLInputElement | null;
      const feedbackMsg = document.getElementById(feedbackId);

      submitBtn?.addEventListener('click', async () => {
        const submittedMode = this.lastMode;
        const submittedScore = this.lastScore;
        const submittedCoins = this.lastCoins;
        const submittedTimeSeconds = this.lastTimeSeconds;
        const submittedBossDefeated = this.lastBossDefeated;
        const submittedCharacterId = this.selectedCharId;
        if (submittedMode === 'pvp') {
          if (feedbackMsg) {
            feedbackMsg.className = 'submit-feedback';
            feedbackMsg.textContent = 'Wyniki PvP są zapisywane w osobnym podsumowaniu pojedynku, nie w rankingu Survival.';
            feedbackMsg.classList.remove('hidden');
          }
          return;
        }
        const playerName = nickInput?.value.trim().slice(0, 32) ||
          `Kierownik ${CHARACTERS[submittedCharacterId].name}`;
        try { localStorage.setItem('maxfliz_player_nick', playerName); } catch { /* private browsing */ }

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ ZAPISYWANIE...';
        if (feedbackMsg) {
          feedbackMsg.className = 'submit-feedback';
          feedbackMsg.textContent = 'Wysyłanie wyniku do rankingu Survival...';
          feedbackMsg.classList.remove('hidden');
        }

        try {
          const services = await loadFirebaseLeaderboardServices();
          const result = await services.submitScore({
            playerName,
            hero: CHARACTERS[submittedCharacterId].name,
            mode: submittedMode,
            score: submittedScore,
            coins: submittedCoins,
            timeSeconds: submittedTimeSeconds,
            bossDefeated: submittedBossDefeated,
          });

          if (result.status === 'online') {
            submitBtn.textContent = '✅ ZAPISANO ONLINE';
            if (feedbackMsg) {
              feedbackMsg.className = 'submit-feedback success';
              feedbackMsg.textContent = 'Wynik jest już w rankingu Survival online.';
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

    // Do not initialize Firebase or fetch ranking data during game startup.
    // The leaderboard loads on demand, and reconnect refreshes it only while open.
    window.addEventListener('online', () => {
      if (leaderboardHasBeenOpened && document.getElementById('tab-leaderboard')?.classList.contains('active')) {
        void renderLeaderboard();
      }
    });

    // One visibility owner prevents duplicate listeners from pausing the run
    // before the auto-resume flag can be set. Manual pauses remain untouched.
    document.addEventListener('visibilitychange', () => {
      const action = getVisibilityPauseAction(
        document.hidden,
        this.engine?.getGameState() ?? 'other',
      );

      if (action === 'pause') {
        this.resetTouchJoystick?.();
        this.engine.togglePause();
        setTouchControlsVisibility(false);
        pauseModal?.classList.remove('hidden');
        pauseModal?.setAttribute('aria-hidden', 'false');
        pauseModal?.style.setProperty('display', 'flex', 'important');
        pauseModal?.style.setProperty('z-index', '2147483012', 'important');
        const pauseDescription = pauseModal?.querySelector<HTMLElement>('.modal-desc');
        if (pauseDescription) {
          pauseDescription.textContent = 'Aplikacja wróciła z tła. Rozgrywka nadal jest wstrzymana — naciśnij WZNÓW GRĘ, gdy będziesz gotowy.';
        }
      }
      // Returning to the app never resumes combat by itself. The explicit
      // WZNÓW action protects a player who only switched back to check a message.
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
      titleScreen.style.removeProperty('display');
      titleScreen.style.setProperty('display', 'flex', 'important');
      titleScreen.style.setProperty('z-index', '1000000', 'important');
    }
    this.gameSessionGeneration++;
    this.engine.startTitle();
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
    const pvpAimZone = document.getElementById('pvp-aim-zone');
    const pvpAimBase = document.getElementById('pvp-aim-base');
    const pvpAimKnob = document.getElementById('pvp-aim-knob');
    if (!joystickZone || !joystickBase || !joystickKnob) return;

    // A floating, radial joystick. Pointer capture keeps the stick attached to the
    // original finger even when it moves outside the activation zone.
    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let maxRadius = 38;
    const getJoystickRadius = () => {
      const baseRect = joystickBase.getBoundingClientRect();
      const knobRect = joystickKnob.getBoundingClientRect();
      const baseSize = Math.min(baseRect.width || 148, baseRect.height || 148);
      const knobSize = Math.min(knobRect.width || 60, knobRect.height || 60);
      return Math.max(24, Math.min(64, (baseSize - knobSize) * 0.5 - 7));
    };

    const resetJoystick = () => {
      const pointerId = activePointerId;
      activePointerId = null;
      joystickBase.classList.remove('active');
      joystickKnob.style.transform = 'translate(-50%, -50%)';
      this.engine.setVirtualInput(0, 0);
      if (pointerId !== null) {
        try {
          if (joystickZone.hasPointerCapture(pointerId)) joystickZone.releasePointerCapture(pointerId);
        } catch {
          // Capture may already have been released by pointerup/pointercancel.
        }
      }
    };
    this.resetTouchJoystick = resetJoystick;

    // Keep pause inside the right action dock so it cannot float over the
    // aim pad, top HUD or gameplay view on short phone screens.
    const touchActionDock = document.querySelector<HTMLElement>('#touch-controls .touch-actions-zone');
    const touchPauseButton = document.getElementById('btn-touch-pause');
    if (touchActionDock && touchPauseButton && touchPauseButton.parentElement !== touchActionDock) {
      touchActionDock.appendChild(touchPauseButton);
    }

    // Independent right-thumb aim stick for PvP. Movement and aiming use
    // separate pointer IDs, so both thumbs can be active at the same time.
    if (pvpAimZone && pvpAimBase && pvpAimKnob) {
      let activeAimPointerId: number | null = null;
      let aimCenterX = 0;
      let aimCenterY = 0;
      let aimRadius = 42;

      const resetAimStick = () => {
        const pointerId = activeAimPointerId;
        activeAimPointerId = null;
        pvpAimKnob.style.transform = 'translate(-50%, -50%)';
        if (pointerId !== null) {
          try {
            if (pvpAimZone.hasPointerCapture(pointerId)) pvpAimZone.releasePointerCapture(pointerId);
          } catch {
            // The pointer may already have been released or cancelled by Android.
          }
        }
      };

      const handleAimStart = (event: PointerEvent) => {
        if (activeAimPointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        activeAimPointerId = event.pointerId;
        const rect = pvpAimBase.getBoundingClientRect();
        aimCenterX = rect.left + rect.width * 0.5;
        aimCenterY = rect.top + rect.height * 0.5;
        const knobRect = pvpAimKnob.getBoundingClientRect();
        aimRadius = Math.max(20, Math.min(52, (Math.min(rect.width, rect.height) - Math.min(knobRect.width, knobRect.height)) * 0.5 - 5));
        try {
          pvpAimZone.setPointerCapture(event.pointerId);
        } catch {
          // Window-level handlers below provide the fallback path.
        }
        handleAimMove(event);
        if (event.cancelable) event.preventDefault();
      };

      const handleAimMove = (event: PointerEvent) => {
        if (activeAimPointerId !== event.pointerId) return;
        const dx = event.clientX - aimCenterX;
        const dy = event.clientY - aimCenterY;
        const distance = Math.hypot(dx, dy);
        const scale = distance > aimRadius ? aimRadius / Math.max(0.001, distance) : 1;
        const knobX = dx * scale;
        const knobY = dy * scale;
        pvpAimKnob.style.transform =
          `translate(calc(-50% + ${knobX.toFixed(1)}px), calc(-50% + ${knobY.toFixed(1)}px))`;
        this.engine.setPvpAimStickInput(knobX / aimRadius, -knobY / aimRadius);
        if (event.cancelable) event.preventDefault();
      };

      const handleAimEnd = (event: PointerEvent) => {
        if (activeAimPointerId !== event.pointerId) return;
        resetAimStick();
      };

      pvpAimZone.addEventListener('pointerdown', handleAimStart, { passive: false });
      pvpAimZone.addEventListener('lostpointercapture', (event) => {
        if (activeAimPointerId === event.pointerId) resetAimStick();
      });
      window.addEventListener('pointermove', handleAimMove, { passive: false });
      window.addEventListener('pointerup', handleAimEnd, { passive: true });
      window.addEventListener('pointercancel', handleAimEnd, { passive: true });
      window.addEventListener('blur', resetAimStick);
      window.addEventListener('pagehide', resetAimStick);
      window.addEventListener('resize', resetAimStick, { passive: true });
      window.visualViewport?.addEventListener('resize', resetAimStick, { passive: true });
      // Some Android fullscreen transitions change the visible surface without
      // dispatching resize; never leave the right-thumb aim input latched.
      document.addEventListener('fullscreenchange', resetAimStick);
      document.addEventListener('webkitfullscreenchange', resetAimStick);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetAimStick();
      });
    }

    const handleStart = (event: PointerEvent) => {
      if (activePointerId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      activePointerId = event.pointerId;
      maxRadius = getJoystickRadius();

      const touchLayer = document.getElementById('touch-controls');
      const viewportWidth = Math.max(1, window.visualViewport?.width || window.innerWidth);
      const viewportHeight = Math.max(1, window.visualViewport?.height || window.innerHeight);
      const baseRect = joystickBase.getBoundingClientRect();
      const joystickSize = Math.min(baseRect.width || 148, baseRect.height || 148);
      const isPvpTouch = touchLayer?.classList.contains('manual-aim-mode') === true;
      const fireControlWrapper = document.getElementById('pvp-fire-control');
      const measuredFireSize = fireControlWrapper?.getBoundingClientRect().width || 0;
      const fireControlSize = Math.max(58, Math.min(
        88,
        measuredFireSize || Math.min(viewportWidth * 0.20, viewportHeight * 0.22),
      ));
      const origin = clampTouchJoystickOrigin({
        viewportWidth,
        viewportHeight,
        mode: isPvpTouch ? 'pvp' : 'survival',
        touchX: event.clientX,
        touchY: event.clientY,
        joystickSize,
        fireButtonSize: fireControlSize,
        fireGap: 10,
        topHudClearance: 88,
        safeBottom: 12,
        reserveFireButton: false,
      });
      startX = origin.x;
      startY = origin.y;

      // In PvP the primary shot sits directly above the active movement stick,
      // shifted slightly left so both thumbs have independent, comfortable lanes.
      if (isPvpTouch) {
        const fireControl = document.getElementById('pvp-fire-control') as HTMLElement | null;
        if (fireControl) {
          const fireSize = fireControlSize;
          const fireLeft = Math.max(12, Math.min(
            viewportWidth - fireSize - 12,
            startX - fireSize * 0.5 - 14,
          ));
          const fireTop = Math.max(88, Math.min(
            viewportHeight - fireSize - 12,
            startY - joystickSize * 0.5 - 10 - fireSize,
          ));
          fireControl.style.setProperty('position', 'fixed', 'important');
          fireControl.style.setProperty('left', `${fireLeft}px`, 'important');
          fireControl.style.setProperty('right', 'auto', 'important');
          fireControl.style.setProperty('top', `${fireTop}px`, 'important');
          fireControl.style.setProperty('bottom', 'auto', 'important');
          fireControl.style.setProperty('transform', 'none', 'important');
        }
      }

      joystickBase.style.left = `${startX}px`;
      joystickBase.style.top = `${startY}px`;
      joystickBase.classList.add('active');
      joystickKnob.style.transform = 'translate(-50%, -50%)';
      this.engine.setVirtualInput(0, 0);

      try {
        joystickZone.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; the window listeners remain as a fallback.
      }
      if (event.cancelable) event.preventDefault();
    };

    const handleMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const distance = Math.hypot(dx, dy);
      const visualDistance = Math.min(distance, maxRadius);
      const visualScale = distance > 0 ? visualDistance / distance : 0;
      const knobX = dx * visualScale;
      const knobY = dy * visualScale;

      joystickKnob.style.transform =
        `translate(calc(-50% + ${knobX.toFixed(1)}px), calc(-50% + ${knobY.toFixed(1)}px))`;
      const input = calculateVirtualJoystickInput(dx, dy, maxRadius);
      this.engine.setVirtualInput(input.x, input.y);
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
    window.addEventListener('pagehide', resetJoystick);
    // Android fullscreen and orientation changes can resize the visual viewport
    // without reliably delivering pointercancel; never leave movement stuck.
    const resetTouchViewportLayout = () => {
      resetJoystick();
      resetPvpFireControlPosition();
    };
    window.addEventListener('resize', resetTouchViewportLayout, { passive: true });
    window.addEventListener('orientationchange', resetTouchViewportLayout);
    window.visualViewport?.addEventListener('resize', resetTouchViewportLayout, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetTouchViewportLayout();
    });


    // PvP aim is a world-space timing sweep around the operator. Tap STRZAŁ
    // when the moving arrow crosses the opponent's firing lane.

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
    this.setupPvpLobby();
  }

  init() {
    // 1. Particle System Setup (soft glowing warehouse motes)
    const geometry = new THREE.BufferGeometry();
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0xf59e0b),
      new THREE.Color(0xfef3c7),
      new THREE.Color(0x38bdf8),
    ];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 95;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 65;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 95;
      const swatch = palette[i % palette.length];
      colors[i * 3] = swatch.r;
      colors[i * 3 + 1] = swatch.g;
      colors[i * 3 + 2] = swatch.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      map: getSoftGlowTexture(),
      vertexColors: true,
      size: 0.34,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
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
    this.gameSessionGeneration++;
    this.engine.startTitle();
    // Apply the initial viewport profile immediately; waiting for the next
    // resize event leaves portrait devices with the desktop camera distance.
    this.engine.applyAutoCameraScaleForViewport();

    // The selective bloom hook uses XR Blocks' supported scene-render override.
    // Non-WebGL backends retain their normal render path.
    const core = xb.core;
    const isSoftwareGpu = renderer ? isSoftwareWebGLRenderer(renderer) : false;
    if (renderer && core && scene && !isSoftwareGpu && currentDeviceRenderProfile(width).bloomEnabled && renderer.extensions.has('EXT_color_buffer_float')) {
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
            // Selective bloom adds a second scene pass; Survival uses a stricter FPS gate.
            const isSurvival = this.engine?.getGameMode() === 'survival';
            // Survival keeps its glow only while measured frame rate has enough headroom.
            pipeline.render(activeCamera, this.currentFps, performance.now(), isSurvival);
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
      const renderProfile = currentDeviceRenderProfile(width);
      root.dataset.renderTier = renderProfile.tier;
      const isSurvival = this.engine?.getGameMode() === 'survival';
      const dprCap = isSurvival ? renderProfile.survivalPixelRatioCap : renderProfile.pixelRatioCap;
      renderer.setPixelRatio(Math.max(0.78, Math.min(window.devicePixelRatio || 1, dprCap) * this.adaptiveRenderScale));
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
    const dt = Math.min(Math.max(rawDt || 0.016, 0.001), 0.05);

    // 1. Particle System Rotation (from top update)
    if (this.particleSystem) {
      const gameState = this.engine?.getGameState() || 'title';
      if (gameState === 'title') {
        this.particleSystem.visible = true;
        this.particleSystem.rotation.y += dt * 0.045;
        this.particleSystem.rotation.x += dt * 0.015;
        this.particleSystem.position.y = Math.sin(this.lastLoopTick * 0.0007) * 0.45;
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
    if (now - this.lastAdaptiveQualityAt < 1000) return;
    this.lastAdaptiveQualityAt = now;

    const renderer = (xb.core?.renderer as THREE.WebGLRenderer) || null;
    if (!renderer) return;

    const width = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth));
    const height = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight));
    const renderProfile = currentDeviceRenderProfile(width);
    document.documentElement.dataset.renderTier = renderProfile.tier;
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

    // Crowd and particle load are throttled separately from resolution. This
    // helps mobile CPUs during packed waves without blurring the whole image.
    const effectsRecoveryFloor = this.adaptiveEffectsTier >= 2 ? 47 : 54;
    if (this.adaptiveEffectsTier > 0 && this.smoothedFps >= effectsRecoveryFloor) {
      if (this.adaptiveEffectsRecoverySince === 0) this.adaptiveEffectsRecoverySince = now;
    } else {
      this.adaptiveEffectsRecoverySince = 0;
    }
    const effectsStableMs = this.adaptiveEffectsRecoverySince > 0
      ? now - this.adaptiveEffectsRecoverySince
      : 0;
    const nextEffectsTier = getAdaptiveEffectsTier(
      this.smoothedFps,
      isMobile,
      this.adaptiveEffectsTier,
      effectsStableMs
    );
    if (nextEffectsTier !== this.adaptiveEffectsTier) {
      this.adaptiveEffectsTier = nextEffectsTier;
      this.adaptiveEffectsRecoverySince = 0;
      this.engine?.setAdaptivePerformanceTier(nextEffectsTier);
    }

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

    const deviceCap = isMobile
      ? (isSurvival ? renderProfile.survivalPixelRatioCap : renderProfile.pixelRatioCap)
      : renderProfile.pixelRatioCap;
    const targetDpr = Math.max(0.78, Math.min(window.devicePixelRatio || 1, deviceCap) * nextScale);

    // Drawing-buffer changes are deliberately infrequent and only happen at
    // meaningful tier transitions, never on individual FPS samples.
    if (!shouldApplyPixelRatioChange(renderer.getPixelRatio(), targetDpr)) return;
    renderer.setPixelRatio(targetDpr);
    renderer.setSize(width, height, false);
    this.selectiveBloom?.resize(width, height, renderer.getPixelRatio());
  }

  /**
   * Sample WebGLRenderer.info in bounded one-second windows. autoReset=false
   * lets Three.js include every pass (including selective bloom) in the same
   * window; reset() is called here, not per-frame. Metrics stay local in DOM
   * data attributes and are intended for QA/devtools, never uploaded.
   */
  private updateRenderDiagnostics(now: number) {
    const candidate = xb.core?.renderer;
    const renderer = candidate instanceof THREE.WebGLRenderer ? candidate : null;
    if (!renderer) return;

    if (renderer !== this.telemetryRenderer) {
      this.telemetryRenderer = renderer;
      renderer.info.autoReset = false;
      renderer.info.reset();
      this.renderTelemetryFrames = 0;
      this.lastRenderTelemetryAt = now;
    }

    this.renderTelemetryFrames++;
    if (now - this.lastRenderTelemetryAt < 1000) return;

    const metrics = summarizeRenderWindowMetrics(renderer.info, this.renderTelemetryFrames);
    const root = document.documentElement;
    root.dataset.gpuCallsPerFrame = metrics.callsPerFrame.toFixed(1);
    root.dataset.gpuTrianglesPerFrame = metrics.trianglesPerFrame.toFixed(1);
    root.dataset.gpuLinesPerFrame = metrics.linesPerFrame.toFixed(1);
    root.dataset.gpuPointsPerFrame = metrics.pointsPerFrame.toFixed(1);
    root.dataset.gpuGeometries = String(metrics.geometries);
    root.dataset.gpuTextures = String(metrics.textures);
    root.dataset.gpuSampleFrames = String(this.renderTelemetryFrames);

    // Clear accumulated counters once per diagnostic window. The renderer's
    // automatic reset remains disabled so multiple passes are included.
    renderer.info.reset();
    this.renderTelemetryFrames = 0;
    this.lastRenderTelemetryAt = now;
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
    this.updateRenderDiagnostics(now);

    try {
      if (this.cinematicIntro && this.cinematicIntro.isRunning()) {
        // Cinematic intro owns a throttled Canvas RAF; skip the hidden 3D game update.
      } else if (this.engine) {
        this.engine.update(dt);
      }
      (this as any)._updateToasts?.(dt);
    } catch (err) {
      console.warn('Loop Error:', err);
    }
  }

  private setupPvpLobby() {
    let matchmakingSession: PvpNetworkSession | null = null;
    const btnOpenPvp = document.getElementById('btn-open-pvp');
    const pvpLobbyModal = document.getElementById('pvp-lobby-modal');
    const btnClosePvpLobby = document.getElementById('btn-close-pvp-lobby');
    const onlineHint = document.getElementById('pvp-online-hint');
    const onlineReady = Boolean(import.meta.env.VITE_PVP_WS_URL?.trim() || 'wss://paleciaki-pvp.onrender.com/pvp-ws');
    const createRoomButton = document.getElementById('btn-pvp-create-room') as HTMLButtonElement | null;
    const joinRoomButton = document.getElementById('btn-pvp-join-room') as HTMLButtonElement | null;
    if (onlineHint) {
      onlineHint.textContent = onlineReady
        ? 'Serwer WSS skonfigurowany. Możesz tworzyć pokoje i dołączać kodem.'
        : 'PvP online jest wyłączone: strona GitHub Pages nie hostuje serwera WSS. Trening z botem działa lokalnie.';
      onlineHint.classList.toggle('is-online-ready', onlineReady);
      onlineHint.classList.toggle('is-online-unavailable', !onlineReady);
    }
    if (createRoomButton) {
      createRoomButton.disabled = !onlineReady;
      createRoomButton.title = onlineReady ? 'Utwórz pokój online' : 'Wymagany osobny serwer WSS';
    }
    if (joinRoomButton) {
      joinRoomButton.disabled = !onlineReady;
      joinRoomButton.title = onlineReady ? 'Dołącz do pokoju online' : 'Wymagany osobny serwer WSS';
    }
    const titleScreen = document.getElementById('title-screen');
    const hudTop = document.getElementById('hud-top');
    const hudBottom = document.getElementById('hud-bottom');
    const survivalHud = document.getElementById('survival-hud');
    const bossHudBar = document.getElementById('boss-hud-bar');
    const hudPerksRow = document.getElementById('hud-perks-row');
    const pvpHud = document.getElementById('pvp-hud');
    const touchControls = document.getElementById('touch-controls');
    const gameShell = document.getElementById('game-shell');

    const opPicker = document.getElementById('pvp-operator-picker');
    const nickInput = document.getElementById('pvp-nickname-input') as HTMLInputElement | null;

    const btnStartBot = document.getElementById('btn-pvp-start-bot');
    const btnFindMatch = document.getElementById('btn-pvp-find-match') as HTMLButtonElement | null;
    const btnCancelMatch = document.getElementById('btn-pvp-cancel-match') as HTMLButtonElement | null;
    const btnCreateRoom = document.getElementById('btn-pvp-create-room');
    const btnJoinRoom = document.getElementById('btn-pvp-join-room');
    const joinCodeInput = document.getElementById('pvp-join-code-input') as HTMLInputElement | null;
    const joinStatus = document.getElementById('pvp-join-status');
    const createdRoomInfo = document.getElementById('pvp-created-room-info');
    const displayRoomCode = document.getElementById('pvp-display-room-code');
    const hostStatus = document.getElementById('pvp-host-status');
    const readyBar = document.getElementById('pvp-ready-bar');
    const readyBtn = document.getElementById('btn-pvp-toggle-ready') as HTMLButtonElement | null;
    const lobbyPlayersStatus = document.getElementById('pvp-lobby-players-status');
    const pvpConnectionStatus = document.getElementById('pvp-connection-status');
    const pvpConnectionTitle = document.getElementById('pvp-connection-title');
    const pvpConnectionDetail = document.getElementById('pvp-connection-detail');
    const pvpNetworkStatus = document.getElementById('pvp-network-status');
    const setPvpNetworkStatus = (state: 'hidden' | 'reconnecting' | 'failed', message = '') => {
      if (!pvpNetworkStatus) return;
      pvpNetworkStatus.textContent = message;
      pvpNetworkStatus.dataset.state = state;
      const hidden = state === 'hidden';
      pvpNetworkStatus.classList.toggle('hidden', hidden);
      pvpNetworkStatus.setAttribute('aria-hidden', String(hidden));
    };
    const isActiveNetworkPvp = () =>
      this.engine.getGameMode() === 'pvp' &&
      (this.engine.getGameState() === 'playing' || this.engine.getGameState() === 'paused') &&
      this.pvpSession?.isLocalBot === false;
    const showPvpReconnectState = () => {
      if (!isActiveNetworkPvp()) return;
      setPvpNetworkStatus('reconnecting', 'UTRACONO POŁĄCZENIE • WZNOWIENIE POJEDYNKU');
    };
    const showPvpReconnectFailure = (message: string) => {
      if (!isActiveNetworkPvp()) return;
      setPvpNetworkStatus('failed', 'NIE UDAŁO SIĘ WZNOWIĆ POJEDYNKU. ' + message);
    };
    const setPvpConnectionStatus = (state: 'idle' | 'connecting' | 'connected' | 'searching' | 'waiting' | 'matched' | 'cancelled' | 'error', title: string, detail: string) => {
      if (pvpConnectionTitle) pvpConnectionTitle.textContent = title;
      if (pvpConnectionDetail) pvpConnectionDetail.textContent = detail;
      if (pvpConnectionStatus) {
        pvpConnectionStatus.className = `pvp-connection-status is-${state}`;
        pvpConnectionStatus.setAttribute('data-state', state);
      }
    };
    type MatchmakingUiPhase = 'idle' | 'searching' | 'matched' | 'busy';
    const setMatchmakingUiPhase = (phase: MatchmakingUiPhase) => {
      if (btnFindMatch) {
        btnFindMatch.disabled = phase !== 'idle' || !onlineReady;
        btnFindMatch.textContent = phase === 'searching'
          ? 'SZUKANIE PRZECIWNIKA…'
          : phase === 'matched' ? 'PRZECIWNIK ZNALEZIONY'
            : phase === 'busy' ? 'POKÓJ ONLINE W TOKU' : '⚔️ SZUKAJ PRZECIWNIKA';
      }
      if (btnCancelMatch) {
        btnCancelMatch.classList.toggle('hidden', phase !== 'searching');
        btnCancelMatch.disabled = phase !== 'searching';
      }
      if (createRoomButton) createRoomButton.disabled = !onlineReady || phase !== 'idle';
      if (joinRoomButton) joinRoomButton.disabled = !onlineReady || phase !== 'idle';
      const busy = phase !== 'idle';
      const startBotButton = document.getElementById('btn-pvp-start-bot') as HTMLButtonElement | null;
      if (startBotButton) startBotButton.disabled = busy;
      if (nickInput) nickInput.disabled = busy;
      opPicker?.querySelectorAll<HTMLButtonElement>('.pvp-operator-btn').forEach((button) => { button.disabled = busy; });
    };
    setMatchmakingUiPhase('idle');

    const matchEndModal = document.getElementById('pvp-match-end-modal');
    const btnRematch = document.getElementById('btn-pvp-rematch') as HTMLButtonElement | null;
    const btnExitToMenu = document.getElementById('btn-pvp-exit-to-menu');
    const pauseModal = document.getElementById('pause-modal');
    const pvpFireButton = document.getElementById('btn-pvp-fire') as HTMLButtonElement | null;
    const desktopPvpFireButton = document.getElementById('btn-attack') as HTMLButtonElement | null;
    const pvpFireLabel = pvpFireButton?.querySelector<HTMLElement>('.pvp-fire-label') || null;
    const pvpFireState = pvpFireButton?.querySelector<HTMLElement>('.pvp-fire-state') || null;
    const desktopPvpFireLabel = desktopPvpFireButton?.querySelector<HTMLElement>('.attack-name') || null;
    const desktopPvpFireState = desktopPvpFireButton?.querySelector<HTMLElement>('.attack-hint') || null;
    const desktopPvpFireIcon = desktopPvpFireButton?.querySelector<HTMLElement>('.attack-icon') || null;
    const fireUiButtons = [pvpFireButton, desktopPvpFireButton].filter(
      (button): button is HTMLButtonElement => button !== null,
    );
    let desktopAttackPresentation: { name: string; hint: string; icon: string; title: string } | null = null;
    let pvpFireCooldownFrame = 0;
    const setFireButtonCopy = (button: HTMLButtonElement, coolingDown: boolean, secondsLeft = 0) => {
      if (button === pvpFireButton) {
        if (pvpFireLabel) pvpFireLabel.textContent = coolingDown ? 'ŁADOWANIE' : 'STRZAŁ';
        if (pvpFireState) pvpFireState.textContent = coolingDown ? `${secondsLeft.toFixed(1)} s` : 'GOTOWY';
      } else {
        if (desktopPvpFireLabel) desktopPvpFireLabel.textContent = coolingDown ? 'ŁADOWANIE' : 'STRZAŁ';
        if (desktopPvpFireState) desktopPvpFireState.textContent = coolingDown ? `${secondsLeft.toFixed(1)} s` : 'KLIK / F';
      }
    };
    const resetPvpFireButton = () => {
      if (pvpFireCooldownFrame) cancelAnimationFrame(pvpFireCooldownFrame);
      pvpFireCooldownFrame = 0;
      fireUiButtons.forEach((button) => {
        button.classList.remove('is-reloading');
        button.style.setProperty('--pvp-fire-progress', '0%');
        button.disabled = button.dataset.roundActive !== 'true';
        setFireButtonCopy(button, false);
      });
    };
    const startPvpFireCooldown = (cooldownSeconds: number) => {
      if (fireUiButtons.length === 0) return;
      if (pvpFireCooldownFrame) cancelAnimationFrame(pvpFireCooldownFrame);
      const durationMs = Math.max(120, (cooldownSeconds * this.pvpFireCooldownMultiplier + 0.075) * 1000);
      const startedAt = performance.now();
      fireUiButtons.forEach((button) => {
        button.disabled = true;
        button.classList.add('is-reloading');
        setFireButtonCopy(button, true, durationMs / 1000);
      });
      const update = (now: number) => {
        const elapsed = Math.max(0, now - startedAt);
        const remaining = Math.max(0, durationMs - elapsed);
        const progress = Math.min(1, elapsed / durationMs);
        fireUiButtons.forEach((button) => {
          button.style.setProperty('--pvp-fire-progress', (progress * 100).toFixed(1) + '%');
          if (remaining <= 0) {
            button.classList.remove('is-reloading');
            button.disabled = button.dataset.roundActive !== 'true';
            button.style.setProperty('--pvp-fire-progress', '0%');
            setFireButtonCopy(button, false);
          } else {
            setFireButtonCopy(button, true, remaining / 1000);
          }
        });
        if (remaining <= 0) {
          pvpFireCooldownFrame = 0;
          return;
        }
        pvpFireCooldownFrame = requestAnimationFrame(update);
      };
      pvpFireCooldownFrame = requestAnimationFrame(update);
    };

    // All HUD controls and result/pause dialogs share the same portal root.
    // The root switches to the fullscreen element when Android enters fullscreen.
    portalOverlayLayers();

    // Pointer, touch and keyboard activation share one debounced action. This
    // avoids relying on synthetic click delivery in Android WebViews.
    const bindPvpTap = (element: HTMLElement | null, action: () => void) => {
      if (!element) return;
      let lastActivation = 0;
      const activate = (event: Event) => {
        const now = Date.now();
        if (now - lastActivation < 350) return;
        lastActivation = now;
        if (event.cancelable && event.type !== 'click') event.preventDefault();
        event.stopPropagation();
        action();
      };
      element.addEventListener('pointerup', activate);
      element.addEventListener('touchend', activate, { passive: false });
      element.addEventListener('click', activate);
    };

    const triggerPrimaryPvpShot = () => {
      if (!this.engine.triggerPvpFire()) return;
      startPvpFireCooldown(this.pvpFirearmCooldownSeconds);
    };
    bindPvpTap(pvpFireButton, triggerPrimaryPvpShot);
    // Desktop uses the existing bottom-dock attack slot; mobile uses the
    // dedicated large fire button directly above the movement joystick.
    bindPvpTap(desktopPvpFireButton, triggerPrimaryPvpShot);

    opPicker?.querySelectorAll<HTMLButtonElement>('.pvp-operator-btn').forEach((btn) => {
      // Combat catalog owns the short selector description so menu text cannot
      // drift from the actual PvP damage, stun and defensive effects.
      const operatorId = btn.dataset.op as CharacterId | undefined;
      const operatorProfile = operatorId ? PVP_OPERATOR_PROFILES[operatorId] : undefined;
      const summary = btn.querySelector<HTMLElement>('small');
      if (operatorProfile && summary) {
        summary.textContent = operatorProfile.menuSummary;
        summary.title = operatorProfile.abilityDesc;
      }
      bindPvpTap(btn, () => {
        opPicker.querySelectorAll('.pvp-operator-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        const opId = btn.dataset.op as CharacterId;
        if (opId && CHARACTERS[opId]) {
          this.selectedPvpOperator = opId;
          sound.playSmack();
        }
      });
    });

    const openLobby = () => {
      if (!pvpLobbyModal) return;
      setTouchControlsVisibility(false);
      pvpLobbyModal.classList.remove('hidden');
      pvpLobbyModal.setAttribute('aria-hidden', 'false');
      if (!matchmakingSession && !this.pvpSession) {
        setMatchmakingUiPhase('idle');
        setPvpConnectionStatus('idle', 'ONLINE GOTOWE', 'Wybierz „Szukaj przeciwnika” albo utwórz pokój i udostępnij kod.');
      }
      (document.getElementById('btn-pvp-find-match') as HTMLButtonElement | null)?.focus();
      sound.playSmack();
    };

    const closeLobby = () => {
      pvpLobbyModal?.classList.add('hidden');
      pvpLobbyModal?.setAttribute('aria-hidden', 'true');
      setTouchControlsVisibility(false);
      if (matchmakingSession) {
        matchmakingSession.cancelMatchmaking();
        matchmakingSession = null;
      }
      if (this.pvpSession) {
        this.pvpSession.leaveRoom?.();
        this.pvpSession = null;
      }
      const findButton = document.getElementById('btn-pvp-find-match') as HTMLButtonElement | null;
      const cancelButton = document.getElementById('btn-pvp-cancel-match');
      if (findButton) {
        findButton.disabled = !onlineReady;
        findButton.textContent = '⚔️ SZUKAJ PRZECIWNIKA';
      }
      cancelButton?.classList.add('hidden');
      setMatchmakingUiPhase('idle');
      setPvpConnectionStatus('idle', 'ONLINE GOTOWE', 'Wybierz „Szukaj przeciwnika” albo utwórz pokój i udostępnij kod.');
      this.pvpLocalReady = false;
      if (readyBar) readyBar.classList.add('hidden');
      if (createdRoomInfo) createdRoomInfo.classList.add('hidden');
      if (joinStatus) joinStatus.classList.add('hidden');
    };

    bindPvpTap(btnOpenPvp, openLobby);
    bindPvpTap(btnClosePvpLobby, closeLobby);

    const applyPvpAbilityPresentation = (operatorId: CharacterId) => {
      const profile = PVP_OPERATOR_PROFILES[operatorId];
      const abilityNameElement = document.getElementById('ability-name');
      const abilityIconElement = document.getElementById('ability-icon');
      const pvpAbilityIcons: Record<CharacterId, string> = {
        marcin: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M24 5 39 11v11c0 10-6 16-15 21C15 38 9 32 9 22V11Z'/><path d='m16 24 5 5 11-12'/></svg>",
        grzesiek: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M6 31h25l7-9h5v9h-4M12 31v-9h12l7 9M16 31a4 4 0 1 0 8 0M34 31a4 4 0 1 0 8 0'/><path d='M8 13h11M14 8l5 5-5 5'/></svg>",
        dawid: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><path d='M7 13h13M7 24h19M7 35h13M22 9l8 15-8 15M31 16l9 8-9 8'/></svg>",
        mateusz: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'><circle cx='24' cy='24' r='4'/><path d='M24 5a19 19 0 0 1 0 38M24 11a13 13 0 0 1 0 26M24 5a19 19 0 0 0 0 38M24 11a13 13 0 0 0 0 26'/></svg>",
        piotr: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'><path d='m27 4-17 23h12l-2 17 18-25H26Z' fill='currentColor' stroke='none'/><path d='M7 10 4 7M41 38l3 3' opacity='.7'/></svg>",
      };
      if (abilityNameElement) {
        abilityNameElement.textContent = profile.abilityName;
        abilityNameElement.title = profile.abilityDesc;
      }
      if (abilityIconElement) {
        abilityIconElement.innerHTML = pvpAbilityIcons[operatorId];
        abilityIconElement.dataset.operatorIcon = operatorId;
        abilityIconElement.title = profile.abilityDesc;
      }
      const abilityButton = document.getElementById('btn-ability') as HTMLButtonElement | null;
      abilityButton?.setAttribute('aria-label', `${profile.abilityName}. ${profile.abilityDesc}`);
      if (abilityButton) abilityButton.title = `${profile.abilityName} — ${profile.abilityDesc} (E / Shift / przycisk)`;
    };

    const startPvpMatchUI = (session: IPvpSession, localOp: CharacterId, remoteOp: CharacterId) => {
      setPvpNetworkStatus('hidden');
      this.accountPvpAwardedForMatch = false;
      if (this.cinematicIntro?.isRunning()) this.cinematicIntro.stop(false, false);
      this.engine.setLevelVisible(true);

      if (titleScreen) {
        titleScreen.classList.add('hidden');
        titleScreen.style.setProperty('display', 'none', 'important');
      }
      pvpLobbyModal?.classList.add('hidden');
      matchEndModal?.classList.add('hidden');

      hudTop?.classList.add('hidden');
      survivalHud?.classList.add('hidden');
      bossHudBar?.classList.add('hidden');
      hudPerksRow?.classList.add('hidden');

      // The arena scoreboard is a viewport HUD, not scene content. Portal it
      // beside the already-portaled touch controls so WebGL/transform stacking
      // contexts cannot bury it behind the canvas on mobile browsers.
      if (pvpHud && pvpHud.parentElement !== document.body) {
        document.body.appendChild(pvpHud);
      }
      pvpHud?.classList.remove('hidden');
      pvpHud?.setAttribute('aria-hidden', 'false');
      hudBottom?.classList.remove('hidden');
      if (desktopPvpFireButton) {
        if (!desktopAttackPresentation) {
          desktopAttackPresentation = {
            name: desktopPvpFireLabel?.textContent || 'Atak',
            hint: desktopPvpFireState?.textContent || '[F / J / Klik]',
            icon: desktopPvpFireIcon?.innerHTML || '🥊',
            title: desktopPvpFireButton.title || '',
          };
        }
        desktopPvpFireButton.classList.add('pvp-primary-fire');
        desktopPvpFireButton.dataset.roundActive = 'false';
        desktopPvpFireButton.disabled = true;
        desktopPvpFireButton.title = 'Strzał pojedynczy • kliknij, gdy wskaźnik na łuku pokryje się z przeciwnikiem (F)';
        if (desktopPvpFireIcon) desktopPvpFireIcon.textContent = '➤';
        if (desktopPvpFireLabel) desktopPvpFireLabel.textContent = 'STRZAŁ';
        if (desktopPvpFireState) desktopPvpFireState.textContent = 'KLIK / F';
      }
      setTouchControlsVisibility(true);
      // touch-controls is portaled to body, so it needs its own mode classes.
      // Classes on #game-shell do not cascade into this detached control layer.
      setTouchControlsMode('pvp');
      const pvpAimKnob = document.getElementById('pvp-aim-knob');
      if (pvpAimKnob) pvpAimKnob.style.transform = 'translate(-50%, -50%)';
      const touchActionsZone = document.querySelector<HTMLElement>('#touch-controls .touch-actions-zone');
      const pvpFireControl = document.getElementById('pvp-fire-control');
      if (pvpFireControl && touchActionsZone && pvpFireControl.parentElement !== touchActionsZone) {
        touchActionsZone.prepend(pvpFireControl);
      }
      if (pvpFireControl) {
        for (const property of ['position', 'left', 'right', 'top', 'bottom', 'transform']) {
          pvpFireControl.style.removeProperty(property);
        }
      }
      resetPvpFireButton();
      if (pvpFireButton) {
        pvpFireButton.classList.remove('hidden');
        pvpFireButton.dataset.operator = localOp;
        pvpFireButton.dataset.roundActive = 'false';
        pvpFireButton.disabled = true;
      }

      this.engine.setManualAimMode(true);

      this.gameSessionGeneration++;
      this.engine.startPvp(session, localOp, remoteOp);
      applyPvpAbilityPresentation(localOp);
      sound.playBossWarning();
    };

    // Practice Bot Mode
    bindPvpTap(btnStartBot, () => {
      const localOp = this.selectedPvpOperator;
      const botOp: CharacterId = localOp === 'marcin' ? 'grzesiek' : localOp === 'grzesiek' ? 'dawid' : 'marcin';
      const playerNick = nickInput?.value.trim() || 'Operator B4';

      const botSession = new PvpLocalBotSession(
        localOp,
        botOp,
        playerNick,
        `${CHARACTERS[botOp].name} [BOT SI]`,
        {},
        getAccountPvpProgressionBonuses(accountProgressionProfile),
      );
      this.pvpSession = botSession;
      this.pvpLocalSlot = 'p1';

      botSession.onState = (state) => {
        this.engine.setLastPvpState(state);
      };

      startPvpMatchUI(botSession, localOp, botOp);
    });

    // Public FIFO matchmaking: the server pairs the oldest two available players.
    bindPvpTap(btnFindMatch, () => {
      if (matchmakingSession || this.pvpSession) return;
      const playerNick = nickInput?.value.trim() || 'Operator B4';
      setMatchmakingUiPhase('searching');
      setPvpConnectionStatus('connecting', 'ŁĄCZENIE Z SERWEREM', 'Łączę się z serwerem i przygotowuję wyszukiwanie. Darmowy serwer może potrzebować chwili na wybudzenie.');
      const session = new PvpNetworkSession();
      matchmakingSession = session;
      this.pvpSession = session;
      this.pvpLocalReady = false;
      this.pvpIsHost = false;

      session.onConnectionChange = (connected) => {
        if (matchmakingSession !== session) return;
        if (!connected) showPvpReconnectState();
        setPvpConnectionStatus(
          connected ? 'connected' : 'connecting',
          connected ? 'SERWER POŁĄCZONY' : 'PONAWIANIE POŁĄCZENIA',
          connected ? 'Serwer odpowiada. Wyszukuję pierwszego dostępnego przeciwnika…' : 'Połączenie jest ponawiane. Wyszukiwanie zostanie wznowione automatycznie.',
        );
      };
      session.onMatchmakingStatus = (status, position, waitingPlayers) => {
        if (matchmakingSession !== session) return;
        if (status === 'searching') {
          setMatchmakingUiPhase('searching');
          const waitingText = waitingPlayers === 1 ? '1 gracz czeka w kolejce.' : `${waitingPlayers} graczy czeka w kolejce.`;
          setPvpConnectionStatus('searching', 'SZUKAM PRZECIWNIKA', `Twoja pozycja: ${position}. ${waitingText} Mecz rozpocznie się automatycznie po znalezieniu rywala.`);
        } else if (status === 'matched') {
          setMatchmakingUiPhase('matched');
          setPvpConnectionStatus('matched', 'PRZECIWNIK ZNALEZIONY', 'Przygotowuję wspólną arenę. Obaj gracze zostaną automatycznie ustawieni jako gotowi.');
        } else {
          setMatchmakingUiPhase('idle');
          setPvpConnectionStatus('cancelled', 'WYSZUKIWANIE ANULOWANE', 'Możesz rozpocząć nowe wyszukiwanie, kiedy będziesz gotowy.');
        }
      };
      session.onMatchFound = (roomCode) => {
        if (matchmakingSession !== session) return;
        this.pvpRoomCode = roomCode;
        setMatchmakingUiPhase('matched');
        setPvpConnectionStatus('matched', 'PRZECIWNIK ZNALEZIONY', `Połączono graczy w pokoju ${roomCode}. Uruchamiam pojedynek…`);
        sound.playPickup();
      };
      session.onRoomJoined = (roomCode, slot) => {
        if (matchmakingSession !== session) return;
        setPvpNetworkStatus('hidden');
        this.pvpRoomCode = roomCode;
        this.pvpLocalSlot = slot;
        setMatchmakingUiPhase('matched');
        setPvpConnectionStatus('matched', 'ARENA GOTOWA', 'Przeciwnik połączony. Gotowość została potwierdzona automatycznie.');
      };
      session.onMatchStart = (state) => {
        if (matchmakingSession !== session) return;
        const localOp = this.pvpLocalSlot === 'p1' ? state.p1.operatorId : state.p2.operatorId;
        const remoteOp = this.pvpLocalSlot === 'p1' ? state.p2.operatorId : state.p1.operatorId;
        setMatchmakingUiPhase('matched');
        startPvpMatchUI(session, localOp, remoteOp);
      };
      session.onState = (state) => {
        this.engine.setLastPvpState(state);
        // If the opponent leaves before the countdown starts, release the lobby
        // session so the player can immediately search again.
        if (matchmakingSession === session && state.status === 'waiting' && !state.p2.connected) {
          matchmakingSession = null;
          if (this.pvpSession === session) this.pvpSession = null;
          session.dispose();
          setMatchmakingUiPhase('idle');
          setPvpConnectionStatus('error', 'RYWAL SIĘ ROZŁĄCZYŁ', 'Przeciwnik opuścił pokój przed startem. Możesz ponownie wyszukać gracza.');
        }
      };
      session.onRoomClosed = (message) => {
        if (matchmakingSession !== session) return;
        showPvpReconnectFailure(message);
        setMatchmakingUiPhase('idle');
        setPvpConnectionStatus('error', 'POKÓJ ZAMKNIĘTY', message);
      };
      session.onError = (error) => {
        if (matchmakingSession !== session) return;
        showPvpReconnectFailure(error);
        matchmakingSession = null;
        if (this.pvpSession === session) this.pvpSession = null;
        session.dispose();
        setMatchmakingUiPhase('idle');
        setPvpConnectionStatus('error', 'WYSZUKIWANIE NIEUDANE', error);
      };
      session.findMatch(this.selectedPvpOperator, playerNick, getAccountPvpProgressionBonuses(accountProgressionProfile));
      sound.playSmack();
    });

    bindPvpTap(btnCancelMatch, () => {
      const session = matchmakingSession;
      if (!session) return;
      if (!session.cancelMatchmaking()) {
        setMatchmakingUiPhase('matched');
        setPvpConnectionStatus('matched', 'PRZECIWNIK ZNALEZIONY', 'Połączenie zostało już przydzielone. Przygotowuję arenę.');
        return;
      }
      matchmakingSession = null;
      if (this.pvpSession === session) this.pvpSession = null;
      this.pvpLocalReady = false;
      setMatchmakingUiPhase('idle');
      setPvpConnectionStatus('cancelled', 'WYSZUKIWANIE ANULOWANE', 'Możesz rozpocząć nowe wyszukiwanie, kiedy będziesz gotowy.');
      sound.playSmack();
    });

    // Online WebSocket Host
    bindPvpTap(btnCreateRoom, () => {
      const playerNick = nickInput?.value.trim() || 'Operator B4';
      setMatchmakingUiPhase('busy');
      // Keep connection feedback visible before the WebSocket handshake finishes.
      createdRoomInfo?.classList.remove('hidden');
      if (displayRoomCode) displayRoomCode.textContent = 'ŁĄCZENIE…';
      if (hostStatus) hostStatus.textContent = 'Łączenie z serwerem PvP…';
      setPvpConnectionStatus('connecting', 'ŁĄCZENIE Z SERWEREM', 'Serwer może się wybudzać po bezczynności. Pierwsze połączenie może potrwać do około minuty.');
      const netSession = new PvpNetworkSession();
      if (readyBtn) readyBtn.disabled = true;
      this.pvpSession = netSession;
      this.pvpLocalSlot = 'p1';
      this.pvpIsHost = true;
      this.pvpLocalReady = false;

      netSession.onConnectionChange = (connected) => {
        if (!connected) showPvpReconnectState();
        createdRoomInfo?.classList.remove('hidden');
        if (hostStatus) hostStatus.textContent = connected
          ? 'Połączono z serwerem PvP. Tworzenie pokoju...'
          : 'Połączenie z serwerem PvP zostało przerwane.';
        setPvpConnectionStatus(connected ? 'connected' : 'connecting', connected ? 'SERWER POŁĄCZONY' : 'PONAWIANIE POŁĄCZENIA', connected ? 'Serwer odpowiada. Tworzę pokój i generuję kod dla przeciwnika.' : 'Trwa ponawianie próby połączenia. Poczekaj chwilę.');
      };
      netSession.onRematchWaiting = (votes, required) => {
        if (btnRematch) btnRematch.textContent = `REWANŻ • ${votes}/${required} GOTOWYCH`;
      };
      netSession.onRoomClosed = (message) => {
        showPvpReconnectFailure(message);
        setMatchmakingUiPhase('idle');
        if (hostStatus) hostStatus.textContent = message;
      };
      netSession.onRoomJoined = (roomCode, slot, roomState) => {
        setPvpNetworkStatus('hidden');
        if (readyBtn) readyBtn.disabled = true;
        this.pvpRoomCode = roomCode;
        this.pvpLocalSlot = slot;
        if (displayRoomCode) displayRoomCode.textContent = roomCode;
        createdRoomInfo?.classList.remove('hidden');
        readyBar?.classList.remove('hidden');
        if (hostStatus) hostStatus.textContent = 'Pokój utworzony. Czekam na drugiego gracza.';
        setPvpConnectionStatus('waiting', 'POKÓJ UTWORZONY • OCZEKIWANIE', `Kod ${roomCode} jest aktywny. Wyślij go przeciwnikowi; mecz ruszy, gdy obaj gracze będą gotowi.`);
        if (lobbyPlayersStatus) lobbyPlayersStatus.textContent = `Gracz 1: ${roomState.p1.nickname || playerNick} (Ty)`;
      };

      netSession.onPlayerJoined = (player) => {
        if (readyBtn) readyBtn.disabled = false;
        if (hostStatus) hostStatus.textContent = `Gracz ${player.nickname} dołączył! Kliknij 'ZGŁOŚ GOTOWOŚĆ'.`;
        setPvpConnectionStatus('matched', 'PRZECIWNIK DOŁĄCZYŁ', `${player.nickname} jest w pokoju. Potwierdź gotowość, aby rozpocząć pojedynek.`);
        if (lobbyPlayersStatus) lobbyPlayersStatus.textContent = `Gracz 1: Ty • Gracz 2: ${player.nickname}`;
        sound.playPickup();
      };

      netSession.onPlayerReady = (slot, ready) => {
        const playerLabel = slot === this.pvpLocalSlot ? 'Ty' : 'Rywal';
        if (lobbyPlayersStatus) {
          lobbyPlayersStatus.textContent = `Status: ${playerLabel} ${ready ? 'GOTOWY' : 'CZEKA'}`;
        }
        setPvpConnectionStatus('matched', ready ? `${playerLabel.toUpperCase()} • GOTOWY` : `${playerLabel.toUpperCase()} • OCZEKIWANIE`, ready ? 'Potwierdzono gotowość. Mecz rozpocznie się, gdy obaj gracze będą gotowi.' : 'Pokój pozostaje aktywny. Oczekiwanie na potwierdzenie gotowości.');
      };

      netSession.onMatchStart = (state) => {
        const localOp = this.pvpLocalSlot === 'p1' ? state.p1.operatorId : state.p2.operatorId;
        const remoteOp = this.pvpLocalSlot === 'p1' ? state.p2.operatorId : state.p1.operatorId;
        startPvpMatchUI(netSession, localOp, remoteOp);
      };

      netSession.onState = (state) => {
        this.engine.setLastPvpState(state);
        if (readyBtn && state.status === 'waiting') {
          readyBtn.disabled = true;
          this.pvpLocalReady = false;
          readyBtn.textContent = 'ZGŁOŚ GOTOWOŚĆ';
        }
        if (state.status === 'countdown') {
          matchEndModal?.classList.add('hidden');
          if (btnRematch) {
            btnRematch.disabled = false;
            btnRematch.textContent = 'ZAGRAJ PONOWNIE';
          }
        }
      };

      netSession.onError = (err) => {
        showPvpReconnectFailure(err);
        setMatchmakingUiPhase('idle');
        createdRoomInfo?.classList.remove('hidden');
        if (hostStatus) {
          hostStatus.textContent = `Błąd: ${err}`;
          hostStatus.setAttribute('role', 'alert');
        }
        setPvpConnectionStatus('error', 'NIE UDAŁO SIĘ POŁĄCZYĆ', err);
      };

      netSession.createRoom(this.selectedPvpOperator, playerNick, getAccountPvpProgressionBonuses(accountProgressionProfile));
      sound.playSmack();
    });

    // Online WebSocket Join
    bindPvpTap(btnJoinRoom, () => {
      const code = joinCodeInput?.value.trim().toUpperCase();
      if (!code || code.length !== 6) {
        if (joinStatus) {
          joinStatus.classList.remove('hidden');
          joinStatus.textContent = 'Wpisz poprawny 6-znakowy kod pokoju!';
        }
        return;
      }

      const playerNick = nickInput?.value.trim() || 'Operator B4';
      setMatchmakingUiPhase('busy');
      setPvpConnectionStatus('connecting', 'ŁĄCZENIE Z SERWEREM', 'Sprawdzam dostępność serwera i przygotowuję dołączenie do pokoju.');
      if (joinStatus) { joinStatus.classList.remove('hidden'); joinStatus.textContent = 'Łączenie z serwerem PvP…'; }
      const netSession = new PvpNetworkSession();
      if (readyBtn) readyBtn.disabled = true;
      this.pvpSession = netSession;
      this.pvpLocalSlot = 'p2';
      this.pvpIsHost = false;
      this.pvpLocalReady = false;

      netSession.onConnectionChange = (connected) => {
        if (!connected) showPvpReconnectState();
        if (joinStatus) {
          joinStatus.classList.remove('hidden');
          joinStatus.textContent = connected
            ? 'Połączono z serwerem PvP. Dołączanie do pokoju...'
            : 'Połączenie z serwerem PvP zostało przerwane.';
        }
        setPvpConnectionStatus(connected ? 'connected' : 'connecting', connected ? 'SERWER POŁĄCZONY' : 'PONAWIANIE POŁĄCZENIA', connected ? 'Serwer odpowiada. Sprawdzam kod pokoju…' : 'Trwa ponawianie próby połączenia. Poczekaj chwilę.');
      };
      netSession.onRematchWaiting = (votes, required) => {
        if (btnRematch) btnRematch.textContent = `REWANŻ • ${votes}/${required} GOTOWYCH`;
      };
      netSession.onRoomClosed = (message) => {
        showPvpReconnectFailure(message);
        setMatchmakingUiPhase('idle');
        if (joinStatus) {
          joinStatus.classList.remove('hidden');
          joinStatus.textContent = message;
        }
      };
      netSession.onRoomJoined = (roomCode, slot, roomState) => {
        setPvpNetworkStatus('hidden');
        if (readyBtn) readyBtn.disabled = false;
        this.pvpRoomCode = roomCode;
        this.pvpLocalSlot = slot;
        readyBar?.classList.remove('hidden');
        if (joinStatus) {
          joinStatus.classList.remove('hidden');
          joinStatus.textContent = `Dołączono do pokoju ${roomCode}!`;
        }
        setPvpConnectionStatus('matched', 'DOŁĄCZONO DO POKOJU', `Pokój ${roomCode} jest dostępny. Poczekaj na gotowość obu graczy.`);
        if (lobbyPlayersStatus) {
          lobbyPlayersStatus.textContent = `Połączono! Gracz 1: ${roomState.p1.nickname || 'Host'} • Gracz 2: ${playerNick} (Ty)`;
        }
        sound.playPickup();
      };

      netSession.onPlayerReady = (slot, ready) => {
        const playerLabel = slot === this.pvpLocalSlot ? 'Ty' : 'Rywal';
        if (lobbyPlayersStatus) {
          lobbyPlayersStatus.textContent = `Status: ${playerLabel} ${ready ? 'GOTOWY' : 'CZEKA'}`;
        }
        setPvpConnectionStatus('matched', ready ? `${playerLabel.toUpperCase()} • GOTOWY` : `${playerLabel.toUpperCase()} • OCZEKIWANIE`, ready ? 'Potwierdzono gotowość. Mecz rozpocznie się, gdy obaj gracze będą gotowi.' : 'Pokój pozostaje aktywny. Oczekiwanie na potwierdzenie gotowości.');
      };

      netSession.onMatchStart = (state) => {
        const localOp = this.pvpLocalSlot === 'p1' ? state.p1.operatorId : state.p2.operatorId;
        const remoteOp = this.pvpLocalSlot === 'p1' ? state.p2.operatorId : state.p1.operatorId;
        startPvpMatchUI(netSession, localOp, remoteOp);
      };

      netSession.onState = (state) => {
        this.engine.setLastPvpState(state);
        if (state.status === 'countdown') {
          matchEndModal?.classList.add('hidden');
          if (btnRematch) {
            btnRematch.disabled = false;
            btnRematch.textContent = 'ZAGRAJ PONOWNIE';
          }
        }
      };

      netSession.onError = (err) => {
        showPvpReconnectFailure(err);
        setMatchmakingUiPhase('idle');
        if (joinStatus) {
          joinStatus.classList.remove('hidden');
          joinStatus.textContent = `Błąd dołączania: ${err}`;
        }
        setPvpConnectionStatus('error', 'NIE UDAŁO SIĘ DOŁĄCZYĆ', err);
      };

      netSession.joinRoom(code, this.selectedPvpOperator, playerNick, getAccountPvpProgressionBonuses(accountProgressionProfile));
      sound.playSmack();
    });

    bindPvpTap(readyBtn, () => {
      if (!this.pvpSession) return;
      this.pvpLocalReady = !this.pvpLocalReady;
      this.pvpSession.setReady?.(this.pvpLocalReady);
      if (readyBtn) readyBtn.textContent = this.pvpLocalReady ? '✓ JESTEŚ GOTOWY' : 'ZGŁOŚ GOTOWOŚĆ';
      sound.playSmack();
    });

    bindPvpTap(btnRematch, () => {
      if (!this.pvpSession) return;
      this.accountPvpAwardedForMatch = false;
      this.pvpSession.requestRematch?.();
      if (this.pvpSession.isLocalBot) {
        matchEndModal?.classList.add('hidden');
      } else if (btnRematch) {
        btnRematch.textContent = 'REWANŻ ZGŁOSZONY • CZEKAJ NA RYWALA';
        btnRematch.disabled = true;
      }
      sound.playSmack();
    });

    bindPvpTap(btnExitToMenu, () => {
      setPvpNetworkStatus('hidden');
      matchEndModal?.classList.add('hidden');
      document.getElementById('pvp-hud')?.classList.add('hidden');
      resetPvpFireButton();
      pvpFireButton?.classList.add('hidden');
      if (pvpFireButton) {
        pvpFireButton.dataset.roundActive = 'false';
        pvpFireButton.dataset.operator = '';
      }
      if (desktopPvpFireButton) {
        desktopPvpFireButton.classList.remove('pvp-primary-fire', 'is-reloading');
        desktopPvpFireButton.disabled = false;
        desktopPvpFireButton.dataset.roundActive = 'false';
        desktopPvpFireButton.style.setProperty('--pvp-fire-progress', '0%');
        if (desktopAttackPresentation) {
          if (desktopPvpFireLabel) desktopPvpFireLabel.textContent = desktopAttackPresentation.name;
          if (desktopPvpFireState) desktopPvpFireState.textContent = desktopAttackPresentation.hint;
          if (desktopPvpFireIcon) desktopPvpFireIcon.innerHTML = desktopAttackPresentation.icon;
          desktopPvpFireButton.title = desktopAttackPresentation.title;
        }
      }
      desktopAttackPresentation = null;
      setTouchControlsMode('hidden');
      setTouchControlsVisibility(false);
      this.engine.setManualAimMode(false);
      this.engine.exitPvp();
      if (matchmakingSession) {
        matchmakingSession.leaveRoom();
        matchmakingSession = null;
      }
      if (this.pvpSession) {
        this.pvpSession.leaveRoom?.();
        this.pvpSession = null;
      }
      this.pvpLocalReady = false;
      if (btnRematch) {
        btnRematch.disabled = false;
        btnRematch.textContent = 'ZAGRAJ PONOWNIE';
      }
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      sound.playSmack();
    });
  }

  private updatePvpScoreboard(state: PvpArenaState, localSlot: PvpSlot) {
    const roundActive = state.status === 'in_round';
    const localPlayer = localSlot === 'p1' ? state.p1 : state.p2;
    const cooldownActive = Number.isFinite(localPlayer.attackCooldownTimer) && localPlayer.attackCooldownTimer > 0.08;
    const fireButtons = [
      document.getElementById('btn-pvp-fire') as HTMLButtonElement | null,
      document.getElementById('btn-attack') as HTMLButtonElement | null,
    ];
    fireButtons.forEach((button) => {
      if (!button) return;
      button.dataset.roundActive = String(roundActive);
      if (!roundActive || cooldownActive) {
        button.disabled = true;
        if (roundActive && cooldownActive) button.classList.add('is-reloading');
        else button.classList.remove('is-reloading');
        const label = button.id === 'btn-pvp-fire'
          ? button.querySelector<HTMLElement>('.pvp-fire-label')
          : button.querySelector<HTMLElement>('.attack-name');
        const status = button.id === 'btn-pvp-fire'
          ? button.querySelector<HTMLElement>('.pvp-fire-state')
          : button.querySelector<HTMLElement>('.attack-hint');
        if (label) label.textContent = roundActive ? 'ŁADOWANIE' : 'STRZAŁ';
        if (status) status.textContent = roundActive && cooldownActive
          ? `${Math.max(0, localPlayer.attackCooldownTimer).toFixed(1)} s`
          : button.id === 'btn-pvp-fire' ? 'GOTOWY' : 'KLIK / F';
      } else if (!button.classList.contains('is-reloading')) {
        button.disabled = false;
        const label = button.id === 'btn-pvp-fire'
          ? button.querySelector<HTMLElement>('.pvp-fire-label')
          : button.querySelector<HTMLElement>('.attack-name');
        const status = button.id === 'btn-pvp-fire'
          ? button.querySelector<HTMLElement>('.pvp-fire-state')
          : button.querySelector<HTMLElement>('.attack-hint');
        if (label) label.textContent = 'STRZAŁ';
        if (status) status.textContent = button.id === 'btn-pvp-fire' ? 'GOTOWY' : 'KLIK / F';
      }
    });
    const p1Fill = document.getElementById('pvp-p1-hp-fill');
    const p1Text = document.getElementById('pvp-p1-hp-text');
    const p1Name = document.getElementById('pvp-p1-name');
    const p1Role = document.getElementById('pvp-p1-role');
    const p1Avatar = document.getElementById('pvp-p1-avatar');
    if (p1Fill) p1Fill.style.width = `${Math.max(0, Math.min(100, (state.p1.hp / state.p1.maxHp) * 100))}%`;
    if (p1Text) p1Text.textContent = `${Math.max(0, Math.ceil(state.p1.hp))} / ${state.p1.maxHp}`;
    if (p1Name) p1Name.textContent = state.p1.nickname + (localSlot === 'p1' ? ' (TY)' : '');
    if (p1Role) p1Role.textContent = CHARACTERS[state.p1.operatorId]?.role.toUpperCase() || 'OPERATOR';
    if (p1Avatar) {
      p1Avatar.innerHTML = operatorPortrait(state.p1.operatorId);
      p1Avatar.setAttribute('aria-label', CHARACTERS[state.p1.operatorId]?.name || 'Gracz 1');
    }

    const p1Dot0 = document.getElementById('p1-dot-0');
    const p1Dot1 = document.getElementById('p1-dot-1');
    if (p1Dot0) p1Dot0.classList.toggle('scored', state.score.p1 >= 1);
    if (p1Dot1) p1Dot1.classList.toggle('scored', state.score.p1 >= 2);

    const p2Fill = document.getElementById('pvp-p2-hp-fill');
    const p2Text = document.getElementById('pvp-p2-hp-text');
    const p2Name = document.getElementById('pvp-p2-name');
    const p2Role = document.getElementById('pvp-p2-role');
    const p2Avatar = document.getElementById('pvp-p2-avatar');
    if (p2Fill) p2Fill.style.width = `${Math.max(0, Math.min(100, (state.p2.hp / state.p2.maxHp) * 100))}%`;
    if (p2Text) p2Text.textContent = `${Math.max(0, Math.ceil(state.p2.hp))} / ${state.p2.maxHp}`;
    if (p2Name) p2Name.textContent = (localSlot === 'p2' ? '(TY) ' : '') + state.p2.nickname;
    if (p2Role) p2Role.textContent = CHARACTERS[state.p2.operatorId]?.role.toUpperCase() || 'OPERATOR';
    if (p2Avatar) {
      p2Avatar.innerHTML = operatorPortrait(state.p2.operatorId);
      p2Avatar.setAttribute('aria-label', CHARACTERS[state.p2.operatorId]?.name || 'Gracz 2');
    }

    const p2Dot0 = document.getElementById('p2-dot-0');
    const p2Dot1 = document.getElementById('p2-dot-1');
    if (p2Dot0) p2Dot0.classList.toggle('scored', state.score.p2 >= 1);
    if (p2Dot1) p2Dot1.classList.toggle('scored', state.score.p2 >= 2);

    const roundIndicator = document.getElementById('pvp-round-indicator');
    if (roundIndicator) roundIndicator.textContent = `RUNDA ${state.currentRound} / ${state.maxRounds}`;

    const perkStatus = document.getElementById('pvp-perk-status');
    const localPerkPlayer = localSlot === 'p1' ? state.p1 : state.p2;
    this.pvpFireCooldownMultiplier = localPerkPlayer.activePerk === 'rapid' && localPerkPlayer.perkTimer > 0 ? PVP_RAPID_FIRE_COOLDOWN_MULTIPLIER : 1;
    if (perkStatus) {
      const perkNames: Record<string, string> = { power: 'MOC +22% OBRAŻEŃ', sprint: 'SPRINT +16% RUCHU', shield: 'TARCZA +165 HP', rapid: 'SZYBSZE ŁADOWANIE' };
      const localFirearmPlayer = localSlot === 'p1' ? state.p1 : state.p2;
      if (localFirearmPlayer.activePerk === 'shield' && localFirearmPlayer.shieldHp > 0) perkStatus.textContent = `TARCZA AKTYWNA • ${Math.ceil(localFirearmPlayer.shieldHp)} HP`;
      else if (localFirearmPlayer.activePerk && localFirearmPlayer.perkTimer > 0) perkStatus.textContent = `TWÓJ PERK: ${perkNames[localFirearmPlayer.activePerk] || 'AKTYWNY'} • ${Math.ceil(localFirearmPlayer.perkTimer)} s`;
      else if (state.perkDrop.active) perkStatus.textContent = `KAPSUŁA: ${perkNames[state.perkDrop.type] || 'LOSOWY PERK'} • ZBIERZ NA ARENIE`;
      else perkStatus.textContent = `NOWA KAPSUŁA ZA ${Math.ceil(state.perkDrop.spawnTimer)} s • SPRAWDŹ MAPĘ`;
    }

    const localFirearmPlayer = localSlot === 'p1' ? state.p1 : state.p2;
    const primaryDefinition = SURVIVAL_FIREARM_DEFS[localFirearmPlayer.primaryFirearmId];
    const rapidFireMultiplier = localFirearmPlayer.activePerk === 'rapid' && localFirearmPlayer.perkTimer > 0
      ? PVP_RAPID_FIRE_COOLDOWN_MULTIPLIER
      : 1;
    this.pvpFirearmCooldownSeconds = getPvpFirearmAttackCooldown(localFirearmPlayer.primaryFirearmId) *
      (localFirearmPlayer.progressionBonuses?.cooldownMultiplier ?? 1) * rapidFireMultiplier;
    const primaryAmmo = localFirearmPlayer.firearmAmmoById[localFirearmPlayer.primaryFirearmId] ?? primaryDefinition.magazineSize;
    const isReloading = localFirearmPlayer.reloadRemainingSeconds > 0;
    const isCycling = !isReloading && localFirearmPlayer.attackCooldownTimer > 0;
    const ammoAlert = isReloading
      ? 'ready'
      : getSurvivalFirearmAmmoAlert(primaryAmmo, primaryDefinition.magazineSize);
    const firearmPanel = document.getElementById('pvp-firearm-panel');
    const firearmSignature = [
      localFirearmPlayer.primaryFirearmId,
      primaryAmmo,
      Math.ceil(localFirearmPlayer.reloadRemainingSeconds * 4),
      Math.ceil(localFirearmPlayer.attackCooldownTimer * 4),
      state.firearmDrop.active ? state.firearmDrop.firearmId : 'waiting',
      Math.ceil(state.firearmDrop.spawnTimer),
    ].join(':');
    if (firearmPanel && firearmPanel.dataset.signature !== firearmSignature) {
      firearmPanel.dataset.signature = firearmSignature;
      firearmPanel.classList.toggle('is-low-ammo', ammoAlert === 'low');
      firearmPanel.classList.toggle('is-critical-ammo', ammoAlert === 'critical');
      firearmPanel.classList.toggle('is-empty-ammo', ammoAlert === 'empty');
      const firearmName = document.getElementById('pvp-firearm-name');
      const firearmAmmo = document.getElementById('pvp-firearm-ammo');
      const firearmAction = document.getElementById('pvp-firearm-action');
      const firearmAmmoFill = document.getElementById('pvp-firearm-ammo-fill');
      const reloadButton = document.getElementById('btn-pvp-reload') as HTMLButtonElement | null;
      const dropStatus = document.getElementById('pvp-firearm-drop-status');
      if (firearmName) firearmName.textContent = primaryDefinition.shortName.toUpperCase();
      if (firearmAmmo) {
        firearmAmmo.textContent = isReloading
          ? `— / ${primaryDefinition.magazineSize}`
          : `${primaryAmmo} / ${primaryDefinition.magazineSize}`;
        const ammoAlertLabel = ammoAlert === 'low'
          ? 'mało amunicji'
          : ammoAlert === 'critical'
            ? 'końcówka magazynka'
            : ammoAlert === 'empty'
              ? 'pusty magazynek'
              : 'amunicja wystarczająca';
        firearmAmmo.setAttribute('aria-label', `${primaryAmmo} z ${primaryDefinition.magazineSize}, ${ammoAlertLabel}`);
      }
      if (firearmAction) firearmAction.textContent = isReloading
        ? `PRZEŁADOWANIE ${localFirearmPlayer.reloadRemainingSeconds.toFixed(1)} s`
        : isCycling
          ? `CYKL ${localFirearmPlayer.attackCooldownTimer.toFixed(1)} s`
          : ammoAlert === 'low'
            ? 'MAŁO AMUNICJI'
            : ammoAlert === 'critical'
              ? 'KOŃCÓWKA MAGAZYNKA'
              : ammoAlert === 'empty'
                ? 'PUSTY MAGAZYNEK'
                : 'GOTOWY';
      if (firearmAmmoFill) firearmAmmoFill.style.width = `${Math.max(0, Math.min(100, primaryAmmo / Math.max(1, primaryDefinition.magazineSize) * 100))}%`;
      if (reloadButton) {
        reloadButton.disabled = isReloading || primaryAmmo >= primaryDefinition.magazineSize || state.status !== 'in_round';
        reloadButton.classList.toggle('is-ready', !reloadButton.disabled);
        reloadButton.classList.toggle('is-low-ammo', ammoAlert === 'low');
        reloadButton.classList.toggle('is-critical-ammo', ammoAlert === 'critical' || ammoAlert === 'empty');
      }
      if (dropStatus) dropStatus.textContent = state.firearmDrop.active
        ? `ZWIADOWCZY ZRZUT • ${SURVIVAL_FIREARM_DEFS[state.firearmDrop.firearmId].shortName.toUpperCase()} • PODNIEŚ NA ARENIE`
        : `KOLEJNY ZRZUT BRONI ZA ${Math.ceil(state.firearmDrop.spawnTimer)} s`;
    }

    const banner = document.getElementById('pvp-status-banner');
    if (banner) {
      if (state.status === 'countdown') {
        banner.textContent = `ODLICZANIE: ${Math.ceil(state.countdownTimer)}...`;
        banner.className = 'pvp-status-banner countdown';
      } else if (state.status === 'in_round') {
        if (state.pickup.respawnTimer > 0) {
          banner.textContent = `APTECZKA ZA ${Math.ceil(state.pickup.respawnTimer)}s`;
          banner.className = 'pvp-status-banner';
        } else {
          banner.textContent = `WALKA! APTECZKA DOSTĘPNA NA ŚRODKU!`;
          banner.className = 'pvp-status-banner active';
        }
      } else if (state.status === 'round_end') {
        const winnerNick = state.roundWinner === 'p1' ? state.p1.nickname : state.p2.nickname;
        banner.textContent = `RUNDĘ WYGRYWA: ${winnerNick}!`;
        banner.className = 'pvp-status-banner winner';
      } else if (state.status === 'match_end') {
        banner.textContent = `MECZ ZAKOŃCZONY!`;
        banner.className = 'pvp-status-banner winner';
      }
    }
  }


  private syncAccountProgressionWithCloud(): Promise<void> {
    if (this.accountCloudSyncInFlight) return this.accountCloudSyncInFlight;
    const status = document.getElementById('account-cloud-sync-status');
    if (status) status.textContent = 'ŁĄCZENIE Z CHMURĄ...';

    this.accountCloudSyncInFlight = (async () => {
      const services = await loadFirebaseLeaderboardServices();
      const remoteProfile = await services.loadAccountProgressionProfileFromCloud();
      accountProgressionProfile = mergeAccountProgressionProfiles(
        accountProgressionProfile,
        remoteProfile ?? createInitialAccountProgressionProfile(),
      );
      persistAccountProgressionProfile();
      const savedProfile = await services.saveAccountProgressionProfileToCloud(accountProgressionProfile);
      accountProgressionProfile = mergeAccountProgressionProfiles(accountProgressionProfile, savedProfile);
      persistAccountProgressionProfile();
      const engineState = this.engine.getGameState();
      if (engineState === 'title' || engineState === 'gameover') {
        this.engine.selectCharacter(
          this.selectedCharId,
          combineAccountAndCharacterBonuses(
            getCharacterTalentBonuses(characterMasteryProfile, this.selectedCharId),
            getAccountProgressionBonuses(accountProgressionProfile),
          ),
        );
      }
      this.renderAccountProgressionUi();
      if (status) status.textContent = 'SYNCHRONIZACJA ZAKOŃCZONA • PROFIL ZABEZPIECZONY W FIREBASE';
    })().catch((error: unknown) => {
      console.warn('[Account progression] Cloud sync unavailable; local profile remains safe:', error);
      if (status) status.textContent = 'CHMURA NIEDOSTĘPNA • POSTĘP LOKALNY ZACHOWANY';
    }).finally(() => {
      this.accountCloudSyncInFlight = null;
    });
    return this.accountCloudSyncInFlight;
  }


  private async connectAccountProgressionToGoogle(): Promise<void> {
    const status = document.getElementById('account-cloud-sync-status');
    const button = document.getElementById('btn-account-google-connect') as HTMLButtonElement | null;
    if (button) button.disabled = true;
    if (status) status.textContent = 'ZABEZPIECZANIE PROFILU I ŁĄCZENIE GOOGLE...';

    try {
      const services = await loadFirebaseLeaderboardServices();
      // Save the anonymous profile before linking or switching Firebase identity.
      await services.saveAccountProgressionProfileToCloud(accountProgressionProfile);
      const identity = await services.connectAccountWithGoogle();
      const cloudProfile = await services.loadAccountProgressionProfileFromCloud();
      accountProgressionProfile = mergeAccountProgressionProfiles(
        accountProgressionProfile,
        cloudProfile ?? createInitialAccountProgressionProfile(),
      );
      const saved = await services.saveAccountProgressionProfileToCloud(accountProgressionProfile);
      accountProgressionProfile = mergeAccountProgressionProfiles(accountProgressionProfile, saved);
      persistAccountProgressionProfile();
      this.engine.selectCharacter(
        this.selectedCharId,
        combineAccountAndCharacterBonuses(
          getCharacterTalentBonuses(characterMasteryProfile, this.selectedCharId),
          getAccountProgressionBonuses(accountProgressionProfile),
        ),
      );
      this.renderAccountProgressionUi();
      if (status) {
        status.textContent = identity.isAnonymous
          ? 'SESJA POZOSTAŁA ANONIMOWA • SPRAWDŹ USTAWIENIA GOOGLE'
          : 'KONTO GOOGLE POŁĄCZONE • POSTĘP DOSTĘPNY PO ZALOGOWANIU NA INNYM URZĄDZENIU';
      }
    } catch (error) {
      console.warn('[Account progression] Google account linking failed; local profile remains safe:', error);
      if (status) status.textContent = 'NIE UDAŁO SIĘ POŁĄCZYĆ GOOGLE • POSTĘP LOKALNY ZACHOWANY';
    } finally {
      if (button) button.disabled = false;
    }
  }

  private handlePvpMatchEnd(state: PvpArenaState, localSlot: PvpSlot) {
    const fireButton = document.getElementById('btn-pvp-fire') as HTMLButtonElement | null;
    if (fireButton) {
      fireButton.dataset.roundActive = 'false';
      fireButton.disabled = true;
    }
    const matchEndModal = document.getElementById('pvp-match-end-modal');
    const isWinner = state.winner === localSlot;
    if (!this.accountPvpAwardedForMatch) {
      this.accountPvpAwardedForMatch = true;
      const playerStats = localSlot === 'p1' ? state.stats.p1 : state.stats.p2;
      const roundsWon = localSlot === 'p1' ? state.score.p1 : state.score.p2;
      const accountResult = recordAccountPvpMatch(accountProgressionProfile, {
        damageDealt: playerStats.damageDealt,
        shotsHit: playerStats.shotsHit,
        knockouts: playerStats.knockouts,
        roundsWon,
        wonMatch: isWinner,
      });
      accountProgressionProfile = accountResult.profile;
      persistAccountProgressionProfile();
      void this.syncAccountProgressionWithCloud();
      this.renderAccountProgressionUi();
      if (accountResult.xpEarned > 0) {
        const accountToast = document.createElement('div');
        accountToast.className = 'achievement-unlock-toast';
        accountToast.textContent = '⚔️ POSTĘP KONTA • +' + accountResult.xpEarned + ' XP' +
          (accountResult.levelsGained > 0 ? ' • AWANS +' + accountResult.levelsGained + ' • +1 PKT ZA KAŻDY POZIOM' : '') +
          (accountResult.rankUps.length ? ' • NOWA RUNGA: ' + accountResult.rankUps.join(', ') : '');
        document.body.appendChild(accountToast);
        window.setTimeout(() => accountToast.remove(), 4300);
      }
    }
    if (!matchEndModal) return;

    if (isWinner) {
      sound.playWin();
    } else {
      sound.playGameOver();
    }

    const endBadge = document.getElementById('pvp-end-badge');
    const endTitle = document.getElementById('pvp-end-title');
    const endSubtitle = document.getElementById('pvp-end-subtitle');
    const roundsScore = document.getElementById('pvp-end-rounds-score');
    const damageDealt = document.getElementById('pvp-end-damage-dealt');
    const shotsFired = document.getElementById('pvp-end-shots-fired');
    const accuracy = document.getElementById('pvp-end-accuracy');

    if (endBadge) endBadge.textContent = isWinner ? '🏆' : '💀';
    if (endTitle) endTitle.textContent = isWinner ? 'ZWYCIĘSTWO!' : 'PORAŻKA';
    if (endSubtitle) {
      const myNick = localSlot === 'p1' ? state.p1.nickname : state.p2.nickname;
      const opNick = localSlot === 'p1' ? state.p2.nickname : state.p1.nickname;
      endSubtitle.textContent = isWinner
        ? `Świetna robota, ${myNick}! Wygrałeś pojedynek z ${opNick} na arenie magazynu.`
        : `Tym razem ${opNick} okazał się szybszy na paleciaku. Spróbuj rewanżu!`;
    }

    if (roundsScore) roundsScore.textContent = `${state.score.p1} - ${state.score.p2}`;

    const myStats = localSlot === 'p1' ? state.stats.p1 : state.stats.p2;
    const opponentStats = localSlot === 'p1' ? state.stats.p2 : state.stats.p1;
    const myPlayer = localSlot === 'p1' ? state.p1 : state.p2;
    const opponentPlayer = localSlot === 'p1' ? state.p2 : state.p1;
    if (damageDealt) damageDealt.textContent = `${Math.round(myStats.damageDealt)} HP`;
    if (shotsFired) shotsFired.textContent = `${myStats.shotsFired}`;
    const acc = myStats.shotsFired > 0 ? Math.round((myStats.shotsHit / myStats.shotsFired) * 100) : 0;
    if (accuracy) accuracy.textContent = `${acc}%`;

    const selfName = document.getElementById('pvp-end-self-name');
    const opponentName = document.getElementById('pvp-end-opponent-name');
    if (selfName) selfName.textContent = myPlayer.nickname || 'TY';
    if (opponentName) opponentName.textContent = opponentPlayer.nickname || 'RYWAL';

    const comparisonRows: Array<[string, (stats: typeof myStats) => string]> = [
      ['primary-damage', (stats) => `${Math.round(stats.primaryDamageDealt)} HP`],
      ['ability-damage', (stats) => `${Math.round(stats.abilityDamageDealt)} HP`],
      ['damage-taken', (stats) => `${Math.round(stats.damageTaken)} HP`],
      ['healing', (stats) => `${Math.round(stats.healingDone)} HP`],
      ['abilities', (stats) => `${stats.abilityUses} • ${stats.abilityHits}`],
      ['dashes', (stats) => `${stats.dashesUsed}`],
      ['knockouts', (stats) => `${stats.knockouts}`],
    ];
    for (const [key, format] of comparisonRows) {
      const selfValue = document.getElementById(`pvp-end-self-${key}`);
      const opponentValue = document.getElementById(`pvp-end-opponent-${key}`);
      if (selfValue) selfValue.textContent = format(myStats);
      if (opponentValue) opponentValue.textContent = format(opponentStats);
    }

    const rematchButton = document.getElementById('btn-pvp-rematch') as HTMLButtonElement | null;
    if (rematchButton) {
      rematchButton.disabled = false;
      rematchButton.textContent = 'ZAGRAJ PONOWNIE';
    }
    matchEndModal.classList.remove('hidden');
  }

  onSelectEnd(event: xb.SelectEvent) {
    this.engine?.triggerAbility();
  }

  override dispose(): void {
    this.engine?.dispose();

    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      const particleMaterial = this.particleSystem.material;
      if (Array.isArray(particleMaterial)) {
        particleMaterial.forEach((mat) => mat.dispose());
      } else {
        particleMaterial.dispose();
      }
      this.particleSystem = null;
    }

    this.restoreSelectiveBloomOverride?.();
    this.restoreSelectiveBloomOverride = null;
    this.selectiveBloom?.dispose();
    this.selectiveBloom = null;
    disposeCombatVfxResources();
    super.dispose();
  }
}

// Visual Polish / Theme Injections (Integrated to ensure execution)
const injectThemeStyles = () => {
  if (document.getElementById('paleciaki-inline-theme')) return;
  
  // Set theme variables
  const root = document.documentElement;
  root.style.setProperty('--maxfliz-bg-1', '#050b14');
  root.style.setProperty('--maxfliz-bg-2', '#0b1220');
  root.style.setProperty('--maxfliz-accent', '#f59e0b');
  root.style.setProperty('--maxfliz-blue', '#38bdf8');

  const style = document.createElement('style');
  style.id = 'paleciaki-inline-theme';
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
  console.log('%c[App:Boot] 🚀 Start gry MAX FLIX 22...', 'color: #38bdf8; font-weight: bold;');
  injectThemeStyles();

  // The touch layer must not be a descendant of the WebGL shell: Android
  // WebView can composite the canvas above descendants even when their
  // z-index is larger. Portal the existing node to body; its listeners stay
  // attached and its children remain the same DOM elements.
  const touchLayer = document.getElementById('touch-controls');
  if (touchLayer && touchLayer.parentElement !== document.body) {
    document.body.appendChild(touchLayer);
  }
  if (touchLayer) {
    touchLayer.style.setProperty('position', 'fixed', 'important');
    touchLayer.style.setProperty('inset', '0', 'important');
    touchLayer.style.setProperty('z-index', '2147483000', 'important');
    touchLayer.style.setProperty('pointer-events', 'none', 'important');
  }
  renderSurvivalAchievements();

  const titleScreen = document.getElementById('title-screen');
  const shell = document.getElementById('game-shell');

  // Keep the menu outside the WebGL shell's stacking context. Some mobile
  // WebViews promote the renderer canvas to its own compositor layer; a menu
  // nested under the game shell can then disappear behind the live 3D scene.
  // The same DOM node is moved, so all existing menu references and handlers
  // remain valid.
  if (titleScreen && titleScreen.parentElement !== document.body) {
    document.body.appendChild(titleScreen);
  }
  if (titleScreen) {
    titleScreen.style.setProperty('position', 'fixed', 'important');
    titleScreen.style.setProperty('inset', '0', 'important');
    titleScreen.style.setProperty('z-index', '1000000', 'important');
    titleScreen.style.setProperty('pointer-events', 'auto', 'important');
  }

  const revealStartupUi = () => {
    assetLoader.hide();
    if (shell) {
      shell.classList.remove('hidden');
      shell.style.removeProperty('display');
      shell.style.setProperty('display', 'flex', 'important');
      shell.style.setProperty('z-index', '9999999', 'important');
    }
    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.removeProperty('display');
      titleScreen.style.setProperty('display', 'flex', 'important');
      titleScreen.style.setProperty('z-index', '1000000', 'important');
    }
  };

  const showBootRecoveryNotice = (message: string) => {
    let notice = document.getElementById('boot-recovery-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'boot-recovery-notice';
      notice.setAttribute('role', 'alert');
      Object.assign(notice.style, {
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: '30000000',
        maxWidth: '560px',
        margin: '0 auto',
        padding: '14px 16px',
        border: '1px solid rgba(248,113,113,.55)',
        borderRadius: '14px',
        background: 'rgba(8,15,27,.97)',
        color: '#f8fafc',
        boxShadow: '0 20px 60px rgba(0,0,0,.45)',
        font: '600 14px/1.45 system-ui,sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      });
      const copy = document.createElement('span');
      copy.id = 'boot-recovery-message';
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.textContent = 'ODŚWIEŻ GRĘ';
      Object.assign(reload.style, {
        flex: '0 0 auto',
        border: '1px solid rgba(248,113,113,.7)',
        borderRadius: '9px',
        padding: '9px 12px',
        background: 'rgba(127,29,29,.45)',
        color: '#fff',
        font: '800 11px system-ui,sans-serif'
      });
      reload.addEventListener('click', () => window.location.reload());
      notice.append(copy, reload);
      document.body.appendChild(notice);
    }
    const copy = notice.querySelector('#boot-recovery-message');
    if (copy) copy.textContent = message;
  };

  const withBootTimeout = async <T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    let timeoutId: number | undefined;
    try {
      return await Promise.race([
        task,
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        })
      ]);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  };

  // Last-resort UI watchdog. Normal startup has shorter, stage-specific timeouts.
  const safetyTimeout = window.setTimeout(() => {
    console.warn('[App:Boot] Przekroczono maksymalny czas uruchamiania.');
    revealStartupUi();
    showBootRecoveryNotice('Uruchamianie gry trwa zbyt długo. Odśwież grę; jeżeli problem wróci, sprawdź połączenie i WebGL.');
  }, 36000);

  try {
    // 1. Show Asset Loader immediately
    assetLoader.show('Inicjalizacja systemu...', 0);
    assetLoader.updateCategory('engine', 0, 4);

    // 2. Preload all procedural textures, 3D models and audio context (covers 0% - 70%)
    console.log('[App:Boot] ⏳ Wstępne ładowanie zasobów...');
    await withBootTimeout(
      assetLoader.preloadAll(),
      12000,
      'Przygotowanie zasobów 3D przekroczyło 12 sekund.'
    );
    console.log('[App:Boot] ✅ Zasoby załadowane.');

    // 3. Ensure canvas in container
    assetLoader.updateProgress(74, 'Konfiguracja płótna WebGL i bufora klatek...', 'engine', 'PŁÓTNO 3D');
    assetLoader.updateCategory('engine', 1, 4);
    await new Promise(r => setTimeout(r, 40));

    const canvasContainer = document.getElementById('game-canvas-container');
    let canvas = canvasContainer?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas && canvasContainer) {
      canvas = document.createElement('canvas');
      canvas.id = 'paleciaki-3d-canvas';
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
    options.setAppTitle('MAX FLIX 22');
    
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

    const sceneScript = new PaleciakiScene();
    xb.add(sceneScript);

    // 6. Init Engine
    try {
      console.log('[App:Boot] 🔗 Łączenie z silnikiem renderingu...');
      
      await withBootTimeout(
        xb.init(options),
        18000,
        'Silnik 3D nie odpowiedział w ciągu 18 sekund. Sprawdź obsługę WebGL i odśwież grę.'
      );
      console.log('[App:Boot] ✅ Silnik 3D zainicjalizowany.');

      const renderer = xb.core.renderer as THREE.WebGLRenderer | undefined;
      if (!renderer) {
        throw new Error('Silnik 3D nie utworzył renderera WebGL. Uruchom grę ponownie w obsługiwanej przeglądarce.');
      }

      // A lost WebGL context otherwise leaves the simulation advancing behind a frozen canvas.
      // Three.js restores its renderer state; the player explicitly resumes the paused run.
      const recoveryNotice = document.createElement('aside');
      recoveryNotice.id = 'webgl-recovery-notice';
      recoveryNotice.className = 'webgl-recovery-overlay';
      recoveryNotice.hidden = true;
      recoveryNotice.setAttribute('role', 'alertdialog');
      recoveryNotice.setAttribute('aria-modal', 'true');
      recoveryNotice.setAttribute('aria-live', 'assertive');

      const recoveryCard = document.createElement('div');
      recoveryCard.className = 'webgl-recovery-card';
      const recoveryHeading = document.createElement('h2');
      recoveryHeading.id = 'webgl-recovery-heading';
      recoveryHeading.textContent = 'PRZYWRACANIE GRAFIKI 3D';
      recoveryNotice.setAttribute('aria-labelledby', recoveryHeading.id);

      const recoveryCopy = document.createElement('p');
      recoveryCopy.className = 'webgl-recovery-copy';
      recoveryCopy.textContent = 'Utracono połączenie z układem graficznym. Rozgrywka zostanie wstrzymana do czasu przywrócenia obrazu.';

      const recoveryActions = document.createElement('div');
      recoveryActions.className = 'webgl-recovery-actions';
      const recoveryResume = document.createElement('button');
      recoveryResume.type = 'button';
      recoveryResume.className = 'webgl-recovery-resume';
      recoveryResume.textContent = 'OCZEKIWANIE NA GPU';
      recoveryResume.disabled = true;

      const recoveryReload = document.createElement('button');
      recoveryReload.type = 'button';
      recoveryReload.className = 'webgl-recovery-reload';
      recoveryReload.textContent = 'ODŚWIEŻ GRĘ';
      recoveryReload.addEventListener('click', () => window.location.reload());

      recoveryActions.append(recoveryResume, recoveryReload);
      recoveryCard.append(recoveryHeading, recoveryCopy, recoveryActions);
      recoveryNotice.appendChild(recoveryCard);
      document.body.appendChild(recoveryNotice);

      let shouldResumeAfterContextLoss = false;
      let webglContextRestored = false;
      recoveryResume.addEventListener('click', () => {
        if (!webglContextRestored) return;
        sceneScript.resumeAfterWebGLRecovery(shouldResumeAfterContextLoss);
        recoveryNotice.hidden = true;
        recoveryNotice.setAttribute('aria-hidden', 'true');
      });

      observeWebGLContextRecovery(renderer.domElement, {
        onLost: () => {
          shouldResumeAfterContextLoss = sceneScript.pauseForWebGLRecovery();
          webglContextRestored = false;
          recoveryHeading.textContent = 'UTRACONO POŁĄCZENIE Z GPU';
          recoveryCopy.textContent = 'Gra została wstrzymana. Przeglądarka próbuje przywrócić grafikę 3D. Nie zamykaj aplikacji; w razie problemu możesz ją odświeżyć.';
          recoveryResume.textContent = 'OCZEKIWANIE NA PRZYWRÓCENIE';
          recoveryResume.disabled = true;
          recoveryNotice.hidden = false;
          recoveryNotice.setAttribute('aria-hidden', 'false');
          portalOverlayLayers();
          recoveryReload.focus();
        },
        onRestored: () => {
          webglContextRestored = true;
          recoveryHeading.textContent = 'GRAFIKA 3D PRZYWRÓCONA';
          recoveryCopy.textContent = 'Silnik graficzny odzyskał połączenie. Sprawdź obraz i wybierz powrót do menu albo wznowienie wstrzymanej rozgrywki.';
          recoveryResume.textContent = shouldResumeAfterContextLoss ? 'WZNÓW GRĘ' : 'ZAMKNIJ';
          recoveryResume.disabled = false;
          recoveryResume.focus();
        },
      });

      // High fidelity rendering configuration
      {
        const r = renderer;
        const renderProfile = currentDeviceRenderProfile();
        document.documentElement.dataset.renderTier = renderProfile.tier;
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.setPixelRatio(Math.max(0.78, Math.min(window.devicePixelRatio || 1, renderProfile.pixelRatioCap)));
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.08;
        r.shadowMap.enabled = renderProfile.shadowsEnabled;
        r.shadowMap.type = renderProfile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
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
      console.error('[App:Boot] ❌ Nie udało się uruchomić silnika 3D:', e);
      throw new Error(
        e instanceof Error
          ? e.message
          : 'Nie udało się uruchomić silnika 3D. Sprawdź obsługę WebGL i odśwież grę.',
        { cause: e }
      );
    }

    assetLoader.updateProgress(98, 'Synchronizacja bazy Firestore i gotowość...', 'engine', 'FIRESTORE');
    assetLoader.updateCategory('engine', 4, 4);
    await new Promise(r => setTimeout(r, 40));

    assetLoader.updateProgress(100, 'Zasoby gotowe! Witamy w Magazynie Chaosu!', 'engine', 'GOTOWE!');
    await new Promise(r => setTimeout(r, 320));

    clearTimeout(safetyTimeout);
    document.getElementById('boot-recovery-notice')?.remove();
    assetLoader.hide();

    // UMP must refresh consent on every native app launch, before any ad request.
    // It runs in parallel with the final UI reveal; the game itself is never gated by ads.
    void initializeGameAds()
      .then(syncAdMobSettings)
      .catch((error: unknown) => console.warn('[AdMob] Launch consent check skipped:', error));

    // 7. Reveal UI with high priority
    if (shell) {
      shell.classList.remove('hidden');
      shell.style.removeProperty('display');
      shell.style.setProperty('display', 'flex', 'important');
      shell.style.setProperty('z-index', '9999999', 'important');
    }

    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.style.removeProperty('display');
      titleScreen.style.setProperty('display', 'flex', 'important');
      titleScreen.style.setProperty('z-index', '1000000', 'important');
      console.log('[App:Boot] 🎉 Ekran tytułowy gotowy.');
    }

    // Reveal the playable menu immediately. The cinematic intro remains available
    // from the dedicated ODPRAWA button; it must never cover the first menu interaction
    // or prevent the player from starting a run on a touch device.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));

  } catch (err) {
    console.error('[App:Boot] ❌ KRYTYCZNY BŁĄD STARTU:', err);
    clearTimeout(safetyTimeout);
    revealStartupUi();
    const message = err instanceof Error
      ? err.message
      : 'Nie udało się uruchomić gry. Odśwież stronę i spróbuj ponownie.';
    showBootRecoveryNotice(message);
  }
}

// Progressive Web App support for secure mobile browsers.
if ('serviceWorker' in navigator && window.isSecureContext) {
  const serviceWorker = navigator.serviceWorker;
  // Do not show an update prompt for the first installation. A controller
  // change only counts as an update when this page was already SW-controlled.
  const hadActiveController = Boolean(serviceWorker.controller);
  let updateAnnounced = false;

  serviceWorker.addEventListener('controllerchange', () => {
    if (!shouldAnnounceServiceWorkerUpdate(hadActiveController, updateAnnounced)) return;
    updateAnnounced = true;

    // Keep the prompt inside the menu layer. It is therefore visible between
    // runs, but never covers the joystick, action dock or live game HUD.
    const host = document.getElementById('title-screen') || document.body;
    if (document.getElementById('pwa-update-notice')) return;

    const notice = document.createElement('aside');
    notice.id = 'pwa-update-notice';
    notice.className = 'pwa-update-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('aria-atomic', 'true');

    const copy = document.createElement('p');
    copy.className = 'pwa-update-copy';
    copy.textContent = 'Nowa wersja gry jest gotowa. Odśwież po zakończeniu rozgrywki.';

    const actions = document.createElement('div');
    actions.className = 'pwa-update-actions';

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'pwa-update-reload';
    reload.textContent = 'ODŚWIEŻ GRĘ';
    reload.addEventListener('click', () => window.location.reload());

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'pwa-update-dismiss';
    dismiss.textContent = 'PÓŹNIEJ';
    dismiss.addEventListener('click', () => notice.remove());

    actions.append(reload, dismiss);
    notice.append(copy, actions);
    host.appendChild(notice);
  });

  void navigator.serviceWorker.register(`./sw.js?build=${__PALIECIAKI_BUILD_ID__}`, { scope: './' }).then((registration) => {
    // Re-check when the player returns to the app. The browser throttles
    // update checks internally; failures must never block gameplay.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      void registration.update().catch((error: unknown) => {
        console.warn('[App:PWA] Update check unavailable:', error);
      });
    });
  }).catch((error: unknown) => {
    console.warn('[App:PWA] Registration unavailable:', error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void startApp());
} else {
  void startApp();
}


