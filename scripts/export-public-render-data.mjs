import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {projectPublicRenderSources} from './lib/public-render-projection.mjs';
import {selectedShopCageProjection,SHOP_CAGE_PUBLIC} from './lib/public-shop-cage-projection.mjs';
import {selectedMapProjections} from './lib/public-map-projection.mjs';
import {projectPublicMetadata} from './lib/public-metadata-projection.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const result=projectPublicRenderSources({root,input:read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'),index:read('assets/production/ART_PRODUCTION_INDEX.json')});
const shop=selectedShopCageProjection({root,input:read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'),index:read('assets/production/ART_PRODUCTION_INDEX.json')});
if(shop.manifest)result.descriptors.push({role:'shop-cage-thumbnails',path:SHOP_CAGE_PUBLIC,bytes:Buffer.from(JSON.stringify(shop.manifest,null,2)+'\n')});
const check=process.argv.includes('--check');
result.descriptors.push(...projectPublicMetadata({root,input:read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json')}).descriptors);
result.descriptors.push(...selectedMapProjections({root,input:read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json')}).descriptors);
for(const descriptor of result.descriptors){
 const file=path.join(root,descriptor.path);
 if(check){if(!fs.existsSync(file)||!fs.readFileSync(file).equals(descriptor.bytes))throw Error('PUBLIC_RENDER_REEXPORT_DRIFT:'+descriptor.role);}
 else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,descriptor.bytes);}
}
console.log(JSON.stringify({mode:check?'CHECK':'EXPORT',descriptors:result.descriptors.map(({role,path,sha256,bytes})=>({role,path,sha256,bytes:bytes.length})),selectedRenderedMedia:result.media.size,authorityIndexCopied:false}));
