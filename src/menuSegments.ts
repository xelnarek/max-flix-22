export type MenuSegmentId = 'play' | 'world' | 'progress' | 'system';

export interface MenuSegmentDefinition {
  id: MenuSegmentId;
  label: string;
  tabIds: readonly string[];
}

/**
 * The menu is organized by the four real destinations groups already present
 * in index.html. Keep this mapping for the active category marker in the
 * persistent left navigation rail.
 */
export const MENU_SEGMENTS: readonly MenuSegmentDefinition[] = [
  { id: 'play', label: 'ROZGRYWKA', tabIds: ['tab-team', 'tab-map', 'tab-pvp'] },
  { id: 'world', label: 'ŚWIAT I BHP', tabIds: ['tab-enemies', 'tab-perks', 'tab-field-guide'] },
  { id: 'progress', label: 'POSTĘPY', tabIds: ['tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements'] },
  { id: 'system', label: 'SYSTEM', tabIds: ['tab-settings'] },
] as const;

const menuSegmentByTab = new Map<string, MenuSegmentDefinition>(
  MENU_SEGMENTS.flatMap((segment) => segment.tabIds.map((tabId) => [tabId, segment] as const)),
);

export function getMenuSegmentForTab(tabId: string): MenuSegmentDefinition | null {
  return menuSegmentByTab.get(tabId) ?? null;
}
