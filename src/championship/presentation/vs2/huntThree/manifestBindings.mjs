import {isOriginalRuntimeLocation} from '../../originalRuntimeLocation.js';

// Exact existing assets reviewed visually on 2026-10-23. Functional QA remains
// with the Owner; source manifest qaApproved values remain unchanged.
// HM08 grew to 2880 on 2026-11-26 (r2: original east/south canyon on the authoring masters, re-baked day and night).
// HM10/11/13/14 grew to 2880 on 2026-11-25 (c2: untrimmed candidate geometry; HM14 rebuilt with core-style extension cliffs).
// HM10/13 c3 (2026-11-26): the extension areas carry the maps' own props, which block their tiles.
// HM16/17/18 (2026-11-26): the extension areas carry copies of each map's own landmarks, which block their tiles.
// HM14 c4 (2026-11-26): the extension plateaus carry the original area's own boulders along their rims.
// HM14 c4 (2026-11-26): the extension plateaus are rounded mesas built in Blender and carry the original area's own boulders.
// HM14-HM18 (2026-11-26): same models with the vertex data nothing reads dropped (unused UV sets, COLOR_1, float colours as bytes).
// HM02-HM06 (2026-11-26): same geometry, Draco-compressed at file level (folders v*d); 14.8 MB -> 5.2 MB of GLB.
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
    "directory": "assets/production/hunt/hm02-three-v5d-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "68e5a2a99739567a3468ee3138e4d80c4bb32293641c01443dcf3bd483e249a3",
      "bytes": 1041
    },
    "fields": [
      "field_hm02_01",
      "field_hm02_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm03": {
    "directory": "assets/production/hunt/hm03-three-v6d-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "89dee26cff260af9c9ec7c6a6e49d94a9ff34bc3201d6d468486265589ec463d",
      "bytes": 732
    },
    "fields": [
      "field_hm03_01",
      "field_hm03_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm04": {
    "directory": "assets/production/hunt/hm04-three-v5d-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "08d5256e8add8cc81ad4fd67de11743f505afeb14fc27d99f5ef5a6141235da7",
      "bytes": 728
    },
    "fields": [
      "field_hm04_01",
      "field_hm04_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm05": {
    "directory": "assets/production/hunt/hm05-three-v7d-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "d3d368baf3e11029e90fd312cef3fcbca460a0aa938eece531dd9ea42d3f0225",
      "bytes": 720
    },
    "fields": [
      "field_hm05_01",
      "field_hm05_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm06": {
    "directory": "assets/production/hunt/hm06-three-v4d-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "228c1a37309b65e58447383176d02b54becdbcc949a2a310bca15310a7826bec",
      "bytes": 718
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
    "directory": "assets/production/hunt/hm16-three-v8-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "3c962bd581093f490872674e5ae4a73a89ddf23f7d63776c6b4851d3b388ae44",
      "bytes": 776
    },
    "fields": [
      "field_hm16_01",
      "field_hm16_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm18": {
    "directory": "assets/production/hunt/hm18-three-v5-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "71ae44e5288da548aa8e3b99f784e63250bf3c59ee5d834e537935b165d8ff28",
      "bytes": 771
    },
    "fields": [
      "field_hm18_01",
      "field_hm18_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm15": {
    "directory": "assets/production/hunt/hm15-three-v7-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "4ae67ffbcac2b6041636eadeaf5ba046a2ae2b350d5efad0c1b724a6a598d49e",
      "bytes": 998
    },
    "fields": [
      "field_hm15_01",
      "field_hm15_02"
    ],
    "worldSize": 2880,
    "appearanceApproved": true
  },
  "hm17": {
    "directory": "assets/production/hunt/hm17-three-v6-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "e11fbd0aa4169f06d458924fda8b224810ca60e1aa53f40b9b3a35d17fd8c29d",
      "bytes": 776
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
    "directory": "assets/production/hunt/hm14-three-c4-20261126/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "baa18f6506b7c146e9bd66a6fa912e18fb70c6950c295d82c4447e0d3f3e8642",
      "bytes": 771
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
