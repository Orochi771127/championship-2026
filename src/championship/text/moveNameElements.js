// The element a move's approved zh-Hant name states outright, for effect
// colour only (OWNER_APPROVED_ADAPTATION 2026-11-01, VFX_FIVE_LAYER_20261101).
// A name never changes a move's power, element rule, range or timing; this is
// read by presentation/vfx/unifiedMoveVfxResolver.js to colour the effect.
//
// Only unambiguous element words count. The first rule that matches wins, so
// 焰角泡泡 reads FIRE (焰) before WATER (泡).
import { BATTLE_MOVE_NAMES } from "./battleMoveNames.js";

const RULES = Object.freeze([
  [/雷|電|霆/, "THUNDER"],
  [/焰|炎|火|焚|燭|熾|灼|熔|燼/, "FIRE"],
  [/冰|霜|雪|凍/, "ICE"],
  [/水|潮|泡|浪|海|鯨|淵/, "WATER"],
  [/藤|蔓|棘|荊|葉|花|瓣|蕾|薔薇|種|芽|苔|森|樹|根|竹/, "WOOD"],
  [/岩|石|地|崩|礫|骨|山/, "EARTH"],
  [/風|旋|颶|嵐/, "WIND"],
  [/鋼|鐵|機|齒|金屬/, "METAL"],
  [/闇|暗|影|冥|夜|幽|魔|邪|獄|鬼|黑|月/, "MOON"],
  [/光|聖|曜|星|輝|暉|陽|日|煌/, "SUN"]
]);

/** The taxonomy element the move's zh-Hant name states, or null. */
export function moveNameElement(moveId) {
  const name = BATTLE_MOVE_NAMES[moveId]?.[0];
  if (!name) return null;
  return RULES.find(([rule]) => rule.test(name))?.[1] ?? null;
}
