import {uiText} from './uiText.js';
import {getLocale} from './locale.js';
import {getOpeningBrandTerms} from './brandTerms.js';

// Only these authored story paragraphs and opening letters use the brand terms.
// Source strings remain translation keys; saved names and technical IDs are untouched.
const SOURCE = [
  '每四年舉辦一次的\n數碼獸冠軍賽。',
  '取得參賽資格，\n正是身為真正數碼獸馴獸師的證明。',
  '而今天，你也迎來了\n參加數碼獸冠軍賽的機會。\n\n奪下勝利吧！\n數碼獸冠軍賽！',
  '好像已經收到郵件了。',
  '從現在起，你也是數碼獸馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',
  '這顆數碼蛋送給你。\n請替牠取個名字。',
  '請替數碼蛋取名字',
  '每四年舉辦一次的\n拍檔錦標賽。',
  '取得參賽資格，\n正是身為真正拍檔馴獸師的證明。',
  '而今天，你也迎來了\n參加拍檔錦標賽的機會。\n\n奪下勝利吧！\n拍檔錦標賽！',
  '好像已經收到郵件了。',
  '從現在起，你也是拍檔馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',
  '這顆培育蛋送給你。\n請替牠取個名字。',
  '請替培育蛋取名字'
];
const COPY = {
  'zh-Hant': ({creature:c,tournament:t}) => [
    `每四年才燃起一次戰火的\n${t}。`, `親手握住入場資格的那一刻，\n才算是真正獨當一面的${c}馴獸師。`,
    `而今天，命運的入場券\n終於在你的螢幕前亮了起來。\n\n去奪下桂冠吧！\n${t}！`, '叮咚——信箱裡躺著一封新郵件。'],
  en: ({creature:c,tournament:t}) => [
    `Once every four years, the fires of\nthe ${t} ignite.`, `Holding that entry pass\nis the proof of a true ${c} tamer.`,
    `And today, your own ticket\nlights up before your eyes.\n\nGo seize the crown!\nThe ${t}!`, 'Ding! A new letter just landed in your inbox.'],
  ja: ({creature:c,tournament:t}) => [
    `四年に一度、熱戦の火ぶたが切られる\n${t}。`, `出場資格をその手につかむことこそ、\n一人前の${c}テイマーである証。`,
    `そして今日、運命の招待状が\nあなたの画面にともった。\n\n栄冠をつかみ取れ！\n${t}！`, 'ピコン――メールボックスに新着メールが届いている。'],
  th: ({creature:c,tournament:t}) => [
    `ทุกสี่ปี เปลวไฟแห่ง\n${t} จะลุกโชนขึ้นอีกครั้ง`, `การคว้าสิทธิ์และได้สิทธิ์เข้าร่วมการแข่งขัน\nคือเครื่องพิสูจน์ของผู้ฝึก${c}ตัวจริง`,
    `และวันนี้ บัตรเชิญแห่งโชคชะตา\nก็สว่างขึ้นตรงหน้าคุณแล้ว\n\nออกไปคว้ามงกุฎแชมป์กันเลย!\n${t}!`, 'ติ๊ง— มีจดหมายฉบับใหม่ส่งมาถึงกล่องข้อความแล้ว'],
  vi: ({creature:c,tournament:t}) => [
    `Bốn năm một lần, ngọn lửa của\n${t} lại bùng cháy.`, `Nắm chắc tấm vé và giành quyền tham dự\nchính là minh chứng của một huấn luyện viên ${c} thực thụ.`,
    `Và hôm nay, tấm vé định mệnh\nđã bừng sáng ngay trước mắt bạn.\n\nHãy đoạt lấy ngôi vương!\n${t}!`, 'Tinh— một bức thư mới vừa rơi vào hộp thư đến.']
};
export function openingStoryText(source) {
  const rawIndex = SOURCE.indexOf(source);
  if (rawIndex < 0) return uiText(source);
  const index = rawIndex % 7;
  const locale = getLocale();
  const terms=getOpeningBrandTerms(locale);
  if(index>=4)return (LETTER_COPY[locale]??LETTER_COPY['zh-Hant'])(terms)[index-4];
  return (COPY[locale] ?? COPY['zh-Hant'])(terms)[index];
}

// Owner 2026-10-12: the actual TITLE gift letters and naming label, before
// onStart creates a save. Exact authored keys only; never rewrite saved names.
const LETTER_COPY={
  'zh-Hant':({creature:c,egg:e})=>[
    `從今天起，你也是正式的${c}馴獸師了！\n和拍檔並肩作戰，向冠軍賽最高寶座衝刺吧！\n協會準備的見面禮應該馬上送到。`,
    `這顆${e}就交給你保管囉！\n快幫裡頭的小傢伙取個響亮的名字吧。`,`幫${e}取個名字`],
  en:({creature:c,egg:e})=>[
    `Welcome aboard — from today on, you're an official ${c} tamer!\nTeam up with your partner and charge for the Championship crown!\nYour Association welcome gift should arrive any moment now.`,
    `This ${e} is in your care now!\nGive the little one inside a name to remember.`,`Name your ${e}`],
  ja:({creature:c,egg:e})=>[
    `今日からあなたも正式な${c}テイマーだよ！\nパートナーと力を合わせて、チャンピオンシップの頂点を目指そう！\n協会からのウェルカムギフトも、もうすぐ届くはず。`,
    `この${e}をあなたに預けるね！\n中にいる小さな相棒に、ステキな名前を付けてあげよう。`,`${e}に名前を付けよう`],
  th:({creature:c,egg:e})=>[
    `ยินดีต้อนรับ! ตั้งแต่วันนี้ คุณคือผู้ฝึก${c}อย่างเป็นทางการแล้ว!\nจับมือคู่หูแล้วพุ่งทะยานสู่บัลลังก์แชมเปียนชิปกันเลย!\nของขวัญต้อนรับจากสมาคมกำลังจะส่งถึงมือเร็ว ๆ นี้`,
    `ขอฝาก${e}ใบนี้ไว้ในความดูแลของคุณนะ!\nตั้งชื่อเท่ ๆ ให้เจ้าตัวน้อยข้างในกันเลย`,`ตั้งชื่อให้${e}`],
  vi:({creature:c,egg:e})=>[
    `Chào mừng gia nhập! Từ hôm nay bạn đã là huấn luyện viên ${c} chính thức!\nHãy kề vai cùng bạn đồng hành tiến thẳng tới ngôi vô địch!\nMón quà chào sân từ Hiệp hội sẽ tới tay bạn ngay thôi.`,
    `Quả ${e} này giao lại cho bạn chăm sóc nhé!\nHãy đặt cho nhóc con bên trong một cái tên thật vang dội nào.`,`Đặt tên cho ${e}`]
};
