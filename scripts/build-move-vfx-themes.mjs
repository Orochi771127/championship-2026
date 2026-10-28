// Move VFX themes: which effect every species move shows in the Dex preview
// (OWNER_APPROVED_ADAPTATION 2026-10-28, docs/coordination/OWNER_DIRECTION.md
// MOVE_VFX_THEMES_HUNT_ROPE_TACTICS_20261028).
//
// Owner: the Dex 「預覽必殺技」 had collapsed every move into one blue-white
// beam. Restore the original effects first; only where a move names no specific
// effect (or only a beam) derive one from family x attribute x stage, so
// insect/plant partners never fire a laser and machines fire missiles.
//
// Reads only existing data and never changes a move value:
//   - the move records (kind, owner species) and the effect banks they name
//     (battleFxMoveBanks -- the original VFX IDs the battle plays),
//   - the approved five-language move names (battleMoveNames.js),
//   - the species family / attribute / generation (creature-species.r1.json),
//   - the product-authored Data Arena element per species (relay roster).
//
// Priority per move:
//   BANK   a specific original effect bank (rose00 -> vine, missile01 -> missile)
//   NAME   the approved name when the bank is generic (battle / hit marks / none)
//   FAMILY the family x attribute x stage rule when neither says enough, and the
//          two family mandates: insect/plant never beam, machine ranged = ordnance
// Beam stays only on beam banks whose name reads as an energy cannon.
//
// Usage: node scripts/build-move-vfx-themes.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import roster from '../src/data/championship/data-arena-relay-roster.v1.json' with {type: 'json'};
import {BATTLE_MOVE_NAMES} from '../src/championship/text/battleMoveNames.js';
import {battleFxMoveBanks, battleFxMoveTier} from '../src/championship/presentation/battleFx/battleFxRecipes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'src/data/championship/move-vfx-themes.r1.json';

export const MOVE_VFX_STYLES = Object.freeze([
  // melee
  'strike', 'claw', 'slash', 'pierce',
  // insect / plant
  'vine', 'thorn', 'leaf', 'seed', 'spore',
  // machine ordnance
  'missile', 'gatling', 'shell',
  // elements
  'fireball', 'flame', 'water', 'ice', 'thunder', 'quake', 'wind', 'holy', 'dark', 'sound',
  // true energy cannon
  'beam'
]);
const MELEE = new Set(['strike', 'claw', 'slash', 'pierce']);
const PLANT = new Set(['vine', 'thorn', 'leaf', 'seed', 'spore']);
const ORDNANCE = new Set(['missile', 'gatling', 'shell']);
const FAMILY = ['none', 'beast', 'machine', 'plant', 'bird', 'dragon', 'aquatic', 'holy', 'dark'];

// Original effect-bank family -> [style, element]. First match wins.
const BANK_RULES = [
  [/^H_claw$/, 'claw'], [/^H_Slashtop$|^sword|oukuwamon|brakedramon|^crescemon$/, 'slash'],
  [/^H_piercing$|^spear|trident|tyusyaki|^tuno|pointer/, 'pierce'], [/^H_Knuckle$|clockmonclock|flamefist/, 'strike'],
  [/^rose/, 'vine', 'nature'], [/^seed|banana/, 'seed', 'nature'], [/^kinoko/, 'spore', 'toxic'],
  [/^unchi|dirtysaucer/, 'spore', 'toxic'], [/^toge/, 'thorn', 'nature'],
  [/missile|risingdestroyer|gigadestroyer|rocketpunch|pinochimonarrow/, 'missile', 'metal'],
  [/kikanzyu|syuriken|hasyuriken|cogwheel/, 'gatling', 'metal'],
  [/bitbomb|cherrybomb|smileybomb|bigsmileybomber|toyfire|explo/, 'shell', 'fire'],
  [/^beam|fraucanon|soloblue|gigaburasuta/, 'beam'],
  [/koenryu|firehurricane|fireball_w|firewing/, 'flame', 'fire'],
  [/fire|magma|foxfire|kyubimon|leomonhed|sun00/, 'fireball', 'fire'],
  [/walaser|tsunami|water|bubble|fish|sumiburesu|casuburesu/, 'water', 'water'],
  [/ice|snow|koori|yukigumo/, 'ice', 'ice'],
  [/thunder|raiun|myorunirusanda|hammerspark|colorfulspark/, 'thunder', 'thunder'],
  [/rock|jiware|groundzero|bone|haguro/, 'quake', 'earth'],
  [/tatumaki|airneedle|jetarrow|kumo/, 'wind', 'wind'],
  [/holy|heaven|star|moon|crescent|lightball|apollomon|dianamon|lekismon|infiniti|delumonegg/, 'holy', 'light'],
  [/dark|death|bakemon|curse|genocide|purple|abduction|hartbreak|blacksmoke/, 'dark', 'dark'],
  [/onpu|hart|catseye|mind_eff|crashsymphony|smiley|kiwimonsmall|ropear/, 'sound', 'psychic']
];

