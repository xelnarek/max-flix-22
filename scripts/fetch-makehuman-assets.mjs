import{createHash}from'node:crypto';
import{mkdir,readFile,writeFile}from'node:fs/promises';
import path from'node:path';import{fileURLToPath}from'node:url';
import{parseGlbJson,validateMakeHumanPack,validateMakeHumanSidecar}from'./makeHumanPack.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'public','assets','makehuman'),MANIFEST=path.join(OUT,'manifest.json');
const COMMIT='852e48f316b90a0937234886630e4fb4cdfd1f78';
const BASE='https://raw.githubusercontent.com/kblood/CharacterCreator/'+COMMIT+'/output/';
const strict=process.argv.includes('--strict');
const SIDECAR={file:'base_body.joints.json',size:45258,gitBlobSha1:'85c678206c9978215d3009a6ac476d93f57652b0'};
const ASSETS=[
 ['base_body_anim.glb',8212156,'bdbdab04eb85903e46c56ff56c7a1ea0cbe9c78b','animated-base-humanoid'],
 ['clothing_shirt.glb',605956,'c46eb5a6afadedba00eae10a77aebcd6ad326233','business-shirt'],
 ['clothing_tshirt.glb',388104,'ce7966dfd52c4bc6158e1e3b21969e6a63b066da','work-tshirt'],
 ['clothing_jeans.glb',428704,'10b38785efef7196bc9903c9d8cdf236d28dc584','work-trousers'],
 ['clothing_shoes.glb',847684,'aab06a01a235242c7e8aac4fda83278c6e0b42f4','work-shoes'],
 ['clothing_boots.glb',696608,'7fea477d6496c9ccbfc4694a06ecebe9ed80abec','work-boots'],
 ['clothing_jacket.glb',857976,'6f1d075b1c041a67e15af98395769e0c5fa915b9','security-or-supervisor-jacket'],
 ['clothing_hoodie.glb',684848,'85999d3584078c11e9e4637ea53d88b150a775c3','warehouse-hoodie'],
 ['hair_short02.glb',1103288,'55243e1eb018ca44bd890f9acacb8c874eeb96f8','short-hair'],
 ['hair_short04.glb',1132824,'2be20f473553de135a73c04bcfaaa4b66ccca674','short-sleek-hair'],
 ['hair_bob02.glb',1003028,'5ea4a7c8cf49670ff3ec9214b8240fdf72aa144a','bob-hair'],
];
const blobSha=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const sha256=b=>createHash('sha256').update(b).digest('hex');
async function fetchRetry(url,attempts=4){let last;for(let i=1;i<=attempts;i++){try{const r=await fetch(url,{headers:{'user-agent':'MaxFlix22-CC0-AssetBuild/1.0'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error('HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer());}catch(e){last=e;if(i<attempts)await new Promise(resolve=>setTimeout(resolve,Math.min(8000,650*2**(i-1))));}}throw last;}
async function existing(file,size,expectedSha){try{const b=await readFile(path.join(OUT,file));if(b.length!==size||blobSha(b)!==expectedSha)return null;parseGlbJson(b,file);return b;}catch{return null;}}
async function existingSidecar(){try{
 const bytes=await readFile(path.join(OUT,SIDECAR.file));
 if(bytes.length!==SIDECAR.size||blobSha(bytes)!==SIDECAR.gitBlobSha1)return null;
 const json=JSON.parse(bytes.toString('utf8'));validateMakeHumanSidecar(json);return bytes;
 }catch{return null;}}
async function run(){
 await mkdir(OUT,{recursive:true});const files=new Map();
 const manifest={provider:'MakeHuman / MPFB generated assets',sourceRepository:'https://github.com/kblood/CharacterCreator',sourceCommit:COMMIT,licence:'CC0-1.0 for generated GLB assets, as declared by the source project',note:'Only generated binary GLBs are bundled; GPL-3.0-or-later generator source is not copied into this game.',fetchedAt:new Date().toISOString(),body:'base_body_anim.glb',clips:[],assets:{}};
 for(const [file,size,expectedSha,role]of ASSETS){
  const old=await existing(file,size,expectedSha),bytes=old||await fetchRetry(BASE+file);
  if(bytes.length!==size)throw new Error('Unexpected file size for '+file+': '+bytes.length+' != '+size);
  const actual=blobSha(bytes);if(actual!==expectedSha)throw new Error('Git blob SHA-1 mismatch for '+file+': '+actual);
  parseGlbJson(bytes,file);if(!old)await writeFile(path.join(OUT,file),bytes);files.set(file,bytes);
  manifest.assets[file]={role,bytes:bytes.length,gitBlobSha1:actual,sha256:sha256(bytes),licence:'CC0-1.0',source:BASE+file};
  console.log('[MakeHuman] verified '+file+' • '+bytes.length+' bytes');
 }
 const validation=validateMakeHumanPack(files);
 const existingJsonSidecar=await existingSidecar();
 const sidecarBytes=existingJsonSidecar||await fetchRetry(BASE+SIDECAR.file);
 if(sidecarBytes.length!==SIDECAR.size)throw new Error('Unexpected sidecar byte length: '+sidecarBytes.length);
 const sidecarSha=blobSha(sidecarBytes);
 if(sidecarSha!==SIDECAR.gitBlobSha1)throw new Error('Joint sidecar Git blob SHA-1 mismatch: '+sidecarSha);
 let sidecar;
 try{sidecar=JSON.parse(sidecarBytes.toString('utf8'));}catch(error){throw new Error('Joint sidecar JSON is malformed: '+String(error));}
 const sidecarValidation=validateMakeHumanSidecar(sidecar);
 if(!existingJsonSidecar)await writeFile(path.join(OUT,SIDECAR.file),sidecarBytes);
 manifest.jointSidecar={file:SIDECAR.file,bytes:sidecarBytes.length,gitBlobSha1:sidecarSha,sha256:sha256(sidecarBytes),licence:'CC0-1.0',source:BASE+SIDECAR.file};
 manifest.clips=validation.animationNames;manifest.rig={boneCount:validation.bodyBoneCount,animationTargetCount:validation.animationTargetCount,parts:validation.parts,sidecarBones:sidecarValidation.boneCount,sidecarMorphs:sidecarValidation.morphCount};
 await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n','utf8');
 console.log('[MakeHuman] ready • '+ASSETS.length+' GLBs + joint sidecar • '+sidecarValidation.boneCount+' bones • '+manifest.clips.length+' clips');
}
run().catch(error=>{console.error('[MakeHuman] asset preparation failed:',error);if(strict)process.exitCode=1;else console.warn('[MakeHuman] development keeps its existing procedural/Gobkit fallback.');});
