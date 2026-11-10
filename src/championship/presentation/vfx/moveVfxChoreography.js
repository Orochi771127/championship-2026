// Per-move choreography (BESPOKE_MOVE_VFX_PROGRAM_20261111).
//
// Owner 2026-11-11: 「依照我的招式…把每個特效都做出專屬那個招式的特效的動畫，有打擊感，
// 然後要商業遊戲的水準」, then 「就是都交給你自己去處理自己去分批我不介入」.
//
// One entry per move, written by reading the move's approved name and its data
// (kind, power, target): what the caster does as it lets go (`release`), what
// lands on the target (`contact`) and how hard the blow feels. Each set piece
// is a bespoke pixel drawing animated by moveVfxSetPieces.js in the move's own
// palette. The native effect pool still plays the move's own cells where and
// when it did (UNIQUE_PIXEL_MOVE_VFX_20261108); this only adds the move's own
// moment on top. Presentation only: no rule, timing, damage or RNG changes.
//
// Fields (all optional):
//   release: {piece, scale}        a piece at the caster's muzzle as the move goes
//   contact: {piece, scale, count} a piece at the contact point as it lands
//   hitStopMs                      the drawing hold on a landed hit (overrides the tier's)
//   shake: 'light'|'medium'|'heavy' camera jolt on contact (overrides the tier's)
//   knockPx                        how far the struck body slides (juicy)
//
// Batches are listed by record; the comment names the move.

const entry = value => Object.freeze({...value, release: value.release ? Object.freeze(value.release) : null,
  contact: value.contact ? Object.freeze(value.contact) : null});

