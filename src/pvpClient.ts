import type { CharacterId } from './types.ts';
import {
  createInitialPvpArenaState,
  resetPvpRound,
  resetPvpMatchStats,
  sanitizePvpInputIntent,
  sanitizePvpProgressionBonuses,
  NEUTRAL_PVP_PROGRESSION_BONUSES,
  stepPvpArena,
} from './pvpArena.ts';
import { choosePvpBotDecision } from './pvpBotTactics.ts';
import type {
  PvpArenaState,
  PvpInputIntent,
  PvpProgressionBonuses,
  PvpSlot,
} from './pvpArena.ts';

export type PvpMatchmakingStatus = 'searching' | 'matched' | 'cancelled';

export interface PvpSessionCallbacks {
  onRoomCreated?: (code: string, slot: 'p1', state: PvpArenaState) => void;
  onRoomJoined?: (code: string, slot: 'p2', state: PvpArenaState) => void;
  onStateUpdate?: (state: PvpArenaState) => void;
  onError?: (message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onMatchmakingStatus?: (status: PvpMatchmakingStatus, position: number, waitingPlayers: number) => void;
  onMatchFound?: (code: string) => void;
}

export interface IPvpSession {
  readonly isLocalBot: boolean;
  readonly slot: PvpSlot;
  readonly roomCode: string;
  createRoom?(operatorId: CharacterId, playerName: string, progressionBonuses?: PvpProgressionBonuses): void;
  joinRoom?(code: string, operatorId: CharacterId, playerName: string, progressionBonuses?: PvpProgressionBonuses): void;
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
  public onConnectionChange?: (connected: boolean) => void;
  public onRematchWaiting?: (votes: number, required: number) => void;
  public onRoomClosed?: (message: string) => void;
  public onMatchmakingStatus?: (status: PvpMatchmakingStatus, position: number, waitingPlayers: number) => void;
  public onMatchFound?: (code: string) => void;

  private ws: WebSocket | null = null;
  private callbacks: PvpSessionCallbacks;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDisposed = false;
  private isUnavailable = false;
  private hasJoinedRoom = false;
  private hasStartedMatch = false;
  private reconnectAttempts = 0;
  private pendingCreate?: { operatorId: CharacterId; playerName: string; progressionBonuses: PvpProgressionBonuses };
  private pendingJoin?: { code: string; operatorId: CharacterId; playerName: string; progressionBonuses: PvpProgressionBonuses };
  private pendingMatchmaking?: { operatorId: CharacterId; playerName: string; progressionBonuses: PvpProgressionBonuses };
  private matchmakingRequested = false;

  private static readonly MAX_CONNECT_ATTEMPTS = 3;
  // Render Free can take about a minute to wake after inactivity. Give the
  // first handshake enough time, then use shorter bounded retries.
  private static readonly CONNECT_TIMEOUT_MS = 75_000;
  private static readonly RETRY_CONNECT_TIMEOUT_MS = 12_000;

