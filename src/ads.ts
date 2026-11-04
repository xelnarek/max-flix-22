import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

type ConsentResult = { enabled: boolean; privacyOptionsRequired: boolean };
const config = __PALIECIAKI_ADS__;
const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

let initialization: Promise<ConsentResult> | null = null;
let sdkReady = false;
let adsAllowed = false;
let rewardedReady = false;
let interstitialReady = false;
let privacyOptionsRequired = false;
let rewardedLoad: Promise<void> | null = null;
let interstitialLoad: Promise<void> | null = null;

async function loadRewarded(): Promise<void> {
  if (!sdkReady || rewardedReady || rewardedLoad) return rewardedLoad ?? Promise.resolve();
  rewardedLoad = AdMob.prepareRewardVideoAd({ adId: config.rewardedId, isTesting: config.isTesting })
    .then(() => { rewardedReady = true; })
    .catch((error: unknown) => {
      rewardedReady = false;
      console.warn('[AdMob] Rewarded ad not ready:', error);
    })
    .finally(() => { rewardedLoad = null; });
  return rewardedLoad;
}

async function loadInterstitial(): Promise<void> {
  if (!sdkReady || interstitialReady || interstitialLoad) return interstitialLoad ?? Promise.resolve();
  interstitialLoad = AdMob.prepareInterstitial({ adId: config.interstitialId, isTesting: config.isTesting })
    .then(() => { interstitialReady = true; })
    .catch((error: unknown) => {
      interstitialReady = false;
      console.warn('[AdMob] Interstitial not ready:', error);
    })
    .finally(() => { interstitialLoad = null; });
  return interstitialLoad;
}

/** UMP consent is obtained before initializing Google Mobile Ads. Native Android only. */
export function initializeGameAds(): Promise<ConsentResult> {
  if (!isNativeAndroid()) return Promise.resolve({ enabled: false, privacyOptionsRequired: false });
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      let consent = await AdMob.requestConsentInfo();
      privacyOptionsRequired = String(consent.privacyOptionsRequirementStatus).toLowerCase() === 'required';
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
        privacyOptionsRequired = String(consent.privacyOptionsRequirementStatus).toLowerCase() === 'required';
      }
      if (!consent.canRequestAds) {
        adsAllowed = false;
        return { enabled: false, privacyOptionsRequired };
      }

      if (!sdkReady) {
        await AdMob.initialize();
        sdkReady = true;
      }
      adsAllowed = true;
      // Consent is complete; start preloading in the background so ad network
      // latency never delays the player's transition into a run.
      void Promise.all([loadRewarded(), loadInterstitial()]);
      return { enabled: true, privacyOptionsRequired };
    } catch (error) {
      console.warn('[AdMob] Consent/initialization unavailable; gameplay continues without ads:', error);
      return { enabled: false, privacyOptionsRequired };
    }
  })();
  return initialization;
}

export function areGameAdsReady(): boolean {
  return sdkReady && adsAllowed && isNativeAndroid();
}
export function hasAdPrivacyOptions(): boolean {
  return privacyOptionsRequired && isNativeAndroid();
}
export async function showAdPrivacyOptions(): Promise<ConsentResult> {
  if (!isNativeAndroid() || !privacyOptionsRequired) {
    return { enabled: areGameAdsReady(), privacyOptionsRequired };
  }
  try {
    await AdMob.showPrivacyOptionsForm();
    const consent = await AdMob.requestConsentInfo();
    privacyOptionsRequired = String(consent.privacyOptionsRequirementStatus).toLowerCase() === 'required';
    adsAllowed = consent.canRequestAds;

    if (adsAllowed && !sdkReady) {
      await AdMob.initialize();
      sdkReady = true;
    }
    if (adsAllowed) {
      void Promise.all([loadRewarded(), loadInterstitial()]);
    }

    const result = { enabled: areGameAdsReady(), privacyOptionsRequired };
    // Keep the shared consent promise aligned with the user's latest choice.
    initialization = Promise.resolve(result);
    return result;
  } catch (error) {
    console.warn('[AdMob] Privacy options form is unavailable:', error);
    return { enabled: areGameAdsReady(), privacyOptionsRequired };
  }
}

/** Returns true only when the native SDK confirms that the player earned the reward. */
export async function showRewardedRerollAd(): Promise<boolean> {
  if (!areGameAdsReady()) return false;
  if (!rewardedReady) await loadRewarded();
  if (!rewardedReady) return false;

  rewardedReady = false;
  try {
    const reward = await AdMob.showRewardVideoAd({ adId: config.rewardedId });
    return Number(reward.amount) > 0;
  } catch (error) {
    console.warn('[AdMob] Rewarded ad was not completed:', error);
    return false;
  } finally {
    void loadRewarded();
  }
}

/**
 * Interstitials appear only after the player chooses "main menu": once per
 * three completed runs at most, with a four-minute cooldown. Never mid-run.
 */
export async function showInterstitialAfterRun(): Promise<void> {
  if (!areGameAdsReady()) return;
  let returns = 0;
  let lastShown = 0;
  try {
    returns = Number.parseInt(localStorage.getItem('paleciaki.admob.menuReturns.v1') || '0', 10) || 0;
    lastShown = Number.parseInt(localStorage.getItem('paleciaki.admob.lastInterstitial.v1') || '0', 10) || 0;
    returns++;
    localStorage.setItem('paleciaki.admob.menuReturns.v1', String(returns));
  } catch {
    returns = 0;
  }

  if (returns === 0 || returns % 3 !== 0 || Date.now() - lastShown < 4 * 60 * 1000) return;
  if (!interstitialReady) await loadInterstitial();
  if (!interstitialReady) return;

  interstitialReady = false;
  try {
    await AdMob.showInterstitial({ adId: config.interstitialId });
    try {
      localStorage.setItem('paleciaki.admob.lastInterstitial.v1', String(Date.now()));
    } catch { /* unavailable local storage */ }
  } catch (error) {
    console.warn('[AdMob] Interstitial could not be shown:', error);
  } finally {
    void loadInterstitial();
  }
}
