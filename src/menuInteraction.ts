/**
 * Small deterministic input helper used by the menu's hidden three-click reveal.
 * It deliberately has no DOM or timer dependency so its behavior can be tested.
 */
export class ThreeClickTrigger {
  private clicks = 0;
  private lastClickAt = Number.NEGATIVE_INFINITY;
  private readonly windowMs: number;
  private readonly requiredClicks: number;

  constructor(windowMs = 2400, requiredClicks = 3) {
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be positive');
    if (!Number.isInteger(requiredClicks) || requiredClicks < 1) throw new RangeError('requiredClicks must be a positive integer');
    this.windowMs = windowMs;
    this.requiredClicks = requiredClicks;
  }

  register(timestamp: number): boolean {
    if (!Number.isFinite(timestamp)) return false;
    if (timestamp < this.lastClickAt || timestamp - this.lastClickAt > this.windowMs) this.clicks = 0;
    this.lastClickAt = timestamp;
    this.clicks += 1;
    if (this.clicks < this.requiredClicks) return false;
    this.reset();
    return true;
  }

  reset(): void {
    this.clicks = 0;
    this.lastClickAt = Number.NEGATIVE_INFINITY;
  }
}
