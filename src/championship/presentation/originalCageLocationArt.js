import {listCageDefinitions} from '../cage/cageCatalog.js';
import {originalShopCageThumbnail} from './originalShopCageArt.js';
import {cageUiImage,cageUiThumbnail} from './cageUiArt.js';

const definitions=new Map(listCageDefinitions().map(row=>[row.cageDefinitionIndex,row]));
// The cage's shop picture (Owner 2026-11-02: rendered from its 3D model, as the ranch
// draws it); then the selected original shop picture; Waiting Room uses its field.
// Location icons never infer ownership, placement or training from their art.
export function originalCageLocationArt(definitionIndex,baseUrl){
  const definition=definitions.get(definitionIndex);
  if(!definition)return null;
  return (definition.shopRecordIndex!==null?cageUiThumbnail(definition.moduleId):null)
    ??originalShopCageThumbnail(definition.shopRecordIndex,baseUrl)?.src
    ??cageUiImage(definition.moduleId,baseUrl);
}
