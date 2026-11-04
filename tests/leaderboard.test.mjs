import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLeaderboardTimestamp,
  getLeaderboardSlice,
  mergeLeaderboardEntries,
  normalizeLeaderboardEntry,
} from '../src/leaderboard.ts';

const entry = (overrides = {}) => normalizeLeaderboardEntry({
  id: 'score-1',
  playerName: 'Operator',
  hero: 'Marcin',
  mode: 'campaign',
  score: 1000,
  coins: 2,
  timeSeconds: 60,
  bossDefeated: false,
  createdAt: '2026-11-04T00:00:00.000Z',
  ...overrides,
});

test('leaderboard normalization preserves both modes and safely classifies legacy entries', () => {
  assert.equal(entry({ mode: 'survival' }).mode, 'survival');
  assert.equal(entry({ mode: 'campaign' }).mode, 'campaign');
  assert.equal(entry({ mode: undefined }).mode, 'campaign');
  assert.equal(entry({ mode: 'unknown' }).mode, 'campaign');
});

test('leaderboard normalizes hostile names and clamps invalid score fields', () => {
  const normalized = entry({
    playerName: '   <script>alert(1)</script>   ',
    score: Number.POSITIVE_INFINITY,
    coins: -20,
    timeSeconds: Number.NaN,
  });
  assert.equal(normalized.playerName, '<script>alert(1)</script>');
  assert.equal(normalized.score, 0);
  assert.equal(normalized.coins, 0);
  assert.equal(normalized.timeSeconds, 0);
});

test('global ranking orders Campaign and Survival by the same score rule', () => {
  const ranked = getLeaderboardSlice([
    entry({ id: 'campaign', mode: 'campaign', score: 1200 }),
    entry({ id: 'survival', mode: 'survival', score: 1800 }),
    entry({ id: 'lower', mode: 'survival', score: 900 }),
  ], 15);
  assert.deepEqual(ranked.map(item => [item.id, item.mode]), [
    ['survival', 'survival'],
    ['campaign', 'campaign'],
    ['lower', 'survival'],
  ]);
});

test('ranking ties are deterministic: boss clear, VIP cargo, then first submission', () => {
  const ranked = getLeaderboardSlice([
    entry({ id: 'later', score: 500, createdAt: '2026-11-04T00:02:00.000Z' }),
    entry({ id: 'vip', score: 500, coins: 3, createdAt: '2026-11-04T00:03:00.000Z' }),
    entry({ id: 'boss', score: 500, bossDefeated: true, createdAt: '2026-11-04T00:04:00.000Z' }),
    entry({ id: 'earlier', score: 500, createdAt: '2026-11-04T00:01:00.000Z' }),
  ]);
  assert.deepEqual(ranked.map(item => item.id), ['boss', 'vip', 'earlier', 'later']);
});

test('local pending entries are replaced by acknowledged cloud records with the same id', () => {
  const pending = entry({ id: 'queued', score: 700, syncStatus: 'pending' });
  const online = entry({ id: 'queued', score: 700, syncStatus: 'online' });
  const merged = mergeLeaderboardEntries([pending], [online, entry({ id: 'other', score: 100 })]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].syncStatus, 'online');
  assert.equal(merged[0].id, 'queued');
});


test('leaderboard record timestamps are displayed in Polish local time', () => {
  assert.equal(formatLeaderboardTimestamp('2026-11-04T16:30:00.000Z'), '04.11.2026, 17:30');
  assert.equal(formatLeaderboardTimestamp('1970-01-01T00:00:00.000Z'), 'DATA NIEZNANA');
  assert.equal(formatLeaderboardTimestamp('not-a-date'), 'DATA NIEZNANA');
});