  constructor(callbacks: PvpSessionCallbacks = {}) {
    this.callbacks = callbacks;
    this.connect();
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private emitError(message: string) {
    this.callbacks.onError?.(message);
    this.onError?.(message);
  }

  private getSocketUrl(): string | null {
    const configuredUrl = import.meta.env.VITE_PVP_WS_URL?.trim();
    // Production Render endpoint supplied for the live PvP service.
    // VITE_PVP_WS_URL remains an optional build-time override.
    const productionUrl = 'wss://paleciaki-pvp.onrender.com/pvp-ws';
    const isGitHubPages = /\.github\.io$/i.test(window.location.hostname);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = configuredUrl || (isGitHubPages ? productionUrl : `${protocol}//${window.location.host}/pvp-ws`);
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return null;
      if (window.location.protocol === 'https:' && parsed.protocol !== 'wss:') return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private connect() {
    if (this.isDisposed || this.isUnavailable) return;

    const url = this.getSocketUrl();
    if (!url) {
      const message = this.isUnavailable
        ? 'PvP online wymaga osobnego serwera WebSocket. Na GitHub Pages możesz trenować z botem; online uruchomimy po skonfigurowaniu hostingu.'
        : 'Nieprawidłowy adres serwera PvP. Wymagany jest adres ws:// lub wss:// (na HTTPS wyłącznie wss://).';
      this.isUnavailable = true;
      // Defer so callers can attach onError immediately after constructing this session.
      window.setTimeout(() => this.emitError(message), 0);
      return;
    }

    try {
      const socket = new WebSocket(url);
      this.ws = socket;
      const timeoutMs = this.reconnectAttempts === 0
        ? PvpNetworkSession.CONNECT_TIMEOUT_MS
        : PvpNetworkSession.RETRY_CONNECT_TIMEOUT_MS;
      this.connectionTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }, timeoutMs);

      socket.onopen = () => {
        if (this.isDisposed || socket !== this.ws) {
          socket.close();
          return;
        }
        this.clearConnectionTimeout();
        this.callbacks.onConnectionChange?.(true);
        this.onConnectionChange?.(true);
        if (this.pendingCreate) {
          this.createRoom(this.pendingCreate.operatorId, this.pendingCreate.playerName, this.pendingCreate.progressionBonuses);
        } else if (this.pendingJoin) {
          this.joinRoom(this.pendingJoin.code, this.pendingJoin.operatorId, this.pendingJoin.playerName, this.pendingJoin.progressionBonuses);
        } else if (this.pendingMatchmaking) {
          // Keep the request until matched/cancelled so reconnects can re-enter the FIFO queue.
          const request = this.pendingMatchmaking;
          this.send({ type: 'find_match', operatorId: request.operatorId, playerName: request.playerName, progressionBonuses: request.progressionBonuses });
        }
      };

      socket.onmessage = (event) => {
        if (this.isDisposed || socket !== this.ws) return;
        try {
          const msg = JSON.parse(String(event.data));
          if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
          switch (msg.type) {
            case 'matchmaking_status': {
              const position = Number.isFinite(msg.position) ? Math.max(1, Math.floor(msg.position)) : 1;
              const waitingPlayers = Number.isFinite(msg.waitingPlayers) ? Math.max(1, Math.floor(msg.waitingPlayers)) : position;
              this.callbacks.onMatchmakingStatus?.('searching', position, waitingPlayers);
              this.onMatchmakingStatus?.('searching', position, waitingPlayers);
              break;
            }
            case 'match_found': {
              const code = typeof msg.code === 'string' ? msg.code : '';
              this.callbacks.onMatchFound?.(code);
              this.onMatchFound?.(code);
              this.callbacks.onMatchmakingStatus?.('matched', 0, 2);
              this.onMatchmakingStatus?.('matched', 0, 2);
              break;
            }
            case 'matchmaking_cancelled':
              this.callbacks.onMatchmakingStatus?.('cancelled', 0, 0);
              this.onMatchmakingStatus?.('cancelled', 0, 0);
              break;
            case 'room_created':
            case 'room_joined': {
              if (typeof msg.code !== 'string' || (msg.slot !== 'p1' && msg.slot !== 'p2') || !msg.state) {
                this.emitError('Serwer zwrócił nieprawidłowe dane pokoju.');
                return;
              }
              this.roomCode = msg.code;
              this.slot = msg.slot;
              this.hasJoinedRoom = true;
              this.reconnectAttempts = 0;
              this.pendingCreate = undefined;
              this.pendingJoin = undefined;
              if (msg.type === 'room_created') {
                this.callbacks.onRoomCreated?.(msg.code, msg.slot, msg.state);
              } else {
                this.callbacks.onRoomJoined?.(msg.code, msg.slot, msg.state);
              }
              this.callbacks.onStateUpdate?.(msg.state);
              this.onRoomJoined?.(msg.code, msg.slot, msg.state);
              this.onState?.(msg.state);
              if (this.matchmakingRequested) {
                // Random matches start immediately: both matched clients confirm ready.
                this.matchmakingRequested = false;
                this.pendingMatchmaking = undefined;
                this.send({ type: 'set_ready', ready: true });
              }
              break;
            }
            case 'player_joined':
              this.onPlayerJoined?.(msg.player || { nickname: msg.nickname || 'Player', slot: msg.slot || 'p2' });
              break;
            case 'player_ready':
              if (msg.slot === 'p1' || msg.slot === 'p2') this.onPlayerReady?.(msg.slot, msg.ready === true);
              break;
            case 'match_start':
              if (msg.state) {
                this.onMatchStart?.(msg.state);
                this.onState?.(msg.state);
              }
              break;
            case 'room_update':
              if (!msg.state) return;
              this.callbacks.onStateUpdate?.(msg.state);
              this.onState?.(msg.state);
              if (
                !this.hasStartedMatch &&
                (msg.state.status === 'in_round' || msg.state.status === 'countdown')
              ) {
                this.hasStartedMatch = true;
                this.onMatchStart?.(msg.state);
              }
              break;
            case 'rematch_waiting':
              this.onRematchWaiting?.(
                Number.isFinite(msg.votes) ? msg.votes : 1,
                Number.isFinite(msg.required) ? msg.required : 2,
              );
              break;
            case 'room_closed': {
              const message = typeof msg.message === 'string' ? msg.message : 'Pokój został zamknięty.';
              this.onRoomClosed?.(message);
              this.emitError(message);
              this.dispose();
              break;
            }
            case 'error':
              this.pendingCreate = undefined;
              this.pendingJoin = undefined;
              this.pendingMatchmaking = undefined;
              this.matchmakingRequested = false;
              this.emitError(typeof msg.message === 'string' ? msg.message : 'Błąd serwera PvP.');
              break;
          }
        } catch {
          this.emitError('Serwer przesłał uszkodzony komunikat PvP.');
        }
      };

      socket.onerror = () => {
        // The close handler owns retries and the user-facing timeout message.
      };

      socket.onclose = (event) => {
        if (socket !== this.ws) return;
        this.clearConnectionTimeout();
        this.ws = null;
        this.callbacks.onConnectionChange?.(false);
        this.onConnectionChange?.(false);
        if (this.isDisposed) return;

        if (this.hasJoinedRoom) {
          this.emitError('Połączenie PvP zostało przerwane. Bieżący pokój nie obsługuje jeszcze wznowienia sesji.');
          this.dispose();
          return;
        }

        if (this.reconnectAttempts < PvpNetworkSession.MAX_CONNECT_ATTEMPTS) {
          const delay = 500 * (2 ** this.reconnectAttempts);
          this.reconnectAttempts++;
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, delay);
        } else {
          const reason = event.reason || 'Serwer PvP jest niedostępny.';
          this.pendingCreate = undefined;
          this.pendingJoin = undefined;
          this.pendingMatchmaking = undefined;
          this.matchmakingRequested = false;
          this.emitError(
            reason +
            ' Sprawdź adres hostingu i spróbuj ponownie. Na darmowym Render wybudzenie po bezczynności może trwać około minuty; pierwsza próba połączenia ma wydłużony limit.'
          );
          this.dispose();
        }
      };
    } catch {
      this.emitError('Nie udało się uruchomić połączenia WebSocket PvP.');
    }
  }

