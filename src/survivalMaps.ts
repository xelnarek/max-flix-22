export type SurvivalMapId = 'warehouse_b4' | 'container_terminal' | 'cold_storage' | 'night_sorting';
export type SurvivalSecretStyle = 'wz' | 'cassette' | 'capybara' | 'rabbit_hole';

export interface SurvivalSecretDefinition {
  id: string;
  name: string;
  x: number;
  z: number;
  style: SurvivalSecretStyle;
}

export interface SurvivalMapCombatModifier {
  title: string;
  subtitle: string;
  description: string;
  healthMultiplier: number;
  speedMultiplier: number;
  xpMultiplier: number;
}

export interface SurvivalMapDefinition {
  id: SurvivalMapId;
  name: string;
  subtitle: string;
  description: string;
  combatModifier: SurvivalMapCombatModifier;
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
  'night_sorting',
];

export const SURVIVAL_MAPS: Readonly<Record<SurvivalMapId, SurvivalMapDefinition>> = {
  warehouse_b4: {
    id: 'warehouse_b4',
    name: 'Magazyn B4',
    subtitle: 'Wielki skład paletowy',
    description: 'Klasyczna hala B4. Gęste regały, boczne doki i otwarta środkowa aleja. Równe warunki bez modyfikatorów przeciwników.',
    combatModifier: {
      title: 'RÓWNY RYTM B4',
      subtitle: 'Standardowa zmiana',
      description: 'Magazyn B4 nie wzmacnia ani nie osłabia przeciwników. To punkt odniesienia do pozostałych aren.',
      healthMultiplier: 1,
      speedMultiplier: 1,
      xpMultiplier: 1,
    },
    backgroundColor: 0x080f1c,
    fogColor: 0x080f1c,
    floorColor: 0xffffff,
    wallColor: 0x1c2c3d,
    accentColor: 0xf59e0b,
    secretLocations: [
      { id: 'golden_wz', name: 'Złota WZ-tka', x: -48, z: 6.5, style: 'wz' },
      { id: 'b4_archive', name: 'Tajna kaseta B4', x: 1.5, z: -13.2, style: 'cassette' },
      { id: 'bronze_capybara', name: 'Kapibara z brązu', x: 48, z: -6.5, style: 'capybara' },
      { id: 'oniric_dream', name: 'Oniryczny sen', x: -27, z: 2.4, style: 'rabbit_hole' },
    ],
  },
  container_terminal: {
    id: 'container_terminal',
    name: 'Port Kontenerowy 17',
    subtitle: 'Plac przeładunkowy',
    description: 'Kolorowe kontenery tworzą szerokie slalomy, a suwnica góruje nad otwartą strefą przeładunku. Wrogowie są o 8% szybsi i o 6% mniej wytrzymali; eliminacje dają +12% XP.',
    combatModifier: {
      title: 'SZYBKI PRZEŁADUNEK',
      subtitle: 'Portowa zmiana • tempo +8%',
      description: 'Na placu portowym przeciwnicy poruszają się o 8% szybciej, ale mają o 6% mniej zdrowia. Każda eliminacja daje +12% XP.',
      healthMultiplier: 0.94,
      speedMultiplier: 1.08,
      xpMultiplier: 1.12,
    },
    backgroundColor: 0x101a28,
    fogColor: 0x172536,
    floorColor: 0xc8d2dc,
    wallColor: 0x26394c,
    accentColor: 0xfb923c,
    secretLocations: [
      { id: 'manifest_17', name: 'Tajny manifest 17', x: -50, z: 5.2, style: 'wz' },
      { id: 'captains_tape', name: 'Kaseta kapitana portu', x: 0, z: 15.2, style: 'cassette' },
      { id: 'dock_capybara', name: 'Kapibara dokerów', x: 50, z: -5.2, style: 'capybara' },
      { id: 'oniric_dream', name: 'Oniryczny sen', x: 28, z: -1.8, style: 'rabbit_hole' },
    ],
  },
  cold_storage: {
    id: 'cold_storage',
    name: 'Chłodnia Zero',
    subtitle: 'Komora mroźnicza',
    description: 'Błękitna chłodnia z agregatami, rurami chłodniczymi i lodowymi pasami na posadzce. Wrogowie są o 10% wolniejsi, o 12% wytrzymalsi, a eliminacje dają +12% XP.',
    combatModifier: {
      title: 'ZMIANA -18°C',
      subtitle: 'Mroźna komora • cięższe cele',
      description: 'Niska temperatura spowalnia przeciwników o 10%, ale zwiększa ich zdrowie o 12%. Eliminacje dają +12% XP.',
      healthMultiplier: 1.12,
      speedMultiplier: 0.90,
      xpMultiplier: 1.12,
    },
    backgroundColor: 0x061725,
    fogColor: 0x0a2638,
    floorColor: 0xc5f0ff,
    wallColor: 0x17364a,
    accentColor: 0x67e8f9,
    secretLocations: [
      { id: 'frozen_wz', name: 'Zamarznięta WZ-tka', x: -50, z: -5.2, style: 'wz' },
      { id: 'cold_archive', name: 'Kaseta z komory -18°C', x: 0, z: -15.2, style: 'cassette' },
      { id: 'ice_capybara', name: 'Lodowa kapibara', x: 50, z: 5.2, style: 'capybara' },
      { id: 'oniric_dream', name: 'Oniryczny sen', x: -28, z: -1.5, style: 'rabbit_hole' },
    ],
  },
  night_sorting: {
    id: 'night_sorting',
    name: 'Sortownia Widmowa',
    subtitle: 'Nocna strefa skanerów',
    description: 'Fioletowa sortownia pod neonowymi bramkami. Pulsujące pasy świetlne i skanery rozbijają monotonię hali. Przeciwnicy poruszają się o 4% szybciej, a eliminacje dają +15% XP.',
    combatModifier: {
      title: 'NOCNY PRZERZUT',
      subtitle: 'Neonowa sortownia • tempo +4%',
      description: 'Skanery pobudzają przeciwników: poruszają się o 4% szybciej, ale eliminacje dają +15% XP.',
      healthMultiplier: 0.98,
      speedMultiplier: 1.04,
      xpMultiplier: 1.15,
    },
    backgroundColor: 0x090817,
    fogColor: 0x17132b,
    floorColor: 0x30223d,
    wallColor: 0x362047,
    accentColor: 0xf472b6,
    secretLocations: [
      { id: 'night_manifest', name: 'Manifest po północy', x: -50, z: 5.2, style: 'wz' },
      { id: 'ghost_cassette', name: 'Kaseta z nocnej zmiany', x: 0, z: 15.2, style: 'cassette' },
      { id: 'neon_capybara', name: 'Kapibara neonów', x: 50, z: -5.2, style: 'capybara' },
      { id: 'oniric_dream', name: 'Oniryczny sen', x: 27, z: 2.0, style: 'rabbit_hole' },
    ],
  },
};

