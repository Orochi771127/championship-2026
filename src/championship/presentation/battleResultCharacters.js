// OVL8 0210C438/444 selects Sub 9 for all-wins, otherwise Sub 5.
// 0210CCB0 advances those three bodies once per native result update.
export const RESULT_FRAME=Object.freeze({width:256,height:192});
export const RESULT_ANCHORS=Object.freeze([[46,151],[127,172],[210,154]]); // result_sub_scene.nxr digimon1..3
// Where the 256x192 frame sits on a taller portrait stage is PRODUCT_AUTHORED
// (2026-09-29): 70% of the spare height above it, so the characters stand in
// the lower part of the stage and the result plate has the space just above
// them. vs5Styles.css places the stage light and the plate with the same number.
export const RESULT_FRAME_DROP=0.7;
export function resultFrameLayout(width,height){
  const scale=Math.min(width/RESULT_FRAME.width,height/RESULT_FRAME.height);
  return {scale,left:(width-RESULT_FRAME.width*scale)/2,top:Math.max(0,height-RESULT_FRAME.height*scale)*RESULT_FRAME_DROP};
}
// The point the important highlight lights: the middle of the characters that
// are present, at chest height (36 frame pixels above their feet), as
// fractions of the stage. Null when no slot is present.
// The stage light under the characters that are present: its centre and
// width as fractions of the stage (one character gets a narrower pool).
export function resultStageLight({width,height,slots=[0]}){
  const present=RESULT_ANCHORS.filter((_,index)=>slots.includes(index));
  if(!present.length||!(width>0)||!(height>0))return null;
  const {scale,left}=resultFrameLayout(width,height);
  const xs=present.map(([ax])=>(left+ax*scale)/width);
  const centre=(Math.min(...xs)+Math.max(...xs))/2;
  const spread=Math.max(...xs)-Math.min(...xs);
  return {x:centre,width:Math.min(0.9,spread+0.34)};
}
export function resultHeroAnchor({width,height,slots=[0]}){
  const present=RESULT_ANCHORS.filter((_,index)=>slots.includes(index));
  if(!present.length||!(width>0)||!(height>0))return null;
  const {scale,left,top}=resultFrameLayout(width,height);
  const x=present.reduce((sum,[ax])=>sum+ax,0)/present.length,y=present.reduce((sum,[,ay])=>sum+ay,0)/present.length-36;
  return {x:(left+x*scale)/width,y:(top+y*scale)/height};
}
export async function mountBattleResultCharacters({stage,hudArt,participants,won}){
  const scene=stage.createSceneRoot('native result characters');
  const anchors=RESULT_ANCHORS;
  const sequence=won?9:5,actors=[],loaded=new Map();
  // The three bodies share most of their cells and none of them waits on
  // another, so awaiting one cell at a time made the result screen pay a round
  // trip per frame. Gather the distinct sources, load them together, then build
  // the sprites in participant order exactly as before.
  try{
    const chosen=participants.slice(0,3).map((p,i)=>({p,i,cells:p&&hudArt?hudArt.getBattleCells(p.speciesId,sequence):[]}))
      .filter(e=>e.cells.length);
    const sources=[...new Set(chosen.flatMap(e=>e.cells.map(c=>c.src)))];
    const results=await Promise.allSettled(sources.map(async src=>({src,texture:await stage.PIXI.Assets.load(src)})));
    for(const r of results)if(r.status==='fulfilled'){r.value.texture.source.scaleMode='nearest';loaded.set(r.value.src,r.value.texture);}
    const failed=results.find(r=>r.status==='rejected');
    if(failed)throw failed.reason;
    for(const {p,i} of chosen){
      const sprite=new stage.PIXI.Sprite();scene.addChild(sprite);actors.push({sprite,speciesId:p.speciesId,anchor:anchors[i]});}
  }catch(error){scene.destroy({children:true});await Promise.allSettled([...loaded.keys()].map(src=>stage.PIXI.Assets.unload(src)));throw error;}
  let accumulator=0,disposed=false,elapsed=0;
  function apply(){for(const actor of actors){const cell=hudArt.getBattleFrame(actor.speciesId,sequence,elapsed);if(!cell)continue;
    actor.sprite.texture=loaded.get(cell.src);actor.sprite.anchor.set(cell.origin[0]/cell.width,cell.origin[1]/cell.height);}}
  function layout(){const {scale,left,top}=resultFrameLayout(stage.app.screen.width,stage.app.screen.height);
    for(const actor of actors){actor.sprite.scale.set(scale);actor.sprite.position.set(left+actor.anchor[0]*scale,top+actor.anchor[1]*scale);}}
  function update(ticker){if(disposed)return;
    if(globalThis.document?.hidden){accumulator=0;return;}
    accumulator+=Math.min(250,Math.max(0,ticker.deltaMS));
    while(accumulator+1e-9>=1000/60){accumulator-=1000/60;elapsed++;}apply();}
  stage.app.ticker.add(update);const resize=stage.onResize(layout);apply();layout();
  return {dispose(){if(disposed)return;disposed=true;resize();stage.app.ticker.remove(update);scene.destroy({children:true});void Promise.allSettled([...loaded.keys()].map(src=>stage.PIXI.Assets.unload(src)));}};
}
