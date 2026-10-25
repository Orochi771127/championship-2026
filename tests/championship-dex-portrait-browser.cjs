// GitHub-hosted evidence, not a public review menu or gameplay fixture.
// Fresh ephemeral context; normal onboarding and UI navigation only. Never installs
// a save, changes registration, invokes app intents, or writes browser storage.
// The only evaluated mutations are reversible inline CSS on the mounted hero holder.
// An automated capture pass leaves visual/anatomy/alpha acceptance PENDING.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const PUBLIC_BASE = 'https://orochi771127.github.io/championship-2026/';
const HERO = '.cm-vs2-root[data-screen="DATABASE"] .cm-dex-hero';
const {APPROVED20:OLD20,APPROVED10,APPROVED_GR_FIXES,assertApproved20Registry} = require('./approved20-20261022-contract.cjs');
const APPROVED44=Object.freeze([...OLD20,...APPROVED10].sort((a,b)=>a.speciesIndex-b.speciesIndex));
const APPROVED44_IDS=Object.freeze(APPROVED44.map(e=>e.speciesIndex));
const EXPECTED_REGISTRY_COUNT = 230;
const MATRIX_TARGETS = Object.freeze([117,55,40,189,63,70,71,72,9,10,35,62,36]);
const EXPECTED_MASTERS = Object.freeze({
  36: Object.freeze({"speciesIndex": 36, "speciesId": "species-036", "displayCode": "GR04", "src": "assets/production/database-handpainted-r1-20261015/species-036.1a921cc1752c9c9c.png", "width": 1415, "height": 1111, "sha256": "1a921cc1752c9c9c99b2085a51ccf6a3efe77cb849b77b0e006062a90334aa5d", "styleBatch": "HANDPAINTED_R1_20261015", "name": "雷鬃獾"}),
  35: Object.freeze({"speciesIndex": 35, "speciesId": "species-035", "displayCode": "GR02", "src": "assets/production/database-handpainted-r1-20261015/species-035.291db6a498c8bdbd.png", "width": 1536, "height": 1024, "sha256": "291db6a498c8bdbd5e5b2196c8f9a629ec44a1ba55674e103dc596e6827fe6d4", "styleBatch": "HANDPAINTED_R1_20261015", "name": "岩甲穿獸"}),
  62: Object.freeze({"speciesIndex": 62, "speciesId": "species-062", "displayCode": "GR38", "src": "assets/production/database-handpainted-r1-20261015/species-062.ad0745c733532dc2.png", "width": 1254, "height": 1254, "sha256": "ad0745c733532dc288c5143194e9020e35cd071e74347e7a3851911db136e52d", "styleBatch": "HANDPAINTED_R1_20261015", "name": "光綾狐"}),

  189: Object.freeze({"speciesIndex": 189, "speciesId": "species-189", "displayCode": "UL06", "src": "assets/production/database-handpainted-r1-20261015/species-189.8c9cac7746647500.png", "width": 1324, "height": 1188, "sha256": "8c9cac7746647500066880fbd869e188d1f3c83fb1ea3069c5e1d3ba8798ee64", "styleBatch": "HANDPAINTED_R1_20261015", "name": "日冕戰暴龍"}),
  9: Object.freeze({"speciesIndex":9,"speciesId":"species-009","displayCode":"B102","src":"assets/production/database-portraits-b1-20261014/B102.eb7c0e50feb53dc2.png","width":1323,"height":1189,"sha256":"eb7c0e50feb53dc2eb16a12f0457de8911318011aea08526fea2a184472a7f72","name":"鐵鈴芽"}),
  10: Object.freeze({"speciesIndex":10,"speciesId":"species-010","displayCode":"B103","src":"assets/production/database-portraits-b1-20261014/B103.db66d79eb40c3768.png","width":1312,"height":1199,"sha256":"db66d79eb40c3768b2addfa247c82d7ca2d749f5ba52d9c96778a5787cc53824","name":"星芽獸"}),

  40: Object.freeze({"speciesIndex":40,"speciesId":"species-040","displayCode":"GR08","src":"assets/production/database-handpainted-r1-20261015/species-040.a5d0d48e737f81e0.png","sha256":"a5d0d48e737f81e0c955286a94923fe3b70d6483813ee233aedb80a8d89bc3ae","width":1254,"height":1254,"name":"霜裘龍"}),
  63: Object.freeze({"speciesIndex":63,"speciesId":"species-063","displayCode":"GR24","src":"assets/production/database-handpainted-r1-20261015/species-063.e403a93ec4f2d7ec.png","sha256":"e403a93ec4f2d7ec24273c2f2f3d861feeec11848d55450989230b2c93283f8a","width":1254,"height":1254,"name":"翠冠龍"}),
  70: Object.freeze({"speciesIndex": 70, "speciesId": "species-070", "displayCode": "GR32", "src": "assets/production/database-handpainted-r1-20261015/species-070.2dc33277d80cdfb4.png", "sha256": "2dc33277d80cdfb4577bee1d369adb59545b4ccc735a4f90fff342087a1ba738", "name": "星角龍"}),
  71: Object.freeze({"speciesIndex": 71, "speciesId": "species-071", "displayCode": "GR12", "src": "assets/production/database-handpainted-r1-20261015/species-071.cd9ee93854a452cc.png", "sha256": "cd9ee93854a452cc2b5a253ee35d5d57651d5474292ae8af7422331f0379e913", "name": "裂焰龍"}),
  72: Object.freeze({"speciesIndex": 72, "speciesId": "species-072", "displayCode": "MA04", "src": "assets/production/database-handpainted-r1-20261015/species-072.4ca0e10b98584a76.png", "sha256": "4ca0e10b98584a76aec0c283b6c5628d34122bd7d60aa63411c7cc2156bfca43", "name": "晶鏈甲龍"}),
  222: Object.freeze({"speciesIndex": 222, "speciesId": "species-222", "displayCode": "UL02", "src": "assets/production/database-handpainted-r1-20261015/species-222.png", "sha256": "4d1dae7fb4470338818dd8a4213ee77dba8cc59234bbcfe4f29f8cabda13a7c3"}),
  230: Object.freeze({"speciesIndex": 230, "speciesId": "species-230", "displayCode": "UL03", "src": "assets/production/database-handpainted-r1-20261015/species-230.png", "sha256": "09ebff7fb323886eae495e557158cdd204a04dc2d18aa686ad0060ac250e2e39"}),
  211: Object.freeze({"speciesIndex": 211, "speciesId": "species-211", "displayCode": "UL33", "src": "assets/production/database-handpainted-r1-20261015/species-211.png", "sha256": "20c03ae43a26d960c9a947a9ff8dc03fe8d5cbeed4ba528e39e2f36dd5865634"}),
  229: Object.freeze({"speciesIndex": 229, "speciesId": "species-229", "displayCode": "UL34", "src": "assets/production/database-handpainted-r1-20261015/species-229.png", "sha256": "f1e1a23e891b9345f4b759e910c5f67efd8a844a2de53e14183a1a2fe3310424"}),
  117: Object.freeze({ speciesIndex: 117, speciesId: 'species-117', displayCode: 'MA58',
    src: 'assets/production/database-handpainted-r1-20261015/species-117.8f7d027cdbf6d3e6.png',
    sha256: '8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681' }),
  55: Object.freeze({ speciesIndex: 55, speciesId: 'species-055', displayCode: 'GR29',
    src: 'assets/production/database-handpainted-r1-20261015/species-055.32e6689b5e9669c2.png',
    sha256: '32e6689b5e9669c26fb0d29f3201ace2d5d619309381ab628d57f5eabc5d693e' })
});
const publicHeroes = require('../src/data/championship/database-hero-portraits.public.v1.json');
const displayRecipe = require('../docs/contracts/championship/DATABASE_HERO_DISPLAY_RENDITIONS.v1.json');
const APPROVED_INTAKE = Object.freeze({"207": {"speciesIndex": 207, "speciesId": "species-207", "displayCode": "UL30", "src": "assets/production/database-display-20261018/species-207.display.c58a022ba5c009c0.webp", "width": 768, "height": 576, "sha256": "c58a022ba5c009c0b2d6fc389c9018b50c7e2206ea4c673a6e7720f133c78d91", "thumbnail": {"src": "assets/production/database-display-20261018/species-207.thumbnail.6c3aada38673cc74.webp", "width": 128, "height": 96, "sha256": "6c3aada38673cc74e8d107fc222e799f3e8481f6e6955f78c0d81b0d8172e51d"}, "ownerCompressed": true}, "208": {"speciesIndex": 208, "speciesId": "species-208", "displayCode": "UL31", "src": "assets/production/database-display-20261018/species-208.display.37a7c2836136cd96.webp", "width": 768, "height": 576, "sha256": "37a7c2836136cd96c9bb9e5f58d131263b18d1e7602a5d91fef7858076f53d9a", "thumbnail": {"src": "assets/production/database-display-20261018/species-208.thumbnail.c0ec507c5e72ea8d.webp", "width": 128, "height": 96, "sha256": "c0ec507c5e72ea8d682f3c4582b7cb606a2aee0bdbca12d25a99f3c04722b0dc"}, "ownerCompressed": true}, "209": {"speciesIndex": 209, "speciesId": "species-209", "displayCode": "UL32", "src": "assets/production/database-display-20261018/species-209.display.75f8e1f19f95d161.webp", "width": 637, "height": 768, "sha256": "75f8e1f19f95d1615b335be2be0feabcaa06216e35612f96e6d8043482055e67", "thumbnail": {"src": "assets/production/database-display-20261018/species-209.thumbnail.1a6ed4a9d8112f3a.webp", "width": 106, "height": 128, "sha256": "1a6ed4a9d8112f3ab82e1bf4928397d10a22d913b3cf8aabbc80941de47f4658"}, "ownerCompressed": true}, "210": {"speciesIndex": 210, "speciesId": "species-210", "displayCode": "UL35", "src": "assets/production/database-display-20261018/species-210.display.e3eb624541031d79.webp", "width": 768, "height": 576, "sha256": "e3eb624541031d799749b8a951cbf559fe570260115116025406335284d26dde", "thumbnail": {"src": "assets/production/database-display-20261018/species-210.thumbnail.5d38c2cecb0810a8.webp", "width": 128, "height": 96, "sha256": "5d38c2cecb0810a87613a407a7c974d9a1307ff058d58224211ddc6d8afb0e6b"}, "ownerCompressed": true}, "212": {"speciesIndex": 212, "speciesId": "species-212", "displayCode": "UL36", "src": "assets/production/database-display-20261018/species-212.display.3d8b44c8d1135b9f.webp", "width": 768, "height": 512, "sha256": "3d8b44c8d1135b9fae435c761ff0cb99edeabfc2e5b42e8b4b2b5b15bdaf241a", "thumbnail": {"src": "assets/production/database-display-20261018/species-212.thumbnail.5bcda0d097b4cc9d.webp", "width": 128, "height": 86, "sha256": "5bcda0d097b4cc9d69d10030d57f8d7e86e8b9139cd62c20929d3ab851c94436"}, "ownerCompressed": true}, "213": {"speciesIndex": 213, "speciesId": "species-213", "displayCode": "UL37", "src": "assets/production/database-display-20261018/species-213.display.50c57f149312986b.webp", "width": 768, "height": 512, "sha256": "50c57f149312986bbbdb6c2b821ac571bb933b668caa45248bb54df71b210a81", "thumbnail": {"src": "assets/production/database-display-20261018/species-213.thumbnail.91ae9e09433a0516.webp", "width": 128, "height": 86, "sha256": "91ae9e09433a05169f373178eb42bb391e8c8f3a5c9e7cc387b20c3662fb2ef0"}, "ownerCompressed": true}, "214": {"speciesIndex": 214, "speciesId": "species-214", "displayCode": "UL38", "src": "assets/production/database-display-20261018/species-214.display.9d0ad4251a75eca4.webp", "width": 768, "height": 576, "sha256": "9d0ad4251a75eca4467dda372dd5520438039d24143e0c1071592d72ae43ae6e", "thumbnail": {"src": "assets/production/database-display-20261018/species-214.thumbnail.a4dc0936be5dcc08.webp", "width": 128, "height": 96, "sha256": "a4dc0936be5dcc0809510421f26daa751e884140cebef90aa7c1a74cbeaa3a5e"}, "ownerCompressed": true}, "216": {"speciesIndex": 216, "speciesId": "species-216", "displayCode": "UL13", "src": "assets/production/database-display-20261018/species-216.display.25e50fe4d6f6367d.webp", "width": 768, "height": 576, "sha256": "25e50fe4d6f6367df0145323618747bc257196b16868380c9956b9366e4585ff", "thumbnail": {"src": "assets/production/database-display-20261018/species-216.thumbnail.859c850b972aa5d9.webp", "width": 128, "height": 96, "sha256": "859c850b972aa5d9ac1018ace90deec9bff578b2a939073ff636d1eb5fb958c6"}, "ownerCompressed": true}, "217": {"speciesIndex": 217, "speciesId": "species-217", "displayCode": "UL22", "src": "assets/production/database-display-20261018/species-217.display.b8013deb58b3b4b8.webp", "width": 702, "height": 768, "sha256": "b8013deb58b3b4b85b5a5b9123c79addedb581bc35d2ed1e74edbe70ec40cb2f", "thumbnail": {"src": "assets/production/database-display-20261018/species-217.thumbnail.56f6a1fa7761a2bc.webp", "width": 117, "height": 128, "sha256": "56f6a1fa7761a2bca81d86b0a612b590eb51cf608d0a591740940d36edf89f85"}, "ownerCompressed": true}, "218": {"speciesIndex": 218, "speciesId": "species-218", "displayCode": "UL15", "src": "assets/production/database-display-20261018/species-218.display.5227fdf8f59e640a.webp", "width": 768, "height": 512, "sha256": "5227fdf8f59e640ad65c27d4e316d45b600114186b62ecafda7e6416ac0c1dd4", "thumbnail": {"src": "assets/production/database-display-20261018/species-218.thumbnail.ab6bff208ddf50bc.webp", "width": 128, "height": 86, "sha256": "ab6bff208ddf50bcc19dd894a9c0374dc98f0986b9b9ebee45eb52bcde8aa667"}, "ownerCompressed": true}, "219": {"speciesIndex": 219, "speciesId": "species-219", "displayCode": "UL28", "src": "assets/production/database-display-20261018/species-219.display.3d4e6979ac206f44.webp", "width": 768, "height": 512, "sha256": "3d4e6979ac206f4423949d54eccc4b84f33db41a269884c5b8f339568fb20ee3", "thumbnail": {"src": "assets/production/database-display-20261018/species-219.thumbnail.7f52d70bdc06d402.webp", "width": 128, "height": 86, "sha256": "7f52d70bdc06d4022f88e2359e48e32b002e1df8ed646219a99d9418a39b4bb6"}, "ownerCompressed": true}, "220": {"speciesIndex": 220, "speciesId": "species-220", "displayCode": "UL01", "src": "assets/production/database-display-20261018/species-220.display.f9dd48c2215b2221.webp", "width": 637, "height": 768, "sha256": "f9dd48c2215b22211b1ad683fa043b3d8f7334737f5e6f7e72ead90ed2e75acc", "thumbnail": {"src": "assets/production/database-display-20261018/species-220.thumbnail.d63f9d761f3c81c2.webp", "width": 106, "height": 128, "sha256": "d63f9d761f3c81c25cd5bde1c423b445043337d940297b126cbd958874e19c75"}, "ownerCompressed": true}, "221": {"speciesIndex": 221, "speciesId": "species-221", "displayCode": "UL17", "src": "assets/production/database-display-20261018/species-221.display.067d872c8c8e4493.webp", "width": 637, "height": 768, "sha256": "067d872c8c8e4493cde782ecf6e9ad79ee97d313501919538840ba51ee8e125a", "thumbnail": {"src": "assets/production/database-display-20261018/species-221.thumbnail.34b96a365d1efa36.webp", "width": 106, "height": 128, "sha256": "34b96a365d1efa369e719cd48b8f665d1cc9192f5efbaac675a3373e9c85d635"}, "ownerCompressed": true}, "223": {"speciesIndex": 223, "speciesId": "species-223", "displayCode": "UL18", "src": "assets/production/database-display-20261018/species-223.display.cb48ee8d8d939913.webp", "width": 719, "height": 768, "sha256": "cb48ee8d8d939913cd789b8ae25cd830408d35df77149ccf1fb3be8305b22a55", "thumbnail": {"src": "assets/production/database-display-20261018/species-223.thumbnail.134e7d079ee91627.webp", "width": 120, "height": 128, "sha256": "134e7d079ee91627498a42319a178d4d6da7b8e7289fcc46027c56e394a244f0"}, "ownerCompressed": true}, "206": {"speciesIndex": 206, "speciesId": "species-206", "displayCode": "UL29", "src": "assets/production/database-display-20261018/species-206.display.08a4d0cfea842d7b.webp", "width": 1024, "height": 683, "sha256": "08a4d0cfea842d7bf91f3304f933d2bf7ff54f3ffe73f068ebb85e90008071c9", "thumbnail": {"src": "assets/production/database-display-20261018/species-206.thumbnail.2ee70cc859d4486a.webp", "width": 128, "height": 85, "sha256": "2ee70cc859d4486a762abe7f663d9513b1fd91383f9f93b08fdb7affc9a6b3a4"}, "ownerCompressed": true}, "215": {"speciesIndex": 215, "speciesId": "species-215", "displayCode": "UL39", "src": "assets/production/database-display-20261018/species-215.display.8cf984cef9c5a3f4.webp", "width": 768, "height": 768, "sha256": "8cf984cef9c5a3f402f022b8c2aa17751ca3e2613b1b5b4aa992c5c5a420ce4f", "thumbnail": {"src": "assets/production/database-display-20261018/species-215.thumbnail.69e09565bac6a967.webp", "width": 128, "height": 128, "sha256": "69e09565bac6a967a5c42c59f441ca38fda27a17a37cf68dd1756639ce02efd7"}, "ownerCompressed": true}, "54": {"speciesIndex": 54, "speciesId": "species-054", "displayCode": "GR28", "src": "assets/production/database-display-20261018/species-054.display.862dd05e6371806b.webp", "width": 1024, "height": 1024, "sha256": "862dd05e6371806b06f360e832d08a3b8e92ffa90e6ecdd9902806c7d22dcdcc", "thumbnail": {"src": "assets/production/database-display-20261018/species-054.thumbnail.4ad2692c6f79115c.webp", "width": 128, "height": 128, "sha256": "4ad2692c6f79115c5ffa66840b2ceceedffa78af40e9b3f5298477244f40f0f6"}, "ownerCompressed": true}, "59": {"speciesIndex": 59, "speciesId": "species-059", "displayCode": "GR34", "src": "assets/production/database-display-20261018/species-059.display.d65af3374e14305c.webp", "width": 1024, "height": 1024, "sha256": "d65af3374e14305c5fff2de0cb93aeb711d8d4c018454ce034d205582eded1bd", "thumbnail": {"src": "assets/production/database-display-20261018/species-059.thumbnail.133ac3f1f9d74ca7.webp", "width": 128, "height": 128, "sha256": "133ac3f1f9d74ca792af4230837e61e15ea1f559b4960f19d8866246f6345987"}, "ownerCompressed": true}});
const SCOPED_GR_ENTRIES = Object.freeze([...[{"speciesIndex": 39, "speciesId": "species-039", "displayCode": "GR07", "src": "assets/production/database-display-20261018/species-039.display.69bf45ae13181406.webp", "width": 864, "height": 864, "sha256": "69bf45ae13181406a93ac7bbbccf13e1a952a782cc1f4f293a8b5d640dc81278", "thumbnail": {"src": "assets/production/database-display-20261018/species-039.thumbnail.9dcd90cbc3efbe49.webp", "width": 128, "height": 128, "sha256": "9dcd90cbc3efbe49bddab5fc19207b0c0e1e3c14cec12312ebf0a911ade3040d"}}, {"speciesIndex": 41, "speciesId": "species-041", "displayCode": "GR09", "src": "assets/production/database-display-20261018/species-041.display.a87468e715fe2c08.webp", "width": 864, "height": 864, "sha256": "a87468e715fe2c083165d54f053513857b6452c41087fd3f632a3b11d9b9d52d", "thumbnail": {"src": "assets/production/database-display-20261018/species-041.thumbnail.e400ab7cee2db752.webp", "width": 128, "height": 128, "sha256": "e400ab7cee2db752064d5c14698e5eb8358c32e962d3b82af4a1bd1c236dc9ab"}}],...APPROVED_GR_FIXES]);
const EXPECTED = Object.freeze(Object.fromEntries(Object.entries({...EXPECTED_MASTERS,...APPROVED_INTAKE,...Object.fromEntries(APPROVED44.map(e=>[e.speciesIndex,{...e,ownerCompressed:true}])),...Object.fromEntries(SCOPED_GR_ENTRIES.map(e=>[e.speciesIndex,{...e,ownerCompressed:APPROVED_GR_FIXES.some(f=>f.speciesIndex===e.speciesIndex)}]))}).map(([id,master])=>{
  const display=publicHeroes.entries.find(row=>row.speciesIndex===Number(id));
  assert.ok(display,`Missing public display rendition ${id}`);
  return [id,Object.freeze({...master,...display})];
})));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function assertOriginalApprovalLineage() {
  const authoring=require('../src/data/championship/database-hero-portraits.r1.json');
  assert.equal(authoring.entries.length,96,'Original authoring registry remains intact');
  for(const master of Object.values(EXPECTED_MASTERS)) {
    const original=authoring.entries.find(row=>row.speciesIndex===master.speciesIndex);
    assert.ok(original);assertAsset(original,fs.readFileSync(master.src),master);
    const derived=displayRecipe.rows.find(row=>row.speciesIndex===master.speciesIndex);
    for(const key of ['src','sha256','width','height'])assert.equal(derived.source[key],original[key]);
    assert.equal(derived.display.rgbaExactlyMatchesResizedSource,true);
    assert.equal(EXPECTED[master.speciesIndex].sha256,derived.display.sha256);
  }
}
function assertAsset(entry, bytes, expected) {
  for (const key of ['speciesIndex', 'speciesId', 'displayCode', 'src', 'sha256']) assert.equal(entry[key], expected[key], `Hero ${key} binding drift`);
  assert.equal(entry.width, expected.width ?? 1254); assert.equal(entry.height, expected.height ?? 1254);
  assert.equal(sha256(bytes), expected.sha256, 'Selected hero bytes drift');
  if(expected.src.endsWith('.png')) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), expected.width ?? 1254); assert.equal(bytes.readUInt32BE(20), expected.height ?? 1254);
  } else {
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    if(!expected.ownerCompressed)assert.ok(bytes.includes(Buffer.from('VP8L')),'Existing display images use lossless WebP');
  }
}
function assertRegistry(sourceBytes, builtBytes) {
  assert.equal(sha256(builtBytes), sha256(sourceBytes), 'Built hero registry must equal this exact candidate source');
  const catalog = JSON.parse(builtBytes);
  assertApproved20Registry(catalog);
  for(const pinned of SCOPED_GR_ENTRIES)assert.deepEqual(catalog.entries.find(e=>e.speciesIndex===pinned.speciesIndex),pinned,"Exact scoped GR portrait binding");
  assert.ok(Array.isArray(catalog.entries));
  assert.equal(new Set(catalog.entries.map(entry => entry.speciesIndex)).size, catalog.entries.length, 'No duplicate hero identities');
  for (const id of Object.keys(EXPECTED).map(Number)) assert.ok(catalog.entries.some(entry => entry.speciesIndex === id), `Missing selected hero ${id}`);
  return catalog;
}
// The default egg's native ancestry forces hatch target 14. Home continues
// ticking while slow browser clicks/loaders settle; Database itself does not.
function assertStarterRegistration(rows, observedStarter) {
  assert.ok([0,14].includes(observedStarter), 'Only the normal default egg or its native hatch is expected');
  assert.deepEqual(rows, observedStarter===0?[]:[14], 'Dex must register only the independently observed hatched Home starter; eggs are not tracked');
  return observedStarter;
}
function assertSavedStarterRegistration(before, after, observedStarter) {
  // A read-only save observation can lag the live Home actor until autosave.
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  assert.equal(observedStarter,14,'A save change requires an observed natural Home hatch');
  assert.deepEqual(after,{registeredSpecies:[14],starter:'species-014'},'No unrelated registrations or replacement creatures');
}
function sizePlan(size, padding) {
  assert.ok([128, 256].includes(size));
  assert.deepEqual(padding, [24, 24, 24, 24], 'Existing normal 24px stage padding changed');
  return { size, width: size + padding[1] + padding[3], height: size + padding[0] + padding[2] };
}
function assertMeasured(snapshot, species, size = null, starter = null) {
  const expected = EXPECTED[species];
  assert.equal(snapshot.speciesIndex, species); assert.equal(snapshot.displayCode, expected.displayCode);
  assert.equal(snapshot.rowState, species === starter ? 'REGISTERED' : 'UNDISCOVERED', 'Only the independently observed starter may be registered');
  assert.equal(snapshot.src, new URL(expected.src, PUBLIC_BASE).href);
  assert.equal(snapshot.art, 'ready'); assert.equal(snapshot.complete, true); assert.equal(snapshot.hidden, false);
  assert.deepEqual(snapshot.natural, [expected.width ?? 1254, expected.height ?? 1254]); assert.equal(snapshot.objectFit, 'contain');
  assert.deepEqual(snapshot.padding, [24, 24, 24, 24]);
  if (species === 117) assert.equal(snapshot.title, '曙刃天駒');
  if (expected.name) assert.equal(snapshot.title,expected.name,'Exact species name binding');
  assert.equal(snapshot.documentOverflow, false, 'Document-level horizontal overflow');
  assert.ok(snapshot.imageRect.width > 0 && snapshot.imageRect.height > 0);
  if (size !== null) {
    const plan = sizePlan(size, snapshot.padding);
    for (const dim of ['width', 'height']) {
      assert.ok(Math.abs(snapshot.imageRect[dim] - size) <= 0.75, `Actual image ${dim} is not ${size} CSS px`);
      assert.ok(Math.abs(snapshot.holderRect[dim] - plan[dim]) <= 0.75, `Actual holder ${dim} differs from preserved-padding plan`);
    }
  }
}

