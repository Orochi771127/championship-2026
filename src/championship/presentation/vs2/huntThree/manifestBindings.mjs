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
  },
  "hm02": {
    "directory": "assets/production/hunt/hm02-three-v5-20261023/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "27f6a977918b557b5195d2b64089df2d8288e8ed09ddf88eb20d2605b36d9a37",
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
      "sha256": "6656e447c3162f1ad0cc64cee02bbfdf222e059c9b7e34cd91b2dad0e6f0eb39",
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
      "sha256": "fec5aa4d6ac07ea016eebf371a61ebe59fba2c9f37c06ebc84729e2ef4e929a6",
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
      "sha256": "8ade45d33b64c3fff4205176e315d230c742a150ae92f14a15211a644f585ddb",
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
      "sha256": "84d78879e2c3ac4f01d5fc6bdb7a2df54a5990f0afa0057c7230ac44ac24748b",
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
      "sha256": "29a40a8d37bb81c6a2c9c1d68d7d7e15ae860cee15183fe8a91bb8a3ab483f96",
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
      "sha256": "81b05510c45a1259dd4c82296bebe7a259593b9292a8e8fd786341a86542bdac",
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
      "sha256": "8b01e58d395cef1a7ad217eec7630b9f387a62d1d1560dd24c568fb00b062f43",
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
    "directory": "assets/production/hunt/hm10-three-c1-20261026/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "c6ad1daf906bfb46323e3890a9eb55dcbc8d26b738590a04238782f279f72955",
      "bytes": 518
    },
    "fields": [
      "field_hm10_01"
    ],
    "worldSize": 2048,
    "appearanceApproved": true
  },
  "hm11": {
    "directory": "assets/production/hunt/hm11-three-c1-20261026/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "478e3443b28999d3efd5e3698f80638af3d638f79e1c32c3071c5f44c59135f1",
      "bytes": 518
    },
    "fields": [
      "field_hm11_01"
    ],
    "worldSize": 2048,
    "appearanceApproved": true
  },
  "hm13": {
    "directory": "assets/production/hunt/hm13-three-c1-20261026/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "3ad934e811ad7f76ed4688fa08b31abcc6ec27b85a1222cb27a1ad1b252aab01",
      "bytes": 539
    },
    "fields": [
      "field_hm13_01",
      "field_hm13_02"
    ],
    "worldSize": 2048,
    "appearanceApproved": true
  },
  "hm14": {
    "directory": "assets/production/hunt/hm14-three-c1-20261026/",
    "manifest": {
      "file": "manifest.json",
      "sha256": "765b25dbc6c9d8f6d60fd5421d8b17f65691d69fc61d7bcb73a5ec6830121f29",
      "bytes": 1013
    },
    "fields": [
      "field_hm14_01",
      "field_hm14_02"
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
