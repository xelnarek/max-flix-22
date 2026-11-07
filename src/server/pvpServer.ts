import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  CharacterId,
} from '../types.ts';
import {
  createInitialPvpArenaState,
  resetPvpRound,
  stepPvpArena,
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
}

const activeRooms = new Map<string, PvpRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return activeRooms.has(code) ? generateRoomCode() : code;
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

    // If both players disconnected, stop loop
    if (!room.state.p1.connected && !room.state.p2.connected) {
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
  const wss = new WebSocketServer({
    server,
    path: '/pvp-ws',
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    let playerSlot: 'p1' | 'p2' | null = null;

    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'create_room': {
            const operatorId: CharacterId = msg.operatorId || 'marcin';
            const playerName: string = (msg.playerName || 'Gracz 1').slice(0, 16);
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
            const code = (msg.code || '').trim().toUpperCase();
            const operatorId: CharacterId = msg.operatorId || 'grzesiek';
            const playerName: string = (msg.playerName || 'Gracz 2').slice(0, 16);

            const room = activeRooms.get(code);
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: `Nie znaleziono pokoju o kodzie: ${code}` }));
              return;
            }

            if (room.clients.has('p2') && room.state.p2.connected) {
              ws.send(JSON.stringify({ type: 'error', message: 'Pokój jest już pełny (2/2 graczy).' }));
              return;
            }

            room.clients.set('p2', ws);
            room.state.p2.operatorId = operatorId;
            room.state.p2.name = playerName;
            room.state.p2.connected = true;
            room.state.status = 'ready';

            currentRoomCode = code;
            playerSlot = 'p2';

            ws.send(JSON.stringify({
              type: 'room_joined',
              code,
              slot: 'p2',
              state: room.state,
            }));

            broadcastRoomState(room);
            break;
          }

          case 'set_ready': {
            if (!currentRoomCode || !playerSlot) return;
            const room = activeRooms.get(currentRoomCode);
            if (!room) return;

            room.state[playerSlot].isReady = Boolean(msg.ready);

            // If both players are ready and 2 players connected, start countdown
            if (room.state.p1.isReady && room.state.p2.isReady && room.state.p2.connected) {
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

            const intent = room.inputs[playerSlot];
            intent.moveX = Number(msg.moveX) || 0;
            intent.moveZ = Number(msg.moveZ) || 0;
            intent.aimAngle = Number(msg.aimAngle) || 0;
            intent.isFiring = Boolean(msg.isFiring);
            if (msg.wantDash) intent.wantDash = true;
            if (msg.wantAbility) intent.wantAbility = true;
            break;
          }

          case 'rematch': {
            if (!currentRoomCode) return;
            const room = activeRooms.get(currentRoomCode);
            if (!room) return;

            room.state.round = 1;
            room.state.p1.score = 0;
            room.state.p2.score = 0;
            room.state.p1.damageDealt = 0;
            room.state.p2.damageDealt = 0;
            room.state.p1.shotsFired = 0;
            room.state.p2.shotsFired = 0;
            room.state.p1.shotsHit = 0;
            room.state.p2.shotsHit = 0;
            room.state.p1.isReady = false;
            room.state.p2.isReady = false;
            room.state.matchWinner = null;
            resetPvpRound(room.state);
            room.state.status = 'ready';
            broadcastRoomState(room);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[PVP-WS] Error handling message:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomCode && playerSlot) {
        const room = activeRooms.get(currentRoomCode);
        if (room) {
          room.clients.delete(playerSlot);
          room.state[playerSlot].connected = false;
          room.state[playerSlot].isReady = false;

          if (room.state.status === 'in_round' || room.state.status === 'countdown') {
            room.state.status = 'match_end';
            room.state.matchWinner = playerSlot === 'p1' ? 'p2' : 'p1';
          }

          broadcastRoomState(room);

          if (room.clients.size === 0) {
            room.emptyTimeout = setTimeout(() => {
              cleanRoom(currentRoomCode!);
            }, 30000);
          }
        }
      }
    });
  });

  return wss;
}
