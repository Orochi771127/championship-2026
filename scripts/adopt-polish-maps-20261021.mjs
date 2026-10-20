// Owner 2026-10-21: the polished cage, battle and HM01 maps replace the earlier ones on the public
// playtest URL. This script moves the hash-pinned public sources and approved file lists from the
// earlier map sets to the polished ones, and removes the superseded media from the approved list
// (it keeps the published site under the 1 GB Pages limit). Idempotent. Afterwards run, in order:
//   node scripts/export-public-render-data.mjs
//   node scripts/reconcile-public-runtime-selection.mjs
//   node scripts/export-public-render-data.mjs --check
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileSha=file=>sha(fs.readFileSync(path.join(root,file)));
const MAP_RECIPE='docs/contracts/championship/PUBLIC_MAP_RENDER_SOURCES.v1.json',META_RECIPE='docs/contracts/championship/PUBLIC_METADATA_SOURCES.v1.json';
const INPUTS='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',ALLOW='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const CAGE='assets/production/cage/polish-review-20261019/manifest.json',BATTLE='assets/production/battle/arena-polish-20261018/manifest.json';
const HUNT='assets/production/hunt/hm01x2-public-20261021/manifest.json',HUNT_EXCLUDE=['field_hm01_01','field_hm01_02'];
const RAW_DIRS=['assets/production/cage/foreground-review-polish-20261019','assets/production/cage/ambient-review-polish-20261019',
 'assets/production/cage/shared-edges-polish-20261019','assets/production/cage/cm02-goal-foreground-polish-20261019'];
const RAW_FILES=['assets/production/battle/bm04-island-polish-r2/caustic-tile.webp'];
const mapRecipe=read(MAP_RECIPE),metaRecipe=read(META_RECIPE),input=read(INPUTS),allow=read(ALLOW);

// Every {src, sha256} pair in a manifest, skipping fields the public build leaves out.
function pairs(file,exclude=[]){
 const out=new Map(),manifest=read(file);
 const visit=node=>{if(Array.isArray(node))node.forEach(visit);else if(node&&typeof node==='object'){
  if(typeof node.src==='string'&&typeof node.sha256==='string')out.set(node.src,node.sha256.toLowerCase());
  Object.values(node).forEach(visit);}};
 visit(manifest.fields?manifest.fields.filter(field=>!exclude.includes(field.fieldId)):manifest);
 return out;
}
const sourceOf=(recipe,role)=>recipe.sources.find(row=>row.role===role);
const excludeOf=row=>row.excludeFields??[];
const mapMedia=()=>{const all=new Map();for(const row of mapRecipe.sources)for(const [src,hash] of pairs(row.path,excludeOf(row)))all.set(src,hash);return all;};

// 1. Remember what the earlier sets referenced, then move the sources.
const before=new Map();
for(const role of ['cage-final','hunt-accepted'])before.set(role,pairs(sourceOf(mapRecipe,role).path,excludeOf(sourceOf(mapRecipe,role))));
before.set('battle-original',pairs(sourceOf(metaRecipe,'battle-original').path));
const oldHuntFull=pairs(sourceOf(mapRecipe,'hunt-accepted').path);
const oldHm01=new Map([...oldHuntFull].filter(([src])=>!before.get('hunt-accepted').has(src)));
const cageRow=sourceOf(mapRecipe,'cage-final');cageRow.path=CAGE;cageRow.sha256=fileSha(CAGE);
const huntAccepted=sourceOf(mapRecipe,'hunt-accepted');huntAccepted.excludeFields=HUNT_EXCLUDE;
const wantHunt={role:'hunt-hm01x2',path:HUNT,sha256:fileSha(HUNT)};
const huntIndex=mapRecipe.sources.findIndex(row=>row.role==='hunt-hm01x2');
if(huntIndex<0)mapRecipe.sources.splice(mapRecipe.sources.findIndex(row=>row.role==='hunt-accepted')+1,0,wantHunt);else mapRecipe.sources[huntIndex]=wantHunt;
const battleRow=sourceOf(metaRecipe,'battle-original');battleRow.path=BATTLE;battleRow.sha256=fileSha(BATTLE);

