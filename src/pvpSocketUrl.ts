/**
 * Resolves the public PvP WebSocket endpoint for browser and Capacitor builds.
 *
 * Capacitor Android serves its bundled app from https://localhost by default.
 * That is a local WebView origin, not a PvP server; native builds must use the
 * public TLS endpoint. Plain-http localhost remains reserved for Vite dev.
 */
export interface PvpSocketUrlInput {
  configuredUrl?: string;
  hostname: string;
  host: string;
  protocol: string;
}

export const DEFAULT_PVP_SOCKET_URL = 'wss://paleciaki-pvp.onrender.com/pvp-ws';

export function resolvePvpSocketUrl(input: PvpSocketUrlInput): string | null {
  const hostname = typeof input.hostname === 'string' ? input.hostname.toLowerCase() : '';
  const protocol = typeof input.protocol === 'string' ? input.protocol.toLowerCase() : '';
  const host = typeof input.host === 'string' && input.host.trim()
    ? input.host.trim()
    : hostname;
  const configuredUrl = typeof input.configuredUrl === 'string'
    ? input.configuredUrl.trim()
    : '';

  // An explicit value is authoritative. Never hide a malformed deployment
  // setting by silently falling back to a different server.
  const isPagesHost = /\.github\.io$/i.test(hostname);
  const isCapacitorAndroidOrigin = hostname === 'localhost' && protocol === 'https:';
  const fallbackUrl = isPagesHost || isCapacitorAndroidOrigin
    ? DEFAULT_PVP_SOCKET_URL
    : `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/pvp-ws`;

  try {
    const parsed = new URL(configuredUrl || fallbackUrl);
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return null;
    if (protocol === 'https:' && parsed.protocol !== 'wss:') return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
