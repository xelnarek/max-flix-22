import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('SoundEngine configures master DynamicsCompressor limiter, cached explosion noise, adaptive synth music, and UI/combat SFX', async () => {
  const soundSource = await read('../src/sound.ts');

  assert.match(soundSource, /createDynamicsCompressor\(/);
  assert.match(soundSource, /masterCompressor/);
  assert.match(soundSource, /getExplosionNoiseBuffer\(/);
  assert.match(soundSource, /setMusicIntensity\(intensity: 'menu' \| 'combat' \| 'boss'\)/);
  assert.match(soundSource, /startMusic\(intensity\?: 'menu' \| 'combat' \| 'boss'\)/);

  for (const method of [
    'playUiHover',
    'playUiTabSwitch',
    'playUiSelect',
    'playUiConfirm',
    'playUiBack',
    'playDash',
    'playXpPickup',
    'playEnemyDeath',
    'playCritPing',
    'playLevelUpFanfare',
  ]) {
    assert.match(soundSource, new RegExp(`public ${method}\\(`), `missing sound method ${method}`);
  }
});

test('Main UI and PvP lobby replace melee smack taps with crisp UI SFX and level-up fanfares', async () => {
  const indexSource = await read('../src/index.ts');

  assert.match(indexSource, /sound\.playLevelUpFanfare\(/);
  assert.match(indexSource, /sound\.playUiConfirm\(/);
  assert.match(indexSource, /sound\.playUiSelect\(/);
  assert.match(indexSource, /sound\.playUiTabSwitch\(/);
  assert.match(indexSource, /sound\.playUiBack\(/);
  assert.doesNotMatch(indexSource, /setupPvpLobby[\s\S]*playSmack\(/);
});

test('GameEngine wires zero-GC XP magnet sparkles, vertical firearm bloom beacons, dash trails, crit sparks, and adaptive music states', async () => {
  const gameSource = await read('../src/game.ts');

  assert.match(gameSource, /private readonly xpTargetScratch = new THREE\.Vector3\(\)/);
  assert.match(gameSource, /survivalXpGemMaterial[\s\S]{0,300}bloomEmitter:\s*true/);
  assert.match(gameSource, /createSurvivalFirearmDropVisual[\s\S]{0,1600}bloomEmitter:\s*true/);
  assert.match(gameSource, /sound\.setMusicIntensity\('menu'\)/);
  assert.match(gameSource, /sound\.startMusic\('combat'\)/);
  assert.match(gameSource, /sound\.setMusicIntensity\('boss'\)/);
  assert.match(gameSource, /sound\.setMusicIntensity\('combat'\)/);
  assert.match(gameSource, /sound\.playXpPickup\(streak\.tier\)/);
  assert.match(gameSource, /sound\.playCritPing\(\)/);
  assert.match(gameSource, /sound\.playDash\(\)/);
  assert.match(gameSource, /sound\.playEnemyDeath\(/);
});

test('Menu and HUD CSS avoid heavy backdrop-filter during WebGL combat and style interactive focus states', async () => {
  const [polishCss, repairCss] = await Promise.all([
    read('../src/visual-polish.css'),
    read('../src/menu-single-sidebar-repair.css'),
  ]);

  assert.doesNotMatch(polishCss, /\.hero-badge[\s\S]{0,200}backdrop-filter:/);
  assert.doesNotMatch(polishCss, /\.survival-hud-main[\s\S]{0,200}backdrop-filter:/);
  assert.match(repairCss, /\.menu-tab-btn:focus-visible/);
  assert.match(repairCss, /\.menu-mode-card:hover/);
  assert.match(repairCss, /\.menu-mode-card\[data-mode="campaign"\]:hover/);
});
