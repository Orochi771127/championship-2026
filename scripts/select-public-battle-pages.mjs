import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {applyBattlePagePolicy,readBattlePagePolicy} from './lib/public-battle-page-policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'src/data/championship/public-character-catalog.v1.json'),catalog=JSON.parse(fs.readFileSync(file,'utf8'));
const policy=readBattlePagePolicy(root),selected=applyBattlePagePolicy(root,catalog,policy);
fs.writeFileSync(file,JSON.stringify(selected)+'\n');
console.log(JSON.stringify({mode:policy.mode,characters:policy.characters.map(row=>row.entityId),originalImagesDeleted:0,animationOrGeometryChanged:false}));
