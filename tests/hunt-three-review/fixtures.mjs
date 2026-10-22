// Synthetic fixtures via existing canonical application clock/save writers.
// Never patches a nested digest, actor state, gate rule or running browser save.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL,fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(process.argv[2]??process.cwd());
const mod=p=>import(pathToFileURL(path.join(root,p)).href),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const {createChampionshipStandaloneApp}=await mod('src/championship/app/championshipStandaloneApp.js');
const {CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave}=await mod('src/championship/app/championshipStandaloneSave.js');
const catalog=read('src/data/championship/catalogs/creature-species.r1.json'),cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
const base=fs.readFileSync(path.join(root,'qa/championship-full-qa-save.json'),'utf8'),rows=[];
for(const [variant,minute]of [['day',480],['night',960]]){
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,base]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog,cages,rngClock:()=>({hour:12,minute:34,second:56}),now:()=> '2026-09-13T00:00:00.000Z',playtestPolicy:null});
 try{await app.continueGame();const before=app.getSnapshot();assert(app.advanceClock({units:(minute-before.clockMinutes)*400,divisor:400,clearElapsed:true}).accepted);assert.equal(app.save().phase,'SAVED');
 const bytes=Buffer.from(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)+'\n'),save=deserializeChampionshipModernSave(bytes.toString());assert.equal(JSON.parse(save.raisingHome).payload.clockMinutes,minute);assert.equal(save.progression.tamerRank,9);assert.equal(save.progression.nativeTitles.feeWaiver,true);assert.equal(save.raising.collection.length,5);
 const filename=`full-qa-${variant}.json`,destination=path.join(here,'fixtures',filename),hash=createHash('sha256').update(bytes).digest('hex');
 if(process.argv.includes('--check'))assert(fs.readFileSync(destination).equals(bytes),'fixture drift');else{assert(!fs.existsSync(destination),'do not replace a frozen fixture');fs.writeFileSync(destination,bytes,{flag:'wx'});}
 rows.push({variant,minute,file:filename,bytes:bytes.length,sha256:hash,synthetic:true,canonicalWriter:true,feeWaiver:true,chargeBitsExpected:0});
 }finally{await app.dispose();}
}
console.log(JSON.stringify({status:'PASS_CANONICAL_SYNTHETIC_FIXTURES_NOT_BROWSER',rows},null,2));
