import {getLocale} from './locale.js';
const COPY={
 'zh-Hant':{policy:'這是示範對戰。結果如實顯示；勝、負或平手均可結束示範，繼續教學。隊伍、獎金與戰績不會帶回牧場。',end:'結束示範並繼續'},
 en:{policy:'This is a demo battle. The actual result is shown. Win, lose or draw, you can finish the demo and continue. Its team, prizes and records will not carry over to your ranch.',end:'Finish demo and continue'},
 ja:{policy:'これは体験用の対戦です。実際の結果を表示します。勝敗や引き分けにかかわらず体験を終了して続けられます。チーム、賞金、戦績は牧場に引き継がれません。',end:'体験を終了して続ける'},
 th:{policy:'นี่คือการต่อสู้สาธิต ระบบจะแสดงผลจริง ไม่ว่าจะชนะ แพ้ หรือเสมอ คุณสามารถจบการสาธิตและเรียนต่อได้ ทีม รางวัล และสถิติจะไม่ถูกนำกลับไปยังฟาร์ม',end:'จบการสาธิตและเรียนต่อ'},
 vi:{policy:'Đây là trận đấu hướng dẫn và kết quả thực tế được hiển thị. Dù thắng, thua hay hòa, bạn đều có thể kết thúc trận mẫu và học tiếp. Đội hình, phần thưởng và thành tích sẽ không được chuyển về trang trại.',end:'Kết thúc trận mẫu và tiếp tục'}
};
export function tutorialBattleText(){return COPY[getLocale()]??COPY['zh-Hant'];}
