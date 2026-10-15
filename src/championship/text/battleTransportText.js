// PRODUCT_AUTHORED display copy only. Never translate protocol identifiers,
// payload data, player names or approved species proper names.
import {getLocale} from './locale.js';

export const BATTLE_TRANSPORT_COPY=Object.freeze({
  'zh-Hant':Object.freeze({
    SPECIES_NOT_READY:'這個新形態尚未完成素材與連線驗收，暫時不能參戰。',
    CATALOG_MISMATCH:'角色目錄版本不一致，請雙方使用支援相同角色目錄的新遊戲版本。',
    V2_INVITE_REQUIRED:'此隊伍需要第 2 版通訊碼，請主機勾選第 2 版邀請後重新交換。',
    V2_REQUIRED:'此隊伍含新形態或相關血統資料，不能使用舊版對戰碼。',
    VERSION_MISMATCH:'對戰碼版本不支援，或邀請與回覆版本不一致，請重新交換相同版本的通訊碼。',
    VALUES_UNSUPPORTED:'第 2 版對戰碼的數值超出支援範圍，請確認來源版本。',
    INVALID_CODE:'第 2 版對戰碼無法辨識或校驗失敗，請完整複製後重新貼上。',
    PASSWORD_V2_NOTICE:'第 2 版原創形態對戰碼：需要支援角色目錄第 1 版的新遊戲版本，舊版無法使用。',
    LINK_V2_NOTICE:'第 2 版連線邀請與回覆需要支援相同角色目錄版本的新遊戲版本；舊版邀請不能加入新形態。',
    PASSWORD_INPUT_HINT:'支援原本的短密碼與 CM26-PASSWORD-2 開頭的新對戰碼，請完整複製貼上。',
    LINK_VERSION_HINT:'新形態會自動使用第 2 版通訊碼；原有隊伍若要邀請新形態，請先勾選第 2 版邀請。',
    CREATE_V2_INVITE:'建立第 2 版邀請',
    CREATE_V2_INVITE_LABEL:'建立第 2 版邀請（讓支援的新形態加入）',
    PASSWORD_SPECIES_NOT_READY:'這個新形態尚未通過素材與連線驗收，暫時不能產生或使用對戰碼。',
    PROFILE_UNAVAILABLE:'這隻拍檔的個體資料尚未完整。',
    EMPTY_TEAM:'密碼中沒有可參戰的拍檔。'
  }),
  en:Object.freeze({
    SPECIES_NOT_READY:'This new form has not passed asset and link checks and cannot battle yet.',
    CATALOG_MISMATCH:'The species catalog versions do not match. Both players need game builds that support the same catalog.',
    V2_INVITE_REQUIRED:'This team needs a version 2 link code. Ask the host to select a version 2 invitation and exchange codes again.',
    V2_REQUIRED:'This team includes a new form or its ancestry data and cannot use a legacy battle code.',
    VERSION_MISMATCH:'The code version is unsupported, or the invitation and reply versions differ. Exchange matching-version codes again.',
    VALUES_UNSUPPORTED:'Values in this version 2 battle code are outside the supported range. Check the originating game version.',
    INVALID_CODE:'This version 2 battle code is unrecognized or failed its integrity check. Copy and paste the complete code again.',
    PASSWORD_V2_NOTICE:'Version 2 original-form battle code: requires a new game build supporting species catalog revision 1. Older builds cannot use it.',
    LINK_V2_NOTICE:'Version 2 link invitations and replies require new game builds supporting the same species catalog. Legacy invitations cannot accept new forms.',
    PASSWORD_INPUT_HINT:'Original short passwords and new codes beginning with CM26-PASSWORD-2 are supported. Copy and paste the entire code.',
    LINK_VERSION_HINT:'New forms use version 2 codes automatically. To invite a new form with an existing team, select a version 2 invitation first.',
    CREATE_V2_INVITE:'Create a version 2 invitation',
    CREATE_V2_INVITE_LABEL:'Create a version 2 invitation (allow supported new forms to join)',
    PASSWORD_SPECIES_NOT_READY:'This new form has not passed asset and link checks and cannot generate or use battle codes yet.',
    PROFILE_UNAVAILABLE:'This partner’s individual data is incomplete.',
    EMPTY_TEAM:'This password contains no partners able to battle.'
  }),
  ja:Object.freeze({
    SPECIES_NOT_READY:'この新形態は素材と通信の確認が完了していないため、まだ対戦できません。',
    CATALOG_MISMATCH:'種族カタログのバージョンが一致しません。双方が同じカタログに対応した新しいゲーム版を使用してください。',
    V2_INVITE_REQUIRED:'このチームにはバージョン 2 の通信コードが必要です。ホストがバージョン 2 の招待を選び、コードを交換し直してください。',
    V2_REQUIRED:'このチームには新形態またはその血統データが含まれるため、旧形式の対戦コードは使用できません。',
    VERSION_MISMATCH:'未対応のコードバージョン、または招待と返信のバージョン不一致です。同じバージョンのコードを交換し直してください。',
    VALUES_UNSUPPORTED:'バージョン 2 の対戦コードに対応範囲外の数値があります。作成元のゲームバージョンを確認してください。',
    INVALID_CODE:'バージョン 2 の対戦コードを認識できないか、整合性の確認に失敗しました。コード全体をコピーして貼り付け直してください。',
    PASSWORD_V2_NOTICE:'オリジナル形態用バージョン 2 対戦コード：種族カタログ改訂 1 に対応した新しいゲーム版が必要です。旧版では使用できません。',
    LINK_V2_NOTICE:'バージョン 2 の招待と返信には、同じ種族カタログに対応した新しいゲーム版が必要です。旧形式の招待には新形態で参加できません。',
    PASSWORD_INPUT_HINT:'従来の短いパスワードと CM26-PASSWORD-2 で始まる新しい対戦コードに対応しています。コード全体をコピーして貼り付けてください。',
    LINK_VERSION_HINT:'新形態は自動的にバージョン 2 の通信コードを使用します。従来のチームで新形態を招待する場合は、先にバージョン 2 の招待を選んでください。',
    CREATE_V2_INVITE:'バージョン 2 の招待を作成',
    CREATE_V2_INVITE_LABEL:'バージョン 2 の招待を作成（対応する新形態が参加可能）',
    PASSWORD_SPECIES_NOT_READY:'この新形態は素材と通信の確認が完了していないため、まだ対戦コードを作成・使用できません。',
    PROFILE_UNAVAILABLE:'このパートナーの個体データが不完全です。',
    EMPTY_TEAM:'このパスワードには対戦できるパートナーがいません。'
  }),
  th:Object.freeze({
    SPECIES_NOT_READY:'ร่างใหม่นี้ยังไม่ผ่านการตรวจสอบไฟล์ภาพและการเชื่อมต่อ จึงยังเข้าต่อสู้ไม่ได้',
    CATALOG_MISMATCH:'เวอร์ชันแค็ตตาล็อกสายพันธุ์ไม่ตรงกัน ผู้เล่นทั้งสองต้องใช้เกมรุ่นใหม่ที่รองรับแค็ตตาล็อกเดียวกัน',
    V2_INVITE_REQUIRED:'ทีมนี้ต้องใช้รหัสเชื่อมต่อเวอร์ชัน 2 ให้เจ้าบ้านเลือกคำเชิญเวอร์ชัน 2 แล้วแลกเปลี่ยนรหัสใหม่',
    V2_REQUIRED:'ทีมนี้มีร่างใหม่หรือข้อมูลสายเลือดของร่างใหม่ จึงใช้รหัสต่อสู้แบบเดิมไม่ได้',
    VERSION_MISMATCH:'ไม่รองรับเวอร์ชันของรหัส หรือเวอร์ชันคำเชิญกับคำตอบไม่ตรงกัน โปรดแลกเปลี่ยนรหัสเวอร์ชันเดียวกันอีกครั้ง',
    VALUES_UNSUPPORTED:'รหัสต่อสู้เวอร์ชัน 2 นี้มีค่าที่อยู่นอกช่วงที่รองรับ โปรดตรวจสอบเวอร์ชันเกมที่สร้างรหัส',
    INVALID_CODE:'ไม่รู้จักรหัสต่อสู้เวอร์ชัน 2 นี้ หรือการตรวจสอบความถูกต้องล้มเหลว โปรดคัดลอกและวางรหัสทั้งหมดอีกครั้ง',
    PASSWORD_V2_NOTICE:'รหัสต่อสู้ร่างออริจินัลเวอร์ชัน 2: ต้องใช้เกมรุ่นใหม่ที่รองรับแค็ตตาล็อกสายพันธุ์ฉบับที่ 1 เกมรุ่นเก่าใช้รหัสนี้ไม่ได้',
    LINK_V2_NOTICE:'คำเชิญและคำตอบเวอร์ชัน 2 ต้องใช้เกมรุ่นใหม่ที่รองรับแค็ตตาล็อกสายพันธุ์เดียวกัน ร่างใหม่เข้าร่วมคำเชิญแบบเดิมไม่ได้',
    PASSWORD_INPUT_HINT:'รองรับทั้งรหัสผ่านสั้นแบบเดิมและรหัสใหม่ที่ขึ้นต้นด้วย CM26-PASSWORD-2 โปรดคัดลอกและวางรหัสทั้งหมด',
    LINK_VERSION_HINT:'ร่างใหม่จะใช้รหัสเวอร์ชัน 2 โดยอัตโนมัติ หากต้องการเชิญร่างใหม่ด้วยทีมเดิม ให้เลือกคำเชิญเวอร์ชัน 2 ก่อน',
    CREATE_V2_INVITE:'สร้างคำเชิญเวอร์ชัน 2',
    CREATE_V2_INVITE_LABEL:'สร้างคำเชิญเวอร์ชัน 2 (ให้ร่างใหม่ที่รองรับเข้าร่วมได้)',
    PASSWORD_SPECIES_NOT_READY:'ร่างใหม่นี้ยังไม่ผ่านการตรวจสอบไฟล์ภาพและการเชื่อมต่อ จึงยังสร้างหรือใช้รหัสต่อสู้ไม่ได้',
    PROFILE_UNAVAILABLE:'ข้อมูลเฉพาะตัวของคู่หูนี้ยังไม่ครบถ้วน',
    EMPTY_TEAM:'รหัสผ่านนี้ไม่มีคู่หูที่เข้าต่อสู้ได้'
  }),
  vi:Object.freeze({
    SPECIES_NOT_READY:'Dạng mới này chưa vượt qua kiểm tra tài nguyên hình ảnh và kết nối nên chưa thể chiến đấu.',
    CATALOG_MISMATCH:'Phiên bản danh mục loài không khớp. Cả hai người chơi cần dùng bản game mới hỗ trợ cùng một danh mục.',
    V2_INVITE_REQUIRED:'Đội này cần mã kết nối phiên bản 2. Hãy yêu cầu chủ phòng chọn lời mời phiên bản 2 rồi trao đổi mã lại.',
    V2_REQUIRED:'Đội này có dạng mới hoặc dữ liệu huyết thống liên quan nên không thể dùng mã đấu kiểu cũ.',
    VERSION_MISMATCH:'Phiên bản mã không được hỗ trợ, hoặc phiên bản lời mời và phản hồi không khớp. Hãy trao đổi lại các mã cùng phiên bản.',
    VALUES_UNSUPPORTED:'Mã đấu phiên bản 2 này có giá trị ngoài phạm vi được hỗ trợ. Hãy kiểm tra phiên bản game đã tạo mã.',
    INVALID_CODE:'Không nhận diện được mã đấu phiên bản 2 này hoặc kiểm tra tính toàn vẹn thất bại. Hãy sao chép và dán lại toàn bộ mã.',
    PASSWORD_V2_NOTICE:'Mã đấu phiên bản 2 cho dạng nguyên bản: cần bản game mới hỗ trợ danh mục loài bản sửa đổi 1. Bản game cũ không thể sử dụng mã này.',
    LINK_V2_NOTICE:'Lời mời và phản hồi phiên bản 2 cần các bản game mới hỗ trợ cùng danh mục loài. Dạng mới không thể tham gia lời mời kiểu cũ.',
    PASSWORD_INPUT_HINT:'Hỗ trợ mật khẩu ngắn kiểu cũ và mã mới bắt đầu bằng CM26-PASSWORD-2. Hãy sao chép và dán toàn bộ mã.',
    LINK_VERSION_HINT:'Dạng mới tự động dùng mã phiên bản 2. Để mời dạng mới bằng đội hiện có, hãy chọn lời mời phiên bản 2 trước.',
    CREATE_V2_INVITE:'Tạo lời mời phiên bản 2',
    CREATE_V2_INVITE_LABEL:'Tạo lời mời phiên bản 2 (cho phép dạng mới được hỗ trợ tham gia)',
    PASSWORD_SPECIES_NOT_READY:'Dạng mới này chưa vượt qua kiểm tra tài nguyên hình ảnh và kết nối nên chưa thể tạo hoặc dùng mã đấu.',
    PROFILE_UNAVAILABLE:'Dữ liệu cá thể của bạn đồng hành này chưa đầy đủ.',
    EMPTY_TEAM:'Mật khẩu này không có bạn đồng hành nào đủ điều kiện chiến đấu.'
  })
});

// Resolve at display time, not module load, so settings changes take effect.
export function battleTransportText(key,locale=getLocale()){
  const value=BATTLE_TRANSPORT_COPY[locale]?.[key];
  if(typeof value!=='string')throw new RangeError(`BATTLE_TRANSPORT_COPY_UNKNOWN:${locale}:${key}`);
  return value;
}
