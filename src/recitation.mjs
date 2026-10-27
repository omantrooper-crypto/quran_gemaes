// These are editorial proposals informed by tafsir, not a scholar's certification.
// Automatic selection never invents a start/end outside this bank.
export const tafsirLink=(s,a)=>`https://quran.ksu.edu.sa/tafseer/saadi/sura${s}-aya${a}.html`;
export const passageBank=[
 [2,1,5,'افتتاح السورة وصفات المتقين إلى بيان فلاحهم.'],
 [2,6,7,'وصف الذين كفروا مع تمام بيان حالهم وعاقبتهم.'],
 [2,8,20,'وصف المنافقين مع إبقاء المثلين وخاتمتهما في موضع واحد.'],
 [2,21,25,'الدعوة إلى العبادة ودليلها والتحذير والبشارة دون فصلها.'],
 [2,255,255,'آية الكرسي كاملة، لا يُقتطع منها جزء.'],
 [2,284,286,'خواتيم السورة: الملك والمحاسبة والإيمان والدعاء.'],
 [3,190,200,'التفكر ودعاء أولي الألباب وجوابهم إلى ختام السورة.'],
 [18,1,8,'افتتاح الكهف والتنبيه إلى حقيقة زينة الدنيا وزوالها.'],
 [18,9,26,'قصة أصحاب الكهف إلى ختام الحديث عن مدة لبثهم.'],
 [18,32,44,'مثل صاحبي الجنتين كاملًا إلى خاتمته.'],
 [31,12,19,'تقديم لقمان ووصاياه إلى ختام آداب السلوك.'],
].map(([s,from,to,reason])=>({s,from,to,reason,origin:'reference',sourceUrl:tafsirLink(s,from),endSourceUrl:tafsirLink(s,to),policyVersion:1}));
// A conservative product rule, not a scholarly definition of short surahs.
export const wholeSurahRequired=s=>s.id===1||s.id>=78||s.verses.length<=30;
export function recitationCandidates(q,ranges){
 const result=[];
 for(const r of ranges){const s=q.find(s=>s.id===r.s);if(wholeSurahRequired(s)){
  if(r.from===1&&r.to===s.verses.length)result.push({s:s.id,from:1,to:s.verses.length,origin:'whole-surah',reason:'السورة كاملة من أولها إلى آخرها.',sourceUrl:tafsirLink(s.id,1),policyVersion:1});
 }else result.push(...passageBank.filter(p=>p.s===r.s&&p.from>=r.from&&p.to<=r.to).map(p=>({...p})));}
 return result;
}
export function validateRecitation(q,l,p){
 const s=q.find(s=>s.id===p.s);
 if(!s||!Number.isInteger(p.from)||!Number.isInteger(p.to)||p.from<1||p.to<p.from||p.to>s.verses.length||p.s<+l.startSurah||p.s>+l.endSurah||(p.s===+l.startSurah&&p.from<+l.startAyah)||(p.s===+l.endSurah&&p.to>+l.endAyah))throw Error('الموضع خارج نطاق الحفظ.');
 if(wholeSurahRequired(s)&&(p.from!==1||p.to!==s.verses.length))throw Error('لا تُجزّأ هذه السورة. وسّع النطاق ليشملها كاملة أو اختر سورة أخرى.');
 if(p.origin==='whole-surah'&&p.from===1&&p.to===s.verses.length)return true;
 if(p.origin==='reference'&&passageBank.some(x=>x.s===p.s&&x.from===p.from&&x.to===p.to))return true;
 if(p.origin==='manual'&&typeof p.reason==='string'&&p.reason.trim().length>=20&&p.reason.length<=1000&&typeof p.sourceUrl==='string'&&p.sourceUrl.length<=500){try{const url=new URL(p.sourceUrl);if(url.protocol==='https:'&&!url.username&&!url.password)return true;}catch{}}
 throw Error('الموضع يحتاج مرجعًا وبيان سبب الابتداء والوقف، أو إعادة سحبه من البنك.');
}
export const isWholePassage=(q,p)=>p.from===1&&p.to===q.find(s=>s.id===p.s)?.verses.length;
