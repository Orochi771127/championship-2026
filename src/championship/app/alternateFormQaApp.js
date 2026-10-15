import {setupQaDiagnostics} from './alternateFormQaDiagnostics.js';
// QA entry only. Real app, renderer, storage guards and save validation remain intact.
import {createChampionshipStandaloneApp as createRealApp} from './championshipStandaloneApp.js?alternate-form-qa-real';
import fixture from '../../../qa/alternate-form-save.json' with {type:'json'};
import {serializeChampionshipModernSave,CHAMPIONSHIP_MODERN_SAVE_KEY} from './championshipStandaloneSave.js';
export * from './championshipStandaloneApp.js?alternate-form-qa-real';
import {getIsolatedQaStorage} from './alternateFormQaStorage.js';
export {getIsolatedQaStorage} from './alternateFormQaStorage.js';
export function createChampionshipStandaloneApp(options){
 if(!globalThis.location?.pathname.endsWith('/alternate-form-qa.html'))throw Error('ALTERNATE_FORM_QA_ENTRY_REQUIRED');
 // sessionStorage is per-tab and survives reload. It never touches player localStorage.
 const adapter=getIsolatedQaStorage();
 const storage={...adapter,getItem:key=>adapter.getItem(key)??(key===CHAMPIONSHIP_MODERN_SAVE_KEY?serializeChampionshipModernSave(fixture):null)};
 // Synthetic initial read only. Every actual write is made by the real PersistentSavePort.
 const app=createRealApp({...options,storage,locks:null});
 setupQaDiagnostics(app,storage);
 return app;
}
