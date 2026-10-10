import { getLocale } from './locale.js';
import { DEFAULT_NAME_EN, EXTRA_EN, RANDOM_EN, SEASONS_EN, SENDERS_EN, SEQUENTIAL_EN } from './raisingMessages.en.js';
import { DEFAULT_NAME as DEFAULT_NAME_JA, EXTRA as EXTRA_JA, RANDOM as RANDOM_JA, SEASONS as SEASONS_JA, SENDERS as SENDERS_JA, SEQUENTIAL as SEQUENTIAL_JA } from './raisingMessages.ja.js';
import { DEFAULT_NAME as DEFAULT_NAME_TH, EXTRA as EXTRA_TH, RANDOM as RANDOM_TH, SEASONS as SEASONS_TH, SENDERS as SENDERS_TH, SEQUENTIAL as SEQUENTIAL_TH } from './raisingMessages.th.js';
import { DEFAULT_NAME as DEFAULT_NAME_VI, EXTRA as EXTRA_VI, RANDOM as RANDOM_VI, SEASONS as SEASONS_VI, SENDERS as SENDERS_VI, SEQUENTIAL as SEQUENTIAL_VI } from './raisingMessages.vi.js';

const RAISING_TABLES = {
  en: { sequential: SEQUENTIAL_EN, seasons: SEASONS_EN, random: RANDOM_EN, extra: EXTRA_EN, senders: SENDERS_EN, defaultName: DEFAULT_NAME_EN },
  ja: { sequential: SEQUENTIAL_JA, seasons: SEASONS_JA, random: RANDOM_JA, extra: EXTRA_JA, senders: SENDERS_JA, defaultName: DEFAULT_NAME_JA },
  th: { sequential: SEQUENTIAL_TH, seasons: SEASONS_TH, random: RANDOM_TH, extra: EXTRA_TH, senders: SENDERS_TH, defaultName: DEFAULT_NAME_TH },
  vi: { sequential: SEQUENTIAL_VI, seasons: SEASONS_VI, random: RANDOM_VI, extra: EXTRA_VI, senders: SENDERS_VI, defaultName: DEFAULT_NAME_VI }
};
const sequential=[
  '先把夥伴培育好，參加春季第 3 日的「春季王牌」頭銜賽吧！',
  '育成區堆滿排泄物會讓夥伴生病，記得經常清理。',
  '食物放久了會腐壞。吃下腐壞的食物可能生病。',
  '記得查看賽程，在頭銜賽開始前做好準備。',
  '壓力大的夥伴容易受傷，別把太多夥伴擠在狹小的育成區。',
  '戰鬥後 HP 不足，可以在保健室育成區慢慢恢復。',
  '要留下購買食物的位元幣，別讓夥伴挨餓。',
  '自由對戰可以賺取獎金，但挑戰太強的對手很危險。',
  '幼年期可以集中訓練特定能力，這會影響之後的進化。',
  '戰鬥次數也是進化條件之一。多參加戰鬥，可能出現不同的進化。',
  '夥伴頭上的煩悶符號，可能是在表示壓力。',
  '進化能讓夥伴成長，能力也會隨著形態改變。',
  '容量就像夥伴的體重，進化後通常會增加。',
  '贏得頭銜賽、累積獎章可以提升馴獸師等級，容納更多夥伴。',
  '在夥伴選單確認總容量，預留約 10 G，為進化做準備。',
  '同一個狩獵地點，白天與夜晚也可能出現不同夥伴。',
  '頭上的狀態圖示表示夥伴需要照顧，記得查看。',
  '進化時超出容量，可能失去夥伴。別把容量用得太滿。',
  '馴獸師等級提高後，就能參加更多頭銜賽。',
  '轉生次數也是進化條件。培育強大的究極體，可能需要經歷轉生。',
  '訓練會消耗飽足度，運動後記得準備食物。',
  '受傷或生病時要及早用藥，放著不管可能危及生命。',
  '提高 TP，才能多使用必殺技。有些夥伴能掌握三種招式。',
  '春夏氣候溫暖，適合讓夥伴訓練。',
  '食物和藥品用完前，記得去商店補充。',
  '提高馴獸師等級，可能開放新的狩獵閘門。',
  '夥伴之間也會建立友情。總是獨自在育成區，友情不容易成長。',
  '夥伴會隨時間進化。別忘了訓練，讓牠朝希望的方向成長。',
  '蛋白質能提高戰鬥中的攻擊力，但也會增加受傷的風險。',
  '頭銜賽的入場登錄時間是 07:00 至 15:00，別錯過時段。',
  '買到新的狩獵道具後，出發前記得裝備。',
  '抓起夥伴、移到不同育成區，可以促進成長。',
  'TP 是技術點數，使用必殺技或支援技能時會消耗。',
  '三年間只要贏過一次冠軍賽預賽，就能取得下一次本賽資格。',
  '留意「狂野巨人」隊，他們擅長培育力量型夥伴。',
  '馴獸師持有育成執照，等級提升後才能進行更高階的進化。',
  '秋季有許多大賽。先調整夥伴的狀態，再去參加吧！',
  '購買新的育成區後，要在育成區編輯中配置，才能讓夥伴使用。',
  '讓夥伴開心有助於紓解壓力；長期累積壓力可能生病。',
  '夥伴變回培育蛋後仍能再次成長，培育成果也有機會繼承。',
  '冠軍賽預賽與本賽都在秋季第 5 日舉行。提高等級，再來挑戰！',
  '狩獵時善用繩索以外的道具，安排陷阱和捕捉方式。',
  '在不同時間出發狩獵，也可能遇到不同天氣。',
  '馴獸師等級提高後，育成區可用空間也可能增加。',
  '記得看看資料庫裡的圖鑑，收集不同夥伴也是培育的樂趣。',
  '夥伴的性格會影響戰鬥中的行動。',
  '夥伴也有魅力值。魅力高的夥伴更容易取得同伴信任。',
  '進化過的夥伴會登錄在圖鑑中，試著收集完整吧！',
  '想留更長的時間狩獵，可以在上午出發。',
  '據說有人在原地再次遇到曾經放生的夥伴。',
  '仔細觀察夥伴的行動，即使沒有言語，也能看出牠的心情。',
  '訓練提高能力後立刻點選夥伴，有時能看出下一次的進化方向。',
  '大便獸也是夥伴，不能當作排泄物清掉。',
  '有些夥伴待在任性的同伴旁邊，會累積壓力。',
  '轉生後會留下部分記憶，因此較容易再次沿著相同路線進化。',
  '育成區排泄物太多，可能讓夥伴無法排泄，進而累積壓力。',
  '狩獵時留意移動特別快的夥伴，牠可能擁有少見的能力。',
  '悠閒的夥伴睡著後，可能不容易被點醒。',
  '跨越幾代持續培育，也是變強的方法。偶爾失敗也別急。',
  '夥伴對育成區各有喜好，有些喜歡陰暗潮濕的環境。',
  '龍與獸、水與鳥、蟲草與機械、聖與暗，分別具有對立關係。',
  '夥伴不聽話時，原作可以按住 L 或 R 再點選，協助抓取。',
  '合得來的夥伴會一起唱歌，開心地紓解壓力。'
];
const seasons=[
  '這個世界有四個季節，每個季節持續八日。','夏季適合訓練，能力比平時更容易提高。','秋季是對戰的季節，頭銜賽特別多。','冬季訓練要留意狀態，勉強訓練容易受傷。',
  '季節改變，夥伴的棲息地也會改變。','春秋適合狩獵，野外夥伴較多。','秋冬會出現暗屬性的夥伴。','冬季也可能遇見平時難得一見的夥伴。',
  '春天到了，活躍的夥伴會更多地出現在野外。','炎熱的夏季又來了，準備好訓練吧！','秋季食慾旺盛，記得備足食物。','冬季可以先補充道具，為春季做準備。',
  '春天又來了，是狩獵獸與鳥種族的好時機。','夏季夥伴較少外出，但蟲種族仍比較容易找到。','秋季除了冠軍賽，還有許多頭銜賽等著挑戰。','能教你的都已經說過了，期待你成為出色的馴獸師！'
];
const random=[
  '今天的天氣真好，會不會是太陽獸的功勞呢？','記得好好吃飯，別讓身體變得像鼻涕獸。','把古尼獸放在叢林裡培育，竟然變成了大甲蟲！','照顧得太累時，也可以考慮讓夥伴回到野外。','猿猴獸接觸許多病毒後，竟然變成銀色的樣子！',
  '讓達爾克獸參加戰鬥、提高暗屬性後，性格似乎變了呢。','花拉獸既可愛又芳香，讓人心情放鬆。','加奧加獸、加魯魯獸、古魯魯獸，名字真容易弄混！','巨鯨獸的體型真讓人驚嘆。','哥瑪獸多參加戰鬥，就有機會進化成海獅獸。'
];
const extra={94:'已到戰鬥入場登錄時間。',
  95:'夥伴肚子餓了，餵牠吃肉或蛋白質吧。',96:'壓力太高可能生病。可以送到保健室，或多摸摸牠。',97:'夥伴生病了，請用藥治療。拖延治療可能瀕死。',98:'夥伴受傷了，請用傷藥治療。拖延治療可能瀕死。',
  99:'HP 太低，或長期受傷、生病、飢餓，都可能讓夥伴瀕死，甚至消失。',100:'夥伴進化了！能力符合條件，或隨著時間成長，都可能進化。',101:'夥伴壽命耗盡就會消失；經歷至少十次戰鬥，則會轉生為培育蛋。',102:'夥伴轉生為培育蛋了！牠將繼承培育成果，再次成長。',
  103:'恭喜制霸所有頭銜賽！獲得免費通行券，可以免費前往狩獵。',105:'育成容量不足會阻擋進化。可以放生夥伴，騰出容量。',106:'長期缺乏照顧或沒有參與戰鬥，夥伴可能逃走，不再回來。',
  128:'表現得很好！也為你的夥伴準備了禮物。',129:'真是一場精彩的戰鬥！讓夥伴們一起分享勝利的喜悅，這是給牠們的獎勵。',130:'這次的表現比以往更出色！來舉辦勝利的宴席吧，恭喜你！',131:'恭喜！終於做到了！請收下我衷心準備的賀禮。',
  196:'{name} 好像找到了什麼！',197:'生日快樂！拿這些位元幣去買些喜歡的東西吧。',198:'生日快樂！也為你的夥伴準備了蛋糕。',199:'這顆培育蛋是送你的生日禮物，請好好培育牠。'};
