/**
 * Observe browser WebGL context lifecycle events without coupling the recovery
 * policy to a renderer implementation. A lost context must be prevented from
 * being discarded so browsers can attempt restoration.
 */
export interface WebGLContextRecoveryHandlers {
  onLost(event: Event): void;
  onRestored(event: Event): void;
}

export function observeWebGLContextRecovery(
  target: EventTarget,
  handlers: WebGLContextRecoveryHandlers,
): () => void {
  let active = true;

  const handleLost: EventListener = (event) => {
    event.preventDefault();
    if (active) handlers.onLost(event);
  };
  const handleRestored: EventListener = (event) => {
    if (active) handlers.onRestored(event);
  };

  target.addEventListener('webglcontextlost', handleLost, false);
  target.addEventListener('webglcontextrestored', handleRestored, false);

  return () => {
    if (!active) return;
    active = false;
    target.removeEventListener('webglcontextlost', handleLost, false);
    target.removeEventListener('webglcontextrestored', handleRestored, false);
  };
}