export const MOVE_VFX_CHOREOGRAPHY = Object.freeze({
  // ---- Batch 1: 角暴龍 (species 87), 熔岩龍 (96), 黑暴龍 (101) -- the Owner's main team.
  // 裂顎咬: a burning bite -- the flame jaws snap shut on the target.
  193: entry({contact: {piece: 'jaws', scale: 0.9}, hitStopMs: 50, shake: 'light', knockPx: 16}),
  // 熔核彈: two molten cores lobbed in a wave; each cracks open where it lands.
  194: entry({release: {piece: 'muzzle', scale: 0.7}, contact: {piece: 'core', scale: 1}, hitStopMs: 55, shake: 'medium', knockPx: 20}),
  // 裂顎貫角: the signature -- jaws clamp, then the horn drives through.
  195: entry({contact: {piece: 'jaws-horn', scale: 1.2}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 暴牙咬: a savage bite -- bigger fangs, a quicker snap.
  213: entry({contact: {piece: 'jaws', scale: 1.05, fast: true}, hitStopMs: 55, shake: 'light', knockPx: 18}),
  // 地炎熔岩彈: a lava bomb arcing from the ground; a larger core bursts.
  214: entry({release: {piece: 'muzzle', scale: 0.8}, contact: {piece: 'core', scale: 1.25}, hitStopMs: 60, shake: 'medium', knockPx: 22}),
  // 焚天炎砲: the signature cannon -- three rings spin out of the muzzle; five cores spiral in.
  215: entry({release: {piece: 'muzzle-spiral', scale: 1.1}, contact: {piece: 'core', scale: 1.1}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 地炎角刺: the horn thrusts through, leaving a burning streak.
  216: entry({contact: {piece: 'horn', scale: 1.05}, hitStopMs: 65, shake: 'medium', knockPx: 26}),
  // 夜獄掠爪: three night claw marks rake across.
  226: entry({contact: {piece: 'claws', scale: 1}, hitStopMs: 45, shake: 'light', knockPx: 14}),
  // 夜獄焚焰砲: the signature -- a black-fire cannon: the ring blooms, the cores crack.
  227: entry({release: {piece: 'muzzle', scale: 1.2}, contact: {piece: 'core', scale: 1.35}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // ---- Batch 2: strike and slash signatures (46), by what each name does.
  // 苔角猛衝
  38: entry({contact: {piece: 'rush', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 霧鬃猛擊
  42: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 幽豆暗擊
  44: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 滾岩重擊
  64: entry({contact: {piece: 'quake', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 蒼拳狼嘯
  70: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 潮甲迴旋
  80: entry({contact: {piece: 'spin', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 沼尾斬
  82: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 曦冕烈焰擊
  134: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 闇羽墜擊
  149: entry({contact: {piece: 'quake', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 裂焰爆擊
  156: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 晶錘重擊
  159: entry({contact: {piece: 'quake', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 星盤刻時擊
  197: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 斷空剪
  199: entry({contact: {piece: 'scissor', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 女武神裁
  225: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 晨隼俯衝
  251: entry({contact: {piece: 'rush', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 炎靈核爆拳
  255: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 黑曜角斬
  260: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 雪印寒掌
  263: entry({contact: {piece: 'fist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 日焰烈吼
  286: entry({contact: {piece: 'roar', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 月影羽擊
  292: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 蒼電連擊
  313: entry({contact: {piece: 'fist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 裂潮斬浪
  323: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 星衛聖刃
  326: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 闇鋏斷罪
  334: entry({contact: {piece: 'scissor', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 烈鳳天翔擊
  337: entry({contact: {piece: 'rush', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 煉獄斷焰
  359: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 曙光聖裁
  370: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 海臣怒衝
  377: entry({contact: {piece: 'rush', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 巨核猛衝
  383: entry({contact: {piece: 'rush', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 鋼豆旋衝
  405: entry({contact: {piece: 'spin', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 天熊星拳
  426: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 狂紅嚎擊
  451: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 飛龍天墜
  455: entry({contact: {piece: 'rush', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 銀河正義拳
  470: entry({contact: {piece: 'fist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 霜灣戰鎚
  479: entry({contact: {piece: 'quake', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 曜羽霜刃
  481: entry({contact: {piece: 'slash', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 帝剪斷頭
  490: entry({contact: {piece: 'scissor', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 十字審判
  496: entry({contact: {piece: 'cross', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 冥骨霜踏
  507: entry({contact: {piece: 'quake', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 焰番一閃
  515: entry({contact: {piece: 'iai', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 蝕夜飛刀
  518: entry({contact: {piece: 'knives', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 潮墨膨衝
  528: entry({contact: {piece: 'rush', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 星冠豆拳
  533: entry({contact: {piece: 'fist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // 天斬蒼穹
  575: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 裂地鐵拳
  580: entry({contact: {piece: 'fist', scale: 1.15}, hitStopMs: 95, shake: 'heavy', knockPx: 30}),
  // 日輪獅神拳
  584: entry({contact: {piece: 'fist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 26}),
  // ---- Batch 2: 咬衣豆 (26) and 跳跳蕾 (27)
  // 幽豆咬
  43: entry({contact: {piece: 'jaws', scale: 0.7, fast: true}, hitStopMs: 40, shake: 'light', knockPx: 12}),
  // 花喙啄
  45: entry({contact: {piece: 'horn', scale: 0.6, fast: true}, hitStopMs: 40, shake: 'light', knockPx: 12}),
  // 花露彈
  46: entry({release: {piece: 'muzzle', scale: 0.8}, contact: {piece: 'core', scale: 1}, hitStopMs: 80, shake: 'medium', knockPx: 22}),
  // ---- Batch 3: fire, orb, lance, pierce, missile and claw signatures, by what each name does.
  // 聖暉光絮
  40: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 熾芯火球
  50: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'core', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 焰角火球
  54: entry({release: {piece: 'muzzle', scale: 1.13}, contact: {piece: 'core', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 曉暉光珠
  56: entry({contact: {piece: 'lance', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 朔月紗幕
  58: entry({release: {piece: 'muzzle', scale: 1.13}, contact: {piece: 'orb', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 烈鎧焰砲
  61: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 霜焰裂爪
  77: entry({contact: {piece: 'claws', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 燭火飛珠
  84: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'orb', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 惡作劇火球
  90: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'core', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 蒼冠焰流砲
  103: entry({release: {piece: 'muzzle', scale: 1.13}, contact: {piece: 'stream', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 小魔暗彈
  114: entry({contact: {piece: 'horn', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 蒼風裂空爪
  119: entry({contact: {piece: 'claws', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 月潮奔流
  138: entry({release: {piece: 'muzzle', scale: 1.13}, contact: {piece: 'stream', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 幻紋焰流
  144: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'stream', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 冰原碎岩
  161: entry({contact: {piece: 'quake', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 獵狼焰嘯
  176: entry({contact: {piece: 'roar', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 星雷電珠
  178: entry({release: {piece: 'muzzle', scale: 1.13}, contact: {piece: 'orb', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 霜紋蒼焰
  183: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'core', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 烈月焰彈
  185: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'orb', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 九尾神火
  191: entry({contact: {piece: 'wisps', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曠原日矛
  206: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 毒沼泥球
  221: entry({contact: {piece: 'splat', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 赤棘焰息
  229: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'stream', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 聖鈴裂爪
  231: entry({contact: {piece: 'claws', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 淵棘魔爪
  234: entry({contact: {piece: 'claws', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 闇翼魂刺
  236: entry({contact: {piece: 'horn', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 鏽泥毒漿
  242: entry({contact: {piece: 'splat', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 蝕影魂彈
  245: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'orb', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 苔核毒孢
  249: entry({contact: {piece: 'splat', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 曙刃光珠
  265: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 緋尾妖火
  267: entry({contact: {piece: 'wisps', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 迅影獅焰
  270: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'core', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 腐沼毒核
  272: entry({contact: {piece: 'splat', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 聖焰獅皇炎
  274: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'core', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 天鋒核焰砲
  280: entry({release: {piece: 'muzzle-spiral', scale: 1.13}, contact: {piece: 'quake', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 冰獄魔槍
  294: entry({contact: {piece: 'lance', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 狼王飛牙
  298: entry({contact: {piece: 'jaws', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 腐泥團
  300: entry({contact: {piece: 'splat', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 赤冠邪瞳
  305: entry({contact: {piece: 'eye', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曦闇裂爪
  307: entry({contact: {piece: 'claws', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 狂奏終章
  329: entry({contact: {piece: 'roar', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曦紗天光
  332: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 潮鑄海戟
  353: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 淵祈神諭
  355: entry({contact: {piece: 'horn', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 羽皇天喙
  362: entry({contact: {piece: 'horn', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 蛙皇心潮
  365: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'stream', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 熔角雷突
  368: entry({contact: {piece: 'horn', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 耀裁聖判
  398: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 赤鋼轟爆
  416: entry({release: {piece: 'muzzle-spiral', scale: 1.03}, contact: {piece: 'quake', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 蒼鋒轟爆
  419: entry({release: {piece: 'muzzle-spiral', scale: 1.03}, contact: {piece: 'quake', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 機冕飛彈雨
  422: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'rain', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 日影羽槍
  428: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 旭煌全彈發射
  432: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'rain', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 閃躍光砲
  436: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 拼魔裂爪
  445: entry({contact: {piece: 'claws', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 聖銘刃爪
  447: entry({contact: {piece: 'cross', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 耀冠王者光
  463: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 蒼焰鬼火陣
  475: entry({contact: {piece: 'wisps', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 日冕聖陽彈
  484: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'orb', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 深潮軌道砲
  487: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'lance', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 曜極天爆
  503: entry({release: {piece: 'muzzle-spiral', scale: 1.03}, contact: {piece: 'quake', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 聖砲天轟
  510: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'lance', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 時鋼終刻
  512: entry({contact: {piece: 'clock', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 齒木釘雨
  522: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'rain', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 闇鎧墨核
  530: entry({contact: {piece: 'splat', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 霜洋焰流
  537: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'stream', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 狼爵幻爪
  547: entry({contact: {piece: 'claws', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 冰河霜砲
  555: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'lance', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 零度射線
  558: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'stream', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 海皇焰流砲
  561: entry({release: {piece: 'muzzle', scale: 1.03}, contact: {piece: 'stream', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 王狼雷鋼彈
  567: entry({release: {piece: 'muzzle', scale: 1.13}, contact: {piece: 'orb', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 焰耀戰刃砲
  572: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 夜月聖斬
  587: entry({contact: {piece: 'slash', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 帝龍天穹砲
  592: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'lance', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 皇曜聖槍砲
  595: entry({release: {piece: 'muzzle', scale: 0.90}, contact: {piece: 'lance', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // ---- Batch 4: every remaining signature, by its archetype and name.
  // 清鈴波動
  32: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'note'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 焰角泡泡
  34: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'bubble_sm'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 螺旋芽擊
  36: entry({contact: {piece: 'horn', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 潮泡連珠
  48: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'bubble_sm'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 星糯泡泡
  52: entry({contact: {piece: 'flurry', scale: 1, sprite: 'bubble_sm'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 鬃雷球
  66: entry({contact: {piece: 'bolt', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 泡歌迴旋
  68: entry({contact: {piece: 'flurry', scale: 1, sprite: 'bubble_sm'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 邪眼暗霧
  74: entry({contact: {piece: 'mist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 葉角電珠
  86: entry({contact: {piece: 'flurry', scale: 1, sprite: 'leaf'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 碎晶投石
  88: entry({contact: {piece: 'quake', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 潮鬃水砲
  92: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'fish_0'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 雲耳旋風
  94: entry({contact: {piece: 'vortex', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 雷角電轟
  97: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'leaf'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 玩具爆彈
  99: entry({contact: {piece: 'rain', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 沉眠夢霧
  105: entry({contact: {piece: 'mist', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 星環暗齒
  107: entry({contact: {piece: 'drop', scale: 1.15, sprite: 'gear'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曜翼露珠
  110: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'bubble_sm'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 花藤纏縛
  112: entry({contact: {piece: 'vines', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曉歌火羽
  116: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'note'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 聖鈴清音
  122: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'note'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 迷香花霧
  124: entry({contact: {piece: 'mist', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 孢子彈
  126: entry({contact: {piece: 'drop', scale: 1, sprite: 'mushroom'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 雪晶吐息
  128: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'shard'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 光綾符刃
  130: entry({contact: {piece: 'knives', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 灰燼焚霧
  140: entry({contact: {piece: 'mist', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 薔薇棘舞
  146: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'leaf'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 流星角衝
  151: entry({contact: {piece: 'drop', scale: 1.25, sprite: 'bomb'}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 影紋雷陣
  163: entry({contact: {piece: 'bolt', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 森核藤彈
  165: entry({contact: {piece: 'vines', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 蒼穹裂風
  167: entry({contact: {piece: 'vortex', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 曦羽聖光
  170: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'feather_sm'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 岩牙熔石
  172: entry({contact: {piece: 'jaws', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 爆風連射
  180: entry({contact: {piece: 'rain', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 鋼城砲擊
  187: entry({contact: {piece: 'lance', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 奇羽爆走
  189: entry({contact: {piece: 'flurry', scale: 1, sprite: 'feather_sm'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 潮鳴共振
  201: entry({contact: {piece: 'flurry', scale: 1, sprite: 'note'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 深淵墨潮
  203: entry({contact: {piece: 'vortex', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 石化邪瞳
  208: entry({contact: {piece: 'quake', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 轟雷核爆
  210: entry({contact: {piece: 'bolt', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 珊瑚激流
  212: entry({contact: {piece: 'wave', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 蒼潮冰華
  219: entry({contact: {piece: 'flurry', scale: 1, sprite: 'shard'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 星彩手裏劍
  223: entry({contact: {piece: 'flurry', scale: 1, sprite: 'shard'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 花刺落英
  238: entry({contact: {piece: 'flurry', scale: 1, sprite: 'leaf'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 背岩投射
  240: entry({contact: {piece: 'vines', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 曦炎羽焰
  247: entry({contact: {piece: 'flurry', scale: 1, sprite: 'feather_sm'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 雪崩巨岩
  258: entry({contact: {piece: 'drop', scale: 1.15, sprite: 'bone'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 血棘瘴霧
  276: entry({contact: {piece: 'mist', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 深淵核焰砲
  284: entry({contact: {piece: 'vortex', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 霜祈冰獄陣
  302: entry({contact: {piece: 'flurry', scale: 1.25, sprite: 'shard'}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 冰核碎晶
  310: entry({contact: {piece: 'vines', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曜脈雷霆爪
  317: entry({contact: {piece: 'drop', scale: 1.25, sprite: 'bomb'}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 煌角貫天
  319: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'shard'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 廢都毒雨
  341: entry({contact: {piece: 'mist', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 霓虹裂光
  343: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 界根靈光
  346: entry({contact: {piece: 'drop', scale: 1.15, sprite: 'bomb'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 墓焰崩地
  349: entry({contact: {piece: 'quake', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 虹嵐雷暴
  374: entry({contact: {piece: 'bolt', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 玄竹風暴
  380: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'leaf'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 靈環天輪
  385: entry({contact: {piece: 'drop', scale: 1.15, sprite: 'bomb'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 幽幕冥光
  389: entry({contact: {piece: 'wave', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 星界侵蝕
  392: entry({contact: {piece: 'vortex', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 潮冠巨浪
  394: entry({contact: {piece: 'wave', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 音刃震波砲
  402: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'note'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 霜牙貫刺
  407: entry({contact: {piece: 'jaws', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 蒼雷海暴
  410: entry({contact: {piece: 'bolt', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 裂空黑洞
  413: entry({contact: {piece: 'vortex', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 綻光焰花砲
  439: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'leaf'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 夜詠咒歌
  442: entry({contact: {piece: 'flurry', scale: 1, sprite: 'note'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 地嘯大崩
  459: entry({contact: {piece: 'quake', scale: 1.25}, hitStopMs: 95, shake: 'heavy', knockPx: 32}),
  // 月鐮冥月
  467: entry({contact: {piece: 'slash', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 影脈光砲
  473: entry({contact: {piece: 'rain', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 曦冠焰翼砲
  493: entry({contact: {piece: 'flurry', scale: 1, sprite: 'feather_sm'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 棘林劍爪
  499: entry({contact: {piece: 'vines', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 冥砂葬咒
  524: entry({contact: {piece: 'vortex', scale: 1}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 神角天雷
  539: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'leaf'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 鳳凰涅槃火
  543: entry({contact: {piece: 'drop', scale: 1, sprite: 'bomb'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
  // 滅界焚天砲
  549: entry({contact: {piece: 'rain', scale: 1.15}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 黃銅妖音
  553: entry({contact: {piece: 'flurry', scale: 1.15, sprite: 'note'}, hitStopMs: 88, shake: 'heavy', knockPx: 28}),
  // 棘月花冠光
  565: entry({contact: {piece: 'flurry', scale: 1, sprite: 'leaf'}, hitStopMs: 80, shake: 'heavy', knockPx: 24}),
});

/**
 * The choreography of a move: a record index, an `own-<record>` Data Arena id,
 * or null for a move without one yet (it keeps the shared kit look).
 */
export function moveVfxChoreography(moveId) {
  if (moveId === null || moveId === undefined) return null;
  const key = typeof moveId === 'string' && moveId.startsWith('own-') ? Number(moveId.slice(4)) : moveId;
  return MOVE_VFX_CHOREOGRAPHY[key] ?? null;
}
