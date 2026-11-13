import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnemyType } from './types.ts';

type Anchor = 'head' | 'torso' | 'rightArm' | 'back' | 'legs';
type P3 = readonly [number, number, number];
type Gear = 'cap' | 'beret' | 'hardhat' | 'navyCap' | 'crown' | 'visor' | 'gasMask' | 'wolf' | 'none';
type Prop = 'clipboard' | 'swatches' | 'shield' | 'parcel' | 'screen' | 'wrench' | 'espresso' | 'jackHandle' | 'sceptre' | 'pipe' | 'scanner' | 'baton' | 'claw' | 'brick' | 'forks' | 'sprayer' | 'mechArm' | 'riotShield' | 'talons';
type Pack = 'briefcase' | 'blueprints' | 'delivery' | 'radio' | 'toolRoll' | 'mantle' | 'ceramic' | 'tanks' | 'battery' | 'pallet' | 'tail' | 'none';

interface RoleSpec {
  w: number; h: number; d: number; shoulder: number; head: number;
  main: number; dark: number; accent: number; metal: number;
  gear: Gear; prop: Prop; pack: Pack;
  form: 'round' | 'slim' | 'heavy' | 'hunched' | 'robotic' | 'beast' | 'hazmat';
}

export const ENEMY_ROLE_KIT_TYPES: readonly EnemyType[] = Object.freeze(Object.keys({
  customer: 1, architect: 1, inspector: 1, kurier: 1, handlowiec: 1,
  monter: 1, przedstawiciel_włoski: 1, sztaplar_szalony: 1, krol_leto: 1,
  pan_roman: 1, serwisant: 1, bosman_krakow: 1, zombie_pracownik: 1,
  sebix_m: 1, mutant_gamma_forklift: 1, radioactive_pip: 1,
  cyber_salesman: 1, elite_walczak_guard: 1, walczak: 1,
}) as EnemyType[]);

const ROLE: Partial<Record<EnemyType, RoleSpec>> = Object.freeze({
  customer: {w:.67,h:.54,d:.43,shoulder:.72,head:1.06,main:0x74433a,dark:0x2b2426,accent:0xd93431,metal:0xb8b4a8,gear:'cap',prop:'clipboard',pack:'briefcase',form:'round'},
  architect: {w:.38,h:.59,d:.25,shoulder:.50,head:.94,main:0x343746,dark:0x171923,accent:0xd8b46f,metal:0x9da5b0,gear:'beret',prop:'swatches',pack:'blueprints',form:'slim'},
  inspector: {w:.57,h:.54,d:.34,shoulder:.80,head:1.00,main:0xf07825,dark:0x26313c,accent:0xf8e45c,metal:0xa5b2bb,gear:'hardhat',prop:'shield',pack:'radio',form:'heavy'},
  kurier: {w:.47,h:.49,d:.31,shoulder:.63,head:.94,main:0x176b91,dark:0x102b42,accent:0xf3c84b,metal:0xa7b2b9,gear:'cap',prop:'scanner',pack:'delivery',form:'slim'},
  handlowiec: {w:.42,h:.60,d:.28,shoulder:.64,head:.95,main:0x253451,dark:0x111827,accent:0x9b6cdd,metal:0xd8dde4,gear:'none',prop:'screen',pack:'briefcase',form:'slim'},
  monter: {w:.62,h:.52,d:.38,shoulder:.80,head:1.02,main:0x1e5e59,dark:0x182b2d,accent:0xd8a13e,metal:0xaebbc0,gear:'hardhat',prop:'wrench',pack:'toolRoll',form:'heavy'},
  'przedstawiciel_włoski': {w:.40,h:.61,d:.27,shoulder:.56,head:.95,main:0x3b3942,dark:0x17191e,accent:0x2e9b64,metal:0xd6c4a0,gear:'beret',prop:'espresso',pack:'briefcase',form:'slim'},
  sztaplar_szalony: {w:.76,h:.50,d:.47,shoulder:.90,head:.92,main:0x9b6a13,dark:0x26282a,accent:0xf3cd32,metal:0xaeb7bd,gear:'hardhat',prop:'jackHandle',pack:'pallet',form:'heavy'},
  krol_leto: {w:.88,h:.69,d:.53,shoulder:1.08,head:1.18,main:0x393b49,dark:0x171a24,accent:0xe8b849,metal:0x9ea6b1,gear:'crown',prop:'sceptre',pack:'mantle',form:'heavy'},
  pan_roman: {w:.70,h:.56,d:.43,shoulder:.74,head:1.00,main:0xb65c1f,dark:0x3e3025,accent:0xe7e4d8,metal:0xa8b6bf,gear:'cap',prop:'pipe',pack:'ceramic',form:'round'},
  serwisant: {w:.47,h:.54,d:.32,shoulder:.65,head:.98,main:0x245066,dark:0x17232c,accent:0x25a6be,metal:0x9baab5,gear:'hardhat',prop:'scanner',pack:'toolRoll',form:'slim'},
  bosman_krakow: {w:.84,h:.60,d:.45,shoulder:1.02,head:1.00,main:0x1b3155,dark:0x111a2d,accent:0xd8b148,metal:0xb0becb,gear:'navyCap',prop:'baton',pack:'radio',form:'heavy'},
  zombie_pracownik: {w:.60,h:.56,d:.36,shoulder:.69,head:.91,main:0x657044,dark:0x292e22,accent:0x9cae43,metal:0xb6b69b,gear:'none',prop:'claw',pack:'none',form:'hunched'},
  sebix_m: {w:.75,h:.50,d:.43,shoulder:.90,head:.92,main:0x27252a,dark:0x151518,accent:0xb72b37,metal:0xc39b43,gear:'cap',prop:'brick',pack:'none',form:'heavy'},
  mutant_gamma_forklift: {w:.96,h:.72,d:.62,shoulder:1.16,head:1.04,main:0x3e4b39,dark:0x202728,accent:0x9cbb28,metal:0x9ba6a8,gear:'hardhat',prop:'forks',pack:'pallet',form:'beast'},
  radioactive_pip: {w:.69,h:.63,d:.50,shoulder:.83,head:1.00,main:0x788b32,dark:0x252d22,accent:0xb7e34b,metal:0xa6b2a0,gear:'gasMask',prop:'sprayer',pack:'tanks',form:'hazmat'},
  cyber_salesman: {w:.59,h:.61,d:.35,shoulder:.78,head:1.02,main:0x384c5b,dark:0x111f2a,accent:0x28d9ec,metal:0x9db3c2,gear:'visor',prop:'mechArm',pack:'battery',form:'robotic'},
  elite_walczak_guard: {w:.83,h:.62,d:.50,shoulder:1.08,head:.96,main:0x343d50,dark:0x171e2a,accent:0xa72f40,metal:0xb3c0c9,gear:'visor',prop:'riotShield',pack:'radio',form:'heavy'},
  walczak: {w:.95,h:.73,d:.58,shoulder:1.16,head:1.12,main:0x40332f,dark:0x1d1919,accent:0x7e4139,metal:0xb7a98a,gear:'wolf',prop:'talons',pack:'tail',form:'beast'},
});

