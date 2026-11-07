import type { CharacterId } from './types.ts';
import {
  createInitialPvpArenaState,
  resetPvpRound,
  stepPvpArena,
} from './pvpArena.ts';
import type {
  PvpArenaState,
  PvpInputIntent,
  PvpSlot,
} from './pvpArena.ts';

export interface PvpSessionCallbacks {
  onRoomCreated?: (code: string, slot: 'p1', state: PvpArenaState) => void;
  onRoomJoined?: (code: string, slot: 'p2', state: PvpArenaState) => void;
  onStateUpdate?: (state: PvpArenaState) => void;
  onError?: (message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface IPvpSession {
  readonly isLocalBot: boolean;
  readonly slot: PvpSlot;
  readonly roomCode: string;
  createRoom?(operatorId: CharacterId, playerName: string): void;
  joinRoom?(code: string, operatorId: CharacterId, playerName: string): void;
  setReady?(ready: boolean): void;
  sendInput(intent: PvpInputIntent): void;
  requestRematch?(): void;
  leaveRoom?(): void;
  dispose(): void;
}

export class PvpNetworkSession implements IPvpSession {
  public readonly isLocalBot = false;
  public slot: PvpSlot = 'p1';
  public roomCode = '';

  public onRoomJoined?: (roomCode: string, slot: PvpSlot, roomState: PvpArenaState) => void;
  public onPlayerJoined?: (player: { nickname: string; slot: PvpSlot }) => void;
  public onPlayerReady?: (slot: PvpSlot, ready: boolean) => void;
  public onMatchStart?: (state: PvpArenaState) => void;
  public onState?: (state: PvpArenaState) => void;
  public onError?: (err: string) => void;

  private ws: WebSocket | null = null;
  private callbacks: PvpSessionCallbacks;
  private reconnectTimer: any = null;
  private isDisposed = false;
  private pendingCreate?: { operatorId: CharacterId; playerName: string };
  private pendingJoin?: { code: string; operatorId: CharacterId; playerName: string };

  constructor(callbacks: PvpSessionCallbacks = {}) {
    this.callbacks = callbacks;
    this.connect();
  }

  private connect() {
    if (this.isDisposed) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/pvp-ws`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.callbacks.onConnectionChange?.(true);
        if (this.pendingCreate) {
          this.createRoom(this.pendingCreate.operatorId, this.pendingCreate.playerName);
          this.pendingCreate = undefined;
        } else if (this.pendingJoin) {
          this.joinRoom(this.pendingJoin.code, this.pendingJoin.operatorId, this.pendingJoin.playerName);
          this.pendingJoin = undefined;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'room_created':
              this.roomCode = msg.code;
              this.slot = msg.slot;
              this.callbacks.onRoomCreated?.(msg.code, msg.slot, msg.state);
              this.callbacks.onStateUpdate?.(msg.state);
              this.onRoomJoined?.(msg.code, msg.slot, msg.state);
              this.onState?.(msg.state);
              break;

            case 'room_joined':
              this.roomCode = msg.code;
              this.slot = msg.slot;
              this.callbacks.onRoomJoined?.(msg.code, msg.slot, msg.state);
              this.callbacks.onStateUpdate?.(msg.state);
              this.onRoomJoined?.(msg.code, msg.slot, msg.state);
              this.onState?.(msg.state);
              break;

            case 'player_joined':
              this.onPlayerJoined?.(msg.player || { nickname: msg.nickname || 'Player', slot: msg.slot || 'p2' });
              break;

            case 'player_ready':
              this.onPlayerReady?.(msg.slot, msg.ready);
              break;

            case 'match_start':
              this.onMatchStart?.(msg.state);
              this.onState?.(msg.state);
              break;

            case 'room_update':
              this.callbacks.onStateUpdate?.(msg.state);
              this.onState?.(msg.state);
              if (msg.state?.status === 'in_round' || msg.state?.status === 'countdown') {
                this.onMatchStart?.(msg.state);
              }
              break;

            case 'error':
              this.callbacks.onError?.(msg.message || 'Błąd serwera PvP');
              this.onError?.(msg.message || 'Błąd serwera PvP');
              break;
          }
        } catch (e) {
          console.error('[PVP-CLIENT] Error parsing server message:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.warn('[PVP-CLIENT] WebSocket error:', e);
      };

      this.ws.onclose = () => {
        this.callbacks.onConnectionChange?.(false);
        if (!this.isDisposed) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        }
      };
    } catch (err) {
      console.error('[PVP-CLIENT] Connection initiation failed:', err);
    }
  }

  public createRoom(operatorId: CharacterId, playerName: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingCreate = { operatorId, playerName };
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'create_room',
      operatorId,
      playerName,
    }));
  }

  public joinRoom(code: string, operatorId: CharacterId, playerName: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingJoin = { code, operatorId, playerName };
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'join_room',
      code,
      operatorId,
      playerName,
    }));
  }

  public setReady(ready: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'set_ready',
      ready,
    }));
  }

  public sendInput(intent: PvpInputIntent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'input',
      ...intent,
    }));
  }

  public requestRematch() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'rematch',
    }));
  }

  public leaveRoom() {
    this.dispose();
  }

  public dispose() {
    this.isDisposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Local practice session with an intelligent tactical AI bot.
 * Uses identical state & physics updates as the server.
 */
export class PvpLocalBotSession implements IPvpSession {
  public readonly isLocalBot = true;
  public readonly slot: PvpSlot = 'p1';
  public readonly roomCode = 'BOT-1V1';

  public onState?: (state: PvpArenaState) => void;

  private state: PvpArenaState;
  private callbacks: PvpSessionCallbacks;
  private p1Input: PvpInputIntent = { moveX: 0, moveZ: 0, aimAngle: 0, isFiring: false };
  private p2Input: PvpInputIntent = { moveX: 0, moveZ: 0, aimAngle: Math.PI, isFiring: false };
  private loopInterval: any = null;
  private lastTime = Date.now();
  private botReactionTimer = 0;
  private botRepositionTimer = 0;
  private botTargetMove = { x: 0, z: 0 };

  constructor(
    operatorId: CharacterId,
    botOperatorId: CharacterId,
    playerName: string,
    botNameOrCallbacks?: string | PvpSessionCallbacks,
    callbacks: PvpSessionCallbacks = {}
  ) {
    if (typeof botNameOrCallbacks === 'object') {
      this.callbacks = botNameOrCallbacks;
    } else {
      this.callbacks = callbacks;
    }
    const botName = typeof botNameOrCallbacks === 'string' ? botNameOrCallbacks : `BOT ${botOperatorId.toUpperCase()}`;
    this.state = createInitialPvpArenaState(operatorId, playerName, botOperatorId, botName);
    this.state.p1.isReady = true;
    this.state.p2.isReady = true;
    this.state.p2.connected = true;

    // Start countdown
    resetPvpRound(this.state);

    setTimeout(() => {
      this.callbacks.onRoomCreated?.(this.roomCode, 'p1', this.state);
      this.callbacks.onStateUpdate?.(this.state);
      this.onState?.(this.state);
      this.startLoop();
    }, 50);
  }

  private startLoop() {
    this.lastTime = Date.now();
    this.loopInterval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      // Update bot AI
      this.updateBot(dt);

      // Step simulation
      stepPvpArena(this.state, dt, this.p1Input, this.p2Input);

      // Clear single-frame intents
      if (this.p1Input.wantDash) this.p1Input.wantDash = false;
      if (this.p1Input.wantAbility) this.p1Input.wantAbility = false;
      if (this.p2Input.wantDash) this.p2Input.wantDash = false;
      if (this.p2Input.wantAbility) this.p2Input.wantAbility = false;

      this.callbacks.onStateUpdate?.(this.state);
      this.onState?.(this.state);
    }, 1000 / 30);
  }

  private updateBot(dt: number) {
    if (this.state.status !== 'in_round') {
      this.p2Input = { moveX: 0, moveZ: 0, aimAngle: -Math.PI / 2, isFiring: false };
      return;
    }

    const bot = this.state.p2;
    const player = this.state.p1;
    const dx = player.x - bot.x;
    const dz = player.z - bot.z;
    const distToPlayer = Math.hypot(dx, dz) || 0.001;

    // Aim toward player with slight dynamic aim lead
    const aimAngle = Math.atan2(dx, dz);
    this.p2Input.aimAngle = aimAngle;

    // Fire if in range and line of sight reasonable
    this.p2Input.isFiring = distToPlayer < 22;

    // Tactical movement logic
    this.botReactionTimer -= dt;
    this.botRepositionTimer -= dt;

    if (this.botRepositionTimer <= 0) {
      this.botRepositionTimer = 0.8 + Math.random() * 0.7;

      // If low HP and medkit active, move towards medkit
      if (bot.hp < 450 && this.state.pickup.active) {
        const medX = this.state.pickup.x - bot.x;
        const medZ = this.state.pickup.z - bot.z;
        const medDist = Math.hypot(medX, medZ) || 1;
        this.botTargetMove = { x: medX / medDist, z: medZ / medDist };
      } else if (distToPlayer > 14) {
        // Advance
        this.botTargetMove = { x: dx / distToPlayer, z: dz / distToPlayer };
      } else if (distToPlayer < 6) {
        // Back off or circle
        const strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.botTargetMove = {
          x: (-dx / distToPlayer) * 0.7 + (-dz / distToPlayer) * strafeDir * 0.7,
          z: (-dz / distToPlayer) * 0.7 + (dx / distToPlayer) * strafeDir * 0.7,
        };
      } else {
        // Combat strafing
        const strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.botTargetMove = {
          x: (-dz / distToPlayer) * strafeDir,
          z: (dx / distToPlayer) * strafeDir,
        };
      }
    }

    this.p2Input.moveX = this.botTargetMove.x;
    this.p2Input.moveZ = this.botTargetMove.z;

    // Bot dash logic: dash if player projectiles are incoming
    for (const proj of this.state.projectiles) {
      if (proj.ownerSlot === 'p1') {
        const pDist = Math.hypot(bot.x - proj.x, bot.z - proj.z);
        if (pDist < 4.0 && bot.dashCooldownTimer <= 0) {
          this.p2Input.wantDash = true;
          break;
        }
      }
    }

    // Bot ability logic
    if (bot.abilityCooldownTimer <= 0) {
      if (bot.operatorId === 'grzesiek' && distToPlayer < 8.0) {
        this.p2Input.wantAbility = true;
      } else if (bot.operatorId === 'marcin' && bot.hp < 700) {
        this.p2Input.wantAbility = true;
      } else if (bot.operatorId === 'dawid' && distToPlayer < 12.0) {
        this.p2Input.wantAbility = true;
      } else if (bot.operatorId === 'mateusz' && distToPlayer < 5.0) {
        this.p2Input.wantAbility = true;
      } else if (bot.operatorId === 'piotr' && distToPlayer < 6.5) {
        this.p2Input.wantAbility = true;
      }
    }
  }

  public createRoom() {
    // No-op for bot session
  }

  public joinRoom() {
    // No-op for bot session
  }

  public setReady(ready: boolean) {
    this.state.p1.isReady = ready;
    if (ready) {
      resetPvpRound(this.state);
    }
    this.callbacks.onStateUpdate?.(this.state);
    this.onState?.(this.state);
  }

  public sendInput(intent: PvpInputIntent) {
    this.p1Input = { ...intent };
  }

  public requestRematch() {
    this.state.round = 1;
    this.state.currentRound = 1;
    this.state.p1.score = 0;
    this.state.p2.score = 0;
    this.state.p1.damageDealt = 0;
    this.state.p2.damageDealt = 0;
    this.state.p1.shotsFired = 0;
    this.state.p2.shotsFired = 0;
    this.state.p1.shotsHit = 0;
    this.state.p2.shotsHit = 0;
    this.state.matchWinner = null;
    this.state.winner = null;
    resetPvpRound(this.state);
    this.callbacks.onStateUpdate?.(this.state);
    this.onState?.(this.state);
  }

  public leaveRoom() {
    this.dispose();
  }

  public dispose() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }
}
