import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_SEGMENTS, getMenuSegmentForTab } from '../src/menuSegments.ts';

const expected = [
  { id: 'play', label: 'ROZGRYWKA', tabs: ['tab-team', 'tab-map', 'tab-pvp'] },
  { id: 'world', label: 'ŚWIAT I BHP', tabs: ['tab-enemies', 'tab-perks', 'tab-field-guide'] },
  { id: 'progress', label: 'POSTĘPY', tabs: ['tab-talent-tree', 'tab-ranks', 'tab-leaderboard', 'tab-achievements'] },
  { id: 'system', label: 'SYSTEM', tabs: ['tab-settings'] },
];

test('each real menu destination belongs to exactly one correctly named segment', () => {
  assert.deepEqual(
    MENU_SEGMENTS.map(({ id, label, tabIds }) => ({ id, label, tabs: [...tabIds] })),
    expected,
  );

  const allTabs = MENU_SEGMENTS.flatMap((segment) => [...segment.tabIds]);
  assert.equal(new Set(allTabs).size, 11, 'all eleven destinations must be unique');
  assert.equal(allTabs.length, 11, 'all eleven destinations must be present');
});

test('menu destinations resolve to their owning segment without changing the target id', () => {
  for (const segment of expected) {
    for (const tabId of segment.tabs) {
      assert.equal(getMenuSegmentForTab(tabId)?.id, segment.id, tabId);
    }
  }
  assert.equal(getMenuSegmentForTab('unknown-panel'), null);
});
