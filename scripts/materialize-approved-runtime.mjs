import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const recipe=read('docs/contracts/championship/RUNTIME_DERIVED_MATERIALIZATION.v1.json');
const allow=new Map(read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json').files.map(row=>[row.path,row.sha256]));
const hash=data=>createHash('sha256').update(data).digest('hex');
const write=process.argv.includes('--write');
if(recipe.schemaVersion!==1||!Array.isArray(recipe.files))throw Error('RUNTIME_MATERIALIZATION_SCHEMA');
for(const row of recipe.files)if(!/^assets\/production\/[a-zA-Z0-9_./-]+$/.test(row.path)||row.path.split('/').includes('..')
 ||!/^[a-f0-9]{40}$/.test(row.gitBlobSha1)||allow.get(row.path)!==row.sha256)throw Error('RUNTIME_MATERIALIZATION_APPROVAL_CHANGED:'+row.path);
// Only pinned, already-approved Git objects are read. No lazy network fetch,
// placeholder, new image conversion or approval/hash update is permitted.
const raw=execFileSync('git',['cat-file','--batch'],{cwd:root,input:recipe.files.map(row=>row.gitBlobSha1).join('\n')+'\n',
 env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:16*1024*1024,windowsHide:true});
let cursor=0,restored=0,bytes=0;
for(const row of recipe.files){
 const end=raw.indexOf(10,cursor),header=raw.toString('utf8',cursor,end).split(' ');cursor=end+1;
 if(header[0]!==row.gitBlobSha1||header[1]!=='blob'||!/^\d+$/.test(header[2]))throw Error('RUNTIME_LOCAL_GIT_OBJECT_REQUIRED:'+row.path);
 const size=Number(header[2]),data=raw.subarray(cursor,cursor+size);cursor+=size+1;
 if(data.length!==size||hash(data)!==row.sha256)throw Error('RUNTIME_MATERIALIZATION_HASH:'+row.path);
 const target=path.resolve(root,row.path);if(!target.startsWith(root+path.sep))throw Error('RUNTIME_MATERIALIZATION_OUTSIDE_ROOT');
 if(fs.existsSync(target)){
  if(hash(fs.readFileSync(target))!==row.sha256)throw Error('RUNTIME_EXISTING_FILE_CONFLICT:'+row.path);
 }else if(write){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  if(!fs.realpathSync(path.dirname(target)).startsWith(fs.realpathSync(root)+path.sep))throw Error('RUNTIME_MATERIALIZATION_LINK');
  fs.writeFileSync(target,data);restored++;
 }else throw Error('RUNTIME_MATERIALIZATION_REQUIRED:'+row.path);
 bytes+=size;
}
if(write){
 const sparse=path.join(root,'.git/info/sparse-checkout');
 if(fs.existsSync(sparse)){const current=fs.readFileSync(sparse,'utf8'),lines=new Set(current.split(/\r?\n/));fs.appendFileSync(sparse,recipe.files.filter(row=>!lines.has('/'+row.path)).map(row=>'/'+row.path+'\n').join(''));}
}
console.log(JSON.stringify({checked:recipe.files.length,restored,bytes,source:'PINNED_LOCAL_GIT_OBJECTS',networkUsed:false,approvalsChanged:false}));
