// Read-only encyclopedia art. These identities never enter playable species,
// registration, stats, moves, saves or evolution catalogs.
import catalog from '../../data/championship/database-illustrations.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from '../text/locale.js';

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
export function databaseIllustrationRow(speciesIndex){
  const entry=getDatabaseIllustration(speciesIndex);
  return entry?deepFreeze({...entry,kind:'ILLUSTRATION',state:'NOT_TRACKED',viewable:true,
    source:null,instanceCount:0,instances:[],evolutionRoutes:[]}):null;
}
export const DATABASE_ILLUSTRATION_COPY=deepFreeze({
  'zh-Hant':{label:'角色美術',status:'角色美術圖鑑；養成與對戰資料尚未開放。'},
  en:{label:'Character art',status:'Character art gallery. Raising and battle data are not available yet.'},
  ja:{label:'キャラクターアート',status:'キャラクターアート図鑑。育成・対戦データは未公開です。'},
  th:{label:'ภาพตัวละคร',status:'แกลเลอรีภาพตัวละคร ยังไม่มีข้อมูลการเลี้ยงและการต่อสู้'},
  vi:{label:'Tranh nhân vật',status:'Bộ sưu tập tranh nhân vật. Chưa có dữ liệu nuôi dưỡng và chiến đấu.'}
});
export function databaseIllustrationText(key,locale=getLocale()){
  const copy=Object.hasOwn(DATABASE_ILLUSTRATION_COPY,locale)?DATABASE_ILLUSTRATION_COPY[locale]:DATABASE_ILLUSTRATION_COPY['zh-Hant'];
  return Object.hasOwn(copy,key)?copy[key]:'';
}
