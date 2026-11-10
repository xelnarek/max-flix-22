const MAGIC=0x46546c67, JSON_CHUNK=0x4e4f534a;
export const REQUIRED_MAKEHUMAN_CLIPS=Object.freeze(['idle','walk','run','jump','fall','land']);
export function parseGlbJson(bytes,label='asset.glb'){
 if(!Buffer.isBuffer(bytes)||bytes.length<20)throw new Error('GLB is truncated: '+label);
 if(bytes.readUInt32LE(0)!==MAGIC)throw new Error('Invalid GLB magic: '+label);
 if(bytes.readUInt32LE(4)!==2)throw new Error('Expected GLB 2.0: '+label);
 if(bytes.readUInt32LE(8)!==bytes.length)throw new Error('GLB declared length mismatch: '+label);
 let offset=12;
 while(offset+8<=bytes.length){
  const size=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),start=offset+8,end=start+size;
  if(end>bytes.length)throw new Error('GLB chunk exceeds file length: '+label);
  if(type===JSON_CHUNK){
   let json; try{json=JSON.parse(bytes.toString('utf8',start,end).trim());}
   catch(error){throw new Error('GLB JSON is malformed ('+label+'): '+String(error));}
   if(json.asset?.version!=='2.0')throw new Error('Embedded glTF version is not 2.0: '+label);
   return json;
  }
  offset=end;
 }
 throw new Error('GLB has no JSON chunk: '+label);
}
function skinNames(doc,skin){return(skin?.joints||[]).map(i=>doc.nodes?.[i]?.name).filter(Boolean);}
export function validateMakeHumanPack(files){
 const bytes=files.get('base_body_anim.glb'); if(!bytes)throw new Error('Missing base_body_anim.glb');
 const body=parseGlbJson(bytes,'base_body_anim.glb');
 if(!body.meshes?.length)throw new Error('MakeHuman body has no mesh');
 if(!body.skins?.length)throw new Error('MakeHuman body has no humanoid skeleton');
 const bodyBones=new Set(body.skins.flatMap(s=>skinNames(body,s)));
 if(bodyBones.size<30)throw new Error('MakeHuman body rig is unexpectedly incomplete');
 const animationNames=(body.animations||[]).map(a=>a.name).filter(Boolean);
 const missing=REQUIRED_MAKEHUMAN_CLIPS.filter(n=>!animationNames.includes(n));
 if(missing.length)throw new Error('MakeHuman body is missing clips: '+missing.join(', '));
 const targets=new Set();
 for(const animation of body.animations||[])for(const channel of animation.channels||[]){
  const name=body.nodes?.[channel.target?.node]?.name;if(name)targets.add(name);
 }
 const bodyNodes=new Set((body.nodes||[]).map(n=>n.name).filter(Boolean));
 for(const name of targets)if(!bodyNodes.has(name))throw new Error('MakeHuman animation has an unresolved node: '+name);
 const parts={};
 for(const [filename,data] of files){
  if(filename==='base_body_anim.glb')continue;
  const doc=parseGlbJson(data,filename);
  if(!doc.meshes?.length)throw new Error('MakeHuman wearable has no mesh: '+filename);
  const hasSkinnedMesh=(doc.nodes||[]).some(n=>Number.isInteger(n.mesh)&&Number.isInteger(n.skin));
  const isHair=filename.startsWith('hair_');
  if(!isHair&&(!doc.skins?.length||!hasSkinnedMesh))throw new Error('Wearable is not bound to a humanoid skeleton: '+filename);
  const bones=new Set((doc.skins||[]).flatMap(s=>skinNames(doc,s)));
  const unknown=[...bones].filter(n=>!bodyBones.has(n));
  if(unknown.length)throw new Error('Wearable rig does not match base body ('+filename+'): '+unknown.slice(0,8).join(', '));
  parts[filename]={hasSkinnedMesh,boneCount:bones.size,meshCount:doc.meshes.length};
 }
 return{bodyBoneCount:bodyBones.size,animationNames,animationTargetCount:targets.size,parts};
}

export function validateMakeHumanSidecar(sidecar) {
  if (!sidecar || typeof sidecar !== 'object') throw new Error('MakeHuman joint sidecar is not an object');
  const bones = sidecar.bones;
  const morphs = sidecar.morphs;
  if (!bones || typeof bones !== 'object' || Object.keys(bones).length < 50) {
    throw new Error('MakeHuman joint sidecar has an incomplete 53-bone rest rig');
  }
  for (const required of ['Root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'thigh_l', 'calf_l', 'foot_l']) {
    if (!Array.isArray(bones[required]) || bones[required].length !== 3 || !bones[required].every(Number.isFinite)) {
      throw new Error('MakeHuman joint sidecar is missing rest joint: ' + required);
    }
  }
  if (!morphs || typeof morphs !== 'object' || Object.keys(morphs).length < 50) {
    throw new Error('MakeHuman joint sidecar has no complete morph offset table');
  }
  for (const [morph, offsets] of Object.entries(morphs)) {
    if (!offsets || typeof offsets !== 'object') throw new Error('Invalid morph offset table: ' + morph);
    for (const [bone, offset] of Object.entries(offsets)) {
      if (!bones[bone]) throw new Error('Morph ' + morph + ' references an unknown rest bone: ' + bone);
      if (!Array.isArray(offset) || offset.length !== 3 || !offset.every(Number.isFinite)) {
        throw new Error('Morph ' + morph + ' has an invalid offset for ' + bone);
      }
    }
  }
  return { boneCount: Object.keys(bones).length, morphCount: Object.keys(morphs).length };
}
