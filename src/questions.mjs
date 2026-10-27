import {shuffle,verse,chapter,refLabel,clean} from './domain.mjs';
import defaultBank from './data/editorial-bank.json' with {type:'json'};
export {defaultBank};
export const scopes=[['all','القرآن كاملًا'],['amma','جزء عمّ'],['short','قصار السور (١٠٠–١١٤)']];
const cite=(q,s,a)=>({label:refLabel(q,s,a),url:`https://quranenc.com/ar/browse/arabic_moyassar/${s}#${a}`});
const norm=s=>clean(s).replace(/[^\u0621-\u064a\s]/g,'').replace(/\s+/g,' ').trim();
const wc=s=>s.trim().split(/\s+/).length;
const choice=(prompt,choices,answer,extra={})=>({type:'choice',prompt,choices:shuffle([...new Set(choices)]),answer,...extra});
const cache=new WeakMap();
const labelRules=['قلقلة في حرف ساكن','غنة النون المشددة','غنة الميم المشددة','لام شمسية','لام قمرية'];
const comparable=x=>norm(x)||String(x).trim();
const pickOptions=(answer,items)=>[answer,...shuffle([...new Map(items.filter(x=>comparable(x)!==comparable(answer)).map(x=>[comparable(x),x])).values()]).slice(0,3)];
export function questionKey(x){return x.qid||['legacy',x.type,x.prompt,x.text||'',JSON.stringify(x.answer||x.pairs||x.words||'')].join('|');}
export const questionTokens=x=>x.tokens||[questionKey(x)];
function corpusIndex(q){
 if(cache.has(q))return cache.get(q);
 const all=q.flatMap(s=>s.verses.map(v=>({s:s.id,a:v.id,text:v.text,ref:`${s.id}:${v.id}`})));
 const frequency=new Map();for(const v of all){const t=norm(v.text);frequency.set(t,(frequency.get(t)||0)+1);}
 const unique=all.filter(v=>frequency.get(norm(v.text))===1);
 const words=new Map(),taj=new Map();
 for(const v of all){for(const w of v.text.split(/\s+/)){
  const n=norm(w);if(/^[\u0621-\u064a]{3,6}$/.test(n)&&!words.has(n))words.set(n,{...v,word:n});
  const found=[];
  if(/[قطبجد][ْۡ]/u.test(w))found.push(labelRules[0]);
  if(/ن[\u064b-\u0650\u0652-\u065f\u0670]*ّ/u.test(w))found.push(labelRules[1]);
  if(/م[\u064b-\u0650\u0652-\u065f\u0670]*ّ/u.test(w))found.push(labelRules[2]);
  // Only explicit article at the start; do not infer from the unvocalized text.
  if(/^[ٱا]ل[ْۡ][ءأإؤئابجحخعغفقكمهوىي]/u.test(w))found.push(labelRules[4]);
  if(!['الله','الذي','التي','اللذان','اللتان','اللذين','اللتين','اللاتي','اللاي'].includes(n)&&/^[ٱا]ل[تثدذرزسشصضطظلن][\u064b-\u0650\u0652-\u065f\u0670]*ّ/u.test(w))found.push(labelRules[3]);
  if(found.length===1&&!taj.has(`${n}:${found[0]}`))taj.set(`${n}:${found[0]}`,{...v,word:w,rule:found[0]});
 }}
 const index={all,unique,words:[...words.values()],taj:[...taj.values()],openings:q.map(s=>{let n=1,t=s.verses[0].text;while(n<Math.min(3,s.verses.length)&&q.some(o=>o.id!==s.id&&o.verses.slice(0,n).map(v=>v.text).join(' ۝ ')===t)){n++;t=s.verses.slice(0,n).map(v=>v.text).join(' ۝ ');}return {s:s.id,a:1,text:t};})};cache.set(q,index);return index;
}
const within=(s,scope)=>scope==='amma'?s>=78:scope==='short'?s>=100:true;
const suitable=(v,difficulty)=>difficulty==='مبتدئ'?wc(v.text||'')<=12:difficulty==='متوسط'?wc(v.text||'')<=35:true;
export function buildPool(id,q,{difficulty='متوسط',scope='all',bank=defaultBank}={}){
 const idx=corpusIndex(q),inScope=v=>within(v.s,scope),filter=v=>inScope(v)&&suitable(v,difficulty);
 if(['key','memory'].includes(id))return idx.openings.filter(inScope).map(v=>({...v,id:`${id}:${v.s}`,game:id}));
 if(id==='compass'||id==='links')return q.filter(s=>within(s.id,scope)).map(s=>({id:`${id}:${s.id}`,game:id,s:s.id,a:1}));
 if(id==='order'){const ss=q.filter(s=>within(s.id,scope));const out=[];for(let step=1;step<=Math.min(6,Math.floor((ss.length-1)/3));step++)for(let start=0;start+3*step<ss.length;start++){const ids=[0,1,2,3].map(i=>ss[start+i*step].id);out.push({id:`order:${ids.join('-')}`,game:id,ids,s:ids[0],a:1});}return out;}
 if(id==='next')return idx.all.filter(v=>filter(v)&&v.a<chapter(q,v.s).verses.length&&suitable({text:verse(q,v.s,v.a+1)},difficulty)).map(v=>({...v,id:`next:${v.ref}`,game:id}));
 if(id==='missing')return idx.unique.filter(v=>filter(v)&&wc(v.text)>=3).map(v=>({...v,id:`missing:${v.ref}`,game:id}));
 if(id==='search'||id==='similar')return idx.unique.filter(filter).map(v=>({...v,id:`${id}:${v.ref}`,game:id}));
 if(id==='grid')return idx.words.filter(inScope).map(v=>({...v,id:`grid:${v.word}`,game:id}));
 if(id==='tajwid'||id==='rules')return idx.taj.filter(inScope).map(v=>({...v,id:`${id}:${norm(v.word)}:${labelRules.indexOf(v.rule)}`,game:id}));
 if(['meaning','speaker','theme','story'].includes(id))return bank.entries.filter(x=>x.status==='published'&&x.game===id&&within(x.surah,scope)).map(x=>({...x,editorialId:x.id,s:x.surah,a:x.ayah,id:`editorial:${x.game}:${x.surah}:${x.ayah}:${x.game==='meaning'?norm(x.term||x.prompt):x.game==='story'?x.events.map(e=>e.ayah).join('-'):''}`}));
 if(id==='gates')return ['key','next','rules','meaning','speaker','theme','similar'].flatMap(g=>buildPool(g,q,{difficulty,scope,bank}));
 if(id==='mastery')return buildPool('next',q,{difficulty,scope,bank});
 return [];
}
function renderItem(x,q){
 const src=cite(q,x.s,x.a),base={qid:x.id,tokens:[x.id],source:src},s=chapter(q,x.s),idx=corpusIndex(q),id=x.game;
 const otherNames=q.filter(c=>c.id!==s.id).map(c=>c.name);
 if(x.editorialId){
  if(id==='story'){const answer=x.events.map(e=>e.text);return {...base,type:'order',prompt:x.prompt,items:shuffle(answer),answer,explanation:x.events.map(e=>`${e.text} (${refLabel(q,s.id,e.ayah)})`).join('؛ ')};}
  return {...choice(x.prompt,x.choices,x.answer,{text:verse(q,x.s,x.a),explanation:x.explanation||'راجع الآية وسياقها في المرجع المرفق.'}),...base};
 }
 if(id==='key')return {...choice('أيّ سورة تبدأ بهذا المقطع؟',pickOptions(s.name,otherNames),s.name,{text:x.text,hint:`عدد آياتها ${s.verses.length}، وترتيبها ${s.id} في المصحف.`}),...base};
 if(id==='compass')return {...choice(`ما ترتيب سورة ${s.name} في المصحف؟`,pickOptions(String(s.id),q.map(s=>String(s.id))),String(s.id)),...base};
 if(id==='next'){const answer=verse(q,x.s,x.a+1);return {...choice(`ما الآية التالية في سورة ${s.name} بعد الآية ${x.a}؟`,pickOptions(answer,idx.all.filter(v=>v.s===x.s&&v.a!==x.a+1).map(v=>v.text).concat(idx.openings.map(v=>v.text))),answer,{text:x.text,quranOptions:true}),...base};}
 if(id==='missing'){const answer=x.text.trim().split(/\s+/).at(-1);return {...choice('ما الكلمة الأخيرة في الآية التي قرأتها؟',pickOptions(answer,idx.openings.map(v=>v.text.split(/\s+/).at(-1))),answer,{text:x.text,quranOptions:true}),...base,type:'recall'};}
 if(id==='similar')return {...choice('إلى أيّ سورة تنتمي هذه الآية؟',pickOptions(s.name,otherNames),s.name,{text:x.text}),...base};
 if(id==='search')return {...base,type:'search',prompt:'ابحث في المصحف عن هذه العبارة ثم اختر موضعها.',text:x.text,answer:`${x.s}:${x.a}`};
 if(id==='order'){const answer=x.ids.map(n=>chapter(q,n).name);return {...base,type:'order',prompt:'رتّب السور حسب ترتيب المصحف، من الأعلى إلى الأسفل.',items:shuffle(answer),answer,explanation:answer.join(' ← ')};}
 if(id==='rules')return {...choice('ما الحكم الموضّح في هذه الكلمة عند وصل القراءة؟',pickOptions(x.rule,labelRules),x.rule,{text:x.word,explanation:`الشاهد من ${src.label}. الحكم المستهدف: ${x.rule}.`}),...base};
 if(id==='tajwid'){const others=idx.taj.filter(v=>v.rule!==x.rule&&norm(v.word)!==norm(x.word)).map(v=>v.word);return {...choice(`اختر الكلمة التي فيها: ${x.rule}، عند الوصل.`,pickOptions(x.word,others),x.word,{quranOptions:true,explanation:`الموضع الصحيح في ${src.label}.`}),...base};}
 throw Error('نوع السؤال غير مدعوم.');
}
function renderGroup(items,q,id){
 const base={qid:`${id}:group:${items.map(x=>x.id).sort().join('|')}`,tokens:items.map(x=>x.id),source:cite(q,items[0].s,items[0].a)};
 if(id==='grid'){const letters='ابتثجحخدذرزسشصضطظعغفقكلمنهوي',grid=Array.from({length:6},()=>Array.from({length:6},()=>letters[Math.floor(Math.random()*letters.length)]));const rows=shuffle([0,1,2,3,4,5]);items.forEach((x,i)=>{const start=Math.floor(Math.random()*(7-x.word.length));[...x.word].forEach((l,c)=>grid[rows[i]][start+c]=l);});return {...base,type:'grid',prompt:'ابحث عن الكلمات القرآنية. اضغط أول حرف ثم آخر حرف أفقيًا.',words:items.map(x=>x.word),grid};}
 return {...base,type:id==='memory'?'memory':'match',prompt:id==='memory'?'طابق السورة مع المقطع الذي تبدأ به.':'صِل اسم السورة بترتيبها في المصحف.',pairs:items.map(x=>[chapter(q,x.s).name,id==='memory'?x.text:String(x.s)])};
}
export function selectSession(id,q,{difficulty='متوسط',scope='all',bank=defaultBank,seen=[],count}={}){
 const seenSet=new Set(seen),pool=buildPool(id,q,{difficulty,scope,bank}),available=pool.filter(x=>!seenSet.has(x.id));
 const grouped=['memory','links','grid'].includes(id),size=id==='grid'?3:4;
 const take=count||(grouped||['order','story','search'].includes(id)?1:difficulty==='مبتدئ'?3:difficulty==='متقدم'?7:5);
 if(grouped&&available.length<2)return {questions:[],remaining:available.length,total:pool.length,exhausted:true,tokens:[]};
 const picks=shuffle(available).slice(0,grouped?size:take),questions=grouped&&picks.length?[renderGroup(picks,q,id)]:picks.map(x=>renderItem(x,q));
 return {questions,tokens:questions.flatMap(questionTokens),remaining:available.length-picks.length,total:pool.length,exhausted:questions.length===0};
}
export function questionFor(id,q,difficulty='متوسط'){return selectSession(id,q,{difficulty,count:1}).questions[0];}
export function makeSession(id,q,difficulty='متوسط',mistakes=[]){if(id==='mastery'&&mistakes.length)return shuffle(mistakes).slice(0,5);return selectSession(id,q,{difficulty}).questions;}
export function bankStats(q,options={}){return Object.fromEntries(['key','memory','order','missing','meaning','grid','speaker','story','next','compass','tajwid','rules','similar','theme','search','links'].map(id=>[id,buildPool(id,q,options).length]));}
export function checkAnswer(question,value){return Array.isArray(question.answer)?JSON.stringify(question.answer)===JSON.stringify(value):question.answer===value;}
