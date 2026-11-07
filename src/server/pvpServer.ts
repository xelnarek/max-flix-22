import type { Server as HttpServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  CharacterId,
} from '../types.ts';
import {
  createInitialPvpArenaState,
  resetPvpRound,
  resetPvpMatchStats,
  stepPvpArena,
  sanitizePvpInputIntent,
} from '../pvpArena.ts';
import type {
  PvpArenaState,
  PvpInputIntent,
} from '../pvpArena.ts';

interface PvpRoom {
  code: string;
  state: PvpArenaState;
  clients: Map<'p1' | 'p2', WebSocket>;
  inputs: {
    p1: PvpInputIntent;
    p2: PvpInputIntent;
  };
  tickInterval: NodeJS.Timeout | null;
  lastTickTime: number;
  emptyTimeout: NodeJS.Timeout | null;
  rematchVotes: Set<'p1' | 'p2'>;
}

const activeRooms = new Map<string, PvpRoom>();
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ACTIVE_ROOMS = 256;
const MAX_MESSAGES_PER_SECOND = 120;
const VALID_OPERATOR_IDS = new Set<CharacterId>(['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']);

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!activeRooms.has(code)) return code;
  }
  throw new Error('Nie udało się przydzielić wolnego kodu pokoju.');
}

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message }));
}

function sanitizePlayerName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  return cleaned || fallback;
}

function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && VALID_OPERATOR_IDS.has(value as CharacterId);
}

function clearRoomInputs(room: PvpRoom): void {
  room.inputs.p1 = { moveX: 0, moveZ: 0, aimAngle: room.state.p1.aimAngle, isFiring: false };
  room.inputs.p2 = { moveX: 0, moveZ: 0, aimAngle: room.state.p2.aimAngle, isFiring: false };
}

function broadcastRoomState(room: PvpRoom) {
  const payload = JSON.stringify({
    type: 'room_update',
    state: room.state,
  });

  for (const client of room.clients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function startRoomLoop(room: PvpRoom) {
  if (room.tickInterval) return;

  room.lastTickTime = Date.now();
  const TICK_RATE_MS = 1000 / 30; // 30 Hz

  room.tickInterval = setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - room.lastTickTime) / 1000, 0.1);
    room.lastTickTime = now;

    // Step simulation
    stepPvpArena(room.state, dt, room.inputs.p1, room.inputs.p2);

    // Consume transient button intents
    if (room.inputs.p1.wantDash) room.inputs.p1.wantDash = false;
    if (room.inputs.p1.wantAbility) room.inputs.p1.wantAbility = false;
    if (room.inputs.p2.wantDash) room.inputs.p2.wantDash = false;
    if (room.inputs.p2.wantAbility) room.inputs.p2.wantAbility = false;

    broadcastRoomState(room);

    // Do not keep broadcasting a finished match at 30 Hz.
    if (room.state.status === 'match_end' || (!room.state.p1.connected && !room.state.p2.connected)) {
      stopRoomLoop(room);
    }
  }, TICK_RATE_MS);
}

function stopRoomLoop(room: PvpRoom) {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
}

function cleanRoom(code: string) {
  const room = activeRooms.get(code);
  if (!room) return;
  stopRoomLoop(room);
  if (room.emptyTimeout) clearTimeout(room.emptyTimeout);
  activeRooms.delete(code);
}

