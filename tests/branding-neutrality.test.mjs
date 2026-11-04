import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('public identity and operator labels are generic', async () => {
  const [html, app, intro, characters, metadata] = await Promise.all([
    read('../index.html'),
    read('../src/index.ts'),
    read('../src/cinematicIntro.ts'),
    read('../src/characters.ts'),
    read('../metadata.json'),
  ]);
  assert.match(html, /<title>Paleciaki! Magazyn Chaosu<\/title>/);
  assert.match(html, /SURVIVAL • FALE • HORDY I EWOLUCJE/);
  assert.match(metadata, /"name": "Paleciaki! Magazyn Chaosu"/);

  const publicHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s(?:id|class|data-[\w:-]+|aria-[\w:-]+|title)="[^"]*"/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const publicCopy = [publicHtml, intro, characters].join('\n');
  assert.doesNotMatch(publicCopy,
    /Max-Flix|Max-Fliz|Palczak|Kuleto|Walczak|Króla-Leto|Zdzich|\bAtlas\b|\bForge\b|\bVector\b|\bVolt\b|\bRook\b|\bMarcin\b|\bGrzesiek\b|\bDawid\b|\bMateusz\b|\bPiotr\b|\bSebix\b|\bRudi\b/i);
  assert.match(characters, /name: 'Operator 01'/);
  assert.match(characters, /name: 'Operator 05'/);
  assert.doesNotMatch(app, /launchCampaignGame|doStartGame|id="btn-start-game"|story-intro-modal/);
});

test('the public UI exposes Survival only', async () => {
  const html = await read('../index.html');
  const app = await read('../src/index.ts');
  assert.match(html, /id="btn-start-survival"/);
  assert.doesNotMatch(html, /id="btn-start-game"|data-tab="tab-zones"|data-tab="tab-story"|id="story-intro-modal"|KAMPANIA|kampania|kampanię|btn-open-cinematic-intro/i);
  assert.match(html, /RANKING GLOBALNY • SURVIVAL/);
  assert.doesNotMatch(html, /RANKING GLOBALNY • .*KAMPANIA/i);
  assert.doesNotMatch(app, /launchCampaignGame|doStartGame|id="btn-start-game"|story-intro-modal/);
  assert.match(app, /bindTap\(document\.getElementById\('btn-start-survival'\), doStartSurvival\)/);
});

test('Survival reset is internal and never constructs a campaign level', async () => {
  const [app, game] = await Promise.all([read('../src/index.ts'), read('../src/game.ts')]);
  assert.match(game, /private resetSurvivalRun\(\)/);
  assert.match(game, /this\.resetSurvivalRun\(\)/);
  assert.doesNotMatch(game, /public startGame\(/);
  assert.doesNotMatch(app, /this\.engine\.startGame\(/);
  assert.match(game, /this\.gameMode = 'survival';/);
});
