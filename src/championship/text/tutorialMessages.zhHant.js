// Product-authored Traditional Chinese copy for the guided tutorial, keyed by
// the original's text-bank record id. Copy coverage is not progression coverage:
// the legacy 35-step catalogue is only a middle segment. In particular, text
// wording does not establish whether the original waits for input or performs
// a demonstration. See TUTORIAL_MESSAGE_COVERAGE_2026-09-13.json.
// English (2026-09-29) lives beside it, keyed identically; the display
import { getLocale } from './locale.js';
import { speciesName } from './zhHant.js';
import { uiText } from './uiText.js';
import { TUTORIAL_LINES_EN, TUTORIAL_PROMPTS_EN } from './tutorialMessages.en.js';
import { TUTORIAL_LINES_JA, TUTORIAL_PROMPTS_JA } from './tutorialMessages.ja.js';
import { TUTORIAL_LINES_TH, TUTORIAL_PROMPTS_TH } from './tutorialMessages.th.js';
import { TUTORIAL_LINES_VI, TUTORIAL_PROMPTS_VI } from './tutorialMessages.vi.js';

const TUTORIAL_LINES_MAP = {
  en: TUTORIAL_LINES_EN,
  ja: TUTORIAL_LINES_JA,
  th: TUTORIAL_LINES_TH,
  vi: TUTORIAL_LINES_VI
};

const TUTORIAL_PROMPTS_MAP = {
  en: TUTORIAL_PROMPTS_EN,
  ja: TUTORIAL_PROMPTS_JA,
  th: TUTORIAL_PROMPTS_TH,
  vi: TUTORIAL_PROMPTS_VI
};

const lines = {
  1495: '這裡就是你的專屬牧場啦！吃飯、打掃、特訓全都在這兒搞定。',
  1496: '瞧，這顆培育蛋裡正藏著你的第一位拍檔喔！',
  1497: '別眨眼，殼好像開始晃動了……',
  1498: '哇，孵化成功！從現在起，牠就交給你照顧啦！',
  1499: '頭上冒出肉塊圖示，代表牠的肚子正在咕嚕咕嚕抗議囉。',
  1500: '先點一下工具列的【餵食】圖示。',
  1501: '接著在拍檔腳邊點一下，把熱騰騰的肉放給牠吃！',
  1502: '便便跟吃剩的殘渣可不能放著不管喔！',
  1503: '肉擺太久會發臭腐壞，牠嘴饞吃下去可是會拉肚子的。',
  1504: '先切換成【清潔】工具。',
  1505: '點一下地上的排泄物或剩食，就能刷得一乾二淨！',
  1506: '啊呀，環境一髒，拍檔果然鬧病了……',
  1507: '快拿藥幫牠舒緩一下吧！',
  1508: '先點選工具列的【藥品】圖示。',
  1509: '再點一下生病的拍檔，讓牠乖乖吃藥。',
  1510: '照顧得不錯嘛！接下來帶你認識牧場特訓！',
  1511: '拍檔待著的這塊六角場地，就是「育成設施」。',
  1512: '選【手掌】就能拖曳逛牧場，也能用方向操作四處巡視喔。',
  1513: '用手掌按住拍檔，就能一把把牠拎起來搬家！',
  1514: '把牠放進不同設施裡，就能朝你想要的方向特訓成長。',
  1515: '一落地進訓練場，牠就會立刻開始埋頭苦練！',
  1516: '不過特訓很耗體力，飽足度跟 HP 都會跟著掉喔。',
  1517: '差不多該歇口氣啦，把牠搬去保健室回回血吧！',
  1518: '待在保健室裡，HP 跟累積的疲勞都會慢慢補回來。',
  1519: '讓牠好好喘口氣吧。',
  1520: '特訓太拚或是打比賽，偶爾難免會擦傷掛彩。',
  1521: '要是受傷了，別忘了替牠上傷藥！',
  1522: '先選工具列的【傷藥】圖示。',
  1523: '再點一下掛彩的拍檔幫牠包紮。',
  1524: '呼嚕嚕……牠玩累睡著了。',
  1525: '趁牠補眠的時候，我們去野外狩獵，多找個新戰友吧！',
  1526: '打開選單點進「狩獵」，準備出發！',
  1527: '選好想去的傳送門，按下「{startHunt}」就能傳送！',
  1528: '切到【手掌】模式的時候，',
  1529: '就能自由拖曳地圖四處偵察。',
  1530: '用方向鍵也能滑動視野喔。',
  1531: '瞪大眼睛找找看，附近有沒有野生拍檔出沒！',
  1532: '發現目標！野生拍檔現身啦！',
  1533: '想把野生拍檔帶回家，',
  1534: '口訣只有三個字：「圈、拉、抓」！',
  1535: '第一招「圈」——用繩索繞著牠畫一圈！',
  1536: '第二招「拉」——拉扯繩索消耗牠的體力！',
  1537: '第三招「抓」——切回手掌一把收進記憶卡！',
  1538: '俐落收服！接下來換你親自上手試試看！',
  1539: '【圈住】選繩索繞著目標畫圈套牢！',
  1540: '【拉扯】持續拉扯壓低牠的 HP！',
  1541: '【觸碰】體力歸零就切手掌一把收編！',
  1542: '手感很棒嘛！繼續往深處逛逛吧。',
  1543: '前面有隻野生的{species}，去會會牠！',
  1544: '哎呀，被牠溜進洞裡躲起來了！',
  1545: '別急，這傢伙嘴饞得很，過一會兒還會探頭的。',
  1546: '噓——{species}又冒出來了！',
  1547: '在旁邊丟塊肉餌，把牠的注意力勾過來！',
  1548: '趁牠靠近，用射擊器打斷牠的腳步！',
  1549: '就是現在！趁牠麻痺動彈不得，立刻甩繩收服！',
  1550: '畫面上方是剩餘探索時間，歸零前都能繼續尋寶抓拍檔。',
  1551: '隨時能打開記憶卡檢視戰利品，不合心意也能放生。',
  1552: '趁時間還沒到，再逛逛附近有沒有稀有貨吧！',
  1553: '最後一堂課——帶你踏上真正的對戰舞台！',
  1554: '從選單點開「對戰」吧！',
  1555: '先來看看「頭銜賽」！',
  1556: '每天開打的頭銜賽都不同，記得常看賽程表喔。',
  1557: '這裡會列出對手陣容跟指定賽場，開打前先做功課準沒錯。',
  1558: '來排一組你的出戰陣容吧！',
  1559: '點選想派上場的拍檔。',
  1560: '你還能幫每隻拍檔決定開戰方針，',
  1561: '看是要狂轟必殺技，還是穩穩打支援輔助！',
  1562: '陣容都敲定後，點「返回」回到賽前畫面。',
  1563: '按下「開始對戰」——剩下的就交給你們平常的默契啦！',
  1564: '平時多在牧場特訓進化，站上賽場才更有底氣！',
  1565: '目標只有一個——拿下拍檔錦標賽的冠軍寶座！',
  1566: '加油囉，馴獸師！我和你的拍檔都等著看你大放異彩！',
};

