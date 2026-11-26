import {isOriginalRuntimeLocation} from '../../originalRuntimeLocation.js';

// Exact existing assets reviewed visually on 2026-10-23. Functional QA remains
// with the Owner; source manifest qaApproved values remain unchanged.
// HM08 grew to 2880 on 2026-11-26 (r2: original east/south canyon on the authoring masters, re-baked day and night).
// HM10/11/13/14 grew to 2880 on 2026-11-25 (c2: untrimmed candidate geometry; HM14 rebuilt with core-style extension cliffs).
// HM10/13 c3 (2026-11-26): the extension areas carry the maps' own props, which block their tiles.
export const MAPS=Object.freeze({
  "hm01": {
    "directory": "assets/production/hunt/hm01-three-r1-20261022/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "40ec0aed8ef8e58fb748075a9a3d7655deffb466f8167e3501fc5cacfece8c5f",
      "bytes": 3873
    },
    "fields": [
      "field_hm01_01",
      "field_hm01_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm08": {
    "directory": "assets/production/hunt/hm08-three-r2-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "9b4772908ecff5f7d2ffd46bc6ba12a59dc1cf396d1067e6bc18dc4df6dcd0de",
      "bytes": 2873
    },
    "fields": [
      "field_hm08_01",
      "field_hm08_02"
    ],
    "worldSize": 2880,
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
      "sha256": "2d6ee3874a6368c5c551d570a1436b2fadbfd83bb171039db547e42d92eb5be5",
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
      "sha256": "a4efc464f173f9b4a7a3cb0839c5bf1aac4de3619cfbed2cfc57c00be8316331",
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
  },
  "hm10": {
    "directory": "assets/production/hunt/hm10-three-c3-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "276f6be660a0d7e0bfba96ae0b05bff3ea5ec7c41f33c55c958332e0afe4add6",
      "bytes": 413
    },
    "fields": [
      "field_hm10_01"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm11": {
    "directory": "assets/production/hunt/hm11-three-c2-20261125/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "0633c1b973a5c507948ddb6665d52c76df69602c4a917043763243c2bb39ae34",
      "bytes": 413
    },
    "fields": [
      "field_hm11_01"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm13": {
    "directory": "assets/production/hunt/hm13-three-c3-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "1879a9ce1f7b3fd399e5e3d1c63d63d997c6c606c4ddeaf5d827847f7e0f9440",
      "bytes": 429
    },
    "fields": [
      "field_hm13_01",
      "field_hm13_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm14": {
    "directory": "assets/production/hunt/hm14-three-c2-20261125/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "c3314039b112bd3cee7b4b7ebe989289c74a303e82a39c8cbb43390cfb9cb3de",
      "bytes": 778
    },
    "fields": [
      "field_hm14_01",
      "field_hm14_02"
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
