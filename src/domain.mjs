export const uid = () => globalThis.crypto.randomUUID();
export const ar = n => new Intl.NumberFormat('ar').format(n);
export const clean = s => String(s).normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06EDـ]/g,'').replace(/[أإآٱ]/g,'ا').trim();
export function shuffle(a, rng=Math.random) { a=[...a]; for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export const chapter = (q,id) => q.find(s=>s.id===Number(id));
export const verse = (q,s,a) => chapter(q,s)?.verses.find(v=>v.id===Number(a))?.text || '';
export const refLabel = (q,s,a) => `${chapter(q,s)?.name || s} · ${ar(a)}`;
export function bounds(q,level) {
  const start=chapter(q,level.startSurah), end=chapter(q,level.endSurah);
  if(!start || !end || !Number.isInteger(+level.startAyah) || !Number.isInteger(+level.endAyah) || level.startAyah<1 || level.startAyah>start.verses.length || level.endAyah<1 || level.endAyah>end.verses.length || +level.startSurah>+level.endSurah || (+level.startSurah===+level.endSurah && +level.startAyah>+level.endAyah)) throw Error('راجع بداية نطاق الحفظ ونهايته.');
  if(!Number.isInteger(+level.count)||+level.count<1||+level.count>10||!Number.isInteger(+level.length)||+level.length<1||+level.length>20) throw Error('عدد الأسئلة من ١ إلى ١٠، وطول المقطع من ١ إلى ٢٠ آية.');
  return q.filter(s=>s.id>=level.startSurah&&s.id<=level.endSurah).map(s=>({s:s.id,from:s.id===+level.startSurah?+level.startAyah:1,to:s.id===+level.endSurah?+level.endAyah:s.verses.length}));
}
export function generatePassages(q,level,rng=Math.random) {
  const candidates=[];
  // Partition each chapter into non-overlapping windows, with a random offset
  // inside its slack. This guarantees sufficient capacity is never lost by a
  // greedy draw that happens to select a blocking interval.
  for(const r of bounds(q,level)) {
    const length=Number(level.length),available=r.to-r.from+1;
    const capacity=Math.floor(available/length);
    const offset=capacity?Math.floor(rng()*(available-capacity*length+1)):0;
    for(let i=0;i<capacity;i++){const from=r.from+offset+i*length;candidates.push({s:r.s,from,to:from+length-1});}
  }
  const chosen=shuffle(candidates,rng).slice(0,Number(level.count));
  if(chosen.length<+level.count) throw Error('النطاق لا يكفي لهذا العدد من المقاطع دون تداخل. وسّع النطاق أو قلّل طول المقطع أو عدد الأسئلة.');
  return chosen.sort((a,b)=>a.s-b.s||a.from-b.from);
}
export const defaultRubric = [{key:'memory',label:'الحفظ والضبط',max:70},{key:'tajwid',label:'التجويد وحسن الأداء',max:20},{key:'waqf',label:'الوقف والابتداء',max:10}];
export function scoreTotal(values,rubric=defaultRubric) {
  if(!Array.isArray(rubric)||rubric.length!==3||rubric.reduce((a,r)=>a+Number(r.max),0)!==100) throw Error('يجب أن يكون مجموع الأوزان ١٠٠.');
  return rubric.reduce((total,r)=>{const n=Number(values[r.key]);if(values[r.key]===''||values[r.key]==null||!Number.isFinite(n)||n<0||n>r.max)throw Error(`درجة ${r.label} يجب أن تكون بين ٠ و${r.max}.`);return total+n;},0);
}
export function resultsFor(c) {
  const rows=c.participants.map(p=>{
    const sheets=(c.scores||[]).filter(s=>s.participantId===p.id&&s.final);
    const complete=(c.judges||[]).length>0&&(c.judges||[]).every(j=>sheets.some(s=>s.judgeId===j.id));
    const total=sheets.length?Math.round(sheets.reduce((n,s)=>n+scoreTotal(s.values,c.rubric),0)/sheets.length*100)/100:null;
    return {...p,total,complete,judged:sheets.length};
  }).sort((a,b)=>Number(b.complete)-Number(a.complete)||(b.total??-1)-(a.total??-1)||a.name.localeCompare(b.name,'ar'));
  const levels=new Map();
  return rows.map(p=>{if(!p.complete)return {...p,rank:null};const group=levels.get(p.levelId)||{position:0,rank:0,prev:null};group.position++;if(p.total!==group.prev)group.rank=group.position;group.prev=p.total;levels.set(p.levelId,group);return {...p,rank:group.rank};});
}
export function csv(rows) {const safe=v=>{v=String(v??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};return '\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n');}
export function parseCSV(text) {
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('ملف CSV يحتوي على علامة اقتباس غير مغلقة.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows.map(r=>r.map(x=>x.replace(/^\ufeff/,'').trim()));
}
export const defaultLevel = {id:'amma',name:'جزء عمّ',startSurah:78,startAyah:1,endSurah:114,endAyah:6,count:3,length:3};
export function newCompetition(name,date,school,judge={id:'local-judge',name:'المحكّم التجريبي'}) {
 return {id:uid(),name,date,school,version:0,status:'draft',levels:[{...defaultLevel}],participants:[],judges:[judge],rubric:defaultRubric.map(x=>({...x})),scores:[],audit:[],published:false};
}
export function validateCompetition(c,q) {
 if(!c || typeof c.name!=='string'||!c.name.trim()||c.name.length>120||typeof c.school!=='string'||c.school.length>120)throw Error('بيانات المسابقة غير صالحة.');
 if(!Array.isArray(c.levels)||!c.levels.length||c.levels.length>20||!Array.isArray(c.participants)||c.participants.length>100||!Array.isArray(c.judges)||!c.judges.length||c.judges.length>10)throw Error('حد النسخة الأولى: ١٠٠ متسابق، ٢٠ مستوى و١٠ محكّمين للمسابقة.');
 const unique=arr=>new Set(arr.map(x=>x.id)).size===arr.length;
 if(!unique(c.levels)||!unique(c.participants)||!unique(c.judges))throw Error('تكرار في معرّفات السجلات.');
 for(const l of c.levels)bounds(q,l);
 if(c.participants.some(p=>!p.name?.trim()||p.name.length>100||!c.levels.some(l=>l.id===p.levelId)))throw Error('راجع أسماء المتسابقين ومستوياتهم.');
 scoreTotal(Object.fromEntries(c.rubric.map(r=>[r.key,0])),c.rubric);
 return true;
}
