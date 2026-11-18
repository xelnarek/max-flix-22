import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Grzesiek launches exactly five fist-first muscular arms with visible vein geometry', async () => {
  const [game, characters, html] = await Promise.all([
    read('../src/game.ts'), read('../src/characters.ts'), read('../index.html')
  ]);
  const start = game.indexOf('private spawnGrzesiekHomingRockets(): void');
  const end = game.indexOf('private spawnCompactImpact(', start);
  assert.ok(start >= 0 && end > start);
  const launch = game.slice(start, end);
  assert.ok(launch.includes('for (let index = 0; index < 5; index++)'));
  assert.ok(launch.includes('grzesiek-homing-muscle-arm'));
  assert.ok(launch.includes('muscular-clenched-fist'));
  assert.ok(launch.includes('addVein') && launch.includes('TubeGeometry'));
  assert.ok(launch.includes('bicep') && launch.includes('tricep'));
  assert.ok(launch.includes('homingTarget: target') && launch.includes('homingTrail: true'));
  assert.ok(!launch.includes('rearNozzle') && !launch.includes('finMesh'));
  assert.ok(characters.includes('PIĘĆ LATAJĄCYCH RAMION'));
  assert.ok(html.includes('5 latających ramion'));
});

test('Marcin tank deploys smoothly, retargets in bounded slices and animates cannon recoil', async () => {
  const game = await read('../src/game.ts');
  assert.ok(game.includes('targetScanTimer: number'));
  assert.ok(game.includes('deployTimer: number'));
  assert.ok(game.includes('recoilTimer: number'));
  assert.ok(game.includes('tank.targetScanTimer = 0.22'));
  assert.ok(game.includes('dampActorAngle('));
  assert.ok(game.includes('travelled * 2.4'));
  assert.ok(game.includes('wz404-erp-cannon-shell'));
  assert.ok(game.includes('tank.turret.position.z = -0.06'));
});

test('Dawid ceramic volley preserves 5/3 projectile counts and uses connected Survival bounds', async () => {
  const [game, characters] = await Promise.all([
    read('../src/game.ts'), read('../src/characters.ts')
  ]);
  const triggerStart = game.indexOf('public triggerAbility()');
  const triggerEnd = game.indexOf('private throwBimberMolotov(', triggerStart);
  assert.ok(triggerStart >= 0 && triggerEnd > triggerStart);
  const trigger = game.slice(triggerStart, triggerEnd);
  const start = trigger.indexOf("} else if (this.currentCharacterId === 'dawid') {");
  const end = trigger.indexOf("} else if (this.currentCharacterId === 'mateusz') {", start);
  assert.ok(start >= 0 && end > start);
  const ability = trigger.slice(start, end);
  assert.ok(ability.includes("this.gameMode === 'survival' ? [-0.22, 0, 0.22] : [-0.5, -0.25, 0, 0.25, 0.5]"));
  assert.ok(ability.includes('dawid-marmur-b4-porcelain'));
  assert.ok(ability.includes('EdgesGeometry'));
  assert.ok(ability.includes('homingTrailColor: 0xf59e0b'));
  assert.ok(!ability.includes('MathUtils.clamp(this.playerPos.z + fwd.z'));
  const boundsStart = game.indexOf("const minRicochetZ = this.gameMode === 'survival' ? SURVIVAL_WORLD_BOUNDS.minZ");
  const boundsEnd = game.indexOf("if (p.collectItems)", boundsStart);
  assert.ok(boundsStart >= 0 && boundsEnd > boundsStart);
  assert.ok(game.slice(boundsStart, boundsEnd).includes('SURVIVAL_WORLD_BOUNDS.maxZ'));
  assert.ok(characters.includes('5 w Kampanii, 3 w Survival'));
});

test('Mateusz contract rip uses delta-time paper spin, a shared shard material and a ground shockwave', async () => {
  const game = await read('../src/game.ts');
  const start = game.indexOf('private spawnMateuszContractRip(): void');
  const end = game.indexOf('private createMafiCapybaraModel(', start);
  assert.ok(start >= 0 && end > start);
  const effect = game.slice(start, end);
  assert.ok(effect.includes('), shardMaterial)'));
  assert.ok(!effect.includes('shardMaterial.clone()'));
  assert.ok(effect.includes('ripPulseMaterial') && effect.includes('ripPulse.scale.setScalar'));
  assert.ok(effect.includes('shard.mesh.rotation.x += shard.spin.x * dt'));
  assert.ok(!effect.includes('shard.spin.x * 0.016'));
});

test('Piotr MafiKapibar bodyguards balance targets and add readable muzzle/melee impact feedback', async () => {
  const [game, characters] = await Promise.all([
    read('../src/game.ts'), read('../src/characters.ts')
  ]);
  assert.ok(game.includes('private readonly mafiCapybaraTargetLoads = new Map<string, number>()'));
  assert.ok(game.includes('target: EnemyItem | null'));
  assert.ok(game.includes('targetLoads.clear()'));
  assert.ok(game.includes('targetLoads.set(target.id, (targetLoads.get(target.id) ?? 0) + 1)'));
  assert.ok(game.includes('(targetLoads.get(enemy.id) ?? 0) * 4.2'));
  assert.ok(game.includes('enemy.id < target.id'));
  assert.ok(game.includes('mafi_carbine_tracer'));
  assert.ok(game.includes('spawnCompactImpact(muzzlePosition.x'));
  assert.ok(game.includes('spawnCompactImpact(target.x, target.y + 0.58'));
  assert.ok(characters.includes('Dobierają różne cele'));
});


test('all operator specials use their own shout pool and a readable procedural follow-through', async () => {
  const [game, characters, shouts] = await Promise.all([
    read('../src/game.ts'), read('../src/characters.ts'), read('../src/characterAbilityShouts.ts')
  ]);
  assert.match(game, /this\.specialSwingTimer = 0\.86 \\* abilityDurationScale/);
  assert.match(game, /this\.sayAbilityShout\(\)/);
  assert.match(game, /if \(this\.specialSwingTimer > 0 && this\.currentCharacterId !== 'grzesiek'\)/);
  for (const id of ['marcin', 'grzesiek', 'dawid', 'mateusz', 'piotr']) {
    assert.ok(characters.includes(id + ': {'), 'missing operator profile: ' + id);
    assert.match(shouts, new RegExp('^  ' + id + ': \\[', 'm'));
  }
  assert.match(shouts, /Multiwersum, wejście na serwer/);
});
