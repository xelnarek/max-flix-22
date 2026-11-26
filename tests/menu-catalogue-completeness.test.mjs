import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AVAILABLE_PERKS } from '../src/types.ts';
import { SURVIVAL_FIREARM_DEFS } from '../src/survivalFirearms.ts';
import { getEnemyMeleeTelegraphProfile } from '../src/enemyMeleeTelegraphs.ts';
import { CHARACTERS } from '../src/characters.ts';
import { CAMPAIGN_STAGES } from '../src/campaignProgression.ts';
import { SURVIVAL_MAP_IDS, SURVIVAL_MAPS } from '../src/survivalMaps.ts';
import { PVP_OPERATOR_PROFILES } from '../src/pvpArena.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const sort = (values) => [...values].sort();
const format = (value) => value.toFixed(2).replace('.', ',');

test('Bestiariusz ma osobną kartę, ikonę, opis i kontrę dla każdego typu przeciwnika', async () => {
  const [html, typesSource, css] = await Promise.all([
    read('../index.html'),
    read('../src/types.ts'),
    read('../src/enemy-bestiary-polish.css'),
  ]);
  const unionStart = typesSource.indexOf('export type EnemyType =');
  const unionEnd = typesSource.indexOf(';', unionStart);
  const sourceIds = [...typesSource.slice(unionStart, unionEnd).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const cards = [...html.matchAll(/<article class="enemy-guide-card[^"]*" data-enemy-type="([^"]+)">([\\s\\S]*?)<\\/article>/g)];
  const cardIds = cards.map((m) => m[1]);

  assert.equal(sourceIds.length, 25);
  assert.equal(cards.length, 25);
  assert.equal(new Set(cardIds).size, 25, 'enemy cards must not duplicate an archetype');
  assert.deepEqual(sort(cardIds), sort(sourceIds));
  assert.match(html, /<span>25<\\/span> TYPÓW/);

  for (const [, id, card] of cards) {
    assert.match(card, /enemy-guide-badge/);
    assert.match(card, /enemy-guide-title">[^<]{3,}/);
    assert.match(card, /enemy-guide-kind/);
    assert.match(card, /<p class="enemy-guide-copy">[^<]{30,}/);
    assert.match(card, /enemy-guide-tactic/);
  }

  for (const id of ['wkurzona_zona', 'kluska_piekielna']) {
    const card = cards.find((m) => m[1] === id)?.[2] || '';
    assert.ok(card.includes('enemy-guide-card--' + (id === 'wkurzona_zona' ? 'zona' : 'kluska')));
  }
  assert.match(html, /data-enemy-type="wkurzona_zona"[\\s\\S]*?Patelniowa Egzekutorka/);
  assert.match(html, /data-enemy-type="kluska_piekielna"[\\s\\S]*?Tropiciel B4/);
  assert.match(html, /enemy-hazards-strip/);
  assert.match(html, /Gilotyna CNC/);
  assert.match(html, /Prasa 500T/);
  assert.match(html, /Gejzery pary/);
  assert.match(html, /Klej Mapei C2TE/);
  assert.match(css, /enemy-guide-kind/);
  assert.match(css, /enemy-guide-tactic/);
  assert.match(css, /enemy-hazards-grid/);
});

test('parametry sygnału, zasięgu i regeneracji w Bestiariuszu są zgodne z telegraphami walki', async () => {
  const html = await read('../index.html');
  const cards = new Map([...html.matchAll(/<article class="enemy-guide-card[^"]*" data-enemy-type="([^"]+)">([\\s\\S]*?)<\\/article>/g)].map((m) => [m[1], m[2]]));
  let measured = 0;
  for (const type of Object.keys((await import('../src/enemyVisualProfiles.ts')).ENEMY_VISUAL_PROFILES)) {
    const profile = getEnemyMeleeTelegraphProfile(type);
    if (!profile) continue;
    measured += 1;
    const card = cards.get(type);
    assert.ok(card, 'missing card for ' + type);
    assert.ok(card.includes(format(profile.windupSeconds) + ' s'), 'wrong windup for ' + type);
    assert.ok(card.includes(format(profile.reachMeters) + ' m'), 'wrong reach for ' + type);
    assert.ok(card.includes(format(profile.recoverySeconds) + ' s'), 'wrong recovery for ' + type);
  }
  assert.equal(measured, 12);
});

test('katalog perków i przyciski DROP W GRZE pokrywają wszystkie 18 definicji', async () => {
  const [html, typesSource, css] = await Promise.all([
    read('../index.html'),
    read('../src/types.ts'),
    read('../src/enemy-bestiary-polish.css'),
  ]);
  const sectionStart = html.indexOf('<div id="tab-perks"');
  const sectionEnd = html.indexOf('<div id="tab-field-guide"', sectionStart);
  const section = html.slice(sectionStart, sectionEnd);
  const cardIds = [...section.matchAll(/class="perk-card" data-perk="([^"]+)"/g)].map((m) => m[1]);
  const buttonIds = [...section.matchAll(/class="btn-perk-activate" data-perk="([^"]+)"/g)].map((m) => m[1]);

  assert.equal(AVAILABLE_PERKS.length, 18);
  assert.deepEqual(sort(cardIds), sort(AVAILABLE_PERKS.map((perk) => perk.id)));
  assert.deepEqual(sort(buttonIds), sort(AVAILABLE_PERKS.map((perk) => perk.id)));
  assert.match(section, /18 RODZAJÓW ŁUPU/);
  for (const perk of AVAILABLE_PERKS) {
    const cardStart = section.indexOf('data-perk="' + perk.id + '"');
    const nextCard = section.indexOf('class="perk-card"', cardStart + 12);
    const card = section.slice(cardStart, nextCard > 0 ? nextCard : section.length);
    assert.ok(card.includes(perk.icon), 'wrong icon for ' + perk.id);
    assert.ok(card.includes(perk.name), 'wrong name for ' + perk.id);
    assert.ok(card.includes(perk.description), 'wrong description for ' + perk.id);
  }
  assert.match(css, /--perk-accent/);
  assert.match(css, /perk-source-tag/);
});

test('arsenał prezentuje wszystkie 11 definicji i używa tych samych źródeł do ikon, opisów oraz statystyk', async () => {
  const [html, app] = await Promise.all([read('../index.html'), read('../src/index.ts')]);
  const firearms = Object.values(SURVIVAL_FIREARM_DEFS);
  assert.equal(firearms.length, 11);
  assert.equal(new Set(firearms.map((firearm) => firearm.icon)).size, 11, 'fallback weapon icons must be distinct');
  assert.ok(firearms.every((firearm) => firearm.roleDescription.length >= 55));
  assert.match(html, /id="firearm-catalog-grid"/);
  assert.match(html, /11 MODELI/);
  assert.ok(app.includes('Object.values(SURVIVAL_FIREARM_DEFS)'));
  assert.ok(app.includes('renderSurvivalFirearmCatalogIcon(firearm.archetype, firearm.color)'));
  assert.ok(app.includes('description.textContent = firearm.roleDescription'));
  for (const key of ['firearm.damage', 'firearm.rangeMeters', 'firearm.fireIntervalSeconds', 'firearm.magazineSize', 'firearm.reloadSeconds']) {
    assert.ok(app.includes(key), 'armory metric source missing: ' + key);
  }

  const iconStart = app.indexOf('const renderSurvivalFirearmCatalogIcon');
  const iconEnd = app.indexOf('const disposeRenderer', iconStart);
  const iconFactory = app.slice(iconStart, iconEnd);
  const cases = [...iconFactory.matchAll(/case '([^']+)':/g)].map((m) => m[1]);
  const archetypes = [...new Set(firearms.map((firearm) => firearm.archetype))];
  assert.deepEqual(sort(cases), sort(archetypes));
});

test('kampania, mapy, operatorzy i PvP pokazują komplet danych źródłowych', async () => {
  const [html, app] = await Promise.all([read('../index.html'), read('../src/index.ts')]);
  const mapStart = html.indexOf('<div id="tab-map"');
  const mapEnd = html.indexOf('<div id="tab-pvp"', mapStart);
  const mapSection = html.slice(mapStart, mapEnd);
  const stageIds = [...mapSection.matchAll(/data-campaign-stage="([^"]+)"/g)].map((m) => m[1]);
  const mapCards = [...mapSection.matchAll(/<article class="survival-map-directory-card ([^"]+)">([\\s\\S]*?)<\\/article>/g)];

  assert.equal(CAMPAIGN_STAGES.length, 5);
  assert.deepEqual(sort(stageIds), sort(CAMPAIGN_STAGES.map((stage) => stage.id)));
  assert.equal(mapCards.length, SURVIVAL_MAP_IDS.length);
  for (const mapId of SURVIVAL_MAP_IDS) {
    const map = SURVIVAL_MAPS[mapId];
    assert.ok(mapSection.includes(map.name.toUpperCase()), 'map card missing: ' + mapId);
  }
  assert.match(mapSection, /campaign-stage-icon/);
  assert.match(mapSection, /survival-map-directory-icon/);
  assert.match(mapSection, /BRAK MODYFIKATORÓW/);
  assert.match(mapSection, /WROGOWIE \+8% SZYBCIEJ/);
  assert.match(mapSection, /WROGOWIE −10% SZYBCIEJ/);
  assert.match(mapSection, /XP \+15%/);

  const teamStart = html.indexOf('<div id="tab-team"');
  const teamEnd = html.indexOf('<div id="tab-enemies"', teamStart);
  const teamSection = html.slice(teamStart, teamEnd);
  const operatorIds = [...teamSection.matchAll(/class="char-card[^"]*" data-char="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sort(operatorIds), sort(Object.keys(CHARACTERS)));
  assert.equal(Object.keys(PVP_OPERATOR_PROFILES).length, 5);
  const pvpIds = [...html.matchAll(/class="pvp-operator-btn[^"]*" data-op="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sort(pvpIds), sort(Object.keys(PVP_OPERATOR_PROFILES)));
  assert.ok(app.includes('summary.textContent = operatorProfile.menuSummary'));
});
