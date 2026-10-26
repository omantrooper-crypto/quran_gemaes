import {initializeApp} from 'firebase/app';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile,sendPasswordResetEmail,sendEmailVerification} from 'firebase/auth';
const env=import.meta.env;
export const configured=!!(env.VITE_FIREBASE_API_KEY&&env.VITE_FIREBASE_AUTH_DOMAIN&&env.VITE_FIREBASE_PROJECT_ID&&env.VITE_FIREBASE_APP_ID);
export const auth=configured?getAuth(initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID})):null;
// Localize verification, password-reset emails and Firebase's hosted action pages.
if(auth)auth.languageCode='ar';
export const watchAuth=cb=>auth?onAuthStateChanged(auth,cb):(cb(null),()=>{});
export async function login(email,password){if(!auth)throw Error('تسجيل العضويات سيتاح بعد ربط المشروع.');return signInWithEmailAndPassword(auth,email,password);}
export async function register(name,email,password){if(!auth)throw Error('تسجيل العضويات سيتاح بعد ربط المشروع.');const r=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(r.user,{displayName:name});await sendEmailVerification(r.user);await r.user.getIdToken(true);return r;}
export async function resetPassword(email){if(!auth)throw Error('الربط غير مكتمل.');return sendPasswordResetEmail(auth,email);}
export const logout=()=>signOut(auth);
export async function api(action,payload={}){
 if(!auth?.currentUser)throw Error('سجّل الدخول أولًا.');
 const token=await auth.currentUser.getIdToken();
 const r=await fetch('/api/app',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload})});
 let data;try{data=await r.json();}catch{throw Error('خدمة الحفظ غير متاحة. تأكد من إعداد خادم Vercel.');}if(!r.ok)throw Error(data.error||'تعذر إتمام الطلب.');return data;
}
export const authMessage=e=>({'auth/invalid-credential':'البريد أو كلمة المرور غير صحيحة.','auth/email-already-in-use':'البريد مستخدم بالفعل.','auth/weak-password':'اختر كلمة مرور أقوى (٦ أحرف على الأقل).','auth/invalid-email':'أدخل بريدًا إلكترونيًا صحيحًا.','auth/too-many-requests':'طلبات كثيرة. أعد المحاولة لاحقًا.','auth/network-request-failed':'تعذر الاتصال. تحقق من الإنترنت.','auth/operation-not-allowed':'طريقة الدخول لم تُفعّل في Firebase بعد.'}[e.code]||e.message||'تعذر إتمام العملية.');
export async function publicBank(){const r=await fetch('/api/app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'content.public'})});let data;try{data=await r.json();}catch{throw Error('تعذر تحميل بنك الأسئلة المنشور.');}if(!r.ok)throw Error(data.error||'تعذر تحميل المحتوى.');return data.bank;}
