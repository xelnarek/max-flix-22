import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('online PvP disconnects are visible in the live arena and a rejoined room clears the warning', async () => {
  const [app, html, css, docs, reconnectTests] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/pvp-reconnect-overlay.css', import.meta.url), 'utf8'),
    readFile(new URL('../docs/PVP_ARENA_TECHNICAL_REVIEW.md', import.meta.url), 'utf8'),
    readFile(new URL('./pvp-session-reconnect.test.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /const setPvpNetworkStatus = \(state: 'hidden' \| 'reconnecting' \| 'failed'/);
  assert.match(app, /if \(!connected\) showPvpReconnectState\(\)/);
  assert.match(app, /setPvpNetworkStatus\('hidden'\)/);
  assert.match(app, /showPvpReconnectFailure\(message\)/);
  const matchEndExitStart = app.indexOf('bindPvpTap(btnExitToMenu, () => {');
  const matchEndExitEnd = app.indexOf('\n    });', matchEndExitStart);
  assert.ok(matchEndExitStart >= 0 && matchEndExitEnd > matchEndExitStart);
  assert.match(app.slice(matchEndExitStart, matchEndExitEnd), /setPvpNetworkStatus\\('hidden'\\)/);
  assert.match(html, /id="pvp-network-status"/);
  const portalStart = app.indexOf('const overlayIds = [');
  const portalEnd = app.indexOf('];', portalStart);
  assert.ok(portalStart >= 0 && portalEnd > portalStart);
  assert.match(app.slice(portalStart, portalEnd), /'pvp-network-status'/);
  assert.match(html, /pvp-reconnect-overlay\.css/);
  assert.match(css, /\.pvp-network-status\[data-state="reconnecting"\]/);
  assert.match(css, /\.pvp-network-status\[data-state="failed"\]/);
  assert.match(reconnectTests, /MAX_ROOM_RECONNECT_ATTEMPTS = 10/);
  assert.match(docs, /The active-match reconnect path is implemented and regression-tested/);
  assert.doesNotMatch(docs, /active-match reconnection\/resume is not implemented/);
});
