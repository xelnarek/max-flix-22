import assert from'node:assert/strict';import test from'node:test';
import{parseGlbJson,validateMakeHumanPack,validateMakeHumanSidecar,REQUIRED_MAKEHUMAN_CLIPS}from'../scripts/makeHumanPack.mjs';
function makeGlb(doc){const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(json);const ch=Buffer.alloc(8);ch.writeUInt32LE(json.length,0);ch.writeUInt32LE(0x4e4f534a,4);const length=12+8+json.length,h=Buffer.alloc(12);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(length,8);return Buffer.concat([h,ch,json]);}
const nodes=[{name:'Root'},...Array.from({length:32},(_,i)=>({name:'bone_'+i}))];
const body={asset:{version:'2.0'},nodes,meshes:[{primitives:[{attributes:{POSITION:0}}]}],skins:[{joints:Array.from({length:32},(_,i)=>i+1)}],animations:REQUIRED_MAKEHUMAN_CLIPS.map(name=>({name,channels:[{target:{node:1,path:'rotation'}}]}))};
const clothing={asset:{version:'2.0'},nodes:[{name:'Armature'},...Array.from({length:3},(_,i)=>({name:'bone_'+i})),{name:'Cloth_shirt',mesh:0,skin:0}],meshes:[{primitives:[{attributes:{POSITION:0,JOINTS_0:1,WEIGHTS_0:2}}]}],skins:[{joints:[1,2,3]}],animations:[]};
test('accepts a complete humanoid with baked locomotion and compatible clothing',()=>{const result=validateMakeHumanPack(new Map([['base_body_anim.glb',makeGlb(body)],['clothing_shirt.glb',makeGlb(clothing)]]));assert.equal(result.bodyBoneCount,32);assert.deepEqual(result.animationNames,REQUIRED_MAKEHUMAN_CLIPS);assert.equal(result.parts['clothing_shirt.glb'].hasSkinnedMesh,true);});
test('rejects truncated, invalid-header, unsupported-version and incorrect-length GLBs',()=>{assert.throws(()=>parseGlbJson(Buffer.alloc(12)),/truncated/);const a=makeGlb(body);a.writeUInt32LE(0,0);assert.throws(()=>parseGlbJson(a),/magic/);const b=makeGlb(body);b.writeUInt32LE(1,4);assert.throws(()=>parseGlbJson(b),/2.0/);const c=makeGlb(body);c.writeUInt32LE(c.length+4,8);assert.throws(()=>parseGlbJson(c),/length mismatch/);});
test('rejects missing baked clips and incomplete rigs',()=>{assert.throws(()=>validateMakeHumanPack(new Map([['base_body_anim.glb',makeGlb({...body,animations:body.animations.filter(a=>a.name!=='run')})]])),/run/);assert.throws(()=>validateMakeHumanPack(new Map([['base_body_anim.glb',makeGlb({...body,skins:[{joints:[1,2]}]})]])),/rig is unexpectedly incomplete/);});
test('rejects clothing whose bone names do not match the body skeleton',()=>{const wrong={...clothing,nodes:[{name:'Armature'},{name:'unknown_bone'},{name:'Cloth_shirt',mesh:0,skin:0}],skins:[{joints:[1]}]};assert.throws(()=>validateMakeHumanPack(new Map([['base_body_anim.glb',makeGlb(body)],['clothing_shirt.glb',makeGlb(wrong)]])),/does not match base body|not bound/);});
test('requires clothing to be skinned while allowing static hair mesh assets',()=>{const unskinned={...clothing,nodes:[{name:'shirt'}],skins:[]};assert.throws(()=>validateMakeHumanPack(new Map([['base_body_anim.glb',makeGlb(body)],['clothing_shirt.glb',makeGlb(unskinned)]])),/not bound/);const hair={...unskinned,meshes:clothing.meshes};assert.equal(validateMakeHumanPack(new Map([['base_body_anim.glb',makeGlb(body)],['hair_short02.glb',makeGlb(hair)]] )).parts['hair_short02.glb'].hasSkinnedMesh,false);});

test('validates joint rest positions and all referenced morph offsets before variant deformation',()=>{
 const bones={Root:[0,0,0],pelvis:[0,0.87,0],spine_01:[0,0.95,0],spine_02:[0,1.02,0],spine_03:[0,1.10,0],neck_01:[0,1.41,0],head:[0,1.51,0],thigh_l:[0.1,0.86,0],calf_l:[0.14,0.47,0],foot_l:[0.18,0.07,0],upperarm_l:[0.17,1.32,0.02]};
 for(let i=0;i<43;i++)bones['extra_'+i]=[0,0,0];
 const morphs=Object.fromEntries(Array.from({length:51},(_,i)=>['morph_'+i,{pelvis:[0,0.01,0]}]));
 morphs.weight_max={pelvis:[0,0.01,0],spine_02:[0,0.02,0]};
 morphs.muscle_max={upperarm_l:[0.01,0,0]};
 assert.deepEqual(validateMakeHumanSidecar({bones,morphs}),{boneCount:54,morphCount:51});
 assert.throws(()=>validateMakeHumanSidecar({bones:{pelvis:[0,0,0]},morphs}),/incomplete 53-bone/);
 const unknown={...morphs,bad:{ghost:[0,0,0]}};
 assert.throws(()=>validateMakeHumanSidecar({bones:{...bones},morphs:unknown}),/unknown rest bone/);
 const invalid={...morphs,bad:{pelvis:[0,NaN,0]}};
 assert.throws(()=>validateMakeHumanSidecar({bones:{...bones},morphs:invalid}),/invalid offset/);
});
