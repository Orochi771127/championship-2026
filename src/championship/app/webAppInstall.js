import {getLocale, onLocaleChange} from '../text/locale.js';

export const WEB_APP_INSTALL_COPY = {
  'zh-Hant': ['加入主畫面', 'iPhone：在 Safari 點「分享」→「加入主畫面」，開啟「作為網頁 App 打開」（若有此選項）。之後從主畫面進入，即可隱藏瀏覽器網址列。請先在設定匯出存檔備份；主畫面 App 的存檔可能與 Safari 分開。', '關閉'],
  en: ['Add to Home Screen', 'On iPhone, open Safari → Share → Add to Home Screen. Turn on Open as Web App if offered, then launch from the Home Screen to hide the browser bar. Export a save backup in Settings first; the installed app may have separate storage.', 'Close'],
  ja: ['ホーム画面に追加', 'iPhone の Safari で「共有」→「ホーム画面に追加」を選び、「Webアプリとして開く」があれば有効にします。ホーム画面から起動するとアドレスバーを非表示にできます。先に設定でセーブをエクスポートしてください。保存領域が Safari と別になる場合があります。', '閉じる'],
  th: ['เพิ่มไปยังหน้าจอโฮม', 'บน iPhone เปิด Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม และเปิด Open as Web App หากมี จากนั้นเปิดจากหน้าจอโฮมเพื่อซ่อนแถบที่อยู่ โปรดส่งออกไฟล์บันทึกสำรองในตั้งค่าก่อน เพราะแอปอาจใช้พื้นที่บันทึกแยกจาก Safari', 'ปิด'],
  vi: ['Thêm vào Màn hình chính', 'Trên iPhone, mở Safari → Chia sẻ → Thêm vào Màn hình chính. Bật Mở dưới dạng ứng dụng web nếu có, rồi mở từ Màn hình chính để ẩn thanh địa chỉ. Hãy xuất bản sao lưu trong Cài đặt trước; ứng dụng có thể dùng bộ nhớ riêng với Safari.', 'Đóng']
};

export function isInstalledWebApp(view = globalThis.window) {
  return view?.navigator?.standalone === true || Boolean(view?.matchMedia?.('(display-mode: standalone)').matches)
    || Boolean(view?.matchMedia?.('(display-mode: fullscreen)').matches);
}

// A title-only help control, not a second install/save or navigation authority.
export function mountWebAppInstall(title, view = globalThis.window) {
  if (!title || isInstalledWebApp(view)) return () => {};
  const nav = view.navigator;
  if (!/iPhone|iPad|iPod/.test(nav.userAgent) && !(nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return () => {};
  const doc = title.ownerDocument, lifetime = new AbortController();
  const trigger = doc.createElement('button'), dialog = doc.createElement('dialog');
  trigger.type = 'button'; trigger.className = 'cm-title__install';
  trigger.setAttribute('aria-haspopup', 'dialog');
  dialog.className = 'cm-install';
  const heading = doc.createElement('h2'), message = doc.createElement('p'), close = doc.createElement('button');
  heading.id = 'cm-install-heading'; dialog.setAttribute('aria-labelledby', heading.id);
  close.type = 'button'; dialog.append(heading, message, close);
  title.querySelector('.cm-title__controls')?.append(trigger);
  title.append(dialog);
  const relabel = () => { const copy = WEB_APP_INSTALL_COPY[getLocale()] ?? WEB_APP_INSTALL_COPY.en; trigger.textContent = heading.textContent = copy[0]; message.textContent = copy[1]; close.textContent = copy[2]; };
  relabel(); const unsubscribe = onLocaleChange(relabel);
  trigger.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); }, {signal:lifetime.signal});
  close.addEventListener('click', () => dialog.close(), {signal:lifetime.signal});
  dialog.addEventListener('close', () => { if (!title.hidden) trigger.focus({preventScroll:true}); }, {signal:lifetime.signal});
  // An install/orientation change can update display-mode without a reload.
  const display = view.matchMedia?.('(display-mode: standalone)');
  const update = () => { trigger.hidden = isInstalledWebApp(view); if (trigger.hidden && dialog.open) dialog.close(); };
  display?.addEventListener('change', update, {signal:lifetime.signal});
  return () => { lifetime.abort(); unsubscribe(); dialog.remove(); trigger.remove(); };
}
