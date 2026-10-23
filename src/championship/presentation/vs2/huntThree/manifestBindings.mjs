import {isOriginalRuntimeLocation} from '../../originalRuntimeLocation.js';

// Exact existing assets reviewed visually on 2026-10-23. Functional QA remains
// with the Owner; source manifest qaApproved values remain unchanged.
// HM08 remains 2048 square and is not an enlarged-map completion.
export const MAPS=Object.freeze({
  "hm01": {
    "directory": "assets/production/hunt/hm01-three-r1-20261022/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "4404b66afeaf5ceeb270bb02a4a50106f7fcab24066e671340e3e9f22ff516e4",
      "bytes": 3053
    },
    "fields": [
      "field_hm01_01",
      "field_hm01_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm08": {
    "directory": "assets/production/hunt/hm08-three-r1-20261022/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "be78e84adcdd90fadefbaeb3c40f864d6d90b2e4f9ece2897ebb441b37a3d583",
      "bytes": 2462
    },
    "fields": [
      "field_hm08_01",
      "field_hm08_02"
    ],
    "worldSize": 2048,
    "appearanceApproved": true
  }
});

export function huntThreeProductionRequest(location=globalThis.location,fieldId=null){
  if(!isOriginalRuntimeLocation(location))return null;
  const entry=Object.entries(MAPS).find(([,map])=>map.fields.includes(fieldId));
  return entry?{key:entry[0],...entry[1]}:null;
}
