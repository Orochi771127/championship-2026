import {isOriginalRuntimeLocation,isOriginalLoopbackLocation} from './originalRuntimeLocation.js';
import {publicMetadataPath,loadPublicMetadata,validatePublicMetadata} from './publicMetadata.js';
// Static foreground from hash-locked CM03/CM24 masters and their unchanged final pixels.
// The local polish review (2026-10-19) keeps the CM03/CM24 frames unchanged.
const FINAL_CAGE_ASSET='art:cage:final-intake:20261008';
const POLISH_CAGE_ASSET='art:cage:polish-review:20261019';
// Geometry/collision/actor state stay with their existing owners.
const FIELDS=Object.freeze([
 {fieldId:'field_cm03_01',role:'cage-foreground-cm03',
  prefix:'assets/production/cage/cm03-r18-foreground-20261009/',width:1152,height:800,
  sourceHash:'b757e18558a44b0f2ebd3052ae9de508258cff9b4670fe3b8215fb55bf6d70df',
  masterHash:'9b5d847bc91c587413be5baf600501ab60820517a05742a4a53af13a8cf297f0',
  depthAuthority:'EXISTING_R18_MASTER_GROUND_PROJECTION',assetIds:[FINAL_CAGE_ASSET,POLISH_CAGE_ASSET]},
 {fieldId:'field_cm24_01',role:'cage-foreground-cm24',
  prefix:'assets/production/cage/cm24-final-foreground-20261010/',width:384,height:448,
  sourceHash:'601b05420d77f23fdc1dea75323ed350a85f11bb28068b77212c922989dd6146',
  masterHash:'dd731a1d27cec5cc19ecf67682e20a26bc3fd86c873f5e9e3c3b39b87ea28670',
  depthAuthority:'EXACT_FINAL_MASTER_Z0_CONTACT_GROUND_PROJECTION',assetIds:[FINAL_CAGE_ASSET,POLISH_CAGE_ASSET]},
 // Local review (2026-10-19): the athletics goal net. Wire pixels of the padded
 // runtime frame, stencilled from the reviewed master; strips take the goal
 // footprint's front edge in their column, so residents inside stand on the
 // floor behind the net and the gaps between wires stay open.
 {fieldId:'field_cm02_01',localManifest:'assets/production/cage/cm02-goal-foreground-20261019/manifest.json',stencilOnly:true,
  prefix:'assets/production/cage/cm02-goal-foreground-20261019/',width:768,height:800,
  sourceHash:'930dcd6253af5a9d26c71546ccdf0b420d7fd75c0ff5e66df0ed4218655ae6b0',
  masterHash:'469b1a6f6d261938e19dba0f335dffcfdc245f4903bb26a4de4e766c3aa0ebe2',
  depthAuthority:'GOAL_FOOTPRINT_FRONT_EDGE_MASTER_PROJECTION'},
 // The same goal net over the polish review's re-lit CM02 frame.
 {fieldId:'field_cm02_01',localManifest:'assets/production/cage/cm02-goal-foreground-polish-20261019/manifest.json',stencilOnly:true,
  prefix:'assets/production/cage/cm02-goal-foreground-polish-20261019/',width:768,height:800,assetIds:[POLISH_CAGE_ASSET],
  sourceHash:'b7760c89fb6c33104dbc39da104f48b5038b99e2592b74e191b5f1c4596a28d2',
  masterHash:'469b1a6f6d261938e19dba0f335dffcfdc245f4903bb26a4de4e766c3aa0ebe2',
  depthAuthority:'GOAL_FOOTPRINT_FRONT_EDGE_MASTER_PROJECTION'}
]);
// Visual padding is at most 8 native pixels at density four (32 world px).
const MAX_PADDING_WORLD_PX=32;
function eligible(config,manifest,placements,location){
 return isOriginalRuntimeLocation(location)&&(!config.localManifest||isOriginalLoopbackLocation(location))
  &&(config.assetIds??[FINAL_CAGE_ASSET]).includes(manifest?.assetId)
  &&manifest.fields?.find(f=>f.fieldId===config.fieldId)?.frames?.[0]?.sha256===config.sourceHash
  &&placements.some(p=>p.fieldId===config.fieldId);
}
export function cm03ForegroundEligible(manifest,placements,location=globalThis.location){
 return eligible(FIELDS[0],manifest,placements,location);
}
export function cm24ForegroundEligible(manifest,placements,location=globalThis.location){
 return eligible(FIELDS[1],manifest,placements,location);
}
export function cageForegroundPlan(data,placements,{unit=4,wrapWidthPx=null,fold=null,worldHeightPx=null,config:given=null}={}) {
  const config=given??FIELDS.find(f=>f.fieldId===data?.fieldId);
  const isPublic=data?.renderType==='CAGE_FOREGROUND';if(isPublic)validatePublicMetadata(data);
  if(!config||!isPublic&&(data.sourceComposite?.sha256!==config.sourceHash||data.masterSha256!==config.masterHash)||data.pixelScale!==unit
    ||data.width!==config.width||data.height!==config.height||!Array.isArray(data.objects))throw Error('CAGE_FOREGROUND_SOURCE_MISMATCH');
  const result=[];
  for(const p of placements.filter(p=>p.fieldId===data.fieldId)){
    const rect=p.sourceRect??{x:0,y:0,width:data.width,height:data.height};
    for(const o of data.objects){
      if((o.src!==undefined||!config.stencilOnly)&&(!o.src?.startsWith(config.prefix)||o.src.includes('..'))
        || ![o.x,o.y,o.width,o.height].every(Number.isInteger)||o.x<0||o.y<0||o.width<=0||o.height<=0
        ||o.x+o.width>data.width||o.y+o.height>data.height||!Number.isFinite(o.depthNative))throw Error('CAGE_FOREGROUND_PIECE_INVALID');
      const x=Math.max(o.x,rect.x),y=Math.max(o.y,rect.y),right=Math.min(o.x+o.width,rect.x+rect.width),bottom=Math.min(o.y+o.height,rect.y+rect.height);
      if(right<=x||bottom<=y)continue;
      if(!Array.isArray(o.maskRects)||o.maskRects.some(r=>!Array.isArray(r)||r.length!==4||!r.every(Number.isInteger)||r[0]<0||r[1]<0||r[2]<=0||r[3]<=0||r[0]+r[2]>o.width||r[1]+r[3]>o.height))throw Error('CAGE_FOREGROUND_MASK_INVALID');
      const maskRects=o.maskRects.flatMap(([rx,ry,rw,rh])=>{const left=Math.max(o.x+rx,x),top=Math.max(o.y+ry,y),endX=Math.min(o.x+rx+rw,right),endY=Math.min(o.y+ry+rh,bottom);
        return endX>left&&endY>top?[[left-rect.x,top-rect.y,endX-left,endY-top]]:[];});
      for(const repeat of !fold&&wrapWidthPx?[-wrapWidthPx,0,wrapWidthPx]:[0])result.push({id:o.id,src:o.src,fieldId:data.fieldId,
        tileX:p.x+repeat,tileY:p.y,sourceTileX:p.x,sourceTileY:p.y,maskRects,
        x:p.x+x-rect.x+repeat,y:p.y+y-rect.y,width:right-x,height:bottom-y,
        crop:{x:x-o.x,y:y-o.y,width:right-x,height:bottom-y},depth:(p.y-rect.y)/unit+o.depthNative,
        slotIndex:p.slotIndex??p.fragmentOfSlot??p.capOfSlot??null,repeat,
        ...(Number.isInteger(o.atlasX)&&Number.isInteger(o.atlasY)?{atlas:{x:o.atlasX,y:o.atlasY,originX:o.x-rect.x,originY:o.y-rect.y}}:{}),
        ...(fold?{foldCap:p.foldCap===true}:{})});
    }
  }
  if(!fold)return result;
  if(!['splitPx','ringPx','bandOffsetPx','capPx'].every(k=>Number.isFinite(fold[k]))
    ||fold.splitPx<=0||fold.ringPx<=fold.splitPx||fold.bandOffsetPx<=0||fold.capPx<0
    ||!Number.isFinite(worldHeightPx)||worldHeightPx<=0)throw Error('CAGE_FOREGROUND_FOLD_INVALID');
  // Match the tile-set owner's two band clips in the original ring space.
  // Keep the exact base quad; only its stencil and placement are projected.
  const bands=[{id:0,left:0,right:fold.splitPx,top:0,dx:0,dy:0},
    {id:1,left:fold.splitPx,right:fold.ringPx,top:-fold.capPx,dx:-fold.splitPx,dy:fold.bandOffsetPx}];
  return result.flatMap(piece=>bands.flatMap(band=>{
    if(piece.foldCap&&band.id!==1)return [];
    const maskRects=piece.maskRects.flatMap(([x,y,w,h])=>{
      const left=Math.max(x,band.left-piece.sourceTileX),top=Math.max(y,band.top-piece.sourceTileY);
      const right=Math.min(x+w,band.right-piece.sourceTileX),bottom=Math.min(y+h,worldHeightPx-piece.sourceTileY);
      return right>left&&bottom>top?[[left,top,right-left,bottom-top]]:[];
    });
    if(!maskRects.length)return [];
    return [{...piece,maskRects,foldBand:band.id,
      tileX:piece.tileX+band.dx,tileY:piece.tileY+band.dy,x:piece.x+band.dx,y:piece.y+band.dy,
      depthWorldPx:piece.depth*unit+band.dy}];
  }));
}
// Local-review manifests are fetched directly (never through the public index);
// cageForegroundPlan then checks their frame and master hashes.
async function loadLocalForeground(config,{fetchImpl,baseHref}){
  const response=await fetchImpl(new URL(config.localManifest,baseHref));
  if(!response.ok)throw Error('CAGE_FOREGROUND_LOCAL_MANIFEST_UNAVAILABLE');
  return response.json();
}
// Local review (2026-10-19): generated occluders for the other cages, one
// stencil per depth band from each reviewed master's ID render and ground
// contacts. Listed in a local index; never part of the public selection.
const LOCAL_REVIEWS=Object.freeze({
  [FINAL_CAGE_ASSET]:{tag:'20261019'},
  [POLISH_CAGE_ASSET]:{tag:'polish-20261019'}});
