import{createHash}from'node:crypto';
import{mkdir,readFile,writeFile}from'node:fs/promises';
import path from'node:path';import{fileURLToPath}from'node:url';
import{isPng,makePolyHavenMapUrl,POLYHAVEN_TEXTURE_ASSETS}from'./polyHavenPack.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'public','assets','polyhaven'),MANIFEST=path.join(OUT,'manifest.json');
const strict=process.argv.includes('--strict');
const sha256=b=>createHash('sha256').update(b).digest('hex');
async function fetchRetry(url,attempts=3){let last;for(let i=1;i<=attempts;i++){try{const r=await fetch(url,{headers:{'user-agent':'MaxFlix22-PolyHaven-CC0/1.0'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}catch(e){last=e;if(i<attempts)await new Promise(resolve=>setTimeout(resolve,500*i));}}throw last;}
async function getBytes(asset,map){for(const resolution of ['2k','1k']){const url=makePolyHavenMapUrl(asset.id,map,resolution);try{const old=path.join(OUT,asset.id,asset.id+'_'+map+'_'+resolution+'.png');let bytes;try{bytes=await readFile(old);}catch{}if(!isPng(bytes))bytes=await fetchRetry(url);if(!isPng(bytes))throw new Error('Invalid PNG signature at '+url);if(bytes.length>32*1024*1024)throw new Error('Texture exceeds 32MB: '+url);await mkdir(path.dirname(old),{recursive:true});await writeFile(old,bytes);return{bytes,resolution,relativePath:'assets/polyhaven/'+asset.id+'/'+path.basename(old),source:url};}catch(error){console.warn('[PolyHaven] '+asset.id+' '+map+' '+resolution+' unavailable:',String(error));}}throw new Error('No usable resolution for '+asset.id+' map '+map);}
async function run(){
 await mkdir(OUT,{recursive:true});
 const manifest={provider:'Poly Haven',credit:'Powered by Poly Haven',licence:'CC0-1.0',fetchedAt:new Date().toISOString(),assets:{}};
 for(const asset of POLYHAVEN_TEXTURE_ASSETS){
  const maps={};let resolution='2k';
  for(const map of asset.maps){
   const result=await getBytes(asset,map);resolution=result.resolution;
   maps[map==='diff'?'diffuse':map==='nor_gl'?'normal':'arm']={file:result.relativePath,bytes:result.bytes.length,sha256:sha256(result.bytes),source:result.source};
  }
  manifest.assets[asset.id]={role:asset.role,resolution,maps};
  console.log('[PolyHaven] verified '+asset.id+' ('+Object.keys(maps).length+' PBR maps, '+resolution+')');
 }
 await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n','utf8');
 console.log('[PolyHaven] ready • '+Object.keys(manifest.assets).length+' CC0 material sets');
}
run().catch(error=>{console.error('[PolyHaven] asset preparation failed:',error);if(strict)process.exitCode=1;else console.warn('[PolyHaven] development keeps procedural surface materials as fallback.');});
