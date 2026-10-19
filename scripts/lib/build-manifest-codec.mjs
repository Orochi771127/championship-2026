// Public build receipts use a lossless directory table. Runtime files and their
// hashes never change; validators reconstruct the complete rows before audits.
const columns=['directory','name','sha256','bytes'];
const directory=p=>p.slice(0,p.lastIndexOf('/')+1);
const safe=p=>typeof p==='string'&&!/[\\:\0?#]/.test(p)&&!p.startsWith('/')
  &&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
export function encodePublicBuildManifest(manifest){
  const directories=[...new Set(manifest.files.map(r=>directory(r.path)))].sort();
  const ids=new Map(directories.map((d,i)=>[d,i]));
  const {files,...rest}=manifest;
  return {...rest,schemaVersion:3,fileTable:{version:1,columns:[...columns],directories,
    rows:files.map(r=>{const d=directory(r.path);return[ids.get(d),r.path.slice(d.length),r.sha256,r.bytes];})}};
}
export function decodeBuildManifest(value){
  if(value?.schemaVersion===2)return value;
  const t=value?.fileTable;
  const fail=()=>{throw Error('BUILD_FILE_TABLE_INVALID');};
  if(value?.schemaVersion!==3||Object.hasOwn(value,'files')||!t||t.version!==1
    ||Object.keys(t).some(k=>!['version','columns','directories','rows'].includes(k))
    ||JSON.stringify(t.columns)!==JSON.stringify(columns)||!Array.isArray(t.directories)
    ||new Set(t.directories).size!==t.directories.length||!Array.isArray(t.rows))fail();
  if(t.directories.some(d=>typeof d!=='string'||(d!==''&&(!d.endsWith('/')||!safe(d.slice(0,-1))))))fail();
  const files=t.rows.map(r=>{
    if(!Array.isArray(r)||r.length!==4||!Number.isInteger(r[0])||r[0]<0||r[0]>=t.directories.length
      ||!safe(r[1])||r[1].includes('/')||typeof r[2]!=='string'||!/^[a-f0-9]{64}$/.test(r[2])
      ||!Number.isSafeInteger(r[3])||r[3]<0)fail();
    return{path:t.directories[r[0]]+r[1],sha256:r[2],bytes:r[3]};
  });
  const {fileTable,...rest}=value;
  return{...rest,files};
}
