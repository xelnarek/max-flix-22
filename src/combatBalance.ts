import type { CharacterId } from './types.ts';

export type CombatGameMode = 'campaign' | 'survival';

export const CAMPAIGN_ATTACK_COOLDOWN_SECONDS: Readonly<Record<CharacterId, number>> = Object.freeze({
  marcin: 1.05,
  grzesiek: 1.22,
  dawid: 1.14,
  mateusz: 1.10,
  piotr: 1.25,
});

export const SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS = 3.25;
export const SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS = 1.05;
export const SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR = 0.75;

export const SURVIVAL_WEAPON_UNLOCK_SECONDS = Object.freeze({
  pallet_cannon: 120,
  diamond_saw: 210,
  glue_mine: 300,
  kfc_bomber: 390,
  piorun_drone: 480,
  forklift_bolter: 570,
  scanner_pulse: 660,
  orbit_blades: 750,
  calacatta_shards: 840,
  steam_bomb: 930,
  forklift_horn: 1020,
  wz_boomerang: 1110,
});

export function getBaseAttackCooldownSeconds(characterId: CharacterId, mode: CombatGameMode): number {
  return mode === 'survival'
    ? SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS
    : CAMPAIGN_ATTACK_COOLDOWN_SECONDS[characterId];
}

export function getAbilityCooldownSeconds(baseCooldown: number, mode: CombatGameMode): number {
  const safeBase = Number.isFinite(baseCooldown) ? Math.max(0, baseCooldown) : 0;
  return safeBase * (mode === 'survival' ? 2.0 : 1.25);
}

/**
 * Reload intervals improve gradually with weapon levels. Evolution is a modest
 * cadence improvement, not a licence for the whole arsenal to become a volley.
 */
export function getSurvivalWeaponReloadSeconds(baseCooldown: number, level: number, evolved = false): number {
  const safeBase = Number.isFinite(baseCooldown) ? Math.max(0, baseCooldown) : 0;
  const safeLevel = Number.isFinite(level) ? Math.floor(level) : 1;
  const levelIndex = Math.min(4, Math.max(0, safeLevel - 1));
  const levelFactor = Math.max(0.88, 1 - levelIndex * 0.03);
  return safeBase * levelFactor * (evolved ? 0.90 : 1);
}

/**
 * When an upgrade is selected at the instant a weapon is ready, require a
 * short, explicit recovery window. This prevents upgrading/evolving several
 * charged weapons and then releasing them as an immediate burst.
 */
export function getWeaponRecoveryAfterUpgrade(currentCooldown: number, nextReloadSeconds: number): number {
  const remaining = Number.isFinite(currentCooldown) ? Math.max(0, currentCooldown) : 0;
  const nextReload = Number.isFinite(nextReloadSeconds) ? Math.max(0, nextReloadSeconds) : 0;
  return Math.max(remaining, nextReload * 0.35);
}
