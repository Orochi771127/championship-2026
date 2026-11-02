// Owner-approved display adaptation, 2026-10-13. Internal PERFECT / generation
// selectors, source transcriptions and player input retain their identities.
export const AWAKENED_FORM_NAMES = Object.freeze({
  'zh-Hant':'覺醒體', en:'Awakened', ja:'覚醒体', th:'ร่างตื่นพลัง', vi:'Thức tỉnh'
});
// Owner 2026-11-02 (STAGE_REDESIGN_BURST_20261102): 究極體 joins 覺醒體 as its second tier (both are battle
// burst forms of a 成熟期), so the former 究極體 stage is shown as the 覺醒體's second tier.
export const AWAKENED_SECOND_TIER_NAMES = Object.freeze({
  'zh-Hant':`${AWAKENED_FORM_NAMES['zh-Hant']}・二段`, en:`${AWAKENED_FORM_NAMES.en} II`, ja:`${AWAKENED_FORM_NAMES.ja}・二段`,
  th:`${AWAKENED_FORM_NAMES.th} ขั้น 2`, vi:`${AWAKENED_FORM_NAMES.vi} bậc 2`
});
export const AWAKENED_RADAR_NAMES = Object.freeze({
  'zh-Hant':`${AWAKENED_FORM_NAMES['zh-Hant']}雷達`,
  en:`${AWAKENED_FORM_NAMES.en} radar`, ja:`${AWAKENED_FORM_NAMES.ja}レーダー`,
  th:`เรดาร์${AWAKENED_FORM_NAMES.th}`, vi:`radar ${AWAKENED_FORM_NAMES.vi.toLowerCase()}`
});
export const GROWTH_STAGE_TERM_REVIEW = Object.freeze({
  classification:'OWNER_APPROVED_ADAPTATION', ownerAuthorizedOn:'2026-10-13',
  nativeSpeakerReview:Object.freeze({th:false,vi:false})
});

// Exact display aliases only. Never rewrite substrings or placeholder values.
export function growthStageUiAlias(value,locale){
  const lang=Object.hasOwn(AWAKENED_FORM_NAMES,locale)?locale:'zh-Hant';
  if(value==='完全體'||value==='覺醒體')return AWAKENED_FORM_NAMES[lang];
  if(value==='完全體雷達'||value==='覺醒體雷達')return AWAKENED_RADAR_NAMES[lang];
  return null;
}