// English lives beside it (raisingMessages.en.js, same IDs); the display
// language picks one. A player-given {name} is inserted as typed.
export function raisingMessageText(id, name) {
  const loc = getLocale();
  const table = RAISING_TABLES[loc];
  const value = id >= 13 && id <= 75 ? (table ? table.sequential[id - 13] : sequential[id - 13])
    : id >= 76 && id <= 91 ? (table ? table.seasons[id - 76] : seasons[id - 76])
    : id >= 186 && id <= 195 ? (table ? table.random[id - 186] : random[id - 186])
    : (table ? table.extra[id] : extra[id]);
  const defaultPartner = table?.defaultName ?? '夥伴';
  return (value ?? (id >= 13 && id <= 75 ? sequential[id - 13] : id >= 76 && id <= 91 ? seasons[id - 76] : id >= 186 && id <= 195 ? random[id - 186] : extra[id]))?.replace('{name}', name ?? defaultPartner) || null;
}
export const RAISING_MESSAGE_SENDERS = Object.freeze(['中央競技場', '大會會長', '大會會長', '資深馴獸師', '商店店長', '浩司', '惠子', '熱衷研究的馴獸師', '對戰王', '富有的大姊姊', '夥伴收藏家', '媽媽', '通知']);
export function raisingMessageSender(index) {
  const loc = getLocale();
  return (RAISING_TABLES[loc]?.senders[index]) ?? RAISING_MESSAGE_SENDERS[index] ?? '';
}
