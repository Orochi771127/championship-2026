// Public test-only identity pin for the owner-approved 2026-10-22 twenty portraits.
// No source masters, private approval records, or runtime imports.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {beforeWebRendition} = require('./helpers/dex-web-renditions.cjs');
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
const APPROVED10 = Object.freeze([
  {
    "speciesIndex": 11,
    "speciesId": "species-011",
    "displayCode": "B104",
    "src": "assets/production/database-combined24-20261022/species-011.display.83dab3a7f5f48995.webp",
    "width": 864,
    "height": 691,
    "sha256": "83dab3a7f5f48995dea41105f4358528c810d8ec8356d0b847c50eb369806dae",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-011.thumbnail.c319163974d19e66.webp",
      "width": 96,
      "height": 77,
      "sha256": "c319163974d19e663bd569e3acb9bfbc1296bc3120202a32375cada3f877109b"
    }
  },
  {
    "speciesIndex": 12,
    "speciesId": "species-012",
    "displayCode": "B105",
    "src": "assets/production/database-combined24-20261022/species-012.display.29c75647913a06bf.webp",
    "width": 864,
    "height": 790,
    "sha256": "29c75647913a06bf92662a92e632e981437baea72609fce28242e3f22cce7105",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-012.thumbnail.3f1bcc04a9b3fcc6.webp",
      "width": 96,
      "height": 88,
      "sha256": "3f1bcc04a9b3fcc6bb3d4317733211333f855875d0ac8cafcb094290c505e411"
    }
  },
  {
    "speciesIndex": 13,
    "speciesId": "species-013",
    "displayCode": "B107",
    "src": "assets/production/database-combined24-20261022/species-013.display.a093f1036d4d52c9.webp",
    "width": 790,
    "height": 864,
    "sha256": "a093f1036d4d52c9412e6fe7a2ba894e7c19893ec81ecbf74bce44adb1be3f0f",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-013.thumbnail.17e559e14eff0ba8.webp",
      "width": 88,
      "height": 96,
      "sha256": "17e559e14eff0ba83368524b77ef2822256527ff4134059c3d60893e2147eaa3"
    }
  },
  {
    "speciesIndex": 14,
    "speciesId": "species-014",
    "displayCode": "B108",
    "src": "assets/production/database-combined24-20261022/species-014.display.c4c1003969ac44f5.webp",
    "width": 864,
    "height": 691,
    "sha256": "c4c1003969ac44f5f44aab2732790b0518552aa9ef6ae44bdfaaa8b6fdc19638",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-014.thumbnail.eabaf84afbde1e07.webp",
      "width": 96,
      "height": 77,
      "sha256": "eabaf84afbde1e07730f2af1480310e82fe0453ba99ff8bbc444f113f2a3fa76"
    }
  },
  {
    "speciesIndex": 16,
    "speciesId": "species-016",
    "displayCode": "B110",
    "src": "assets/production/database-combined24-20261022/species-016.display.7361ca26226112d6.webp",
    "width": 691,
    "height": 864,
    "sha256": "7361ca26226112d6c4a58d1b85eb0f2a58a8a57d2abb703b5d96c83c702520ba",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-016.thumbnail.9b926cd4e524f1f0.webp",
      "width": 77,
      "height": 96,
      "sha256": "9b926cd4e524f1f095915fcdc30c18651fd5216364e6609f2214dc991eb498e6"
    }
  },
  {
    "speciesIndex": 17,
    "speciesId": "species-017",
    "displayCode": "B111",
    "src": "assets/production/database-combined24-20261022/species-017.display.ef03bc5de47ac2c1.webp",
    "width": 864,
    "height": 790,
    "sha256": "ef03bc5de47ac2c1c4689c6ce5d94c7f7362647f701c873c489a990312a6be34",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-017.thumbnail.fe904b0f55ca6bb8.webp",
      "width": 96,
      "height": 88,
      "sha256": "fe904b0f55ca6bb8369290b413d95d5c282320bed32774f1163446f2d668d2c0"
    }
  },
  {
    "speciesIndex": 18,
    "speciesId": "species-018",
    "displayCode": "B112",
    "src": "assets/production/database-combined24-20261022/species-018.display.6fcc64ac3a67b8f3.webp",
    "width": 864,
    "height": 790,
    "sha256": "6fcc64ac3a67b8f35a2e6676899507e6074bf48adc3bb3388d8c4ebaf0b0e589",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-018.thumbnail.fa3fd8de3e164aa2.webp",
      "width": 96,
      "height": 88,
      "sha256": "fa3fd8de3e164aa2e4c2277c2da907a7fdc0c1712f7ff2dd1bf1fc05c3064a46"
    }
  },
  {
    "speciesIndex": 19,
    "speciesId": "species-019",
    "displayCode": "B106",
    "src": "assets/production/database-combined24-20261022/species-019.display.db591d2cc7064e2f.webp",
    "width": 790,
    "height": 864,
    "sha256": "db591d2cc7064e2f64fc776a80f82ea57511935e7778665c3f54189a62186bf0",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-019.thumbnail.de983e7fe28295b9.webp",
      "width": 88,
      "height": 96,
      "sha256": "de983e7fe28295b97b24d3d49af719b4bf9e4c0f394142a2b768e93626023ea8"
    }
  },
  {
    "speciesIndex": 96,
    "speciesId": "species-096",
    "displayCode": "MA34",
    "src": "assets/production/database-remaining16-20261022/ma34.display.1e82c850458bccdf.webp",
    "sha256": "1e82c850458bccdffba8cb9817b82e1e9bb8c5b039e9460aa76d90adc4eb885e",
    "width": 864,
    "height": 648,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/ma34.thumbnail.211ec848ec7e36d6.webp",
      "sha256": "211ec848ec7e36d6acd40207956f14aaa7408ed80f52d474105dfaa7bb7a654e",
      "width": 96,
      "height": 72
    }
  },
  {
    "speciesIndex": 121,
    "speciesId": "species-121",
    "displayCode": "MA50",
    "src": "assets/production/database-remaining16-20261022/ma50.display.a67ced1b020daa39.webp",
    "sha256": "a67ced1b020daa398db55afa1e64c7b1c64a6a16ea8325e4f122c1b1d7b8cde9",
    "width": 864,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/ma50.thumbnail.7d79e7aa795084c8.webp",
      "sha256": "7d79e7aa795084c8a92471a8eff5bc485e5c1c2a9cefe83f7c174214dd942cc4",
      "width": 96,
      "height": 96
    }
  },
  {
    "speciesIndex": 147,
    "speciesId": "species-147",
    "displayCode": "AW15",
    "src": "assets/production/database-remaining16-20261022/aw15.display.d67b4a3a84687536.webp",
    "sha256": "d67b4a3a8468753649dec4664c8a1abede95a05e50a3d627b1aea05c77159f17",
    "width": 776,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/aw15.thumbnail.9a014a64fe580fad.webp",
      "sha256": "9a014a64fe580fad00ac081c13a7fe9dd4e9f45145db1bcf1514fec314121799",
      "width": 86,
      "height": 96
    }
  },
  {
    "speciesIndex": 148,
    "speciesId": "species-148",
    "displayCode": "AW17",
    "src": "assets/production/database-remaining16-20261022/aw17.display.dfbf7a7f75b095c7.webp",
    "sha256": "dfbf7a7f75b095c703e49b7ac8247d30796d4ab3e2b26ed2e5b2a17bc6dd8744",
    "width": 790,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/aw17.thumbnail.7c337ba398eadfb2.webp",
      "sha256": "7c337ba398eadfb23c40b92d1ecae8eb3cbe7723def4ce9953c2519564cde2b8",
      "width": 88,
      "height": 96
    }
  },
  {
    "speciesIndex": 174,
    "speciesId": "species-174",
    "displayCode": "AW46",
    "src": "assets/production/database-remaining16-20261022/aw46.display.fcab2234524ce3af.webp",
    "sha256": "fcab2234524ce3af19b85e2923264eafafeb33058b6af5430d7ad338e8a40452",
    "width": 864,
    "height": 790,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/aw46.thumbnail.22bd8020a0caabf0.webp",
      "sha256": "22bd8020a0caabf0f3451896ec7e21e2cbd54bc8122ce4bd6406bccb36741427",
      "width": 96,
      "height": 88
    }
  },
  {
    "speciesIndex": 175,
    "speciesId": "species-175",
    "displayCode": "AW47",
    "src": "assets/production/database-remaining16-20261022/aw47.display.3501b733d0765f3a.webp",
    "sha256": "3501b733d0765f3ab548aab408b1faa1cc509343f8b51a3665e2eb34c29eb3c1",
    "width": 576,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/aw47.thumbnail.e1f91c1480d02ad9.webp",
      "sha256": "e1f91c1480d02ad9b1da395fa4252794d4f1f4d32d14e3bd382df1bb25fe1de9",
      "width": 64,
      "height": 96
    }
  },
  {
    "speciesIndex": 176,
    "speciesId": "species-176",
    "displayCode": "AW48",
    "src": "assets/production/database-remaining16-20261022/aw48.display.6f1a77cf4edc7636.webp",
    "sha256": "6f1a77cf4edc7636ebdb351f95447eb2021efa2ab6541a26dcc2d4b9316cfa9c",
    "width": 576,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/aw48.thumbnail.41318322d254498e.webp",
      "sha256": "41318322d254498ee8af9f3ca68a3f9fa461d09ee5dacb6eb1f445ec70d94549",
      "width": 64,
      "height": 96
    }
  },
  {
    "speciesIndex": 177,
    "speciesId": "species-177",
    "displayCode": "AW51",
    "src": "assets/production/database-combined24-20261022/species-177.display.e62679f15b8e8517.webp",
    "width": 728,
    "height": 864,
    "sha256": "e62679f15b8e8517a3f564dfceac04fa80bce40cabb396965d3bd19e8871c8f2",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-177.thumbnail.a2e72e931e839d01.webp",
      "width": 81,
      "height": 96,
      "sha256": "a2e72e931e839d01a1518f191e5755ff8f0a7e41e3e0607b4a64e3a69d7ad492"
    }
  },
  {
    "speciesIndex": 179,
    "speciesId": "species-179",
    "displayCode": "AW50",
    "src": "assets/production/database-combined24-20261022/species-179.display.5d7fcfac09c75627.webp",
    "width": 864,
    "height": 790,
    "sha256": "5d7fcfac09c756279da7dd6cd0fbd8c6d465ce76f697966ebf4d8152e4896a20",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-179.thumbnail.61758eeb398e8e0b.webp",
      "width": 96,
      "height": 88,
      "sha256": "61758eeb398e8e0be3f6c5dfbb5109ea33ed93ab2ed0498fab8dd65569b2ced3"
    }
  },
  {
    "speciesIndex": 180,
    "speciesId": "species-180",
    "displayCode": "AW04",
    "src": "assets/production/database-combined24-20261022/species-180.display.64fe53de043b403c.webp",
    "width": 790,
    "height": 864,
    "sha256": "64fe53de043b403ca03f5bbc46736dc12b6f40cabd87b5b0cf7cb1ef26986022",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-180.thumbnail.60c8414f0413b29f.webp",
      "width": 88,
      "height": 96,
      "sha256": "60c8414f0413b29f7575ad53d2be1ff6e7a621f5c092db512e42594c7e5d70fc"
    }
  },
  {
    "speciesIndex": 181,
    "speciesId": "species-181",
    "displayCode": "AW10",
    "src": "assets/production/database-remaining16-20261022/aw10.display.33e34ada6d1970c0.webp",
    "sha256": "33e34ada6d1970c0138be65f213f8ffa190e848ff12604a4658049c3252ccf75",
    "width": 864,
    "height": 648,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/aw10.thumbnail.0336f4810a4ac770.webp",
      "sha256": "0336f4810a4ac7701b5e8d5795520da63f6cf969afe2cc40f6a5a0e5b6be28eb",
      "width": 96,
      "height": 72
    }
  },
  {
    "speciesIndex": 184,
    "speciesId": "species-184",
    "displayCode": "AW16",
    "src": "assets/production/database-combined24-20261022/species-184.display.59f8a3cd8c05a877.webp",
    "width": 790,
    "height": 864,
    "sha256": "59f8a3cd8c05a877c5333899dc534650f3dcf437fdaade78e7e4e3d50c51cd66",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-184.thumbnail.59cd77bb56a70364.webp",
      "width": 88,
      "height": 96,
      "sha256": "59cd77bb56a7036426561d40c4b55b796bf35581cbbf47f3daa1d768e9594c40"
    }
  },
  {
    "speciesIndex": 186,
    "speciesId": "species-186",
    "displayCode": "AW30",
    "src": "assets/production/database-combined24-20261022/species-186.display.c2e60f26bd1c287d.webp",
    "width": 734,
    "height": 864,
    "sha256": "c2e60f26bd1c287d1c5acd9781d5fa64a71b4ffc8fdf2b915a2c4fac76575407",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-186.thumbnail.100796155ef3a197.webp",
      "width": 82,
      "height": 96,
      "sha256": "100796155ef3a197d45e3164a89dc443ac71a0aeac8323826798745ff6e9d538"
    }
  },
  {
    "speciesIndex": 187,
    "speciesId": "species-187",
    "displayCode": "UL04",
    "src": "assets/production/database-remaining16-20261022/ul03.display.1b1438148ddb8b10.webp",
    "sha256": "1b1438148ddb8b10701a55e78ced80a5b1ce0d97652bee5af78bd26fb205e4a6",
    "width": 790,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/ul03.thumbnail.b463d286c1647f32.webp",
      "sha256": "b463d286c1647f3236bdd90e81fb1441f2f4109da18405777c6af00d414a1e97",
      "width": 88,
      "height": 96
    }
  },
  {
    "speciesIndex": 188,
    "speciesId": "species-188",
    "displayCode": "UL05",
    "src": "assets/production/database-combined24-20261022/species-188.display.1b89c673740d94df.webp",
    "width": 864,
    "height": 790,
    "sha256": "1b89c673740d94df666d788748e44d18a4a57190a1dadafdfb3cf0854518dfbe",
    "thumbnail": {
      "src": "assets/production/database-combined24-20261022/species-188.thumbnail.e175a5a43c0f8add.webp",
      "width": 96,
      "height": 88,
      "sha256": "e175a5a43c0f8add67c840cd736379427949efc165ea6ea1ddd12320142ad7d2"
    }
  },
  {
    "speciesIndex": 200,
    "speciesId": "species-200",
    "displayCode": "UL21",
    "src": "assets/production/database-remaining16-20261022/ul20.display.0ef05d8e8e38f552.webp",
    "sha256": "0ef05d8e8e38f5523565197faa6dda9b69e14e6094a574548c0fdf96ee5f009c",
    "width": 576,
    "height": 864,
    "thumbnail": {
      "src": "assets/production/database-remaining16-20261022/ul20.thumbnail.1d631927c0002111.webp",
      "sha256": "1d631927c0002111b8cfad34f7cde3afa885e940ff0345aa3aa53f0efab0283e",
      "width": 64,
      "height": 96
    }
  }
].map(Object.freeze));
const SUPERSEDED8 = [
  {
    "speciesIndex": 11,
    "speciesId": "species-011",
    "displayCode": "B104",
    "src": "assets/production/database-display-20261018/species-011.display.2634278599e1b511.webp",
    "width": 864,
    "height": 691,
    "sha256": "2634278599e1b5114b06a0a5b78d384dd203c7a1e471a2daf56c67af69abece5",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-011.thumbnail.3e2ccb3f6215313b.webp",
      "width": 128,
      "height": 102,
      "sha256": "3e2ccb3f6215313b42d2ad7badc03b88830bb038ab0570f31505ad16a4b219d7"
    }
  },
  {
    "speciesIndex": 12,
    "speciesId": "species-012",
    "displayCode": "B105",
    "src": "assets/production/database-display-20261018/species-012.display.06d978acb5fe8d27.webp",
    "width": 864,
    "height": 790,
    "sha256": "06d978acb5fe8d2740c82f77ee0647761b0da9edd085d6321cb898edbba5eff8",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-012.thumbnail.0e67a71b1579af55.webp",
      "width": 128,
      "height": 117,
      "sha256": "0e67a71b1579af5564a93846e0c29067c66834e2e3f03f00b07699e4fc1ee2ca"
    }
  },
  {
    "speciesIndex": 13,
    "speciesId": "species-013",
    "displayCode": "B107",
    "src": "assets/production/database-display-20261018/species-013.display.0c9064cdff10af19.webp",
    "width": 790,
    "height": 864,
    "sha256": "0c9064cdff10af19f5bea5f8b582aad53af3ec71af301bbf2330cc7848eea3ed",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-013.thumbnail.0aca545a3c799875.webp",
      "width": 117,
      "height": 128,
      "sha256": "0aca545a3c799875b87f306b73c3be9ef64e484ad971b2d4f3178f1d11f5cf61"
    }
  },
  {
    "speciesIndex": 14,
    "speciesId": "species-014",
    "displayCode": "B108",
    "src": "assets/production/database-display-20261018/species-014.display.47541f8a80aff5b4.webp",
    "width": 864,
    "height": 691,
    "sha256": "47541f8a80aff5b4bf229b19db896ea2340cdc980f622f9d07bb646b5cdb2a1f",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-014.thumbnail.246d62f9df6029eb.webp",
      "width": 128,
      "height": 102,
      "sha256": "246d62f9df6029eb88d614f1da441111f1876eea35c74b128c1dc1846f936f90"
    }
  },
  {
    "speciesIndex": 16,
    "speciesId": "species-016",
    "displayCode": "B110",
    "src": "assets/production/database-display-20261018/species-016.display.fdbcb4f3f5f3527e.webp",
    "width": 691,
    "height": 864,
    "sha256": "fdbcb4f3f5f3527e5f279781cf03559f024007b077a21eb9c8e413df9deb67f9",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-016.thumbnail.66516e2aebf4db0a.webp",
      "width": 102,
      "height": 128,
      "sha256": "66516e2aebf4db0acf2bedf2313f51bb664c2fd65434e9a77ed2c1ac023e673f"
    }
  },
  {
    "speciesIndex": 17,
    "speciesId": "species-017",
    "displayCode": "B111",
    "src": "assets/production/database-display-20261018/species-017.display.53f540d37e916194.webp",
    "width": 864,
    "height": 790,
    "sha256": "53f540d37e916194bd7dc812f4c321862199cb5df65d117dcddb663eab5eeaf8",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-017.thumbnail.9da7c9de32935809.webp",
      "width": 128,
      "height": 117,
      "sha256": "9da7c9de329358097dc3e8441f44232d4985ddb755b352962326ab7a456190ee"
    }
  },
  {
    "speciesIndex": 18,
    "speciesId": "species-018",
    "displayCode": "B112",
    "src": "assets/production/database-display-20261018/species-018.display.d267e8e1968be7fe.webp",
    "width": 864,
    "height": 790,
    "sha256": "d267e8e1968be7fe45cd208e69f1a5d6d481e7f0c62c88029af4f71d8c86fd71",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-018.thumbnail.0d8ec5b4f1300e11.webp",
      "width": 128,
      "height": 117,
      "sha256": "0d8ec5b4f1300e11279455e6ef2d6ba28e74e0124459d931458d4c5581224d97"
    }
  },
  {
    "speciesIndex": 19,
    "speciesId": "species-019",
    "displayCode": "B106",
    "src": "assets/production/database-display-20261018/species-019.display.d1b6d28f8bb6daf0.webp",
    "width": 790,
    "height": 864,
    "sha256": "d1b6d28f8bb6daf014b66366672c8259972aa03331dc5e87b506690221240dfd",
    "thumbnail": {
      "src": "assets/production/database-display-20261018/species-019.thumbnail.c6ea7a346d08d239.webp",
      "width": 117,
      "height": 128,
      "sha256": "c6ea7a346d08d23971810691a1440087fe392c99b8a193d7c7583165aeb0fe6d"
    }
  }
];
const NEW16_IDS = APPROVED10.filter(e=>!SUPERSEDED8.some(s=>s.speciesIndex===e.speciesIndex)).map(e=>e.speciesIndex);
const APPROVED10_IDS = Object.freeze(APPROVED10.map(e=>e.speciesIndex));
const PRIOR214_SHA256 = '850ceead90b2986ce442ce45623c0a8ad0b8434dd68c4c8aba0039fa7a3c601c';
const APPROVED_GR26 = Object.freeze({"speciesIndex": 52, "speciesId": "species-052", "displayCode": "GR26", "src": "assets/production/database-next-portraits-20261022/species-052.display.2a99c36fe93b41bb.webp", "width": 864, "height": 864, "sha256": "2a99c36fe93b41bb58e36cfc2cf780e20b48ed41005e4e87d62939dc910dd5ce", "thumbnail": {"src": "assets/production/database-next-portraits-20261022/species-052.thumbnail.7c3e4e6915e2d2bf.webp", "width": 96, "height": 96, "sha256": "7c3e4e6915e2d2bf4261f26189bc565a17826f4eaced85f03d7595bb73ff7aaf"}});
const SUPERSEDED_GR26 = Object.freeze({"speciesIndex": 52, "speciesId": "species-052", "displayCode": "GR26", "src": "assets/production/database-display-20261018/species-052.display.372094cdfed88c25.webp", "width": 864, "height": 864, "sha256": "372094cdfed88c2597cce6d4a61d3e9f5ab9d63d349babc148cd8f0571625305", "thumbnail": {"src": "assets/production/database-display-20261018/species-052.thumbnail.b373582b37150ea3.webp", "width": 128, "height": 128, "sha256": "b373582b37150ea3b7adc593802ac5d443dee5bdddef53e50477832c49adbcdb"}});
const APPROVED_GR_FIXES = Object.freeze([{"speciesIndex": 38, "speciesId": "species-038", "displayCode": "GR06", "src": "assets/production/database-next-portraits-20261022/species-038.display.ab63bfcc428a7a7d.webp", "width": 864, "height": 864, "sha256": "ab63bfcc428a7a7daa90bdd6198c8f83cfe9dd3837ec2d1e8cd031a606ca7932", "thumbnail": {"src": "assets/production/database-next-portraits-20261022/species-038.thumbnail.d063ae58a38ff87b.webp", "width": 96, "height": 96, "sha256": "d063ae58a38ff87ba532868815ed713ed5e6d9b8496dad3df60aecc4ddc93af4"}}, {"speciesIndex": 48, "speciesId": "species-048", "displayCode": "GR21", "src": "assets/production/database-next-portraits-20261022/species-048.display.ff326a954c212af1.webp", "width": 864, "height": 864, "sha256": "ff326a954c212af1db657271bd325c7d7e0447dfe94e4f9b3fe624511fece1a6", "thumbnail": {"src": "assets/production/database-next-portraits-20261022/species-048.thumbnail.8346e511c2ff9855.webp", "width": 96, "height": 96, "sha256": "8346e511c2ff98558adc89410335cb84b337d9d9d13c723bc157e70664665b76"}}, {"speciesIndex": 49, "speciesId": "species-049", "displayCode": "GR22", "src": "assets/production/database-next-portraits-20261022/species-049.display.e38caed7b23c0f32.webp", "width": 864, "height": 864, "sha256": "e38caed7b23c0f32c1cbba7a00819e623775b0d67b657d84a6ffe37a51eac49b", "thumbnail": {"src": "assets/production/database-next-portraits-20261022/species-049.thumbnail.1af2fc20cb9301be.webp", "width": 96, "height": 96, "sha256": "1af2fc20cb9301be17141b9a5244fad0c63314cdcb6ffda390195546698c6ee0"}}, {"speciesIndex": 52, "speciesId": "species-052", "displayCode": "GR26", "src": "assets/production/database-next-portraits-20261022/species-052.display.2a99c36fe93b41bb.webp", "width": 864, "height": 864, "sha256": "2a99c36fe93b41bb58e36cfc2cf780e20b48ed41005e4e87d62939dc910dd5ce", "thumbnail": {"src": "assets/production/database-next-portraits-20261022/species-052.thumbnail.7c3e4e6915e2d2bf.webp", "width": 96, "height": 96, "sha256": "7c3e4e6915e2d2bf4261f26189bc565a17826f4eaced85f03d7595bb73ff7aaf"}}]);
const SUPERSEDED_GR_FIXES = Object.freeze([{"speciesIndex": 38, "speciesId": "species-038", "displayCode": "GR06", "src": "assets/production/database-display-20261018/species-038.display.68b4a737285e00e4.webp", "width": 864, "height": 864, "sha256": "68b4a737285e00e41618aa7a6fae3c76ef2f33f87902ccb9383fd0320b0a9b86", "thumbnail": {"src": "assets/production/database-display-20261018/species-038.thumbnail.b19de65a1a95f02a.webp", "width": 128, "height": 128, "sha256": "b19de65a1a95f02a90bd7199b0e559a8982d8d088a9075a85fd02ca3b4bc3769"}}, {"speciesIndex": 48, "speciesId": "species-048", "displayCode": "GR21", "src": "assets/production/database-display-20261018/species-048.display.2f8f15b262d9478b.webp", "width": 864, "height": 864, "sha256": "2f8f15b262d9478b798c68558414c59e33cce5818bd4e410d65f52a2ff55c127", "thumbnail": {"src": "assets/production/database-display-20261018/species-048.thumbnail.737d5f2b65a935dd.webp", "width": 128, "height": 128, "sha256": "737d5f2b65a935dde8d1db0448ad783da12850fee02491320b5bf4cca78f2a8c"}}, {"speciesIndex": 49, "speciesId": "species-049", "displayCode": "GR22", "src": "assets/production/database-display-20261018/species-049.display.6b26a16d4d7d0bde.webp", "width": 864, "height": 864, "sha256": "6b26a16d4d7d0bdec0c46722a1ee3ef0d7347afbefe222c8ca35cd83809f30fe", "thumbnail": {"src": "assets/production/database-display-20261018/species-049.thumbnail.51cff0d18e19d8aa.webp", "width": 128, "height": 128, "sha256": "51cff0d18e19d8aa2929c3444c70ca69f4e91ed7b362b6a8647d6e8fcf7886ac"}}, {"speciesIndex": 52, "speciesId": "species-052", "displayCode": "GR26", "src": "assets/production/database-display-20261018/species-052.display.372094cdfed88c25.webp", "width": 864, "height": 864, "sha256": "372094cdfed88c2597cce6d4a61d3e9f5ab9d63d349babc148cd8f0571625305", "thumbnail": {"src": "assets/production/database-display-20261018/species-052.thumbnail.b373582b37150ea3.webp", "width": 128, "height": 128, "sha256": "b373582b37150ea3b7adc593802ac5d443dee5bdddef53e50477832c49adbcdb"}}]);
// Art-only identities appended after this contract (2026-10-29 Rexmon v8 two forms) have their own test;
// set them aside so every pin below still covers exactly the registry it was written for.
const LATER_ADDITION_IDS = Object.freeze([243, 244]);
function assertApproved20Registry(registry) {
  assert.deepEqual(registry.entries.filter(e=>LATER_ADDITION_IDS.includes(e.speciesIndex)).map(e=>e.speciesIndex),LATER_ADDITION_IDS,'Later additions appear once each');
  const catalog={...registry,entries:registry.entries.filter(e=>!LATER_ADDITION_IDS.includes(e.speciesIndex))};
  for(const expected of APPROVED_GR_FIXES)assert.deepEqual(catalog.entries.find(e=>e.speciesIndex===expected.speciesIndex),expected,"Exact approved latest GR fix");
  assert.deepEqual(catalog.entries.find(e=>e.speciesIndex===52),APPROVED_GR26,"Exact approved GR26 recolor");
  assert.equal(catalog.entries.length,230,'Exactly214 minus8 superseded plus24 approved portraits');
  for(const expected of APPROVED10) assert.deepEqual(catalog.entries.find(e=>e.speciesIndex===expected.speciesIndex),expected,'Approved10 identity or asset drift');
  const actual206=catalog.entries.filter(e=>!APPROVED10_IDS.includes(e.speciesIndex));
  assert.equal(actual206.length,206);
  const prior214=[...actual206.map(e=>SUPERSEDED_GR_FIXES.find(x=>x.speciesIndex===e.speciesIndex)??beforeWebRendition(e)),...SUPERSEDED8].sort((a,b)=>a.speciesIndex-b.speciesIndex);
  assert.equal(createHash('sha256').update(JSON.stringify(prior214)).digest('hex'),PRIOR214_SHA256,'All206 unaffected records and exact superseded8 baseline retain original214 hash');
  assert.equal(new Set(catalog.entries.map(e=>e.speciesIndex)).size,230,'No duplicate species');
  assert.deepEqual(APPROVED20.map(e=>e.speciesIndex),APPROVED20_IDS);
  for(const expected of APPROVED20) assert.deepEqual(catalog.entries.find(e=>e.speciesIndex===expected.speciesIndex),expected,'Approved20 full identity/asset metadata drift');
  const prior=prior214.filter(e=>!APPROVED20_IDS.includes(e.speciesIndex));
  assert.equal(prior.length,194);
  assert.equal(createHash('sha256').update(JSON.stringify(prior)).digest('hex'),PRIOR194_SHA256,'All original194 records/order remain byte-identical');
  return prior;
}
module.exports={APPROVED_GR_FIXES,SUPERSEDED_GR_FIXES,APPROVED_GR26,SUPERSEDED_GR26,SUPERSEDED8,NEW16_IDS,APPROVED10,APPROVED10_IDS,PRIOR214_SHA256,APPROVED20,APPROVED20_IDS,PRIOR194_SHA256,assertApproved20Registry};
