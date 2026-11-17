/**
 * Remove an item without shifting the remaining array. Safe for reverse-index
 * update loops: the swapped-in tail item has already been visited this frame.
 */
export function removeAtSwap<T>(items: T[], index: number): T | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return undefined;
  const lastIndex = items.length - 1;
  const removed = items[index];
  if (index !== lastIndex) items[index] = items[lastIndex];
  items.pop();
  return removed;
}
