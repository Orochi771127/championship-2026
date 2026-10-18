// Bounded derivative selection for the existing Owner-authorized playtest.
// Does not grant a commercial release or copy the private production index.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const manifest=read('assets/production/title-responsive-r1/manifest.json');
const derivatives=Object.values(manifest.assets).flatMap(row=>row.variants.map(v=>v.src));
const paths=['championship.html','src/championship/presentation/titleImageLifecycle.js',...derivatives,
 'src/championship/presentation/dataArena/dataArenaHarborLife.js',
 'src/championship/presentation/dataArena/dataArenaPixiScene.js',
 'src/championship/presentation/dataArena/dataArenaEnvironment.js','src/championship/app/dataArena.css'];
const hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',allowPath='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const input=read(inputPath),allow=read(allowPath);
for(const p of paths){
 if(!input.files.includes(p))input.files.push(p);
 for(const list of [input.publicPlaytest.files,allow.files]){
  const row=list.find(row=>row.path===p);if(row)row.sha256=hash(p);else list.push({path:p,sha256:hash(p)});
 }
}
input.files.sort();input.publicPlaytest.files.sort((a,b)=>a.path.localeCompare(b.path));allow.files.sort((a,b)=>a.path.localeCompare(b.path));
write(inputPath,input);write(allowPath,allow);console.log(`Selected ${derivatives.length} title derivatives and bounded A/B product hashes`);
