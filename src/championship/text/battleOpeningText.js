import {getLocale} from './locale.js';
// Display-only adaptation, shared by Pixi and the existing DOM field overlay.
const COPY = Object.freeze({
  'zh-Hant':{READY:'準備！',FIGHT:'開戰！'},
  en:{READY:'READY!',FIGHT:'FIGHT!'},
  ja:{READY:'準備！',FIGHT:'開始！'},
  th:{READY:'พร้อม!',FIGHT:'เริ่ม!'},
  vi:{READY:'SẴN SÀNG!',FIGHT:'BẮT ĐẦU!'}
});
export function battleOpeningText(cue, locale = getLocale()) {
  return COPY[locale]?.[cue] ?? COPY['zh-Hant'][cue] ?? '';
}
