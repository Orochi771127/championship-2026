import fs from 'node:fs';import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const pick=(row,fields)=>Object.fromEntries(fields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
const fields=value=>{const keys=new Set();function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){keys.add(k);visit(x);}}visit(value);return [...keys];};
const write=(file,value)=>{const bytes=Buffer.from(JSON.stringify(value)+'\n');assertPublicBytes(file,bytes,{jsonFields:fields(value)});fs.writeFileSync(file,bytes);};
const source=read('assets/production/original-ui-intake-20261007/manifest.json');
const corrections=read('assets/production/medal-name-corrections-20261014/manifest.json');
const toolbar=read('assets/production/original-ui-intake-20261007/toolbar-point64-r1-20261009/manifest.json');
const renderFields=['src','sha256','bytes','rasterSize','width','height','nativeSize','origin','density','rasterAnchor'];
const medals=new Map(source.medals.map(m=>[m.titleId,m]));for(const medal of corrections.medals)medals.set(medal.titleId,medal);
write('src/data/championship/public-ui-selection.v1.json',{schemaVersion:1,
 medals:[...medals.values()].map(m=>pick(m,[...renderFields,'titleId','artIdentity','artName','detailSrc','detailSha256','detailBytes','detailRasterSize'])),
 database:source.database.filter(row=>row.bindingEvidence!=='UNKNOWN_REQUIRES_TRACE').map(row=>pick(row,[...renderFields,'cell','destination'])),
 items:source.items.map(row=>pick(row,[...renderFields,'assetId','frame','shopRecordIndex','itemIndex','productItemId','category','subcategory'])),
 toolbar:toolbar.assets.map(row=>pick(row,[...renderFields,'role','assetId','frameCount']))});
const policy=read('src/data/championship/public-playtest.r1.json');
write('src/data/championship/public-playtest-runtime.v1.json',{schemaVersion:1,id:policy.id,status:policy.status,origin:policy.origin,basePath:policy.basePath,
 acceptedOriginalRuntime:pick(policy.acceptedOriginalRuntime,['status','selectionId'])});
console.log(JSON.stringify({medals:medals.size,items:source.items.length,toolbar:toolbar.assets.length,sourceAuthorityOrReviewFlagsCopied:false}));
