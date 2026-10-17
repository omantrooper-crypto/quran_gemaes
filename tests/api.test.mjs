import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs';
import {newCompetition,uid,generatePassages} from '../src/domain.mjs';
const q=JSON.parse(fs.readFileSync(new URL('../public/data/quran.json',import.meta.url)));
const documents=new Map();
const clone=x=>x===undefined?undefined:structuredClone(x);
const snapshot=path=>({exists:documents.has(path),data:()=>clone(documents.get(path))});
const set=(ref,data,options)=>documents.set(ref.path,options?.merge?{...documents.get(ref.path),...clone(data)}:clone(data));
let transactionQueue=Promise.resolve();
const db={doc:path=>({path,get:async()=>snapshot(path),set:async(data,options)=>set({path},data,options)}),runTransaction:fn=>{const next=transactionQueue.then(()=>fn({get:async ref=>snapshot(ref.path),set,create:set,update:(ref,data)=>set(ref,data,{merge:true})}));transactionQueue=next.catch(()=>{});return next;}};
const users={owner:{uid:'owner',name:'المنظّم',email_verified:true},judge1:{uid:'judge1',name:'الاسم في الحساب',email_verified:true},judge2:{uid:'judge2',name:'المحكّم الثاني',email_verified:true},outsider:{uid:'outsider',email_verified:true},unverified:{uid:'unverified',email_verified:false}};
globalThis.__testDB=db;globalThis.__testUsers=users;
const file=new URL('./.api-test-bundle.mjs',import.meta.url).pathname;
await build({entryPoints:[new URL('../api/app.js',import.meta.url).pathname],outfile:file,bundle:true,platform:'node',format:'esm',plugins:[{name:'firebase-test-adapter',setup(b){b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'firebase-mock'}));b.onLoad({filter:/.*/,namespace:'firebase-mock'},args=>({contents:args.path.endsWith('/app')?'export const getApps=()=>[{}]; export const initializeApp=()=>({}); export const cert=x=>x;':args.path.endsWith('/auth')?'export const getAuth=()=>({verifyIdToken:async t=>{if(!globalThis.__testUsers[t])throw Error("bad token");return globalThis.__testUsers[t];}});':'export const getFirestore=()=>globalThis.__testDB;',loader:'js'}));}}]});
const {default:handler}=await import(file);
const {defaultBank}=await import('../src/questions.mjs');
process.env.FIREBASE_PROJECT_ID='unit-test';process.env.FIREBASE_CLIENT_EMAIL='test@example.test';process.env.FIREBASE_PRIVATE_KEY='mock';
async function request(user,body){let code=200,payload;const res={setHeader(){},status(n){code=n;return this;},json(x){payload=x;return this;}};await handler({method:'POST',headers:{authorization:`Bearer ${user}`},body},res);return {status:code,...payload};}
test('API enforces school ownership, independent judge access, signed name and immutable final score',async()=>{
 const c=newCompetition('مسابقة','2026-10-16','مدرسة',{id:'judge1',name:'المحكّم الأول المعتمد'});c.judges.push({id:'judge2',name:'المحكّم الثاني'});c.participants.push({id:uid(),name:'متسابق',classroom:'سابع',levelId:c.levels[0].id,approved:true,passages:generatePassages(q,c.levels[0]),status:'waiting'});
 let r=await request('owner',{action:'competition.save',competition:c,version:0});assert.equal(r.status,200);let saved=r.competition;
 assert.equal((await request('outsider',{action:'competition.get',id:c.id})).status,403);
 assert.equal((await request('judge1',{action:'competition.save',competition:saved,version:saved.version})).status,403);
 const participantId=c.participants[0].id;
 r=await request('judge1',{action:'competition.judge',id:c.id,version:saved.version,participantId,values:{memory:60,tajwid:19,waqf:9},total:99999,judgeName:'forged',final:true});assert.equal(r.status,200);assert.equal(r.competition.scores[0].total,88);assert.equal(r.competition.scores[0].judgeName,'المحكّم الأول المعتمد');saved=r.competition;
 const other=await request('judge2',{action:'competition.get',id:c.id});assert.equal(other.competition.scores.length,0);
 assert.equal((await request('judge1',{action:'competition.judge',id:c.id,version:saved.version,participantId,values:{memory:70,tajwid:20,waqf:10},final:false})).status,400);
 assert.equal((await request('owner',{action:'competition.publish',id:c.id,version:saved.version})).status,400);
 r=await request('judge2',{action:'competition.judge',id:c.id,version:saved.version,participantId,values:{memory:70,tajwid:20,waqf:10},final:true});assert.equal(r.status,200);
 r=await request('owner',{action:'competition.publish',id:c.id,version:r.competition.version});assert.equal(r.status,200);assert.equal(r.competition.published,true);
 assert.equal((await request('owner',{action:'competition.save',competition:{...c,scores:[]},version:1})).status,409);
});
test('daily answer keys never reach clients; replay cannot award points twice; verified email required',async()=>{
 assert.equal((await request('unverified',{action:'daily.start'})).status,403);
 const start=await request('owner',{action:'daily.start'});assert.equal(start.status,200);assert.equal(start.questions.length,5);assert.ok(start.questions.every(x=>!('answer' in x)));
 const attempt=[...documents.entries()].find(([k])=>k.startsWith('dailyAttempts/'))[1];const answers=attempt.questions.map(x=>x.answer);
 const result=await request('owner',{action:'daily.submit',answers,score:999999});assert.equal(result.score,500);assert.equal(documents.get('profiles/owner').points,500);
 const again=await request('owner',{action:'daily.submit',answers});assert.equal(again.already,true);assert.equal(documents.get('profiles/owner').points,500);
});
test.after(()=>{fs.unlinkSync(file);delete globalThis.__testDB;delete globalThis.__testUsers;});

