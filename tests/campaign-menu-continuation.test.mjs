import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('all three game modes are always presented together and reuse the existing launch handlers', async () => {
  const [html, app, css] = await Promise.all([
    read('index.html'),
    read('src/index.ts'),
    read('src/menu-premium-refresh.css'),
  ]);
  const selectorStart = html.indexOf('<section class="menu-mode-selector"');
  const selectorEnd = html.indexOf('</section>', selectorStart);
  const tabsStart = html.indexOf('<div class="menu-tabs-bar">', selectorStart);
  assert.ok(selectorStart >= 0 && selectorEnd > selectorStart && tabsStart > selectorEnd);
  const selector = html.slice(selectorStart, selectorEnd);
  for (const [id, mode] of [
    ['btn-start-survival', 'survival'],
    ['btn-open-campaign', 'campaign'],
    ['btn-open-pvp', 'pvp'],
  ]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' should be unique');
    assert.match(selector, new RegExp('id="' + id + '"[^>]*data-mode="' + mode + '"'));
  }
  assert.match(app, /bindTap\(document\.getElementById\('btn-start-survival'\)/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-open-campaign'\)/);
  assert.match(app, /bindPvpTap\(btnOpenPvp, openLobby\)/);
  assert.match(css, /\.menu-mode-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.menu-mode-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(html, /<div class="menu-cta-row">/);
});

test('campaign menu exposes a clear continue action and loads its premium visual layer last', async () => {
  const [html, css] = await Promise.all([
    read('index.html'),
    read('src/menu-premium-refresh.css'),
  ]);
  const campaignBoard = html.indexOf('<section class="campaign-board"');
  const continueButton = html.indexOf('id="btn-campaign-continue"', campaignBoard);
  const stageGrid = html.indexOf('class="campaign-stage-grid"', campaignBoard);
  assert.ok(campaignBoard >= 0 && continueButton > campaignBoard && stageGrid > continueButton);
  assert.match(html, /id="campaign-continue-title"/);
  assert.match(html, /id="campaign-continue-subtitle"/);
  assert.ok(html.indexOf('/src/menu-premium-refresh.css') > html.indexOf('/src/campaign-mode.css'));
  assert.match(css, /--menu-bg:\s*#0b1219/);
  assert.match(css, /\.campaign-primary-action/);
  assert.match(css, /#title-screen \.menu-tab-btn\.active/);
});

test('continue campaign chooses the next unlocked uncleared stage and replays the finale after full completion', async () => {
  const [app, html] = await Promise.all([
    read('src/index.ts'),
    read('index.html'),
  ]);
  assert.match(app, /CAMPAIGN_STAGES\.find\(\(stage\) => unlocked\.has\(stage\.id\) && !campaignProgress\.completedStages\[stage\.id\]\?\.bestStars\)/);
  assert.match(app, /allComplete \? CAMPAIGN_STAGES\[CAMPAIGN_STAGES\.length - 1\]/);
  assert.match(app, /selectedCampaignStageId = nextStage\.id;\s*void doStartSurvival\(event\)/);
  assert.match(app, /this\.engine\.startCampaignStage\(chosenStage, campaignRewardId, campaignBonusXp\)/);
  assert.match(html, /data-campaign-stage="b4_intro"/);
  assert.match(html, /data-campaign-stage="final_audit"/);
});

test('campaign continuation keeps the existing local save and manual stage selection paths', async () => {
  const app = await read('src/index.ts');
  assert.match(app, /readCampaignProgress\(window\.localStorage\)/);
  assert.match(app, /writeCampaignProgress\(window\.localStorage, campaignProgress\)/);
  assert.match(app, /recordCampaignStageResult\(/);
  assert.match(app, /document\.querySelectorAll<HTMLButtonElement>\('\[data-campaign-stage\]'\)/);
  assert.match(app, /selectedCampaignStageId = id;\s*doStartSurvival\(event\)/);
});
