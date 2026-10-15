import {getLocale} from '../../text/locale.js';

// PRODUCT_AUTHORED display guidance, not original-game behavior or award rules.
export const MEDAL_PRESENTATION_COPY = Object.freeze({
  'zh-Hant': Object.freeze({controls:'拖曳旋轉，或使用方向鍵；Home 鍵重設。', reset:'重設角度', fallback:'靜態徽章顯示', loading:'正在準備立體展示…', locked:'未取得 · 平面圖樣'}),
  en: Object.freeze({controls:'Drag or use arrow keys to rotate. Press Home to reset.', reset:'Reset angle', fallback:'Static badge display', loading:'Preparing 3D display…', locked:'Not acquired · flat artwork'}),
  ja: Object.freeze({controls:'ドラッグまたは矢印キーで回転。Home キーで角度をリセット。', reset:'角度をリセット', fallback:'徽章の静止表示', loading:'立体表示を準備中…', locked:'未獲得 · 平面画像'}),
  th: Object.freeze({controls:'ลากหรือใช้ปุ่มลูกศรเพื่อหมุน กด Home เพื่อรีเซ็ต', reset:'รีเซ็ตมุมมอง', fallback:'แสดงภาพเหรียญแบบนิ่ง', loading:'กำลังเตรียมการแสดงผล 3 มิติ…', locked:'ยังไม่ได้รับ · ภาพแบน'}),
  vi: Object.freeze({controls:'Kéo hoặc dùng phím mũi tên để xoay. Nhấn Home để đặt lại.', reset:'Đặt lại góc nhìn', fallback:'Hiển thị huy hiệu tĩnh', loading:'Đang chuẩn bị hiển thị 3D…', locked:'Chưa nhận · Hình phẳng'})
});
export function medalPresentationText(key, locale=getLocale()) {
  return (MEDAL_PRESENTATION_COPY[locale] ?? MEDAL_PRESENTATION_COPY['zh-Hant'])[key] ?? '';
}
export const MEDAL_PRESENTATION_COPY_KEYS = Object.freeze(Object.keys(MEDAL_PRESENTATION_COPY['zh-Hant']));
