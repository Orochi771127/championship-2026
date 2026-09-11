// Refresh the approved byte hashes for files whose contents changed, and print
// exactly which. The approval list is the Owner's record of what is published;
// this only restates it for the current bytes, it does not widen the file set.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const P='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json';
const raw=readFileSync(P,'utf8'),d=JSON.parse(raw);
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const changed=[];
for(const row of d.publicPlaytest.files){
  const h=sha(row.path);
  if(h!==row.sha256){changed.push(row.path);row.sha256=h;}
}
if(changed.length)writeFileSync(P,JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({refreshed:changed.length,files:changed},null,1));