export function getSurvivalMapDefinition(mapId: SurvivalMapId): SurvivalMapDefinition {
  return SURVIVAL_MAPS[mapId] || SURVIVAL_MAPS.warehouse_b4;
}

/**
 * Pick a uniform map for the next run. Immediate repeats are excluded while
 * keeping all four arenas equally likely across a longer sequence.
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

/** Apply the selected arena's permanent combat trade-off to one newly spawned enemy. */
export function applySurvivalMapCombatModifier(
  stats: { maxHp: number; speed: number },
  mapId: SurvivalMapId,
): { maxHp: number; speed: number; xpMultiplier: number } {
  const modifier = getSurvivalMapDefinition(mapId).combatModifier;
  const baseHp = Number.isFinite(stats.maxHp) ? Math.max(1, stats.maxHp) : 1;
  const baseSpeed = Number.isFinite(stats.speed) ? Math.max(0.1, stats.speed) : 0.1;
  const healthMultiplier = Number.isFinite(modifier.healthMultiplier)
    ? Math.min(1.4, Math.max(0.8, modifier.healthMultiplier))
    : 1;
  const speedMultiplier = Number.isFinite(modifier.speedMultiplier)
    ? Math.min(1.25, Math.max(0.75, modifier.speedMultiplier))
    : 1;
  const xpMultiplier = Number.isFinite(modifier.xpMultiplier)
    ? Math.min(1.5, Math.max(1, modifier.xpMultiplier))
    : 1;

  return {
    maxHp: Math.max(1, Math.ceil(baseHp * healthMultiplier)),
    speed: Math.max(0.1, baseSpeed * speedMultiplier),
    xpMultiplier,
  };
}
