// Original fixed-camera tournament geometry. Owner-authorized test checkpoint.
import {createPixiAssetScope}from '../pixiCharacterRuntimeBundle.js';
import {publicMetadataPath,loadPublicMetadata} from '../publicMetadata.js';
export const TOURNAMENT_STONE_URL=publicMetadataPath('arena-tournament');
export async function loadTournamentStoneArt({PIXI,map,quality='high',href,signal,fetchImpl}){
 const scope=createPixiAssetScope(PIXI,href,{signal}),held=new Set(),textures=new Map();let disposed=false;
 const load=async src=>{held.add(src);return scope.Assets.load(src);};
 const dispose=async()=>{if(disposed)return;disposed=true;await Promise.allSettled([...held].map(src=>scope.Assets.unload(src)));held.clear();};
 try{
  const manifest=await loadPublicMetadata('arena-tournament',{baseHref:href,signal,fetchImpl}),tier=quality==='low'?'low':'high';
  if(manifest.kind!=='TOURNAMENT_STONE'||manifest.renderType!=='ARENA_TOURNAMENT'||manifest.layoutSignature!==JSON.stringify(map))throw Error('TOURNAMENT_STONE_LAYOUT_MISMATCH');
  const records=[...manifest.ground.map(r=>r.textures[tier]),manifest.foreground.textures[tier],...['props','dynamicProps'].flatMap(key=>manifest[key].flatMap(p=>Object.values(p.states).map(r=>r.textures[tier]))),...['crowd','pennants'].flatMap(key=>manifest[key].map(r=>r.textures[tier])),manifest.waves[tier]];
  const unique=[...new Map(records.map(r=>[r.src,r])).values()];
  for(let i=0;i<unique.length;i+=4){const result=await Promise.allSettled(unique.slice(i,i+4).map(async r=>textures.set(r.src,await load(r.src))));const failure=result.find(r=>r.status==='rejected');if(failure)throw failure.reason;if(signal?.aborted)throw signal.reason??Error('TOURNAMENT_STONE_ABORTED');}
  return{manifest,textures,tier,dispose,propArt:new Map(manifest.dynamicProps.map(p=>[p.id,{...p,textures,tier}]))};
 }catch(error){await dispose();throw error;}
}
export function mountTournamentStoneArt({PIXI,environment,ground,objects,water,bridge}){
 const{manifest:m,textures,tier}=environment;
 const make=(record,parent,zIndex)=>{const sprite=new PIXI.Sprite(textures.get(record.textures[tier].src));sprite.position.set(record.x,record.y);sprite.width=record.width;sprite.height=record.height;if(zIndex!==undefined)sprite.zIndex=zIndex;parent.addChild(sprite);return{...record,sprite};};
 const tiles=m.ground.map(r=>make(r,ground));const foreground=make(m.foreground,objects,640);const covers=m.props.map(p=>({...make(p.states.INTACT,objects,p.sortY),id:p.id,sortY:p.sortY,rect:p.rect}));
 for(const child of water.removeChildren())child.destroy();
 const waves=m.world.cols===24?[[0,512,320,128],[448,512,640,128],[1216,512,320,128]].map(([x,y,w,h])=>{
  const sprite=new PIXI.TilingSprite({texture:textures.get(m.waves[tier].src),width:w,height:h-28});sprite.position.set(x,y+24);sprite.alpha=.18;sprite.tileScale.set(tier==='low'?2:1);water.addChild(sprite);return sprite;
 }):[];
 const crowd=make(m.crowd[0],objects,127),pennants=make(m.pennants[0],objects,127.1);let crowdFrame=0,pennantFrame=0;
 return{
  update({elapsed,reducedMotion,left,right,top,bottom,low,focus,reaction}){
   for(const r of[...tiles,...covers,foreground,crowd,pennants])r.sprite.visible=r.x<right&&r.x+r.width>left&&r.y<bottom&&r.y+r.height>top;
   const speed=reaction?.t>0?1.5:1;
   crowdFrame=reducedMotion?0:Math.floor(elapsed*1000*speed/(m.frameDurationMs.crowd*(low?2:1)))%m.crowd.length;
   pennantFrame=reducedMotion?0:Math.floor(elapsed*1000/(m.frameDurationMs.pennants*(low?2:1)))%m.pennants.length;
   crowd.sprite.texture=textures.get(m.crowd[crowdFrame].textures[tier].src);pennants.sprite.texture=textures.get(m.pennants[pennantFrame].textures[tier].src);
   for(const s of waves){s.visible=bottom>512&&top<640;s.tilePosition.x=reducedMotion?0:elapsed*(low?3:5);s.tilePosition.y=reducedMotion?0:Math.sin(elapsed*.4)*2;}
   for(const p of covers){const[c,r,w,h]=p.rect;const behind=focus&&focus.y<(r+h)*64&&focus.y>r*64-72&&focus.x>c*64-12&&focus.x<(c+w)*64+12;p.sprite.alpha=behind?.5:1;}
  },
  diagnostics:()=>({id:m.id,tier,scope:m.scope,groundChunks:tiles.length,visibleGroundChunks:tiles.filter(r=>r.sprite.visible).length,props:covers.length,crowdCount:m.crowdCount,crowdFrame,pennantFrame,decodedBytes:m.decodedBytes[tier],waterOffsetX:waves[0]?.tilePosition.x??0,occluders:covers.map(r=>({id:r.id,sortY:r.sortY,alpha:r.sprite.alpha,drawIndex:objects.children.indexOf(r.sprite)}))})
 };
}
