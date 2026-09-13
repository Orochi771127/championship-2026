// Product-authored Traditional Chinese copy for the guided tutorial, keyed by
// the original's text-bank record id. Copy coverage is not progression coverage:
// the legacy 35-step catalogue is only a middle segment. In particular, text
// wording does not establish whether the original waits for input or performs
// a demonstration. See TUTORIAL_MESSAGE_COVERAGE_2026-09-13.json.
const lines = {
  1495: '在育成畫面裡，可以照顧你的數碼獸。',
  1496: '這是一顆數碼蛋，數碼獸會從蛋裡誕生。',
  1497: '稍等一下，看看數碼獸的變化吧。',
  1498: '數碼獸進化了，開始照顧牠吧。',
  1499: '出現肉的圖案，表示牠肚子餓了。',
  1500: '先選擇肉的圖示。',
  1501: '再點一下數碼獸附近的地面，放下食物。',
  1502: '排泄物和吃剩的食物，都要記得清理。',
  1503: '食物放得太久就會腐壞。',
  1504: '先選擇清潔圖示。',
  1505: '點一下排泄物或剩下的食物，就能清除。',
  1506: '環境髒亂，數碼獸就可能生病。',
  1507: '用藥幫牠治療吧。',
  1508: '先選擇藥品圖示。',
  1509: '再點一下要治療的數碼獸。',
  1510: '接下來，認識訓練功能。',
  1511: '數碼獸生活的房間，就是育成區。',
  1512: '選擇手掌圖示後，可以拖曳畫面查看育成區；方向操作也可以移動視野。',
  1513: '使用手掌工具，按住數碼獸就能把牠拿起來。',
  1514: '把牠移到不同的育成區，讓牠接受訓練、繼續成長。',
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
  1550: '畫面上方會顯示剩餘時間，可以狩獵到時間結束。',
  1551: '也可以查看捕獲的數碼獸，或將牠放走。',
  1552: '在剩餘時間內，繼續尋找數碼獸吧。',
  1553: '最後，來認識對戰功能。',
  1554: '請從子選單開啟「對戰」。',
  1555: '選擇「頭銜賽」。',
  1556: '每天可以參加的頭銜賽會有所不同。',
  1557: '這裡會顯示對手和對戰場地。',
  1558: '先安排自己的參賽隊伍吧。',
  1559: '選擇要上場的數碼獸。',
  1560: '可以分別替每隻數碼獸設定特殊攻擊等選項，',
  1561: '安排牠在戰鬥中的作戰方式。',
  1562: '設定完成後，選擇「返回」。',
  1563: '選擇「開始對戰」，數碼獸就會自動進行戰鬥。',
  1564: '持續訓練、讓數碼獸進化，為贏得對戰做好準備。',
  1565: '向數碼獸冠軍賽的優勝邁進吧！',
  1566: '培育強大的數碼獸，一起挑戰冠軍。',
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
