import fs from 'node:fs';import {validateBank} from '../src/content.mjs';import {bankStats,defaultBank} from '../src/questions.mjs';
const q=JSON.parse(fs.readFileSync(new URL('../public/data/quran.json',import.meta.url)));validateBank(defaultBank,q);
console.log(JSON.stringify({editorialQuestions:defaultBank.entries.length,candidates:bankStats(q,{difficulty:'متقدم'})},null,2));
