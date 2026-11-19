import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Campaign is exposed as a primary menu destination and one-tap title-screen shortcut', async () => {
  const [html, app, campaign] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/campaignProgression.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="btn-open-campaign"/);
  assert.match(html, /KAMPANIA • 5 ETAPÓW/);
  assert.match(html, /data-tab="tab-map"[^>]*aria-label="Tryb fabularny: kampania pięciu etapów oraz atlas świata"/);
  assert.match(html, /<span class="tab-label">KAMPANIA<\/span>/);
  assert.match(html, /id="campaign-board-title">KAMPANIA ZMIAN/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-open-campaign'\)/);
  assert.match(app, /menuTabButtons\.find\(\(tab\) => tab\.getAttribute\('data-tab'\) === 'tab-map'\)/);
  assert.match(app, /if \(campaignTab\) activateMenuTab\(campaignTab\)/);
  assert.match(campaign, /export const CAMPAIGN_STAGES/);
  assert.match(campaign, /durationSeconds: 90/);
});
