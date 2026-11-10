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
