/**
 * A controller change during first-time PWA installation is expected and
 * should not be presented as an update. Existing controlled pages should be
 * offered a deliberate refresh when a newer service worker takes control.
 */
export function shouldAnnounceServiceWorkerUpdate(
  hadActiveController: boolean,
  alreadyAnnounced: boolean,
): boolean {
  return hadActiveController && !alreadyAnnounced;
}