// Pinned alpha>32 foreground bounds for unchanged GR08 864px source, not a
// weakened viewport test: translated transparent canvas is allowed outside its holder.
function visibleHeroRect(snapshot,species){
  const r=snapshot.imageRect;if(species!==40)return r;
  return {x:r.x+r.width*287/864,right:r.x+r.width*821/864,y:r.y+r.height*7/864,bottom:r.y+r.height*860/864};
}
function assertScopedGRGeometry(snapshot,species){
  assertMeasured(snapshot,species);
  assert.equal(snapshot.placeholderHidden,true,'Ready image hides missing/loading placeholder');assert.equal(snapshot.holderHidden,false);assert.notEqual(snapshot.holderDisplay,'none');
  assert.equal(snapshot.holderSpeciesId,`species-${String(species).padStart(3,'0')}`);
  const r=snapshot.imageRect,h=snapshot.holderRect,n=snapshot.natural,c=snapshot.contentSize;
  const expectedScale=Math.min(c[0]/n[0],c[1]/n[1]),actualScale=Math.min(r.width/n[0],r.height/n[1]);
  assert.ok(Math.abs(actualScale-expectedScale)<.002,'Unchanged object-fit contain scale');
  assert.equal(snapshot.holderStyle,null,'Normal scoped review must not inject holder sizing');
  if(species===40){
    assert.ok(Math.abs(r.width-r.height)<.75,'GR08 image box remains intrinsic square');
    const match=snapshot.imageTransform.match(/^matrix\(([^)]+)\)$/);assert.ok(match,'GR08 translation is active');
    const matrix=match[1].split(',').map(Number);
    assert.deepEqual(matrix.slice(0,4),[1,0,0,1],'GR08 transform cannot scale, rotate or skew');assert.equal(matrix[5],0);
    assert.ok(Math.abs(matrix[4]+r.width*122/864)<.75,'Exact horizontal silhouette correction');
    const visible=visibleHeroRect(snapshot,species),center=(visible.x+visible.right)/2;
    assert.ok(Math.abs(center-(h.x+h.width/2))<.75,'GR08 visible silhouette centered on holder');
    assert.ok(visible.x>=h.x-.75&&visible.right<=h.right+.75,'Foreground remains inside holder');
    assert.ok(visible.x>=-1&&visible.right<=snapshot.viewport.width+1&&visible.y>=-1&&visible.bottom<=snapshot.viewport.height+1,'Visible GR08 foreground fully in viewport');
  }else{
    assert.equal(snapshot.imageTransform,'none','Adjacent GR07/GR09 and GR06/GR21/GR22/GR26 must not inherit GR08 transform');
    assert.ok(r.x>=-1&&r.right<=snapshot.viewport.width+1&&r.y>=-1&&r.bottom<=snapshot.viewport.height+1,'Adjacent and four approved GR image box visible after normal scrolling');
  }
}
function assertScopedGRCoverage(rows){
  assert.equal(rows.length,24);
  for(const [width,height]of [[320,740],[390,844],[844,320]]){
    const group=rows.filter(r=>r.viewport.width===width&&r.viewport.height===height);
    assert.deepEqual(group.map(r=>r.speciesIndex),[40,39,41,40,38,48,49,52],'Normal navigation and GR08 re-entry coverage');
    for(const row of group){assertScopedGRGeometry(row,row.speciesIndex);assert.ok(row.heroScreenshot);}
  }
}

