// PRODUCT_AUTHORED onboarding copy (Owner 2026-10-28): the cinematic prologue,
// the tamer licence terminal, the eight-egg incubator, the hatching pod and the
// tactical tutorial guide. Display-only; player input is never rewritten.
import {getLocale} from './locale.js';

const COPY={
 'zh-Hant':{
  skipPrologue:'跳過序章',tapToContinue:'點擊繼續',prologue:'序章',narrator:'旁白',
  licenseKicker:'NEW CHALLENGER',licenseTitle:'馴獸師執照申請',licenseNumber:'執照編號',licensePending:'登錄後核發',
  namePlaceholder:'輸入馴獸師姓名',nameCount:'{n} / {max} 字',randomName:'隨機',
  guestTitle:'遊客通行證模式',guestNote:'進度自動保存於本機 · 支援後續綁定帳號',
  mailKicker:'INCOMING MAIL',mailFrom:'錦標賽營運本部',
  incubatorKicker:'ELEMENTAL INCUBATOR',locked:'已鎖定',
  podKicker:'HATCHING POD',partnerPlaceholder:'輸入拍檔暱稱',randomPartner:'隨機好名',giftEgg:'錦標賽贈禮蛋',
  guideName:'AI 戰術引導員',guideNext:'下一步',guideSkip:'跳過教學',guideAction:'請操作高亮的位置',
  tamerCode:'馴獸師名片碼',guestPass:'遊客通行證',
  lessons:['孵化','餵食','清潔','治療','移動訓練','休養','傷藥','出發準備','狩獵','對戰'],
  elements:{star:'星辰',fire:'火焰',water:'水流',forest:'森木',thunder:'雷電',moon:'月暗',crystal:'晶石',holy:'聖光'},
  tamerNames:['星野','雷翔','凜音','蒼司','千尋','銀狼','晴空','風岳','夜叉丸','焰真'],
  partnerNames:['小焰','阿星','波波','嘟嘟','咕嚕','雷雷','團子','米露','布丁','可可']
 },
 en:{
  skipPrologue:'Skip prologue',tapToContinue:'Tap to continue',prologue:'Prologue',narrator:'Narrator',
  licenseKicker:'NEW CHALLENGER',licenseTitle:'Tamer licence application',licenseNumber:'Licence no.',licensePending:'Issued on entry',
  namePlaceholder:'Tamer name',nameCount:'{n} / {max}',randomName:'Random',
  guestTitle:'Guest pass mode',guestNote:'Progress saves on this device · link an account later',
  mailKicker:'INCOMING MAIL',mailFrom:'Tournament Office',
  incubatorKicker:'ELEMENTAL INCUBATOR',locked:'Locked',
  podKicker:'HATCHING POD',partnerPlaceholder:'Partner nickname',randomPartner:'Suggest',giftEgg:'Tournament gift egg',
  guideName:'AI Tactical Guide',guideNext:'Next',guideSkip:'Skip tutorial',guideAction:'Use the highlighted control',
  tamerCode:'Tamer ID',guestPass:'Guest pass',
  lessons:['Hatch','Feed','Clean','Medicine','Moving','Rest','Wounds','Set out','Hunt','Battle'],
  elements:{star:'Star',fire:'Flame',water:'Tide',forest:'Grove',thunder:'Thunder',moon:'Moon',crystal:'Crystal',holy:'Holy'},
  tamerNames:['Kai','Rex','Nova','Aero','Juno','Zed','Mika','Ryu','Luna','Ash'],
  partnerNames:['Pip','Ember','Bubbo','Mochi','Zap','Puff','Nugi','Bean','Taro','Coco']
 },
 ja:{
  skipPrologue:'プロローグをスキップ',tapToContinue:'タップで続ける',prologue:'序章',narrator:'ナレーション',
  licenseKicker:'NEW CHALLENGER',licenseTitle:'テイマーライセンス申請',licenseNumber:'ライセンス番号',licensePending:'登録後に発行',
  namePlaceholder:'テイマーの名前',nameCount:'{n} / {max} 文字',randomName:'ランダム',
  guestTitle:'ゲストパスモード',guestNote:'進行状況はこの端末に自動保存 · あとでアカウント連携できます',
  mailKicker:'INCOMING MAIL',mailFrom:'大会運営本部',
  incubatorKicker:'ELEMENTAL INCUBATOR',locked:'決定済み',
  podKicker:'HATCHING POD',partnerPlaceholder:'パートナーのニックネーム',randomPartner:'おまかせ',giftEgg:'大会からの贈り物のタマゴ',
  guideName:'AI戦術ガイド',guideNext:'次へ',guideSkip:'スキップ',guideAction:'光っている場所を操作しよう',
  tamerCode:'テイマーID',guestPass:'ゲストパス',
  lessons:['孵化','ごはん','おそうじ','治療','移動','休養','傷薬','出発準備','狩り','対戦'],
  elements:{star:'星',fire:'炎',water:'水',forest:'森',thunder:'雷',moon:'月',crystal:'晶',holy:'聖'},
  tamerNames:['ハヤト','ソラ','リン','カイト','ミオ','レン','ヒカリ','ツバサ','アオイ','ユウ'],
  partnerNames:['ポポ','ほむら','ルル','モチ','ピカ','チビ','ココ','プリン','マロ','ノノ']
 },
 th:{
  skipPrologue:'ข้ามบทนำ',tapToContinue:'แตะเพื่อไปต่อ',prologue:'บทนำ',narrator:'ผู้บรรยาย',
  licenseKicker:'NEW CHALLENGER',licenseTitle:'สมัครใบอนุญาตผู้ฝึก',licenseNumber:'เลขที่ใบอนุญาต',licensePending:'ออกให้เมื่อลงทะเบียน',
  namePlaceholder:'ชื่อผู้ฝึก',nameCount:'{n} / {max}',randomName:'สุ่ม',
  guestTitle:'โหมดบัตรผ่านผู้เยี่ยมชม',guestNote:'บันทึกในเครื่องนี้อัตโนมัติ · ผูกบัญชีได้ภายหลัง',
  mailKicker:'INCOMING MAIL',mailFrom:'สำนักงานจัดการแข่งขัน',
  incubatorKicker:'ELEMENTAL INCUBATOR',locked:'ล็อกแล้ว',
  podKicker:'HATCHING POD',partnerPlaceholder:'ชื่อเล่นคู่หู',randomPartner:'สุ่มชื่อ',giftEgg:'ไข่ของขวัญจากการแข่งขัน',
  guideName:'ไกด์ยุทธวิธี AI',guideNext:'ต่อไป',guideSkip:'ข้ามบทสอน',guideAction:'แตะตำแหน่งที่ไฮไลต์',
  tamerCode:'รหัสผู้ฝึก',guestPass:'บัตรผ่านผู้เยี่ยมชม',
  lessons:['ฟักไข่','ให้อาหาร','ทำความสะอาด','รักษา','เคลื่อนย้าย','พักฟื้น','ยาแผล','เตรียมออกเดินทาง','ล่า','ต่อสู้'],
  elements:{star:'ดวงดาว',fire:'เปลวไฟ',water:'สายน้ำ',forest:'พงไพร',thunder:'สายฟ้า',moon:'จันทรา',crystal:'ผลึก',holy:'แสงศักดิ์สิทธิ์'},
  tamerNames:['ไค','ฟ้า','ดาว','ลม','ภูมิ','เมฆ','ต้น','ปาย','นนท์','ไอซ์'],
  partnerNames:['ปุย','ถั่ว','โมจิ','ส้ม','ฟองฟู','ปิ๊ก','ข้าว','ลูกไฟ','ป๊อป','บอล']
 },
 vi:{
  skipPrologue:'Bỏ qua mở đầu',tapToContinue:'Chạm để tiếp tục',prologue:'Mở đầu',narrator:'Người kể',
  licenseKicker:'NEW CHALLENGER',licenseTitle:'Đơn cấp giấy phép huấn luyện',licenseNumber:'Số giấy phép',licensePending:'Cấp khi đăng ký',
  namePlaceholder:'Tên huấn luyện viên',nameCount:'{n} / {max}',randomName:'Ngẫu nhiên',
  guestTitle:'Chế độ thẻ khách',guestNote:'Tiến độ tự lưu trên máy này · có thể liên kết tài khoản sau',
  mailKicker:'INCOMING MAIL',mailFrom:'Ban tổ chức giải',
  incubatorKicker:'ELEMENTAL INCUBATOR',locked:'Đã chọn',
  podKicker:'HATCHING POD',partnerPlaceholder:'Biệt danh bạn đồng hành',randomPartner:'Gợi ý',giftEgg:'Trứng quà tặng của giải',
  guideName:'Hướng dẫn chiến thuật AI',guideNext:'Tiếp',guideSkip:'Bỏ qua hướng dẫn',guideAction:'Chạm vào vị trí được làm sáng',
  tamerCode:'Mã huấn luyện viên',guestPass:'Thẻ khách',
  lessons:['Ấp trứng','Cho ăn','Dọn dẹp','Chữa bệnh','Di chuyển','Nghỉ ngơi','Băng vết thương','Chuẩn bị','Săn bắt','Chiến đấu'],
  elements:{star:'Tinh tú',fire:'Lửa',water:'Nước',forest:'Rừng',thunder:'Sấm',moon:'Trăng',crystal:'Pha lê',holy:'Thánh quang'},
  tamerNames:['Minh','Long','Lan','Vy','Khoa','Nam','An','Huy','Mai','Phong'],
  partnerNames:['Bông','Lửa','Mochi','Bi','Kem','Sóc','Bơ','Na','Mít','Tôm']
 }
};

export function onboardingText(locale=getLocale()){return COPY[locale]??COPY['zh-Hant'];}
export function fillOnboardingText(template,params={}){return template.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(params,key)?String(params[key]):match);}
export const ONBOARDING_TEXT_LOCALES=Object.freeze(Object.keys(COPY));
