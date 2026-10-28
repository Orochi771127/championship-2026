// PRODUCT_AUTHORED social copy (Owner 2026-10-29): the community link dock and
// the tamer brag card (canvas labels, preview, share and invite text).
// Display-only; registered as a scoped dictionary in scripts/check-locale-coverage.mjs.
import { getLocale } from "./locale.js";

export const SOCIAL_COPY = Object.freeze({
  "zh-Hant": Object.freeze({
    dockTitle: "🌐 拍檔社群連結塢", dockHint: "加入官方社群：找對手、交換好友碼、搶先看消息。",
    discord: "Discord 官方社群", discordSub: "即時聊天・揪團對戰", facebook: "Facebook 粉絲專頁／社團", facebookSub: "活動公告・玩家社團",
    x: "X / Threads 官方動態", xSub: "最新消息・開發花絮", bahamut: "巴哈姆特討論區", bahamutSub: "攻略心得・交流討論",
    soon: "即將開放", soonNotice: "{name} 連結即將公布，敬請期待！", newTab: "在新分頁開啟，遊戲不會中斷",
    bragButton: "📸 生成炫耀名片（分享至 FB / Discord）", previewTitle: "📸 全息名片預覽", working: "合成名片中…", failed: "名片合成失敗：{reason}",
    saveTip: "📱 手機：長按圖片 ➔「加入照片」就能存到相簿", shareSystem: "📤 呼叫系統分享（LINE / FB / Discord / 相簿）",
    download: "💾 下載名片 PNG", copyInvite: "📋 複製邀請文案＋好友碼", shareUnsupported: "這個瀏覽器不支援系統分享，請長按圖片或下載。",
    shareDone: "已開啟分享選單。", shareCancelled: "已取消分享。", downloaded: "名片已下載。", inviteCopied: "邀請文案已複製，貼到 Discord 或巴哈姆特吧！",
    copyManual: "無法自動複製，請長按下方文字手動複製。", landscape: "🖼️ 橫式", portrait: "📱 直式", done: "完成", imageAlt: "{name} 的馴獸師炫耀名片",
    inviteText: "我在《{title}》養拍檔、打錦標賽！加我好友：{code}{room}\n一起來玩 ▶ {url}", inviteRoom: "｜⚔️ 對戰房號：{room}", shareTitle: "{name} 的馴獸師名片",
    cardTamer: "馴獸師", cardRank: "階級", cardLicense: "育成執照", cardWinRate: "勝率", cardBattles: "對戰次數", cardDex: "圖鑑完成度", cardBits: "持有位元幣",
    cardFriendCode: "👥 好友邀請碼", cardRoomCode: "⚔️ 對戰房號", cardPlay: "▶ 立即遊玩", cardAce: "王牌拍檔", cardWinner: "勝利拍檔", cardVictory: "對戰勝利",
    cardNoPartner: "拍檔培育中", cardTamerFallback: "無名馴獸師", attr0: "無屬性", attr1: "疫苗", attr2: "病毒", attr3: "資料", attr4: "自由"
  }),
  en: Object.freeze({
    dockTitle: "🌐 Partner community dock", dockHint: "Join the official community: find rivals, swap friend codes, get news first.",
    discord: "Discord community", discordSub: "Live chat · team-ups", facebook: "Facebook page / group", facebookSub: "Events · player group",
    x: "X / Threads updates", xSub: "News · dev notes", bahamut: "Bahamut forum", bahamutSub: "Guides · discussion",
    soon: "Coming soon", soonNotice: "The {name} link is coming soon — stay tuned!", newTab: "Opens in a new tab; the game keeps running",
    bragButton: "📸 Make a brag card (share to FB / Discord)", previewTitle: "📸 Holo card preview", working: "Composing your card…", failed: "Card failed: {reason}",
    saveTip: "📱 Phone: press and hold the image ➔ Add to Photos to save it", shareSystem: "📤 System share (LINE / FB / Discord / Photos)",
    download: "💾 Download card PNG", copyInvite: "📋 Copy invite text + friend code", shareUnsupported: "This browser cannot share files; press and hold the image or download it.",
    shareDone: "Share sheet opened.", shareCancelled: "Sharing cancelled.", downloaded: "Card downloaded.", inviteCopied: "Invite text copied — paste it into Discord or Bahamut!",
    copyManual: "Could not copy automatically; press and hold the text below to copy it.", landscape: "🖼️ Landscape", portrait: "📱 Portrait", done: "Done", imageAlt: "{name}'s tamer brag card",
    inviteText: "I'm raising partners in {title}! Add me as a friend: {code}{room}\nCome play ▶ {url}", inviteRoom: " | ⚔️ Battle room: {room}", shareTitle: "{name}'s tamer card",
    cardTamer: "Tamer", cardRank: "Rank", cardLicense: "Raising licence", cardWinRate: "Win rate", cardBattles: "Battles", cardDex: "Dex", cardBits: "Bits",
    cardFriendCode: "👥 Friend code", cardRoomCode: "⚔️ Battle room", cardPlay: "▶ Play now", cardAce: "Ace partner", cardWinner: "Winning partner", cardVictory: "Battle won",
    cardNoPartner: "Partner in training", cardTamerFallback: "Nameless tamer", attr0: "No attribute", attr1: "Vaccine", attr2: "Virus", attr3: "Data", attr4: "Free"
  }),
  ja: Object.freeze({
    dockTitle: "🌐 パートナーコミュニティドック", dockHint: "公式コミュニティに参加：対戦相手探し、フレンドコード交換、最新情報をいち早く。",
    discord: "Discord 公式コミュニティ", discordSub: "リアルタイムチャット・対戦募集", facebook: "Facebook ページ／グループ", facebookSub: "イベント告知・プレイヤーグループ",
    x: "X / Threads 公式アカウント", xSub: "最新情報・開発こぼれ話", bahamut: "巴哈姆特掲示板", bahamutSub: "攻略・交流",
    soon: "近日公開", soonNotice: "{name} のリンクは近日公開です。お楽しみに！", newTab: "新しいタブで開きます。ゲームは中断しません",
    bragButton: "📸 自慢カードを作る（FB / Discord に共有）", previewTitle: "📸 ホログラムカードプレビュー", working: "カードを合成中…", failed: "カードの合成に失敗：{reason}",
    saveTip: "📱 スマホ：画像を長押し ➔「写真に追加」で保存できます", shareSystem: "📤 システム共有（LINE / FB / Discord / 写真）",
    download: "💾 カード PNG をダウンロード", copyInvite: "📋 招待文＋フレンドコードをコピー", shareUnsupported: "このブラウザはファイル共有に対応していません。画像を長押しするかダウンロードしてください。",
    shareDone: "共有メニューを開きました。", shareCancelled: "共有を取り消しました。", downloaded: "カードをダウンロードしました。", inviteCopied: "招待文をコピーしました。Discord や巴哈姆特に貼り付けよう！",
    copyManual: "自動コピーできませんでした。下の文字を長押ししてコピーしてください。", landscape: "🖼️ 横長", portrait: "📱 縦長", done: "完了", imageAlt: "{name} のテイマー自慢カード",
    inviteText: "『{title}』でパートナーを育てて大会に挑戦中！フレンド登録してね：{code}{room}\n一緒に遊ぼう ▶ {url}", inviteRoom: "｜⚔️ 対戦ルーム：{room}", shareTitle: "{name} のテイマーカード",
    cardTamer: "テイマー", cardRank: "ランク", cardLicense: "育成ライセンス", cardWinRate: "勝率", cardBattles: "対戦数", cardDex: "図鑑完成度", cardBits: "所持ビット",
    cardFriendCode: "👥 フレンドコード", cardRoomCode: "⚔️ 対戦ルーム", cardPlay: "▶ 今すぐプレイ", cardAce: "エースパートナー", cardWinner: "勝利パートナー", cardVictory: "対戦勝利",
    cardNoPartner: "パートナー育成中", cardTamerFallback: "名無しのテイマー", attr0: "属性なし", attr1: "ワクチン", attr2: "ウイルス", attr3: "データ", attr4: "フリー"
  }),
  th: Object.freeze({
    dockTitle: "🌐 ท่าเรือชุมชนพาร์ทเนอร์", dockHint: "เข้าร่วมชุมชนทางการ: หาคู่ต่อสู้ แลกรหัสเพื่อน รับข่าวก่อนใคร",
    discord: "ชุมชน Discord ทางการ", discordSub: "แชตสด・ชวนกันสู้", facebook: "เพจ／กลุ่ม Facebook", facebookSub: "ประกาศกิจกรรม・กลุ่มผู้เล่น",
    x: "อัปเดตทาง X / Threads", xSub: "ข่าวล่าสุด・เบื้องหลังการพัฒนา", bahamut: "บอร์ด Bahamut", bahamutSub: "คู่มือ・พูดคุย",
    soon: "เร็ว ๆ นี้", soonNotice: "ลิงก์ {name} จะประกาศเร็ว ๆ นี้ รอติดตามนะ!", newTab: "เปิดในแท็บใหม่ เกมไม่หยุด",
    bragButton: "📸 สร้างนามบัตรอวด (แชร์ไป FB / Discord)", previewTitle: "📸 ตัวอย่างนามบัตรโฮโลแกรม", working: "กำลังสร้างนามบัตร…", failed: "สร้างนามบัตรไม่สำเร็จ: {reason}",
    saveTip: "📱 มือถือ: กดค้างที่รูป ➔ “เพิ่มไปยังรูปภาพ” เพื่อบันทึก", shareSystem: "📤 แชร์ผ่านระบบ (LINE / FB / Discord / รูปภาพ)",
    download: "💾 ดาวน์โหลดนามบัตร PNG", copyInvite: "📋 คัดลอกข้อความชวน + รหัสเพื่อน", shareUnsupported: "เบราว์เซอร์นี้แชร์ไฟล์ไม่ได้ กดค้างที่รูปหรือดาวน์โหลดแทน",
    shareDone: "เปิดเมนูแชร์แล้ว", shareCancelled: "ยกเลิกการแชร์แล้ว", downloaded: "ดาวน์โหลดนามบัตรแล้ว", inviteCopied: "คัดลอกข้อความชวนแล้ว วางใน Discord หรือ Bahamut ได้เลย!",
    copyManual: "คัดลอกอัตโนมัติไม่ได้ กดค้างที่ข้อความด้านล่างเพื่อคัดลอกเอง", landscape: "🖼️ แนวนอน", portrait: "📱 แนวตั้ง", done: "เสร็จ", imageAlt: "นามบัตรอวดเทมเมอร์ของ {name}",
    inviteText: "ฉันกำลังเลี้ยงพาร์ทเนอร์ใน {title}! เพิ่มเพื่อนกันนะ: {code}{room}\nมาเล่นด้วยกัน ▶ {url}", inviteRoom: " | ⚔️ ห้องต่อสู้: {room}", shareTitle: "นามบัตรเทมเมอร์ของ {name}",
    cardTamer: "เทมเมอร์", cardRank: "ระดับ", cardLicense: "ใบอนุญาตเลี้ยง", cardWinRate: "อัตราชนะ", cardBattles: "จำนวนการต่อสู้", cardDex: "สมุดภาพ", cardBits: "บิตที่มี",
    cardFriendCode: "👥 รหัสเพื่อน", cardRoomCode: "⚔️ ห้องต่อสู้", cardPlay: "▶ เล่นเลย", cardAce: "พาร์ทเนอร์ตัวเอก", cardWinner: "พาร์ทเนอร์ผู้ชนะ", cardVictory: "ชนะการต่อสู้",
    cardNoPartner: "พาร์ทเนอร์กำลังฝึก", cardTamerFallback: "เทมเมอร์นิรนาม", attr0: "ไม่มีคุณสมบัติ", attr1: "วัคซีน", attr2: "ไวรัส", attr3: "ข้อมูล", attr4: "อิสระ"
  }),
  vi: Object.freeze({
    dockTitle: "🌐 Bến cộng đồng bạn đồng hành", dockHint: "Tham gia cộng đồng chính thức: tìm đối thủ, đổi mã bạn bè, xem tin sớm nhất.",
    discord: "Cộng đồng Discord", discordSub: "Trò chuyện・rủ đấu", facebook: "Trang／nhóm Facebook", facebookSub: "Sự kiện・nhóm người chơi",
    x: "Tin X / Threads", xSub: "Tin mới・hậu trường phát triển", bahamut: "Diễn đàn Bahamut", bahamutSub: "Hướng dẫn・thảo luận",
    soon: "Sắp ra mắt", soonNotice: "Liên kết {name} sắp được công bố, hãy chờ nhé!", newTab: "Mở ở thẻ mới; trò chơi không bị gián đoạn",
    bragButton: "📸 Tạo thẻ khoe (chia sẻ lên FB / Discord)", previewTitle: "📸 Xem trước thẻ hologram", working: "Đang ghép thẻ…", failed: "Ghép thẻ thất bại: {reason}",
    saveTip: "📱 Điện thoại: nhấn giữ ảnh ➔ “Thêm vào Ảnh” để lưu", shareSystem: "📤 Chia sẻ hệ thống (LINE / FB / Discord / Ảnh)",
    download: "💾 Tải thẻ PNG", copyInvite: "📋 Sao chép lời mời + mã bạn bè", shareUnsupported: "Trình duyệt này không chia sẻ được tệp; hãy nhấn giữ ảnh hoặc tải xuống.",
    shareDone: "Đã mở bảng chia sẻ.", shareCancelled: "Đã hủy chia sẻ.", downloaded: "Đã tải thẻ.", inviteCopied: "Đã sao chép lời mời — dán vào Discord hoặc Bahamut nhé!",
    copyManual: "Không sao chép tự động được; hãy nhấn giữ chữ bên dưới để sao chép.", landscape: "🖼️ Ngang", portrait: "📱 Dọc", done: "Xong", imageAlt: "Thẻ khoe tamer của {name}",
    inviteText: "Mình đang nuôi bạn đồng hành trong {title}! Kết bạn nhé: {code}{room}\nCùng chơi ▶ {url}", inviteRoom: " | ⚔️ Phòng đấu: {room}", shareTitle: "Thẻ tamer của {name}",
    cardTamer: "Tamer", cardRank: "Hạng", cardLicense: "Giấy phép nuôi", cardWinRate: "Tỉ lệ thắng", cardBattles: "Số trận", cardDex: "Bách khoa", cardBits: "Bit đang có",
    cardFriendCode: "👥 Mã bạn bè", cardRoomCode: "⚔️ Phòng đấu", cardPlay: "▶ Chơi ngay", cardAce: "Bạn đồng hành át chủ bài", cardWinner: "Bạn đồng hành thắng trận", cardVictory: "Thắng trận",
    cardNoPartner: "Bạn đồng hành đang luyện", cardTamerFallback: "Tamer vô danh", attr0: "Không thuộc tính", attr1: "Vắc-xin", attr2: "Vi-rút", attr3: "Dữ liệu", attr4: "Tự do"
  })
});

export function socialText(key, params = {}, locale = getLocale()) {
  const table = SOCIAL_COPY[locale] ?? SOCIAL_COPY["zh-Hant"];
  const text = table[key] ?? SOCIAL_COPY["zh-Hant"][key] ?? key;
  return String(text).replace(/\{([A-Za-z0-9_]+)\}/g, (_, name) => (params[name] === undefined || params[name] === null ? "" : String(params[name])));
}
