// Product-authored Traditional Chinese copy for the guided tutorial, keyed by
// the original's text-bank record id. The step order, phase and advance
// condition are the catalogue's; only the wording is ours. No original string
// is transcribed here.
const lines = {
  1515: '把夥伴放進訓練育成區的那一刻，訓練就開始了。',
  1516: '訓練會消耗飽足度，也會減少 HP。',
  1517: '把牠移到保健室育成區，讓 HP 恢復吧。',
  1518: '保健室育成區會讓 HP 慢慢回復。',
  1519: '讓牠好好休息一下。',
  1520: '訓練和戰鬥都可能讓夥伴受傷。',
  1521: '受傷的話，用傷藥治療。',
  1522: '先選擇傷藥的圖示。',
  1523: '再點一下數碼獸。',
  1524: '數碼獸睡著了。',
  1525: '趁牠睡著的時候，去抓另一隻數碼獸吧。',
  1526: '從子選單選擇「狩獵」，出發去抓吧。',
  1527: '連點閘門兩下，選擇要去的地圖。',
  1528: '選擇手掌圖示的時候，',
  1529: '就可以拖曳捲動地圖。',
  1530: '方向鍵也可以捲動畫面。',
  1531: '找找看附近有沒有數碼獸。',
  1532: '發現數碼獸了。',
  1533: '想要抓住數碼獸，',
  1534: '要領是「圈住、拉扯、觸碰」。',
  1535: '「圈住」',
  1536: '「拉扯」可以減少牠的 HP。',
  1537: '「觸碰」用手掌圖示把牠收進來。',
  1538: '抓到了。接下來換你試試看。',
  1539: '「圈住」用繩索圖示把牠圈起來。',
  1540: '「拉扯」減少牠的 HP。',
  1541: '「觸碰」用手掌圖示抓住牠。',
  1542: '那麼，繼續往下走吧。',
  1543: '那裡有一隻滾球獸，試著抓抓看。',
  1544: '牠逃進洞裡了。',
  1545: '就算逃走了，過一陣子牠還是會回來。',
  1546: '滾球獸好像回來了。',
  1547: '在附近放下食物，把牠引過來。',
  1548: '用彈射可以讓數碼獸停下動作。',
  1549: '趁牠麻痺的時候，用繩索把牠抓住。',
};

/** Short prompts for the steps that wait on an action rather than a tap. */
const prompts = {
  RELOCATE_TO_RECOVERY_CAGE: '把夥伴拖到保健室育成區',
  SELECT_MEDICINE_TOOL: '選擇傷藥',
  APPLY_TOOL_TO_CREATURE: '點一下數碼獸',
  OPEN_HUNT: '開啟狩獵',
  SELECT_GATE_TWICE: '連點閘門兩下',
  SCROLL_HUNT_FIELD: '拖曳畫面',
  FIND_WILD: '找到數碼獸',
  ROPE_ENCLOSE: '用繩索圈住',
  ROPE_PULL: '拉扯繩索',
  HAND_CAPTURE: '用手掌抓住',
  PLACE_FOOD: '放下食物',
  USE_SHOT: '使用彈射',
  ACKNOWLEDGE: '繼續',
};

export function tutorialLine(textId) {
  const line = lines[textId];
  if (line === undefined) throw new Error(`TUTORIAL_TEXT_MISSING: ${textId}`);
  return line;
}

export function tutorialPrompt(advance) {
  const prompt = prompts[advance];
  if (prompt === undefined) throw new Error(`TUTORIAL_PROMPT_MISSING: ${advance}`);
  return prompt;
}

export const TUTORIAL_TEXT_IDS = Object.freeze(Object.keys(lines).map(Number));
export const TUTORIAL_PROMPT_ACTIONS = Object.freeze(Object.keys(prompts));
