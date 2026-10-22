// Public test-only identity pin for the owner-approved 2026-10-22 twenty portraits.
// No source masters, private approval records, or runtime imports.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const APPROVED20 = Object.freeze([
  {
    "speciesIndex": 20,
    "speciesId": "species-020",
    "displayCode": "B201",
    "src": "assets/production/database-first10-20261022/species-020.display.5ef180e88ffc6323.webp",
    "width": 864,
    "height": 744,
    "sha256": "5ef180e88ffc632393d0c870e89221b96058f6aafa9def1dc4cbc3394c30586f",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-020.thumbnail.2a3d5e3fed18d7e6.webp",
      "width": 96,
      "height": 83,
      "sha256": "2a3d5e3fed18d7e666d8166f24f4b19b60ccff9d17c017f2d629656fbd762cb9"
    }
  },
  {
    "speciesIndex": 21,
    "speciesId": "species-021",
    "displayCode": "B202",
    "src": "assets/production/database-first10-20261022/species-021.display.caf4dbcb06e57df0.webp",
    "width": 864,
    "height": 691,
    "sha256": "caf4dbcb06e57df0574e344f0eb4e7e87305834ae2e9c6fbbe64639d2c334a91",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-021.thumbnail.c58be9cc8cef3272.webp",
      "width": 96,
      "height": 77,
      "sha256": "c58be9cc8cef32720546acd55ce6fbdc40d6344504610e647817924ac7a5e7e4"
    }
  },
  {
    "speciesIndex": 22,
    "speciesId": "species-022",
    "displayCode": "B204",
    "src": "assets/production/database-first10-20261022/species-022.display.067597b6716c69b1.webp",
    "width": 864,
    "height": 691,
    "sha256": "067597b6716c69b1ada9eef5640de343aa92446f6ca5cfa82a3dfde9b43c76b2",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-022.thumbnail.2f3e92fbd552fe35.webp",
      "width": 96,
      "height": 77,
      "sha256": "2f3e92fbd552fe355af50a7d4806c1426339e4adc8649f0880b03c2513efde4b"
    }
  },
  {
    "speciesIndex": 23,
    "speciesId": "species-023",
    "displayCode": "B205",
    "src": "assets/production/database-first10-20261022/species-023.display.20caf7321c898096.webp",
    "width": 864,
    "height": 790,
    "sha256": "20caf7321c8980960e41e6cc919942c5a686f1bb51ac527cf7d83d9512c6d535",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-023.thumbnail.b69d170b3c5a2a21.webp",
      "width": 96,
      "height": 88,
      "sha256": "b69d170b3c5a2a21941d012a199adb8b9a7c67d9044346b156404a6ef419316a"
    }
  },
  {
    "speciesIndex": 24,
    "speciesId": "species-024",
    "displayCode": "B206",
    "src": "assets/production/database-first10-20261022/species-024.display.0e09b1e05edebddd.webp",
    "width": 864,
    "height": 790,
    "sha256": "0e09b1e05edebdddcbda3d12c6122db82304fff3755bb78b7c274f5a04294bb0",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-024.thumbnail.8d77d87e06f21080.webp",
      "width": 96,
      "height": 88,
      "sha256": "8d77d87e06f21080ce299886103478fb6899cff3024da2ba8656ae6423a7150f"
    }
  },
  {
    "speciesIndex": 25,
    "speciesId": "species-025",
    "displayCode": "B207",
    "src": "assets/production/database-first10-20261022/species-025.display.3e8f466f9e4014d5.webp",
    "width": 864,
    "height": 576,
    "sha256": "3e8f466f9e4014d50d35e7a48e0437778a2dcf6f74b560efdf815d8f7648712a",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-025.thumbnail.7f3e024caa23e0a9.webp",
      "width": 96,
      "height": 64,
      "sha256": "7f3e024caa23e0a91ba11f7a353c373b1be382d9f2860dcc15d3ac7b64c0a2a5"
    }
  },
  {
    "speciesIndex": 26,
    "speciesId": "species-026",
    "displayCode": "B208",
    "src": "assets/production/database-first10-20261022/species-026.display.ec2109a52294be0e.webp",
    "width": 864,
    "height": 773,
    "sha256": "ec2109a52294be0e31df1c5cc6a73d96cbbf4fd1643314c3db73e8ed246a8527",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-026.thumbnail.6ddd286162a8cb38.webp",
      "width": 96,
      "height": 86,
      "sha256": "6ddd286162a8cb38fc22b8bde885391499baf0e2c11ea46d88a2ab04c267c70d"
    }
  },
  {
    "speciesIndex": 27,
    "speciesId": "species-027",
    "displayCode": "B209",
    "src": "assets/production/database-first10-20261022/species-027.display.cc716b8480f2f0e9.webp",
    "width": 864,
    "height": 790,
    "sha256": "cc716b8480f2f0e9e9ff4d0a178b86d5de0a1eef0d48e4c4772b753275a5037b",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-027.thumbnail.18165145e0e60ab4.webp",
      "width": 96,
      "height": 88,
      "sha256": "18165145e0e60ab428da8ef817efff8d67d31a106ef204b80e8cc9773512eaaf"
    }
  },
  {
    "speciesIndex": 30,
    "speciesId": "species-030",
    "displayCode": "B214",
    "src": "assets/production/database-second10-20261022/species-030.display.52b9940dee31e64e.webp",
    "width": 864,
    "height": 720,
    "sha256": "52b9940dee31e64ea9e3fa7490bee9976f2999091fd7907157ba972f2ba5c166",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-030.thumbnail.3f91917406bc5bee.webp",
      "width": 96,
      "height": 80,
      "sha256": "3f91917406bc5beeb554cac88a9b6f1f89c2955217a94a504ee90c87bea7be0e"
    }
  },
  {
    "speciesIndex": 31,
    "speciesId": "species-031",
    "displayCode": "B212",
    "src": "assets/production/database-first10-20261022/species-031.display.e9bfa934de54b2fa.webp",
    "width": 864,
    "height": 648,
    "sha256": "e9bfa934de54b2fa5a1808f5c0071fe5052a8fa664c3c8cb315e798a4d25e15a",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-031.thumbnail.352c9a5ed964b78b.webp",
      "width": 96,
      "height": 72,
      "sha256": "352c9a5ed964b78b1dad7084b19c5d645f50ba40eac422ff80e3b0c894a615e2"
    }
  },
  {
    "speciesIndex": 32,
    "speciesId": "species-032",
    "displayCode": "B203",
    "src": "assets/production/database-first10-20261022/species-032.display.625673a54275dc3f.webp",
    "width": 864,
    "height": 778,
    "sha256": "625673a54275dc3fa69633200a06185a3a29caade5b8d358af5149386e160ea7",
    "thumbnail": {
      "src": "assets/production/database-first10-20261022/species-032.thumbnail.866d9788dad25bdd.webp",
      "width": 96,
      "height": 86,
      "sha256": "866d9788dad25bdddbc0d87ed52f8b141653ed962ff62e0d7ff461800e7f8ab8"
    }
  },
  {
    "speciesIndex": 74,
    "speciesId": "species-074",
    "displayCode": "MA06",
    "src": "assets/production/database-second10-20261022/species-074.display.0409f469846b3e78.webp",
    "width": 752,
    "height": 864,
    "sha256": "0409f469846b3e78567405973eb9d5a001dad4d272ab31d3d63f96e0d5093f35",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-074.thumbnail.44762c6577c0939b.webp",
      "width": 84,
      "height": 96,
      "sha256": "44762c6577c0939b29fae6c7d1cb173d6336590c2b1ee4ef4ecb419f4471a786"
    }
  },
  {
    "speciesIndex": 80,
    "speciesId": "species-080",
    "displayCode": "MA12",
    "src": "assets/production/database-second10-20261022/species-080.display.ba3ebc3506ffabf1.webp",
    "width": 864,
    "height": 576,
    "sha256": "ba3ebc3506ffabf19281d2e7ae38063163e72fa79f5c9cd303777fc0f40fc5d4",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-080.thumbnail.d1144d84a1273c16.webp",
      "width": 96,
      "height": 64,
      "sha256": "d1144d84a1273c161db2b42fb4ab8f970aa344590f9c3e0137aa949506688c94"
    }
  },
  {
    "speciesIndex": 82,
    "speciesId": "species-082",
    "displayCode": "MA15",
    "src": "assets/production/database-second10-20261022/species-082.display.88e0cc7da3da641b.webp",
    "width": 864,
    "height": 576,
    "sha256": "88e0cc7da3da641ba480a841676e8197ca5058b1b98a8136e2b4699ffb2830b5",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-082.thumbnail.b9620a9389f754e1.webp",
      "width": 96,
      "height": 64,
      "sha256": "b9620a9389f754e1859bc469b1d182cd8b2cb460885c5c9f90f88b6c9721e383"
    }
  },
  {
    "speciesIndex": 85,
    "speciesId": "species-085",
    "displayCode": "MA17",
    "src": "assets/production/database-second10-20261022/species-085.display.9c38ad0a143b740a.webp",
    "width": 864,
    "height": 576,
    "sha256": "9c38ad0a143b740a6429b6815cba388b303b86cf0951de8a651a698ccfb644f1",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-085.thumbnail.ade4e58a4eb1c6c8.webp",
      "width": 96,
      "height": 64,
      "sha256": "ade4e58a4eb1c6c8446e3701a5bdd3cb0ea7879c701b01e6278313ea04ed584a"
    }
  },
  {
    "speciesIndex": 86,
    "speciesId": "species-086",
    "displayCode": "MA18",
    "src": "assets/production/database-second10-20261022/species-086.display.3ca46cc6ec68111d.webp",
    "width": 864,
    "height": 648,
    "sha256": "3ca46cc6ec68111d2fcef061dbd25f475d595a7c42f7033e98a045018f338239",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-086.thumbnail.32b65b3a0faec069.webp",
      "width": 96,
      "height": 72,
      "sha256": "32b65b3a0faec069566795f87faa80ac6ddecadf346135c78efd6a80d2d0f2dc"
    }
  },
  {
    "speciesIndex": 87,
    "speciesId": "species-087",
    "displayCode": "MA21",
    "src": "assets/production/database-second10-20261022/species-087.display.3f18f5b3830cf103.webp",
    "width": 864,
    "height": 648,
    "sha256": "3f18f5b3830cf103a97288e31c806a418200fbb117e0aaa3c9d829c345c647fa",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-087.thumbnail.fea962df6b8d108a.webp",
      "width": 96,
      "height": 72,
      "sha256": "fea962df6b8d108a5b428e1a09baa1a7cab312212cb1df038380e4a3749a25c9"
    }
  },
  {
    "speciesIndex": 88,
    "speciesId": "species-088",
    "displayCode": "MA22",
    "src": "assets/production/database-second10-20261022/species-088.display.4a4c51aadc0ebe47.webp",
    "width": 864,
    "height": 790,
    "sha256": "4a4c51aadc0ebe477185d4d7c2767e7bfed2f3fde84ca3dc56379d38db13bcdd",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-088.thumbnail.b3dfdf67878868c1.webp",
      "width": 96,
      "height": 88,
      "sha256": "b3dfdf67878868c1ecfe3873fb313d1359075fd040e06664c180755db46caac3"
    }
  },
  {
    "speciesIndex": 94,
    "speciesId": "species-094",
    "displayCode": "MA31",
    "src": "assets/production/database-second10-20261022/species-094.display.03239efb7b3d25e3.webp",
    "width": 864,
    "height": 864,
    "sha256": "03239efb7b3d25e3921cf7c4d7899706ff2f696f5fdcbe01a2397d3a6341f601",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-094.thumbnail.7c53e348532f9f28.webp",
      "width": 96,
      "height": 96,
      "sha256": "7c53e348532f9f28ea458f978bbcff7211f534633e4d8eac745eb80c26682977"
    }
  },
  {
    "speciesIndex": 95,
    "speciesId": "species-095",
    "displayCode": "MA32",
    "src": "assets/production/database-second10-20261022/species-095.display.3639b5847d5ed1ce.webp",
    "width": 864,
    "height": 797,
    "sha256": "3639b5847d5ed1ce6b285c193308d4387b7872f49dbbea1d29fa68ff95d0435c",
    "thumbnail": {
      "src": "assets/production/database-second10-20261022/species-095.thumbnail.31dde55aba84d7ef.webp",
      "width": 96,
      "height": 89,
      "sha256": "31dde55aba84d7ef830cdbf9e4c4d5713113ef1cf61dd8b6e6adfe7034aca38b"
    }
  }
].map(Object.freeze));
const APPROVED20_IDS = Object.freeze([20,21,22,23,24,25,26,27,30,31,32,74,80,82,85,86,87,88,94,95]);
const PRIOR194_SHA256 = 'e6970c2ae7086bdf31cec85bbc68021ce04d2351020b92db355109efa5a2f8c4';
function assertApproved20Registry(catalog) {
  assert.equal(catalog.entries.length,214,'Exactly 194 prior heroes plus the approved20');
  assert.equal(new Set(catalog.entries.map(e=>e.speciesIndex)).size,214,'No duplicate species');
  assert.deepEqual(APPROVED20.map(e=>e.speciesIndex),APPROVED20_IDS);
  for(const expected of APPROVED20) assert.deepEqual(catalog.entries.find(e=>e.speciesIndex===expected.speciesIndex),expected,'Approved20 full identity/asset metadata drift');
  const prior=catalog.entries.filter(e=>!APPROVED20_IDS.includes(e.speciesIndex));
  assert.equal(prior.length,194);
  assert.equal(createHash('sha256').update(JSON.stringify(prior)).digest('hex'),PRIOR194_SHA256,'All original194 records/order remain byte-identical');
  return prior;
}
module.exports={APPROVED20,APPROVED20_IDS,PRIOR194_SHA256,assertApproved20Registry};
