import {listCageDefinitions} from '../cage/cageCatalog.js';
import {listGachaCageDefinitions} from '../cage/productCageCatalog.js';
import {cageUiImage,cageUiThumbnail} from './cageUiArt.js';

const definitions=new Map([...listCageDefinitions(),...listGachaCageDefinitions()].map(row=>[row.cageDefinitionIndex,row]));
// The cage's shop picture (Owner 2026-11-02: rendered from its 3D model, as the ranch
// draws it); the Waiting Room, which is never sold, uses its field picture.
// Location icons never infer ownership, placement or training from their art.
export function originalCageLocationArt(definitionIndex,baseUrl){
  const definition=definitions.get(definitionIndex);
  if(!definition)return null;
  // The gachapon's royal maps (Owner 2026-11-03) show their card picture like the shop's cages.
  return (definition.shopRecordIndex!==null||definition.gachaEdition?cageUiThumbnail(definition.moduleId):null)
    ??cageUiImage(definition.moduleId,baseUrl);
}
