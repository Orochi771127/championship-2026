// QA import-map adapter. Save port and all key/value guards remain original.
import {createChampionshipDiagnosticPort as diagnostic,createChampionshipPreferencePort as preferences} from './ChampionshipPersistentSavePort.js?alternate-form-qa-real';
import {getIsolatedQaStorage} from './alternateFormQaStorage.js';
export * from './ChampionshipPersistentSavePort.js?alternate-form-qa-real';
const isolated=()=>{if(!globalThis.location?.pathname.endsWith('/alternate-form-qa.html'))throw Error('ALTERNATE_FORM_QA_ENTRY_REQUIRED');return getIsolatedQaStorage();};
export function createChampionshipDiagnosticPort(){return diagnostic(isolated());}
export function createChampionshipPreferencePort(options={}){return preferences({...options,storage:isolated()});}
