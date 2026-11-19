/**
 * Per-tab scroll state for the single menu content viewport.
 * Keeping this separate from DOM code makes tab changes predictable and testable.
 */
export class MenuScrollMemory {
  private readonly positions = new Map<string, number>();

  save(tabId: string, scrollTop: number): void {
    if (!tabId || !Number.isFinite(scrollTop)) return;
    this.positions.set(tabId, Math.max(0, scrollTop));
  }

  restore(tabId: string): number {
    if (!tabId) return 0;
    return this.positions.get(tabId) ?? 0;
  }

  clear(tabId?: string): void {
    if (typeof tabId === 'string' && tabId.length > 0) {
      this.positions.delete(tabId);
      return;
    }
    this.positions.clear();
  }
}
