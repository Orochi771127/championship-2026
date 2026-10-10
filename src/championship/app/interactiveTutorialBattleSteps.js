// OVL10 021142C4/0211430D/0211438F: app-owned semantic menu boundaries.
// Entry mode4 is distinct from Battle core mode1 (native root+C98).
const dialog=(texts,next,extra={})=>({texts,next,count:texts.length,...extra});
export const TUTORIAL_BATTLE_STEPS=Object.freeze({
  'battle-kind-intro':dialog([1555],'battle-kind',{panel:'kind',nativeMenu:2}),
  'battle-kind':{count:1,action:'kind',text:1555,panel:'kind',nativeMenu:2,next:'battle-list-intro'},
  'battle-list-intro':dialog([1556],'battle-match',{panel:'list',nativeMenu:6}),
  'battle-match':{count:1,action:'match',text:1556,panel:'list',nativeMenu:6,next:'battle-detail-intro'},
  'battle-detail-intro':dialog([1557,1558],'battle-party-open',{panel:'detail',nativeMenu:11}),
  'battle-party-open':{count:1,action:'party',text:1558,panel:'detail',nativeMenu:11,next:'battle-party-intro'},
  'battle-party-intro':dialog([1559],'battle-party-select',{panel:'party',nativeMenu:14}),
  // message is the saved three-bit selection mask; mask7 alone opens the lesson.
  'battle-party-select':{count:7,action:'member',text:1559,panel:'party',nativeMenu:14,nestedMenu:3},
  'battle-options-intro':dialog([1560,1561,1562],'battle-party-return',{panel:'party',nativeMenu:14,nestedMenu:3,mask:7}),
  'battle-party-return':{count:1,action:'return',text:1562,panel:'party',nativeMenu:14,nestedMenu:3,mask:7,next:'battle-start-intro'},
  'battle-start-intro':dialog([1563],'battle-start',{panel:'ready',nativeMenu:11,mask:7}),
  'battle-start':{count:1,action:'start',text:1563,panel:'ready',nativeMenu:11,mask:7,next:'battle-running'},
  'battle-running':{count:1,screen:'BATTLE_FIELD',action:'judged',mask:7},
  'battle-result-win':{count:2,screen:'BATTLE_RESULT',action:'end',verdict:'TEAM_ZERO_AHEAD',winningTeam:0},
  'battle-result-loss':{count:2,screen:'BATTLE_RESULT',action:'end',verdict:'TEAM_ONE_AHEAD',winningTeam:1},
  'battle-result-draw':{count:2,screen:'BATTLE_RESULT',action:'end',verdict:'LEVEL',winningTeam:null},
  'raising-after-battle':dialog([1564,1565],'completed',{screen:'RAISING_HOME'})
});
for(const step of Object.values(TUTORIAL_BATTLE_STEPS)){if(step.texts)Object.freeze(step.texts);Object.freeze(step);}
export function tutorialBattleStep(cp){const step=TUTORIAL_BATTLE_STEPS[cp?.stage];if(!step)return null;
 const dialogue=cp.message<(step.texts?.length??0);
 return {...step,screen:step.screen??'BATTLE_SELECT',dialogue,textId:dialogue?step.texts[cp.message]:step.text??null,
   mask:cp.stage==='battle-party-select'?cp.message:step.mask??0};}
