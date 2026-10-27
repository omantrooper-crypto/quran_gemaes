export const initialAccount={version:1,name:'رفيق القرآن',avatar:'',goal:3,kids:false,favorites:[],sessions:[],mistakes:[],competitions:[]};
export const accountKey=(uid,configured=true)=>!configured?'qurangames.v1':uid?`qurangames.account.${uid}.v2`:'qurangames.guest.v2';
export function loadAccount(key,storage=globalThis.localStorage){try{const d=JSON.parse(storage.getItem(key));if(d?.version===1&&Array.isArray(d.sessions)&&Array.isArray(d.competitions))return {...JSON.parse(JSON.stringify(initialAccount)),...d};}catch{}return JSON.parse(JSON.stringify(initialAccount));}
export function validAvatar(value){
 if(value==='')return true;
 if(typeof value!=='string'||value.length>90000)return false;
 const m=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!m||m[2].length%4)return false;
 try{const bytes=globalThis.atob(m[2]);return m[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):m[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';}catch{return false;}
}