const anchors: Anchor[] = ['head','torso','rightArm','back','legs'];
const sharedKitMaterial = new THREE.MeshStandardMaterial({ color:0xffffff, vertexColors:true, roughness:.67, metalness:.08 });
sharedKitMaterial.userData.gobkitSharedMaterial = true;
const templates = new Map<EnemyType, THREE.Group | null>();

function mat(color:number, metalness=.05, roughness=.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({color,metalness,roughness});
}
function part(groups:Record<Anchor,THREE.Group>, a:Anchor, g:THREE.BufferGeometry, c:number, pos:P3, scale:P3=[1,1,1], rot:P3=[0,0,0], metalness=.05):void {
  const m=new THREE.Mesh(g,mat(c,metalness));
  m.position.set(...pos);m.scale.set(...scale);m.rotation.set(...rot);
  m.castShadow=false;m.receiveShadow=false;m.frustumCulled=true;groups[a].add(m);
}
function bx(groups:Record<Anchor,THREE.Group>,a:Anchor,c:number,p:P3,s:P3,r:P3=[0,0,0],metalness=.05):void {
  part(groups,a,new THREE.BoxGeometry(...s),c,p,[1,1,1],r,metalness);
}
function sp(groups:Record<Anchor,THREE.Group>,a:Anchor,c:number,p:P3,s:P3,metalness=.05):void {
  part(groups,a,new THREE.SphereGeometry(1,14,10),c,p,s,[0,0,0],metalness);
}
function cy(groups:Record<Anchor,THREE.Group>,a:Anchor,c:number,p:P3,rt:number,rb:number,h:number,r:P3=[0,0,0],metalness=.45):void {
  part(groups,a,new THREE.CylinderGeometry(rt,rb,h,12),c,p,[1,1,1],r,metalness);
}
function cn(groups:Record<Anchor,THREE.Group>,a:Anchor,c:number,p:P3,r:number,h:number,rot:P3=[0,0,0]):void {
  part(groups,a,new THREE.ConeGeometry(r,h,8),c,p,[1,1,1],rot,.18);
}
function tor(groups:Record<Anchor,THREE.Group>,a:Anchor,c:number,p:P3,r:number,t:number,rot:P3=[0,0,0]):void {
  part(groups,a,new THREE.TorusGeometry(r,t,8,18),c,p,[1,1,1],rot,.65);
}
function newGroups():Record<Anchor,THREE.Group>{
  const out={} as Record<Anchor,THREE.Group>;
  for(const a of anchors){out[a]=new THREE.Group();out[a].name='role-kit-'+a;out[a].userData.actorRigAnchor=a;}
  return out;
}
function helmet(groups:Record<Anchor,THREE.Group>,gear:Gear,color:number):void{
  switch(gear){
    case 'cap':
      sp(groups,'head',color,[0,1.30,0],[.22,.11,.22]);
      bx(groups,'head',color,[0,1.25,.13],[.38,.035,.25]);
      break;
    case 'beret':
      sp(groups,'head',color,[0,1.34,-.015],[.24,.07,.22]);
      sp(groups,'head',0x25232a,[.08,1.39,-.01],[.045,.025,.045]);
      break;
    case 'hardhat':
      sp(groups,'head',color,[0,1.33,0],[.235,.12,.22]);
      cy(groups,'head',color,[0,1.275,0],.24,.24,.035,[0,0,0],.12);
      break;
    case 'navyCap':
      cy(groups,'head',color,[0,1.32,0],.22,.22,.11);
      bx(groups,'head',color,[0,1.27,.15],[.38,.035,.25]);
      bx(groups,'head',0xe3c15a,[0,1.39,-.02],[.23,.022,.045],[0,0,0],.7);
      break;
    case 'crown':
      cy(groups,'head',0xe4b847,[0,1.32,0],.235,.19,.10,[0,0,0],.75);
      for(let i=0;i<7;i++)cn(groups,'head',0xffd866,[-.22+i*.073,1.46,0],.045,.22,[0,0,(i-3)*.08]);
      break;
    case 'visor':
      bx(groups,'head',0x1a2833,[0,1.24,.10],[.42,.24,.23],[0,0,0],.8);
      bx(groups,'head',color,[0,1.24,.225],[.32,.06,.025],[0,0,0],.4);
      break;
    case 'gasMask':
      sp(groups,'head',0x34412c,[0,1.17,.12],[.21,.21,.18],.3);
      cy(groups,'head',0x9ea99c,[0,1.16,.255],.085,.085,.05,[Math.PI/2,0,0],.75);
      sp(groups,'head',0xb5ed4b,[-.085,1.22,.24],[.03,.03,.02]);
      sp(groups,'head',0xb5ed4b,[.085,1.22,.24],[.03,.03,.02]);
      break;
    case 'wolf':
      sp(groups,'head',0x514038,[0,1.19,.04],[.23,.22,.20]);
      cn(groups,'head',0x302321,[-.15,1.40,0],.075,.29,[0,0,-.18]);
      cn(groups,'head',0x302321,[.15,1.40,0],.075,.29,[0,0,.18]);
      sp(groups,'head',0x2c211e,[0,1.11,.20],[.15,.11,.14]);
      sp(groups,'head',0xdab365,[-.08,1.22,.19],[.03,.025,.018]);
      sp(groups,'head',0xdab365,[.08,1.22,.19],[.03,.025,.018]);
      break;
    default: break;
  }
}
function body(groups:Record<Anchor,THREE.Group>,type:EnemyType,s:RoleSpec):void{
  const {w,h,d,shoulder,main,dark,metal}=s;
  const torsoColor=s.form==='robotic'?metal:main;
  sp(groups,'torso',torsoColor,[0,.77,0],[w*.52,h*.48,d*.50],s.form==='robotic'?.65:.05);
  sp(groups,'torso',dark,[0,.99,0],[shoulder*.26,.15,d*.46],.12);
  bx(groups,'torso',metal,[0,.56,.045],[w*.84,.08,.32],[0,0,0],.48);
  const pad=Math.max(.12,shoulder*.19);
  sp(groups,'torso',main,[-shoulder*.35,.94,0],[pad,.16,.18],.08);
  sp(groups,'torso',main,[shoulder*.35,.94,0],[pad,.16,.18],.08);
  bx(groups,'legs',dark,[-.14,.17,.06],[.19,.24,.34]);
  bx(groups,'legs',dark,[.14,.17,.06],[.19,.24,.34]);
  bx(groups,'legs',metal,[-.14,.105,.13],[.18,.055,.12],[0,0,0],.5);
  bx(groups,'legs',metal,[.14,.105,.13],[.18,.055,.12],[0,0,0],.5);
  if(s.form==='round')sp(groups,'torso',0xc89b78,[0,.73,.13],[w*.38,.23,.18]);
  if(s.form==='hunched'){
    sp(groups,'torso',0x69754d,[-.05,.87,.02],[w*.32,.27,.23]);
    bx(groups,'torso',0x52613e,[-.13,.97,.03],[.24,.18,.20],[0,0,-.32]);
  }
  if(s.form==='heavy'){
    bx(groups,'torso',dark,[0,.78,.18],[w*.82,.42,.055],[.08,0,0],.3);
    for(const side of [-1,1])cn(groups,'torso',metal,[side*shoulder*.47,1.02,.02],.11,.25,[0,0,side*-.55]);
  }
  if(s.form==='robotic'){
    bx(groups,'torso',0x142733,[0,.80,.20],[w*.72,.25,.055],[0,0,0],.85);
    bx(groups,'torso',s.accent,[0,.82,.235],[w*.45,.07,.018],[0,0,0],.35);
    for(const side of [-1,1])bx(groups,'torso',metal,[side*.28,.98,.06],[.18,.18,.20],[0,0,side*.18],.8);
  }
  if(type==='zombie_pracownik'){
    for(let i=0;i<5;i++)bx(groups,'torso',0xc2c19b,[0,.88-i*.064,.205],[.38-i*.026,.027,.025],[0,0,i%2?.08:-.08]);
    bx(groups,'torso',0x41513b,[-.14,.87,.22],[.17,.25,.04],[0,0,-.42]);
    bx(groups,'torso',0x6e3e35,[.16,.68,.22],[.12,.15,.035],[0,0,.32]);
  }
}
function backGear(groups:Record<Anchor,THREE.Group>,pack:Pack,main:number,accent:number,metal:number):void{
  switch(pack){
    case 'briefcase':
      bx(groups,'back',0x1b2029,[0,.74,-.25],[.42,.32,.15]);
      bx(groups,'back',metal,[0,.90,-.17],[.15,.025,.025],[0,0,0],.75);
      break;
    case 'blueprints':
      for(let i=0;i<3;i++)cy(groups,'back',0xe8e0ca,[-.18+i*.18,.84,-.24],.047,.047,.62,[0,0,Math.PI/2]);
      break;
    case 'delivery':
      bx(groups,'back',main,[0,.83,-.31],[.55,.62,.27]);
      bx(groups,'back',accent,[0,1.05,-.16],[.55,.065,.035]);
      bx(groups,'back',0x9a6135,[.29,.57,-.16],[.24,.22,.22],[0,0,-.15]);
      bx(groups,'back',0xd09a56,[-.29,.58,-.16],[.22,.20,.20],[0,0,.12]);
      break;
    case 'radio':
      bx(groups,'back',0x202a33,[-.22,.84,-.23],[.13,.34,.12]);
      cy(groups,'back',metal,[-.22,1.08,-.24],.012,.012,.22);
      bx(groups,'back',accent,[.21,.84,-.23],[.09,.22,.08]);
      break;
    case 'toolRoll':
      bx(groups,'back',0x26383a,[0,.78,-.27],[.45,.36,.18]);
      for(let i=0;i<3;i++)cy(groups,'back',metal,[-.13+i*.13,.8,-.38],.02,.02,.30,[0,0,Math.PI/2],.7);
      break;
    case 'mantle':
      bx(groups,'back',0x5b2739,[0,.82,-.30],[.82,.74,.07],[.08,0,0]);
      for(const side of [-1,1])cn(groups,'back',0xc69c42,[side*.39,1.08,-.24],.13,.42,[0,0,side*-.7]);
      break;
    case 'ceramic':
      bx(groups,'back',0xe7ebe7,[0,.82,-.29],[.43,.50,.25]);
      cy(groups,'back',metal,[0,.58,-.41],.05,.05,.32,[Math.PI/2,0,0],.65);
      break;
    case 'tanks':
      for(const side of [-1,1]){
        cy(groups,'back',0x242e26,[side*.20,.82,-.24],.10,.10,.44);
        sp(groups,'back',accent,[side*.20,1.07,-.24],[.07,.07,.07]);
      }
      break;
    case 'battery':
      bx(groups,'back',0x20313d,[0,.78,-.27],[.48,.48,.22],[0,0,0],.8);
      bx(groups,'back',accent,[0,.80,-.39],[.27,.10,.03],[0,0,0],.35);
      cy(groups,'back',metal,[0,1.08,-.29],.025,.025,.20,[0,0,0],.8);
      break;
    case 'pallet':
      bx(groups,'back',0x252b2f,[0,.88,-.32],[.50,.68,.10],[.10,0,0],.75);
      for(const side of [-1,1])cy(groups,'back',metal,[side*.18,.94,-.40],.04,.04,.75,[0,0,0],.8);
      break;
    case 'tail':
      cn(groups,'back',main,[0,.56,-.42],.10,.52,[Math.PI/2,0,0]);
      break;
    default: break;
  }
}
function heldProp(groups:Record<Anchor,THREE.Group>,prop:Prop,accent:number,metal:number):void{
  switch(prop){
    case 'clipboard':
      bx(groups,'rightArm',0x8a421f,[.38,.73,.17],[.24,.35,.045],[0,0,-.13]);
      bx(groups,'rightArm',0xf5f0e8,[.38,.73,.20],[.20,.30,.012],[0,0,-.13]);
      bx(groups,'rightArm',accent,[.38,.89,.21],[.13,.035,.012]);
      break;
    case 'swatches':
      [0xf6d77b,0xe4e0d7,0x829cab,0x328ab0,0x7c9c49].forEach((c,i)=>bx(groups,'rightArm',c,[.25+i*.035,.78,.16],[.075,.30,.018],[0,0,(i-2)*.18]));
      break;
    case 'shield':
    case 'riotShield':
      bx(groups,'rightArm',prop==='riotShield'?0x738492:0x783d22,[.40,.71,.17],[.31,.49,.07],[0,0,-.12],.55);
      bx(groups,'rightArm',prop==='riotShield'?accent:0xf6f0e8,[.40,.71,.215],[.24,.39,.012],[0,0,-.12],.35);
      if(prop==='riotShield')bx(groups,'rightArm',0x202b38,[.40,.71,.23],[.18,.055,.018],[0,0,-.12],.7);
      break;
    case 'parcel':
      bx(groups,'rightArm',0xb7793e,[.39,.72,.15],[.27,.23,.22],[0,0,-.14]);
      bx(groups,'rightArm',accent,[.39,.72,.27],[.045,.23,.018],[0,0,-.14]);
      break;
    case 'screen':
      bx(groups,'rightArm',0x162a3e,[.39,.70,.15],[.31,.34,.08],[0,0,-.10],.65);
      bx(groups,'rightArm',accent,[.39,.72,.20],[.25,.22,.02],[0,0,-.10],.3);
      bx(groups,'rightArm',0xf1f7f5,[.39,.80,.22],[.16,.025,.008]);
      break;
    case 'wrench':
      cy(groups,'rightArm',0xb16a32,[.40,.76,.14],.028,.028,.48,[0,0,-.72],.6);
      cy(groups,'rightArm',metal,[.49,.95,.14],.083,.083,.18,[0,0,Math.PI/2],.78);
      break;
    case 'espresso':
      cy(groups,'rightArm',0xece6d9,[.39,.87,.17],.065,.055,.12);
      tor(groups,'rightArm',accent,[.45,.87,.17],.04,.01,[Math.PI/2,0,0]);
      bx(groups,'rightArm',0x292a2f,[.39,.95,.17],[.17,.07,.13]);
      break;
    case 'jackHandle':
      cy(groups,'rightArm',0x24292f,[.42,.75,.12],.027,.027,.49,[0,0,-.18],.65);
      bx(groups,'rightArm',metal,[.46,.99,.12],[.22,.07,.10],[0,0,-.18],.7);
      break;
    case 'sceptre':
      cy(groups,'rightArm',0xd3aa4d,[.43,.73,.12],.032,.032,.70,[0,0,-.15],.75);
      sp(groups,'rightArm',0x68e5f0,[.45,1.11,.12],[.13,.13,.13],.65);
      break;
    case 'pipe':
      cy(groups,'rightArm',metal,[.42,.75,.15],.027,.027,.52,[0,0,-.42],.72);
      bx(groups,'rightArm',0x23272a,[.50,.96,.16],[.18,.08,.08],[0,0,0],.72);
      break;
    case 'scanner':
      bx(groups,'rightArm',0x23313b,[.39,.72,.15],[.17,.25,.12],[0,0,-.16],.65);
      bx(groups,'rightArm',accent,[.39,.80,.22],[.11,.075,.015],[0,0,-.16],.35);
      break;
    case 'baton':
      cy(groups,'rightArm',0xb68b3a,[.40,.72,.13],.027,.027,.48,[0,0,-.12],.75);
      sp(groups,'rightArm',accent,[.40,.97,.13],[.08,.08,.08],.4);
      break;
    case 'claw':
    case 'talons':
      for(let i=0;i<3;i++)cn(groups,'rightArm',prop==='talons'?0xd9c8a6:0xd5d1ad,[.38+i*.06,.54,.21],.045,.23,[Math.PI/2,0,0]);
      break;
    case 'brick':
      bx(groups,'rightArm',0x9b542d,[.40,.66,.15],[.25,.14,.18],[0,0,-.16]);
      bx(groups,'rightArm',0x673c2c,[.40,.66,.25],[.21,.025,.012]);
      break;
    case 'forks':
      bx(groups,'rightArm',metal,[.43,.63,.20],[.16,.10,.54],[0,0,-.05],.8);
      bx(groups,'rightArm',metal,[.43,.81,.20],[.16,.10,.50],[0,0,-.05],.8);
      break;
    case 'sprayer':
      cy(groups,'rightArm',0x25362a,[.39,.74,.15],.08,.08,.23,[0,0,0],.25);
      cy(groups,'rightArm',metal,[.39,.90,.18],.025,.025,.27,[0,0,-.70],.8);
      break;
    case 'mechArm':
      bx(groups,'rightArm',0x879da8,[.40,.70,.13],[.21,.32,.19],[0,0,-.15],.8);
      bx(groups,'rightArm',accent,[.40,.71,.24],[.16,.07,.025],[0,0,-.15],.3);
      cn(groups,'rightArm',metal,[.43,.50,.18],.08,.16,[Math.PI/2,0,0]);
      break;
    default: break;
  }
}
function addFaceDetails(groups:Record<Anchor,THREE.Group>,type:EnemyType,s:RoleSpec):void{
  const {dark,accent,metal}=s;
  switch(type){
    case 'customer':
      // Heavy frown and an unmistakable open complaint shout.
      bx(groups,'head',0x342729,[-.09,1.245,.176],[.12,.025,.025],[0,0,-.18]);
      bx(groups,'head',0x342729,[.09,1.245,.176],[.12,.025,.025],[0,0,.18]);
      sp(groups,'head',0x7c282c,[0,1.105,.185],[.075,.042,.025]);
      break;
    case 'architect':
      // Large dark lenses sit inside the thin frame already authored above.
      sp(groups,'head',0x27323e,[-.07,1.19,.183],[.052,.047,.012],.16);
      sp(groups,'head',0x27323e,[.07,1.19,.183],[.052,.047,.012],.16);
      break;
    case 'inspector':
      bx(groups,'head',0x25303a,[0,1.13,.178],[.22,.075,.025]);
      bx(groups,'head',accent,[0,1.31,.19],[.14,.032,.018]);
      break;
    case 'kurier':
      bx(groups,'head',0xf2ca4e,[0,1.29,.20],[.20,.035,.025]);
      bx(groups,'head',0x102b42,[-.17,1.18,.04],[.035,.11,.08]);
      break;
    case 'handlowiec':
      // Tie knot and collar separate the suited sales rep from plain uniforms.
      bx(groups,'head',0x1c2a43,[-.055,1.265,.18],[.07,.035,.018],[0,0,-.2]);
      bx(groups,'head',0x1c2a43,[.055,1.265,.18],[.07,.035,.018],[0,0,.2]);
      cn(groups,'torso',accent,[0,.90,.255],.055,.18,[Math.PI,0,0]);
      break;
    case 'przedstawiciel_włoski':
      // Visible moustache and a small polished lapel pin.
      bx(groups,'head',0x2c211e,[-.055,1.115,.18],[.10,.035,.035],[0,0,-.14]);
      bx(groups,'head',0x2c211e,[.055,1.115,.18],[.10,.035,.035],[0,0,.14]);
      sp(groups,'torso',0xe2c06b,[.14,.89,.25],[.035,.035,.018],.75);
      break;
    case 'monter':
      // Integrated work-lamp housing and a bright lens on the helmet.
      bx(groups,'head',0x202a31,[0,1.315,.19],[.14,.07,.045]);
      sp(groups,'head',0xf9f1b7,[0,1.32,.22],[.045,.038,.025],.45);
      break;
    case 'sztaplar_szalony':
      bx(groups,'head',0x25292d,[0,1.22,.18],[.28,.06,.035]);
      bx(groups,'torso',0x25292d,[0,.80,.31],[.46,.035,.02]);
      break;
    case 'krol_leto':
      sp(groups,'head',0x65dce9,[0,1.34,.20],[.075,.075,.035],.72);
      bx(groups,'torso',0x171a24,[0,.79,.285],[.46,.035,.025],[0,0,0],.6);
      break;
    case 'pan_roman':
      // A white ceramic logo badge and broad apron seam.
      bx(groups,'torso',0x9daeb2,[0,.87,.278],[.18,.10,.018],[0,0,0],.3);
      bx(groups,'torso',0xb65c1f,[0,.57,.285],[.49,.025,.018]);
      break;
    case 'serwisant':
      bx(groups,'head',0x202d35,[0,1.30,.19],[.12,.055,.035]);
      sp(groups,'head',0x36d4d7,[0,1.305,.22],[.035,.027,.018],.35);
      break;
    case 'bosman_krakow':
      bx(groups,'head',0xead7a2,[0,1.26,.19],[.20,.03,.02]);
      bx(groups,'torso',0x192b48,[0,.76,.285],[.34,.12,.02]);
      break;
    case 'zombie_pracownik':
      // Torn jaw and missing cheek keep the undead face visibly non-human.
      sp(groups,'head',0x66775c,[.07,1.075,.16],[.12,.075,.11]);
      bx(groups,'head',0x312629,[-.07,1.095,.20],[.12,.045,.02],[0,0,-.32]);
      for(let i=0;i<3;i++)cn(groups,'head',0xd8d2bb,[-.11+i*.065,1.07,.225],.022,.075,[Math.PI/2,0,0]);
      bx(groups,'torso',0x733d36,[.18,.82,.255],[.13,.045,.018],[0,0,.38]);
      break;
    case 'sebix_m':
      bx(groups,'head',0x252225,[-.09,1.22,.17],[.12,.04,.025],[0,0,-.15]);
      bx(groups,'head',0x252225,[.09,1.22,.17],[.12,.04,.025],[0,0,.15]);
      tor(groups,'torso',0xd3af48,[0,.99,.21],.19,.012,[Math.PI/2,0,0]);
      break;
    case 'mutant_gamma_forklift':
      sp(groups,'head',0xffc52e,[-.14,1.29,.20],[.06,.06,.035],.45);
      sp(groups,'head',0xffc52e,[.14,1.29,.20],[.06,.06,.035],.45);
      bx(groups,'torso',0xf1c52e,[0,.65,.33],[.56,.07,.025]);
      break;
    case 'radioactive_pip':
      bx(groups,'head',0x202a24,[0,1.30,.20],[.30,.055,.04]);
      sp(groups,'head',0xd9ff57,[0,1.31,.23],[.06,.025,.018],.1);
      break;
    case 'cyber_salesman':
      bx(groups,'head',dark,[0,1.15,.23],[.29,.035,.025],[0,0,0],.7);
      sp(groups,'head',accent,[0,1.37,.02],[.045,.09,.045],.7);
      break;
    case 'elite_walczak_guard':
      bx(groups,'head',0x9e283b,[0,1.14,.24],[.28,.045,.025],[0,0,0],.45);
      bx(groups,'torso',0x9e283b,[0,.62,.30],[.37,.055,.025],[0,0,0],.45);
      break;
    case 'walczak':
      cn(groups,'head',0xe6dcc1,[-.075,1.07,.235],.035,.14,[Math.PI/2,0,0]);
      cn(groups,'head',0xe6dcc1,[.075,1.07,.235],.035,.14,[Math.PI/2,0,0]);
      for(let i=0;i<4;i++)cn(groups,'torso',dark,[-.26+i*.17,1.08,-.10],.075,.20,[0,0,(i-1.5)*.22]);
      break;
    default:
      // Give any future authored type a clean, readable equipment colour anchor.
      sp(groups,'head',metal,[0,1.20,.18],[.025,.025,.015],.25);
      break;
  }
}

