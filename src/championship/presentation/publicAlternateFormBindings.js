import catalog from '../../data/championship/public-alternate-form-bindings.v1.json' with {type:'json'};
import {publicCharacterConfig} from './publicCharacterCatalog.js';
// Read-only native geometry bindings. Authoring QA and source-bank evidence
// remain in alternateFormAssetContracts and its original source catalog.
export const ACTIVE_ALTERNATE_FORM_ASSETS=Object.freeze(catalog.characters.map(row=>{
 const selected=publicCharacterConfig(row.speciesId);
 if(!selected||selected.entityId!==row.entityId||row.speciesId!==`species-${row.speciesIndex}`
   ||!/^[-a-z0-9_]+$/.test(row.motionDonorEntityId))throw Error('PUBLIC_ALTERNATE_BINDING');
 return Object.freeze(row);
}));
