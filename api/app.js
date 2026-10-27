import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {readFileSync} from 'node:fs';
import {randomInt} from 'node:crypto';
import {selectSession,defaultBank,questionTokens} from '../src/questions.mjs';
import {validateBank} from '../src/content.mjs';
import {validAvatar} from '../src/account.mjs';
import {validateRecitation} from '../src/recitation.mjs';
import {generatePassages,scoreTotal,validateCompetition,resultsFor} from '../src/domain.mjs';
const q=JSON.parse(readFileSync(new URL('../public/data/quran.json',import.meta.url),'utf8'));
const random=()=>randomInt(0,1000000)/1000000;
const allowed=new Set(['content.public','content.get','content.save','capabilities','training.start','profile.get','profile.save','ranking','daily.start','daily.submit','competition.list','competition.get','competition.save','competition.generate','competition.judge','competition.publish']);
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
const idValid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
function member(c,uid){return c.ownerId===uid||c.judges.some(j=>j.id===uid);}
function visible(c,uid){return c.ownerId===uid?c:{...c,scores:c.scores.filter(s=>s.judgeId===uid),audit:[],judges:c.judges.map(j=>({id:j.id,name:j.name}))};}
function assertOwner(c,uid){if(c.ownerId!==uid)fail('هذه العملية لمنظّم المسابقة فقط.',403);}
function checkPassages(c,previous){for(const p of c.participants){
 const old=previous?.participants.find(x=>x.id===p.id);if(old&&previous.scores.some(x=>x.participantId===p.id)&&JSON.stringify(old)===JSON.stringify(p))continue;
 const l=c.levels.find(l=>l.id===p.levelId);if(!p.passages){if(p.approved)fail('لا يمكن اعتماد متسابق بلا أسئلة.');continue;}
 if(!Array.isArray(p.passages)||p.passages.length!==Number(l.count))fail('عدد المواضع لا يطابق المستوى.');
 for(const x of p.passages){try{validateRecitation(q,l,x);}catch(e){fail(e.message);}}
 for(let i=0;i<p.passages.length;i++)for(let j=i+1;j<p.passages.length;j++){const a=p.passages[i],b=p.passages[j];if(a.s===b.s&&a.from<=b.to&&a.to>=b.from)fail('المواضع متداخلة.');}
}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!process.env.FIREBASE_PROJECT_ID||!process.env.FIREBASE_CLIENT_EMAIL||!process.env.FIREBASE_PRIVATE_KEY)fail('الربط بالخادم لم يكتمل بعد.',503);
  if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})});
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{fail('صيغة الطلب غير صالحة.');}
  if(!body||Buffer.byteLength(JSON.stringify(body))>500000)fail('حجم الطلب كبير.');
  const {action}=body;if(!allowed.has(action))fail('عملية غير معروفة.');
  const db=getFirestore(),contentRef=db.doc('content/editorial');
  if(action==='content.public'){const snap=await contentRef.get();const bank=snap.exists?snap.data().bank:defaultBank;return res.json({bank:{...bank,entries:bank.entries.filter(x=>x.status==='published')}});}
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)fail('سجّل الدخول أولًا.',401);
  let user;try{user=await getAuth().verifyIdToken(token,true);}catch{fail('انتهت الجلسة. أعد تسجيل الدخول.',401);}
  const uid=user.uid,profileRef=db.doc(`profiles/${uid}`);
  const admin=user.email_verified===true&&String(process.env.ADMIN_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(uid);
  const editor=admin||(user.email_verified===true&&String(process.env.CONTENT_EDITOR_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(uid));
  if(action==='capabilities')return res.json({admin,contentEditor:editor,emailVerified:user.email_verified===true});
  if(user.email_verified!==true)fail('أكّد بريدك الإلكتروني أولًا لاستخدام خدمات العضوية.',403);
  if(action==='content.get'||action==='content.save'){
   if(!editor)fail('تعديل المحتوى متاح لمحرري المنصة المعتمدين فقط.',403);
   if(action==='content.get'){const snap=await contentRef.get();return res.json(snap.exists?snap.data():{bank:defaultBank,version:0});}
   try{validateBank(body.bank,q);}catch(e){fail(e.message);}
   const saved=await db.runTransaction(async tx=>{const snap=await tx.get(contentRef),previous=snap.data();if(Number(body.version)!==(previous?.version||0))fail('عدّل محرر آخر البنك. حمّل النسخة الأحدث قبل الحفظ.',409);const next={bank:body.bank,version:(previous?.version||0)+1,updatedBy:uid,updatedAt:new Date().toISOString()};tx.set(contentRef,next);return next;});return res.json(saved);
  }
  if(action==='training.start'){
   const permitted=['key','memory','order','missing','meaning','grid','speaker','story','next','compass','tajwid','rules','similar','theme','search','links','gates','mastery'];
   if(!permitted.includes(body.gameId)||!['all','amma','short'].includes(body.scope)||!['مبتدئ','متوسط','متقدم'].includes(body.difficulty)||!idValid(body.requestId))fail('خيارات التدريب غير صالحة.');
   const families=body.gameId==='gates'?['key','next','rules','meaning','speaker','theme','similar']:body.gameId==='mastery'?['next']:[body.gameId];
   const refs=families.map(id=>db.doc(`trainingHistory/${uid}/games/${id}`));
   const sessionRef=db.doc(`trainingSessions/${uid}_${body.requestId}`);
   const result=await db.runTransaction(async tx=>{
    const [cached,content,...histories]=await Promise.all([tx.get(sessionRef),tx.get(contentRef),...refs.map(r=>tx.get(r))]);
    if(cached.exists)return cached.data().result;
    const seen=histories.flatMap(d=>d.data()?.seen||[]),bank=content.exists?content.data().bank:defaultBank;
    const result=selectSession(body.gameId,q,{difficulty:body.difficulty,scope:body.scope,bank,seen});
    refs.forEach((ref,i)=>{const family=families[i],tokens=result.tokens.filter(t=>t.startsWith(`${family}:`)||t.startsWith(`editorial:${family}:`));if(tokens.length)tx.set(ref,{seen:[...new Set([...(histories[i].data()?.seen||[]),...tokens])],updatedAt:Date.now()});});
    tx.set(sessionRef,{uid,result,createdAt:Date.now(),expiresAt:new Date(Date.now()+86400000)});return result;
   });return res.json(result);
  }
  if(action==='profile.get'){const d=(await profileRef.get()).data()||{};return res.json({alias:d.alias||user.name||'متسابق',rankOptIn:d.rankOptIn===true,points:d.points||0,avatar:validAvatar(d.avatar)?d.avatar:''});}
  if(action==='profile.save'){const alias=String(body.alias||'').trim();if(alias.length<2||alias.length>30)fail('الاسم الظاهر بين حرفين و٣٠ حرفًا.');if(body.avatar!==undefined&&!validAvatar(body.avatar))fail('الصورة غير صالحة أو أكبر من الحجم المسموح.');await profileRef.set({alias,rankOptIn:body.rankOptIn===true,...(body.avatar!==undefined?{avatar:body.avatar}:{})},{merge:true});return res.json({ok:true});}
  if(action==='ranking'){const snap=await db.collection('profiles').where('rankOptIn','==',true).orderBy('points','desc').limit(30).get();return res.json({rows:snap.docs.filter(d=>d.data().rankOptIn===true).slice(0,30).map(d=>({alias:d.data().alias||'متسابق',points:d.data().points||0}))});}
  if(action.startsWith('daily.')){
   if(!user.email_verified)fail('فعّل بريدك الإلكتروني للمشاركة في التحدي المصنّف.',403);
   const day=new Date().toISOString().slice(0,10),ref=db.doc(`dailyAttempts/${uid}_${day}`);
   if(action==='daily.start'){
    const historyRef=db.doc(`trainingHistory/${uid}/games/next`);
    const attempt=await db.runTransaction(async tx=>{const [snap,history]=await Promise.all([tx.get(ref),tx.get(historyRef)]);if(snap.exists)return snap.data();const seen=history.data()?.seen||[];const session=selectSession('next',q,{scope:'all',difficulty:'متقدم',seen,count:5});if(!session.questions.length)fail('أنجزت أسئلة التحدي اليومي المتاحة؛ انتظر تحديث البنك.',409);const questions=session.questions.map((x,i)=>({id:i,qid:x.qid,prompt:x.prompt,text:x.text,choices:x.choices,answer:x.answer}));const a={uid,day,startedAt:Date.now(),questions,submitted:false};tx.create(ref,a);tx.set(historyRef,{seen:[...new Set([...seen,...session.tokens])]});return a;});
    return res.json({day,submitted:attempt.submitted,score:attempt.score,questions:attempt.submitted?[]:attempt.questions.map(({answer,...x})=>x)});
   }
   const result=await db.runTransaction(async tx=>{const [a,p]=await Promise.all([tx.get(ref),tx.get(profileRef)]);if(!a.exists)fail('ابدأ التحدي أولًا.');const attempt=a.data();if(attempt.submitted)return {score:attempt.score,already:true};if(Date.now()-attempt.startedAt>30*60000)fail('انتهت مدة المحاولة (٣٠ دقيقة).');if(!Array.isArray(body.answers)||body.answers.length!==attempt.questions.length)fail('أكمل كل الأسئلة.');const score=attempt.questions.reduce((n,x,i)=>n+(x.answer===body.answers[i]?100:0),0);tx.update(ref,{submitted:true,score,submittedAt:Date.now()});tx.set(profileRef,{points:(p.data()?.points||0)+score},{merge:true});return {score};});return res.json(result);
  }
  if(action==='competition.list'){const [own,judged]=await Promise.all([db.collection('competitions').where('ownerId','==',uid).get(),db.collection('competitions').where('judgeIds','array-contains',uid).get()]);const all=new Map([...own.docs,...judged.docs].map(d=>[d.id,d.data()]));return res.json({competitions:[...all.values()].map(c=>visible(c,uid))});}
  const id=body.id||body.competition?.id;if(!idValid(id))fail('معرّف المسابقة غير صالح.');const ref=db.doc(`competitions/${id}`);
  if(action==='competition.get'){const snap=await ref.get();if(!snap.exists)fail('المسابقة غير موجودة.',404);const c=snap.data();if(!member(c,uid))fail('ليست لديك صلاحية الوصول.',403);return res.json({competition:visible(c,uid)});}
  const result=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);let c=snap.exists?snap.data():null;
   if(c&&!member(c,uid))fail('ليست لديك صلاحية الوصول.',403);
   if(c&&Number(body.version)!==c.version)fail('تم تحديث المسابقة من جهاز آخر. أعد تحميلها قبل الحفظ.',409);
   if(action==='competition.save'){
    if(c)assertOwner(c,uid);const incoming=body.competition;try{validateCompetition(incoming,q);}catch(e){fail(e.message);}checkPassages(incoming,c);
    if(c?.scores.length){
     if(JSON.stringify([incoming.levels,incoming.judges,incoming.rubric])!==JSON.stringify([c.levels,c.judges,c.rubric]))fail('بدأ التقييم. لا يمكن تعديل المستويات أو لجنة التحكيم أو أوزانه.');
     for(const p of c.participants.filter(p=>c.scores.some(s=>s.participantId===p.id))){if(JSON.stringify(incoming.participants.find(x=>x.id===p.id))!==JSON.stringify(p))fail('لا يمكن تعديل بيانات متسابق بدأ تقييمه.');}
    }
    if(!incoming.judges.every(j=>idValid(j.id)&&typeof j.name==='string'&&j.name.length>0&&j.name.length<=100))fail('راجع بيانات المحكّمين.');
    const participants=incoming.participants.map(p=>({...p,...(p.approved?{reviewedBy:uid,reviewedAt:c?.participants.find(x=>x.id===p.id&&x.approved)?.reviewedAt||new Date().toISOString()}:{})}));
    c={name:incoming.name,school:incoming.school,date:incoming.date||'',status:incoming.status||'draft',levels:incoming.levels,participants,judges:incoming.judges,rubric:incoming.rubric,id,ownerId:uid,judgeIds:incoming.judges.map(j=>j.id),scores:c?.scores||[],audit:c?.audit||[],published:c?.published||false,version:c?.version||0};
   }else{
    if(!c)fail('المسابقة غير موجودة.',404);
    if(action==='competition.generate'){
     assertOwner(c,uid);const p=c.participants.find(p=>p.id===body.participantId);if(!p)fail('المتسابق غير موجود.');if(c.scores.some(s=>s.participantId===p.id))fail('لا يمكن تغيير الأسئلة بعد بدء التقييم.');p.passages=generatePassages(q,c.levels.find(l=>l.id===p.levelId),random);p.approved=false;
    }
    if(action==='competition.judge'){
     const judge=c.judges.find(j=>j.id===uid);if(!judge)fail('أنت غير مكلّف بالتحكيم في هذه المسابقة.',403);const p=c.participants.find(p=>p.id===body.participantId);if(!p?.approved)fail('يجب أن يعتمد المنظّم الأسئلة أولًا.');const existing=c.scores.find(s=>s.participantId===p.id&&s.judgeId===uid);if(existing?.final)fail('هذا التقييم معتمد ولا يمكن تعديله.');const total=scoreTotal(body.values,c.rubric);const sheet={participantId:p.id,judgeId:uid,judgeName:judge.name,values:Object.fromEntries(c.rubric.map(r=>[r.key,Number(body.values[r.key])])),total,notes:String(body.notes||'').slice(0,2000),final:body.final===true,at:new Date().toISOString()};c.scores=c.scores.filter(s=>!(s.participantId===p.id&&s.judgeId===uid));c.scores.push(sheet);c.audit.push({event:sheet.final?'تقييم معتمد':'مسودة تقييم',actor:judge.name,at:sheet.at,participantId:p.id});
    }
    if(action==='competition.publish'){assertOwner(c,uid);const rows=resultsFor(c);if(!rows.length||rows.some(p=>!p.complete))fail('يجب اكتمال التقييمات المعتمدة لكل المتسابقين قبل اعتماد النتائج.');c.published=true;c.audit.push({event:'اعتماد النتائج',actor:user.name||uid,at:new Date().toISOString()});}
   }
   c.version++;c.updatedAt=new Date().toISOString();if(c.audit.length>400)c.audit=c.audit.slice(-400);if(Buffer.byteLength(JSON.stringify(c))>850000)fail('تجاوزت المسابقة الحد الأقصى للحفظ.');tx.set(ref,c);return visible(c,uid);
  });return res.json({competition:result});
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});console.error('api/app error:',e.code||e.name);return res.status(500).json({error:'تعذر إتمام العملية. حاول مجددًا بعد قليل.'});}
}
