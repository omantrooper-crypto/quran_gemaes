import {initializeApp} from 'firebase/app';
import {getAuth,onIdTokenChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile,sendPasswordResetEmail,sendEmailVerification,verifyBeforeUpdateEmail,reload} from 'firebase/auth';
const env=import.meta.env;
export const configured=!!(env.VITE_FIREBASE_API_KEY&&env.VITE_FIREBASE_AUTH_DOMAIN&&env.VITE_FIREBASE_PROJECT_ID&&env.VITE_FIREBASE_APP_ID);
export const auth=configured?getAuth(initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID})):null;
if(auth)auth.languageCode='ar';
export const offlineDemo=!configured&&(env.DEV===true||env.VITE_OFFLINE_DEMO==='true');
const listeners=new Set();
let registering=false;
const snapshot=u=>u?{uid:u.uid,email:u.email,emailVerified:u.emailVerified,displayName:u.displayName}:null;
const publish=()=>{if(!registering)for(const cb of listeners)cb(snapshot(auth?.currentUser));};
export function watchAuth(cb){listeners.add(cb);const off=auth?onIdTokenChanged(auth,publish):(publish(),()=>{});return ()=>{listeners.delete(cb);off();};}
export async function login(email,password){if(!auth)throw Error('تسجيل الدخول غير متاح الآن.');return signInWithEmailAndPassword(auth,email.trim(),password);}
export function verificationStatus(uid){try{return JSON.parse(sessionStorage.getItem(`qurangames.verification.${uid}`))||{};}catch{return {};}}
function saveVerification(uid,value){try{sessionStorage.setItem(`qurangames.verification.${uid}`,JSON.stringify(value));}catch{}window.dispatchEvent(new Event('verification-status'));}
export async function sendVerification(){
 const user=auth?.currentUser;if(!user)throw Error('سجّل الدخول أولًا.');
 const last=verificationStatus(user.uid);if(Date.now()-(last.sentAt||0)<60000)throw Error('انتظر دقيقة قبل طلب رسالة أخرى.');
 try{if(last.pendingEmail)await verifyBeforeUpdateEmail(user,last.pendingEmail);else await sendEmailVerification(user);saveVerification(user.uid,{...last,sentAt:Date.now(),error:''});}
 catch(e){saveVerification(user.uid,{...last,error:authMessage(e)});throw e;}
}
export async function register(name,email,password){
 if(!auth)throw Error('تسجيل الدخول غير متاح الآن.');registering=true;
 try{const r=await createUserWithEmailAndPassword(auth,email.trim(),password);await updateProfile(r.user,{displayName:name.trim()});try{await sendVerification();}catch{/* The account exists: offer a retry on the verification screen. */}await r.user.getIdToken(true);return r;}
 finally{registering=false;publish();}
}
export async function refreshVerification(){const user=auth?.currentUser;if(!user)return false;await reload(user);await user.getIdToken(true);publish();return user.emailVerified;}
export async function correctEmail(email){const user=auth?.currentUser;if(!user)throw Error('سجّل الدخول أولًا.');await verifyBeforeUpdateEmail(user,email.trim());saveVerification(user.uid,{sentAt:Date.now(),pendingEmail:email.trim()});}
export async function resetPassword(email){if(!auth)throw Error('الخدمة غير متاحة الآن.');return sendPasswordResetEmail(auth,email.trim());}
export const logout=()=>signOut(auth);
export async function api(action,payload={}){
 const user=auth?.currentUser;if(!user)throw Error('سجّل الدخول أولًا.');
 if(!user.emailVerified&&action!=='capabilities')throw Error('أكّد بريدك الإلكتروني أولًا لاستخدام خدمات العضوية.');
 const token=await user.getIdToken();
 if(auth.currentUser?.uid!==user.uid)throw Error('تغيّر الحساب. أعد المحاولة.');
 const r=await fetch('/api/app',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({...payload,action})});
 let data;try{data=await r.json();}catch{throw Error('الخدمة غير متاحة مؤقتًا. حاول مرة أخرى.');}
 if(auth.currentUser?.uid!==user.uid)throw Error('تغيّر الحساب. أعد المحاولة.');
 if(!r.ok)throw Error(data.error||'تعذر إتمام الطلب.');return data;
}
export const authMessage=e=>({'auth/invalid-credential':'البريد أو كلمة المرور غير صحيحة.','auth/email-already-in-use':'البريد مستخدم بالفعل.','auth/weak-password':'اختر كلمة مرور أقوى (٦ أحرف على الأقل).','auth/invalid-email':'أدخل بريدًا إلكترونيًا صحيحًا.','auth/too-many-requests':'طلبات كثيرة. انتظر قليلًا قبل المحاولة.','auth/network-request-failed':'تعذر الاتصال. تحقق من الإنترنت.','auth/operation-not-allowed':'هذه الخدمة غير متاحة الآن.','auth/requires-recent-login':'لحماية حسابك، سجّل الخروج ثم الدخول مجددًا قبل تغيير البريد.','auth/user-token-expired':'انتهت الجلسة. أعد تسجيل الدخول.'}[e.code]||(e.code?'تعذر إتمام العملية. حاول مجددًا.':e.message)||'تعذر إتمام العملية.');
export async function publicBank(){const r=await fetch('/api/app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'content.public'})});let data;try{data=await r.json();}catch{throw Error('تعذر تحميل بنك الأسئلة المنشور.');}if(!r.ok)throw Error(data.error||'تعذر تحميل المحتوى.');return data.bank;}