function findBone(root:THREE.Object3D,anchor:Anchor):THREE.Bone|null{
  const bones:THREE.Bone[]=[];root.traverse(o=>{if(o instanceof THREE.Bone)bones.push(o);});
  const names=bones.map(b=>({bone:b,n:b.name.toLowerCase().replace(/[^a-z0-9]/g,'')}));
  const first=(fn:(n:string)=>boolean)=>names.find(x=>fn(x.n))?.bone||null;
  if(anchor==='head')return first(n=>n==='head'||n.endsWith('head'));
  if(anchor==='torso'||anchor==='back')return first(n=>n.includes('spine2')||n.includes('spine3')||n.includes('upperchest')||n==='chest')||first(n=>n.includes('spine'));
  if(anchor==='legs')return first(n=>n.includes('pelvis')||n==='hips'||n.endsWith('hips'));
  return first(n=>(n.includes('right')||n.startsWith('r')||n.endsWith('r'))&&n.includes('arm')&&!n.includes('lower')&&!n.includes('fore')&&!n.includes('hand'));
}
function bake(type:EnemyType):THREE.Group|null{
  const spec=ROLE[type];if(!spec)return null;
  const source=new THREE.Group();const groups=newGroups();
  for(const a of anchors)source.add(groups[a]);
  body(groups,type,spec);helmet(groups,spec.gear,spec.accent);backGear(groups,spec.pack,spec.main,spec.accent,spec.metal);heldProp(groups,spec.prop,spec.accent,spec.metal);
  addFaceDetails(groups,type,spec);
  if(type==='architect'){
    for(let i=0;i<4;i++)bx(groups,'rightArm',[0xf2d67c,0xe5e0d4,0x829caf,0x3f8bb0][i],[.24+i*.06,.83,.18],[.07,.30,.018],[0,0,(i-1.5)*.17]);
    tor(groups,'head',spec.metal,[-.07,1.19,.18],.07,.012);tor(groups,'head',spec.metal,[.07,1.19,.18],.07,.012);
  }
  if(type==='inspector'){
    bx(groups,'torso',0xf8f5e8,[0,.77,.26],[.06,.42,.018]);bx(groups,'torso',0xf8f5e8,[0,.58,.26],[.52,.045,.018]);
  }
  if(type==='kurier'){
    bx(groups,'back',spec.accent,[0,.78,-.16],[.51,.055,.04]);bx(groups,'back',0x9a6034,[-.28,.59,-.17],[.23,.20,.20]);
  }
  if(type==='monter'){
    for(let i=0;i<3;i++)bx(groups,'torso',0x272f31,[-.20+i*.20,.56,.28],[.07,.12,.05]);
  }
  if(type==='przedstawiciel_włoski'){
    bx(groups,'torso',0xf2ece1,[-.07,.80,.225],[.035,.34,.014]);bx(groups,'torso',0x25894d,[0,.80,.23],[.035,.34,.014]);bx(groups,'torso',0xc43637,[.07,.80,.225],[.035,.34,.014]);
  }
  if(type==='bosman_krakow'){
    for(let i=0;i<5;i++)sp(groups,'torso',0xe6bf4e,[-.18+i*.09,.84,.27],[.035,.055,.018],.75);
  }
  if(type==='zombie_pracownik'){
    sp(groups,'head',0xd9f34c,[-.06,1.20,.20],[.032,.03,.02]);sp(groups,'head',0xd9f34c,[.10,1.20,.20],[.032,.03,.02]);
  }
  if(type==='sebix_m'){
    tor(groups,'torso',0xd6b13f,[0,1.02,.19],.16,.022,[Math.PI/2,0,0]);
    bx(groups,'torso',0xb52e38,[-.25,.88,.10],[.06,.39,.055]);bx(groups,'torso',0xf0e6dd,[-.16,.88,.12],[.04,.37,.05]);
  }
  if(type==='mutant_gamma_forklift'){
    bx(groups,'back',0x303a3c,[0,.89,-.34],[.52,.72,.11],[.1,0,0],.8);
    cy(groups,'back',spec.metal,[-.18,.94,-.4],.045,.045,.72,[0,0,0],.85);cy(groups,'back',spec.metal,[.18,.94,-.4],.045,.045,.72,[0,0,0],.85);
  }
  if(type==='radioactive_pip'){
    tor(groups,'torso',0x1d281e,[0,.75,.28],.12,.015,[0,0,0]);cy(groups,'head',0x9ba99a,[0,1.16,.27],.06,.06,.05,[Math.PI/2,0,0],.65);
  }
  if(type==='cyber_salesman'){
    bx(groups,'torso',0x142733,[0,.80,.25],[.40,.23,.045],[0,0,0],.85);bx(groups,'torso',spec.accent,[0,.82,.28],[.27,.07,.014],[0,0,0],.35);
  }
  if(type==='elite_walczak_guard'){
    bx(groups,'rightArm',0x667a88,[.42,.69,.23],[.33,.52,.075],[0,0,-.12],.75);
    bx(groups,'rightArm',0x1e2a37,[.42,.69,.275],[.25,.42,.018],[0,0,-.12],.7);
  }
  source.updateMatrixWorld(true);
  const root=new THREE.Group();root.name='enemy-role-kit-'+type;root.userData.enemyRole=type;root.userData.actorRoleSilhouette=true;
  for(const a of anchors){
    const parts:THREE.BufferGeometry[]=[];
    const sourceMeshes:THREE.Mesh[]=[];
    groups[a].traverse(o=>{
      if(o instanceof THREE.Mesh)sourceMeshes.push(o);
    });
    groups[a].traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const indexed=o.geometry.index?o.geometry:o.geometry.clone();
      const geo=indexed.toNonIndexed();if(indexed!==o.geometry)indexed.dispose();
      geo.applyMatrix4(o.matrixWorld);const pos=geo.getAttribute('position');
      const sourceMat=Array.isArray(o.material)?o.material[0]:o.material;
      const color=sourceMat&&'color'in sourceMat?(sourceMat as THREE.MeshStandardMaterial).color:new THREE.Color(0xffffff);
      const colors=new Float32Array(pos.count*3);
      for(let i=0;i<pos.count;i++){const k=i*3;colors[k]=color.r;colors[k+1]=color.g;colors[k+2]=color.b;}
      geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();parts.push(geo);
    });
    if(!parts.length)continue;
    const merged=mergeGeometries(parts,false);for(const geo of parts)geo.dispose();
    if(!merged)throw new Error('Unable to merge '+type+' '+a+' role kit');
    merged.computeBoundingSphere();
    for(const sourceMesh of sourceMeshes){
      sourceMesh.geometry.dispose();
      const sourceMaterials=Array.isArray(sourceMesh.material)?sourceMesh.material:[sourceMesh.material];
      sourceMaterials.forEach(sourceMaterial=>sourceMaterial.dispose());
    }
    const mesh=new THREE.Mesh(merged,sharedKitMaterial);mesh.name='enemy-role-'+type+'-'+a;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=true;
    mesh.userData.gobkitSharedGeometry=true;mesh.userData.actorRoleSilhouette=true;
    groups[a].clear();groups[a].add(mesh);root.add(groups[a]);
  }
  source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());});
  return root.children.length?root:null;
}

