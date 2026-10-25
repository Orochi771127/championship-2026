import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export function growthAuthoredSelection(root){
 const file=path.join(root,'src/data/championship/growth-authored-selection.v1.json');
 if(!fs.existsSync(file))return [];
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.schemaVersion!==1||!Array.isArray(data.characters))throw Error('GROWTH_AUTHORED_SELECTION_SCHEMA');
 for(const c of data.characters){
  if(!/^assets\/production\/characters\/growth-authored-20261025\/GR\d{2}\/runtime\.render\.json$/.test(c.runtimePath))throw Error('GROWTH_AUTHORED_SELECTION_PATH');
  const bytes=fs.readFileSync(path.join(root,c.runtimePath));if(crypto.createHash('sha256').update(bytes).digest('hex')!==c.runtimeSha256)throw Error('GROWTH_AUTHORED_SELECTION_HASH');
 }
 return data.characters;
}
