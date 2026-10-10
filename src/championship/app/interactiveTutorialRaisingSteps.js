// Semantic boundaries of OVL18 VM 021267EF..02127AB5. Dialogue and input
// predicates are separate. Reloading replays an unfinished activity, never
// fabricates its successful input. This is the bounded web resume adaptation.
const dialog=(texts,next,extra={})=>({texts,next,count:texts.length,...extra});
export const TUTORIAL_RAISING_STEPS=Object.freeze({
  'raising-intro':dialog([1495,1496,1497],'raising-hatch',{tool:'hand'}),
  'raising-hatch':{count:1,tool:'hand',action:'hatch'},
  'raising-hatched':dialog([1498],'raising-hunger-wait'),
  'raising-hunger-wait':{count:1,wait:70,next:'raising-feed-intro'},
  'raising-feed-intro':dialog([1499,1500],'raising-feed-select'),
  'raising-feed-select':{count:1,tool:'feed',action:'select',text:1500,next:'raising-feed-place'},
  'raising-feed-place':{count:2,tool:'feed',texts:[1501],action:'feed'},
  'raising-feed-eat':{count:1,wait:180,next:'raising-clean-intro'},
  'raising-clean-intro':dialog([1502,1503,1504],'raising-clean-select'),
  'raising-clean-select':{count:1,tool:'clean',action:'select',text:1504,next:'raising-clean'},
  // message 1..8 encodes the three completed targets' mask + 1.
  'raising-clean':{count:9,tool:'clean',texts:[1505],action:'clean'},
  'raising-clean-wait':{count:1,wait:120,next:'raising-illness-intro'},
  'raising-illness-intro':dialog([1506,1507,1508],'raising-illness-select'),
  'raising-illness-select':{count:1,tool:'medicine',action:'select',text:1508,next:'raising-illness-treat'},
  'raising-illness-treat':{count:2,tool:'medicine',texts:[1509],action:'illness'},
  'raising-illness-wait':{count:1,wait:90,next:'raising-camera-intro'},
  'raising-camera-intro':dialog([1511,1512],'raising-camera'),
  'raising-camera':{count:1,tool:'hand',action:'camera',text:1512},
  'raising-carry-intro':dialog([1513,1514],'raising-training-drop'),
  'raising-training-drop':{count:1,tool:'hand',action:'carry',text:1514,cage:1},
  'raising-training-wait':{count:1,wait:60,next:'raising-training-done'},
  'raising-training-done':dialog([1515],'raising-recovery-intro'),
  'raising-recovery-intro':dialog([1516,1517],'raising-recovery-drop'),
  'raising-recovery-drop':{count:1,tool:'hand',action:'carry',text:1517,cage:15},
  'raising-recovery-done':dialog([1518,1519],'raising-injury-intro'),
  'raising-injury-intro':dialog([1520,1521,1522],'raising-injury-select'),
  'raising-injury-select':{count:1,tool:'woundMedicine',action:'select',text:1522,next:'raising-injury-treat'},
  'raising-injury-treat':{count:2,tool:'woundMedicine',texts:[1523],action:'injury'},
  'raising-injury-wait':{count:1,wait:240,next:'raising-sleep-wait'},
  'raising-sleep-wait':{count:1,wait:60,next:'raising-sleep'},
  'raising-sleep':dialog([1524,1525],'raising-gate-intro'),
  'raising-gate-intro':dialog([1526],'raising-gate-menu'),
  'raising-gate-menu':{count:1,tool:'SYSTEM',action:'menu',text:1526},
  'raising-gate-wait':{count:1,wait:30,next:'raising-gate-ready'},
  'raising-gate-ready':{count:1,wait:1,next:'gate-intro'}
});
for(const step of Object.values(TUTORIAL_RAISING_STEPS)){if(step.texts)Object.freeze(step.texts);Object.freeze(step);}
export function tutorialRaisingStep(checkpoint){
  const step=TUTORIAL_RAISING_STEPS[checkpoint?.stage];
  if(!step)return null;
  const dialogue=checkpoint.message<(step.texts?.length??0);
  return {...step,dialogue,textId:dialogue?step.texts[checkpoint.message]:step.text??step.texts?.at(-1)??null};
}