/** Attach an articulated role kit to the existing rig; no replacement actor or MakeHuman asset is loaded. */
export function createEnemyRoleKit(type:EnemyType,actorRoot:THREE.Group):THREE.Group|null{
  if(!templates.has(type))templates.set(type,bake(type));
  const template=templates.get(type);if(!template)return null;
  const instance=template.clone(true) as THREE.Group;
  const bounds=new THREE.Box3().setFromObject(actorRoot);
  const height=bounds.getSize(new THREE.Vector3()).y;
  const fitScale=THREE.MathUtils.clamp((Number.isFinite(height)&&height>.1?height:1.5)/1.5,.82,1.42);
  const rootScale=Math.max(.001,Math.abs(actorRoot.scale.x));
  actorRoot.updateWorldMatrix(true,true);
  for(const attachment of [...instance.children]){
    const anchor=attachment.userData.actorRigAnchor as Anchor;
    instance.remove(attachment);attachment.scale.setScalar(fitScale/rootScale);
    actorRoot.add(attachment);actorRoot.updateWorldMatrix(true,true);
    const bone=findBone(actorRoot,anchor);
    if(bone)bone.attach(attachment);else actorRoot.attach(attachment);
  }
  const handle=new THREE.Group();handle.name='enemy-role-kit-handle-'+type;handle.visible=false;
  handle.userData.actorRoleSilhouette=true;handle.userData.enemyRole=type;actorRoot.add(handle);
  actorRoot.userData.enemyRoleKit=type;
  return handle;
}