async function localReviewConfigs({manifest,location,fetchImpl,baseHref}){
  const review=LOCAL_REVIEWS[manifest?.assetId];
  if(!review||!isOriginalLoopbackLocation(location))return [];
  const dir=`assets/production/cage/foreground-review-${review.tag}/`;
  try{
    const response=await fetchImpl(new URL(dir+'index.json',baseHref));
    if(!response.ok)return [];
    const index=await response.json();
    if(index.assetId!==`art:cage:foreground-review:${review.tag}`||!Array.isArray(index.fields))return [];
    const curated=FIELDS.filter(c=>(c.assetIds??[FINAL_CAGE_ASSET]).includes(manifest.assetId));
    return index.fields.filter(f=>!curated.some(c=>c.fieldId===f.fieldId)&&typeof f.manifest==='string'
      &&f.manifest.startsWith(dir)&&!f.manifest.includes('..'))
      .map(f=>Object.freeze({fieldId:f.fieldId,localManifest:f.manifest,stencilOnly:true,assetIds:[manifest.assetId],
        prefix:dir,width:f.width,height:f.height,
        sourceHash:f.sourceHash,masterHash:f.masterHash,depthAuthority:index.depthAuthority}));
  }catch(error){console.warn('CHAMPIONSHIP_CAGE_FOREGROUND_REVIEW_INDEX_FALLBACK',error?.message);return [];}
}
export async function withCageForeground({PIXI,art,manifest,placements,location=globalThis.location,fetchImpl=globalThis.fetch,baseHref=globalThis.location?.href}) {
  const review=placements.some(p=>!FIELDS.some(c=>c.fieldId===p.fieldId&&(c.assetIds??[FINAL_CAGE_ASSET]).includes(manifest?.assetId)))
    ?await localReviewConfigs({manifest,location,fetchImpl,baseHref}):[];
  const selected=[...FIELDS,...review].filter(config=>eligible(config,manifest,placements,location));
  if(!selected.length)return art;
  const bundles=[];
  for(const config of selected){
   const data=config.localManifest?await loadLocalForeground(config,{fetchImpl,baseHref}):await loadPublicMetadata(config.role,{fetchImpl,baseHref}),plan=cageForegroundPlan(data,placements,{config,unit:art.field.nativePixelWorldScale,wrapWidthPx:art.field.wrapWidthPx,
     fold:art.field.fold??null,worldHeightPx:art.field.worldHeightPx});
   if(data.fieldId!==config.fieldId)throw Error('CAGE_FOREGROUND_SOURCE_MISMATCH');
   bundles.push({config,data,plan});
  }
  const plan=bundles.flatMap(bundle=>bundle.plan);
  // Generated review occluders ship their exact frame pixels in one atlas per
  // cage: plain sprites, no stencil, so per-frame resident sorting stays cheap.
  const atlases=new Map(),atlasLoads=[];
  try{
    for(const {data}of bundles){
      if(!data.atlas)continue;
      if(typeof data.atlas.src!=='string'||!/^assets\/production\/cage\/foreground-review-[a-z0-9-]+\//.test(data.atlas.src)||data.atlas.src.includes('..'))
        throw Error('CAGE_FOREGROUND_ATLAS_INVALID');
      atlasLoads.push(data.atlas.src);
      const texture=await PIXI.Assets.load(data.atlas.src);
      if(texture.width!==data.atlas.width||texture.height!==data.atlas.height)throw Error('CAGE_FOREGROUND_ATLAS_SIZE');
      atlases.set(data.fieldId,texture);
    }
  }catch(error){await Promise.allSettled(atlasLoads.map(src=>PIXI.Assets.unload(src)));throw error;}
  // Reuse the exact base tile quad/UVs. A packed RGB overlay at a 1.5-device-
  // pixel scale can pick the neighbouring texel at nearest-sampling ties.
  // Stencil geometry reveals the same shared texture without a colour filter,
  // extra decoded image, offscreen surface, or a second asset owner.
  // Index only quads owned by this art tree. Folded tiles live inside band
  // containers; caps live in the second band. No texture is loaded or owned here.
  // A padded frame's quad starts up to its padding before the placement on
  // exterior edges; match it there and offset the revealed sprite to it.
  const bases=[];
  const collect=object=>{
    if(object.texture&&object.label?.startsWith('runtime map art '))
      bases.push({fieldId:object.label.slice('runtime map art '.length),object});
    for(const child of object.children??[])collect(child);
  };
  collect(art.displayObject);
  const baseFor=piece=>{let best=null,bestD=Infinity;
    for(const {fieldId,object}of bases){const dx=piece.sourceTileX-object.x,dy=piece.sourceTileY-object.y;
      if(fieldId!==piece.fieldId||dx<0||dy<0||dx>MAX_PADDING_WORLD_PX||dy>MAX_PADDING_WORLD_PX)continue;
      if(dx+dy<bestD){best=object;bestD=dx+dy;}}
    return best;};
  const groups=[];let disposed=false,parent=null;
  try {
    for(const piece of plan){
      const atlas=piece.atlas?atlases.get(piece.fieldId):null;
      if(atlas){
        const root=new PIXI.Container({label:'cage foreground '+piece.id});root.zIndex=piece.depth;root.eventMode='none';
        for(const [mx,my,mw,mh] of piece.maskRects){
          const sprite=new PIXI.Sprite(new PIXI.Texture({source:atlas.source,
            frame:new PIXI.Rectangle(piece.atlas.x+mx-piece.atlas.originX,piece.atlas.y+my-piece.atlas.originY,mw,mh)}));
          sprite.x=mx;sprite.y=my;root.addChild(sprite);
        }
        groups.push({root,piece});continue;
      }
      const base=baseFor(piece);
      if(!base?.texture)throw Error('CAGE_FOREGROUND_BASE_TILE_MISSING');
      const root=new PIXI.Container({label:'cage foreground '+piece.id});root.zIndex=piece.depth;root.eventMode='none';
      const sprite=new PIXI.Sprite(base.texture);sprite.width=base.width;sprite.height=base.height;
      if(base.x!==piece.sourceTileX||base.y!==piece.sourceTileY){sprite.x=base.x-piece.sourceTileX;sprite.y=base.y-piece.sourceTileY;}
      const mask=new PIXI.Graphics();for(const rect of piece.maskRects)mask.rect(...rect);mask.fill(0xffffff);
      root.addChild(sprite,mask);sprite.mask=mask;groups.push({root,piece});
    }
  } catch(error){for(const {root}of groups)root.destroy({children:true});await Promise.allSettled(atlasLoads.map(src=>PIXI.Assets.unload(src)));throw error;}
  const foreground={
    attach(layer){parent=layer;for(const {root}of groups)layer.addChild(root);},
    syncViewport(fit){if(disposed)return;for(const {root,piece:p}of groups){
      root.position.set(fit.x+p.tileX*fit.scale,fit.y+p.tileY*fit.scale);root.scale.set(fit.scale);
      // Folded actors, food and waste sort by projected screen Y in the shared
      // actor layer. Unfolded ranches retain their original native-depth order.
      if(p.foldBand!==undefined)root.zIndex=Math.round(fit.y+p.depthWorldPx*fit.scale);
    }},
    getDiagnostics(){return {fieldId:bundles.length===1?bundles[0].data.fieldId:null,fieldIds:bundles.map(b=>b.data.fieldId),
      objectCount:bundles.reduce((n,b)=>n+b.data.objects.length,0),spriteCount:groups.length,
      deliveredPackedRgbaBytes:bundles.reduce((n,b)=>n+b.data.objects.reduce((n,o)=>n+o.width*o.height*4,0),0),additionalDecodedTextureBytes:bundles.reduce((n,b)=>n+(b.data.atlas?b.data.atlas.width*b.data.atlas.height*4:0),0),atlasCount:atlases.size,
      maskRectangleCount:plan.reduce((n,p)=>n+p.maskRects.length,0),sourceHash:bundles.length===1?bundles[0].config.sourceHash:null,
      sourceHashes:Object.fromEntries(bundles.map(b=>[b.data.fieldId,b.config.sourceHash])),disposed,
      depthAuthority:bundles.length===1?bundles[0].config.depthAuthority:'EXACT_MASTER_GROUND_PROJECTION_PER_FIELD',
      timer:'NONE',attached:Boolean(parent),sampling:'SHARED_BASE_QUAD_WITH_STENCIL'};}

  };
  return Object.freeze({...art,foreground,getDiagnostics(){return {...art.getDiagnostics(),foreground:foreground.getDiagnostics()};},
    async dispose(){if(disposed)return;disposed=true;for(const {root}of groups)if(!root.destroyed){root.parent?.removeChild(root);root.destroy({children:true});}
      parent=null;await Promise.allSettled(atlasLoads.map(src=>PIXI.Assets.unload(src)));await art.dispose();}});
}
