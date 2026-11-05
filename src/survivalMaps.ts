export type SurvivalMapId = 'warehouse_b4' | 'container_terminal' | 'cold_storage';
export type SurvivalSecretStyle = 'wz' | 'cassette' | 'capybara';

export interface SurvivalSecretDefinition {
  id: string;
  name: string;
  x: number;
  z: number;
  style: SurvivalSecretStyle;
}

export interface SurvivalMapDefinition {
  id: SurvivalMapId;
  name: string;
  subtitle: string;
  description: string;
  backgroundColor: number;
  fogColor: number;
  floorColor: number;
  wallColor: number;
  accentColor: number;
  secretLocations: readonly SurvivalSecretDefinition[];
}

export const SURVIVAL_MAP_IDS: readonly SurvivalMapId[] = [
  'warehouse_b4',
  'container_terminal',
  'cold_storage',
];

export const SURVIVAL_MAPS: Readonly<Record<SurvivalMapId, SurvivalMapDefinition>> = {
  warehouse_b4: {
    id: 'warehouse_b4',
    name: 'Magazyn B4',
    subtitle: 'Wielki skład paletowy',
    description: 'Klasyczna hala B4. Gęste regały, boczne doki i otwarta środkowa aleja.',
    backgroundColor: 0x080f1c,
    fogColor: 0x080f1c,
    floorColor: 0xffffff,
    wallColor: 0x1c2c3d,
    accentColor: 0xf59e0b,
    secretLocations: [
      { id: 'golden_wz', name: 'Złota WZ-tka', x: -48, z: 6.5, style: 'wz' },
      { id: 'b4_archive', name: 'Tajna kaseta B4', x: 1.5, z: -13.2, style: 'cassette' },
      { id: 'bronze_capybara', name: 'Kapibara z brązu', x: 48, z: -6.5, style: 'capybara' },
    ],
  },
  container_terminal: {
    id: 'container_terminal',
    name: 'Port Kontenerowy 17',
    subtitle: 'Plac przeładunkowy',
    description: 'Kolorowe kontenery tworzą szerokie slalomy, a suwnica góruje nad otwartą strefą przeładunku.',
    backgroundColor: 0x101a28,
    fogColor: 0x172536,
    floorColor: 0xc8d2dc,
    wallColor: 0x26394c,
    accentColor: 0xfb923c,
    secretLocations: [
      { id: 'manifest_17', name: 'Tajny manifest 17', x: -50, z: 5.2, style: 'wz' },
      { id: 'captains_tape', name: 'Kaseta kapitana portu', x: 0, z: 15.2, style: 'cassette' },
      { id: 'dock_capybara', name: 'Kapibara dokerów', x: 50, z: -5.2, style: 'capybara' },
    ],
  },
  cold_storage: {
    id: 'cold_storage',
    name: 'Chłodnia Zero',
    subtitle: 'Komora mroźnicza',
    description: 'Błękitna chłodnia z agregatami, rurami chłodniczymi i lodowymi pasami na posadzce.',
    backgroundColor: 0x061725,
    fogColor: 0x0a2638,
    floorColor: 0xc5f0ff,
    wallColor: 0x17364a,
    accentColor: 0x67e8f9,
    secretLocations: [
      { id: 'frozen_wz', name: 'Zamarznięta WZ-tka', x: -50, z: -5.2, style: 'wz' },
      { id: 'cold_archive', name: 'Kaseta z komory -18°C', x: 0, z: -15.2, style: 'cassette' },
      { id: 'ice_capybara', name: 'Lodowa kapibara', x: 50, z: 5.2, style: 'capybara' },
    ],
  },
};

export function getSurvivalMapDefinition(mapId: SurvivalMapId): SurvivalMapDefinition {
  return SURVIVAL_MAPS[mapId] || SURVIVAL_MAPS.warehouse_b4;
}

/**
 * Pick a uniform map for the next run. Immediate repeats are excluded while
 * keeping all three arenas equally likely across a longer sequence.
 */
export function chooseRandomSurvivalMap(
  previousMapId: SurvivalMapId | null,
  randomValue: number,
): SurvivalMapId {
  const candidates = SURVIVAL_MAP_IDS.filter((mapId) => mapId !== previousMapId);
  const pool = candidates.length > 0 ? candidates : SURVIVAL_MAP_IDS;
  const safeRoll = Number.isFinite(randomValue)
    ? Math.min(0.999999, Math.max(0, randomValue))
    : 0.5;
  return pool[Math.floor(safeRoll * pool.length)] || SURVIVAL_MAP_IDS[0];
}

export function getSurvivalSecretKeys(): string[] {
  return SURVIVAL_MAP_IDS.flatMap((mapId) =>
    SURVIVAL_MAPS[mapId].secretLocations.map((secret) => mapId + ':' + secret.id)
  );
}
