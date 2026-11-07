import { defineConfig } from 'vite';

import { attachPvpWebSocketServer } from './src/server/pvpServer.ts';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const isAiStudio = Boolean(
    process.env.AI_STUDIO ||
      process.env.GITHUB_CODESPACES ||
      process.env.CODESPACES ||
      process.env.VITEST
  );

  const demoAppId = 'ca-app-pub-3940256099942544~3347511713';
  const demoRewardedId = 'ca-app-pub-3940256099942544/5224354917';
  const demoInterstitialId = 'ca-app-pub-3940256099942544/1033173712';
  const configuredAppId = process.env.ADMOB_APP_ID?.trim() ?? '';
  const configuredRewardedId = process.env.VITE_ADMOB_REWARDED_ID?.trim() ?? '';
  const configuredInterstitialId = process.env.VITE_ADMOB_INTERSTITIAL_ID?.trim() ?? '';
  const hasProductionAdMobConfig =
    /^ca-app-pub-\d+~\d+$/.test(configuredAppId) &&
    /^ca-app-pub-\d+\/\d+$/.test(configuredRewardedId) &&
    /^ca-app-pub-\d+\/\d+$/.test(configuredInterstitialId);

  const admobConfig = {
    appId: hasProductionAdMobConfig ? configuredAppId : demoAppId,
    rewardedId: hasProductionAdMobConfig ? configuredRewardedId : demoRewardedId,
    interstitialId: hasProductionAdMobConfig ? configuredInterstitialId : demoInterstitialId,
    isTesting: !hasProductionAdMobConfig,
  };

  return {
    base: './',
    define: {
      __PALIECIAKI_ADS__: JSON.stringify(admobConfig),
    },
    plugins: [
      {
        name: 'pvp-websocket-server',
        configureServer(server) {
          if (server.httpServer) {
            attachPvpWebSocketServer(server.httpServer);
          }
        },
        configurePreviewServer(server) {
          if (server.httpServer) {
            attachPvpWebSocketServer(server.httpServer);
          }
        },
      },
    ],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: false,
      allowedHosts: true,
      hmr: false,
      watch: {
        usePolling: isAiStudio || isDev,
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false,
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      reportCompressedSize: false,
      rollupOptions: {
        external: ['@pmndrs/uikit/webgpu'],
        output: {
          manualChunks: {
            'vendor-three': ['three'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        'three',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        '@pmndrs/uikit',
      ],
      esbuildOptions: {
        target: 'esnext',
      },
    },
  };
});
