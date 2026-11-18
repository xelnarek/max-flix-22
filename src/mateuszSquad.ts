export type MateuszAllyRole = 'bruiser' | 'flanker' | 'ranged' | 'support';
export interface MateuszRecruitCandidate { id:string; type:string; x:number; y:number; z:number; state:string; }
export interface MateuszRecruitOrder { enemyId:string; role:MateuszAllyRole; durationSeconds:number; }
const EXCLUDED = new Set(['walczak','krol_leto','bosman_krakow','sebix_m']);
const BRUISERS = new Set(['sztaplar_szalony','elite_walczak_guard','agv_robot','mutant_gamma_forklift']);
const RANGED = new Set(['handlowiec','przedstawiciel_włoski','pan_roman','serwisant','cyber_salesman']);
export function getMateuszAllyRole(type:string):MateuszAllyRole {
 if(BRUISERS.has(type)) return 'bruiser';
 if(type==='inspector'||type==='radioactive_pip') return 'support';
 if(RANGED.has(type)) return 'ranged';
 return 'flanker';
}
export function selectMateuszRecruitOrders(candidates:readonly MateuszRecruitCandidate[],playerX:number,playerY:number,playerZ:number,radius=10.5,maxAllies=3,durationSeconds=12):MateuszRecruitOrder[] {
 if(![playerX,playerY,playerZ,radius,maxAllies,durationSeconds].every(Number.isFinite)) return [];
 const r=Math.max(0,Math.min(16,radius)), cap=Math.max(0,Math.min(3,Math.floor(maxAllies)));
 if(r===0||cap===0||durationSeconds<=0) return [];
 const seen=new Set<string>();
 return candidates.filter(c=>{
  if(!c.id||seen.has(c.id)||c.state==='defeated'||EXCLUDED.has(c.type)||![c.x,c.y,c.z].every(Number.isFinite)||Math.abs(c.y-playerY)>2.2) return false;
  seen.add(c.id); return true;
 }).map(candidate=>({candidate,distance:Math.hypot(candidate.x-playerX,candidate.z-playerZ)}))
 .filter(entry=>entry.distance<=r)
 .sort((a,b)=>a.distance-b.distance||a.candidate.id.localeCompare(b.candidate.id))
 .slice(0,cap).map(({candidate})=>({enemyId:candidate.id,role:getMateuszAllyRole(candidate.type),durationSeconds}));
}
