import test from 'node:test';
import assert from 'node:assert/strict';
import { getMateuszAllyRole, selectMateuszRecruitOrders } from '../src/mateuszSquad.ts';
const c=(id,type,x,y=0,z=0,state='chase')=>({id,type,x,y,z,state});
test('Mateusz recruits up to three nearest enemies and assigns different autonomous roles',()=>{
 const orders=selectMateuszRecruitOrders([c('heavy','sztaplar_szalony',2),c('ranged','handlowiec',3),c('support','inspector',4),c('extra','monter',5),c('boss','walczak',0.5),c('dead','kurier',1,0,0,'defeated')],0,0,0);
 assert.deepEqual(orders.map(o=>o.enemyId),['heavy','ranged','support']);
 assert.deepEqual(orders.map(o=>o.role),['bruiser','ranged','support']);
 assert.ok(orders.every(o=>o.durationSeconds===12));
});
test('Mateusz recruitment excludes bosses, defeated, distant, vertically separated and invalid candidates',()=>{
 assert.deepEqual(selectMateuszRecruitOrders([c('boss','sebix_m',1)],0,0,0),[]);
 assert.deepEqual(selectMateuszRecruitOrders([c('far','kurier',15)],0,0,0),[]);
 assert.deepEqual(selectMateuszRecruitOrders([c('high','kurier',1,5)],0,0,0),[]);
 assert.deepEqual(selectMateuszRecruitOrders([],Number.NaN,0,0),[]);
});
test('Mateusz role classifier supports bruiser, flanker, ranged and support archetypes',()=>{
 assert.equal(getMateuszAllyRole('agv_robot'),'bruiser');assert.equal(getMateuszAllyRole('kurier'),'flanker');
 assert.equal(getMateuszAllyRole('cyber_salesman'),'ranged');assert.equal(getMateuszAllyRole('radioactive_pip'),'support');
});
