// Bounded tutorial choreography over the existing Hunt controls and actors.
// No save, independent ticker, encounter generator or successful-input shortcut.
import {createNativeWildActor,nativeWildRequest} from './nativeWildActor.js';
const FRAME=1000*560190/33513982;
export function createNativeTutorialHuntScript(controls,records,setCamera){
 let step=null,stage=null,elapsed=0,remainder=0,ready=false,pointer=null,downAt=null;
 const actors=controls.actors;
 const reset=(i)=>{Object.assign(actors[i],createNativeWildActor(structuredClone(records[i]),actors[i].wildId),
  {tutorialScripted:true,aiState:1,tutorialDown:0,tutorialShot:0});};
 const position=(i,x,y)=>{actors[i].positionQ12=[x*4096,y*4096,0];actors[i].previousPositionQ12=[...actors[i].positionQ12];};
 const bound=i=>{actors[i].bound=1;nativeWildRequest(actors[i],16);};
 const down=i=>{bound(i);actors[i].currentHp=0;actors[i].tutorialDown=2;actors[i].aiState=11;actors[i].handReady=true;nativeWildRequest(actors[i],15);};
 const point=(x,y,down=false)=>{pointer={x:x*2,y:y*2};return down?controls.pointerDown(pointer.x,pointer.y):controls.pointerMove(pointer.x,pointer.y);};
 const up=()=>{if(pointer)controls.pointerUp(pointer.x,pointer.y);pointer=null;};
 function configure(cp,meta){
  if(stage===cp.stage)return;
  const rebuilding=stage===null;stage=cp.stage;step=meta;elapsed=0;ready=false;downAt=null;controls.cancel();pointer=null;
  if(rebuilding){reset(0);reset(1);actors[1].hidden=true;setCamera(400,400);}
  const second=step.target===1;
  if(stage==='hunt-intro'||stage==='hunt-explain'||stage==='hunt-first-rope'){reset(0);position(0,400,400);actors[1].hidden=true;setCamera(400,400);}
  if(stage==='hunt-second-intro'||rebuilding&&second){reset(1);actors[0].hidden=true;actors[0].actorActive=0;actors[0].cardState='ON_CARD';actors[1].hidden=false;position(1,640,600);setCamera(624,600);}
  if(rebuilding&&['hunt-demo-pull-intro','hunt-demo-pull','hunt-first-pull-intro','hunt-first-pull','hunt-escape-demo'].includes(stage))bound(second?1:0);
  if(rebuilding&&['hunt-demo-hand-intro','hunt-demo-hand','hunt-first-hand','hunt-first-collect','hunt-final-hand','hunt-final-collect'].includes(stage))down(second?1:0);
  if(rebuilding&&second&&!['hunt-second-intro','hunt-second-rope','hunt-second-enclose','hunt-escape-demo'].includes(stage)){position(1,640,530);setCamera(624,560);}
  if(stage==='hunt-escape-explain'){reset(1);position(1,640,420);setCamera(624,560);}
  if(rebuilding&&stage==='hunt-return-demo')position(1,640,420);
  if(rebuilding&&['hunt-final-intro','hunt-final-rope','hunt-final-capture'].includes(stage)){actors[1].tutorialShot=1;actors[1].shotShakeTicks=180;actors[1].shake={ticks:180,shakeX:1,shakeY:0,toggle:0};}
  if(rebuilding&&stage==='hunt-return-wait'){for(const a of actors){a.cardState='ON_CARD';a.hidden=true;}}
  if(rebuilding&&stage==='hunt-food-demo'){controls.selectTool('ENTRAP');point(640,584,true);controls.tick(FRAME);up();}
  if(step.demo==='rope'){controls.selectTool('ROPE');point(435,395,true);}
  if(step.demo==='pull'){controls.selectTool('ROPE');point(400,395,true);}
  if(step.demo==='hand'){controls.selectTool('HAND');point(400,395,true);up();}
  if(step.demo==='escape')setCamera(624,560);
  if(step.action!=='select'&&step.tool)controls.selectTool(step.tool);
 }
 function advance(ms,camera){
  if(!step||step.dialogue||ready)return;
  remainder+=ms;
  while(remainder+1e-8>=FRAME){
   remainder-=FRAME;elapsed++;
   const a=actors[step.target??0];
   if(step.demo==='rope'){
    // Presentation gesture over the real 20-slot recognizer; native shape and
    // enclosure event decide success. The pointer trajectory is web presentation.
    if(elapsed<=16){const angle=elapsed/16*Math.PI*2;point(400+35*Math.cos(angle),395+35*Math.sin(angle));}
    if(elapsed===17)up();
   }else if(step.demo==='pull'&&a.currentHp>0){point(400+Math.min(80,elapsed*2),395+Math.min(40,elapsed));}
   else if(step.demo==='escape'&&elapsed<=90){position(1,640,600-2*elapsed);nativeWildRequest(a,19);}
   else if(step.demo==='return'&&elapsed>180&&elapsed<=235){position(1,640,420+2*(elapsed-180));nativeWildRequest(a,2);}
   else if(step.demo==='food'&&elapsed>70&&elapsed<=100){position(1,640,530+2*(elapsed-70));nativeWildRequest(a,3);}
   controls.tick(FRAME,camera);
   if(step.demo==='pull'&&a.currentHp<=0){up();downAt??=elapsed;ready=elapsed-downAt>=60;}
   else if(step.demo==='rope')ready=elapsed>=step.wait&&!!a.bound;
   else if(step.demo==='hand')ready=elapsed>=step.wait&&a.cardState==='ON_CARD';
   else if(step.wait)ready=elapsed>=step.wait;
   else if(step.action==='enclose')ready=!!a.bound;
   else if(step.action==='pull')ready=a.currentHp<=0;
   else if(step.action==='capture')ready=!!a.bound&&a.currentHp<=0;
   else if(step.action==='collect')ready=a.cardState==='ON_CARD';
   else if(step.action==='stun')ready=a.shotShakeTicks>0;
   else if(step.action==='food')ready=controls.getState().objects.some(o=>o.kind==='MEAT');
   if(ready)break;
  }
 }
 return Object.freeze({configure,advance,ready:()=>ready,
  view:()=>({stage,elapsed,pointer,target:step?.target??0,guide:step?.action==='food'?{x:1280,y:1168}:null})});
}
