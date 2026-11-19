export type MenuTabOrientation = 'horizontal' | 'vertical' | 'both';

export function getMenuTabIndexForKey(
  key: string,
  currentIndex: number,
  tabCount: number,
  orientation: MenuTabOrientation = 'both',
): number | null {
  if (!Number.isInteger(tabCount) || tabCount <= 0 || !Number.isInteger(currentIndex)) return null;
  if (currentIndex < 0 || currentIndex >= tabCount) return null;

  switch (key) {
    case 'ArrowRight':
      return orientation === 'vertical' ? null : (currentIndex + 1) % tabCount;
    case 'ArrowLeft':
      return orientation === 'vertical' ? null : (currentIndex - 1 + tabCount) % tabCount;
    case 'ArrowDown':
      return orientation === 'horizontal' ? null : (currentIndex + 1) % tabCount;
    case 'ArrowUp':
      return orientation === 'horizontal' ? null : (currentIndex - 1 + tabCount) % tabCount;
    case 'Home':
      return 0;
    case 'End':
      return tabCount - 1;
    default:
      return null;
  }
}
