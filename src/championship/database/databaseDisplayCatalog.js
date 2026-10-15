import {listProductExtensions,planUltimateDisplayOrder} from '../contracts/productSpeciesExtensions.js';
// Owner-approved presentation catalog. Codes are stored explicitly, never
// assigned from array position, species IDs, locale or the active filter.
import nativeCatalog from '../../data/championship/database-display.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';

const enabled=listProductExtensions().every(e=>e.runtimeReady&&e.evolutionReady);
const planned=enabled?planUltimateDisplayOrder(nativeCatalog.entries):[];
const ultimate=new Map(planned.map(e=>[e.speciesIndex,e]));
const catalog=enabled?{...nativeCatalog,entries:[...nativeCatalog.entries.map(e=>ultimate.get(e.speciesIndex)??e),...listProductExtensions().map(e=>({...ultimate.get(e.speciesIndex),entryKey:`dex-species-${e.speciesIndex}`,contentStatus:'PUBLISHED',legacyBookOrdinal:null,firstPublishedRevision:2}))].sort((a,b)=>a.numberingStageIndex-b.numberingStageIndex||a.serial-b.serial)}:nativeCatalog;
export const DATABASE_DISPLAY_CATALOG = deepFreeze(catalog);
const bySpecies = new Map(catalog.entries.map(entry=>[entry.speciesIndex,entry]));
export function getDatabaseDisplayEntry(speciesIndex) { return bySpecies.get(speciesIndex) ?? null; }

// The original 216-row registration projection is unchanged. Eggs are
// browseable content, with no permanent registration history in this save.
export function databaseDisplayRows(book, stageIndex = null) {
  const regular = new Map(book.entries.map(row=>[row.speciesIndex,row]));
  return catalog.entries.filter(entry=>entry.contentStatus!=='RETIRED' &&
    (stageIndex===null || entry.numberingStageIndex===stageIndex)).map(entry=>({
      ...(regular.get(entry.speciesIndex) ?? {kind:entry.numberingStageIndex===0?'EGG':'REGULAR',state:entry.numberingStageIndex===0?'NOT_TRACKED':'UNDISCOVERED',instanceCount:0}),
      ...entry
    }));
}

