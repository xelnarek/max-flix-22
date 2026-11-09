import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCampaignLightingProfile,
  getSurvivalLightingProfile,
  getSurvivalSurfaceProfile,
  PVP_LIGHTING_PROFILE,
} from '../src/worldVisualQuality.ts';

const MAPS = ['warehouse_b4', 'container_terminal', 'cold_storage', 'night_sorting'];

test('each Survival map has a distinct atmosphere without sacrificing legibility', () => {
  const profiles = MAPS.map((id) => getSurvivalLightingProfile(id));
  assert.equal(new Set(profiles.map((p) => p.fogColor)).size, 4);
  assert.equal(new Set(profiles.map((p) => p.rimColor)).size, 4);
  for (const p of profiles) {
    assert.ok(p.ambientIntensity >= 0.85 && p.ambientIntensity <= 1.05);
    assert.ok(p.hemisphereIntensity >= 1.1 && p.hemisphereIntensity <= 1.45);
    assert.ok(p.directionalIntensity >= 2.2 && p.directionalIntensity <= 3.1);
    assert.ok(p.fogNear > 0 && p.fogFar > p.fogNear);
    assert.ok(p.environmentIntensity >= 0.35 && p.environmentIntensity <= 0.6);
    assert.ok(p.exposure >= 1 && p.exposure <= 1.12);
  }
});

test('Survival maps use different bounded PBR finishes and freight palettes', () => {
  const profiles = MAPS.map((id) => getSurvivalSurfaceProfile(id));
  assert.equal(new Set(profiles.map((p) => p.floorRoughness)).size, 4);
  assert.equal(new Set(profiles.map((p) => p.wallMetalness)).size, 4);
  assert.equal(new Set(profiles.map((p) => p.trimEmissiveIntensity)).size, 4);
  for (const p of profiles) {
    for (const value of [
      p.floorRoughness, p.floorMetalness, p.wallRoughness, p.wallMetalness,
      p.trimRoughness, p.trimMetalness, p.trimEmissiveIntensity,
      p.barrierRoughness, p.barrierMetalness,
    ]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    assert.equal(p.crateColors.length, 3);
    assert.equal(new Set(p.crateColors).size, 3);
  }
});

test('Campaign keeps four sector palettes and invalid sector input falls back safely', () => {
  const profiles = [1, 2, 3, 4].map(getCampaignLightingProfile);
  assert.equal(new Set(profiles.map((p) => p.rimColor)).size, 4);
  assert.deepEqual(getCampaignLightingProfile(0), getCampaignLightingProfile(1));
  assert.deepEqual(getCampaignLightingProfile(Number.NaN), getCampaignLightingProfile(1));
});

test('PvP has its own neutral-blue and warm-key lighting profile', () => {
  assert.notEqual(PVP_LIGHTING_PROFILE.fogColor, getSurvivalLightingProfile('warehouse_b4').fogColor);
  assert.equal(PVP_LIGHTING_PROFILE.rimColor, 0x55c5ed);
  assert.ok(PVP_LIGHTING_PROFILE.fogFar > PVP_LIGHTING_PROFILE.fogNear);
  assert.ok(PVP_LIGHTING_PROFILE.backgroundColor > 0);
  assert.ok(PVP_LIGHTING_PROFILE.ambientIntensity >= 0.82 && PVP_LIGHTING_PROFILE.ambientIntensity <= 0.92);
  assert.ok(PVP_LIGHTING_PROFILE.directionalIntensity >= 2.4 && PVP_LIGHTING_PROFILE.directionalIntensity <= 2.9);
  assert.ok(PVP_LIGHTING_PROFILE.rimIntensity > PVP_LIGHTING_PROFILE.ambientIntensity);
  assert.ok(PVP_LIGHTING_PROFILE.exposure >= 1 && PVP_LIGHTING_PROFILE.exposure <= 1.08);
});
