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
  // ---- Batch 5: every skill move, by its name and archetype, a medium blow.
  // 焰鱗彈
  60: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 穿地三爪
  63: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 蒼拳重擊
  71: entry({contact: {piece: 'fist', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 蒼拳連打
  72: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 蒼焰小球
  76: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 甲片飛射
  79: entry({contact: {piece: 'horn', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 暖雲火球
  95: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 蒼冠火彈
  101: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 冠角突刺
  102: entry({contact: {piece: 'horn', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 曜翼拍擊
  109: entry({contact: {piece: 'fist', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 疾風三爪
  118: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 風羽飛鏢
  120: entry({contact: {piece: 'knives', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 曦冕焰掌
  132: entry({contact: {piece: 'fist', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 曦冕火球
  133: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 月影爪
  136: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 月露彈
  137: entry({contact: {piece: 'wave', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 燼爪火球
  141: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 幻紋落雷
  143: entry({contact: {piece: 'bolt', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 魅惑暗光
  148: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'heart'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 星爪拍
  152: entry({contact: {piece: 'claws', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 裂焰火花
  154: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'leaf'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 裂焰三爪
  155: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 晶鏈翻滾
  158: entry({contact: {piece: 'spin', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 風刃針
  168: entry({contact: {piece: 'slash', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 迅風連擊
  174: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 風牙飛咬
  175: entry({contact: {piece: 'jaws', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 槍兔突進
  181: entry({contact: {piece: 'rush', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 金焰吐息
  192: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'stream', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 觸腕連打
  204: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 潮鰭拍擊
  218: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 聖鈴瞳光
  232: entry({contact: {piece: 'eye', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 蝕影咒印
  244: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'orb', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 晨焰羽翼
  252: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'feather_sm'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 銳啄連啄
  253: entry({contact: {piece: 'horn', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 霜鬃冰錐
  257: entry({contact: {piece: 'horn', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 曜角熔石
  261: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 狐焰吐息
  268: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'stream', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 鍛焰彈
  278: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 天鋒重拳
  279: entry({contact: {piece: 'fist', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 淵焰彈
  282: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 深淵重拳
  283: entry({contact: {piece: 'fist', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 日焰裂爪
  287: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 日焰熔核
  288: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 月影泡沫
  290: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'bubble_sm'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 月影水箭
  291: entry({release: {piece: 'muzzle', scale: 0.84}, contact: {piece: 'lance', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 霜獄寒流砲
  295: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'lance', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 荒牙熔焰
  297: entry({contact: {piece: 'jaws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 霜祈風雪
  303: entry({contact: {piece: 'flurry', scale: 1.05, sprite: 'shard'}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 闇羽焰翼
  308: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'feather_sm'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 曜脈熔核
  316: entry({contact: {piece: 'drop', scale: 1.05, sprite: 'bomb'}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 煌角電珠
  320: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'orb', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 裂潮雙月刃
  322: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 星衛雙彈
  325: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'shard'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 狂奏音波
  328: entry({contact: {piece: 'roar', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 曦紗光矢
  331: entry({contact: {piece: 'knives', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 闇鋏巨鉗
  335: entry({contact: {piece: 'scissor', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 烈鳳焰息
  338: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'stream', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 廢渣泥團
  340: entry({contact: {piece: 'splat', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 電脈裂爪
  344: entry({contact: {piece: 'claws', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 根種彈
  347: entry({contact: {piece: 'vines', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 墓焰黑霧
  350: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 潮鑄落雷
  352: entry({contact: {piece: 'bolt', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 邪神連擊
  356: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 殘焰火魂
  358: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 華冠羽彈
  361: entry({contact: {piece: 'drop', scale: 0.85, sprite: 'bomb'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 爵潮雷鳴
  364: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'note'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 熔角刺
  367: entry({contact: {piece: 'horn', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 曙光盾擊
  371: entry({contact: {piece: 'fist', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 虹嵐羽刃
  373: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 潮鰭長槍
  376: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'lance', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 玄竹三爪
  379: entry({contact: {piece: 'claws', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 巨核炸彈
  382: entry({contact: {piece: 'drop', scale: 0.85, sprite: 'bomb'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 靈環月斬
  386: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 幽幕魂斬
  388: entry({contact: {piece: 'slash', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 星界誘心彈
  391: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'heart'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 鯨噴水箭
  395: entry({contact: {piece: 'vortex', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 天秤斬
  397: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 音刃亂打
  400: entry({contact: {piece: 'slash', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 音刃疾擊
  401: entry({contact: {piece: 'slash', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 鋼豆炸彈
  404: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 霜牙寒霧
  408: entry({contact: {piece: 'jaws', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 棘龍海嘯
  411: entry({contact: {piece: 'roar', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 裂空刃
  414: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 赤鋼鐵彈
  417: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'rain', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 蒼鋒鐵彈
  420: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'rain', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 機冕熾焰砲
  423: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 星抱誘心
  425: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'heart'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 日影黑羽
  429: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'feather_sm'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 旭煌雷珠
  431: entry({contact: {piece: 'bolt', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 旭煌重拳
  433: entry({contact: {piece: 'fist', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 閃躍飛彈
  435: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'rain', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 綻光花粉砲
  438: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'leaf'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 夜詠黑焰
  441: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'note'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 拼魔怨念
  444: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'heart'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 聖銘焰符
  448: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 狂紅裂爪
  450: entry({contact: {piece: 'claws', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 天槍焰矢
  453: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'lance', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 天槍突刺
  454: entry({release: {piece: 'muzzle', scale: 0.84}, contact: {piece: 'lance', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 地嘯重拳
  457: entry({contact: {piece: 'roar', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 地嘯碎岩拳
  458: entry({contact: {piece: 'roar', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 耀冠獅焰
  461: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 耀冠焰爪連擊
  462: entry({contact: {piece: 'claws', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 幻鐮月影
  465: entry({contact: {piece: 'slash', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 月鐮霜矢
  466: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 銀河星彈連射
  469: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'shard'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 影脈飛彈
  472: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'rain', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 蒼焰冷炎彈
  476: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 霜灣冰旋
  478: entry({contact: {piece: 'vortex', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 曜羽光矢
  482: entry({contact: {piece: 'flurry', scale: 0.95, sprite: 'feather_sm'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 日冕潮爪
  485: entry({contact: {piece: 'claws', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 深潮光珠
  488: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'orb', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 煌甲突進
  491: entry({contact: {piece: 'rush', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 獅鷲羽刃
  494: entry({contact: {piece: 'slash', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 審判聖光
  497: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'lance', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 棘林聖光爆
  500: entry({contact: {piece: 'vines', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 極光星彈
  502: entry({release: {piece: 'muzzle', scale: 0.84}, contact: {piece: 'orb', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 星曜貫刃
  504: entry({contact: {piece: 'slash', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 冥骨旋輪
  506: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bone'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 聖砲雙彈
  509: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'rain', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 時鋼聖刃
  513: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 焰番獅吼
  516: entry({contact: {piece: 'roar', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 蝕夜雷閃
  519: entry({contact: {piece: 'bolt', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 提線操擊
  521: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 冥砂塵暴
  525: entry({contact: {piece: 'vortex', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 潮墨棘針
  527: entry({contact: {piece: 'vines', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 墨皇潮爪
  531: entry({contact: {piece: 'claws', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 星冠紫焰
  534: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'shard'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 霜洋幽光
  536: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'lance', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 力王電光
  540: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'orb', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 煌羽聖輝
  542: entry({contact: {piece: 'flurry', scale: 0.85, sprite: 'feather_sm'}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 幻紋雙月
  545: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 幻紋焰嘯
  546: entry({contact: {piece: 'roar', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 滅界鐵拳
  550: entry({contact: {piece: 'fist', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 王猿果彈
  552: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'cherry'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 寒鋼飛彈群
  556: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'rain', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 闇巡飛彈
  559: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'rain', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 深鎧怒潮
  562: entry({contact: {piece: 'wave', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 棘月雷藤
  564: entry({contact: {piece: 'vines', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 雷獵雙彈
  568: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'rain', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 雷獵焰砲
  569: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 焰耀十字斬
  571: entry({contact: {piece: 'cross', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 焰耀重拳
  573: entry({contact: {piece: 'fist', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 蒼龍雙斬
  576: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 蒼龍迅斬
  577: entry({contact: {piece: 'slash', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 裂地重裝衝
  579: entry({contact: {piece: 'quake', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 裝甲滾衝
  581: entry({contact: {piece: 'rush', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 日輪火珠
  583: entry({contact: {piece: 'drop', scale: 0.95, sprite: 'bomb'}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 日輪焰矢
  585: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'lance', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 夜月水矢
  588: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'lance', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 夜月幽域
  589: entry({release: {piece: 'muzzle', scale: 0.84}, contact: {piece: 'lance', scale: 1.05}, hitStopMs: 70, shake: 'medium', knockPx: 24}),
  // 帝龍突進
  590: entry({contact: {piece: 'rush', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 天穹焰砲
  591: entry({release: {piece: 'muzzle', scale: 0.76}, contact: {piece: 'core', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // 曜槍突
  593: entry({release: {piece: 'muzzle', scale: 0.68}, contact: {piece: 'lance', scale: 0.85}, hitStopMs: 55, shake: 'medium', knockPx: 18}),
  // 赤曜盾斬
  594: entry({contact: {piece: 'slash', scale: 0.95}, hitStopMs: 62, shake: 'medium', knockPx: 21}),
  // ---- Batch 6: every basic move, by its name and archetype, a light blow.
  // 鈴芽頭槌
  31: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 焰角頂
  33: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 芽螺滾撞
  35: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 絨角頂
  37: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 暉絨輕撞
  39: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 霧鬚撲
  41: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 潮泡撞
  47: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 熾芯撞
  49: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 糯糯撞
  51: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 幼角頂
  53: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 曉光撞
  55: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 月紗拂
  57: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鎧焰爪
  59: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 岩甲掠爪
  62: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雷鬃撲
  65: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蝌尾拍
  67: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蒼狼咬
  69: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 棘牙掠爪
  73: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 霜裘掠爪
  75: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 甲殼撞
  78: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 沼牙咬
  81: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 燭芯撞
  83: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 葉角頂
  85: entry({contact: {piece: 'flurry', scale: 0.75, sprite: 'shard'}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 晶礫撞
  87: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 夜牙偷襲
  89: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鰭掌拍
  91: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雲耳拍
  93: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 角針射
  96: entry({contact: {piece: 'flurry', scale: 0.75, sprite: 'shard'}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鐵玩掠爪
  98: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蒼冠掠爪
  100: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 貘鼻撞
  104: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 齒輪撞
  106: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 團子撞
  108: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 花藤拂
  111: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 影牙咬
  113: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雛爪抓
  115: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 隼爪掠
  117: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鈴犬撞
  121: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 花纓拂
  123: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 菇冠撞
  125: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雪晶掠爪
  127: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 綾狐掠爪
  129: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 幼獅撲
  131: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 兔腳踢
  135: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 灰燼掠爪
  139: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 幻紋針
  142: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 花蕾撞
  145: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 闇羽拍
  147: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 星角頂
  150: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 裂焰掠爪
  153: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 晶甲撞
  157: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 長牙撞
  160: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 術杖敲
  162: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 樹根撞
  164: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蒼穹咬
  166: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 曦羽拂
  169: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 戰鬼拳
  171: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 迅風咬
  173: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鍬角夾
  177: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 疾耳衝
  179: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 霜紋掠爪
  182: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 烈月掠爪
  184: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鐵壁撞
  186: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 喙針射
  188: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 九尾拂
  190: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鐘擺撞
  196: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鋏顎夾
  198: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蛙舌彈
  200: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 觸腕拍
  202: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蹄踏
  205: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 巨喙啄
  207: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雷球撞
  209: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 珊殼咬
  211: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 海龍尾擊
  217: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 泥核撞
  220: entry({contact: {piece: 'splat', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 星刃旋
  222: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 聖刃斬
  224: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 赤棘掠爪
  228: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 靈貓掠爪
  230: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 淵棘掠爪
  233: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 魔使掠爪
  235: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 皇后花舞
  237: entry({contact: {piece: 'flurry', scale: 0.75, sprite: 'leaf'}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 巖盾撞
  239: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 泥躍踢
  241: entry({contact: {piece: 'splat', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 幽靈穿
  243: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 巨鳥掠爪
  246: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 苔藤鞭
  248: entry({contact: {piece: 'vines', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 晨隼羽針
  250: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 焰核掌
  254: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雪猿拳
  256: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 曜角頂
  259: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 靈偶輕撞
  262: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 角光針
  264: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 緋尾拂
  266: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 猞王撲
  269: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 腐沼撞
  271: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 聖焰獅皇撲
  273: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 血棘鞭
  275: entry({contact: {piece: 'vines', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 天鋒撞
  277: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 深淵撞
  281: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 日焰獅撲
  285: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 羽兔踢
  289: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 霜獄掠爪
  293: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 荒牙掠爪
  296: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 泥沼拍
  299: entry({contact: {piece: 'splat', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 巫杖敲
  301: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 赤冠啄
  304: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 闇羽掠爪
  306: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 石靈撞
  309: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 迅龍撞
  311: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蒼電迅衝
  312: entry({contact: {piece: 'rush', scale: 0.82}, hitStopMs: 50, shake: 'light', knockPx: 16}),
  // 曜脈掠爪
  314: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 曜脈雷斬
  315: entry({contact: {piece: 'slash', scale: 0.82}, hitStopMs: 50, shake: 'light', knockPx: 16}),
  // 皇甲撞
  318: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 異蝦鉗
  321: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 機神拳
  324: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 猿王拍
  327: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 天姬拂
  330: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 闇甲撞
  333: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 烈鳳啄
  336: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 王桶撞
  339: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 電脈掠爪
  342: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 樹王撞
  345: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 暴君踏
  348: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 海將撞
  351: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 觸鬚撞
  354: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 殘焰斬
  357: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 羽皇啄
  360: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蛙皇拍
  363: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 重獸撞
  366: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 騎聖斬
  369: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鸚皇啄
  372: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 海臣撞
  375: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 熊掌拍
  378: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 裝豆撞
  381: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 仙環斬
  384: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 死神鐮
  387: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 入侵觸擊
  390: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 巨鯨撞
  393: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 耀裁斬
  396: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 疾狼撞
  399: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鋼豆撞
  403: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 長象踏
  406: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 海棘尾擊
  409: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 機龍撞
  412: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 赤鋼撞
  415: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蒼鋒撞
  418: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 機冕撞
  421: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 天熊抱擊
  424: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鴉喙啄
  427: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 彈龍撞
  430: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 閃躍踢
  434: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 花風拂
  437: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 魔女杖
  440: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 拼魔掠爪
  443: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 銘狼撲
  446: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 嚎狼咬
  449: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 飛龍撞
  452: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 地嘯撞
  456: entry({contact: {piece: 'roar', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 獅王撲
  460: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 月鐮斬
  464: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 星警拳
  468: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 影兔踢
  471: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 騎靈撞
  474: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 戰牙撞
  477: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 武姬斬
  480: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 日冕掠爪
  483: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 軌龍撞
  486: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 帝剪斬
  489: entry({contact: {piece: 'scissor', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 獅鷲咬
  492: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 十字鷹啄
  495: entry({contact: {piece: 'cross', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 劍獅掠爪
  498: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 曜龍爪
  501: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 冥骨撞
  505: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 天兔踢
  508: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 時鋼斬
  511: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 迅獅撞
  514: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 丑皇翻滾
  517: entry({contact: {piece: 'spin', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 木偶撞
  520: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 法杖擊
  523: entry({contact: {piece: 'quake', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 河鯆撞
  526: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 闇鎧掠爪
  529: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 豆爵撞
  532: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蛇龍尾擊
  535: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 力王撞
  538: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 鳳凰啄
  541: entry({contact: {piece: 'horn', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 狼爵撲
  544: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 滅界撞
  548: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 王猿拳
  551: entry({contact: {piece: 'fist', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 機狼爪
  554: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 零狼咬
  557: entry({contact: {piece: 'jaws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 海皇尾擊
  560: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 花后斬
  563: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 雷獵掠爪
  566: entry({contact: {piece: 'claws', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 戰刃斬
  570: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 蒼龍斬
  574: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 裝甲撞
  578: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 獅神撲
  582: entry({contact: {piece: 'rush', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
  // 獵姬斬
  586: entry({contact: {piece: 'slash', scale: 0.75}, hitStopMs: 42, shake: 'light', knockPx: 14}),
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