// Approved zh-Hant name -> element accent and ranged style. First match wins.
const NAME_ELEMENT = [
  [/雷|電|霆/, 'thunder'], [/焰|炎|火|焚|燭|熾|灼|熔|燼/, 'fire'], [/冰|霜|雪|凍/, 'ice'],
  [/毒|瘴|腐|泥|沼|孢|菇/, 'toxic'], [/水|潮|泡|浪|海|鯨|鰭|淵/, 'water'],
  [/藤|蔓|棘|荊|葉|花|瓣|蕾|薔薇|種|芽|苔|森|樹|根|竹/, 'nature'], [/岩|石|地|崩|礫|骨|山|晶/, 'earth'],
  [/風|旋|颶|羽|翼|隼/, 'wind'], [/闇|暗|影|冥|夜|幽|魔|邪|死|獄|鬼|黑/, 'dark'],
  [/光|聖|曜|星|輝|暉|陽|日|煌|天|神|月/, 'light'], [/音|奏|歌|鈴|心|幻|夢/, 'psychic'],
  [/鋼|鐵|機|齒|甲|裝/, 'metal']
];
const NAME_RANGED = [
  // A kind-1 charge is a body move, not a shot.
  [/猛衝|旋衝|突進|翻滾|滾衝|怒衝|俯衝|衝撞/, 'strike'],
  [/飛彈|彈雨|全彈|導彈|火箭|釘雨/, 'missile'], [/連射|機砲|連發|連珠/, 'gatling'],
  [/榴彈|爆彈|核爆|炸|砲擊|爆擊/, 'shell'],
  [/藤|蔓|纏|根/, 'vine'], [/棘|荊/, 'thorn'], [/孢|瘴|毒|腐|泥|沼|菇|霧/, 'spore'],
  [/葉|花|瓣|蕾|薔薇|英|竹/, 'leaf'], [/種|芽/, 'seed'],
  [/雷|電|霆/, 'thunder'], [/冰|霜|雪|凍/, 'ice'], [/水|潮|泡|浪|海/, 'water'],
  [/焰流|炎流|焰息|噴焰|焚/, 'flame'], [/焰|炎|火|燭|熾/, 'fireball'],
  [/岩|石|地|崩|礫|骨|晶/, 'quake'], [/風|旋|颶|羽/, 'wind'],
  [/闇|暗|影|冥|夜|幽|魔|邪|死|獄|黑/, 'dark'], [/光|聖|曜|星|輝|暉|陽|日|煌|天|神|月/, 'holy'],
  [/音|奏|歌|鈴|心|幻/, 'sound']
];
const NAME_MELEE = [[/斬|刃|剪|鋏|鐮|劍|刀|鉗/, 'slash'], [/爪|掠|抓/, 'claw'], [/貫|刺|槍|針|矛|突|角|牙|咬|啄|夾/, 'pierce']];
// A beam bank stays a beam only when the name reads as an energy cannon.
const TRUE_BEAM = /光砲|光束|波動|雷射|粒子|閃光|天穹砲|裂光|聖槍砲|光|砲/;
const FIRE_CANNON = /焰|炎|火|焚/;

const first = (rules, text) => rules.find(([rule]) => rule.test(text)) ?? null;
const familyOf = record => record?.familyBits ? FAMILY[32 - Math.clz32((record.familyBits & -record.familyBits) >>> 0)] ?? 'none' : 'none';
const ROSTER_ELEMENT = {fire: 'fire', frost: 'ice', light: 'light', water: 'water', earth: 'earth', storm: 'thunder', nature: 'nature', shadow: 'dark', physical: 'neutral'};
// Attribute accent for a move that names no element: vaccine light, virus dark, data cyan, free wind.
const ATTRIBUTE_ELEMENT = ['neutral', 'light', 'dark', 'neutral', 'wind'];

function stageTier(generation) { return generation <= 2 ? 1 : generation === 3 ? 2 : generation === 4 ? 3 : 4; }

