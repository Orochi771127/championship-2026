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
  '請替數碼蛋取名字'
];
const COPY = {
  'zh-Hant': ({creature:c,tournament:t}) => [
    `每四年舉辦一次的\n${t}。`, `取得參賽資格，\n正是身為真正${c}馴獸師的證明。`,
    `而今天，你也迎來了\n參加${t}的機會。\n\n奪下勝利吧！\n${t}！`, '好像已經收到郵件了。'],
  en: ({creature:c,tournament:t}) => [
    `Once every four years comes\nthe ${t}.`, `Earning a place in it\nis the proof of a true ${c} tamer.`,
    `And today, your own chance\nto enter the ${t} has come.\n\nGo and win it!\nThe ${t}!`, 'Looks like some mail has arrived.'],
  ja: ({creature:c,tournament:t}) => [
    `4年に一度開催される\n${t}。`, `出場資格を得ることは、\n真の${c}テイマーである証。`,
    `そして今日、あなたにも\n${t}に出場するチャンスが訪れた。\n\n勝利をつかめ！\n${t}！`, 'どうやらメールが届いたようだ。'],
  th: ({creature:c,tournament:t}) => [
    `${t}\nจัดขึ้นทุกสี่ปี`, `การได้สิทธิ์เข้าร่วมการแข่งขัน\nคือเครื่องพิสูจน์การเป็นผู้ฝึก${c}ที่แท้จริง`,
    `และวันนี้ คุณเองก็ได้รับโอกาส\nเข้าร่วม${t}แล้ว\n\nคว้าชัยชนะมาให้ได้!\n${t}!`, 'ดูเหมือนจะมีจดหมายเข้ามาแล้ว'],
  vi: ({creature:c,tournament:t}) => [
    `${t}\nđược tổ chức bốn năm một lần.`, `Giành được quyền tham dự\nlà minh chứng của một huấn luyện viên ${c} thực thụ.`,
    `Và hôm nay, bạn cũng đã có cơ hội\ntham gia ${t}.\n\nHãy giành chiến thắng!\n${t}!`, 'Có vẻ như thư đã đến.']
};
export function openingStoryText(source) {
  const index = SOURCE.indexOf(source);
  if (index < 0) return uiText(source);
  const locale = getLocale();
  const terms=getOpeningBrandTerms(locale);
  if(index>=4)return (LETTER_COPY[locale]??LETTER_COPY['zh-Hant'])(terms)[index-4];
  return (COPY[locale] ?? COPY['zh-Hant'])(terms)[index];
}

// Owner 2026-10-12: the actual TITLE gift letters and naming label, before
// onStart creates a save. Exact authored keys only; never rewrite saved names.
const LETTER_COPY={
  'zh-Hant':({creature:c,egg:e})=>[
    `從現在起，你也是${c}馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。`,
    `這顆${e}送給你。\n請替牠取個名字。`,`請替${e}取名字`],
  en:({creature:c,egg:e})=>[
    `From today, you are a ${c} tamer too.\nTogether with your partner, aim to win the Championship!\nYour gift should arrive very soon.`,
    `This ${e} is for you.\nPlease give it a name.`,`Name your ${e}`],
  ja:({creature:c,egg:e})=>[
    `今日からあなたも${c}テイマーです。\n仲間と一緒にチャンピオンシップ優勝を目指しましょう！\nプレゼントはもうすぐ届きます。`,
    `この${e}をあなたに贈ります。\n名前を付けてください。`,`${e}に名前を付けてください`],
  th:({creature:c,egg:e})=>[
    `ตั้งแต่วันนี้ คุณก็เป็นผู้ฝึก${c}แล้ว\nร่วมมือกับคู่หูเพื่อคว้าแชมป์!\nของขวัญของคุณกำลังจะมาถึง`,
    `${e}ใบนี้มอบให้คุณ\nโปรดตั้งชื่อให้มันด้วย`,`ตั้งชื่อ${e}ของคุณ`],
  vi:({creature:c,egg:e})=>[
    `Từ hôm nay, bạn cũng là huấn luyện viên ${c}.\nHãy cùng đồng đội giành chức vô địch!\nMón quà của bạn sẽ sớm đến.`,
    `${e} này dành cho bạn.\nHãy đặt tên cho nó.`,`Đặt tên cho ${e} của bạn`]
};
