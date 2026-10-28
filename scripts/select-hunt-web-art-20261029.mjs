// Ship web encodings of the 2D hunt fields still served from the 10-10 intake: the hm00 tutorial
// field and the 2D fallbacks of hm08/10/11/13/14. Run after scripts/encode-web-art.py has written
// assets/production/hunt/accepted-web-20261029/. The lossless intake stays in the repo for loopback
// review; the public projections point at the web copies, which then replace the lossless files.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {selectedMapProjections,MAP_RECIPE,PUBLIC_MAP_FIELDS} from './lib/public-map-projection.mjs';
import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dir='assets/production/hunt/accepted-web-20261029/';
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',allowPath='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const input=read(inputPath),allow=read(allowPath),recipe=read(MAP_RECIPE),receipt=read(dir+'ENCODE_RECEIPT.json');
const rows=new Map(allow.files.map(row=>[row.path,row]));
const web=new Map(receipt.files.filter(row=>row.sha256).map(row=>[row.source,row]));
for(const row of web.values())if(hash(row.output)!==row.sha256)throw Error('WEB_ENCODING_CHANGED:'+row.output);
// Same manifests, only the encoded media swapped; asset ids and field data stay as reviewed.
const swap=value=>{if(Array.isArray(value))return value.map(swap);if(!value||typeof value!=='object')return value;
  const out=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,swap(item)]));
  const row=typeof value.src==='string'&&web.get(value.src);
  if(row){if(value.sha256!==row.sourceSha256)throw Error('WEB_SOURCE_PIN_MISMATCH:'+value.src);out.src=row.output;out.sha256=row.sha256;}
  return out;};
const oldPins=new Set();
for(const role of ['hunt-accepted','hunt-night']){
  const source=recipe.sources.find(row=>row.role===role);
  if(hash(source.path)!==source.sha256)throw Error('PUBLIC_MAP_SOURCE_CHANGED_REVIEW_REQUIRED:'+role);
  const target=dir+source.path.split('/').pop();
  write(target,swap(read(source.path)));
  Object.assign(source,{path:target,sha256:hash(target)});
}
for(const row of web.values()){
  oldPins.add(row.source);
  const bytes=fs.readFileSync(row.output),file={path:row.output,sha256:row.sha256};
  assertPublicBytes(row.output,bytes,file);rows.set(row.output,file);
}
recipe.mediaPins=[...recipe.mediaPins.filter(row=>!oldPins.has(row.path)),...[...web.values()].map(row=>({path:row.output,sha256:row.sha256}))];
write(MAP_RECIPE,recipe);
input.publicPlaytest.files=[...rows.values()].map(({path,sha256})=>({path,sha256}));
const maps=selectedMapProjections({root:process.cwd(),input});
for(const file of oldPins)if(!maps.files.has(file))rows.delete(file);
for(const descriptor of maps.descriptors){
  fs.writeFileSync(descriptor.path,descriptor.bytes);
  rows.set(descriptor.path,{path:descriptor.path,sha256:descriptor.sha256,jsonFields:PUBLIC_MAP_FIELDS});
  allow.assets=allow.assets.filter(row=>row.id!==descriptor.id);
  allow.assets.push({id:descriptor.id,src:descriptor.path,sha256:descriptor.sha256});
}
allow.assets=allow.assets.filter(row=>rows.has(row.src));
allow.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
input.files=allow.files.map(row=>row.path);
input.publicPlaytest.files=allow.files.map(({path,sha256})=>({path,sha256}));
write(allowPath,allow);write(inputPath,input);
console.log(JSON.stringify({encoded:web.size,sourceBytes:receipt.sourceBytes,outputBytes:receipt.outputBytes,
  removed:[...oldPins].filter(file=>!rows.has(file)).length}));
