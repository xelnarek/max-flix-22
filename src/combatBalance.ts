import type { CharacterId } from './types.ts';

export type CombatGameMode = 'campaign' | 'survival';

export const CAMPAIGN_ATTACK_COOLDOWN_SECONDS: Readonly<Record<CharacterId, number>> = Object.freeze({
  marcin: 1.05,
  grzesiek: 1.22,
  dawid: 1.14,
  mateusz: 1.10,
  piotr: 1.25,
});

export const SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS = 2.65;

// Effective forward reach is measured from the operator's centre to the target.
// Character variety is retained, but every base attack now has a reliable,
// readable range rather than expiring after an arbitrary fixed lifetime.
export const PRIMARY_ATTACK_RANGE_METERS: Readonly<Record<CharacterId, number>> = Object.freeze({
  marcin: 25,
  grzesiek: 25,
  dawid: 26,
  mateusz: 27,
  piotr: 25,
});
export const PRIMARY_ATTACK_ORIGIN_OFFSET_METERS = 0.65;
export const PIOTR_BOOMERANG_OUTBOUND_LIFETIME_FRACTION = 0.48;

export function getPrimaryAttackLifetimeSeconds(characterId: CharacterId, projectileSpeed: number): number {
  const safeSpeed = Number.isFinite(projectileSpeed) ? Math.max(0.1, projectileSpeed) : 0.1;
  const travelDistance = Math.max(0, PRIMARY_ATTACK_RANGE_METERS[characterId] - PRIMARY_ATTACK_ORIGIN_OFFSET_METERS);
  return travelDistance / safeSpeed;
}

export function getPiotrBoomerangMaxLifeSeconds(projectileSpeed: number): number {
  const outboundLife = getPrimaryAttackLifetimeSeconds('piotr', projectileSpeed);
  return outboundLife / PIOTR_BOOMERANG_OUTBOUND_LIFETIME_FRACTION;
}
export const SURVIVAL_WEAPON_DISPATCH_COOLDOWN_SECONDS = 1.05;
export const SURVIVAL_WEAPON_INITIAL_RELOAD_FACTOR = 0.75;

export const SURVIVAL_WEAPON_UNLOCK_SECONDS = Object.freeze({
  pallet_cannon: 35,
  diamond_saw: 80,
  glue_mine: 125,
  kfc_bomber: 170,
  piorun_drone: 215,
  forklift_bolter: 260,
  scanner_pulse: 305,
  orbit_blades: 350,
  calacatta_shards: 395,
  steam_bomb: 440,
  forklift_horn: 485,
  wz_boomerang: 530,
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
