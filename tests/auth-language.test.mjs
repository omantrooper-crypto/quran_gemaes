import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

test('registration verification and password reset request Arabic without sending real email',async()=>{
 const calls=[];
 const fakeAuth={languageCode:null};
 const user={getIdToken:async()=> 'test-only'};
 const result=await build({
  entryPoints:[fileURLToPath(new URL('../src/cloud.js',import.meta.url))],
  bundle:true,write:false,format:'iife',globalName:'cloud',
  define:{'import.meta.env':JSON.stringify({VITE_FIREBASE_API_KEY:'test-only',VITE_FIREBASE_AUTH_DOMAIN:'example.test',VITE_FIREBASE_PROJECT_ID:'test-only',VITE_FIREBASE_APP_ID:'test-only'})},
  plugins:[{name:'auth-adapter',setup(b){
   b.onResolve({filter:/^firebase\//},args=>({path:args.path,namespace:'fake-auth'}));
   b.onLoad({filter:/.*/,namespace:'fake-auth'},args=>({loader:'js',contents:args.path==='firebase/app'
    ?'export const initializeApp=()=>({});'
    :`export const getAuth=()=>fakeAuth;
      export const onAuthStateChanged=()=>{};
      export const createUserWithEmailAndPassword=async()=>({user});
      export const signInWithEmailAndPassword=()=>{};
      export const signOut=()=>{};
      export const updateProfile=async(u,p)=>{u.displayName=p.displayName;};
      export const sendEmailVerification=async u=>calls.push({type:'verify',language:fakeAuth.languageCode,name:u.displayName});
      export const sendPasswordResetEmail=async a=>calls.push({type:'reset',language:a.languageCode});` }));
  }}]
 });
 const context=vm.createContext({fakeAuth,user,calls});
 vm.runInContext(result.outputFiles[0].text,context);
 await context.cloud.register('رفيق القرآن','nobody@example.test','test-only');
 await context.cloud.resetPassword('nobody@example.test');
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {type:'verify',language:'ar',name:'رفيق القرآن'},
  {type:'reset',language:'ar'}
 ]);
});