  private send(message: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch {
      this.emitError('Nie udało się wysłać komunikatu PvP.');
      return false;
    }
  }

  public createRoom(
    operatorId: CharacterId,
    playerName: string,
    progressionBonuses: PvpProgressionBonuses = NEUTRAL_PVP_PROGRESSION_BONUSES,
  ) {
    if (this.isUnavailable || this.isDisposed) return;
    const safeBonuses = sanitizePvpProgressionBonuses(progressionBonuses);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingCreate = { operatorId, playerName, progressionBonuses: safeBonuses };
      return;
    }
    this.send({ type: 'create_room', operatorId, playerName, progressionBonuses: safeBonuses });
  }

  public joinRoom(
    code: string,
    operatorId: CharacterId,
    playerName: string,
    progressionBonuses: PvpProgressionBonuses = NEUTRAL_PVP_PROGRESSION_BONUSES,
  ) {
    if (this.isUnavailable || this.isDisposed) return;
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(normalizedCode)) {
      this.emitError('Kod pokoju musi zawierać dokładnie 6 znaków.');
      return;
    }
    const safeBonuses = sanitizePvpProgressionBonuses(progressionBonuses);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingJoin = { code: normalizedCode, operatorId, playerName, progressionBonuses: safeBonuses };
      return;
    }
    this.send({ type: 'join_room', code: normalizedCode, operatorId, playerName, progressionBonuses: safeBonuses });
  }

  /** Join the FIFO public queue; the server assigns the first available opponent. */
  public findMatch(
    operatorId: CharacterId,
    playerName: string,
    progressionBonuses: PvpProgressionBonuses = NEUTRAL_PVP_PROGRESSION_BONUSES,
  ) {
    if (this.isUnavailable || this.isDisposed || this.hasJoinedRoom) return;
    this.matchmakingRequested = true;
    this.pendingMatchmaking = { operatorId, playerName, progressionBonuses: sanitizePvpProgressionBonuses(progressionBonuses) };
    this.pendingCreate = undefined;
    this.pendingJoin = undefined;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const request = this.pendingMatchmaking;
    this.send({ type: 'find_match', operatorId: request.operatorId, playerName: request.playerName, progressionBonuses: request.progressionBonuses });
  }

  /** Cancel search safely; closing the socket also removes the player if the cancel packet races. */
  public cancelMatchmaking(): boolean {
    if (this.hasJoinedRoom || !this.matchmakingRequested) return false;
    this.matchmakingRequested = false;
    this.pendingMatchmaking = undefined;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'cancel_matchmaking' });
    }
    this.callbacks.onMatchmakingStatus?.('cancelled', 0, 0);
    this.onMatchmakingStatus?.('cancelled', 0, 0);
    this.dispose();
    return true;
  }

  public setReady(ready: boolean) {
    this.send({ type: 'set_ready', ready });
  }

  public sendInput(intent: PvpInputIntent) {
    if (!this.hasJoinedRoom && !this.isLocalBot) return;
    this.send({ type: 'input', ...sanitizePvpInputIntent(intent) });
  }

  public requestRematch() {
    this.send({ type: 'rematch' });
  }

  public leaveRoom() {
    this.dispose();
  }

  public dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.clearConnectionTimeout();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.close(1000, 'Client closed room');
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
  private botRepositionTimer = 0;
  private botDecisionTick = 0;
  private botPreviousOpponentPosition = { x: 0, z: 0 };
  private botOpponentVelocity = { x: 0, z: 0 };

  constructor(
    operatorId: CharacterId,
    botOperatorId: CharacterId,
    playerName: string,
    botNameOrCallbacks?: string | PvpSessionCallbacks,
    callbacks: PvpSessionCallbacks = {},
    progressionBonuses: PvpProgressionBonuses = NEUTRAL_PVP_PROGRESSION_BONUSES,
  ) {
    if (typeof botNameOrCallbacks === 'object') {
      this.callbacks = botNameOrCallbacks;
    } else {
      this.callbacks = callbacks;
    }
    const botName = typeof botNameOrCallbacks === 'string' ? botNameOrCallbacks : `BOT ${botOperatorId.toUpperCase()}`;
    this.state = createInitialPvpArenaState(operatorId, playerName, botOperatorId, botName, progressionBonuses);
    this.state.p1.isReady = true;
    this.state.p2.isReady = true;
    this.state.p2.connected = true;
    this.botPreviousOpponentPosition = { x: this.state.p1.x, z: this.state.p1.z };

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

      // Clear single-frame intents after the local authoritative tick.
      if (this.p1Input.wantFire) this.p1Input.wantFire = false;
      if (this.p1Input.wantDash) this.p1Input.wantDash = false;
      if (this.p1Input.wantAbility) this.p1Input.wantAbility = false;
      if (this.p2Input.wantFire) this.p2Input.wantFire = false;
      if (this.p2Input.wantDash) this.p2Input.wantDash = false;
      if (this.p2Input.wantAbility) this.p2Input.wantAbility = false;

      this.callbacks.onStateUpdate?.(this.state);
      this.onState?.(this.state);
    }, 1000 / 30);
  }

  private updateBot(dt: number) {
    const bot = this.state.p2;
    const player = this.state.p1;
    const safeDt = Number.isFinite(dt) ? Math.max(0.001, Math.min(dt, 0.1)) : 1 / 30;

    const rawVelocityX = (player.x - this.botPreviousOpponentPosition.x) / safeDt;
    const rawVelocityZ = (player.z - this.botPreviousOpponentPosition.z) / safeDt;
    const velocityLength = Math.hypot(rawVelocityX, rawVelocityZ);
    const velocityScale = velocityLength > 14 ? 14 / velocityLength : 1;
    const measuredVelocity = {
      x: rawVelocityX * velocityScale,
      z: rawVelocityZ * velocityScale,
    };
    this.botOpponentVelocity.x = this.botOpponentVelocity.x * 0.58 + measuredVelocity.x * 0.42;
    this.botOpponentVelocity.z = this.botOpponentVelocity.z * 0.58 + measuredVelocity.z * 0.42;
    this.botPreviousOpponentPosition = { x: player.x, z: player.z };

    this.botRepositionTimer -= safeDt;
    if (this.botRepositionTimer <= 0) {
      this.botRepositionTimer = 0.62;
      this.botDecisionTick += 1;
    }

    if (this.state.status !== 'in_round' || bot.stunTimer > 0 || bot.hp <= 0) {
      this.p2Input = {
        moveX: 0,
        moveZ: 0,
        aimAngle: Math.atan2(player.x - bot.x, player.z - bot.z),
        isFiring: false,
        wantDash: false,
        wantAbility: false,
      };
      return;
    }

    const decision = choosePvpBotDecision({
      bot,
      opponent: player,
      state: this.state,
      opponentVelocity: this.botOpponentVelocity,
      orbitSign: this.botDecisionTick % 2 === 0 ? 1 : -1,
    });
    this.p2Input = {
      ...this.p2Input,
      ...decision,
    };
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
    resetPvpMatchStats(this.state);
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
