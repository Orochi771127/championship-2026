import {getLocale} from './locale.js';
const COPY={
 'zh-Hant':{title:'選擇你的起始蛋',hint:'選一顆蛋，再替牠取名字。',egg:'蛋 {n}',confirm:'選這顆蛋',back:'返回選蛋',cancel:'取消新遊戲'},
 en:{title:'Choose your first egg',hint:'Choose an egg, then give it a name.',egg:'Egg {n}',confirm:'Choose this egg',back:'Back to eggs',cancel:'Cancel new game'},
 ja:{title:'最初のタマゴを選ぼう',hint:'タマゴを1つ選んで、名前を付けましょう。',egg:'タマゴ {n}',confirm:'このタマゴにする',back:'タマゴ選びに戻る',cancel:'ニューゲームを取り消す'},
 th:{title:'เลือกไข่ใบแรกของคุณ',hint:'เลือกไข่หนึ่งใบ แล้วตั้งชื่อให้คู่หู',egg:'ไข่ {n}',confirm:'เลือกไข่ใบนี้',back:'กลับไปเลือกไข่',cancel:'ยกเลิกเกมใหม่'},
 vi:{title:'Chọn quả trứng đầu tiên',hint:'Chọn một quả trứng rồi đặt tên cho bạn đồng hành.',egg:'Trứng {n}',confirm:'Chọn trứng này',back:'Quay lại chọn trứng',cancel:'Hủy trò chơi mới'}
};
export function openingEggText(){return COPY[getLocale()]??COPY['zh-Hant'];}
