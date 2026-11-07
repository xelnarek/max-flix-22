declare module 'troika-three-text' {
  export * from 'troika-types/packages/troika-three-text/dist/src/index';
}

declare const __PALIECIAKI_ADS__: Readonly<{
  appId: string;
  rewardedId: string;
  interstitialId: string;
  isTesting: boolean;
}>;

interface ImportMetaEnv {
  readonly VITE_PVP_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