function plantRanged(name, attribute, element) {
  const named = first(NAME_RANGED, name)?.[1];
  if (named && PLANT.has(named)) return named;
  if (element === 'toxic' || attribute === 2) return 'spore';
  if (element === 'thunder' || element === 'fire' || element === 'light') return 'seed';
  return attribute === 1 ? 'leaf' : attribute === 3 ? 'seed' : 'leaf';
}
function machineRanged(name, generation) {
  const named = first(NAME_RANGED, name)?.[1];
  if (named && ORDNANCE.has(named)) return named;
  if (/核|砲|爆|滅|轟/.test(name)) return 'shell';
  return generation <= 3 ? 'gatling' : 'missile';
}

export function classifyMove(move, speciesRecord, rosterEntry, speciesMoves) {
  const name = BATTLE_MOVE_NAMES[move.recordIndex]?.[0] ?? '';
  const family = familyOf(speciesRecord);
  const attribute = speciesRecord?.attributeIndex ?? 0;
  const generation = speciesRecord?.generationIndex ?? 1;
  const banks = battleFxMoveBanks(move).filter(b => ['launch', 'body', 'hit'].includes(b.role));
  const specific = banks.map(b => b.family).filter(f => f && f !== 'battle' && f !== 'etc_hiteffect');
  const bankRule = specific.map(f => BANK_RULES.find(([rule]) => rule.test(f))).find(Boolean) ?? null;
  const nameElement = first(NAME_ELEMENT, name)?.[1] ?? null;
  const fallbackElement = ROSTER_ELEMENT[rosterEntry?.element] ?? ATTRIBUTE_ELEMENT[attribute] ?? 'neutral';
  // The original bank's colour wins; a hit mark (no colour) takes the name's.
  let style = bankRule?.[1] ?? null, element = bankRule?.[2] ?? nameElement ?? null, source = bankRule ? 'BANK' : null;
  const bankStyle = style;

  if (move.kind === 0 || (style && MELEE.has(style))) {
    // Melee: the original hit mark when named, else the approved name, else a body strike.
    if (!style || !MELEE.has(style)) { style = first(NAME_MELEE, name)?.[1] ?? 'strike'; source = 'NAME'; }
    if (family === 'plant' && !/剪|鋏|夾|鍬|斬|鐮/.test(name)) {
      style = /刺|針|角|貫|牙|棘/.test(name) ? 'thorn' : 'vine'; source = 'FAMILY';
    } else if (family === 'machine' && move.kind === 0) {
      element = element ?? 'metal';
    }
  } else {
    if (!style) {
      style = first(NAME_RANGED, name)?.[1] ?? null;
      source = style ? 'NAME' : null;
    }
    if (style === 'beam' && !(TRUE_BEAM.test(name) && !FIRE_CANNON.test(name))) {
      style = FIRE_CANNON.test(name) ? 'flame' : first(NAME_RANGED, name)?.[1] ?? 'holy';
      if (style === 'beam') style = 'holy';
      source = 'NAME';
    }
    if (family === 'plant' && !PLANT.has(style)) {
      style = plantRanged(name, attribute, element); source = 'FAMILY';
      element = nameElement ?? (element === 'dark' ? 'nature' : element);
    } else if (family === 'machine' && (!style || bankStyle === 'beam' || style === 'holy' && source !== 'BANK')) {
      // A machine's energy cannon becomes ordnance: missiles, shells, a gatling.
      style = machineRanged(name, generation); source = 'FAMILY';
      if (style !== 'shell' || !element || element === 'neutral') element = element === 'fire' ? 'fire' : 'metal';
    }
    if (!style) {
      style = ({fire: 'fireball', water: 'water', ice: 'ice', thunder: 'thunder', earth: 'quake', wind: 'wind', dark: 'dark', light: 'holy', psychic: 'sound', toxic: 'spore', nature: 'leaf', metal: 'gatling'})[element ?? fallbackElement] ?? 'holy';
      source = 'FAMILY';
    }
  }
  if (!element) {
    element = ({vine: 'nature', thorn: 'nature', leaf: 'nature', seed: 'nature', spore: 'toxic', missile: 'metal', gatling: 'metal', shell: 'fire',
      fireball: 'fire', flame: 'fire', water: 'water', ice: 'ice', thunder: 'thunder', quake: 'earth', wind: 'wind', holy: 'light', dark: 'dark', sound: 'psychic'})[style]
      ?? fallbackElement;
  }
  if (PLANT.has(style) && element === 'neutral') element = 'nature';
  const tier = Math.min(4, stageTier(generation) + (battleFxMoveTier(move, speciesMoves) === 'ultimate' ? 1 : 0));
  const named = NAME_OVERRIDES[move.recordIndex];
  if (named) return {style: named[0], element: named[1], tier, source: 'NAME'};
  return {style, element, tier, source};
}

