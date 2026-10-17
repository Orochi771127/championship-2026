import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const SHOP_CAGE_SOURCE='assets/production/cage/shop-final-20261008/manifest.json';
export const SHOP_CAGE_PUBLIC='assets/production/public-runtime/shop-cage-thumbnails.v1.json';
export const SHOP_CAGE_PUBLIC_ID='art:shop:cage-thumbnails:v1';
export const SHOP_CAGE_FIELDS=['schemaVersion','records','shopRecordIndex','itemIndex','cageDefinitionIndex','moduleId','fieldId','src','width','height','sha256','category','subcategory','logicalOrigin','density'];
const fields=SHOP_CAGE_FIELDS.slice(2);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Build-only projection of the 35 original thumbnails selected on 2026-10-10.
// This never grants the source manifest, another local-only bundle, or ROM art.
export function selectedShopCageProjection({root,input,index}){
  const authority=index.entries?.find(row=>row.assetId==='art:cage:shop-final:20261008');
  if(!authority)return {files:new Map(),manifest:null};
  const policy=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/public-playtest.r1.json'),'utf8'));
  if(policy.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'||policy.origin!=='https://orochi771127.github.io'
    ||policy.basePath!=='/championship-2026/'||policy.acceptedOriginalRuntime?.selectionId!=='ACCEPTED_ORIGINAL_RUNTIME_20261010'
    ||policy.acceptedOriginalRuntime.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'
    ||authority.manifestPath!==SHOP_CAGE_SOURCE||authority.rightsStatus!=='ORIGINAL_CREATED_AI_ASSISTED')throw Error('PUBLIC_SHOP_CAGE_AUTHORIZATION');
  const bytes=fs.readFileSync(path.join(root,SHOP_CAGE_SOURCE));
  // Pin the actual reviewed intake, not any later manifest at the same path.
  if(sha(bytes)!=='4f709ad7713901eeaa7963b4edf21e91649b11b8f0b383e701f90ec10383c9ad')throw Error('PUBLIC_SHOP_CAGE_SOURCE_HASH');
  const source=JSON.parse(bytes),approved=new Map(input.publicPlaytest.files.map(row=>[row.path,row.sha256]));
  if(source.assetId!==authority.assetId||source.rightsStatus!==authority.rightsStatus||source.records?.length!==35)throw Error('PUBLIC_SHOP_CAGE_SOURCE');
  const files=new Map(),seen=new Set();
  const records=source.records.map(row=>{
    const expected='assets/production/cage/shop-final-20261008/thumbnails/shop-'+String(row.shopRecordIndex).padStart(3,'0')
      +'_item-'+String(row.itemIndex).padStart(2,'0')+'_'+row.fieldId+'.png';
    if(!Number.isInteger(row.shopRecordIndex)||row.shopRecordIndex<83||row.shopRecordIndex>117||seen.has(row.shopRecordIndex)
      ||row.src!==expected||approved.get(row.src)!==row.sha256||!/^[a-f0-9]{64}$/.test(row.sha256)
      ||row.width!==256||row.height!==192||row.sourceCrop!==null||row.alphaPreserved!==true)throw Error('PUBLIC_SHOP_CAGE_RECORD');
    seen.add(row.shopRecordIndex);files.set(row.src,row.sha256);
    return Object.fromEntries(fields.map(key=>[key,row[key]]));
  });
  return {files,manifest:{schemaVersion:1,records}};
}
