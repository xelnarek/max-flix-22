import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
test('Crimson Shift keeps all three launch actions and twelve destinations connected', async () => {
 const [html,app]=await Promise.all([read('../index.html'),read('../src/index.ts')]);
 for(const id of ['btn-start-survival','btn-open-campaign','btn-open-pvp']) assert.ok(html.includes('id="'+id+'"'),'missing launch action '+id);
 const ids=['tab-team','tab-map','tab-pvp','tab-enemies','tab-arsenal','tab-perks','tab-field-guide','tab-talent-tree','tab-ranks','tab-leaderboard','tab-achievements','tab-settings'];
 for(const id of ids){assert.ok(html.includes('id="'+id+'"'),'missing panel '+id);assert.ok(html.includes('data-tab="'+id+'"'),'missing tab '+id);}
 assert.match(app,/syncMenuPanelPresentation/);assert.match(app,/panel\.inert = !active/);assert.match(app,/activateMenuTab\(tabBtn\)/);assert.match(app,/menuScrollMemory\.restore\(targetId\)/);
});
test('compact menu exposes density switch and separate operator detail views', async()=>{
 const [app,html,css]=await Promise.all([read('../src/index.ts'),read('../index.html'),read('../src/crimson-shift-functional-menu.css')]);
 assert.match(app,/menu-density-toggle/);assert.match(app,/dataset\.menuDensity = expanded \? 'full' : 'compact'/);assert.match(app,/setCharacterDetailView/);assert.match(app,/profile.*abilities.*mastery/s);
 assert.match(css,/menu-density-toolbar/);assert.match(css,/data-menu-density="compact"/);assert.match(css,/data-char-view="abilities"/);assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/);assert.match(html,/class="char-card-badge operator-emblem/);
});
test('final functional menu layer loads last and supports narrow and landscape devices',async()=>{
 const html=await read('../index.html');const css=await read('../src/crimson-shift-functional-menu.css');
 assert.ok(html.lastIndexOf('crimson-shift-functional-menu.css')>html.lastIndexOf('crimson-shift-responsive-v2.css'));
 assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/@media\(max-width:380px\)/);assert.match(css,/orientation:landscape/);assert.match(css,/prefers-reduced-motion:reduce/);
});
