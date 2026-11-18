export type MateuszRivalId = 'iron-man' | 'hulk' | 'spider-man' | 'storm' | 'batman';
export type MateuszRivalUniverse = 'MARVEL' | 'DC';
export type MateuszRivalCombatStyle = 'repulsor' | 'gamma-slam' | 'web-strike' | 'lightning-chain' | 'batarang';

export interface MateuszRivalDefinition {
  readonly id: MateuszRivalId;
  readonly name: string;
  readonly universe: MateuszRivalUniverse;
  readonly role: 'blaster' | 'bruiser' | 'skirmisher' | 'controller' | 'tactician';
  readonly style: MateuszRivalCombatStyle;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly preferredRangeMeters: number;
  readonly attackRangeMeters: number;
  readonly moveSpeed: number;
  readonly attackCooldownSeconds: number;
  readonly damage: number;
  readonly stunSeconds: number;
}

/**
 * Five separately modelled multiverse allies. Four are Marvel characters and
 * one is a DC character; their combat profiles deliberately use different
 * ranges, cadence and hit effects rather than sharing a generic orbit attack.
 *
 * Campaign and Survival keep comparable squad output. Survival's higher
 * generic ability scalar is offset here so five autonomous attackers remain
 * useful without becoming a boss-melting, stun-locking passive weapon.
 */
export type MateuszRivalGameMode = 'campaign' | 'survival';
export const MATEUSZ_RIVAL_CAMPAIGN_DAMAGE_MULTIPLIER = 0.78;
export const MATEUSZ_RIVAL_SURVIVAL_DAMAGE_MULTIPLIER = 0.66;

export function getMateuszRivalDamageMultiplier(mode: MateuszRivalGameMode): number {
  return mode === 'survival'
    ? MATEUSZ_RIVAL_SURVIVAL_DAMAGE_MULTIPLIER
    : MATEUSZ_RIVAL_CAMPAIGN_DAMAGE_MULTIPLIER;
}
export const MATEUSZ_RIVAL_ROSTER: readonly MateuszRivalDefinition[] = Object.freeze([
  {
    id: 'iron-man', name: 'Iron Man', universe: 'MARVEL', role: 'blaster', style: 'repulsor',
    primaryColor: 0xb91c1c, secondaryColor: 0xeab308, accentColor: 0x67e8f9,
    preferredRangeMeters: 8.2, attackRangeMeters: 12.5, moveSpeed: 7.8,
    attackCooldownSeconds: 1.02, damage: 5.5, stunSeconds: 0.14,
  },
  {
    id: 'hulk', name: 'Hulk', universe: 'MARVEL', role: 'bruiser', style: 'gamma-slam',
    primaryColor: 0x16a34a, secondaryColor: 0x581c87, accentColor: 0x86efac,
    preferredRangeMeters: 1.9, attackRangeMeters: 2.8, moveSpeed: 7.0,
    attackCooldownSeconds: 1.38, damage: 7.6, stunSeconds: 0.52,
  },
  {
    id: 'spider-man', name: 'Spider-Man', universe: 'MARVEL', role: 'skirmisher', style: 'web-strike',
    primaryColor: 0x1d4ed8, secondaryColor: 0xdc2626, accentColor: 0xf8fafc,
    preferredRangeMeters: 1.7, attackRangeMeters: 3.6, moveSpeed: 10.2,
    attackCooldownSeconds: 0.82, damage: 4.2, stunSeconds: 0.38,
  },
  {
    id: 'storm', name: 'Storm', universe: 'MARVEL', role: 'controller', style: 'lightning-chain',
    primaryColor: 0xe2e8f0, secondaryColor: 0x64748b, accentColor: 0x38bdf8,
    preferredRangeMeters: 7.2, attackRangeMeters: 11.5, moveSpeed: 7.4,
    attackCooldownSeconds: 1.25, damage: 4.8, stunSeconds: 0.30,
  },
  {
    id: 'batman', name: 'Batman', universe: 'DC', role: 'tactician', style: 'batarang',
    primaryColor: 0x1e293b, secondaryColor: 0x64748b, accentColor: 0xfbbf24,
    preferredRangeMeters: 6.8, attackRangeMeters: 11.0, moveSpeed: 8.6,
    attackCooldownSeconds: 1.05, damage: 4.6, stunSeconds: 0.24,
  },
]);

export function getMateuszRivalSpawnOffset(index: number): { x: number; z: number } {
  const offsets = [
    { x: -2.4, z: 2.2 },
    { x: -1.2, z: 3.4 },
    { x: 1.2, z: 3.4 },
    { x: 2.4, z: 2.2 },
    { x: 0, z: 4.1 },
  ];
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return { ...offsets[safeIndex % offsets.length] };
}
