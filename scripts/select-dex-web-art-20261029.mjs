// Ship web encodings of the 10-18 Dex display illustrations (database-display-20261018), the one
// Dex batch still published lossless; later batches already ship WebP q92. Owner approved the web
// renditions on 2026-10-29. Run after scripts/encode-web-art.py has written
// assets/production/database-display-web-20261029/ and the four preview hashes in
// acceptedDatabasePortraits.js are updated. The lossless renditions stay in the repo; the display
// rendition recipe records each web copy and the lossless rendition it supersedes, and the public
// portrait list and the contracts point at the web copies. Safe to rerun.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dir='assets/production/database-display-web-20261029/';
const dataPath='src/data/championship/database-hero-portraits.public.v1.json';
const edited=[dataPath,'src/championship/presentation/acceptedDatabasePortraits.js'];
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',allowPath='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const input=read(inputPath),allow=read(allowPath),receipt=read(dir+'ENCODE_RECEIPT.json');
const rows=new Map(allow.files.map(row=>[row.path,row]));
const web=new Map(receipt.files.filter(row=>row.sha256).map(row=>[row.source,row]));
for(const row of web.values())if(hash(row.output)!==row.sha256)throw Error('WEB_ENCODING_CHANGED:'+row.output);
const recipePath='docs/contracts/championship/DATABASE_HERO_DISPLAY_RENDITIONS.v1.json',recipe=read(recipePath);
recipe.webEncoding={date:'2026-10-29',approval:'OWNER_APPROVED_WEB_RENDITIONS',tool:receipt.tool,
  receipt:dir+'ENCODE_RECEIPT.json',receiptSha256:hash(dir+'ENCODE_RECEIPT.json'),gate:receipt.gate};
for(const row of recipe.rows){
  const encoded=web.get(row.display.src);if(!encoded)continue;
  if(row.display.sha256!==encoded.sourceSha256)throw Error('WEB_RENDITION_SOURCE_MISMATCH:'+row.display.src);
  const {src,sha256,width,height,bytes}=row.display;
  row.display={src:encoded.output,sha256:encoded.sha256,width,height,bytes:encoded.bytes,encoding:'LOSSY',quality:encoded.quality,
    webGate:{psnr:encoded.psnr,lumaSsim:encoded.ssim},rgbaExactlyMatchesResizedSource:false,alphaExactlyMatchesResizedSource:true,
    supersedes:{src,sha256,bytes}};
}
write(recipePath,recipe);
const data=read(dataPath);
for(const entry of data.entries){
  const row=web.get(entry.src);if(!row)continue;
  if(entry.sha256!==row.sourceSha256)throw Error('WEB_SOURCE_PIN_MISMATCH:'+entry.src);
  entry.src=row.output;entry.sha256=row.sha256;
}
write(dataPath,data);
for(const asset of allow.assets){
  const row=web.get(asset.src);
  if(row){asset.src=row.output;asset.sha256=row.sha256;}
}
for(const row of web.values()){
  rows.delete(row.source);
  const file={path:row.output,sha256:row.sha256};
  assertPublicBytes(row.output,fs.readFileSync(row.output),file);rows.set(row.output,file);
}
for(const file of edited){
  const row=rows.get(file);if(!row)throw Error('EDITED_FILE_NOT_PUBLISHED:'+file);
  row.sha256=hash(file);
}
allow.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
input.files=allow.files.map(row=>row.path);
input.publicPlaytest.files=allow.files.map(({path,sha256})=>({path,sha256}));
write(allowPath,allow);write(inputPath,input);
console.log(JSON.stringify({encoded:web.size,kept:receipt.files.length-web.size,sourceBytes:receipt.sourceBytes,outputBytes:receipt.outputBytes}));
