import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_PVP_SOCKET_URL,
  resolvePvpSocketUrl,
} from '../src/pvpSocketUrl.ts';

test('Capacitor Android secure localhost connects to the public WSS service, not itself', () => {
  assert.equal(resolvePvpSocketUrl({
    hostname: 'localhost',
    host: 'localhost',
    protocol: 'https:',
  }), DEFAULT_PVP_SOCKET_URL);
});

test('GitHub Pages uses the public TLS WebSocket service', () => {
  assert.equal(resolvePvpSocketUrl({
    hostname: 'xelnarek.github.io',
    host: 'xelnarek.github.io',
    protocol: 'https:',
  }), DEFAULT_PVP_SOCKET_URL);
});

test('plain HTTP localhost remains connected to the local Vite WebSocket endpoint', () => {
  assert.equal(resolvePvpSocketUrl({
    hostname: 'localhost',
    host: 'localhost:3000',
    protocol: 'http:',
  }), 'ws://localhost:3000/pvp-ws');
});

test('custom hostnames use secure same-origin WebSocket by default', () => {
  assert.equal(resolvePvpSocketUrl({
    hostname: 'game.example.com',
    host: 'game.example.com',
    protocol: 'https:',
  }), 'wss://game.example.com/pvp-ws');
});

test('configured WebSocket URL overrides runtime inference', () => {
  assert.equal(resolvePvpSocketUrl({
    configuredUrl: 'wss://pvp.example.net/socket',
    hostname: 'localhost',
    host: 'localhost',
    protocol: 'https:',
  }), 'wss://pvp.example.net/socket');
});

test('secure pages reject insecure configured WebSocket URLs', () => {
  assert.equal(resolvePvpSocketUrl({
    configuredUrl: 'ws://pvp.example.net/socket',
    hostname: 'localhost',
    host: 'localhost',
    protocol: 'https:',
  }), null);
});

test('invalid explicit configuration fails closed', () => {
  assert.equal(resolvePvpSocketUrl({
    configuredUrl: 'not a valid URL',
    hostname: 'xelnarek.github.io',
    host: 'xelnarek.github.io',
    protocol: 'https:',
  }), null);
});

test('Android and web release configuration include the public PvP endpoint and trusted WebView origins', async () => {
  const [androidWorkflow, renderConfig, capacitorConfig, client] = await Promise.all([
    readFile(new URL('../.github/workflows/android-release.yml', import.meta.url), 'utf8'),
    readFile(new URL('../render.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(androidWorkflow, /VITE_PVP_WS_URL:/);
  assert.match(androidWorkflow, /wss:\/\/paleciaki-pvp\.onrender\.com\/pvp-ws/);
  assert.match(renderConfig, /https:\/\/localhost/);
  assert.match(renderConfig, /capacitor:\/\/localhost/);
  assert.match(capacitorConfig, /appId/);
  assert.match(client, /resolvePvpSocketUrl/);
});
