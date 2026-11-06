export function getMenuTabIndexForKey(
  key: string,
  currentIndex: number,
  tabCount: number,
): number | null {
  if (!Number.isInteger(tabCount) || tabCount <= 0 || !Number.isInteger(currentIndex)) return null;
  if (currentIndex < 0 || currentIndex >= tabCount) return null;

  switch (key) {
    case 'ArrowRight':
      return (currentIndex + 1) % tabCount;
    case 'ArrowLeft':
      return (currentIndex - 1 + tabCount) % tabCount;
    case 'Home':
      return 0;
    case 'End':
      return tabCount - 1;
    default:
      return null;
  }
}
