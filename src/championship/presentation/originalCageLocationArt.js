import {listCageDefinitions} from '../cage/cageCatalog.js';
import {originalShopCageThumbnail} from './originalShopCageArt.js';
import {cageUiImage} from './cageUiArt.js';

const definitions=new Map(listCageDefinitions().map(row=>[row.cageDefinitionIndex,row]));
// Reuse the selected original shop picture; Waiting Room uses its existing field.
// Location icons never infer ownership, placement or training from their art.
export function originalCageLocationArt(definitionIndex,baseUrl){
  const definition=definitions.get(definitionIndex);
  if(!definition)return null;
  return originalShopCageThumbnail(definition.shopRecordIndex,baseUrl)?.src
    ??cageUiImage(definition.moduleId,baseUrl);
}
