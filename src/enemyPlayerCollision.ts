import type { EnemyType } from './types.ts';
export interface EnemyContactBody { readonly id:string; readonly type:EnemyType|string; readonly x:number; readonly y:number; readonly z:number; readonly state?:string; }
export interface EnemyContactNormal { readonly x:number; readonly z:number; }
export interface PlayerMovementContactResult { readonly x:number; readonly z:number; readonly collided:boolean; readonly normalX:number; readonly normalZ:number; readonly contactNormals?:readonly EnemyContactNormal[]; }
export function getEnemyPlayerContactDistance(type:EnemyType|string):number {
 if(['walczak','krol_leto','bosman_krakow','cthulhu','sebix_m'].includes(type))return type==='sebix_m'?1.18:1.38;
 if(['elite_walczak_guard','mutant_gamma_forklift','sztaplar_szalony','agv_robot'].includes(type))return 1.12;
 return 0.98;
}
function stableNormal(id:string):{x:number;z:number}{let hash=2166136261;for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);const a=((hash>>>0)/0x100000000)*Math.PI*2;return{x:Math.cos(a),z:Math.sin(a)};}
const COLLISION_EPSILON=1e-7,COLLISION_SKIN=0.012;
/** Deterministic multi-contact swept-circle solver resolves earliest impact, then slides along contact tangents. */
export function resolvePlayerMovementAgainstEnemies(start:{x:number;z:number},desired:{x:number;z:number},playerY:number,enemies:readonly EnemyContactBody[],verticalClearance=1.12):PlayerMovementContactResult{
 if(![start.x,start.z,desired.x,desired.z,playerY,verticalClearance].every(Number.isFinite))return{x:desired.x,z:desired.z,collided:false,normalX:0,normalZ:0};
 const clearance=Math.max(0.4,verticalClearance),bodies=enemies.filter(e=>e.state!=='defeated'&&[e.x,e.y,e.z].every(Number.isFinite)&&Math.abs(playerY-e.y)<clearance).slice().sort((a,b)=>a.id.localeCompare(b.id));
 let x=start.x,z=start.z,rx=desired.x-start.x,rz=desired.z-start.z;const normals:EnemyContactNormal[]=[];
 const remember=(a:number,b:number)=>{const l=Math.hypot(a,b);if(l<COLLISION_EPSILON)return;const nx=a/l,nz=b/l;if(!normals.some(n=>n.x*nx+n.z*nz>0.995))normals.push({x:nx,z:nz});};
 for(let pass=0;pass<4;pass++){let corrected=false;for(const e of bodies){const r=getEnemyPlayerContactDistance(e.type),dx=x-e.x,dz=z-e.z,d=Math.hypot(dx,dz);if(d>=r-COLLISION_EPSILON)continue;const n=d>COLLISION_EPSILON?{x:dx/d,z:dz/d}:stableNormal(e.id),push=r-d+COLLISION_SKIN;x+=n.x*push;z+=n.z*push;remember(n.x,n.z);corrected=true;}if(!corrected)break;}
 for(let pass=0;pass<6;pass++){const travel=rx*rx+rz*rz;if(travel<COLLISION_EPSILON*COLLISION_EPSILON)break;let earliest=Number.POSITIVE_INFINITY;const hits:EnemyContactNormal[]=[];
  for(const e of bodies){const r=getEnemyPlayerContactDistance(e.type),sx=x-e.x,sz=z-e.z,c=sx*sx+sz*sz-r*r,approach=sx*rx+sz*rz;let t:number|null=null;
   if(c<=COLLISION_EPSILON){if(approach<-COLLISION_EPSILON)t=0;}else if(approach<0){const b=2*approach,disc=b*b-4*travel*c;if(disc>=0){const candidate=(-b-Math.sqrt(disc))/(2*travel);if(candidate>=-COLLISION_EPSILON&&candidate<=1+COLLISION_EPSILON)t=Math.max(0,Math.min(1,candidate));}}
   if(t===null)continue;if(t<earliest-1e-5){earliest=t;hits.length=0;}if(Math.abs(t-earliest)<=1e-5){const hx=x+rx*t-e.x,hz=z+rz*t-e.z,l=Math.hypot(hx,hz),n=l>COLLISION_EPSILON?{x:hx/l,z:hz/l}:stableNormal(e.id);if(!hits.some(v=>v.x*n.x+v.z*n.z>0.995))hits.push(n);}
  }
  if(!Number.isFinite(earliest)){x+=rx;z+=rz;rx=0;rz=0;break;}
  x+=rx*earliest;z+=rz*earliest;rx*=1-earliest;rz*=1-earliest;for(const n of hits)remember(n.x,n.z);for(const n of hits){x+=n.x*COLLISION_SKIN;z+=n.z*COLLISION_SKIN;}
  const p=projectVelocityOutOfEnemyContacts({x:rx,z:rz},hits);rx=p.x;rz=p.z;
 }
 for(let pass=0;pass<3;pass++){let corrected=false;for(const e of bodies){const r=getEnemyPlayerContactDistance(e.type),dx=x-e.x,dz=z-e.z,d=Math.hypot(dx,dz);if(d>=r-COLLISION_EPSILON)continue;const n=d>COLLISION_EPSILON?{x:dx/d,z:dz/d}:stableNormal(e.id),push=r-d+COLLISION_SKIN;x+=n.x*push;z+=n.z*push;remember(n.x,n.z);corrected=true;}if(!corrected)break;}
 const collided=normals.length>0;return{x,z,collided,normalX:normals[normals.length-1]?.x??0,normalZ:normals[normals.length-1]?.z??0,contactNormals:collided?normals:undefined};
}
export function projectVelocityOutOfEnemyContacts(v:{readonly x:number;readonly z:number},normals:readonly EnemyContactNormal[]):{x:number;z:number}{
 let x=Number.isFinite(v.x)?v.x:0,z=Number.isFinite(v.z)?v.z:0;if(!normals.length)return{x,z};const passes=Math.max(2,Math.min(8,normals.length*2));
 for(let pass=0;pass<passes;pass++){let changed=false;for(const n of normals){if(!Number.isFinite(n.x)||!Number.isFinite(n.z))continue;const l=Math.hypot(n.x,n.z);if(l<1e-6)continue;const nx=n.x/l,nz=n.z/l,inward=x*nx+z*nz;if(inward>=-1e-7)continue;x-=nx*inward;z-=nz*inward;changed=true;}if(!changed)break;}return{x,z};
}