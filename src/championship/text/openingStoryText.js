import {uiText} from './uiText.js';
import {getLocale} from './locale.js';
import {getOpeningBrandTerms} from './brandTerms.js';

// Only these four authored story paragraphs use the pending brand terms.
// Source strings remain translation keys; saved names and technical IDs are untouched.
const SOURCE = [
  '每四年舉辦一次的\n數碼獸冠軍賽。',
  '取得參賽資格，\n正是身為真正數碼獸馴獸師的證明。',
  '而今天，你也迎來了\n參加數碼獸冠軍賽的機會。\n\n奪下勝利吧！\n數碼獸冠軍賽！',
  '好像已經收到郵件了。'
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
  return (COPY[locale] ?? COPY['zh-Hant'])(getOpeningBrandTerms(locale))[index];
}