test('training reserves unseen questions across reloads, simultaneous starts, scopes, modes and retries',async()=>{
 const args={action:'training.start',gameId:'key',scope:'all',difficulty:'متوسط'};
 const [a,b]=await Promise.all([request('owner',{...args,requestId:'session-a'}),request('owner',{...args,requestId:'session-b'})]);
 assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.questions.length,5);assert.ok(b.tokens.every(t=>!a.tokens.includes(t)));
 const again=await request('owner',{...args,requestId:'session-a'});assert.deepEqual(again.questions,a.questions);
 const other=await request('judge1',{...args,requestId:'session-a'});assert.equal(other.questions.length,5);
 const earlier=[...a.tokens,...b.tokens];const narrow=await request('owner',{...args,scope:'short',difficulty:'متقدم',requestId:'session-c'});assert.ok(narrow.tokens.every(t=>!earlier.includes(t)));
 const next=await request('owner',{...args,gameId:'next',requestId:'session-next'});const daily=[...documents.entries()].find(([k])=>k.startsWith('dailyAttempts/owner_'))[1];assert.ok(next.tokens.every(t=>!daily.questions.some(q=>q.qid===t)));
 assert.equal((await request('outsider',{...args,gameId:'bad',requestId:'invalid'})).status,400);
});
test('only verified content editors publish, version conflicts prevent overwrite, drafts stay private',async()=>{
 process.env.CONTENT_EDITOR_UIDS='owner,unverified';
 assert.equal((await request('outsider',{action:'content.get'})).status,403);
 assert.equal((await request('unverified',{action:'content.get'})).status,403);
 assert.equal((await request('owner',{action:'capabilities'})).contentEditor,true);
 const loaded=await request('owner',{action:'content.get'});assert.equal(loaded.version,0);
 const bank=structuredClone(defaultBank);bank.entries[0].status='draft';
 const saved=await request('owner',{action:'content.save',bank,version:0});assert.equal(saved.status,200);assert.equal(saved.version,1);
 const publicResult=await request('outsider',{action:'content.public'});assert.ok(!publicResult.bank.entries.some(x=>x.id===bank.entries[0].id));
 assert.equal((await request('owner',{action:'content.save',bank,version:0})).status,409);
 assert.equal((await request('outsider',{action:'content.save',bank,version:1})).status,403);
 const invalid=structuredClone(bank);invalid.entries[0].ayah=10000;assert.equal((await request('owner',{action:'content.save',bank:invalid,version:1})).status,400);
 documents.delete('content/editorial');delete process.env.CONTENT_EDITOR_UIDS;
});