function assertThumbnailMeasured(actual,species){return assertCohortThumbnailMeasured(actual,species,APPROVED44);}
function assertScopedGRThumbnailMeasured(actual,species){return assertCohortThumbnailMeasured(actual,species,APPROVED_GR_FIXES);}
function assertCohortThumbnailMeasured(actual,species,cohort){
  const expected=cohort.find(e=>e.speciesIndex===species);assert.ok(expected);
  assert.equal(actual.speciesIndex,species);assert.equal(actual.displayCode,expected.displayCode);
  assert.equal(actual.src,new URL(expected.thumbnail.src,PUBLIC_BASE).href);
  assert.deepEqual(actual.natural,[expected.thumbnail.width,expected.thumbnail.height]);
  assert.equal(actual.complete,true);assert.equal(actual.hidden,false);assert.equal(actual.loading,'lazy');assert.equal(actual.objectFit,'contain');
  const r=actual.imageRect,b=actual.rowRect,v=actual.viewport;
  assert.ok(Math.abs(r.width-32)<=.75&&Math.abs(r.height-32)<=.75,'Normal thumbnail must remain32 CSS px');
  assert.ok(r.x>=b.x-.75&&r.right<=b.right+.75&&r.y>=b.y-.75&&r.bottom<=b.bottom+.75,'Thumbnail contained in normal row');
  assert.ok(r.x>=-1&&r.right<=v.width+1&&r.y>=-1&&r.bottom<=v.height+1,'Actual thumbnail must be visible after scrolling');
}
function assertScopedGRThumbnailCoverage(rows){
  assert.equal(rows.length,12,'Exactly four new GR thumbnails at each of three widths');
  const ids=APPROVED_GR_FIXES.map(e=>e.speciesIndex).sort((a,b)=>a-b);
  for(const width of [1440,390,360]){
    const group=rows.filter(e=>e.viewport.width===width);
    assert.deepEqual(group.map(e=>e.speciesIndex).sort((a,b)=>a-b),ids);
    for(const row of group){assertScopedGRThumbnailMeasured(row,row.speciesIndex);if(width===360)assert.equal(row.screenshot,null);else assert.ok(row.screenshot);}
  }
}
function assertApproved44Coverage(evidence){
  for(const width of [1440,390,360]){
    const rows=(evidence.approved44ThumbnailCaptures??[]).filter(e=>e.viewport.width===width);
    assert.deepEqual(rows.map(e=>e.speciesIndex).sort((a,b)=>a-b),APPROVED44_IDS,'Exactly44 mounted thumbnails per viewport');
    for(const row of rows){assertThumbnailMeasured(row,row.speciesIndex);if(width===360)assert.equal(row.screenshot,null);else assert.ok(row.screenshot);}
  }
  assert.equal(evidence.approved44ThumbnailCaptures.length,132);
  for(const width of [1440,390]){
    const rows=evidence.captures.filter(e=>APPROVED44_IDS.includes(e.speciesIndex)&&e.viewport.width===width&&e.sizeTarget==='NORMAL_UNMODIFIED');
    assert.deepEqual(rows.map(e=>e.speciesIndex).sort((a,b)=>a-b),APPROVED44_IDS,'Exactly44 normal desktop/mobile heroes');
    for(const row of rows){assertMeasured(row,row.speciesIndex,null,evidence.dexStarter);assert.ok(row.heroScreenshot);}
  }
}

