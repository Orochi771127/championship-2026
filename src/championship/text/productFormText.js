import {getLocale} from './locale.js';
export const PRODUCT_FORM_TEXT=Object.freeze({
 'zh-Hant':Object.freeze({choose:'選擇進化型態',notReady:'此型態尚未完成接入。'}),
 en:Object.freeze({choose:'Choose evolution form',notReady:'This form is not ready for play yet.'}),
 ja:Object.freeze({choose:'進化形態を選択',notReady:'この形態はまだプレイできません。'}),
 th:Object.freeze({choose:'เลือกร่างวิวัฒนาการ',notReady:'ร่างนี้ยังไม่พร้อมให้เล่น'}),
 vi:Object.freeze({choose:'Chọn dạng tiến hóa',notReady:'Dạng này chưa sẵn sàng để chơi.'})
});
export const productFormText=key=>PRODUCT_FORM_TEXT[getLocale()]?.[key]??PRODUCT_FORM_TEXT.en[key];
