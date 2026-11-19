import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const game = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');

test('enemy pursuit has an arrival dead-zone and does not orbit around a reached slot', () => {
  const start = game.indexOf('private updateSurvivalEnemyTactics');
  const end = game.indexOf('private damageEnemy', start);
  const tactics = game.slice(start, end);
  assert.match(tactics, /const atFormationSlot = steerLength < 0\.24/);
  assert.match(tactics, /const arrivalScale = atFormationSlot/);
  assert.match(tactics, /const movementSpeed = speed \* arrivalScale/);
  assert.match(tactics, /getEnemyPlayerContactDistance\(enemy\.type\) \+ 0\.08/);
  assert.doesNotMatch(tactics, /steerLength < 0\.72 && engaged/);
  assert.match(tactics, /role === 'bruiser' \|\| role === 'flanker'[\s\S]*?defaultEngageRadius/);
});

test('player movement blocks on enemy bodies and slides instead of tunnelling', () => {
  assert.match(game, /resolvePlayerMovementAgainstEnemies\(/);
  assert.match(game, /const contactY = landed \? this\.playerPos\.y : nextY/);
  assert.match(game, /projectVelocityOutOfEnemyContacts\(this\.playerVel, contactNormals\)/);
  assert.match(game, /getEnemyPlayerContactDistance\(enemy\.type\)/);
});

test('hostile projectiles stop at the first enemy body or the player along the swept segment', () => {
  assert.match(game, /findFirstProjectileEnemyImpact\(/);
  assert.match(game, /enemyImpact && \(!playerImpact \|\| enemyImpact\.t < playerImpact\.t\)/);
  assert.match(game, /if \(playerImpact\)/);
  assert.match(game, /this\.spawnCompactImpact\(enemyImpact\.x, enemyImpact\.y, enemyImpact\.z, impactColor\)/);
  assert.match(game, /const projectileStart = this\.enemyProjectileStartScratch;/);
  assert.match(game, /projectileStart\.x = previousX;[\s\S]*projectileStart\.y = previousY;[\s\S]*projectileStart\.z = previousZ;/);
});

test('hostile and friendly shot impacts retain a compact neutral contact response', () => {
  assert.match(game, /this\.spawnCompactImpact\(impactX, impactY, impactZ, impactColor\)/);
  assert.match(game, /const impactColor = 0xe2e8f0/);
  assert.match(game, /this\.spawnCompactImpact\(e\.x, e\.y \+ 0\.72, e\.z/);
});

test('enemy attacks do not leave coloured projectile trails or glowing ground scorch marks', () => {
  assert.doesNotMatch(game, /private spawnSebixFireTrail/);
  assert.doesNotMatch(game, /this\.spawnSebixFireTrail/);
  const start = game.indexOf('for (let i = this.enemyProjectiles.length - 1;');
  const end = game.indexOf('\n  private updateSpecialEffects', start);
  assert.ok(start >= 0 && end > start, 'hostile projectile update must remain present');
  const hostileUpdate = game.slice(start, end);
  assert.doesNotMatch(hostileUpdate, /trailTimer|trailColor|spawnParticleRing/);
  assert.match(hostileUpdate, /spawnCompactImpact/);
  assert.match(hostileUpdate, /this\.levelRoot\.remove\(ep\.mesh\)/);
});

test('campaign melee AI closes into attack range and holds without contact jitter', () => {
  const start = game.indexOf('// Dynamic Chase / Tracking AI for ground enemies');
  const end = game.indexOf('// The Sentinel commits to a visible lane', start);
  const campaign = game.slice(start, end);
  assert.match(campaign, /const attackDistance = Math\.max\(1\.10, getEnemyPlayerContactDistance\(e\.type\) \+ 0\.10\)/);
  assert.match(campaign, /const inContactLane = distToPlayer <= attackDistance \+ 0\.08/);
  assert.match(campaign, /const arrivalScale = inContactLane/);
  assert.match(campaign, /separationLength < 0\.34/);
  assert.match(campaign, /e\.x \+= move\.x \* chaseSpeed \* arrivalScale \* dt/);
});

test('large enemy crowds use a conservative spatial broadphase for player contact', () => {
  const start = game.indexOf('const contactY = landed ? this.playerPos.y : nextY');
  const end = game.indexOf('// Re-apply the gate after platform carry and crowd contact', start);
  const contact = game.slice(start, end);
  assert.match(contact, /this\.enemySpatialIndexCachedCount === this\.enemies\.length/);
  assert.match(contact, /this\.enemySpatialIndex\.query\(/);
  assert.match(contact, /Math\.hypot\(movementDeltaX, movementDeltaZ\) \* 0\.5 \+ 2\.1/);
  assert.match(contact, /: this\.enemies/);
  assert.match(contact, /resolvePlayerMovementAgainstEnemies\([\s\S]*?collisionCandidates/);
});

test('large hostile projectile crowds use the segment spatial broadphase before exact impact tests', () => {
  const start = game.indexOf('const projectileStart = this.enemyProjectileStartScratch;');
  assert.notEqual(start, -1, 'enemy projectile sweep must use reusable start-point storage');
  const end = game.indexOf('if (enemyImpact &&', start);
  const collision = game.slice(start, end);
  assert.match(collision, /projectileStart\.x = previousX;[\s\S]*projectileStart\.y = previousY;[\s\S]*projectileStart\.z = previousZ;/);
  assert.match(collision, /projectileEnd\.x = ep\.mesh\.position\.x;[\s\S]*projectileEnd\.z = ep\.mesh\.position\.z;/);
  assert.match(collision, /this\.enemySpatialIndexCachedCount === this\.enemies\.length/);
  assert.match(collision, /this\.enemySpatialIndex\.query\(/);
  assert.match(collision, /Math\.hypot\(projectileDeltaX, projectileDeltaZ\) \* 0\.5 \+ 1\.9/);
  assert.match(collision, /findFirstProjectileEnemyImpact\([\s\S]*?projectileCandidates,[\s\S]*?this\.enemyProjectileEnemyImpactScratch/);
});

test('Survival enemies scan for incoming player shots and commit a short role-weighted sidestep', async () => {
  const types = await readFile(new URL('../src/types.ts', import.meta.url), 'utf8');
  const start = game.indexOf('private updateSurvivalEnemyTactics');
  const end = game.indexOf('private damageEnemy', start);
  const tactics = game.slice(start, end);
  assert.match(tactics, /calculateEnemyProjectileDodge\([\s\S]*?0\.72,[\s\S]*?1\.02,[\s\S]*?0\.95,[\s\S]*?this\.enemyProjectileDodgeScanScratch/);
  assert.match(tactics, /enemy\.aiDodgeScanTimer = 0\.12/);
  assert.match(tactics, /enemy\.aiDodgeTimer = 0\.28/);
  assert.match(tactics, /evasionWeight = role === 'bruiser'/);
  assert.match(tactics, /const projectileDodge = this\.enemyProjectileDodgeScratch/);
  assert.match(tactics, /steeringInput\.evasionWeight = evasionWeight/);
  assert.match(game, /evasion: this\.enemyProjectileDodgeScratch/);
  assert.match(tactics, /hasProjectileDodge \? 0\.76/);
  assert.match(types, /aiDodgeScanTimer\?: number/);
});

test('enemy projectiles are slower, less accurate and have longer enemy attack windows', async () => {
  const combat = await readFile(new URL('../src/combatBalance.ts', import.meta.url), 'utf8');
  assert.match(game, /private predictPlayerAimPoint\(/);
  assert.match(game, /predictEnemyAimPoint\(/);
  for (const speed of ['7.6', '7.2', '7.5', '10.0', '8.2', '9.5']) {
    assert.ok(game.includes('getEnemyProjectileSpeed(' + speed + ')'));
  }
  assert.match(game, /Number\.isFinite\(lockedDirection\) \? null : this\.predictPlayerAimPoint/);
  assert.match(game, /Math\.sin\(lockedDirection as number\)/);
  assert.match(combat, /ENEMY_PROJECTILE_SPEED_MULTIPLIER = 0\.76/);
  assert.match(combat, /ENEMY_PROJECTILE_AIM_LEAD_MULTIPLIER = 0\.42/);
  assert.match(combat, /ENEMY_PROJECTILE_AIM_ERROR_METERS = 0\.78/);
  assert.match(combat, /ENEMY_MOVEMENT_SPEED_MULTIPLIER = 0\.88/);
  assert.match(game, /enemy\.attackCooldown = isHeavy \? 1\.02 : 1\.18/);
  assert.match(game, /leadFraction \* ENEMY_PROJECTILE_AIM_LEAD_MULTIPLIER/);
  assert.match(game, /missDistance = ENEMY_PROJECTILE_AIM_ERROR_METERS/);
  assert.match(game, /SURVIVAL_ENEMY_SPECIAL_RATE_MULTIPLIER/);
});

test('regular ranged enemies telegraph a locked shot and stop moving during wind-up', () => {
  assert.match(game, /private beginEnemyRangedAttackTelegraph\(enemy: EnemyItem\)/);
  assert.match(game, /private advanceEnemyRangedAttackTelegraph\(enemy: EnemyItem, dt: number\)/);
  assert.match(game, /private cancelEnemyRangedAttackTelegraph\(enemy: EnemyItem/);
  assert.match(game, /enemy\.aiRangedLockedDirection = direction/);
  assert.match(game, /enemy\.aiRangedTelegraphMesh = this\.spawnEnemyTelegraphCue/);
  assert.match(game, /this\.clearEnemyRangedTelegraphVisual\(enemy\)/);
  assert.match(game, /this\.activeEnemyAttackTelegraphIds\.add\(enemy\.id\)/);
  assert.match(game, /const isTelegraphingRangedBoss = enemy\.aiRangedWindupTimer !== undefined/);
  assert.match(game, /enemy\.mesh\.rotation\.y = enemy\.aiRangedWindupTimer !== undefined/);
  assert.match(game, /if \(factionBrawlActive\) \{[\s\S]*?cancelEnemyRangedAttackTelegraph\(e, true\)/);
  assert.match(game, /e\.aiRangedWindupTimer !== undefined[\s\S]*?advanceEnemyRangedAttackTelegraph/);
  assert.match(game, /spawnPenaltyNotice\(e\.x, e\.y \+ 0\.8, e\.z, release\.direction\)/);
  assert.match(game, /spawnSanitarywareProjectile\(e\.x, e\.y \+ 0\.8, e\.z, release\.direction\)/);
  assert.match(game, /spawnSparkZapProjectile\(e\.x, e\.y \+ 0\.8, e\.z, release\.direction\)/);
  assert.match(game, /if \(actualDamage > 0 && enemy\.aiRangedWindupTimer !== undefined\)/);
  assert.match(game, /if \(e\.aiRangedWindupTimer !== undefined\) this\.cancelEnemyRangedAttackTelegraph\(e, true\)/);
});


test('Campaign melee roles use stable side-entry steering that fades before contact', async () => {
  const [game, tactics, types] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/enemyCampaignTactics.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/types.ts', import.meta.url), 'utf8'),
  ]);
  const campaignStart = game.indexOf('// Dynamic Chase / Tracking AI for ground enemies');
  const campaignEnd = game.indexOf('// The Sentinel commits to a visible lane', campaignStart);
  const campaign = game.slice(campaignStart, campaignEnd);
  assert.match(game, /getCampaignEnemyFlankProfile, getCampaignEnemyFlankVector, resolveCampaignEnemyFlankSide/);
  assert.match(campaign, /e\.aiCampaignFlankSide = resolveCampaignEnemyFlankSide\(e\.id\)/);
  assert.match(campaign, /getCampaignEnemyFlankVector\([\s\S]*?attackDistance,[\s\S]*?e\.aiCampaignFlankSide \?\? 1/);
  assert.match(campaign, /steeringInput\.chase\.x = inContactLane \? separation\.x : flankVector\.x/);
  assert.match(campaign, /steeringInput\.chase\.z = inContactLane \? separation\.z : flankVector\.z/);
  assert.match(campaign, /const attackDistance = Math\.max\(1\.10, getEnemyPlayerContactDistance\(e\.type\) \+ 0\.10\)/);
  assert.match(types, /aiCampaignFlankSide\?: -1 \| 1/);
  assert.match(tactics, /profile\.lateralBias \* smoothstep\(approachProgress\)/);
});

test('regular melee enemies use role-specific wind-up lanes and delayed contact resolution', async () => {
  const melee = await readFile(new URL('../src/enemyMeleeTelegraphs.ts', import.meta.url), 'utf8');
  const expected = [
    'customer', 'architect', 'inspector', 'kurier', 'monter',
    'sztaplar_szalony', 'elite_walczak_guard', 'zombie_pracownik',
    'mutant_gamma_forklift', 'radioactive_pip',
  ];
  for (const type of expected) {
    assert.match(melee, new RegExp(type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':'));
  }
  assert.match(game, /private beginEnemyMeleeAttackTelegraph\(/);
  assert.match(game, /private advanceEnemyMeleeAttackTelegraph\(/);
  assert.match(game, /private cancelEnemyMeleeAttackTelegraph\(/);
  assert.match(game, /e\.aiMeleeWindupTimer !== undefined[\s\S]*?advanceEnemyMeleeAttackTelegraph\(e, dt\)/);
  assert.match(game, /dist <= contactRadius \+ meleeProfile\.reachMeters/);
  assert.match(game, /if \(meleeProfile && !meleeStrikeReady && !meleeCounterActive\)/);
  assert.match(game, /if \(meleeStrikeReady && !meleeStrikeConnected\)/);
  assert.match(game, /actualDamage > 0 && \(enemy\.aiMeleeWindupTimer !== undefined \|\| enemy\.aiMeleeStrikePending\)/);
  assert.match(game, /enemy\.aiMeleeTelegraphMesh = this\.spawnEnemyTelegraphCue/);
  assert.match(game, /hasEnemyAttackTelegraphCapacity\(this\.activeEnemyAttackTelegraphIds\.size, this\.isHandheldViewport\)/);
});

test('regular enemy attack cues float over the attacker and are removed instead of drawing floor trails', () => {
  assert.match(game, /private spawnEnemyTelegraphCue\(/);
  assert.match(game, /cue\.name = 'ENEMY_ATTACK_TELEGRAPH_CUE'/);
  assert.match(game, /cue\.position\.set\(0, 1\.85, 0\)/);
  assert.match(game, /enemy\.mesh\.add\(cue\)/);
  assert.match(game, /new THREE\.TorusGeometry\(0\.27, 0\.038, 5, 20\)/);
  assert.match(game, /new THREE\.ConeGeometry\(0\.15, 0\.26, 4\)/);
  assert.match(game, /private updateEnemyTelegraphCue\(/);
  assert.match(game, /this\.disposeTemporaryObject\(cue\)/);
  assert.match(game, /this\.updateEnemyTelegraphCue\([\s\S]*?timing\.progress/);
  assert.match(game, /private clearEnemyTelegraphCue\(cue: THREE\.Group \| undefined\)/);
  assert.match(game, /private clearEnemyRangedTelegraphVisual\(enemy: EnemyItem\)/);
});

test('melee and ranged attacks share a small handheld warning budget and retry after pressure clears', () => {
  assert.match(game, /hasEnemyAttackTelegraphCapacity\(this\.activeEnemyAttackTelegraphIds\.size, this\.isHandheldViewport\)/);
  assert.match(game, /enemy\.specialActionTimer = Math\.max\(enemy\.specialActionTimer \?\? 0, 0\.24\)/);
  assert.match(game, /enemy\.aiMeleeCooldownTimer = Math\.max\(enemy\.aiMeleeCooldownTimer \?\? 0, 0\.24\)/);
  assert.match(game, /this\.activeEnemyAttackTelegraphIds\.clear\(\)/);
});

test('ordinary melee attacks hold position briefly after impact and player damage interrupts recovery', () => {
  assert.match(game, /e\.aiMeleeRecoveryTimer = Math\.max\(0, \(e\.aiMeleeRecoveryTimer \?\? 0\) - dt\)/);
  assert.match(game, /e\.aiMeleeRecoveryTimer = Math\.max\(e\.aiMeleeRecoveryTimer \?\? 0, meleeProfile\.recoverySeconds\)/);
  assert.match(game, /else if \(\(e\.aiMeleeRecoveryTimer \?\? 0\) > 0\)[\s\S]*?e\.mesh\.position\.set\(e\.x, e\.y, e\.z\)/);
  assert.match(game, /actualDamage > 0 && \(enemy\.aiMeleeRecoveryTimer \?\? 0\) > 0[\s\S]*?enemy\.aiMeleeRecoveryTimer = 0/);
});

test('Inspector, Gamma Mutant and Pip special actions wait until melee recovery ends', () => {
  assert.match(game, /e\.type === 'inspector'[^\n]*e\.aiMeleeRecoveryTimer \?\? 0\) <= 0/);
  assert.match(game, /e\.type === 'mutant_gamma_forklift'[^\n]*e\.aiMeleeRecoveryTimer \?\? 0\) <= 0/);
  assert.match(game, /e\.type === 'radioactive_pip'[^\n]*e\.aiMeleeRecoveryTimer \?\? 0\) <= 0/);
});

test('bosses and purpose-built ranged/mechanical archetypes retain their existing contact path', async () => {
  const melee = await readFile(new URL('../src/enemyMeleeTelegraphs.ts', import.meta.url), 'utf8');
  for (const excluded of [
    'walczak', 'forklift', 'agv_robot', 'handlowiec', 'piorun_dron',
    'przedstawiciel_włoski', 'krol_leto', 'pan_roman', 'serwisant',
    'bosman_krakow', 'pomazaniec', 'sebix_m', 'cyber_salesman',
  ]) {
    assert.doesNotMatch(melee, new RegExp('^\\s*' + excluded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':', 'm'));
  }
  assert.match(game, /if \(!meleeProfile && e\.state !== 'stunned'\) this\.requestEnemyAttackAnimation\(e, 0\.48\)/);
  assert.match(game, /e\.type === 'krol_leto'[\s\S]*?this\.takeDamage\('🚨 ZWOLNIENIE DYSCYPLINARNE/);
});

test('special Inspector, Gamma Mutant and Pip abilities never overlap committed melee wind-up', () => {
  assert.match(game, /e\.type === 'inspector' && e\.specialActionTimer !== undefined && e\.aiMeleeWindupTimer === undefined && !e\.aiMeleeStrikePending/);
  assert.match(game, /e\.type === 'mutant_gamma_forklift' && e\.specialActionTimer !== undefined && e\.aiMeleeWindupTimer === undefined && !e\.aiMeleeStrikePending/);
  assert.match(game, /e\.type === 'radioactive_pip' && e\.specialActionTimer !== undefined && e\.aiMeleeWindupTimer === undefined && !e\.aiMeleeStrikePending/);
});


test('distant visual LOD never changes hostile projectile, collision or damage logic', () => {
  const lodStart = game.indexOf('private updateGobkitAnimations(dt: number)');
  const lodEnd = game.indexOf('private rebuildPlayerMesh()', lodStart);
  const animation = game.slice(lodStart, lodEnd);
  assert.match(animation, /shouldUseEnemyVisualLodProxy/);
  assert.match(animation, /combatCritical/);
  assert.match(animation, /track\.lastPosition\.copy\(enemy\.mesh\.position\)/);
  assert.match(game, /getEnemyCollisionRadius\(requestedType/);
  assert.match(game, /resolvePlayerMovementAgainstEnemies\(/);
  assert.match(game, /findFirstProjectileEnemyImpact\(/);
});
