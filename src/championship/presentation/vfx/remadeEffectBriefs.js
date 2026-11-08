// Written briefs for remade effect cells (UNIQUE_PIXEL_MOVE_VFX_20261108,
// Owner: 「表現方式也要一樣…每一招都要照著作為參考」).
//
// One entry per original effect family, written by watching each family's
// sequences side by side with its remake (remade-effect-cells-review.html):
// what the thing is, its colour family and how it changes across a sequence.
// It is drawn with the kit's own shapes (moveVfxKitTextures.js) in this
// project's own colours: no original pixel or palette value is read.
//
// A family lists its native sequences in order. A sequence is either words --
//   "sheet [grow from to] [fade alpha] [scale k] [palette key] [light]"
// -- or {sheet, palette, grow, fade, scale, light, frames: [per frame
// {sheet?, palette?, box?, t?, scale?, alpha?, layers?}]}. Boxes are [x, y,
// width, height] in native pixels from the cell's origin. A missing sequence
// takes the default look for its form and stage (remadeEffectCells.js).

/** This project's colours for briefs, beside BATTLE_FX_PALETTES. */
export const BRIEF_PALETTES = Object.freeze({
  VIOLET: Object.freeze({core: 0xf6e6ff, main: 0x9b52d6, edge: 0x3c1660, smoke: 0xa77ad0}),
  PURPLEFLAME: Object.freeze({core: 0xf8e0ff, main: 0xb040f0, edge: 0x4a0a80, smoke: 0x7a4aa0}),
  GREY: Object.freeze({core: 0xe2e2ea, main: 0x8c8c98, edge: 0x3a3a44, smoke: 0x80808c}),
  INK: Object.freeze({core: 0xa0a0b0, main: 0x4c4c5c, edge: 0x15151e, smoke: 0x3a3a46}),
  WHITE: Object.freeze({core: 0xffffff, main: 0xe6eef8, edge: 0x8a9ab0, smoke: 0xe8eef6}),
  CREAM: Object.freeze({core: 0xffffff, main: 0xf0e4c4, edge: 0x8a7a56, smoke: 0xd8ccb0}),
  OLIVE: Object.freeze({core: 0xf4f0a8, main: 0xb4aa40, edge: 0x5a5418, smoke: 0xa49c4c}),
  LILAC: Object.freeze({core: 0xf4eeff, main: 0xb8a8d8, edge: 0x5a4a7a, smoke: 0xa898c8}),
  RED: Object.freeze({core: 0xffe0e0, main: 0xe63446, edge: 0x6a1020, smoke: 0xc06070}),
  GOLD: Object.freeze({core: 0xfffbe0, main: 0xffd23c, edge: 0xb06e10, smoke: 0xe8c870}),
  STEEL: Object.freeze({core: 0xffffff, main: 0xc6cfdb, edge: 0x48505e, smoke: 0x8c8c8c}),
  BONE: Object.freeze({core: 0xffffff, main: 0xece4cc, edge: 0x8a8068, smoke: 0x9a9480}),
  BANANA: Object.freeze({core: 0xfff3a0, main: 0xf2cf3a, edge: 0x8a6a10, smoke: 0x9a8a50}),
  WOOD: Object.freeze({core: 0xe8c890, main: 0x9a6a38, edge: 0x4a2e14, smoke: 0x7a5a3a}),
  TEAL: Object.freeze({core: 0xeafff8, main: 0x6ae0c8, edge: 0x1a8a80, smoke: 0xa0e0d0}),
  BOLTBLUE: Object.freeze({core: 0xffffff, main: 0x8c9cff, edge: 0x3436a6, smoke: 0x7a80c8}),
  BLUEFIRE: Object.freeze({core: 0xe8fbff, main: 0x4ab0ff, edge: 0x1840c0, smoke: 0x8ab8e8}),
  GREENFIRE: Object.freeze({core: 0xf0ffd0, main: 0x5ad040, edge: 0x1a7a28, smoke: 0x70a060}),
  FISH: Object.freeze({core: 0xeef8ff, main: 0x7aa8d4, edge: 0x2a4a7a, smoke: 0x9ab8d8}),
  GATE: Object.freeze({core: 0xfff8ff, main: 0xf2c8ea, edge: 0xa874b0, smoke: 0xe8d0e8}),
  // An explosion's own fire: a white-yellow heart, golden flame, a hot red rim.
  BLAST: Object.freeze({core: 0xfffde8, main: 0xffb81c, edge: 0xd8280c, smoke: 0x5a3a2a})
});

