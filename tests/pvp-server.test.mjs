import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { attachPvpWebSocketServer } from '../src/server/pvpServer.ts';

function waitForOpen(socket, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), timeoutMs);
    socket.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForMessage(socket, predicate, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const onMessage = (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!predicate(message)) return;
      cleanup();
      resolve(message);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for expected PvP message'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('message', onMessage);
    };
    socket.on('message', onMessage);
  });
}

async function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);
    socket.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    try { socket.close(1000, 'test cleanup'); } catch { resolve(); }
  });
}

test('PvP room server validates invite codes, waits for both ready signals and handles disconnects', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const httpServer = createServer();
  const websocketServer = attachPvpWebSocketServer(httpServer);
  const sockets = [];

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  const url = `ws://127.0.0.1:${address.port}/pvp-ws`;

  t.after(async () => {
    for (const socket of sockets) await closeSocket(socket);
    await new Promise((resolve) => websocketServer.close(resolve));
    await new Promise((resolve) => httpServer.close(() => resolve()));
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  const p1 = new WebSocket(url);
  sockets.push(p1);
  await waitForOpen(p1);
  const createdPromise = waitForMessage(p1, (message) => message.type === 'room_created');
  p1.send(JSON.stringify({ type: 'create_room', operatorId: 'marcin', playerName: 'Gracz 1' }));
  const created = await createdPromise;
  assert.match(created.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(created.slot, 'p1');

  const p2 = new WebSocket(url);
  sockets.push(p2);
  await waitForOpen(p2);
  const invalidCodePromise = waitForMessage(p2, (message) => message.type === 'error');
  p2.send(JSON.stringify({ type: 'join_room', code: 'B4XP', operatorId: 'grzesiek', playerName: 'Gracz 2' }));
  assert.match((await invalidCodePromise).message, /6 znaków/);

  const joinedPromise = waitForMessage(p2, (message) => message.type === 'room_joined');
  const playerJoinedPromise = waitForMessage(p1, (message) => message.type === 'player_joined');
  p2.send(JSON.stringify({ type: 'join_room', code: created.code, operatorId: 'grzesiek', playerName: 'Gracz 2' }));
  const joined = await joinedPromise;
  await playerJoinedPromise;
  assert.equal(joined.slot, 'p2');

  // A room may not begin until both connected players have explicitly readied up.
  p1.send(JSON.stringify({ type: 'set_ready', ready: true }));
  const countdownP1 = waitForMessage(p1, (message) => message.type === 'room_update' && message.state?.status === 'countdown');
  const countdownP2 = waitForMessage(p2, (message) => message.type === 'room_update' && message.state?.status === 'countdown');
  p2.send(JSON.stringify({ type: 'set_ready', ready: true }));
  const [stateP1, stateP2] = await Promise.all([countdownP1, countdownP2]);
  assert.equal(stateP1.state.status, 'countdown');
  assert.equal(stateP2.state.status, 'countdown');

  // Wait until the authoritative 30 Hz room loop leaves the three-second countdown.
  const inRound = await waitForMessage(p1, (message) => message.type === 'room_update' && message.state?.status === 'in_round', 5000);
  const beforeX = inRound.state.p1.x;
  const movementUpdate = waitForMessage(p1, (message) =>
    message.type === 'room_update' && message.state?.status === 'in_round' && message.state.p1.x > beforeX + 0.05
  );
  p1.send(JSON.stringify({
    type: 'input',
    moveX: 999,
    moveZ: 999,
    aimAngle: 999999,
    isFiring: false,
    wantDash: false,
    wantAbility: false,
  }));
  const moved = await movementUpdate;
  assert.ok(moved.state.p1.x - beforeX < 1.2, 'one validated input packet must not teleport the player');
  assert.ok(Number.isFinite(moved.state.p1.rot));

  // A tab can be suspended without immediately closing its WebSocket. The
  // authoritative server must release movement and continuous fire on timeout.
  const firingUpdate = waitForMessage(p1, (message) =>
    message.type === 'room_update' && message.state?.status === 'in_round' && message.state.p1.isFiring === true
  );
  p1.send(JSON.stringify({
    type: 'input',
    moveX: 1,
    moveZ: 0,
    aimAngle: Math.PI / 2,
    isFiring: true,
    wantDash: false,
    wantAbility: false,
  }));
  await firingUpdate;
  const staleStop = await waitForMessage(p1, (message) =>
    message.type === 'room_update' && message.state?.status === 'in_round' && message.state.p1.isFiring === false,
    1800
  );
  const settled = await waitForMessage(p1, (message) =>
    message.type === 'room_update' && message.state?.status === 'in_round' && message.state.p1.isFiring === false,
    1000
  );
  assert.ok(Math.abs(settled.state.p1.x - staleStop.state.p1.x) < 0.02,
    'stale movement must settle to zero instead of continuing from the last packet');

  const earlyRematchError = waitForMessage(p1, (message) => message.type === 'error');
  p1.send(JSON.stringify({ type: 'rematch' }));
  assert.match((await earlyRematchError).message, /po zakończeniu meczu/);

  const closedForP2 = waitForMessage(p2, (message) => message.type === 'room_closed');
  p1.close(1000, 'leave test match');
  assert.match((await closedForP2).message, /rozłączył się|opuścił pokój/);
});


test('PvP public matchmaking pairs the oldest waiting players and supports reliable cancellation', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const httpServer = createServer();
  const websocketServer = attachPvpWebSocketServer(httpServer);
  const sockets = [];

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');
  const url = `ws://127.0.0.1:${address.port}/pvp-ws`;

  t.after(async () => {
    for (const socket of sockets) await closeSocket(socket);
    await new Promise((resolve) => websocketServer.close(resolve));
    await new Promise((resolve) => httpServer.close(() => resolve()));
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  const connect = async () => {
    const socket = new WebSocket(url);
    sockets.push(socket);
    await waitForOpen(socket);
    return socket;
  };

  const first = await connect();
  const second = await connect();
  const third = await connect();

  const firstQueued = waitForMessage(first, (message) =>
    message.type === 'matchmaking_status' && message.status === 'searching' && message.position === 1
  );
  first.send(JSON.stringify({ type: 'find_match', operatorId: 'marcin', playerName: 'Pierwszy' }));
  await firstQueued;

  const secondPosition = waitForMessage(second, (message) =>
    message.type === 'matchmaking_status' && message.status === 'searching' && message.position === 2
  );
  const firstQueueUpdate = waitForMessage(first, (message) =>
    message.type === 'matchmaking_status' && message.status === 'searching' && message.waitingPlayers === 2
  );
  second.send(JSON.stringify({ type: 'find_match', operatorId: 'grzesiek', playerName: 'Anulujący' }));
  await Promise.all([secondPosition, firstQueueUpdate]);

  const cancelled = waitForMessage(second, (message) => message.type === 'matchmaking_cancelled');
  const firstAfterCancel = waitForMessage(first, (message) =>
    message.type === 'matchmaking_status' && message.status === 'searching' && message.waitingPlayers === 1
  );
  second.send(JSON.stringify({ type: 'cancel_matchmaking' }));
  await Promise.all([cancelled, firstAfterCancel]);

  const firstFound = waitForMessage(first, (message) => message.type === 'match_found');
  const thirdFound = waitForMessage(third, (message) => message.type === 'match_found');
  const firstRoom = waitForMessage(first, (message) => message.type === 'room_created');
  const thirdRoom = waitForMessage(third, (message) => message.type === 'room_joined');
  third.send(JSON.stringify({ type: 'find_match', operatorId: 'dawid', playerName: 'Trzeci' }));

  const [firstMatch, thirdMatch, firstCreated, thirdJoined] = await Promise.all([
    firstFound, thirdFound, firstRoom, thirdRoom,
  ]);
  assert.equal(firstMatch.code, thirdMatch.code);
  assert.equal(firstCreated.code, thirdJoined.code);
  assert.match(firstCreated.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(firstCreated.slot, 'p1');
  assert.equal(thirdJoined.slot, 'p2');
  assert.equal(firstCreated.state.p1.nickname, 'Pierwszy');
  assert.equal(firstCreated.state.p2.nickname, 'Trzeci');
  assert.equal(firstCreated.state.p1.connected, true);
  assert.equal(firstCreated.state.p2.connected, true);
  assert.equal(firstCreated.state.status, 'ready');

  const firstCountdown = waitForMessage(first, (message) =>
    message.type === 'room_update' && message.state?.status === 'countdown'
  );
  const thirdCountdown = waitForMessage(third, (message) =>
    message.type === 'room_update' && message.state?.status === 'countdown'
  );
  first.send(JSON.stringify({ type: 'set_ready', ready: true }));
  third.send(JSON.stringify({ type: 'set_ready', ready: true }));
  const [firstState, thirdState] = await Promise.all([firstCountdown, thirdCountdown]);
  assert.equal(firstState.state.status, 'countdown');
  assert.equal(thirdState.state.status, 'countdown');
});
