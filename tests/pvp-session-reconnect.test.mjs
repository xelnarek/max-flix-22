import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const client = await readFile(new URL('../src/pvpClient.ts', import.meta.url), 'utf8');
const server = await readFile(new URL('../src/server/pvpServer.ts', import.meta.url), 'utf8');

test('network client stores a tab-scoped, validated reconnect capability', () => {
  assert.match(client, /PVP_RECONNECT_TICKET_STORAGE_KEY/);
  assert.match(client, /window\.sessionStorage\.getItem\(PVP_RECONNECT_TICKET_STORAGE_KEY\)/);
  assert.match(client, /window\.sessionStorage\.setItem\(PVP_RECONNECT_TICKET_STORAGE_KEY/);
  assert.match(client, /reconnectToken: this\.reconnectTicket\.token/);
  assert.match(client, /type: 'rejoin_room'/);
});

test('network client retries lost room sockets with bounded backoff and clears expired tickets', () => {
  assert.match(client, /MAX_ROOM_RECONNECT_ATTEMPTS = 10/);
  assert.match(client, /ROOM_RECONNECT_WINDOW_MS = 18_000/);
  assert.match(client, /Math\.min\(500 \* \(2 \*\* this\.reconnectAttempts\), 3000\)/);
  assert.match(client, /persistPvpReconnectTicket\(null\)/);
  assert.match(client, /case 'room_rejoined'/);
});

test('server stores only hashed capabilities and rotates them after a successful rejoin', () => {
  assert.match(server, /createHash\('sha256'\)/);
  assert.match(server, /timingSafeEqual\(candidate, expected\)/);
  assert.match(server, /case 'rejoin_room'/);
  assert.match(server, /room\.reconnectTokenHashes\[slot\] = hashPvpReconnectToken\(newReconnectToken\)/);
  assert.match(server, /PVP_RECONNECT_GRACE_MS = 20_000/);
});

test('network interruptions freeze the live simulation and only forfeit after the grace period', () => {
  assert.match(server, /if \(\(room\.state\.status === 'in_round' \|\| room\.state\.status === 'countdown'\) && !intentionalLeave\) \{\s*\/\/ Freeze the authoritative simulation/);
  assert.match(server, /const graceMs = intentionalLeave \? 0 : getPvpReconnectGraceMs\(\)/);
  assert.match(server, /room\.state\.matchWinner = other/);
});