// Shared lines.
const BANG = '- drawn bigblast_0,bigblast_1,bigblast_2,bigblast_3,bigblast_4,bigblast_5 palette BLAST';
const BOLT = c => `- drawn bolt_0,bolt_1,bolt_2 palette ${c}`;
const RAYS = c => `- drawn rays_0,rays_1,rays_2 palette ${c}`;
const SPARK = c => `flare light scale 0.55 palette ${c}`;
const SMOKE = c => [`- drawn puff_0,puff_1 palette ${c}`, `- drawn puff_1,puff_2 palette ${c}`, `- drawn puff_2,puff_3 fade 0.4 palette ${c}`];
const BEAM = c => [`beam light palette ${c}`, `glow light palette ${c}`, `beam light palette ${c}`, `orb palette ${c}`];
const SPLASH = c => `- drawn splash_0,splash_1,splash_2 palette ${c}`;
const BALL = c => [`drop grow 0.4 1 palette ${c}`, `drop palette ${c}`, SPLASH(c)];

export const REMADE_EFFECT_BRIEFS = Object.freeze({
  // 孢子彈: a glowing spore is thrown, a mushroom pops out of the ground --
  // squashed flat, stretched tall, then standing -- and bursts into a cloud of spores.
  kinoko00: {palette: 'VIOLET', sequences: [
    {drawn: ['spore_0', 'spore_1']},
    {drawn: ['mushroom_flat', 'mushroom_tall', 'mushroom'], anchor: 'bottom', at: [0, 1]},
    {drawn: ['puff_1', 'puff_2', 'puff_3'], at: [0, -2]}
  ]},
  battle_popup: {sequences: ['- drawn puff_0,puff_1,puff_2,puff_3 palette WHITE']},
  specialtime: {sequences: ['beam light palette ice', 'beam light palette ice', 'beam light fade 0.3 palette ice']},
  banana00: {sequences: ['banana palette BANANA', '- drawn puff_0,puff_1,puff_2,puff_3 palette CREAM']},
  // A shoal of little fish leaps out of a splash and arcs over, tails flapping.
  fish00: {palette: 'FISH', sequences: [
    {frames: [{drawn: 'splash_0', palette: 'water'},
      {layers: [{drawn: 'splash_1', palette: 'water'}, {drawn: 'fish_0', at: [-1, -5]}]},
      {layers: [{drawn: 'splash_1', palette: 'water'}, {drawn: 'fish_1', at: [2, -8]}, {drawn: 'fish_0', at: [-4, -4]}]},
      {layers: [{drawn: 'splash_2', palette: 'water'}, {drawn: 'fish_0', at: [4, -9]}, {drawn: 'fish_1', at: [-3, -7]}, {drawn: 'fish_0', at: [0, -2]}]}]},
    {frames: [{layers: [{drawn: 'fish_0', at: [-6, 0]}, {drawn: 'fish_1', at: [0, -5]}, {drawn: 'fish_0', at: [6, -1]}]},
      {layers: [{drawn: 'fish_1', at: [-5, -4]}, {drawn: 'fish_0', at: [1, -1]}, {drawn: 'fish_1', at: [6, -5]}]}]},
    SPLASH('water')]},
  cogwheel00: {sequences: ['- drawn gear palette GOLD', '- drawn gear palette GOLD', '- drawn bigblast_4,bigblast_5 palette GOLD']},
  airneedle00: {sequences: ['crescent grow 0.4 1 palette wind', 'streak light palette wind', 'ring light grow 0.6 1.2 fade 0.2 palette wind']},
  hasyuriken00: {sequences: ['leaf palette nature', 'leaf palette nature']},
  missile00: {sequences: ['- drawn missile palette fire', '- drawn missile palette fire', BANG]},
  pointer00: {sequences: ['arrow scale 0.6 palette STEEL', 'arrow palette STEEL', RAYS('light')]},
  raiun00: {sequences: ['mist grow 0.9 1 palette GREY', BOLT('thunder'), 'mist grow 1 1.2 fade 0.2 palette GREY']},
  syuriken00: {sequences: ['shuriken palette STEEL', 'shuriken palette STEEL']},
  tuno00: {sequences: [SPARK('fire'), 'drill palette PURPLEFLAME', BANG]},
  tyusyaki00: {sequences: ['- drawn puff_0,puff_1 palette WHITE', 'syringe palette STEEL', {sheet: 'syringe', palette: 'STEEL', frames: [{}, {}, {}, {}, {},
    {sheet: 'mist', palette: 'WHITE'}, {sheet: 'mist', palette: 'WHITE', alpha: 0.65}, {sheet: 'mist', palette: 'WHITE', alpha: 0.35}]}]},
  waterball00: {sequences: BALL('water')},
  toyfire00: {sequences: [SPARK('fire'), 'comet palette fire', BANG]},
  bubble01: {sequences: ['bubble grow 0.4 0.8 palette water', 'bubble palette water', SPLASH('water')]},
  fireball_w00: {sequences: [SPARK('water'), 'comet palette BLUEFIRE', '- drawn bigblast_0,bigblast_1,bigblast_2,bigblast_3,bigblast_4,bigblast_5 palette BLUEFIRE']},
  hart00: {sequences: ['heart grow 0.3 0.6 palette RED', '- drawn heart palette RED', 'ring light grow 0.5 1.2 fade 0.2 palette RED']},
  rocketpunch00: {sequences: ['- drawn puff_0,puff_1 fade 0.4 palette GREY', '- drawn rocketfist palette fire', BANG]},
  catseye00: {sequences: [null, '- drawn eye palette GOLD']},
  koenryu00: {sequences: [BOLT('BOLTBLUE') + ' zoom 2', BOLT('BOLTBLUE') + ' zoom 2', BANG]},
  sumiburesu00: {sequences: BALL('INK')},
  bone00: {sequences: [null, '- drawn bone palette BONE', '- drawn bigblast_5 palette BONE']},
  deathcharm00: {sequences: [SPARK('dark'), '- drawn ghost palette PURPLEFLAME', '- drawn ghost fade 0.2 palette PURPLEFLAME']},
  firewing00: {sequences: [SPARK('fire'), 'comet palette fire', 'flare light palette fire']},
  holyarrow: {sequences: ['arrow palette GOLD', 'arrow palette GOLD', RAYS('thunder')]},
  icearrow00: {sequences: ['arrow palette ice', 'arrow palette ice', 'shard grow 0.8 1.2 fade 0.2 palette ice']},
  koorituno00: {sequences: [null, 'drill palette ice', 'burst grow 0.8 1.25 fade 0.2 palette ice']},
  magmaball00: {sequences: [SPARK('fire'), 'comet palette fire', BANG]},
  star00: {sequences: ['star grow 0.3 0.6 palette GOLD', 'star palette GOLD', 'flare light palette light']},
  firehurricane00: {sequences: [SPARK('fire'), 'comet palette fire', BANG]},
  dirtysaucer00: {sequences: ['- drawn bomb palette OLIVE', '- drawn bomb palette OLIVE', RAYS('thunder')]},
  crescent00: {sequences: [SPARK('light'), 'crescent palette GOLD', 'flare light grow 0.8 1.3 fade 0.2 palette light']},
  cherrybomb00: {sequences: ['flare light scale 0.4 palette fire', '- drawn cherry palette RED', BANG]},
  groundzero00: {sequences: ['arrow palette RED', 'arrow palette RED', BANG]},
  trident00: {sequences: ['arrow palette STEEL', 'arrow palette STEEL', RAYS('thunder')]},
  spear00: {sequences: ['arrow palette STEEL', 'arrow palette STEEL', RAYS('thunder')]},
  bigsmileybomber00: {sequences: ['- drawn bomb palette RED', '- drawn bomb palette INK', BANG]},
  bitbomb00: {sequences: [SPARK('fire'), '- drawn bomb palette INK', BANG]},
  jetarrow00: {sequences: ['beam light palette water', 'beam light palette water', SPLASH('water')]},
  blacksmoke00: {sequences: SMOKE('GREY')},
  blacksmoke01: {sequences: SMOKE('OLIVE')},
  blacksmoke02: {sequences: SMOKE('fire')},
  blacksmoke03: {sequences: SMOKE('nature')},
  blacksmoke05: {sequences: SMOKE('ice')},
  darknesswave00: {sequences: SMOKE('INK')},
  casuburesu00: {sequences: SMOKE('PURPLEFLAME')},
  colorfulspark00: {sequences: [SPARK('psychic'), BOLT('psychic'), BOLT('thunder')]},
  fraucanon00: {sequences: ['flare light scale 0.4 palette nature', 'beam light palette nature', BANG]},
  heavensgate00: {sequences: ['- drawn arch zoom 2 palette GATE', 'beam light palette wind', 'beam light palette wind', 'orb palette wind', '- drawn arch zoom 2 palette GATE', '- drawn arch zoom 2 fade 0.2 palette GATE']},
  genocideattack00: {sequences: ['- drawn missile_dart palette PURPLEFLAME', '- drawn missile_dart palette PURPLEFLAME', BANG]},
  smileybomb00: {sequences: ['- drawn bomb palette RED', '- drawn bomb palette RED', BANG]},
  thunderjavelin00: {sequences: ['orb grow 0.5 1 palette thunder', BOLT('thunder'), RAYS('ice')]},
  lightball01: {sequences: ['orb grow 0.3 1 palette thunder', 'orb palette thunder', 'comet palette thunder']},
  gigadestroyer00: {sequences: ['- drawn missile_dart palette INK', '- drawn missile_dart palette INK', BANG]},
  haguro00: {sequences: ['slash palette INK', 'slash palette INK', 'slash fade 0.2 palette INK']},
  infinitiarrow00: {sequences: ['flare light palette fire', 'arrow palette fire', RAYS('thunder')]},
  rose00: {sequences: ['rose palette RED', 'petal palette RED', 'flare light palette RED']},
  apollomonarrow00: {sequences: [null, 'comet palette light']},
  crescemonarrow00: {sequences: [null, 'arrow palette GOLD']},
  crescemonarrow01: {sequences: [null, 'arrow palette INK']},
  delumonegg00: {sequences: [null, 'egg palette CREAM']},
  dianamonarrow00: {sequences: [null, 'arrow palette ice']},
  lekismonarrow00: {sequences: [null, 'arrow palette light']},
  pinochimonarrow00: {sequences: [null, 'arrow palette WOOD']},
  icerock00: {sequences: ['rock palette ice', 'rock palette ice', 'shard grow 0.8 1.2 fade 0.2 palette ice']},
  flamefist00: {sequences: ['comet palette fire', 'flare light palette fire']},
  magmaball02: {sequences: [null, 'comet palette fire']},
  purple00: {sequences: ['rose palette PURPLEFLAME', 'petal palette PURPLEFLAME', 'flare light palette dark']},
  sword00: {sequences: ['slash palette STEEL', 'shard palette STEEL']},
  tatumaki01: {sequences: ['streak light palette ice', 'funnel palette ice', 'streak light fade 0.2 palette ice']},
  ropear01: {sequences: ['streak light palette ice', 'funnel palette ice', 'streak light fade 0.2 palette ice']},
  crashsymphony00: {sequences: [SPARK('light'), 'ring light palette GOLD', 'ring light grow 1 1.3 fade 0.2 palette GOLD']},
  hartbreak00: {sequences: ['heart grow 0.3 0.6 palette INK', '- drawn heart palette INK', 'ring light grow 0.5 1.2 fade 0.2 palette INK']},
  heaven00: {sequences: ['beam light palette wind', 'beam light palette wind', 'beam light palette wind', 'orb palette wind']},
  myorunirusanda00: {sequences: ['orb grow 0.5 1 palette TEAL', BOLT('TEAL'), RAYS('thunder')]},
  soloblue00: {sequences: ['flare light scale 0.4 palette wind', 'ring light palette TEAL', 'ring light grow 1 1.3 fade 0.2 palette TEAL']},
  walaser01: {sequences: ['flare light scale 0.4 palette neutral', 'ring light palette GREY', 'ring light grow 1 1.3 fade 0.2 palette GREY']},
  magmaball03: {sequences: [SPARK('water'), 'comet palette BLUEFIRE', '- drawn bigblast_0,bigblast_1,bigblast_2,bigblast_3,bigblast_4,bigblast_5 palette BLUEFIRE']},
  magmaball04: {sequences: [SPARK('nature'), 'comet palette GREENFIRE', '- drawn bigblast_0,bigblast_1,bigblast_2,bigblast_3,bigblast_4,bigblast_5 palette GREENFIRE']},
  magmaball06: {sequences: [SPARK('fire'), 'comet palette fire', BANG]},
  foxfire00: {sequences: ['orb palette BLUEFIRE', 'comet palette BLUEFIRE', '- drawn bigblast_0,bigblast_1,bigblast_2,bigblast_3,bigblast_4,bigblast_5 palette BLUEFIRE']},
  kiwimonsmall00: {sequences: [null, 'feather palette WOOD']},
  waterball01: {sequences: BALL('water')},
  firewing01: {sequences: [SPARK('dark'), 'comet palette PURPLEFLAME', 'flare light palette fire']},
  firewing02: {sequences: [SPARK('neutral'), 'comet palette INK', 'flare light palette fire']},
  gigaburasuta: {sequences: ['burst grow 0.9 1.1 palette light', 'burst grow 0.9 1.1 palette light', 'burst grow 0.9 1.1 fade 0.4 palette light']},
  clockmonclock: {sequences: [null, '- drawn clock palette GOLD']},
  bakemoncurse00: {sequences: [null, 'flame palette PURPLEFLAME']},
  kyubimonfire: {sequences: ['flame grow 0.4 1 palette fire', 'comet palette fire', BANG]},
  sun00: {sequences: ['orb grow 0.9 1 fade 0.3 palette fire']},
  moon00: {sequences: ['orb grow 0.9 1 fade 0.3 palette GOLD']},
  abduction00: {sequences: ['orb grow 0.5 1 palette psychic', BOLT('psychic'), RAYS('thunder')]},
  beam02: {sequences: BEAM('thunder')},
  beam03: {sequences: BEAM('RED')},
  beam05: {sequences: BEAM('TEAL')},
  beam06: {sequences: BEAM('water')},
  beam07: {sequences: [...BEAM('fire'), 'flame grow 0.4 1 palette fire', 'flame palette fire', 'flame grow 1 0.5 fade 0.2 palette fire']},
  beam08: {sequences: [...BEAM('BLUEFIRE'), 'flame grow 0.4 1 palette BLUEFIRE', 'flame palette BLUEFIRE', 'flame grow 1 0.5 fade 0.2 palette BLUEFIRE']},
  hammerspark: {sequences: [BOLT('thunder'), 'ring light palette thunder', 'streak light palette thunder']},
  kumo00: {sequences: ['mist grow 0.9 1.05 palette INK', 'mist grow 1 1.1 fade 0.2 palette INK']},
  kumo01: {sequences: ['mist grow 0.9 1.05 palette OLIVE', 'mist grow 1 1.1 fade 0.2 palette OLIVE']},
  missile02: {sequences: ['- drawn missile_finned palette water', '- drawn missile_finned palette water', BANG]},
  missile04: {sequences: ['- drawn puff_0,puff_1 fade 0.4 palette CREAM', '- drawn missile_fat zoom 2 palette fire', BANG]},
  giantmissile00: {sequences: ['- drawn missile_big palette GREENFIRE', '- drawn puff_1,puff_2,puff_3 palette GREY', BANG]},
  yukigumo00: {sequences: ['mist grow 0.4 0.8 palette LILAC', 'mist grow 0.9 1.05 palette LILAC', 'shard palette ice']},
  snowstorm: {sequences: [null, 'snowflake palette ice']},
  spiralbone00: {sequences: ['- drawn bone palette BONE', BOLT('thunder')]},
  starlight00: {sequences: ['star scale 0.5 palette GOLD', 'star scale 0.5 fade 0.3 palette GOLD']},
  jiware: {sequences: ['crack grow 0.4 1 palette earth']},
  star01: {sequences: [null, 'star palette fire', BANG]},
  koenryu01: {sequences: [BOLT('fire') + ' zoom 2', BOLT('fire') + ' zoom 2', BANG]}
});
