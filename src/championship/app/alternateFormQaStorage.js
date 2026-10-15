// The isolated QA HTML owns its session adapter. This helper performs no writes.
export const ALTERNATE_FORM_QA_STORAGE_PREFIX='championshipAlternateFormsQA:r1:';
export function getIsolatedQaStorage(){
 if(!globalThis.location?.pathname.endsWith('/alternate-form-qa.html'))throw Error('ALTERNATE_FORM_QA_ENTRY_REQUIRED');
 const adapter=globalThis.__alternateFormQaStorage;
 if(!adapter||adapter.namespace!==ALTERNATE_FORM_QA_STORAGE_PREFIX||!['getItem','setItem','removeItem'].every(k=>typeof adapter[k]==='function'))throw Error('ALTERNATE_FORM_QA_STORAGE_REQUIRED');
 return adapter;
}
