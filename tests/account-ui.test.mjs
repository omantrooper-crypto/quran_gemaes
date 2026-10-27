import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defaultBank} from '../src/questions.mjs';
import {initialAccount,accountKey,validAvatar} from '../src/account.mjs';
const q=JSON.parse(fs.readFileSync(new URL('../public/data/quran.json',import.meta.url)));
const tick=()=>new Promise(r=>setTimeout(r,50));
const result=await build({entryPoints:[fileURLToPath(new URL('../src/main.jsx',import.meta.url))],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'import.meta.env':JSON.stringify({BASE_URL:'/'}),'process.env.NODE_ENV':'"production"'},plugins:[{name:'account-adapter',setup(b){b.onResolve({filter:/\/cloud\.js$/},args=>args.importer.includes('node_modules')?undefined:({path:'cloud',namespace:'account-mock'}));b.onLoad({filter:/.*/,namespace:'account-mock'},()=>({loader:'js',contents:`
export const configured=true;
export const watchAuth=cb=>{window.switchUser=cb;cb(window.testUser);return ()=>{};};
export const login=async()=>{};export const register=async()=>{};export const resetPassword=async()=>{};
export const logout=async()=>{window.testUser=null;window.switchUser(null);};
export const authMessage=e=>e.message;
export const verificationStatus=()=>({});
export const sendVerification=async()=>{throw Error('تعذر إرسال البريد. أعد المحاولة.');};
export const correctEmail=async()=>{};
export const refreshVerification=async()=>{if(window.testVerified){window.testUser={...window.testUser,emailVerified:true};window.switchUser(window.testUser);return true;}return false;};
export const publicBank=async()=>window.testBank;
export async function api(action,payload){window.apiCalls.push({action,payload});if(action==='profile.get')return {alias:window.testUser.displayName};if(action==='capabilities')return {contentEditor:false};if(action==='competition.list')return {competitions:[]};if(action==='profile.save')return {ok:true};throw Error('Unexpected '+action);}
`}));}}]});
async function mount(user,seed={}){const dom=new JSDOM('<html dir="rtl"><body><div id="root"></div></body></html>',{url:'https://qurangames.test',runScripts:'outside-only',pretendToBeVisual:true});Object.assign(dom.window,{TextEncoder,__QURAN_DATA__:q,testUser:user,testBank:defaultBank,apiCalls:[],scrollTo(){}});for(const [k,v] of Object.entries(seed))dom.window.localStorage.setItem(k,JSON.stringify(v));dom.window.eval(result.outputFiles[0].text);await tick();await tick();return dom;}
async function click(dom,text){const b=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&!b.disabled);assert.ok(b,text);b.click();await tick();}
const text=dom=>dom.window.document.body.textContent;
test('unverified member stays at verification, handles resend failure, then enters only after refresh',async()=>{
 const dom=await mount({uid:'a',email:'test@example.test',displayName:'عضو',emailVerified:false});try{
 assert.match(text(dom),/خطوة أخيرة/);assert.equal(dom.window.apiCalls.length,0);assert.equal(dom.window.document.querySelector('.sidebar'),null);
 await click(dom,'إعادة إرسال رسالة التفعيل');assert.match(text(dom),/تعذر إرسال البريد/);
 await click(dom,'تحقّق من التفعيل');assert.match(text(dom),/لم يتأكد البريد بعد/);assert.equal(dom.window.apiCalls.length,0);
 dom.window.testVerified=true;await click(dom,'تحقّق من التفعيل');await tick();assert.ok(dom.window.document.querySelector('.sidebar'));assert.ok(dom.window.apiCalls.some(x=>x.action==='profile.get'));
 }finally{dom.window.close();}
});
test('member UI hides diagnostics and admin tools, isolates account history, and denies guest school access',async()=>{
 const first={uid:'a',emailVerified:true,displayName:'الأول',email:'a@example.test'},second={uid:'b',emailVerified:true,displayName:'الثاني',email:'b@example.test'};
 const dom=await mount(first,{[accountKey('a')]:{...initialAccount,name:'الأول',sessions:[{id:'private-session',gameId:'key',correct:5,total:5,at:new Date().toISOString()}]},[accountKey('b')]:{...initialAccount,name:'الثاني'}});
 try{await click(dom,'الإعدادات والمصادر');assert.doesNotMatch(text(dom),/Firebase|Vercel|#174C46|استعادة نسخة|ألوان المنصة|نسخة أولى للتجربة/);assert.doesNotMatch(text(dom),/إدارة المحتوى/);
 await click(dom,'رحلة إتقانك');assert.equal(dom.window.document.querySelectorAll('.history>div').length,1);
 dom.window.testUser=second;dom.window.switchUser(second);await tick();await tick();assert.match(text(dom),/الثاني/);assert.equal(dom.window.document.querySelectorAll('.history>div').length,0);assert.equal(JSON.parse(dom.window.localStorage.getItem(accountKey('a'))).sessions.length,1);
 await click(dom,'الإعدادات والمصادر');await click(dom,'تسجيل الخروج');await click(dom,'ميدان الحفّاظ');assert.match(text(dom),/ميدان الحفّاظ لأعضاء المنصة/);assert.doesNotMatch(text(dom),/مسابقة جديدة|الأول|الثاني/);
 }finally{dom.window.close();}
});
test('avatar validator rejects remote URLs, SVG, wrong signatures and oversized values',()=>{
 const valid='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZFEAAAAASUVORK5CYII=';
 assert.equal(validAvatar(valid),true);for(const s of ['https://example.test/photo.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,aGVsbG8=',valid+'a'.repeat(90000)])assert.equal(validAvatar(s),false);
});
