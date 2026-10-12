const LEVELS=['edu','koreanEdu','rank','experience','invest'];
const FACTS=['korean','spouse','koreanChild','parent','edu','rank','experience','invest'];
const gives={'D-2-1':{edu:2,koreanEdu:2},'D-2-2':{edu:3,koreanEdu:3}}; // D-2-7, D-4-3: none
function readDetails(edu,stemChecked,eduKorea){const d={edu};if(edu!==undefined){const x=edu>=1;d.eduKorea=x&&eduKorea;d.stem=x&&stemChecked;}return d;}
function profileFacts(p){const k={};FACTS.forEach(f=>{if(p[f]!==undefined)k[f]=p[f];});if(p.edu!==undefined){k.koreanEdu=p.eduKorea?p.edu:0;k.stem=p.stem;}if(p.age>=19)k.parent='none';return k;}
function factsAt(p,path,level){const known=profileFacts(p);const min={};path.slice(0,level).forEach(c=>{Object.entries(gives[c]||{}).forEach(([k,v])=>{if(!LEVELS.includes(k)){if(known[k]===undefined)known[k]=v;}else if(known[k]!==undefined)known[k]=Math.max(known[k],v);else min[k]=Math.max(min[k]===undefined?v:min[k],v);});});return{known,min,p};}
function checkFact(f,key,want,p){if(key==='ageUnder')return p.age<want?'yes':'no';const have=f.known[key];if(LEVELS.includes(key)){if(have!==undefined)return have>=want?'yes':'no';return f.min[key]>=want?'yes':'maybe';}if(have===undefined)return'maybe';return [].concat(want).includes(have)?'yes':'no';}
function checkNeeds(needs,f,p){if(!needs)return{result:'yes',keys:[]};const opts=[].concat(needs).map(g=>{const ch=Object.entries(g).map(([k,w])=>({k,r:checkFact(f,k,w,p)}));const c=r=>ch.filter(x=>x.r===r).length;return{ch,result:c('no')?'no':c('maybe')?'maybe':'yes',misses:c('no')};});const best=opts.find(o=>o.result==='yes')||opts.find(o=>o.result==='maybe')||opts.reduce((a,b)=>b.misses<a.misses?b:a);return{result:best.result,keys:best.ch.filter(x=>x.r===(best.result==='yes'?'yes':best.result==='no'?'no':'maybe')).map(x=>x.k)};}
const D10=[{edu:3},{koreanEdu:2},{koreanEdu:1,ageUnder:25}];
const E71=[{edu:4},{edu:3,experience:1},{experience:5},{koreanEdu:2},{edu:3,rank:1}];
const D25=[{edu:4},{stem:true}];
// F0: edu=1 high school, not korean uni, age 20, path NONE->D-2-7
let p={age:20,...readDetails(1,false,false)};
console.log('F0 D-2-7->D-10-1:',checkNeeds(D10,factsAt(p,['NONE','D-2-7'],2),p));
console.log('F0 D-2-7->E-7-1:',checkNeeds(E71,factsAt(p,['NONE','D-2-7'],2),p));
// with proposed gives
gives['D-2-7']={edu:2,koreanEdu:2};
console.log('F0 fixed D-2-7->D-10-1:',checkNeeds(D10,factsAt(p,['NONE','D-2-7'],2),p));
// F1: edu=0, age 16, path NONE->D-4-3 -> D-2-1 needs edu1
let q={age:16,...readDetails(0,false,false)};
console.log('F1 details:',q,'facts:',factsAt(q,['NONE','D-4-3'],2).known);
console.log('F1 D-4-3->D-2-1:',checkNeeds({edu:1},factsAt(q,['NONE','D-4-3'],2),q));
gives['D-4-3']={edu:1,koreanEdu:1};
console.log('F1 fixed D-4-3->D-2-1:',checkNeeds({edu:1},factsAt(q,['NONE','D-4-3'],2),q));
// F3: edu=0 age 17 NONE->D-4-1 needs edu1
console.log('F3 NONE->D-4-1:',checkNeeds({edu:1},factsAt({age:17,...readDetails(0,false,false)},['NONE'],1),{age:17}));
// F4: edu=0 + stem checked
let r={age:20,...readDetails(0,true,false)};
console.log('F4 edu0+stemChecked details:',r,'needs D-2-5:',checkNeeds(D25,factsAt(r,['NONE'],1),r));
let s={age:20,...readDetails(1,true,false)};
console.log('F4 edu1+stem:',checkNeeds(D25,factsAt(s,['NONE'],1),s));
console.log('F4 edu1+stem with fix {stem,edu:1}:',checkNeeds([{edu:4},{stem:true,edu:1}],factsAt(s,['NONE'],1),s));
console.log('F4 edu0+stem with fix:',checkNeeds([{edu:4},{stem:true,edu:1}],factsAt(r,['NONE'],1),r));
let t={age:20,...readDetails(undefined,true,false)};
console.log('F4 edu blank:',checkNeeds(D25,factsAt(t,['NONE'],1),t));