export function attachPvpWebSocketServer(server: HttpServer): WebSocketServer {
  const allowedOrigins = new Set(
    (process.env.PVP_ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const isProduction = process.env.NODE_ENV === 'production';
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });

  // Validate the path and browser Origin during HTTP upgrade. The ws package
  // recommends this pattern over its legacy verifyClient callback.
  server.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(request.url || '/', 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/pvp-ws') return;

    if (isProduction) {
      const origin = request.headers.origin;
      if (!origin || !allowedOrigins.has(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\n\\r\\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    let isAlive = true;
    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }, 15000);
    heartbeat.unref();
    ws.on('pong', () => { isAlive = true; });

    let currentRoomCode: string | null = null;
    let playerSlot: 'p1' | 'p2' | null = null;
    let messageWindowStartedAt = Date.now();
    let messagesInWindow = 0;

    ws.on('message', (data: Buffer | string) => {
      try {
        const now = Date.now();
        if (now - messageWindowStartedAt >= 1000) {
          messageWindowStartedAt = now;
          messagesInWindow = 0;
        }
        messagesInWindow++;
        if (messagesInWindow > MAX_MESSAGES_PER_SECOND) {
          ws.close(1008, 'Za dużo komunikatów PvP.');
          return;
        }

        const msg = JSON.parse(data.toString());
        if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.type !== 'string') {
          sendError(ws, 'Nieprawidłowy komunikat PvP.');
          return;
        }

        switch (msg.type) {
          case 'create_room': {
            if (currentRoomCode || playerSlot) {
              sendError(ws, 'To połączenie jest już przypisane do pokoju.');
              return;
            }
            if (activeRooms.size >= MAX_ACTIVE_ROOMS) {
              sendError(ws, 'Serwer osiągnął limit aktywnych pokoi. Spróbuj później.');
              return;
            }
            const operatorId: CharacterId = isCharacterId(msg.operatorId) ? msg.operatorId : 'marcin';
            const playerName = sanitizePlayerName(msg.playerName, 'Gracz 1');
            const code = generateRoomCode();

            const state = createInitialPvpArenaState(operatorId, playerName, 'grzesiek', 'Oczekiwanie...');
            state.p1.connected = true;
            state.p2.connected = false;

            const room: PvpRoom = {
              code,
              state,
              clients: new Map([['p1', ws]]),
              inputs: {
                p1: { moveX: 0, moveZ: 0, aimAngle: state.p1.rot, isFiring: false },
                p2: { moveX: 0, moveZ: 0, aimAngle: state.p2.rot, isFiring: false },
              },
              tickInterval: null,
              lastTickTime: Date.now(),
              emptyTimeout: null,
              rematchVotes: new Set(),
            };

            activeRooms.set(code, room);
            currentRoomCode = code;
            playerSlot = 'p1';

            ws.send(JSON.stringify({
              type: 'room_created',
              code,
              slot: 'p1',
              state,
            }));
            break;
          }

          case 'join_room': {
            if (currentRoomCode || playerSlot) {
              sendError(ws, 'To połączenie jest już przypisane do pokoju.');
              return;
            }
            const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
            if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) {
              sendError(ws, 'Kod pokoju musi mieć dokładnie 6 znaków.');
              return;
            }
            const operatorId: CharacterId = isCharacterId(msg.operatorId) ? msg.operatorId : 'grzesiek';
            const playerName = sanitizePlayerName(msg.playerName, 'Gracz 2');

            const room = activeRooms.get(code);
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: `Nie znaleziono pokoju o kodzie: ${code}` }));
              return;
            }

            if (room.state.status === 'in_round' || room.state.status === 'countdown' || room.state.status === 'match_end') {
              sendError(ws, 'Ten pokój nie przyjmuje teraz graczy.');
              return;
            }
            if (room.clients.has('p2') && room.state.p2.connected) {
              ws.send(JSON.stringify({ type: 'error', message: 'Pokój jest już pełny (2/2 graczy).' }));
              return;
            }

            room.clients.set('p2', ws);
            room.state.p2.operatorId = operatorId;
            room.state.p2.name = playerName;
            room.state.p2.nickname = playerName;
            room.state.p2.connected = true;
            room.state.p2.isReady = false;
            room.state.status = 'ready';
            room.rematchVotes.clear();
            if (room.emptyTimeout) {
              clearTimeout(room.emptyTimeout);
              room.emptyTimeout = null;
            }

            currentRoomCode = code;
            playerSlot = 'p2';

            ws.send(JSON.stringify({
              type: 'room_joined',
              code,
              slot: 'p2',
              state: room.state,
            }));

            // Notify P1 that P2 has joined
            const p1Client = room.clients.get('p1');
            if (p1Client && p1Client.readyState === WebSocket.OPEN) {
              p1Client.send(JSON.stringify({
                type: 'player_joined',
                player: { nickname: playerName, slot: 'p2', operatorId },
              }));
            }

            broadcastRoomState(room);
            break;
          }

          case 'set_ready': {
            if (!currentRoomCode || !playerSlot) return;
            const room = activeRooms.get(currentRoomCode);
            if (!room) return;
            if (room.state.status !== 'waiting' && room.state.status !== 'ready') {
              sendError(ws, 'Gotowość można zmienić tylko w lobby.');
              return;
            }
            if (!room.state.p1.connected || !room.state.p2.connected) {
              sendError(ws, 'Poczekaj, aż dołączy drugi gracz.');
              return;
            }

            const isReady = msg.ready === true;
            room.state[playerSlot].isReady = isReady;

            // Notify the other player
            const otherSlot = playerSlot === 'p1' ? 'p2' : 'p1';
            const otherClient = room.clients.get(otherSlot);
            if (otherClient && otherClient.readyState === WebSocket.OPEN) {
              otherClient.send(JSON.stringify({
                type: 'player_ready',
                slot: playerSlot,
                ready: isReady,
              }));
            }

            // If both players are ready and 2 players connected, start countdown
            if (room.state.p1.isReady && room.state.p2.isReady && room.state.p2.connected && room.state.status === 'ready') {
              room.state.round = 1;
              room.state.p1.score = 0;
              room.state.p2.score = 0;
              room.state.matchWinner = null;
              room.state.winner = null;
              room.rematchVotes.clear();
              clearRoomInputs(room);
              resetPvpRound(room.state);
              startRoomLoop(room);
            }

            broadcastRoomState(room);
            break;
          }

          case 'input': {
            if (!currentRoomCode || !playerSlot) return;
            const room = activeRooms.get(currentRoomCode);
            if (!room) return;

            if (room.state.status !== 'countdown' && room.state.status !== 'in_round') return;
            const intent = room.inputs[playerSlot];
            const sanitized = sanitizePvpInputIntent(msg as Partial<PvpInputIntent>);
            // Latch one-shot controls until consumed by the authoritative simulation tick.
            room.inputs[playerSlot] = {
              ...sanitized,
              wantDash: intent.wantDash === true || sanitized.wantDash === true,
              wantAbility: intent.wantAbility === true || sanitized.wantAbility === true,
            };
            break;
          }

          case 'rematch': {
            if (!currentRoomCode || !playerSlot) return;
            const room = activeRooms.get(currentRoomCode);
            if (!room || room.state.status !== 'match_end') {
              sendError(ws, 'Rewanż można zgłosić po zakończeniu meczu.');
              return;
            }
            if (!room.state.p1.connected || !room.state.p2.connected) {
              sendError(ws, 'Rewanż wymaga obecności obu graczy.');
              return;
            }
            room.rematchVotes.add(playerSlot);
            const voteMessage = JSON.stringify({
              type: 'rematch_waiting',
              votes: room.rematchVotes.size,
              required: 2,
            });
            for (const client of room.clients.values()) {
              if (client.readyState === WebSocket.OPEN) client.send(voteMessage);
            }
            if (room.rematchVotes.size === 2) {
              room.state.round = 1;
              room.state.currentRound = 1;
              room.state.p1.score = 0;
              room.state.p2.score = 0;
              resetPvpMatchStats(room.state);
              room.state.p1.isReady = true;
              room.state.p2.isReady = true;
              room.state.matchWinner = null;
              room.state.winner = null;
              room.rematchVotes.clear();
              clearRoomInputs(room);
              resetPvpRound(room.state);
              startRoomLoop(room);
            }
            broadcastRoomState(room);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        sendError(ws, 'Nie udało się przetworzyć komunikatu PvP.');
        console.warn('[PVP-WS] Rejected malformed message:', err);
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      if (!currentRoomCode || !playerSlot) return;
      const room = activeRooms.get(currentRoomCode);
      if (!room || room.clients.get(playerSlot) !== ws) return;
      room.clients.delete(playerSlot);
      room.state[playerSlot].connected = false;
      room.state[playerSlot].isReady = false;
      room.rematchVotes.clear();
      room.inputs[playerSlot] = {
        moveX: 0,
        moveZ: 0,
        aimAngle: room.state[playerSlot].aimAngle,
        isFiring: false,
      };

      const otherSlot = playerSlot === 'p1' ? 'p2' : 'p1';
      const otherClient = room.clients.get(otherSlot);
      if (room.state.status === 'in_round' || room.state.status === 'countdown') {
        room.state.status = 'match_end';
        room.state.matchWinner = otherSlot;
        room.state.winner = otherSlot;
        stopRoomLoop(room);
        broadcastRoomState(room);
        if (otherClient?.readyState === WebSocket.OPEN) {
          otherClient.send(JSON.stringify({ type: 'room_closed', message: 'Rywal rozłączył się. Mecz zakończony.' }));
          otherClient.close(1000, 'Rywal rozłączony');
        }
        cleanRoom(currentRoomCode);
        return;
      }

      if (playerSlot === 'p1' && otherClient?.readyState === WebSocket.OPEN) {
        otherClient.send(JSON.stringify({ type: 'room_closed', message: 'Host opuścił pokój.' }));
        otherClient.close(1000, 'Host opuścił pokój');
        cleanRoom(currentRoomCode);
        return;
      }

      room.state.status = 'waiting';
      room.state.p2.name = 'Oczekiwanie...';
      room.state.p2.nickname = 'Oczekiwanie...';
      room.state.p2.connected = false;
      room.state.p2.isReady = false;
      room.state.p1.isReady = false;
      room.state.p1.connected = room.clients.has('p1');
      clearRoomInputs(room);
      broadcastRoomState(room);
      if (room.clients.size === 0) {
        room.emptyTimeout = setTimeout(() => cleanRoom(room.code), 30000);
      }
    });
  });

  return wss;
}
