import {listProductExtensions,planUltimateDisplayOrder} from '../contracts/productSpeciesExtensions.js';
// Owner-approved presentation catalog. Codes are stored explicitly, never
// assigned from array position, species IDs, locale or the active filter.
import nativeCatalog from '../../data/championship/database-display.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {listDatabaseIllustrations,databaseIllustrationRow} from './databaseIllustrations.js';

// Owner-approved 2026-10-17 identity correction. Keep the archived native
// receipt, stable species IDs and legacy book ordinals; correct live labels only.
const lionDisplayCorrections=new Map([[121,{serial:50,displayCode:'MA50'}],[125,{serial:62,displayCode:'MA62'}]]);
const correctedNative={...nativeCatalog,entries:nativeCatalog.entries.map(e=>({...e,...lionDisplayCorrections.get(e.speciesIndex)}))};
const enabled=listProductExtensions().every(e=>e.runtimeReady&&e.evolutionReady);
const planned=enabled?planUltimateDisplayOrder(correctedNative.entries):[];
const ultimate=new Map(planned.map(e=>[e.speciesIndex,e]));
const catalog=enabled?{...correctedNative,entries:[...correctedNative.entries.map(e=>ultimate.get(e.speciesIndex)??e),...listProductExtensions().map(e=>({...(ultimate.get(e.speciesIndex)??{speciesIndex:e.speciesIndex,speciesId:e.speciesId,numberingStageIndex:e.generationIndex,serial:e.displaySerial,displayCode:`GR${e.displaySerial}`}),entryKey:`dex-species-${e.speciesIndex}`,contentStatus:'PUBLISHED',legacyBookOrdinal:null,firstPublishedRevision:2}))].sort((a,b)=>a.numberingStageIndex-b.numberingStageIndex||a.serial-b.serial)}:{...correctedNative,entries:[...correctedNative.entries].sort((a,b)=>a.numberingStageIndex-b.numberingStageIndex||a.serial-b.serial)};
// Illustration entries have their assigned evolution stage and serial.
const displayCatalog={...catalog,entries:[...catalog.entries,...listDatabaseIllustrations().map(entry=>({
  ...databaseIllustrationRow(entry.speciesIndex),entryKey:`dex-illustration-${entry.speciesIndex}`,
  numberingStageIndex:entry.numberingStageIndex,serial:entry.serial,
  legacyBookOrdinal:null,contentStatus:'PUBLISHED'
}))].sort((a,b)=>a.numberingStageIndex-b.numberingStageIndex||a.serial-b.serial)};
export const DATABASE_DISPLAY_CATALOG = deepFreeze(displayCatalog);
const bySpecies = new Map(displayCatalog.entries.map(entry=>[entry.speciesIndex,entry]));
export function getDatabaseDisplayEntry(speciesIndex) { return bySpecies.get(speciesIndex) ?? null; }

// The original 216-row registration projection is unchanged. Eggs are
// browseable content, with no permanent registration history in this save.
export function databaseDisplayRows(book, stageIndex = null) {
  const regular = new Map(book.entries.map(row=>[row.speciesIndex,row]));
  return displayCatalog.entries.filter(entry=>entry.contentStatus!=='RETIRED' &&
    (stageIndex===null || (stageIndex==='ART'?entry.kind==='ILLUSTRATION':entry.numberingStageIndex===stageIndex))).map(entry=>({
      ...(regular.get(entry.speciesIndex) ?? {kind:entry.numberingStageIndex===0?'EGG':'REGULAR',state:entry.numberingStageIndex===0?'NOT_TRACKED':'UNDISCOVERED',instanceCount:0}),
      ...entry
    }));
}
