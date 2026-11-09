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
import { getPvpOperatorAttackCooldown, PVP_OPERATOR_PROFILES, PVP_RAPID_FIRE_COOLDOWN_MULTIPLIER } from './pvpArena.ts';
import type { PvpArenaState, PvpSlot } from './pvpArena.ts';
import { AssetItem, assetLoader } from './assets.ts';
import { SelectiveBloomPipeline } from './selectiveBloom.ts';
import { ThreeClickTrigger } from './menuInteraction.ts';
import { calculateUiViewport, shouldShowTouchControls } from './uiViewport.ts';
import { getAdaptiveEffectsTier, getAdaptiveRenderScale, getDeviceRenderProfile, shouldApplyPixelRatioChange, type AdaptiveEffectsTier } from './renderQuality.ts';
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
import { launchOniricPlatformer } from './oniricPlatformer.ts';
import { getMenuTabIndexForKey } from './menuTabNavigation.ts';
import { readSurvivalMapPreference, writeSurvivalMapPreference } from './survivalMapPreference.ts';
import { getVisibilityPauseAction } from './visibilityPause.ts';
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
// class alone is insufficient in some Android WebViews after the DOM portal
// move, so restore the inline presentation state whenever gameplay begins.
function setTouchControlsVisibility(visible: boolean): void {
  const layer = document.getElementById('touch-controls');
  if (!layer) return;

  // Re-assert the portal whenever the game enters/leaves a run. This makes
  // visibility independent from the order in which the menu, WebGL shell and
  // Android compositor create their stacking contexts.
  if (layer.parentElement !== document.body) {
    document.body.appendChild(layer);
  }
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

  document.getElementById('pvp-hud')?.classList.toggle('hidden', !activePvp);
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
      <rect x="8" y="11" width="16" height="9" fill="#fcd34d"/>
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
      <rect x="8" y="9" width="16" height="11" fill="#fcd34d"/>
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
      <rect x="12" y="20" width="8" height="4" fill="#fcd34d"/>
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
      <rect x="8" y="10" width="16" height="10" fill="#fcd34d"/>
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
      <rect x="9" y="10" width="14" height="9" fill="#fcd34d"/>
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
      <rect x="9" y="10" width="14" height="10" fill="#fcd34d"/>
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
    pixelLayers,
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
  private cinematicIntro: CinematicIntroManager | null = null;
  private selectedCharId: CharacterId = 'marcin';
  private lastScore: number = 0;
  private lastCoins: number = 0;
  private lastTimeSeconds: number = 0;
  private lastBossDefeated: boolean = false;
  private lastMode: 'campaign' | 'survival' | 'pvp' = 'survival';
  private masteryAwardedForRun = false;
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
    let renderCharacterMasteryPanel: (id: CharacterId) => void = () => {};
    let renderAccountProgressionPanels: () => void = () => {};
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

      const duration = type === 'damage' ? 0.7 : type === 'easter-egg' ? 3.6 : type === 'combo' ? 2.0 : 1.6;

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

          try {
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
          if (finalMode) finalMode.textContent = 'SURVIVAL SHIFT';
          const snapshot = this.engine.getSurvivalSnapshot();
          if (runDetail) runDetail.textContent = `FALA ${snapshot.wave} • ${snapshot.kills} ELIMINACJI • POZIOM ${snapshot.level}`;

          // Award mastery exactly once when a Survival run ends. A retry starts a fresh award window.
          if (this.lastMode === 'survival' && !this.masteryAwardedForRun) {
            this.masteryAwardedForRun = true;
            const operatorId = this.engine.getCharacterDef().id;
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
            this.engine.selectCharacter(operatorId, combineAccountAndCharacterBonuses(
              getCharacterTalentBonuses(characterMasteryProfile, operatorId),
              getAccountProgressionBonuses(accountProgressionProfile),
            ));
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


          // The damage table is derived from actual enemy HP removed, not projectile counts.
          const damageReport = this.engine.getSurvivalDamageReport();
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
        },
        onSurvivalUpdate: (snapshot: SurvivalSnapshot) => {
          trackSurvivalAchievementSnapshot(snapshot);
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
        onSurvivalLevelUp: (options: SurvivalUpgradeOption[], context: 'levelup' | 'rank-up' | 'boss-reward' = 'levelup') => {
          if (!survivalUpgradeOptions || !survivalLevelUp) return;
          const isBossReward = context === 'boss-reward';
          const isRankUp = context === 'rank-up';
          const currentRank = survivalRankElem?.textContent || 'OPERATOR';
          survivalLevelUp.dataset.mode = context;
          const titleElement = document.getElementById('survival-levelup-title');
          const descriptionElement = document.getElementById('survival-levelup-desc');
          const iconElement = document.getElementById('survival-levelup-icon');
          const hintElement = document.getElementById('survival-levelup-hint');
          if (titleElement) titleElement.textContent = isBossReward
            ? 'NAGRODA ZA POKONANIE BOSS-A'
            : isRankUp ? 'AWANS RANGI: ' + currentRank : 'AWANS OPERATORA';
          if (descriptionElement) descriptionElement.textContent = isBossReward
            ? 'Boss pokonany. Wybierz jedno z trzech legendarnych wzmocnień: moc, rozwój broni albo obronę.'
            : isRankUp
              ? 'Awansujesz do rangi ' + currentRank + '. Jedna karta ma gwarantowaną wyższą rzadkość, a zapas przerzutów zwiększono o 1.'
              : 'Wybierz jeden z trzech modułów. Rzadkie, epickie i legendarne wersje wzmacniają ten sam efekt.';
          if (iconElement) iconElement.textContent = isBossReward ? '🏆' : isRankUp ? '🎖️' : '⬆';
          if (hintElement) hintElement.textContent = isBossReward
            ? 'Nagroda jest obowiązkowa i nie podlega przerzuceniu ani pominięciu. Akcja pozostaje wstrzymana do wyboru.'
            : isRankUp
              ? 'Awans co 5 poziomów: karta ma co najmniej Rare, Epic lub Legendary zależnie od rangi. Dodatkowy przerzut jest ograniczony do 3.'
              : 'Wybór zatrzymuje akcję. Rzadkość wzmacnia efekt; legendarna broń może odblokować się na wyższym poziomie.';
          survivalRerollBtn?.classList.toggle('hidden', isBossReward);
          survivalSkipBtn?.classList.toggle('hidden', isBossReward);
          survivalUpgradeOptions.replaceChildren();
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
      if (abilityName) abilityName.textContent = def.abilityName;

      const abilityIcons: Record<CharacterId, string> = {
        marcin: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M15 10h18a4 4 0 0 1 4 4v25H11V14a4 4 0 0 1 4-4Z'/><path d='M19 10V7h10v3M17 19h12M17 26l3 3 5-6M29 27h4M17 34h15'/><path d='m33 15 1.6 2.4 2.8.8-2.8.9-1.6 2.4-1.5-2.4-2.8-.9 2.8-.8Z' fill='currentColor' stroke='none'/></svg>",
        grzesiek: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.7' stroke-linecap='round' stroke-linejoin='round'><path d='M8 19v10M13 15v18M35 15v18M40 19v10M13 24h22'/><path d='M6 14v20M42 14v20'/><path d='m24 8 2.4 5.2 5.7.8-4.1 4 1 5.7-5-2.7-5 2.7 1-5.7-4.1-4 5.7-.8Z' fill='currentColor' stroke='none' opacity='.28'/></svg>",
        dawid: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M24 6 39 12v11c0 9-6.5 15-15 19C15.5 38 9 32 9 23V12Z'/><path d='M15 17h18M13 23h22M16 29h16M19 35h10'/><path d='m30 12 4 4-4 4M18 27l-4 4 4 4' opacity='.78'/></svg>",
        mateusz: "<svg class='operator-action-svg' viewBox='0 0 48 48' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='m9 18 3-10 9 7h6l9-7 3 10v11c0 8-7 12-15 12S9 37 9 29Z'/><path d='M17 25h.1M31 25h.1M19 33q5 4 10 0'/><path d='m27 16-5 10h5l-3 8 9-12h-5l3-6Z' fill='currentColor' stroke='none'/></svg>",
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
        const roleLabel = card.querySelector<HTMLElement>('.char-card-role');
        const identityLabel = card.querySelector<HTMLElement>('.char-card-ability');
        card.style.setProperty('--operator-accent', `#${accent}`);
        if (roleLabel) roleLabel.textContent = definition.className;
        if (identityLabel) identityLabel.textContent = definition.combatIdentity;
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

      updateFirestoreStatusUI('checking', 'Testowanie połączenia...');
      leaderboardLoading.classList.remove('hidden');
      leaderboardLoading.textContent = 'Łączenie z bazą Firebase Firestore...';
      leaderboardList.classList.add('hidden');
      leaderboardList.innerHTML = '';

      try {
        const services = await loadFirebaseLeaderboardServices();
        const isConnected = await services.ensureLeaderboardServices();
        if (isConnected) {
          updateFirestoreStatusUI('online', 'Baza Firestore: Online');
        } else {
          updateFirestoreStatusUI('offline', 'Baza Firestore: Tryb Offline');
        }

        const topScores = await services.getTopSurvivalLeaderboard(15);
        leaderboardLoading.classList.add('hidden');
        leaderboardList.classList.remove('hidden');

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
        leaderboardLoading.textContent = '❌ Nie udało się pobrać rankingu. Sprawdź połączenie z bazą Firebase.';
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
    menuTabList?.setAttribute('role', 'tablist');
    menuTabList?.setAttribute('aria-label', 'Sekcje menu głównego');
    const menuTabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-tab-btn'));

    document.getElementById('btn-account-cloud-sync')?.addEventListener('click', () => {
      void this.syncAccountProgressionWithCloud();
    });
    document.getElementById('btn-account-google-connect')?.addEventListener('click', () => {
      void this.connectAccountProgressionToGoogle();
    });

    const activateMenuTab = (selectedTab: HTMLButtonElement) => {
      const targetId = selectedTab.getAttribute('data-tab');
      if (!targetId) return;

      menuTabButtons.forEach((button) => {
        const active = button === selectedTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });

      document.querySelectorAll<HTMLElement>('.tab-panel').forEach((panel) => {
        const active = panel.id === targetId;
        panel.classList.toggle('active', active);
        panel.setAttribute('aria-hidden', String(!active));
        if (active) panel.setAttribute('aria-labelledby', selectedTab.id);
      });

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
      }
      const initiallyActive = tabBtn.classList.contains('active');
      tabBtn.setAttribute('aria-selected', String(initiallyActive));
      tabBtn.tabIndex = initiallyActive ? 0 : -1;

      // A native click is generated for touch input; a second touchend handler
      // caused the same selection and lazy panel work to run twice on phones.
      tabBtn.addEventListener('click', () => activateMenuTab(tabBtn));
      tabBtn.addEventListener('keydown', (event: KeyboardEvent) => {
        const nextIndex = getMenuTabIndexForKey(event.key, index, menuTabButtons.length);
        if (nextIndex === null) return;
        event.preventDefault();
        const nextTab = menuTabButtons[nextIndex];
        if (!nextTab) return;
        activateMenuTab(nextTab);
        nextTab.focus();
      });
    });

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
    let selectedSurvivalMapId: SurvivalMapId | null = (() => {
      try {
        return readSurvivalMapPreference(window.localStorage);
      } catch {
        return null;
      }
    })();
    const survivalMapPicker = document.getElementById('survival-map-picker');
    const survivalMapPickerHint = document.getElementById('survival-map-picker-hint');
    const survivalMapPreviewTitle = document.getElementById('survival-map-preview-title');
    const survivalMapPreviewDetail = document.getElementById('survival-map-preview-detail');

    const applySurvivalMapChoice = (choice: string, persist: boolean) => {
      const mapButton = Array.from(
        survivalMapPicker?.querySelectorAll<HTMLButtonElement>('[data-survival-map]') || []
      ).find((option) => option.dataset.survivalMap === choice);
      if (!mapButton) return;

      if (choice === 'random') {
        selectedSurvivalMapId = null;
        if (survivalMapPreviewTitle) survivalMapPreviewTitle.textContent = 'ROTACJA AREN';
        if (survivalMapPreviewDetail) survivalMapPreviewDetail.textContent = 'Losowanie bez powtórzenia poprzedniej mapy. Każda arena ma własny układ osłon i tras.';
        if (survivalMapPickerHint) survivalMapPickerHint.textContent = 'Losowanie wybierze jedną z czterech aren.';
      } else if (Object.prototype.hasOwnProperty.call(SURVIVAL_MAPS, choice)) {
        selectedSurvivalMapId = choice as SurvivalMapId;
        const map = SURVIVAL_MAPS[selectedSurvivalMapId];
        if (survivalMapPreviewTitle) survivalMapPreviewTitle.textContent = map.name.toUpperCase() + ' • ' + map.subtitle;
        if (survivalMapPreviewDetail) survivalMapPreviewDetail.textContent = map.description;
        if (survivalMapPickerHint) survivalMapPickerHint.textContent = map.combatModifier.title + ' • ' + map.combatModifier.description;
      } else {
        return;
      }

      survivalMapPicker?.querySelectorAll<HTMLButtonElement>('[data-survival-map]').forEach((option) => {
        const active = option === mapButton;
        option.classList.toggle('is-selected', active);
        option.setAttribute('aria-pressed', String(active));
      });

      if (persist) {
        try {
          writeSurvivalMapPreference(window.localStorage, selectedSurvivalMapId);
        } catch {
          // The menu remains usable when browser storage is restricted.
        }
      }
    };

    // Restore the last arena on return to the menu; first launch still defaults to rotation.
    applySurvivalMapChoice(selectedSurvivalMapId || 'random', false);
    survivalMapPicker?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-survival-map]');
      if (!button || !survivalMapPicker.contains(button)) return;
      applySurvivalMapChoice(button.dataset.survivalMap || 'random', true);
    });

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
        this.engine.startSurvival(selectedSurvivalMapId);
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

    bindTap(document.getElementById('btn-start-survival'), doStartSurvival);

    window.addEventListener('keydown', (e) => {
      if (titleScreen && !titleScreen.classList.contains('hidden')) {
        if (e.code === 'Enter' || e.code === 'Space') {
          doStartSurvival();
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
                titleScreen.style.removeProperty('display');
                titleScreen.style.setProperty('display', 'flex', 'important');
                titleScreen.style.setProperty('z-index', '1000000', 'important');
              }
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

    document.getElementById('btn-ability')?.addEventListener('click', () => {
      if (this.engine.getGameMode() === 'pvp') {
        this.engine.triggerPvpAbility();
      } else {
        this.engine.triggerAbility();
      }
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


    const activeTouchMode = (): TouchControlsMode =>
      this.engine.getGameMode() === 'pvp' ? 'pvp' : 'survival';

    const handlePause = () => {
      if (this.engine.getGameState() !== 'playing') return;
      this.resetTouchJoystick?.();
      this.engine.togglePause();
      this.pausedForVisibility = false;
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
      this.pausedForVisibility = false;
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
      this.engine.startSurvival(selectedSurvivalMapId);
      setTouchControlsMode('survival');
      setTouchControlsVisibility(true);
    });

    const exitPausedRunToMenu = () => {
      const leavingPvp = this.engine.getGameMode() === 'pvp';
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
      this.engine.startTitle();
    };
    bindTap(document.getElementById('btn-menu-pause'), exitPausedRunToMenu);

    bindTap(document.getElementById('btn-retry'), () => {
      gameoverModal?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      hudTop?.classList.remove('hidden');
      hudBottom?.classList.remove('hidden');
      setTouchControlsVisibility(true);
      setTouchControlsMode('survival');
      this.masteryAwardedForRun = false;
      this.engine.startSurvival(selectedSurvivalMapId);
        // Re-assert visibility and exclusive mode after the scene transition.
        setTouchControlsMode('survival');
        setTouchControlsVisibility(true);
    });

    bindTap(document.getElementById('btn-menu-gameover'), () => {
      gameoverModal?.classList.add('hidden');
      survivalHud?.classList.add('hidden');
      survivalLevelUp?.classList.add('hidden');
      setTouchControlsMode('hidden');
      if (titleScreen) {
        titleScreen.classList.remove('hidden');
        titleScreen.style.setProperty('display', 'flex', 'important');
      }
      this.engine.startTitle();
      void showInterstitialAfterRun();
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
          feedbackMsg.textContent = 'Wysyłanie wyniku do rankingu Survival...';
          feedbackMsg.classList.remove('hidden');
        }

        try {
          const services = await loadFirebaseLeaderboardServices();
          const result = await services.submitScore({
            playerName,
            hero: CHARACTERS[this.selectedCharId].name,
            mode: this.lastMode === 'pvp' ? 'survival' : this.lastMode,
            score: this.lastScore,
            coins: this.lastCoins,
            timeSeconds: this.lastTimeSeconds,
            bossDefeated: this.lastBossDefeated,
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
        this.pausedForVisibility,
      );

      if (action === 'pause') {
        this.resetTouchJoystick?.();
        this.engine.togglePause();
        this.pausedForVisibility = true;
        setTouchControlsVisibility(false);
        pauseModal?.classList.remove('hidden');
        pauseModal?.setAttribute('aria-hidden', 'false');
        pauseModal?.style.setProperty('display', 'flex', 'important');
        pauseModal?.style.setProperty('z-index', '2147483012', 'important');
      } else if (action === 'resume') {
        this.engine.togglePause();
        this.pausedForVisibility = false;
        pauseModal?.classList.add('hidden');
        pauseModal?.setAttribute('aria-hidden', 'true');
        pauseModal?.style.removeProperty('display');
        setTouchControlsMode(activeTouchMode());
        setTouchControlsVisibility(true);
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
      titleScreen.style.removeProperty('display');
      titleScreen.style.setProperty('display', 'flex', 'important');
      titleScreen.style.setProperty('z-index', '1000000', 'important');
    }
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
      const fireControlSize = viewportHeight <= 430 ? 68 : 78;
      const origin = clampTouchJoystickOrigin({
        viewportWidth,
        viewportHeight,
        mode: isPvpTouch ? 'pvp' : 'survival',
        touchX: event.clientX,
        touchY: event.clientY,
        joystickSize,
        fireButtonSize: viewportHeight <= 430 ? 68 : 78,
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
    if (renderer && core && scene && currentDeviceRenderProfile(width).bloomEnabled && renderer.extensions.has('EXT_color_buffer_float')) {
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

    // Move critical dialogs out of the game shell's stacking context. The
    // mobile controls are portaled to <body> at a very high z-index; keeping
    // dialogs inside #game-shell can put visible buttons underneath that layer.
    for (const dialog of [pvpLobbyModal, matchEndModal, pauseModal]) {
      if (dialog && dialog.parentElement !== document.body) document.body.appendChild(dialog);
    }

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
      const operatorId = (pvpFireButton?.dataset.operator as CharacterId | undefined) || this.selectedPvpOperator;
      startPvpFireCooldown(getPvpOperatorAttackCooldown(operatorId));
      sound.playAttackWhoosh();
    };
    bindPvpTap(pvpFireButton, triggerPrimaryPvpShot);
    // Desktop uses the existing bottom-dock attack slot; mobile uses the
    // dedicated large fire button directly above the movement joystick.
    bindPvpTap(desktopPvpFireButton, triggerPrimaryPvpShot);

    opPicker?.querySelectorAll<HTMLButtonElement>('.pvp-operator-btn').forEach((btn) => {
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

      pvpHud?.classList.remove('hidden');
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
        setMatchmakingUiPhase('idle');
        setPvpConnectionStatus('error', 'POKÓJ ZAMKNIĘTY', message);
      };
      session.onError = (error) => {
        if (matchmakingSession !== session) return;
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
        setMatchmakingUiPhase('idle');
        if (hostStatus) hostStatus.textContent = message;
      };
      netSession.onRoomJoined = (roomCode, slot, roomState) => {
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
        setMatchmakingUiPhase('idle');
        if (joinStatus) {
          joinStatus.classList.remove('hidden');
          joinStatus.textContent = message;
        }
      };
      netSession.onRoomJoined = (roomCode, slot, roomState) => {
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
      matchEndModal?.classList.add('hidden');
      pvpHud?.classList.add('hidden');
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
    if (p1Avatar) p1Avatar.textContent = (CHARACTERS[state.p1.operatorId] as any)?.icon || '👷‍♂️';

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
    if (p2Avatar) p2Avatar.textContent = (CHARACTERS[state.p2.operatorId] as any)?.icon || '🔧';

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
      const localPlayer = localSlot === 'p1' ? state.p1 : state.p2;
      if (localPlayer.activePerk === 'shield' && localPlayer.shieldHp > 0) perkStatus.textContent = `TARCZA AKTYWNA • ${Math.ceil(localPlayer.shieldHp)} HP`;
      else if (localPlayer.activePerk && localPlayer.perkTimer > 0) perkStatus.textContent = `TWÓJ PERK: ${perkNames[localPlayer.activePerk] || 'AKTYWNY'} • ${Math.ceil(localPlayer.perkTimer)} s`;
      else if (state.perkDrop.active) perkStatus.textContent = `KAPSUŁA: ${perkNames[state.perkDrop.type] || 'LOSOWY PERK'} • ZBIERZ NA ARENIE`;
      else perkStatus.textContent = `NOWA KAPSUŁA ZA ${Math.ceil(state.perkDrop.spawnTimer)} s • SPRAWDŹ MAPĘ`;
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
      this.engine.selectCharacter(
        this.selectedCharId,
        combineAccountAndCharacterBonuses(
          getCharacterTalentBonuses(characterMasteryProfile, this.selectedCharId),
          getAccountProgressionBonuses(accountProgressionProfile),
        ),
      );
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

    this.restoreSelectiveBloomOverride?.();
    this.restoreSelectiveBloomOverride = null;
    this.selectiveBloom?.dispose();
    this.selectiveBloom = null;
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
  console.log('%c[App:Boot] 🚀 Start gry Paleciaki! Magazyn Chaosu...', 'color: #38bdf8; font-weight: bold;');
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
    options.setAppTitle('Paleciaki! Magazyn Chaosu');
    
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


