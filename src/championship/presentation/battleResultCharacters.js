// OVL8 0210C438/444 selects Sub 9 for all-wins, otherwise Sub 5.
// 0210CCB0 advances those three bodies once per native result update.
import {createPixiAssetScope} from './pixiCharacterRuntimeBundle.js';
export const RESULT_FRAME=Object.freeze({width:256,height:192});
export const RESULT_ANCHORS=Object.freeze([[46,151],[127,172],[210,154]]); // result_sub_scene.nxr digimon1..3
// Where the 256x192 frame sits on a taller portrait stage is PRODUCT_AUTHORED
// (2026-09-29): 70% of the spare height above it, so the characters stand in
// the lower part of the stage and the result plate has the space just above
// them. vs5Styles.css places the stage light and the plate with the same number.
export const RESULT_FRAME_DROP=0.7;
// The victory podium (Owner 2026-10-28, PRODUCT_AUTHORED): the party stands
// centred on the stage instead of at the native result positions. One body
// takes the middle, two share it, three stand as a centre with two wings.
// The native layout (RESULT_ANCHORS) stays the default and the classic theme's.
export const RESULT_PODIUM_ANCHORS=Object.freeze({1:Object.freeze([[128,158]]),2:Object.freeze([[86,156],[170,156]]),
  3:Object.freeze([[128,162],[52,150],[204,150]])});
