import type { CharacterId } from './types.ts';
import { scaleCharacterBasicAttackDamage, SURVIVAL_OUTGOING_DAMAGE_MULTIPLIER } from './characterBalance.ts';

export type CombatGameMode = 'campaign' | 'survival' | 'pvp';

/** Enemy specials keep wave pressure but create a slightly longer response window. */
export const SURVIVAL_ENEMY_SPECIAL_RATE_MULTIPLIER = 0.90;
/** A clear 24% projectile slowdown opens a real dodge window on mobile. */
export const ENEMY_PROJECTILE_SPEED_MULTIPLIER = 0.76;
/** Hostile locomotion is reduced once per spawned actor in both Campaign and Survival. */
export const ENEMY_MOVEMENT_SPEED_MULTIPLIER = 0.88;
/** Reduce perfect velocity-leading; enemy volleys should be dodged, not magnetised to the player. */
export const ENEMY_PROJECTILE_AIM_LEAD_MULTIPLIER = 0.42;
/** Deterministic lateral aim error prevents ordinary shots from tracking a moving player perfectly. */
export const ENEMY_PROJECTILE_AIM_ERROR_METERS = 0.78;

export function getEnemyProjectileSpeed(baseSpeed: number): number {
  const safeSpeed = Number.isFinite(baseSpeed) ? Math.max(0, baseSpeed) : 0;
  return safeSpeed * ENEMY_PROJECTILE_SPEED_MULTIPLIER;
}

export const CAMPAIGN_ATTACK_COOLDOWN_SECONDS: Readonly<Record<CharacterId, number>> = Object.freeze({
  marcin: 1.05,
  grzesiek: 1.22,
  dawid: 1.14,
  mateusz: 1.10,
  piotr: 1.25,
});

// Faster control weapons recover slightly sooner; the heavy dumbbell and
// returning wrench trade cadence for stronger hits and multi-pass coverage.
export const SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS: Readonly<Record<CharacterId, number>> = Object.freeze({
  marcin: 1.72,
  grzesiek: 1.88,
  dawid: 1.70,
  mateusz: 1.48,
  piotr: 1.92,
});
/** Survival-only primary-attack lift; campaign damage and auto-weapons are unchanged. */
export const SURVIVAL_PRIMARY_ATTACK_DAMAGE_MULTIPLIER = 1.16;

export interface PrimaryAttackDamageProfile {
  readonly regular: number;
  readonly finisher: number;
}

/** The regular / regular / finisher base-damage loop used by the five operators. */
export const PRIMARY_ATTACK_DAMAGE_PROFILE: Readonly<Record<CharacterId, PrimaryAttackDamageProfile>> = Object.freeze({
  marcin: { regular: 1, finisher: 2 },
  grzesiek: { regular: 2, finisher: 3 },
  dawid: { regular: 1, finisher: 2 },
  mateusz: { regular: 1, finisher: 2 },
  piotr: { regular: 2, finisher: 3 },
});

export function getPrimaryAttackBaseDamage(characterId: CharacterId, isFinisher: boolean, bonusDamage = 0): number {
  const profile = PRIMARY_ATTACK_DAMAGE_PROFILE[characterId] ?? PRIMARY_ATTACK_DAMAGE_PROFILE.marcin;
  const bonus = Number.isFinite(bonusDamage) ? Math.max(0, bonusDamage) : 0;
  return (isFinisher ? profile.finisher : profile.regular) + bonus;
}

/**
 * Neutral-build DPS estimate from the real three-hit combo, class multiplier,
 * attack cadence and Survival damage pipeline. It excludes upgrades, crits,
 * auto-weapons, skills and enemy-specific resistances.
 */
export function estimatePrimaryAttackDps(characterId: CharacterId, characterDamageMultiplier: number, mode: CombatGameMode): number {
  const profile = PRIMARY_ATTACK_DAMAGE_PROFILE[characterId] ?? PRIMARY_ATTACK_DAMAGE_PROFILE.marcin;
  const damageFactor = mode === 'survival' ? SURVIVAL_PRIMARY_ATTACK_DAMAGE_MULTIPLIER : 1;
  const outgoingFactor = mode === 'survival' ? SURVIVAL_OUTGOING_DAMAGE_MULTIPLIER : 1;
  const combo = [profile.regular, profile.regular, profile.finisher];
  const averageDamage = combo.reduce((sum, rawDamage) => {
    const baseDamage = Math.max(1, Math.round(rawDamage));
    return sum + scaleCharacterBasicAttackDamage(baseDamage, characterDamageMultiplier * damageFactor) * outgoingFactor;
  }, 0) / combo.length;
  return averageDamage / getBaseAttackCooldownSeconds(characterId, mode);
}

/** Conservative TTK estimate: assume each hit may wait one full attack interval. */
export function estimatePrimaryAttackTtkSeconds(enemyHp: number, characterId: CharacterId, characterDamageMultiplier: number, mode: CombatGameMode): number {
  if (!Number.isFinite(enemyHp) || enemyHp <= 0) return 0;
  const profile = PRIMARY_ATTACK_DAMAGE_PROFILE[characterId] ?? PRIMARY_ATTACK_DAMAGE_PROFILE.marcin;
  const damageFactor = mode === 'survival' ? SURVIVAL_PRIMARY_ATTACK_DAMAGE_MULTIPLIER : 1;
  const outgoingFactor = mode === 'survival' ? SURVIVAL_OUTGOING_DAMAGE_MULTIPLIER : 1;
  const combo = [profile.regular, profile.regular, profile.finisher];
  const cooldown = getBaseAttackCooldownSeconds(characterId, mode);
  let remainingHp = enemyHp;
  let attacks = 0;
  while (remainingHp > 0 && attacks < 1000) {
    const baseDamage = Math.max(1, Math.round(combo[attacks % combo.length]));
    const hitDamage = scaleCharacterBasicAttackDamage(baseDamage, characterDamageMultiplier * damageFactor) * outgoingFactor;
    if (hitDamage <= 0) return Number.POSITIVE_INFINITY;
    remainingHp -= hitDamage;
    attacks++;
  }
  return attacks >= 1000 ? Number.POSITIVE_INFINITY : attacks * cooldown;
}
export const SURVIVAL_AUTO_AIM_RANGE_METERS = 22;

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
  pallet_cannon: 30,
  diamond_saw: 55,
  glue_mine: 80,
  kfc_bomber: 105,
  piorun_drone: 130,
  forklift_bolter: 155,
  scanner_pulse: 180,
  orbit_blades: 205,
  calacatta_shards: 230,
  steam_bomb: 255,
  forklift_horn: 280,
  wz_boomerang: 305,
});

export function getBaseAttackCooldownSeconds(characterId: CharacterId, mode: CombatGameMode): number {
  return mode === 'survival'
    ? SURVIVAL_BASIC_ATTACK_COOLDOWN_SECONDS[characterId]
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