// DOM observation only. No application/session objects or private APIs are read.
function mountedSnapshot() {
  const root = document.querySelector('.cm-vs2-root[data-screen="DATABASE"]');
  const row = root?.querySelector('.cm-vs2-database__row[data-selected="true"]');
  const detail = root?.querySelector('.cm-vs2-database__detail');
  const holder = detail?.querySelector('.cm-dex-hero');
  const image = holder?.querySelector('.cm-dex-hero__image');
  if (!row || !holder || !image) throw Error('NORMAL_DEX_NOT_VIEWABLE: no mounted normal hero; no unlock fallback is permitted');
  const hs = getComputedStyle(holder), is = getComputedStyle(image);
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  return { speciesIndex: Number(row.dataset.speciesIndex), displayCode: row.dataset.displayCode, rowState: row.dataset.state,
    title: detail.querySelector('h2')?.textContent, src: image.currentSrc || image.src, art: holder.dataset.art,
    complete: image.complete, hidden: image.hidden, natural: [image.naturalWidth, image.naturalHeight],
    holderRect: rect(holder), imageRect: rect(image), padding: [hs.paddingTop, hs.paddingRight, hs.paddingBottom, hs.paddingLeft].map(Number.parseFloat),
    placeholderHidden: holder.querySelector('.cm-dex-hero__placeholder')?.hidden, holderHidden:holder.hidden, holderDisplay:hs.display,
    holderSpeciesId: holder.dataset.speciesId, imageTransform: is.transform, contentSize: [holder.clientWidth-parseFloat(hs.paddingLeft)-parseFloat(hs.paddingRight),holder.clientHeight-parseFloat(hs.paddingTop)-parseFloat(hs.paddingBottom)],
    holderStyle: holder.getAttribute('style'), cssHolderSize: [hs.width, hs.height], cssImageSize: [is.width, is.height],
    boxSizing: hs.boxSizing, objectFit: is.objectFit, imageRendering: is.imageRendering, imageOpacity: is.opacity, imageFilter: is.filter,
    background: hs.backgroundColor, theme: document.documentElement.dataset.theme ?? null,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    documentOverflow: document.documentElement.scrollWidth > innerWidth };
}
async function checkPolicy(repo) {
  const policyPath = path.join(repo, 'src/championship/app/friendsPlaytestPolicy.js');
  const { FRIENDS_PLAYTEST_POLICY: policy } = await import(pathToFileURL(policyPath).href);
  assert.equal(policy.enabled, true, 'Existing friends playtest is disabled; do not override it');
  assert.equal(policy.fullDexView, true, 'Normal full-Dex view is unavailable; do not force registration');
  const files = ['src/championship/app/friendsPlaytestPolicy.js', 'src/championship/app/main.js',
    'src/championship/app/championshipStandaloneApp.js', 'src/championship/database/databaseRuntime.js',
    'src/championship/app/vs4Screens.js', 'src/championship/app/vs2Styles.css'];
  const main = fs.readFileSync(path.join(repo, files[1]), 'utf8');
  const standalone = fs.readFileSync(path.join(repo, files[2]), 'utf8');
  const runtime = fs.readFileSync(path.join(repo, files[3]), 'utf8');
  assert.match(main, /playtestPolicy:\s*FRIENDS_PLAYTEST_POLICY/);
  assert.match(standalone, /fullView:\s*playtestPolicy\?\.enabled\s*===\s*true\s*&&\s*playtestPolicy\.fullDexView/);
  assert.match(runtime, /fullView\s*\?\s*\{\s*viewable:\s*true\s*\}/);
  return { enabled: policy.enabled, fullDexView: policy.fullDexView,
    sourceHashes: files.map(file => ({ file, sha256: sha256(fs.readFileSync(path.join(repo, file))) })) };
}
// The comic can advance itself between visibility inspection and an optional tap.
// Accept removal only with an observed next envelope or a still-visible comic panel.
async function clickOptionalComicControl(page, control, options = {}) {
  if (!await control.isVisible()) return;
  try {
    await control.click({ ...options, timeout: 1000 });
  } catch (error) {
    if (error.name === 'TimeoutError' && typeof control.count === 'function'
      && await control.count() === 0 && await page.locator('.cm-opening-story').count() === 1
      && await page.locator('.cm-opening-story').isVisible()) return;
    if (error.name !== 'TimeoutError'
      || await page.locator('.cm-opening-story').count() !== 0
      || !await page.locator('.cm-opening__envelope').isVisible()) throw error;
  }
}
async function main() {
  const { chromium } = require('playwright');
  const { resolveAsset, serveBuild } = require('./alternate-form-browser-support.cjs');
  const root = path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT || 'dist/github-playtest');
  const output = require('./browser-qa-output.cjs')('dex-portrait');
  fs.mkdirSync(output, { recursive: true });
  const evidence = { status: 'RUNNING', visualReview: 'PENDING_ROOT_SCREENSHOT_REVIEW',
    commit: process.env.GITHUB_SHA || null, candidateHeadCommit: process.env.DEX_QA_HEAD_SHA || null, baseCommit: process.env.DEX_QA_BASE_SHA || null,
    scope: 'Adds GR08 visible-silhouette centering/unchanged contain-scale, GR07/GR09 adjacency and approved GR06/GR21/GR22/GR26 at320/390portrait and844x320landscape. Includes all approved44 list thumbnails plus unmodified desktop/mobile heroes; preserves original194 metadata. Normal fresh public-playtest UI: approved Dex040/189 with preserved063/070 with unchanged117/055/071/072 comparisons at normal desktop/mobile and128/256 light/dark contain; four existing promoted forms retain normal hero/source/target preview coverage. Only mounted matrix-holder size/backdrop CSS is temporarily overridden.',
    exclusions: ['No visual/anatomy/alpha PASS from automation', 'No runtime-action replacement', 'No physical-device acceptance', 'No public deployment claim'],
    captures: [], assetChecks: [], console: [], pageErrors: [], networkErrors: [], cleanupErrors: [] };
  const write = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
  let server, browser, context, page;
  const imageResponses = new Map();
  const thumbnailResponses = new Map();
  const scopedGRThumbnailResponses = new Map();
  const imageJobs = [];
  async function timedScreenshot(target,options){
    const started=Date.now();let completed=false;
    try{const result=await target.screenshot(options);completed=true;return result;}
    finally{(evidence.screenshotTimings??=[]).push({file:path.basename(options.path),durationMs:Date.now()-started,completed});}
  }
  async function shot(name) { if (page) await timedScreenshot(page,{ path: path.join(output, name + '.png'), fullPage: true }); }
  try {
    evidence.policy = await checkPolicy(process.cwd());
    const buildBytes = fs.readFileSync(path.join(root, 'pages-build.json'));
    const compiledCatalogs = await require('./compiled-catalog-evidence.cjs').compiledCatalogEvidence(root);
    const build = compiledCatalogs.build;
    evidence.compiledCatalogProvenance = compiledCatalogs.records;
    assert.equal(build.target, 'GITHUB_PAGES_OWNER_PLAYTEST'); assert.equal(build.publicPlaytest?.ownerApproved, true);
    if(process.env.GITHUB_SHA)assert.equal(build.commit,process.env.GITHUB_SHA,'Built checkout must match tested commit');
    evidence.build = { buildId: build.buildId, commit:build.commit, inputSha256:build.inputSha256, target: build.target, manifestSha256: sha256(buildBytes) };
    assert.ok(resolveAsset(root, '/championship.html'));
    assertOriginalApprovalLineage();
    const registryPath = 'src/data/championship/database-hero-portraits.public.v1.json';
    const catalog = assertRegistry(fs.readFileSync(path.join(process.cwd(), registryPath)), compiledCatalogs.read(registryPath));
    assert.equal(catalog.entries.length,EXPECTED_REGISTRY_COUNT,'194 preserved heroes plus exact approved20');
    evidence.registry = { count: catalog.entries.length, sourceAndCompiledInputSha256: sha256(compiledCatalogs.read(registryPath)) };
    const productPath='src/data/championship/product-species-extensions.r1.json',assetPath='src/data/championship/alternate-form-assets.r1.json',bindingPath='src/data/championship/public-alternate-form-bindings.v1.json';
    evidence.productionCatalogs=[];
    for(const file of [productPath,bindingPath]){
      const sourceBytes=fs.readFileSync(path.join(process.cwd(),file)),builtBytes=compiledCatalogs.read(file);
      assert.equal(sha256(sourceBytes),sha256(builtBytes));evidence.productionCatalogs.push({file,sha256:sha256(builtBytes)});
    }
    for(const entry of JSON.parse(compiledCatalogs.read(productPath)).entries)for(const gate of ['runtimeReady','evolutionReady','networkReady'])assert.equal(entry[gate],true);
    assert.equal(resolveAsset(root,'/'+assetPath),null,'Authoring metadata must stay outside the public artifact');
    const promotedAssets=JSON.parse(fs.readFileSync(path.join(process.cwd(),assetPath))).characters;
    const publicBindings=JSON.parse(compiledCatalogs.read(bindingPath)).characters;
    assert.deepEqual(promotedAssets.map(e=>e.speciesIndex).sort((a,b)=>a-b),[211,222,229,230]);
    for(const entry of promotedAssets){assert.equal(entry.runtimeReady,true);assert.equal(entry.qa.normalPath,'PASS');}
    assert.equal(publicBindings.length,4);
    for(const entry of promotedAssets){const binding=publicBindings.find(row=>row.speciesIndex===entry.speciesIndex);assert.ok(binding);for(const key of ['speciesId','speciesIndex','entityId','motionDonorEntityId'])assert.equal(binding[key],entry[key]);}
    const previewExpected=await require('./dex-preview-contract.cjs').previewExpectations(root, JSON.parse(compiledCatalogs.read(registryPath)));
    evidence.previewAssetChecks=[...previewExpected.values()];
    for (const expected of Object.values(EXPECTED)) {
      const entry = catalog.entries.find(e => e.speciesIndex === expected.speciesIndex);
      assert.ok(entry, `Normal production registry missing ${expected.speciesId}`);
      const asset = resolveAsset(root, '/' + expected.src); assert.ok(asset, 'Selected display image absent from approved build');
      const bytes = fs.readFileSync(asset); assertAsset(entry, bytes, expected);
      evidence.assetChecks.push({ speciesIndex: expected.speciesIndex, source: 'EXACT_BUILT_ARTIFACT', sha256: sha256(bytes), bytes: bytes.length });
    }
    evidence.all230ArtifactAssets=[];
    for(const entry of catalog.entries)for(const [role,media]of [['hero',entry],['thumbnail',entry.thumbnail]]){
      assert.ok(media);const file=resolveAsset(root,'/'+media.src);assert.ok(file);
      const bytes=fs.readFileSync(file);assert.equal(sha256(bytes),media.sha256);
      evidence.all230ArtifactAssets.push({speciesIndex:entry.speciesIndex,role,sha256:sha256(bytes),bytes:bytes.length});
    }
    assert.equal(evidence.all230ArtifactAssets.length,460);
    for(const entry of [...APPROVED44,...APPROVED_GR_FIXES]){
      const thumb=entry.thumbnail,asset=resolveAsset(root,'/'+thumb.src);assert.ok(asset,'Approved20 thumbnail missing from build');
      const bytes=fs.readFileSync(asset);assert.equal(sha256(bytes),thumb.sha256);assert.ok(bytes.includes(Buffer.from('VP8L')));
      evidence.assetChecks.push({speciesIndex:entry.speciesIndex,role:'thumbnail',source:'EXACT_BUILT_ARTIFACT',sha256:sha256(bytes),bytes:bytes.length});
    }
    server = await serveBuild(root);
    browser = await chromium.launch({ channel: 'chromium', headless: true, chromiumSandbox: true });
    evidence.browserVersion = browser.version(); evidence.launch = { channel: 'chromium', headless: true, chromiumSandbox: true, customArgs: [] };
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'zh-TW', serviceWorkers: 'block' });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    // Existing repository exact-build routing pattern: no live/public provider is
    // contacted. Public-location code sees its approved URL and receives only the
    // byte-identical locally built files; no response body or runtime code is edited.
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith(server.origin + '/')) return route.continue();
      if (url.startsWith(PUBLIC_BASE) && ['GET', 'HEAD'].includes(route.request().method())) {
        const parsed = new URL(url), relative = parsed.pathname.slice(new URL(PUBLIC_BASE).pathname.length);
        if(relative.startsWith('qa/alternate-form-')||relative==='alternate-form-qa.html'){evidence.networkErrors.push({url,error:'NORMAL_ENTRY_MUST_NOT_LOAD_ALTERNATE_QA'});return route.abort();}
        if (resolveAsset(root, '/' + relative)) {
          const response = await route.fetch({ url: server.origin + '/' + relative + parsed.search, maxRedirects: 0 });
          return route.fulfill({ response });
        }
      }
      evidence.networkErrors.push({ url, error: 'NON_BUILD_REQUEST_BLOCKED' });
      return route.abort();
    });
    page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    page.on('console', message => evidence.console.push({ type: message.type(), text: message.text() }));
    page.on('requestfailed', request => { const error = request.failure()?.errorText; if (error !== 'net::ERR_ABORTED') evidence.networkErrors.push({ url: request.url(), error }); });
    page.on('response', response => {
      if (response.status() >= 400) evidence.networkErrors.push({ url: response.url(), status: response.status() });
      const thumbnailEntry=[...APPROVED44,...APPROVED_GR_FIXES].find(e=>response.url()===new URL(e.thumbnail.src,PUBLIC_BASE).href);
      if(thumbnailEntry)imageJobs.push((async()=>{
        const bytes=await response.body();assert.equal(response.status(),200);assert.equal(sha256(bytes),thumbnailEntry.thumbnail.sha256);
        const target=APPROVED_GR_FIXES.some(e=>e.speciesIndex===thumbnailEntry.speciesIndex)?scopedGRThumbnailResponses:thumbnailResponses;
        target.set(thumbnailEntry.speciesIndex,{speciesIndex:thumbnailEntry.speciesIndex,role:'thumbnail',source:'BROWSER_IMAGE_RESPONSE',url:response.url(),status:response.status(),sha256:sha256(bytes),bytes:bytes.length});
      })().catch(error=>evidence.networkErrors.push({url:response.url(),error:String(error)})));
      const expected = Object.values(EXPECTED).find(e => response.url() === new URL(e.src, PUBLIC_BASE).href);
      if (expected) imageJobs.push((async () => {
        const bytes = await response.body();
        const observed = { speciesIndex: expected.speciesIndex, source: 'BROWSER_IMAGE_RESPONSE', url: response.url(), status: response.status(), sha256: sha256(bytes), bytes: bytes.length };
        assert.equal(response.status(), 200); assert.equal(observed.sha256, expected.sha256);
        imageResponses.set(expected.speciesIndex, observed);
      })().catch(error => evidence.networkErrors.push({ url: response.url(), error: String(error) })));
    });
    await page.goto(PUBLIC_BASE + 'championship.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#cm-login').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false);
    if (await page.locator('#cm-film-skip').isVisible()) {
      await page.locator('#cm-film-skip').click(); await page.locator('#cm-opening-film').waitFor({ state: 'hidden' });
      await page.waitForTimeout(400); // Existing real input guard; clocks are never changed.
    }
    await page.locator('#cm-login').click(); await page.locator('#cm-new-game').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#cm-continue').isEnabled(), false, 'Ephemeral profile must start without a user save');
    await page.locator('#cm-new-game').click();
    const story = page.locator('.cm-opening-story'), deadline = Date.now() + 120000;
    while (await story.count()) {
      if (Date.now() > deadline) throw Error('NORMAL_ONBOARDING_BLOCKED: opening comic timeout');
      await clickOptionalComicControl(page, page.locator('[data-story-action="text"]'));
      await clickOptionalComicControl(page, story, { position: { x: 10, y: 10 } });
      await page.waitForTimeout(1200);
    }
    await page.locator('.cm-opening__envelope').click(); await page.locator('.cm-opening__letter button').click();
    await page.locator('#cm-opening-name').fill('圖鑑測試'); await page.locator('.cm-opening__name button[type="submit"]').click();
    await page.locator('.cm-opening__choices button').first().click();
    await page.locator('.cm-opening__envelope').click(); await page.locator('.cm-opening__letter button').click(); await page.locator('.cm-opening__letter button').click();
    if (await page.locator('[data-egg-confirm]').isVisible()) await page.locator('[data-egg-confirm]').click();
    await page.locator('#cm-opening-name').fill('小夥伴'); await page.locator('.cm-opening__name button[type="submit"]').click();
    await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();
    const decline = page.locator('dialog[open] [data-action="decline"]');
    await decline.waitFor({ state: 'visible', timeout: 15000 }); await decline.click(); await decline.waitFor({ state: 'hidden' });
    await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').waitFor({ state: 'visible' });
    const registration = () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('championshipModernSave:v1'));
      return { registeredSpecies: saved?.progression?.registeredSpecies ?? [], starter: saved?.creature?.speciesId ?? null };
    }); // Read-only observation of this disposable profile, never an imported save.
    // Observe public mounted Home metadata, not application objects or intents.
    await page.evaluate(() => {
      const state={starter:null,history:[],error:null};
      const observe=()=>{
        const host=document.querySelector('#cm-root[data-active-screen="RAISING_HOME"] [data-resident-assets]');
        if(!host)return;
        let residents;
        try {residents=JSON.parse(host.dataset.residentAssets);} catch {state.error='Invalid Home resident metadata';return;}
        if(Array.isArray(residents)&&residents.length===0)return; // Temporary loading metadata is not a roster change.
        if(!Array.isArray(residents)||residents.length!==1||residents[0].creatureId!=='resident:species-000'){state.error='Unexpected normal starter roster';return;}
        const id=Number(residents[0].speciesId.match(/species-(\d+)$/)?.[1]);
        if(state.starter!==id){state.starter=id;state.history.push(id);}
      };
      state.observer=new MutationObserver(observe);
      state.observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-resident-assets']});
      observe();window.__dexStarterObservation=state;
    });
    await page.waitForFunction(()=>window.__dexStarterObservation.starter!==null||window.__dexStarterObservation.error!==null);
    evidence.registrationBefore = await registration();
    const initialHomeStarter=await page.evaluate(()=>window.__dexStarterObservation.starter);
    assertSavedStarterRegistration({registeredSpecies:[],starter:'species-000'},evidence.registrationBefore,initialHomeStarter);
    await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();
    await page.locator('.cm-toolbar__menu:not([hidden]) button[data-entry-id="database"]').click();
    await page.locator('#cm-root[data-active-screen="DATABASE"]').waitFor();
    await page.locator('.cm-vs2-database__stage').selectOption('');
    async function checkDexRegistration({homeBoundary=false}={}) {
      const observed=await page.evaluate(()=>({starter:window.__dexStarterObservation.starter,history:window.__dexStarterObservation.history,error:window.__dexStarterObservation.error}));
      assert.equal(observed.error,null);
      const rows=await page.locator('.cm-vs2-database__row[data-state="REGISTERED"]').evaluateAll(rows=>rows.map(row=>Number(row.dataset.speciesIndex)));
      if(homeBoundary)evidence.dexStarter=assertStarterRegistration(rows,observed.starter);
      else assert.deepEqual(rows,evidence.dexStarter===0?[]:[14],'Read-only Dex browsing must not change registration');
      assert.ok(['[0]','[0,14]','[14]'].includes(JSON.stringify(observed.history)),'Only one natural default-egg hatch is allowed');
      evidence.starterHistory=[...observed.history];
    }
    await checkDexRegistration({homeBoundary:true});
    await require('./championship-database-swipe-browser.cjs')(page,{output,evidence,checkDexRegistration});
    await checkDexRegistration({homeBoundary:true});
    const listReturn = page.locator('.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-footer button');
    async function openSpecies(species, observeScoped=false) {
      const started=Date.now();
      const detail = page.locator('.cm-vs2-database__detail');
      if (await detail.isVisible()) { await listReturn.click(); await detail.waitFor({ state: 'hidden' }); }
      const row = page.locator(`.cm-vs2-database__row[data-species-index="${species}"][data-display-code="${EXPECTED[species].displayCode}"]`);
      await row.waitFor({ state: 'visible' }); await row.scrollIntoViewIfNeeded(); await row.click();
      if(observeScoped){
        const state=await page.locator(HERO).evaluate(holder=>({speciesId:holder.dataset.speciesId,art:holder.dataset.art,imageHidden:holder.querySelector('img').hidden,placeholderHidden:holder.querySelector('.cm-dex-hero__placeholder').hidden}));
        assert.equal(state.speciesId,`species-${String(species).padStart(3,'0')}`);assert.ok(['loading','ready'].includes(state.art));
        if(state.art==='loading'){assert.equal(state.imageHidden,true);assert.equal(state.placeholderHidden,true);}else{assert.equal(state.imageHidden,false);assert.equal(state.placeholderHidden,true);}
        (evidence.scopedGRLoadSamples??=[]).push(state);
      }
      await page.locator(HERO + '[data-art="ready"] .cm-dex-hero__image').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForFunction(([width,height]) => { const image = document.querySelector('.cm-dex-hero__image'); return image?.complete && image.naturalWidth === width && image.naturalHeight === height; }, [EXPECTED[species].width ?? 1254, EXPECTED[species].height ?? 1254]);
      const snapshot = await page.evaluate(mountedSnapshot); assertMeasured(snapshot, species, null, evidence.dexStarter);
      await checkDexRegistration();
      (evidence.navigationTimings??=[]).push({speciesIndex:species,viewport:snapshot.viewport,durationMs:Date.now()-started});
      return snapshot;
    }
    async function capture(name, species, size = null, backdrop = 'native') {
      const started=Date.now(),isApproved44=APPROVED44_IDS.includes(species);
      await page.locator(HERO).scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const snapshot = await page.evaluate(mountedSnapshot); assertMeasured(snapshot, species, size, evidence.dexStarter);
      const visible=visibleHeroRect(snapshot,species);
      assert.ok(visible.x >= -1 && visible.y >= -1 && visible.right <= snapshot.viewport.width + 1 && visible.bottom <= snapshot.viewport.height + 1, 'Whole visible hero must be visible after normal scrolling');
      if(!isApproved44)await shot(name);
      await timedScreenshot(page.locator(HERO),{ path: path.join(output, name + '-hero.png') });
      evidence.captures.push({ name, sizeTarget: size === null ? 'NORMAL_UNMODIFIED' : 'IMAGE_CONTENT_BOX', requestedSize: size, backdrop, ...snapshot,
        screenshot: isApproved44?null:name + '.png', heroScreenshot: name + '-hero.png', durationMs:Date.now()-started }); write();
      return snapshot;
    }
    async function measureListCards(viewport) {
      const detail=page.locator('.cm-vs2-database__detail');
      if(await detail.isVisible()){await listReturn.click();await detail.waitFor({state:'hidden'});}
      await page.locator('.cm-vs2-database__catalog').waitFor({state:'visible'});
      const measured=await page.locator('.cm-vs2-database__row--thumb').evaluateAll(rows=>rows.map(row=>{
        const box=row.getBoundingClientRect();
        return {id:Number(row.dataset.speciesIndex),visible:box.width>0&&box.height>0,
          inside:[...row.querySelectorAll('img,strong,.cm-vs2-shop__meta')].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left-.75&&r.right<=box.right+.75&&r.top>=box.top-.75&&r.bottom<=box.bottom+.75;}),
          lazy:row.querySelector('img').loading==='lazy'};
      }));
      assert.equal(measured.length,EXPECTED_REGISTRY_COUNT);assert.ok(measured.every(row=>row.visible&&row.inside&&row.lazy),'All list thumbnail/name/code bounds remain inside their cards');
      for(const expected of APPROVED44){
        const started=Date.now();
        const row=page.locator(`.cm-vs2-database__row[data-species-index="${expected.speciesIndex}"][data-display-code="${expected.displayCode}"]`);
        assert.equal(await row.count(),1);await row.scrollIntoViewIfNeeded();
        const img=row.locator('.cm-dex-list-thumb');await img.waitFor({state:'visible'});await img.evaluate(image=>image.decode());
        const actual=await row.evaluate(element=>{
          const image=element.querySelector('img'),r=image.getBoundingClientRect(),b=element.getBoundingClientRect(),css=getComputedStyle(image);
          return {speciesIndex:Number(element.dataset.speciesIndex),displayCode:element.dataset.displayCode,src:image.currentSrc||image.src,complete:image.complete,hidden:image.hidden,natural:[image.naturalWidth,image.naturalHeight],objectFit:css.objectFit,loading:image.loading,
            imageRect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},rowRect:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
        });
        assertThumbnailMeasured(actual,expected.speciesIndex);
        const screenshot=viewport.width===360?null:`approved44-${expected.speciesIndex}-thumbnail-${viewport.width}.png`;
        if(screenshot)await timedScreenshot(row,{path:path.join(output,screenshot)});
        (evidence.approved44ThumbnailCaptures??=[]).push({...actual,screenshot,durationMs:Date.now()-started});write();
      }
      for(const expected of APPROVED_GR_FIXES){
        const started=Date.now();
        const row=page.locator(`.cm-vs2-database__row[data-species-index="${expected.speciesIndex}"][data-display-code="${expected.displayCode}"]`);
        assert.equal(await row.count(),1);await row.scrollIntoViewIfNeeded();
        const img=row.locator('.cm-dex-list-thumb');await img.waitFor({state:'visible'});await img.evaluate(image=>image.decode());
        const actual=await row.evaluate(element=>{
          const image=element.querySelector('img'),r=image.getBoundingClientRect(),b=element.getBoundingClientRect(),css=getComputedStyle(image);
          return {speciesIndex:Number(element.dataset.speciesIndex),displayCode:element.dataset.displayCode,src:image.currentSrc||image.src,complete:image.complete,hidden:image.hidden,natural:[image.naturalWidth,image.naturalHeight],objectFit:css.objectFit,loading:image.loading,
            imageRect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},rowRect:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
        });
        assertScopedGRThumbnailMeasured(actual,expected.speciesIndex);
        const screenshot=viewport.width===360?null:`scoped-gr-${expected.speciesIndex}-thumbnail-${viewport.width}.png`;
        if(screenshot)await timedScreenshot(row,{path:path.join(output,screenshot)});
        (evidence.scopedGRThumbnailCaptures??=[]).push({...actual,screenshot,durationMs:Date.now()-started});write();
      }
      (evidence.listCardChecks??=[]).push({viewport,checked:measured.length,status:'PASS'});
    }
    await measureListCards({width:1440,height:1000});
    for (const species of MATRIX_TARGETS) {
      await openSpecies(species);
      const normal = await capture(`${species}-desktop-normal`, species);
      const holder = await page.locator(HERO).elementHandle();
      const original = await holder.getAttribute('style');
      try {
        for (const size of [128, 256]) for (const backdrop of ['light', 'dark']) {
          const plan = sizePlan(size, normal.padding);
          await holder.evaluate((element, { plan, backdrop, original }) => {
            if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original);
            for (const [key, value] of Object.entries({ width: `${plan.width}px`, height: `${plan.height}px`, 'max-width': 'none', 'max-height': 'none', 'min-width': '0px', 'min-height': '0px', 'flex-shrink': '0', background: backdrop === 'light' ? '#f2f4f7' : '#101820' })) element.style.setProperty(key, value, 'important');
          }, { plan, backdrop, original });
          const resized = await capture(`${species}-${size}-${backdrop}`, species, size, backdrop);
          assert.equal(resized.imageRendering, normal.imageRendering); assert.equal(resized.imageOpacity, normal.imageOpacity); assert.equal(resized.imageFilter, normal.imageFilter);
        }
      } finally {
        await holder.evaluate((element, original) => { if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original); }, original);
        assert.equal(await holder.getAttribute('style'), original, 'Restore the exact pre-test style attribute');
        await holder.dispose();
      }
      const restored = await capture(`${species}-desktop-restored`, species);
      assert.equal(restored.holderStyle, normal.holderStyle);
      assert.deepEqual(restored.cssHolderSize, normal.cssHolderSize);
    }
    // Normal re-entry and responsive rendering, still using the same session/UI.
    for(const species of [...MATRIX_TARGETS,...Object.keys(APPROVED_INTAKE).map(Number),...APPROVED44_IDS]){await openSpecies(species);await capture(`${species}-desktop-reentry`,species);}
    await page.setViewportSize({ width: 390, height: 844 });
    await measureListCards({width:390,height:844});
    for (const species of [...MATRIX_TARGETS,70,...Object.keys(APPROVED_INTAKE).map(Number),...APPROVED44_IDS]) { await openSpecies(species); await capture(`${species}-mobile-normal-${evidence.captures.length}`, species); }
    await page.setViewportSize({width:360,height:800});await measureListCards({width:360,height:800});
    // Bounded extra normal-size coverage; no inline CSS, save, registration or app mutations.
    evidence.scopedGRCaptures=[];
    for(const viewport of [{width:320,height:740},{width:390,height:844},{width:844,height:320}]){
      await page.setViewportSize(viewport);
      for(const [step,species]of [40,39,41,40,38,48,49,52].entries()){
        await openSpecies(species,true);await page.locator(HERO).scrollIntoViewIfNeeded();
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const snapshot=await page.evaluate(mountedSnapshot);assertScopedGRGeometry(snapshot,species);
        const heroScreenshot=`scoped-gr-${species}-${viewport.width}x${viewport.height}-${step}.png`;
        await timedScreenshot(page.locator(HERO),{path:path.join(output,heroScreenshot)});
        evidence.scopedGRCaptures.push({...snapshot,heroScreenshot,sizeTarget:'NORMAL_UNMODIFIED'});write();
      }
    }
    assertScopedGRCoverage(evidence.scopedGRCaptures);
    // Production entry only: ordinary rows and route nodes, no fixture/catalog swap.
    evidence.promotedCaptures=[];
    async function capturePreview(holder,species,kind,viewport){
      const img=holder.locator('img');await img.waitFor({state:'visible',timeout:30000});await holder.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const actual=await holder.evaluate(n=>{const image=n.querySelector('img'),r=image.getBoundingClientRect();return {art:n.dataset.art,revealed:n.dataset.revealed,src:image.currentSrc||image.src,complete:image.complete,hidden:image.hidden,natural:[image.naturalWidth,image.naturalHeight],objectFit:getComputedStyle(image).objectFit,imageRect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};});
      const expectedPreview=previewExpected.get(species);
      assert.equal(actual.art,'ready');assert.equal(actual.revealed,'true');assert.equal(actual.complete,true);assert.equal(actual.hidden,false);assert.equal(actual.objectFit,'contain');assert.deepEqual(actual.natural,[expectedPreview.width,expectedPreview.height]);assert.equal(actual.src,expectedPreview.url);
      assert.ok(actual.imageRect.width>0&&actual.imageRect.height>0);assert.ok(actual.imageRect.x>=-1&&actual.imageRect.right<=viewport.width+1&&actual.imageRect.y>=-1&&actual.imageRect.bottom<=viewport.height+1);
      const name=`production-${species}-${kind}-${viewport.width}`;await shot(name);await timedScreenshot(holder,{path:path.join(output,name+'-image.png')});evidence.promotedCaptures.push({speciesIndex:species,displayCode:EXPECTED[species].displayCode,kind,viewport,screenshot:name+'.png',imageScreenshot:name+'-image.png',...actual});write();
    }
    for(const viewport of [{width:844,height:390},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      for(const species of [222,230,211,229]){
        await openSpecies(species);await capture(`production-${species}-hero-${viewport.width}`,species);
        await capturePreview(page.locator('.cm-vs2-database__detail .cm-dex-routes__source .cm-dex-portrait'),species,'source-preview',viewport);
      }
      for(const [source,targets] of [[139,[211,229]],[144,[222,230]]]){
        const detail=page.locator('.cm-vs2-database__detail');if(await detail.isVisible()){await listReturn.click();await detail.waitFor({state:'hidden'});}
        const row=page.locator(`.cm-vs2-database__row[data-species-index="${source}"]`);await row.scrollIntoViewIfNeeded();await row.click();await detail.waitFor({state:'visible'});
        for(const species of targets){const target=detail.locator(`.cm-dex-routes__target[aria-label^="${EXPECTED[species].displayCode} · "]`);assert.equal(await target.count(),1);assert.equal(await target.getAttribute('data-revealed'),'true');await capturePreview(target.locator('.cm-dex-portrait'),species,'evolution-choice-preview',viewport);}
      }
    }
    evidence.normalProductionFormCoverage='HERO_SOURCE_TARGET_4_FORMS_2_VIEWPORTS';
    evidence.registrationAfter = await registration();
    await checkDexRegistration();
    assertSavedStarterRegistration(evidence.registrationBefore,evidence.registrationAfter,evidence.dexStarter);
    await page.evaluate(()=>{window.__dexStarterObservation.observer.disconnect();delete window.__dexStarterObservation;});
    await Promise.all(imageJobs);
    for (const species of Object.keys(EXPECTED).map(Number)) { assert.ok(imageResponses.has(species), `No actual browser image response captured for ${species}`); evidence.assetChecks.push(imageResponses.get(species)); }
    assert.deepEqual([...thumbnailResponses.keys()].sort((a,b)=>a-b),APPROVED44_IDS,'Every approved thumbnail must have a real browser response');
    evidence.assetChecks.push(...thumbnailResponses.values());
    assert.deepEqual([...scopedGRThumbnailResponses.keys()].sort((a,b)=>a-b),APPROVED_GR_FIXES.map(e=>e.speciesIndex).sort((a,b)=>a-b),'Every new GR thumbnail has an exact browser-response hash');
    evidence.assetChecks.push(...scopedGRThumbnailResponses.values());
    assertScopedGRThumbnailCoverage(evidence.scopedGRThumbnailCaptures);
    assertApproved44Coverage(evidence);
    assert.deepEqual(evidence.pageErrors, []); assert.deepEqual(evidence.networkErrors, []);
    evidence.comparisonGroups=['desktop-normal','128-light','128-dark','256-light','256-dark','desktop-restored','desktop-reentry'].map(condition=>({condition,referenceSpecies:117,candidateSpecies:[40,189,63,70,71,72,9,10],visualAcceptance:'PENDING_ROOT_ACTUAL_IMAGE_REVIEW',captures:[40,189,63,70,71,72,9,10,117].map(species=>{const c=evidence.captures.find(x=>x.name===`${species}-${condition}`);assert.ok(c);return {speciesIndex:species,image:c.heroScreenshot,fullPresentation:c.screenshot};})}));
    evidence.visualChecklist=['Approved040/189 with preserved063/070, baby009/010 and071/072 against117 accepted style','Full appendages and normal mobile fit','Cyan edge fringe on light/dark','Exact CSS restoration','Promoted own hero, origin and revealed target identity'];
    // 13 matrix heroes ×8, one mobile re-entry,8 production,18 previous intake ×2,20 approved additions ×2.
    assert.equal(evidence.captures.length,237);assert.equal(evidence.promotedCaptures.length,16);
    assert.equal(evidence.screenshotTimings.length,538,'Preserve506 existing PNGs plus24 scoped GR hero crops and8 new GR thumbnail rows');
    assert.ok(evidence.screenshotTimings.every(row=>row.completed));
    evidence.captureBudget={oldPngs:330,newHeroCropPngs:88,newThumbnailRowPngs:88,scopedGRNormalHeroPngs:24,scopedGRThumbnailRowPngs:8,scopedGRThumbnailMeasurements:12,totalPngs:538,wholeJobTimeoutMinutes:25,fitWithinJob:'NOT_PROVEN_UNTIL_HOSTED_COMPLETION',new360ThumbnailMeasurements:44};
    evidence.status = 'CAPTURE_PASS_VISUAL_REVIEW_PENDING';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.failure = error.stack || String(error);
    console.error(evidence.failure);
    await shot('failure').catch(() => {});
    if (page) evidence.failureDom = await page.locator('#cm-root').innerText().catch(() => null);
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.tracing.stop({ path: path.join(output, 'dex-portrait-trace.zip') }).catch(error => evidence.cleanupErrors.push(String(error)));
      await context.close().catch(error => evidence.cleanupErrors.push(String(error)));
    }
    if (browser) await browser.close().catch(error => evidence.cleanupErrors.push(String(error)));
    if (server) await server.close().catch(error => evidence.cleanupErrors.push(String(error)));
    if (evidence.cleanupErrors.length) { evidence.status = 'FAIL'; process.exitCode = 1; }
    evidence.finishedAt = new Date().toISOString(); write();
  }
  console.log(JSON.stringify({ status: evidence.status, visualReview: evidence.visualReview, captures: evidence.captures.length, output }));
}
async function selfTestOptionalComicClick() {
  const timeout = Object.assign(new Error('obsolete comic control'), { name: 'TimeoutError' });
  const testCase = ({ visible = true, error = null, storyCount = 0, envelopeVisible = true } = {}) => {
    const calls = [];
    const control = { isVisible: async () => visible, click: async options => { calls.push(options); if (error) throw error; } };
    const page = { locator: selector => selector === '.cm-opening-story'
      ? { count: async () => storyCount } : { isVisible: async () => envelopeVisible } };
    return { page, control, calls };
  };
  const normal = testCase();
  await clickOptionalComicControl(normal.page, normal.control, { position: { x: 10, y: 10 } });
  assert.deepEqual(normal.calls, [{ position: { x: 10, y: 10 }, timeout: 1000 }]);
  const absent = testCase({ visible: false });
  await clickOptionalComicControl(absent.page, absent.control); assert.equal(absent.calls.length, 0);
  const advanced = testCase({ error: timeout });
  await clickOptionalComicControl(advanced.page, advanced.control); assert.equal(advanced.calls.length, 1);
  const nextPanel = testCase({ error: timeout, storyCount: 1 });
  nextPanel.control.count = async () => 0;
  nextPanel.page.locator = selector => selector === '.cm-opening-story'
    ? { count: async () => 1, isVisible: async () => true } : { isVisible: async () => false };
  await clickOptionalComicControl(nextPanel.page, nextPanel.control);
  for (const options of [{ storyCount: 1 }, { envelopeVisible: false }, { storyCount: 1, envelopeVisible: false }]) {
    const blocked = testCase({ error: timeout, ...options });
    await assert.rejects(() => clickOptionalComicControl(blocked.page, blocked.control), error => error === timeout);
  }
  const otherError = new Error('browser or selector failed');
  const broken = testCase({ error: otherError });
  await assert.rejects(() => clickOptionalComicControl(broken.page, broken.control), error => error === otherError);
}
async function selfTest() {
  assertOriginalApprovalLineage();
  await selfTestOptionalComicClick();
  new (require('node:vm').Script)('('+mountedSnapshot.toString()+')');
  assert.deepEqual(sizePlan(128, [24, 24, 24, 24]), { size: 128, width: 176, height: 176 });
  assert.deepEqual(sizePlan(256, [24, 24, 24, 24]), { size: 256, width: 304, height: 304 });
  assert.throws(() => sizePlan(80, [24, 24, 24, 24])); assert.throws(() => sizePlan(128, [0, 0, 0, 0]));
  const valid = { speciesIndex: 117, displayCode: 'MA58', rowState: 'UNDISCOVERED', title: '曙刃天駒', src: new URL(EXPECTED[117].src, PUBLIC_BASE).href,
    art: 'ready', complete: true, hidden: false, natural: [EXPECTED[117].width, EXPECTED[117].height], objectFit: 'contain', padding: [24, 24, 24, 24], documentOverflow: false,
    imageRect: { width: 128, height: 128 }, holderRect: { width: 176, height: 176 } };
  assertMeasured(valid, 117, 128);
  assert.equal(assertStarterRegistration([],0),0);
  assert.equal(assertStarterRegistration([14],14),14);
  for(const [rows,starter] of [[[14],0],[[14,117],14],[[117],117],[[],14]])assert.throws(()=>assertStarterRegistration(rows,starter));
  const eggSave={registeredSpecies:[],starter:'species-000'},hatchSave={registeredSpecies:[14],starter:'species-014'};
  assertSavedStarterRegistration(eggSave,eggSave,14);
  assertSavedStarterRegistration(eggSave,hatchSave,14);
  assert.throws(()=>assertSavedStarterRegistration(eggSave,hatchSave,0));
  assert.throws(()=>assertSavedStarterRegistration(eggSave,{registeredSpecies:[14,117],starter:'species-014'},14));
  assert.throws(()=>assertMeasured({...valid,rowState:'REGISTERED'},117,128,14));
  const baby=EXPECTED[14],hatched={...valid,speciesIndex:14,displayCode:baby.displayCode,title:baby.name,natural:[baby.width,baby.height],src:new URL(baby.src,PUBLIC_BASE).href,rowState:'REGISTERED'};
  assertMeasured(hatched,14,128,14);
  assert.throws(()=>assertMeasured(hatched,14,128,0));
  for (const changed of [{ rowState: 'REGISTERED' }, { src: 'wrong.png' }, { objectFit: 'cover' }, { imageRect: { width: 80, height: 80 } }]) assert.throws(() => assertMeasured({ ...valid, ...changed }, 117, 128));
  for (const species of [9,10,40,189,63,70,35,62,36]) {
    const expected=EXPECTED[species];
    const snapshot={...valid,speciesIndex:species,displayCode:expected.displayCode,title:expected.name,natural:[expected.width ?? 1254,expected.height ?? 1254],src:new URL(expected.src,PUBLIC_BASE).href};
    assertMeasured(snapshot,species,128);
    assertMeasured({...snapshot,imageRect:{width:256,height:256},holderRect:{width:304,height:304}},species,256);
    for(const changed of [{natural:[1,1]},{src:new URL('assets/production/database-handpainted-r1-20261015/species-'+String(species).padStart(3,'0')+'.png',PUBLIC_BASE).href},{objectFit:'cover'},{padding:[0,0,0,0]},{hidden:true},{complete:false},{documentOverflow:true}]) assert.throws(()=>assertMeasured({...snapshot,...changed},species,128));
    if([9,10,189,35,36].includes(species))assert.throws(()=>assertMeasured({...snapshot,natural:[1254,1254]},species,128));
  }
  // Approved canonical name cleanup: bind independently to the requested names.
  // Keep strict title equality; reject stale names rather than weakening the assertion.
  for (const [species, name, staleName] of [
    [40, '霜裘龍', '霜裘幼龍'], [63, '翠冠龍', '翠冠幼龍'],
    [70, '星角龍', '星角幼龍'], [71, '裂焰龍', '裂焰幼龍']
  ]) {
    const expected = EXPECTED[species];
    assert.equal(expected.name, name);
    const snapshot = {...valid, speciesIndex:species, displayCode:expected.displayCode,
      title:name, natural:[expected.width ?? 1254, expected.height ?? 1254],
      src:new URL(expected.src, PUBLIC_BASE).href};
    assertMeasured(snapshot, species, 128);
    assert.throws(() => assertMeasured({...snapshot, title:staleName}, species, 128), /Exact species name binding/);
  }
  for(const species of [9,10]){
    const expected=EXPECTED[species],bytes=fs.readFileSync(expected.src);
    assertAsset(expected,bytes,expected);
    for(const key of ['speciesIndex','speciesId','displayCode','src','sha256','width','height']){
      assert.throws(()=>assertAsset({...expected,[key]:typeof expected[key]==='number'?expected[key]+1:'wrong'},bytes,expected));
    }
    const damaged=Buffer.from(bytes);damaged[damaged.length-1]^=1;assert.throws(()=>assertAsset(expected,damaged,expected));
    const oldSrc=`assets/production/database-portraits-b1-20261014/${expected.displayCode}.webp`;
    assert.throws(()=>assertAsset({...expected,src:oldSrc},bytes,expected));
  }
  assert.equal(publicHeroes.entries.length,EXPECTED_REGISTRY_COUNT,'Public registry count must match browser preflight');
  assert.equal(MATRIX_TARGETS.length,13);assert.equal(MATRIX_TARGETS.length*8+1+8,113);
  const scopedThumbFixtures=[];
  for(const width of [1440,390,360])for(const e of APPROVED_GR_FIXES){
    const actual={speciesIndex:e.speciesIndex,displayCode:e.displayCode,src:new URL(e.thumbnail.src,PUBLIC_BASE).href,natural:[e.thumbnail.width,e.thumbnail.height],complete:true,hidden:false,loading:'lazy',objectFit:'contain',imageRect:{x:20,y:20,width:32,height:32,right:52,bottom:52},rowRect:{x:10,y:10,right:100,bottom:100},viewport:{width,height:844},screenshot:width===360?null:`thumb-${e.speciesIndex}-${width}.png`};
    assertScopedGRThumbnailMeasured(actual,e.speciesIndex);assert.throws(()=>assertThumbnailMeasured(actual,e.speciesIndex),'Old44 cohort remains separate');scopedThumbFixtures.push(actual);
    for(const changed of [{src:'wrong.webp'},{natural:[128,128]},{hidden:true},{complete:false},{loading:'eager'},{objectFit:'cover'},{imageRect:{...actual.imageRect,width:64}},{rowRect:{x:30,y:30,right:40,bottom:40}}])assert.throws(()=>assertScopedGRThumbnailMeasured({...actual,...changed},e.speciesIndex));
  }
  assertScopedGRThumbnailCoverage(scopedThumbFixtures);
  assert.throws(()=>assertScopedGRThumbnailCoverage(scopedThumbFixtures.slice(1)));
  assert.throws(()=>assertScopedGRThumbnailCoverage(scopedThumbFixtures.map((x,i)=>i===0?{...x,screenshot:null}:x)));
  assert.throws(()=>assertScopedGRThumbnailCoverage(scopedThumbFixtures.map((x,i)=>i===8?{...x,screenshot:'unexpected.png'}:x)));
  // Pure geometry fixtures exercise the scoped browser assertions without launching a browser.
  for(const [cw,ch]of [[242,272],[272,272],[272,86.4]]){
    const side=Math.min(cw,ch),dx=-side*122/864,h={x:40,y:20,width:cw+48,height:ch+48,right:40+cw+48,bottom:20+ch+48};
    const e=EXPECTED[40],fixture={...valid,speciesIndex:40,displayCode:e.displayCode,title:e.name,src:new URL(e.src,PUBLIC_BASE).href,natural:[864,864],holderRect:h,
      imageRect:{x:h.x+24+(cw-side)/2+dx,y:h.y+24+(ch-side)/2,width:side,height:side,right:h.x+24+(cw-side)/2+dx+side,bottom:h.y+24+(ch-side)/2+side},
      holderSpeciesId:'species-040',imageTransform:`matrix(1, 0, 0, 1, ${dx}, 0)`,contentSize:[cw,ch],holderStyle:null,placeholderHidden:true,holderHidden:false,holderDisplay:'flex',viewport:{width:500,height:500}};
    assertScopedGRGeometry(fixture,40);
    for(const changed of [{imageTransform:'none'},{imageTransform:'matrix(2, 0, 0, 2, 0, 0)'},{holderSpeciesId:'species-041'},{placeholderHidden:false},{contentSize:[cw*2,ch*2]},{imageRect:{...fixture.imageRect,x:fixture.imageRect.x+10,right:fixture.imageRect.right+10}}])assert.throws(()=>assertScopedGRGeometry({...fixture,...changed},40));
  }
  assert.equal(Object.keys(EXPECTED).length,85);
  assert.deepEqual(APPROVED_GR_FIXES.map(e=>e.speciesIndex).sort((a,b)=>a-b),[38,48,49,52]);
  for(const e of APPROVED_GR_FIXES)assert.equal(EXPECTED[e.speciesIndex].sha256,e.sha256,'Latest approved GR fixes override historical expectations');
  const sourceRegistry = Buffer.from(JSON.stringify(publicHeroes));
  assert.equal(assertRegistry(sourceRegistry,sourceRegistry).entries.length,230);
  assert.throws(()=>assertRegistry(sourceRegistry,Buffer.from('{}')));
  for(const species of [9,10,...APPROVED44_IDS]){const missingBaby=Buffer.from(JSON.stringify({entries:JSON.parse(sourceRegistry).entries.filter(e=>e.speciesIndex!==species)}));assert.throws(()=>assertRegistry(missingBaby,missingBaby));}
  const duplicated=Buffer.from(JSON.stringify({entries:[{speciesIndex:117},{speciesIndex:55},{speciesIndex:117}]}));
  assert.throws(()=>assertRegistry(duplicated,duplicated));
  const missing=Buffer.from(JSON.stringify({entries:[{speciesIndex:55}]}));assert.throws(()=>assertRegistry(missing,missing));
  console.log('DEX_PORTRAIT_SELF_TEST_PASS: sizing, identity, registration, contain, measured geometry and bounded onboarding-race guards; no browser launched.');
}
module.exports = { assertScopedGRThumbnailMeasured,assertScopedGRThumbnailCoverage, SCOPED_GR_ENTRIES,visibleHeroRect,assertScopedGRGeometry,assertScopedGRCoverage, APPROVED44,APPROVED44_IDS,assertApproved44Coverage,assertThumbnailMeasured, EXPECTED, assertRegistry, sizePlan, assertAsset, assertMeasured, mountedSnapshot, checkPolicy, clickOptionalComicControl, selfTestOptionalComicClick };
if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest().catch(error => { console.error(error); process.exitCode = 1; });
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}

