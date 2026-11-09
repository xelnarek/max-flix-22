import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Unity menu uses the Paleciaki brand and respects Android safe areas', async () => {
  const menu = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainMenuController.cs');
  assert.match(menu, /CreateText\(safeRoot, "PALECIAKI!"/);
  assert.match(menu, /MAGAZYN CHAOSU/);
  assert.match(menu, /safeAreaObject\.AddComponent<SafeAreaLayout>\(\)/);
  assert.match(menu, /Screen\.safeArea\.width/);
  assert.doesNotMatch(menu, /Mathf\.Max\(230f,/);
});

test('Unity menu sizes map and operator cards from the actual safe viewport width', async () => {
  const menu = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainMenuController.cs');
  assert.match(menu, /float available = Mathf\.Max\(260f, Screen\.safeArea\.width \/ scale - 48f\)/);
  assert.match(menu, /float innerWidth = available - grid\.padding\.horizontal/);
  assert.match(menu, /float cellWidth = Mathf\.Max\(124f, innerWidth \/ columns\)/);
});

test('Campaign clearly reports its fixed mega-map and disables the Survival map picker', async () => {
  const menu = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/MainMenuController.cs');
  assert.match(menu, /KAMPANIA: WIELKA MAPA/);
  assert.match(menu, /item\.Value\.interactable = !campaignSelected/);
});

test('Unity mobile HUD reflows joystick and all three actions when device safe area changes', async () => {
  const hud = await read('../unity/MaxFlixUnity/Assets/Scripts/Runtime/HudController.cs');
  assert.match(hud, /ApplyResponsiveTouchLayout\(false\)/);
  assert.match(hud, /Rect safeRect = _safeAreaRoot\.rect/);
  assert.match(hud, /bool portrait = height > width \* 1\.12f/);
  assert.match(hud, /SetControlRect\(_attackButton\.GetComponent<RectTransform>/);
  assert.match(hud, /SetControlRect\(_abilityButton\.GetComponent<RectTransform>/);
  assert.match(hud, /SetControlRect\(_jumpButton\.GetComponent<RectTransform>/);
  assert.match(hud, /_joystickHandleRect\.sizeDelta/);
  assert.doesNotMatch(hud, /new Vector2\(-390f, 105f\)/);
});