/** Short prompts for the steps that wait on an action rather than a tap. */
const prompts = {
  RELOCATE_TO_RECOVERY_CAGE: '把夥伴拖到保健室育成區',
  SELECT_MEDICINE_TOOL: '選擇傷藥',
  APPLY_TOOL_TO_CREATURE: '點一下夥伴',
  OPEN_HUNT: '開啟狩獵',
  SELECT_GATE_TWICE: "選擇目的地，再按「{startHunt}」",
  SCROLL_HUNT_FIELD: '拖曳畫面',
  FIND_WILD: '找到野生夥伴',
  ROPE_ENCLOSE: '用繩索圈住',
  ROPE_PULL: '拉扯繩索',
  HAND_CAPTURE: '用手掌抓住',
  PLACE_FOOD: '放下食物',
  USE_SHOT: '使用彈射',
  ACKNOWLEDGE: '繼續',
};

// Presentation only: nativeTutorialHuntEntry fixes the second target at species 21.
// Resolve its existing product name; never pass a player nickname or change its ID.
function formatTutorialCopy(copy) {
  return copy.replaceAll('{species}', speciesName(21)).replaceAll('{startHunt}', uiText('開始狩獵'));
}

export function tutorialLine(textId) {
  const line = lines[textId];
  if (line === undefined) throw new Error(`TUTORIAL_TEXT_MISSING: ${textId}`);
  const loc = getLocale();
  return formatTutorialCopy((TUTORIAL_LINES_MAP[loc]?.[textId]) ?? line);
}

export function tutorialPrompt(advance) {
  const prompt = prompts[advance];
  if (prompt === undefined) throw new Error(`TUTORIAL_PROMPT_MISSING: ${advance}`);
  const loc = getLocale();
  return formatTutorialCopy((TUTORIAL_PROMPTS_MAP[loc]?.[advance]) ?? prompt);
}

export const TUTORIAL_TEXT_IDS = Object.freeze(Object.keys(lines).map(Number));
export const TUTORIAL_PROMPT_ACTIONS = Object.freeze(Object.keys(prompts));