export function resultAnchorFor(index,slots,layout='native'){
  if(layout!=='podium')return RESULT_ANCHORS[index];
  const present=[...new Set(slots)].filter(slot=>slot>=0&&slot<3).sort((a,b)=>a-b),order=present.indexOf(index);
  return order<0?RESULT_ANCHORS[index]:RESULT_PODIUM_ANCHORS[Math.min(3,present.length)][order];
}
export function resultFrameLayout(width,height,bounds=null,{centre=false}={}){
  let scale=Math.min(width/RESULT_FRAME.width,height/RESULT_FRAME.height);
  const padding=Math.min(8,width/4,height/4);
  if(bounds)scale=Math.min(scale,(width-2*padding)/(bounds.right-bounds.left),(height-2*padding)/(bounds.bottom-bounds.top));
  let left=(width-RESULT_FRAME.width*scale)/2,top=Math.max(0,height-RESULT_FRAME.height*scale)*RESULT_FRAME_DROP;
  // The podium centres the bodies themselves: a wide sprite's cells are not
  // centred on its feet, so centring the anchor alone can leave it off centre.
  if(bounds&&centre)left=(width-(bounds.left+bounds.right)*scale)/2;
  if(bounds){
    left=Math.max(padding-bounds.left*scale,Math.min(width-padding-bounds.right*scale,left));
    top=Math.max(padding-bounds.top*scale,Math.min(height-padding-bounds.bottom*scale,top));
  }
  return {scale,left,top};
}
// The point the important highlight lights: the middle of the characters that
// are present, at chest height (36 frame pixels above their feet), as
// fractions of the stage. Null when no slot is present.
// The stage light under the characters that are present: its centre and
// width as fractions of the stage (one character gets a narrower pool).
export function resultStageLight({width,height,slots=[0],layout='native'}){
  const present=RESULT_ANCHORS.map((_,index)=>index).filter(index=>slots.includes(index)).map(index=>resultAnchorFor(index,slots,layout));
  if(!present.length||!(width>0)||!(height>0))return null;
  const {scale,left}=resultFrameLayout(width,height);
  const xs=present.map(([ax])=>(left+ax*scale)/width);
  const centre=(Math.min(...xs)+Math.max(...xs))/2;
  const spread=Math.max(...xs)-Math.min(...xs);
  return {x:centre,width:Math.min(0.9,spread+0.34)};
}
export function resultHeroAnchor({width,height,slots=[0],layout='native'}){
  const present=RESULT_ANCHORS.map((_,index)=>index).filter(index=>slots.includes(index)).map(index=>resultAnchorFor(index,slots,layout));
  if(!present.length||!(width>0)||!(height>0))return null;
  const {scale,left,top}=resultFrameLayout(width,height);
  const x=present.reduce((sum,[ax])=>sum+ax,0)/present.length,y=present.reduce((sum,[,ay])=>sum+ay,0)/present.length-36;
  return {x:(left+x*scale)/width,y:(top+y*scale)/height};
}
export async function mountBattleResultCharacters({stage,hudArt,participants,won,signal=null,layout:arrangement='native'}){
  signal?.throwIfAborted();
  const controller=new AbortController(),loadSignal=controller.signal;
  const PIXI=createPixiAssetScope(stage.PIXI,globalThis.location?.href,{signal:loadSignal});
  const presentSlots=participants.slice(0,3).map((p,i)=>p?i:-1).filter(i=>i>=0);
  const anchors=RESULT_ANCHORS.map((_,index)=>resultAnchorFor(index,presentSlots,arrangement));
  const sequence=won?9:5,actors=[],loaded=new Map(),sources=new Set();
  let bounds=null,frameScale=1,scene=null,resize=null,ticking=false,disposed=false;
  let accumulator=0,elapsed=0;
  function dispose(){
    if(disposed)return;disposed=true;
    controller.abort();signal?.removeEventListener('abort',abort);
    resize?.();if(ticking)stage.app.ticker.remove(update);ticking=false;
    scene?.destroy({children:true});scene=null;actors.length=0;loaded.clear();
    // Scoped ownership releases settled pixels now and late pixels when their
    // uncancellable load finishes, without invalidating a newer result scene.
    for(const src of sources)void PIXI.Assets.unload(src).catch(()=>{});
  }
  const abort=()=>dispose();
  signal?.addEventListener('abort',abort,{once:true});
  const wait=pending=>new Promise((resolve,reject)=>{
    const cancelled=()=>reject(loadSignal.reason);
    loadSignal.addEventListener('abort',cancelled,{once:true});
    Promise.resolve(pending).then(value=>{
      loadSignal.removeEventListener('abort',cancelled);
      loadSignal.aborted?reject(loadSignal.reason):resolve(value);
    },error=>{loadSignal.removeEventListener('abort',cancelled);reject(error);});
    if(loadSignal.aborted)cancelled();
  });
  // The three bodies share most of their cells and none of them waits on
  // another, so awaiting one cell at a time made the result screen pay a round
  // trip per frame. Gather the distinct sources, load them together, then build
  // the sprites in participant order exactly as before.
  try{
    const chosen=participants.slice(0,3).map((p,i)=>({p,i,cells:p&&hudArt?hudArt.getBattleCells(p.speciesId,sequence):[]}))
      .filter(e=>e.cells.length);
    for(const src of chosen.flatMap(e=>e.cells.map(c=>c.src)))sources.add(src);
    await wait(Promise.all([...sources].map(async src=>{
      const texture=await PIXI.Assets.load(src);loadSignal.throwIfAborted();
      texture.source.scaleMode='nearest';loaded.set(src,texture);
    })));
    loadSignal.throwIfAborted();
    // No scene, callback or canvas content exists while a texture is pending.
    scene=stage.createSceneRoot('native result characters');
    for(const {p,i,cells} of chosen){
      // HUD cells are alpha-cropped. Union every animation cell in logical
      // pixels so a later pose cannot jump outside the result container.
      for(const cell of cells){
        const left=anchors[i][0]-cell.origin[0],top=anchors[i][1]-cell.origin[1];
        const box={left,top,right:left+cell.width,bottom:top+cell.height};
        bounds=bounds?{left:Math.min(bounds.left,box.left),top:Math.min(bounds.top,box.top),right:Math.max(bounds.right,box.right),bottom:Math.max(bounds.bottom,box.bottom)}:box;
      }
      const sprite=new stage.PIXI.Sprite();scene.addChild(sprite);actors.push({sprite,speciesId:p.speciesId,anchor:anchors[i]});}
  }catch(error){dispose();throw error;}
  function apply(){for(const actor of actors){const cell=hudArt.getBattleFrame(actor.speciesId,sequence,elapsed);if(!cell)continue;
    const texture=loaded.get(cell.src);actor.sprite.texture=texture;
    actor.sprite.anchor.set(cell.origin[0]/cell.width,cell.origin[1]/cell.height);
    // Use logical cell size for both HD and legacy 1x textures.
    actor.sprite.scale.set(frameScale*cell.width/texture.orig.width,frameScale*cell.height/texture.orig.height);}}
  function layout(){const {scale,left,top}=resultFrameLayout(stage.app.screen.width,stage.app.screen.height,bounds,{centre:arrangement==='podium'});frameScale=scale;
    for(const actor of actors)actor.sprite.position.set(left+actor.anchor[0]*scale,top+actor.anchor[1]*scale);
    apply();}
  function update(ticker){if(disposed)return;
    if(globalThis.document?.hidden){accumulator=0;return;}
    accumulator+=Math.min(250,Math.max(0,ticker.deltaMS));
    while(accumulator+1e-9>=1000/60){accumulator-=1000/60;elapsed++;}apply();}
  try{stage.app.ticker.add(update);ticking=true;resize=stage.onResize(layout);apply();layout();}
  catch(error){dispose();throw error;}
  return {dispose};
}
