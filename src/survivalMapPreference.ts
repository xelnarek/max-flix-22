import { SURVIVAL_MAP_IDS, type SurvivalMapId } from './survivalMaps.ts';

export const SURVIVAL_MAP_PREFERENCE_KEY = 'paleciaki.menu.survivalMap.v1';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

/** Restore a saved arena. Missing, stale or corrupt values safely fall back to random. */
export function readSurvivalMapPreference(storage: StorageReader): SurvivalMapId | null {
  try {
    const value = storage.getItem(SURVIVAL_MAP_PREFERENCE_KEY);
    if (!value || value === 'random') return null;
    return SURVIVAL_MAP_IDS.some((mapId) => mapId === value)
      ? value as SurvivalMapId
      : null;
  } catch {
    return null;
  }
}

/** Persist a fixed arena or the explicit random-rotation choice. */
export function writeSurvivalMapPreference(
  storage: StorageWriter,
  mapId: SurvivalMapId | null,
): boolean {
  try {
    const validMapId = mapId && SURVIVAL_MAP_IDS.includes(mapId) ? mapId : null;
    storage.setItem(SURVIVAL_MAP_PREFERENCE_KEY, validMapId || 'random');
    return true;
  } catch {
    return false;
  }
}
