import {listCageDefinitions} from '../cage/cageCatalog.js';
import {cageUiImage,cageUiThumbnail} from './cageUiArt.js';

const definitions=new Map(listCageDefinitions().map(row=>[row.cageDefinitionIndex,row]));
// The cage's shop picture (Owner 2026-11-02: rendered from its 3D model, as the ranch
// draws it); the Waiting Room, which is never sold, uses its field picture.
// Location icons never infer ownership, placement or training from their art.
export function originalCageLocationArt(definitionIndex,baseUrl){
  const definition=definitions.get(definitionIndex);
  if(!definition)return null;
  return (definition.shopRecordIndex!==null?cageUiThumbnail(definition.moduleId):null)
    ??cageUiImage(definition.moduleId,baseUrl);
}