// Owner 2026-10-28 (ARENA_RELAY_KITS_20261028): 「那些衝突的顏色可以另外做一個符合的
// 效果」. Where the approved name names the substance and the original bank's
// colour contradicts it, the name wins (雪晶吐息 is an ice breath, not fire).
// Names whose element word only modifies another noun keep the bank (淵棘掠爪,
// 棘龍海嘯, 冥骨旋輪, 裂潮雙月刃, 墓焰崩地).
const NAME_OVERRIDES = Object.freeze({
  122: ['sound', 'light'],   // 聖鈴清音  holy bell chime
  128: ['ice', 'ice'],       // 雪晶吐息  snow-crystal breath
  140: ['flame', 'fire'],    // 灰燼焚霧  burning ash mist
  144: ['flame', 'fire'],    // 幻紋焰流  flame stream
  240: ['thorn', 'earth'],   // 背岩投射  thrown back-rocks
  291: ['holy', 'water'],    // 月影水箭  water arrow
  317: ['thunder', 'thunder'], // 曜脈雷霆爪 thunder claw
  350: ['flame', 'dark'],    // 墓焰黑霧  grave flame, black mist
  408: ['spore', 'ice'],     // 霜牙寒霧  frost mist
  441: ['flame', 'dark'],    // 夜詠黑焰  black flame
  475: ['flame', 'dark'],    // 蒼焰鬼火陣 ghost-fire ring
  530: ['dark', 'dark'],     // 闇鎧墨核  dark ink core
  534: ['flame', 'dark'],    // 星冠紫焰  purple flame
  558: ['beam', 'ice'],      // 零度射線  zero-degree ray
  585: ['holy', 'fire'],     // 日輪焰矢  flame arrow
  588: ['holy', 'water']     // 夜月水矢  water arrow
});

// The relay kit builder passes its re-derived roster so both files agree.
export function buildMoveVfxThemes(rosterEntries = roster.entries) {
  const speciesByIndex = new Map(species.records.map(r => [r.recordIndex, r]));
  const rosterByIndex = new Map(rosterEntries.map(r => [r.speciesIndex, r]));
  const bySpecies = new Map();
  for (const move of moves.records) {
    if (!bySpecies.has(move.speciesId)) bySpecies.set(move.speciesId, []);
    bySpecies.get(move.speciesId).push(move);
  }
  // Rows, not a keyed object: the public build allowlists every JSON key.
  const rows = [];
  for (const move of moves.records) {
    if (move.recordIndex <= 30 || ![0, 1].includes(move.kind)) continue;
    const theme = classifyMove(move, speciesByIndex.get(move.speciesId), rosterByIndex.get(move.speciesId), bySpecies.get(move.speciesId));
    rows.push([move.recordIndex, theme.style, theme.element, theme.tier, theme.source]);
  }
  return {
    schemaVersion: 1,
    kind: 'MOVE_VFX_THEMES',
    authority: 'OWNER_APPROVED_ADAPTATION_20261028',
    generator: 'scripts/build-move-vfx-themes.mjs',
    note: 'Presentation only: a theme never changes a move value. Row = [move record, style, element palette, intensity tier 1..4, source BANK|NAME|FAMILY].',
    styles: MOVE_VFX_STYLES,
    moves: rows
  };
}

export function serializeMoveVfxThemes(table) {
  const head = JSON.stringify({...table, moves: undefined}, null, 2).replace(/\n}$/, '');
  const rows = table.moves.map(row => `    ${JSON.stringify(row)}`).join(',\n');
  return `${head},\n  "moves": [\n${rows}\n  ]\n}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = serializeMoveVfxThemes(buildMoveVfxThemes());
  const target = path.join(root, OUT);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current !== text) { console.error(`MOVE_VFX_THEMES_STALE: run node scripts/build-move-vfx-themes.mjs`); process.exit(1); }
    console.log(`${OUT} is current`);
  } else {
    fs.writeFileSync(target, text);
    console.log(`wrote ${OUT}`);
  }
}
