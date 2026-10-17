import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function publicRuntimeFetchFixture({calls=[]}={}){
 const selected=new Set(JSON.parse(fs.readFileSync(path.join(root,'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'),'utf8')).files.map(row=>row.path));
 return async function fetchImpl(url){
  const href=new URL(url,'http://localhost/'),relative=decodeURIComponent(href.pathname).replace(/^\/championship-2026\//,'').replace(/^\//,'');
  if(!selected.has(relative))throw Error('TEST_FETCH_OUTSIDE_PUBLIC_SELECTION:'+relative);
  calls.push(relative);const bytes=fs.readFileSync(path.join(root,relative));
  return {ok:true,status:200,text:async()=>bytes.toString('utf8'),json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
}
