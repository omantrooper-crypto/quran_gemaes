import {clean,verse} from './domain.mjs';
export const editorialGames=['meaning','speaker','theme','story'];
export function validateBank(bank,q){
 if(!bank||bank.schemaVersion!==1||!Array.isArray(bank.entries)||bank.entries.length>1000)throw Error('صيغة البنك غير صالحة؛ الحد ١٠٠٠ سؤال تحريري.');
 const ids=new Set(),semantic=new Set();
 for(const x of bank.entries){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(x.id)||ids.has(x.id))throw Error('معرّف سؤال مكرر أو غير صالح.');ids.add(x.id);
  if(!editorialGames.includes(x.game)||!['draft','published'].includes(x.status)||!Number.isInteger(x.surah)||!Number.isInteger(x.ayah)||!verse(q,x.surah,x.ayah))throw Error('راجع نوع السؤال وحالته ومرجعه القرآني.');
  if(typeof x.prompt!=='string'||!x.prompt.trim()||x.prompt.length>400)throw Error('اكتب نص سؤال واضحًا لا يتجاوز ٤٠٠ حرف.');
  if(x.game==='story'){
   if(!Array.isArray(x.events)||x.events.length<3||x.events.length>6||x.events.some((e,i)=>!Number.isInteger(e.ayah)||!verse(q,x.surah,e.ayah)||!e.text?.trim()||e.text.length>150||(i&&e.ayah<=x.events[i-1].ayah))||new Set(x.events.map(e=>e.text)).size!==x.events.length)throw Error('رتّب أحداث القصة مع مراجع آيات صحيحة ومتزايدة.');
  }else if(!Array.isArray(x.choices)||x.choices.length!==4||x.choices.some(c=>typeof c!=='string'||!c.trim()||c.length>220)||new Set(x.choices.map(clean)).size!==4||!x.choices.includes(x.answer))throw Error('يلزم أربعة خيارات مختلفة وإجابة منها.');
  if(x.explanation!=null&&(typeof x.explanation!=='string'||x.explanation.length>1000))throw Error('الشرح لا يتجاوز ١٠٠٠ حرف.');
  const signature=[x.game,x.surah,x.ayah,x.game==='meaning'?clean(x.term||x.prompt):x.game==='story'?x.events.map(e=>e.ayah).join(','):''].join(':');
  if(semantic.has(signature))throw Error('يوجد سؤال مكرر في المحتوى نفسه ولو اختلف معرّفه.');semantic.add(signature);
 }
 if(new TextEncoder().encode(JSON.stringify(bank)).length>400000)throw Error('تجاوز البنك حجم النسخة المسموح: ٤٠٠ كيلوبايت.');
 return true;
}
export function mergeBanks(base,extra){const map=new Map(base.entries.map(x=>[x.id,x]));for(const x of extra?.entries||[])map.set(x.id,x);return {...base,entries:[...map.values()]};}
