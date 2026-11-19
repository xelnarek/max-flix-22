export type MenuSegmentId = 'play' | 'world' | 'progress' | 'system';

export interface MenuSegmentDefinition {
  id: MenuSegmentId;
  label: string;
  tabIds: readonly string[];
}

export const MENU_SEGMENTS: readonly MenuSegmentDefinition[] = [];

export function getMenuSegmentForTab(_tabId: string): MenuSegmentDefinition | null {
  return null;
}
