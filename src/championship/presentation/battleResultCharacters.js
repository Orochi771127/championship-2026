// OVL8 0210C438/444 selects Sub 9 for all-wins, otherwise Sub 5.
// 0210CCB0 advances those three bodies once per native result update.
export async function mountBattleResultCharacters({stage,hudArt,participants,won}){
  const scene=stage.createSceneRoot('native result characters');
  const anchors=[[46,151],[127,172],[210,154]]; // result_sub_scene.nxr digimon1..3
  const sequence=won?9:5,actors=[],loaded=new Map();
  try{for(const [i,p] of participants.slice(0,3).entries()){
    if(!p||!hudArt)continue;
    const cells=hudArt.getBattleCells(p.speciesId,sequence);if(!cells.length)continue;
    for(const c of cells)if(!loaded.has(c.src)){const texture=await stage.PIXI.Assets.load(c.src);texture.source.scaleMode='nearest';loaded.set(c.src,texture);}
    const sprite=new stage.PIXI.Sprite();scene.addChild(sprite);actors.push({sprite,speciesId:p.speciesId,anchor:anchors[i]});
  }}catch(error){scene.destroy({children:true});await Promise.allSettled([...loaded.keys()].map(src=>stage.PIXI.Assets.unload(src)));throw error;}
  let accumulator=0,disposed=false,elapsed=0;
  function apply(){for(const actor of actors){const cell=hudArt.getBattleFrame(actor.speciesId,sequence,elapsed);if(!cell)continue;
    actor.sprite.texture=loaded.get(cell.src);actor.sprite.anchor.set(cell.origin[0]/cell.width,cell.origin[1]/cell.height);}}
  function layout(){const scale=Math.min(stage.app.screen.width/256,stage.app.screen.height/192);
    const left=(stage.app.screen.width-256*scale)/2,top=(stage.app.screen.height-192*scale)/2;
    for(const actor of actors){actor.sprite.scale.set(scale);actor.sprite.position.set(left+actor.anchor[0]*scale,top+actor.anchor[1]*scale);}}
  function update(ticker){if(disposed)return;
    if(globalThis.document?.hidden){accumulator=0;return;}
    accumulator+=Math.min(250,Math.max(0,ticker.deltaMS));
    while(accumulator+1e-9>=1000/60){accumulator-=1000/60;elapsed++;}apply();}
  stage.app.ticker.add(update);const resize=stage.onResize(layout);apply();layout();
  return {dispose(){if(disposed)return;disposed=true;resize();stage.app.ticker.remove(update);scene.destroy({children:true});void Promise.allSettled([...loaded.keys()].map(src=>stage.PIXI.Assets.unload(src)));}};
}
