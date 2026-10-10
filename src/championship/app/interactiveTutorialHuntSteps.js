// OVL0 tutorial VM; persistent semantic boundaries, never a second simulation.
const dialog=(texts,next,extra={})=>({texts,next,count:texts.length,...extra});
export const TUTORIAL_HUNT_STEPS=Object.freeze({
  'gate-intro':dialog([1527],'gate-select',{screen:'GATE_SELECT'}),
  'gate-select':{count:1,screen:'GATE_SELECT',action:'gate',text:1527},
  'hunt-intro':dialog([1528,1529,1530,1531],'hunt-camera'),
  'hunt-camera':{count:1,tool:'HAND',action:'camera',text:1531,next:'hunt-explain'},
  'hunt-explain':dialog([1532,1533,1534],'hunt-demo-rope-intro'),
  'hunt-demo-rope-intro':dialog([1535],'hunt-demo-rope'),
  'hunt-demo-rope':{count:1,wait:90,next:'hunt-demo-pull-intro',demo:'rope'},
  'hunt-demo-pull-intro':dialog([1536],'hunt-demo-pull'),
  'hunt-demo-pull':{count:1,wait:60,next:'hunt-demo-hand-intro',demo:'pull'},
  'hunt-demo-hand-intro':dialog([1537],'hunt-demo-hand'),
  'hunt-demo-hand':{count:1,wait:150,next:'hunt-practice-intro',demo:'hand'},
  'hunt-practice-intro':dialog([1538],'hunt-first-rope'),
  'hunt-first-rope':{count:1,tool:'ROPE',action:'select',text:1539,next:'hunt-first-enclose'},
  'hunt-first-enclose':{count:1,tool:'ROPE',action:'enclose',text:1539,next:'hunt-first-pull-intro'},
  'hunt-first-pull-intro':dialog([1540],'hunt-first-pull'),
  'hunt-first-pull':{count:1,tool:'ROPE',action:'pull',text:1540,next:'hunt-first-hand'},
  'hunt-first-hand':{count:1,tool:'HAND',action:'select',text:1541,next:'hunt-first-collect'},
  'hunt-first-collect':{count:1,tool:'HAND',action:'collect',text:1541,next:'hunt-second-intro'},
  'hunt-second-intro':dialog([1543],'hunt-second-rope',{target:1}),
  'hunt-second-rope':{count:1,tool:'ROPE',action:'select',text:1543,next:'hunt-second-enclose',target:1},
  'hunt-second-enclose':{count:1,tool:'ROPE',action:'enclose',text:1543,next:'hunt-escape-demo',target:1},
  'hunt-escape-demo':{count:1,wait:90,demo:'escape',next:'hunt-escape-explain',target:1},
  'hunt-escape-explain':dialog([1544,1545],'hunt-return-demo',{target:1}),
  'hunt-return-demo':{count:1,wait:235,demo:'return',next:'hunt-food-intro',target:1},
  'hunt-food-intro':dialog([1546,1547],'hunt-food-select',{target:1}),
  'hunt-food-select':{count:1,tool:'ENTRAP',action:'select',text:1547,next:'hunt-food-place',target:1},
  'hunt-food-place':{count:1,tool:'ENTRAP',action:'food',text:1547,next:'hunt-food-demo',target:1},
  'hunt-food-demo':{count:1,wait:100,demo:'food',next:'hunt-shot-intro',target:1},
  'hunt-shot-intro':dialog([1548],'hunt-shot-select',{target:1}),
  'hunt-shot-select':{count:1,tool:'SHOT',action:'select',text:1548,next:'hunt-shot-hit',target:1},
  'hunt-shot-hit':{count:1,tool:'SHOT',action:'stun',text:1548,next:'hunt-final-intro',target:1},
  'hunt-final-intro':dialog([1549],'hunt-final-rope',{target:1}),
  'hunt-final-rope':{count:1,tool:'ROPE',action:'select',text:1549,next:'hunt-final-capture',target:1},
  'hunt-final-capture':{count:1,tool:'ROPE',action:'capture',text:1549,next:'hunt-final-hand',target:1},
  'hunt-final-hand':{count:1,tool:'HAND',action:'select',text:1549,next:'hunt-final-collect',target:1},
  'hunt-final-collect':{count:1,tool:'HAND',action:'collect',text:1549,next:'hunt-return-wait',target:1},
  'hunt-return-wait':{count:1,wait:210,next:'raising-after-hunt',target:1},
  'raising-after-hunt':dialog([1553,1554],'raising-battle-ready',{screen:'RAISING_HOME',tool:'SYSTEM'}),
  'raising-battle-ready':{count:1,action:'menu',tool:'SYSTEM',menuEntry:'battle',text:1554,screen:'RAISING_HOME'}
});
for(const step of Object.values(TUTORIAL_HUNT_STEPS)){if(step.texts)Object.freeze(step.texts);Object.freeze(step);}
export function tutorialHuntStep(cp){const step=TUTORIAL_HUNT_STEPS[cp?.stage];if(!step)return null;
 const dialogue=cp.message<(step.texts?.length??0);
 return {...step,screen:step.screen??'HUNT_FIELD',dialogue,textId:dialogue?step.texts[cp.message]:step.text??null};}

export const TUTORIAL_GATE=Object.freeze({gateId:'championship:2026:gate:tutorial',biomeId:'Tutorial',
 romRecordIndex:16,ordinal:17,displayName:'チュートリアル',codeString:'ID:128TU0TA',entranceFeeBits:0,
 state:'AVAILABLE',worldSeed:16,art:{thumbnail:null},tutorial:true});
