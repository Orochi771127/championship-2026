import {isOriginalRuntimeLocation} from '../../originalRuntimeLocation.js';

// Exact existing assets reviewed visually on 2026-10-23. Functional QA remains
// with the Owner; source manifest qaApproved values remain unchanged.
// HM08 remains 2048 square and is not an enlarged-map completion.
export const MAPS=Object.freeze({
  "hm01": {
    "directory": "assets/production/hunt/hm01-three-r1-20261022/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "b9e867f2c35ee06fbb52bd8deaefd73bb631e2e237b236c774ef3767e5e65bac",
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
  },
  "hm02": {
    "directory": "assets/production/hunt/hm02-three-v5-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "bf80512c1af1ac484fadf7b70fed9749e66da2c1594a7e16ecb53bfccc72bbf3",
      "bytes": 1038
    },
    "fields": [
      "field_hm02_01",
      "field_hm02_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm03": {
    "directory": "assets/production/hunt/hm03-three-v6-review-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "c228a402aefc5bcb743ce7fefc64538022d4ab1f51feb2cf0d6b151bcbb10243",
      "bytes": 728
    },
    "fields": [
      "field_hm03_01",
      "field_hm03_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm04": {
    "directory": "assets/production/hunt/hm04-three-v5-review-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "4ad2c6c30e693e3dd247060684307f881575d1d7ff69ed8ba568c21808e87e4d",
      "bytes": 724
    },
    "fields": [
      "field_hm04_01",
      "field_hm04_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm05": {
    "directory": "assets/production/hunt/hm05-three-v7-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "85d62eedba37d943ae5b9073ffb5d18e76dc8fedcedc7bb706e91fa7827a3995",
      "bytes": 717
    },
    "fields": [
      "field_hm05_01",
      "field_hm05_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm06": {
    "directory": "assets/production/hunt/hm06-three-v4-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "16a722b02513c3f945118aa75ec2d977a2b5e1cb74a7434afc6bbb954a57d647",
      "bytes": 714
    },
    "fields": [
      "field_hm06_01",
      "field_hm06_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm09": {
    "directory": "assets/production/hunt/hm09-three-v7-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "90c8dfe6c0ff63abd53feb1dc07bc47c7969fb8e9a653704ef180fb261e7b99c",
      "bytes": 405
    },
    "fields": [
      "field_hm09_01"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm16": {
    "directory": "assets/production/hunt/hm16-three-v6-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "15d7ac6ad41dd1c7b53c1adee5aa504a0cc51ff1cd0daa1b4f762ddb1759008b",
      "bytes": 768
    },
    "fields": [
      "field_hm16_01",
      "field_hm16_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm18": {
    "directory": "assets/production/hunt/hm18-three-v3-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "ced49aec4f59220cb21eb199f512a0aa1d66cf6c49f1afddfa14d6a334b59a52",
      "bytes": 763
    },
    "fields": [
      "field_hm18_01",
      "field_hm18_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm15": {
    "directory": "assets/production/hunt/hm15-three-v6-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "a5eb705de633d5bd713422b055e093565a97f1154d9174b37bdbd10413943ebf",
      "bytes": 990
    },
    "fields": [
      "field_hm15_01",
      "field_hm15_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm17": {
    "directory": "assets/production/hunt/hm17-three-v4-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "40f96a417b8233ee78abaf66570dceec664203adf06781d06db215b26126e2ea",
      "bytes": 768
    },
    "fields": [
      "field_hm17_01",
      "field_hm17_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  }
});

export function huntThreeProductionRequest(location=globalThis.location,fieldId=null){
  if(!isOriginalRuntimeLocation(location))return null;
  const entry=Object.entries(MAPS).find(([,map])=>map.fields.includes(fieldId));
  return entry?{key:entry[0],...entry[1]}:null;
}
