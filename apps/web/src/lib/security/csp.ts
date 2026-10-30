/**
 * Content Security Policy directive builder.
 *
 * Consumed by the SvelteKit `csp` configuration in vite.config.ts and unit
 * tested with `csp.test.ts`. The policy must allow, in addition to the app
 * itself:
 *
 * - the OpenStreetMap raster tile server the map pulls tiles from,
 * - the housing API base URL (VITE_API_URL) the SPA talks to cross-origin,
 * - the MapLibre GL worker: a same-origin bundled asset (wired through
 *   `setWorkerUrl` from `?worker&url`) — `worker-src 'self'`, no blob:
 *   needed with maplibre v6 (per its v5→v6 migration guide).
 *
 * Dev mode additionally needs inline scripts (Vite HMR) and the dev-server
 * websocket, validated only while `allowInlineScripts` is set.
 */
export const OPENSTREETMAP_TILE_ORIGIN = "https://tile.openstreetmap.org";
const WEB_DEV_PORT = 5173;

export interface SecurityCspOptions {
  /** Base URL of the housing API the client bundle fetches from. */
  apiUrl: string;
  /** While a dev server is serving the app, inline scripts (Vite HMR) and its websocket must be allowed. */
  allowInlineScripts: boolean;
}

export function securityCspDirectives(options: SecurityCspOptions): Record<string, string[]> {
  // Production script-src stays 'self' (plus kit's per-request nonce) —
  // inline scripts are a dev-only need (Vite HMR). The MapLibre worker is a
  // same-origin bundled asset, so worker-src is bare 'self' — no blob:.
  const scriptSrc = ["self"];
  if (options.allowInlineScripts) scriptSrc.push("unsafe-inline");

  const connectSrc = ["self", OPENSTREETMAP_TILE_ORIGIN, trimTrailingSlash(options.apiUrl)];
  if (options.allowInlineScripts) {
    connectSrc.push(`http://localhost:${WEB_DEV_PORT}`, `ws://localhost:${WEB_DEV_PORT}`);
  }

  return {
    "default-src": ["self"],
    "script-src": scriptSrc,
    // Vite HMR and runtime styles (MapLibre, Svelte transitions) use inline styles.
    "style-src": ["self", "unsafe-inline"],
    "img-src": ["self", "data:", "blob:", OPENSTREETMAP_TILE_ORIGIN],
    "connect-src": connectSrc,
    "worker-src": ["self"],
    "font-src": ["self", "data:"],
    "manifest-src": ["self"],
    "object-src": ["none"],
    "frame-ancestors": ["self"],
    "base-uri": ["self"],
    "form-action": ["self"],
  };
}

function trimTrailingSlash(url: string): string {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}