// 2. Pieces geometry of the packaged HM01 art is metadata like the accepted hunt geometry.
const huntGeometry=new Map([...pairs(HUNT)].filter(([src])=>src.endsWith('.json')));
for(const [src,hash] of huntGeometry){
 const role='hunt-pieces-'+hash.slice(0,16);
 if(fileSha(src)!==hash)throw Error('HUNT_GEOMETRY_HASH:'+src);
 const row={path:src,sha256:hash,role,type:'HUNT_DEPTH'},at=metaRecipe.sources.findIndex(entry=>entry.role===role);
 if(at<0)metaRecipe.sources.push(row);else metaRecipe.sources[at]=row;
}

// 3. Pinned media: every map source's referenced media, unchanged roles keep their pins.
const pins=mapMedia();
mapRecipe.mediaPins=[...pins].sort(([a],[b])=>a.localeCompare(b,'en')).map(([p,s])=>({path:p,sha256:s}));

// 4. Approved lists: add new media and raw runtime files; drop media only the earlier sets used.
const newMedia=new Map([...pairs(CAGE),...pairs(BATTLE),...pairs(HUNT)].filter(([src])=>!src.endsWith('.json')));
const referenced=new Set([...mapMedia().keys(),...newMedia.keys(),
 ...pairs(sourceOf(metaRecipe,'battle-baseline').path).keys()]);
const stale=new Set();
for(const group of [...before.values(),oldHm01])for(const src of group.keys())if(!referenced.has(src)&&!src.endsWith('.json'))stale.add(src);
const raw=new Map();
const jsonKeys=file=>{const keys=new Set();const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){keys.add(k);visit(x);}};
 visit(read(file));return [...keys].sort();};
const list=dir=>fs.readdirSync(path.join(root,dir),{recursive:true,withFileTypes:true}).filter(e=>e.isFile())
 .map(e=>path.posix.join(dir,path.relative(path.join(root,dir),path.join(e.parentPath??e.path,e.name)).replaceAll('\\','/')));
for(const file of [...RAW_DIRS.flatMap(list),...RAW_FILES])raw.set(file,file.endsWith('.json')?{path:file,sha256:fileSha(file),jsonFields:jsonKeys(file)}:{path:file,sha256:fileSha(file)});
// Bundled catalog data (compiled into the program, never published as files) still carries a closed field list.
const CATALOGS=['src/data/championship/catalogs/hunt-hm01x2.review-20261019.json','src/data/championship/catalogs/raising-ground.review-20261019.json'];
for(const file of CATALOGS)raw.set(file,{path:file,sha256:fileSha(file),jsonFields:jsonKeys(file)});
const approved=new Map(input.publicPlaytest.files.map(row=>[row.path,row]));
const allowed=new Map(allow.files.map(row=>[row.path,row]));
for(const src of stale){approved.delete(src);allowed.delete(src);}
for(const [src,hash] of newMedia){approved.set(src,{path:src,sha256:hash});if(!allowed.has(src))allowed.set(src,{path:src,sha256:hash});}
for(const [file,row] of raw){approved.set(file,{path:file,sha256:row.sha256});allowed.set(file,row);}
input.publicPlaytest.files=[...approved.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
allow.files=[...allowed.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
write(MAP_RECIPE,mapRecipe);write(META_RECIPE,metaRecipe);write(INPUTS,input);write(ALLOW,allow);
console.log(JSON.stringify({newMedia:newMedia.size,rawFiles:raw.size,staleRemoved:stale.size,pins:mapRecipe.mediaPins.length,
 staleBytes:[...stale].reduce((n,src)=>n+(fs.existsSync(path.join(root,src))?fs.statSync(path.join(root,src)).size:0),0)}));
