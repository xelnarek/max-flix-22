export type SurvivalDamageWeaponId =
  | 'pallet_cannon'
  | 'diamond_saw'
  | 'glue_mine'
  | 'kfc_bomber'
  | 'piorun_drone'
  | 'forklift_bolter'
  | 'scanner_pulse'
  | 'orbit_blades'
  | 'calacatta_shards'
  | 'steam_bomb'
  | 'forklift_horn'
  | 'wz_boomerang';

export type SurvivalDamageSource =
  | 'basic_attack'
  | 'ability'
  | `weapon:${SurvivalDamageWeaponId}`;

export interface SurvivalDamageSourceMeta {
  readonly label: string;
  readonly color: number;
  readonly category: 'BROŃ' | 'OPERATOR' | 'UMIEJĘTNOŚĆ';
}

export const SURVIVAL_DAMAGE_WEAPONS: Readonly<Record<SurvivalDamageWeaponId, SurvivalDamageSourceMeta>> = Object.freeze({
  pallet_cannon: { label: 'Działo paletowe', color: 0xf59e0b, category: 'BROŃ' },
  diamond_saw: { label: 'Tarcza diamentowa', color: 0x22d3ee, category: 'BROŃ' },
  glue_mine: { label: 'Mina Mapei', color: 0xa78bfa, category: 'BROŃ' },
  kfc_bomber: { label: 'Kubełek bombowy', color: 0xef4444, category: 'BROŃ' },
  piorun_drone: { label: 'Dron Piorun', color: 0x38bdf8, category: 'BROŃ' },
  forklift_bolter: { label: 'Wyrzutnia sztaplarki', color: 0xf97316, category: 'BROŃ' },
  scanner_pulse: { label: 'Impuls skanera', color: 0x67e8f9, category: 'BROŃ' },
  orbit_blades: { label: 'Ostrza orbitalne', color: 0x84cc16, category: 'BROŃ' },
  calacatta_shards: { label: 'Odłamki Calacatta', color: 0xe2e8f0, category: 'BROŃ' },
  steam_bomb: { label: 'Bomba parowa', color: 0x94a3b8, category: 'BROŃ' },
  forklift_horn: { label: 'Klakson sztaplarki', color: 0xfbbf24, category: 'BROŃ' },
  wz_boomerang: { label: 'Bumerang WZ', color: 0x34d399, category: 'BROŃ' },
});

export interface SurvivalDamageEntry {
  readonly source: SurvivalDamageSource;
  readonly label: string;
  readonly category: 'BROŃ' | 'OPERATOR' | 'UMIEJĘTNOŚĆ';
  readonly damage: number;
  readonly percentage: number;
  readonly color: number;
}

export interface SurvivalDamageReport {
  readonly totalDamage: number;
  readonly entries: readonly SurvivalDamageEntry[];
}

export type SurvivalDamageStats = Record<string, number>;

const BASIC_ATTACK_META: SurvivalDamageSourceMeta = {
  label: 'Atak podstawowy operatora',
  color: 0x38bdf8,
  category: 'OPERATOR',
};
const ABILITY_META: SurvivalDamageSourceMeta = {
  label: 'Umiejętności i asysty',
  color: 0xc084fc,
  category: 'UMIEJĘTNOŚĆ',
};

export function createSurvivalDamageStats(): SurvivalDamageStats {
  return {};
}

export function getSurvivalWeaponDamageSource(weaponId: SurvivalDamageWeaponId): SurvivalDamageSource {
  return `weapon:${weaponId}`;
}

/** Count only real HP removed after shields and defeated targets are excluded. */
export function recordSurvivalDamage(
  stats: SurvivalDamageStats,
  source: SurvivalDamageSource,
  actualDamage: number,
): void {
  if (!Number.isFinite(actualDamage) || actualDamage <= 0) return;
  stats[source] = Math.max(0, Number.isFinite(stats[source]) ? stats[source] : 0) + actualDamage;
}

/** Build a compact, sorted breakdown for the end-of-run report. */
export function buildSurvivalDamageReport(stats: Readonly<Record<string, number>>): SurvivalDamageReport {
  const entries: SurvivalDamageEntry[] = [];
  let total = 0;

  for (const [sourceKey, rawDamage] of Object.entries(stats)) {
    if (!Number.isFinite(rawDamage) || rawDamage <= 0) continue;
    const source = sourceKey as SurvivalDamageSource;
    const weaponId = source.startsWith('weapon:') ? source.slice('weapon:'.length) as SurvivalDamageWeaponId : null;
    const meta = weaponId && Object.prototype.hasOwnProperty.call(SURVIVAL_DAMAGE_WEAPONS, weaponId)
      ? SURVIVAL_DAMAGE_WEAPONS[weaponId]
      : source === 'basic_attack'
        ? BASIC_ATTACK_META
        : ABILITY_META;
    entries.push({
      source: weaponId ? getSurvivalWeaponDamageSource(weaponId) : source === 'basic_attack' ? 'basic_attack' : 'ability',
      label: meta.label,
      category: meta.category,
      damage: Math.round(rawDamage * 10) / 10,
      percentage: 0,
      color: meta.color,
    });
    total += rawDamage;
  }

  entries.sort((a, b) => b.damage - a.damage || a.label.localeCompare(b.label, 'pl'));
  const safeTotal = Math.round(total * 10) / 10;
  return {
    totalDamage: safeTotal,
    entries: entries.map((entry) => ({
      ...entry,
      percentage: total > 0 ? Math.round((entry.damage / total) * 1000) / 10 : 0,
    })),
  };
}
