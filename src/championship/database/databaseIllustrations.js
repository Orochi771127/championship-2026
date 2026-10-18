// Read-only encyclopedia art. These identities never enter playable species,
// registration, stats, moves, saves or evolution catalogs.
import catalog from '../../data/championship/database-illustrations.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {getLocale} from '../text/locale.js';

const ids=new Set(),codes=new Set();
for(const entry of catalog.entries){
  if(!Number.isSafeInteger(entry.speciesIndex)||entry.speciesIndex<=230
    ||entry.speciesId!==`species-${entry.speciesIndex}`||ids.has(entry.speciesIndex)
    ||!/^ART\d{2}$/.test(entry.displayCode)||codes.has(entry.displayCode)
    ||typeof entry.displayName!=='string'||!entry.displayName.trim())throw Error('DATABASE_ILLUSTRATION_IDENTITY');
  ids.add(entry.speciesIndex);codes.add(entry.displayCode);
}
export const DATABASE_ILLUSTRATIONS=deepFreeze(catalog);
const bySpecies=new Map(catalog.entries.map(entry=>[entry.speciesIndex,entry]));
export function getDatabaseIllustration(speciesIndex){return bySpecies.get(speciesIndex)??null;}
export function listDatabaseIllustrations(){return catalog.entries;}
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
