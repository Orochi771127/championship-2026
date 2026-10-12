// Explicit five-language presentation copy, following openingEggText.
const COPY=Object.freeze({
  'zh-Hant':['觀看片頭','略過片頭','開啟聲音','關閉聲音','設定為靜音','片頭載入中…'],
  en:['Watch intro','Skip intro','Enable sound','Mute intro','Muted in settings','Loading intro…'],
  ja:['オープニングを見る','スキップ','音声をオン','音声をオフ','設定で消音中','読み込み中…'],
  th:['ชมวิดีโอเปิดเรื่อง','ข้ามวิดีโอ','เปิดเสียง','ปิดเสียง','ปิดเสียงในการตั้งค่า','กำลังโหลดวิดีโอ…'],
  vi:['Xem mở đầu','Bỏ qua mở đầu','Bật âm thanh','Tắt âm thanh','Đã tắt tiếng trong cài đặt','Đang tải mở đầu…']
});
export function openingFilmCopy(locale){return COPY[locale]??COPY['zh-Hant'];}
