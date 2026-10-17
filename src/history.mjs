import {selectSession,questionTokens} from './questions.mjs';
export const HISTORY_KEY='qurangames.seen.v2';
export function readHistory(storage=globalThis.localStorage){const raw=storage.getItem(HISTORY_KEY);if(!raw)return [];const data=JSON.parse(raw);if(!Array.isArray(data)||data.some(x=>typeof x!=='string'))throw Error('تعذرت قراءة سجل الأسئلة. استعد النسخة الاحتياطية قبل المتابعة.');return data;}
export async function reserveLocal(id,q,options={},storage=globalThis.localStorage){
 const reserve=()=>{const seen=readHistory(storage),result=selectSession(id,q,{...options,seen});const merged=[...new Set([...seen,...result.tokens])];storage.setItem(HISTORY_KEY,JSON.stringify(merged));if(storage.getItem(HISTORY_KEY)!==JSON.stringify(merged))throw Error('لم يُحفظ سجل الأسئلة؛ لن تبدأ الجلسة حتى يعمل الحفظ.');return result;};
 if(globalThis.navigator?.locks)return navigator.locks.request('qurangames-question-reservation',reserve);
 return reserve();
}
export function reviewSession(mistakes,gameId){const list=mistakes.filter(x=>gameId==='mastery'||questionTokens(x).some(t=>t.startsWith(`${gameId}:`)||t.startsWith(`editorial:${gameId}:`)));return [...new Map(list.map(x=>[x.qid||JSON.stringify(x),x])).values()].slice(0,7);}
