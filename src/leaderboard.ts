export type LeaderboardGameMode = 'campaign' | 'survival';
export type LeaderboardSyncStatus = 'online' | 'pending';

export interface LeaderboardEntry {
  id?: string;
  playerName: string;
  hero: string;
  mode: LeaderboardGameMode;
  score: number;
  coins: number;
  timeSeconds: number;
  bossDefeated: boolean;
  createdAt: string;
  /** Local-only marker. It is never written to Firestore. */
  syncStatus?: LeaderboardSyncStatus;
}

export type LeaderboardEntryInput = Partial<LeaderboardEntry> & { id?: string };

function finiteNonNegative(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

/** Old cloud rows did not store a mode; keep them visible as Campaign legacy rows. */
export function normalizeLeaderboardEntry(
  data: LeaderboardEntryInput,
  fallbackId?: string,
): LeaderboardEntry {
  return {
    id: data.id || fallbackId,
    playerName: String(data.playerName || 'Magazynier').trim().slice(0, 32) || 'Magazynier',
    hero: String(data.hero || 'Marcin').slice(0, 20),
    mode: data.mode === 'survival' ? 'survival' : 'campaign',
    score: Math.min(10_000_000, finiteNonNegative(data.score)),
    coins: Math.min(100_000, finiteNonNegative(data.coins)),
    timeSeconds: finiteNonNegative(data.timeSeconds),
    bossDefeated: Boolean(data.bossDefeated),
    createdAt: typeof data.createdAt === 'string' && data.createdAt.length <= 64
      ? data.createdAt
      : new Date(0).toISOString(),
    syncStatus: data.syncStatus === 'pending' ? 'pending' : 'online',
  };
}

/**
 * Global cross-mode ranking: score is the primary measure. Boss clear and VIP
 * pickups resolve ties; the earlier verified submission wins the remaining tie.
 */
export function compareLeaderboardEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score ||
    Number(b.bossDefeated) - Number(a.bossDefeated) ||
    b.coins - a.coins ||
    a.createdAt.localeCompare(b.createdAt) ||
    String(a.id || '').localeCompare(String(b.id || ''));
}

export function mergeLeaderboardEntries(
  ...groups: ReadonlyArray<readonly LeaderboardEntry[]>
): LeaderboardEntry[] {
  const byId = new Map<string, LeaderboardEntry>();
  const anonymous: LeaderboardEntry[] = [];

  for (const group of groups) {
    for (const entry of group) {
      if (!entry) continue;
      if (!entry.id) {
        anonymous.push(entry);
        continue;
      }
      const current = byId.get(entry.id);
      // An acknowledged cloud row replaces its local pending twin.
      if (!current || (current.syncStatus === 'pending' && entry.syncStatus !== 'pending')) {
        byId.set(entry.id, entry);
      }
    }
  }

  return [...byId.values(), ...anonymous].sort(compareLeaderboardEntries);
}

export function getLeaderboardSlice(
  entries: readonly LeaderboardEntry[],
  maxEntries = 15,
): LeaderboardEntry[] {
  const limit = Number.isFinite(maxEntries) ? Math.max(0, Math.floor(maxEntries)) : 15;
  return [...entries].sort(compareLeaderboardEntries).slice(0, limit);
}


/**
 * Format the immutable record timestamp for the Polish global leaderboard.
 * Legacy rows without a trustworthy timestamp are explicitly marked unknown.
 */
export function formatLeaderboardTimestamp(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || timestamp <= Date.UTC(2000, 0, 1)) {
    return 'Data nieznana';
  }
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp));
}
