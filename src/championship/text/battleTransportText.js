// PRODUCT_AUTHORED display copy only. Never translate protocol identifiers,
// payload data, player names or approved species proper names.
import {getLocale} from './locale.js';

export const BATTLE_TRANSPORT_COPY=Object.freeze({
  'zh-Hant':Object.freeze({
    SPECIES_NOT_READY:'這隻新拍檔尚未開放登場參戰，敬請期待。',
    CATALOG_MISMATCH:'雙方遊戲版本不同步，請更新至相同版本後再連線切磋。',
    V2_INVITE_REQUIRED:'這支隊伍須使用 V2 通訊碼，請房主勾選「V2 邀請」後重新交換代碼。',
    V2_REQUIRED:'隊伍中含有新形態或血統資料，無法使用舊版對戰碼。',
    VERSION_MISMATCH:'通訊碼版本不相容，請雙方改用相同版本的代碼重新交換。',
    VALUES_UNSUPPORTED:'這組 V2 對戰碼的資料格式超出支援範圍，請確認雙方遊戲版本。',
    INVALID_CODE:'無法辨識這組 V2 對戰碼，請確認已完整複製後重新貼上。',
    PASSWORD_V2_NOTICE:'V2 專屬對戰碼：支援新拍檔與血統資料，須由新版遊戲讀取。',
    LINK_V2_NOTICE:'V2 連線邀請支援新拍檔登場，請雙方皆使用最新版本遊玩。',
    PASSWORD_INPUT_HINT:'支援經典短密碼與 CM26-PASSWORD-2 開頭的 V2 對戰碼，請完整貼上。',
    LINK_VERSION_HINT:'隊伍含新形態時將自動切換為 V2 通訊碼；若要邀請新形態參戰，請先勾選 V2 邀請。',
    CREATE_V2_INVITE:'建立 V2 邀請',
    CREATE_V2_INVITE_LABEL:'建立 V2 邀請（開放新形態拍檔參戰）',
    PASSWORD_SPECIES_NOT_READY:'這隻新拍檔尚未開放產生或讀取對戰碼，敬請期待。',
    PROFILE_UNAVAILABLE:'這隻拍檔的登錄檔案尚未完整。',
    EMPTY_TEAM:'這組密碼裡沒有可出戰的拍檔。'
  }),
  en:Object.freeze({
    SPECIES_NOT_READY:'This new partner has not entered tournament battles yet — stay tuned!',
    CATALOG_MISMATCH:'Game versions are out of sync. Update both devices to the same version to battle.',
    V2_INVITE_REQUIRED:'This squad requires a V2 link code. Have the host check "Create V2 invitation" and exchange codes again.',
    V2_REQUIRED:'This squad carries a new form or bloodline data and cannot use a classic battle code.',
    VERSION_MISMATCH:'Link code versions do not match. Exchange codes using the same version on both sides.',
    VALUES_UNSUPPORTED:'This V2 battle code contains values outside the supported range. Check both game versions.',
    INVALID_CODE:'Could not read this V2 battle code. Make sure you copied the full code and paste again.',
    PASSWORD_V2_NOTICE:'V2 Battle Code: supports new partners and bloodline data on updated game versions.',
    LINK_V2_NOTICE:'V2 Link Invitations support new partners when both players are on the latest version.',
    PASSWORD_INPUT_HINT:'Supports classic short passwords and V2 codes starting with CM26-PASSWORD-2. Paste the full code.',
    LINK_VERSION_HINT:'Squads with new forms switch to V2 codes automatically. To invite a new form, enable V2 invitation first.',
    CREATE_V2_INVITE:'Create V2 invitation',
    CREATE_V2_INVITE_LABEL:'Create V2 invitation (allows new partner forms)',
    PASSWORD_SPECIES_NOT_READY:'This new partner cannot generate or load battle codes yet — stay tuned!',
    PROFILE_UNAVAILABLE:'This partner’s registration profile is incomplete.',
    EMPTY_TEAM:'This code contains no battle-ready partners.'
  }),
  ja:Object.freeze({
    SPECIES_NOT_READY:'この新パートナーはまだ対戦に未対応です。今後の解禁をお楽しみに！',
    CATALOG_MISMATCH:'ゲームバージョンが一致していません。双方を同じ最新版へ更新してから対戦してください。',
    V2_INVITE_REQUIRED:'このチームには V2 通信コードが必要です。ホスト側で「V2 招待を作成」を選んで交換し直してください。',
    V2_REQUIRED:'新形態や血統データが含まれるため、旧式の対戦コードは使えません。',
    VERSION_MISMATCH:'コードのバージョンが合いません。同じバージョンのコードを交換し直してください。',
    VALUES_UNSUPPORTED:'この V2 対戦コードには未対応の値が含まれています。双方のバージョンをご確認ください。',
    INVALID_CODE:'V2 対戦コードを読み取れませんでした。全文をコピーして貼り付け直してください。',
    PASSWORD_V2_NOTICE:'V2 対戦コード：新パートナーと血統データに対応しています（最新版ゲームで読込可能）。',
    LINK_V2_NOTICE:'V2 通信招待は新パートナーに対応しています。双方とも最新版でお楽しみください。',
    PASSWORD_INPUT_HINT:'従来の短いパスワードと CM26-PASSWORD-2 で始まる V2 コードに対応。全文を貼り付けてください。',
    LINK_VERSION_HINT:'新形態を含むと自動で V2 コードになります。新形態を招待する際は先に V2 招待を選んでください。',
    CREATE_V2_INVITE:'V2 招待を作成',
    CREATE_V2_INVITE_LABEL:'V2 招待を作成（新形態パートナーの参戦を許可）',
    PASSWORD_SPECIES_NOT_READY:'この新パートナーはまだ対戦コードの作成・読込に未対応です。今後の解禁をお楽しみに！',
    PROFILE_UNAVAILABLE:'このパートナーの登録データがそろっていません。',
    EMPTY_TEAM:'このパスワードには出場できるパートナーがいません。'
  }),
  th:Object.freeze({
    SPECIES_NOT_READY:'พาร์ตเนอร์ร่างใหม่นี้ยังไม่เปิดให้ลงสนามประลอง โปรดรอติดตามเร็ว ๆ นี้!',
    CATALOG_MISMATCH:'เวอร์ชันเกมของทั้งสองฝ่ายไม่ตรงกัน โปรดอัปเดตเป็นเวอร์ชันเดียวกันก่อนท้าประลอง',
    V2_INVITE_REQUIRED:'ทีมนี้ต้องใช้รหัสเชื่อมต่อ V2 ให้หัวหน้าห้องเลือก “สร้างคำเชิญ V2” แล้วแลกรหัสกันใหม่',
    V2_REQUIRED:'ทีมนี้มีร่างใหม่หรือข้อมูลสายเลือด จึงไม่สามารถใช้รหัสต่อสู้แบบคลาสสิกได้',
    VERSION_MISMATCH:'เวอร์ชันของรหัสไม่เข้ากัน โปรดแลกเปลี่ยนรหัสเวอร์ชันเดียวกันทั้งสองฝ่าย',
    VALUES_UNSUPPORTED:'รหัสต่อสู้ V2 นี้มีข้อมูลเกินช่วงที่รองรับ โปรดตรวจสอบเวอร์ชันเกมของทั้งสองฝ่าย',
    INVALID_CODE:'อ่านรหัสต่อสู้ V2 ไม่ได้ โปรดคัดลอกรหัสให้ครบทุกตัวอักษรแล้ววางใหม่อีกครั้ง',
    PASSWORD_V2_NOTICE:'รหัสต่อสู้ V2: รองรับพาร์ตเนอร์ร่างใหม่และข้อมูลสายเลือดบนเกมเวอร์ชันล่าสุด',
    LINK_V2_NOTICE:'คำเชิญเชื่อมต่อ V2 รองรับพาร์ตเนอร์ร่างใหม่เมื่อทั้งสองฝ่ายใช้เกมเวอร์ชันล่าสุด',
    PASSWORD_INPUT_HINT:'รองรับทั้งรหัสสั้นแบบคลาสสิกและรหัส V2 ที่ขึ้นต้นด้วย CM26-PASSWORD-2 โปรดวางให้ครบถ้วน',
    LINK_VERSION_HINT:'ทีมที่มีร่างใหม่จะสลับเป็นรหัส V2 อัตโนมัติ หากต้องการเชิญร่างใหม่ให้ติ๊ก “สร้างคำเชิญ V2” ก่อน',
    CREATE_V2_INVITE:'สร้างคำเชิญ V2',
    CREATE_V2_INVITE_LABEL:'สร้างคำเชิญ V2 (เปิดรับพาร์ตเนอร์ร่างใหม่เข้าประลอง)',
    PASSWORD_SPECIES_NOT_READY:'พาร์ตเนอร์ร่างใหม่นี้ยังไม่เปิดให้สร้างหรือโหลดรหัสต่อสู้ โปรดรอติดตามเร็ว ๆ นี้!',
    PROFILE_UNAVAILABLE:'ข้อมูลลงทะเบียนของพาร์ตเนอร์ตัวนี้ยังไม่ครบถ้วน',
    EMPTY_TEAM:'รหัสนี้ไม่มีพาร์ตเนอร์ที่พร้อมลงสนาม'
  }),
  vi:Object.freeze({
    SPECIES_NOT_READY:'Bạn đồng hành dạng mới này chưa mở thi đấu — hãy chờ bản cập nhật tới nhé!',
    CATALOG_MISMATCH:'Phiên bản game hai bên chưa đồng bộ. Hãy cập nhật cùng phiên bản mới nhất trước khi so tài.',
    V2_INVITE_REQUIRED:'Đội này cần mã kết nối V2. Hãy nhờ chủ phòng chọn “Tạo lời mời V2” rồi trao đổi mã lại.',
    V2_REQUIRED:'Đội có dạng mới hoặc dữ liệu huyết thống nên không thể dùng mã đấu kiểu cổ điển.',
    VERSION_MISMATCH:'Phiên bản mã không tương thích. Hãy trao đổi lại mã cùng phiên bản ở cả hai bên.',
    VALUES_UNSUPPORTED:'Mã đấu V2 này chứa dữ liệu ngoài phạm vi hỗ trợ. Hãy kiểm tra phiên bản game của hai bên.',
    INVALID_CODE:'Không đọc được mã đấu V2 này. Hãy sao chép trọn vẹn mã rồi dán lại nhé.',
    PASSWORD_V2_NOTICE:'Mã đấu V2: hỗ trợ bạn đồng hành dạng mới và dữ liệu huyết thống trên phiên bản game mới nhất.',
    LINK_V2_NOTICE:'Lời mời kết nối V2 hỗ trợ bạn đồng hành dạng mới khi cả hai đều dùng phiên bản mới nhất.',
    PASSWORD_INPUT_HINT:'Hỗ trợ mật khẩu ngắn cổ điển và mã V2 bắt đầu bằng CM26-PASSWORD-2. Hãy dán trọn vẹn mã.',
    LINK_VERSION_HINT:'Đội có dạng mới sẽ tự chuyển sang mã V2. Để mời dạng mới, hãy chọn “Tạo lời mời V2” trước.',
    CREATE_V2_INVITE:'Tạo lời mời V2',
    CREATE_V2_INVITE_LABEL:'Tạo lời mời V2 (cho phép bạn đồng hành dạng mới ra sân)',
    PASSWORD_SPECIES_NOT_READY:'Bạn đồng hành dạng mới này chưa mở tạo hoặc tải mã đấu — hãy chờ nhé!',
    PROFILE_UNAVAILABLE:'Hồ sơ đăng ký của bạn đồng hành này chưa đầy đủ.',
    EMPTY_TEAM:'Mã này không có bạn đồng hành nào sẵn sàng ra sân.'
  })
});

// Resolve at display time, not module load, so settings changes take effect.
export function battleTransportText(key,locale=getLocale()){
  const value=BATTLE_TRANSPORT_COPY[locale]?.[key];
  if(typeof value!=='string')throw new RangeError(`BATTLE_TRANSPORT_COPY_UNKNOWN:${locale}:${key}`);
  return value;
}
