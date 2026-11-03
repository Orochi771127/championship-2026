// Read-only encyclopedia art. These identities never enter playable species,
// registration, stats, moves, saves or evolution catalogs.
import catalog from '../../data/championship/database-illustrations.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from '../text/locale.js';
import {isPlayableProductOriginal,listProductOriginals,PRODUCT_ORIGINAL_SPECIES} from '../contracts/productOriginalSpecies.js';
import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};

export function assertDatabaseIllustrationCatalog(entries){
 const ids=new Set(),codes=new Set(),forms=new Map();
 for(const entry of entries){
  if(!Number.isSafeInteger(entry.speciesIndex)||entry.speciesIndex<=230
    ||entry.speciesId!==`species-${entry.speciesIndex}`||ids.has(entry.speciesIndex)
    ||!/^(ART\d{2}|(EG|B1|B2|GR|MA|AW|UL)\d{2,})$/.test(entry.displayCode)||codes.has(entry.displayCode)
    ||typeof entry.displayName!=='string'||!entry.displayName.trim())throw Error('DATABASE_ILLUSTRATION_IDENTITY');
  if(entry.numberingStageIndex!==null&&entry.numberingStageIndex!==undefined&&(!Number.isSafeInteger(entry.numberingStageIndex)||entry.numberingStageIndex<0||entry.numberingStageIndex>6))throw Error('DATABASE_ILLUSTRATION_STAGE');
  if(entry.serial!==null&&entry.serial!==undefined&&(!Number.isSafeInteger(entry.serial)||entry.serial<=0))throw Error('DATABASE_ILLUSTRATION_SERIAL');
  // Optional form link: several identities of one character share a characterKey, each with its own
  // formKey and the same stage. It is display metadata only, never an evolution or transformation route.
  if(entry.form!==undefined){
    const {characterKey,formKey}=entry.form??{},key=`${characterKey}/${formKey}`,siblings=forms.get(characterKey);
    if(Object.keys(entry.form??{}).length!==2||![characterKey,formKey].every(v=>typeof v==='string'&&/^[a-z][a-z0-9-]*$/.test(v))
      ||siblings?.some(e=>`${e.form.characterKey}/${e.form.formKey}`===key||e.numberingStageIndex!==entry.numberingStageIndex))throw Error('DATABASE_ILLUSTRATION_FORM');
    forms.set(characterKey,[...(siblings??[]),entry]);
  }
  ids.add(entry.speciesIndex);codes.add(entry.displayCode);
 }
 if([...forms.values()].some(group=>group.length<2))throw Error('DATABASE_ILLUSTRATION_FORM');
}
assertDatabaseIllustrationCatalog(catalog.entries);
export const DATABASE_ILLUSTRATIONS=deepFreeze(catalog);
const bySpecies=new Map(catalog.entries.map(entry=>[entry.speciesIndex,entry]));
export function getDatabaseIllustration(speciesIndex){return bySpecies.get(speciesIndex)??null;}
export function listDatabaseIllustrations(){return catalog.entries;}
// Every form of the character this identity belongs to, in catalog order; empty without a form link.
export function databaseIllustrationForms(speciesIndex){
  const key=bySpecies.get(speciesIndex)?.form?.characterKey;
  return key?catalog.entries.filter(entry=>entry.form?.characterKey===key):[];
}
export function getDatabaseIllustrationStory(speciesIndex, locale = getLocale()) {
  const entry = getDatabaseIllustration(speciesIndex);
  return entry?.profileByLocale?.[locale] ?? null;
}
// A playable original (Owner 2026-11-03) is a regular registrable Dex entry; only art-only identities are rows here.
export function databaseIllustrationRow(speciesIndex){
  const entry=isPlayableProductOriginal(speciesIndex)?null:getDatabaseIllustration(speciesIndex);
  return entry?deepFreeze({...entry,kind:'ILLUSTRATION',state:'NOT_TRACKED',viewable:true,
    source:null,instanceCount:0,instances:[],evolutionRoutes:[]}):null;
}
export const DATABASE_ILLUSTRATION_COPY=deepFreeze({
  'zh-Hant':{label:'預定角色',status:'動作圖製作中，暫未開放取得；以下為預定資料。'},
  en:{label:'Planned partner',status:'Motion art in progress; not obtainable yet. The data below is planned.'},
  ja:{label:'予定キャラクター',status:'モーション制作中のため未解放です。以下は予定データです。'},
  th:{label:'คู่หูที่วางแผนไว้',status:'กำลังทำภาพเคลื่อนไหว ยังรับไม่ได้ ข้อมูลด้านล่างเป็นข้อมูลที่วางแผนไว้'},
  vi:{label:'Bạn đồng hành dự kiến',status:'Đang làm hoạt ảnh, chưa thể nhận. Dữ liệu bên dưới là dự kiến.'}
});
export function databaseIllustrationText(key,locale=getLocale()){
  const copy=Object.hasOwn(DATABASE_ILLUSTRATION_COPY,locale)?DATABASE_ILLUSTRATION_COPY[locale]:DATABASE_ILLUSTRATION_COPY['zh-Hant'];
  return Object.hasOwn(copy,key)?copy[key]:'';
}

// Owner 2026-11-03: an art-only original lists its planned links -- the partners that evolve or awaken into it
// and the forms it becomes -- from the provisional data. Display only: none of these routes is active yet.
const generationOf=index=>nativeSpecies.records[index]?.generationIndex??listProductOriginals().find(e=>e.speciesIndex===index)?.generationIndex??null;
const linkKind=to=>generationOf(to)===6?'AWAKEN_2':generationOf(to)===5?'AWAKEN':'EVOLVE';
export function databaseIllustrationLinks(speciesIndex){
  if(!databaseIllustrationRow(speciesIndex))return Object.freeze([]);
  const links=[];
  for(const e of listProductOriginals())for(const r of e.evolution)
    if(e.speciesIndex===speciesIndex||r.target===speciesIndex)links.push({from:e.speciesIndex,to:r.target});
  for(const x of PRODUCT_ORIGINAL_SPECIES.nativeInserts)if(x.target===speciesIndex)links.push({from:x.source,to:x.target});
  return deepFreeze(links.map(l=>({...l,kind:linkKind(l.to)})));
}
