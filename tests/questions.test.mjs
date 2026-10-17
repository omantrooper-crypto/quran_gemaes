import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {selectSession,buildPool,bankStats,defaultBank,questionTokens} from '../src/questions.mjs';
import {reserveLocal,readHistory} from '../src/history.mjs';import {validateBank} from '../src/content.mjs';
const q=JSON.parse(fs.readFileSync(new URL('../public/data/quran.json',import.meta.url)));
test('expanded bank has independent candidates, valid references, unique identities and distinct options',()=>{
 validateBank(defaultBank,q);const counts=bankStats(q,{difficulty:'متقدم'});assert.ok(counts.next>6000);assert.ok(counts.missing>5700);assert.ok(defaultBank.entries.length>200);
 for(const [id,count] of Object.entries(counts)){const pool=buildPool(id,q,{difficulty:'متقدم'});assert.equal(new Set(pool.map(x=>x.id)).size,count);for(const x of pool)assert.ok(q[x.s-1]?.verses[x.a-1],x.id);const session=selectSession(id,q,{difficulty:'متقدم',count:30});for(const x of session.questions){if(x.choices){assert.equal(x.choices.length,4,x.qid);assert.equal(new Set(x.choices).size,4);assert.ok(x.choices.includes(x.answer));}if(x.type==='search')assert.equal(q[+x.answer.split(':')[0]-1].verses[+x.answer.split(':')[1]-1].text,x.text);}}
});
test('every game exhausts without repeating, including shuffled cards and words',()=>{
 for(const id of ['key','compass','memory','order','meaning','speaker','story','theme','grid','links','rules','tajwid','search','missing','next','similar']){
  const pool=buildPool(id,q,{scope:'short',difficulty:'متقدم'});const seen=new Set();let rounds=0;
  while(true){const r=selectSession(id,q,{scope:'short',difficulty:'متقدم',seen:[...seen],count:200});if(!r.questions.length)break;for(const token of r.tokens){assert.ok(!seen.has(token),`${id}: duplicate ${token}`);seen.add(token);}assert.ok(++rounds<200);}
  assert.ok(seen.size>=pool.length-1,`${id}: all usable candidates consumed`);assert.ok(selectSession(id,q,{scope:'short',difficulty:'متقدم',seen:[...seen]}).exhausted);
 }
});
test('history survives storage reload, abandoned sessions, difficulty and cross-game gates',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const a=await reserveLocal('key',q,{scope:'all',difficulty:'مبتدئ'},storage);assert.ok(a.questions.length);const b=await reserveLocal('key',q,{scope:'all',difficulty:'متقدم'},storage);assert.ok(b.tokens.every(x=>!a.tokens.includes(x)));
 const next=await reserveLocal('next',q,{scope:'all'},storage);const before=readHistory(storage);const gate=await reserveLocal('gates',q,{scope:'all'},storage);assert.ok(gate.tokens.every(x=>!before.includes(x)));assert.ok(readHistory(storage).length>=a.tokens.length+b.tokens.length+next.tokens.length);
 await assert.rejects(reserveLocal('key',q,{}, {getItem:()=>null,setItem(){throw Error('quota');}}),/quota/);
});
test('content validation rejects duplicate concepts and invalid Quran references, drafts do not play',()=>{
 const first=defaultBank.entries[0];assert.throws(()=>validateBank({schemaVersion:1,entries:[first,{...first,id:'renamed'}]},q),/مكرر/);
 assert.throws(()=>validateBank({schemaVersion:1,entries:[{...first,ayah:999}]},q));
 assert.throws(()=>validateBank({schemaVersion:1,entries:[{...first,choices:['x','x','a','b'],answer:'x'}]},q));
 const bank={schemaVersion:1,entries:[{...first,status:'draft'}]};assert.equal(selectSession(first.game,q,{bank}).questions.length,0);
 const old=buildPool(first.game,q,{bank:{schemaVersion:1,entries:[first]}})[0];const edited={...first,id:'renamed',prompt:'صياغة جديدة للسؤال نفسه'};const later=selectSession(first.game,q,{bank:{schemaVersion:1,entries:[edited]},seen:[old.id]});assert.equal(later.questions.length,0);
});
