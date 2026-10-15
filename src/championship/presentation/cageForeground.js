import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';
// Static foreground from hash-locked CM03/CM24 masters and their unchanged final pixels.
// Geometry/collision/actor state stay with their existing owners.
const FIELDS=Object.freeze([
 {fieldId:'field_cm03_01',manifest:'assets/production/cage/cm03-r18-foreground-20261009/manifest.json',
  prefix:'assets/production/cage/cm03-r18-foreground-20261009/',width:1152,height:800,
  sourceHash:'b757e18558a44b0f2ebd3052ae9de508258cff9b4670fe3b8215fb55bf6d70df',
  masterHash:'9b5d847bc91c587413be5baf600501ab60820517a05742a4a53af13a8cf297f0',
  depthAuthority:'EXISTING_R18_MASTER_GROUND_PROJECTION'},
 {fieldId:'field_cm24_01',manifest:'assets/production/cage/cm24-final-foreground-20261010/manifest.json',
  prefix:'assets/production/cage/cm24-final-foreground-20261010/',width:384,height:448,
  sourceHash:'601b05420d77f23fdc1dea75323ed350a85f11bb28068b77212c922989dd6146',
  masterHash:'dd731a1d27cec5cc19ecf67682e20a26bc3fd86c873f5e9e3c3b39b87ea28670',
  depthAuthority:'EXACT_FINAL_MASTER_Z0_CONTACT_GROUND_PROJECTION'}
]);
// One reviewed derivative only: exact new bytes, original mask/master identity,
// fixed original dimensions and the PR35 padding contract. Never a generic hash bypass.
function reviewedNavyBase(config,field){
 const frame=field?.frames?.[0],reuse=field?.intake?.baseEdgeRefinement?.foregroundReuse;
 return config.fieldId==='field_cm03_01'
  &&frame?.sha256==='eb80baa5994fc2b9ff55c525a428cb5fbc979e4d447aa1d911e6d8fa3e8f7c45'
  &&frame.src==='assets/production/cage/navy-base-r1-20261015/fields/field_cm03_01/frame-00.webp'
  &&field.frames.length===1&&frame.rasterWidthPx===1216&&frame.rasterHeightPx===864
  &&field.worldWidthPx===1152&&field.worldHeightPx===800&&field.nativeWidthPx===288&&field.nativeHeightPx===200
  &&field.rasterPixelsPerNative===4&&['left','top','right','bottom'].every(k=>field.visualPaddingNative?.[k]===8)
  &&reuse?.sourceMasterSha256===config.masterHash&&reuse.maskManifest===config.manifest
  &&reuse.originalObjectGeometryUnchanged===true&&JSON.stringify(reuse.originalRasterOriginInPadded)==='[32,32]';
}
function eligible(config,manifest,placements,location){
 const field=manifest?.fields?.find(f=>f.fieldId===config.fieldId);
 return isOriginalRuntimeLocation(location)&&manifest?.assetId==='art:cage:final-intake:20261008'
  &&(field?.frames?.[0]?.sha256===config.sourceHash||reviewedNavyBase(config,field))
  &&placements.some(p=>p.fieldId===config.fieldId);
}
export function cm03ForegroundEligible(manifest,placements,location=globalThis.location){
 return eligible(FIELDS[0],manifest,placements,location);
}
export function cm24ForegroundEligible(manifest,placements,location=globalThis.location){
 return eligible(FIELDS[1],manifest,placements,location);
}
export function cageForegroundPlan(data,placements,{unit=4,wrapWidthPx=null,fold=null,worldHeightPx=null}={}) {
  const config=FIELDS.find(f=>f.fieldId===data?.fieldId);
  if(!config||data.sourceComposite?.sha256!==config.sourceHash||data.masterSha256!==config.masterHash||data.pixelScale!==unit
    ||data.width!==config.width||data.height!==config.height||!Array.isArray(data.objects))throw Error('CAGE_FOREGROUND_SOURCE_MISMATCH');
  const result=[];
  for(const p of placements.filter(p=>p.fieldId===data.fieldId)){
    const rect=p.sourceRect??{x:0,y:0,width:data.width,height:data.height};
    for(const o of data.objects){
      if((!o.src?.startsWith(config.prefix)||o.src.includes('..'))
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
export async function withCageForeground({PIXI,art,manifest,placements,location=globalThis.location,fetchImpl=globalThis.fetch,baseHref=globalThis.location?.href}) {
  const selected=FIELDS.filter(config=>eligible(config,manifest,placements,location));
  if(!selected.length)return art;
  const bundles=[];
  for(const config of selected){
   const response=await fetchImpl(new URL(config.manifest,baseHref));if(!response.ok)throw Error('CAGE_FOREGROUND_MANIFEST_HTTP_'+response.status);
   const data=await response.json(),plan=cageForegroundPlan(data,placements,{unit:art.field.nativePixelWorldScale,wrapWidthPx:art.field.wrapWidthPx,
     fold:art.field.fold??null,worldHeightPx:art.field.worldHeightPx});
   if(data.fieldId!==config.fieldId)throw Error('CAGE_FOREGROUND_SOURCE_MISMATCH');
   bundles.push({config,data,plan});
  }
  const plan=bundles.flatMap(bundle=>bundle.plan);
  // Reuse the exact base tile quad/UVs. A packed RGB overlay at a 1.5-device-
  // pixel scale can pick the neighbouring texel at nearest-sampling ties.
  // Stencil geometry reveals the same shared texture without a colour filter,
  // extra decoded image, offscreen surface, or a second asset owner.
  // Index only quads owned by this art tree. Folded tiles live inside band
  // containers; caps live in the second band. No texture is loaded or owned here.
  const bases=new Map();
  const key=(fieldId,x,y)=>`${fieldId}:${x}:${y}`;
  const collect=object=>{
    if(object.texture&&object.label?.startsWith('runtime map art ')){
      const fieldId=object.label.slice('runtime map art '.length),field=manifest.fields.find(f=>f.fieldId===fieldId);
      for(const p of placements.filter(p=>p.fieldId===fieldId)){
        const rect=p.sourceRect??{x:0,y:0,width:field.worldWidthPx,height:field.worldHeightPx};
        const padding=field.visualPaddingNative,unit=art.field.nativePixelWorldScale;
        const offsetX=padding&&rect.x===0?-padding.left*unit:0;
        const offsetY=padding&&rect.y===0?-padding.top*unit:0;
        if(object.x===p.x+offsetX&&object.y===p.y+offsetY)
          bases.set(key(fieldId,p.x,p.y),{base:object,offsetX,offsetY});
      }
    }
    for(const child of object.children??[])collect(child);
  };
  collect(art.displayObject);
  const groups=[];let disposed=false,parent=null;
  try {
    for(const piece of plan){
      const borrowed=bases.get(key(piece.fieldId,piece.sourceTileX,piece.sourceTileY)),base=borrowed?.base;
      if(!base?.texture)throw Error('CAGE_FOREGROUND_BASE_TILE_MISSING');
      const root=new PIXI.Container({label:'cage foreground '+piece.id});root.zIndex=piece.depth;root.eventMode='none';
      const sprite=new PIXI.Sprite(base.texture);sprite.width=base.width;sprite.height=base.height;
      // Masks/depths stay in nominal coordinates; only the borrowed padded quad moves.
      sprite.x=borrowed.offsetX;sprite.y=borrowed.offsetY;
      const mask=new PIXI.Graphics();for(const rect of piece.maskRects)mask.rect(...rect);mask.fill(0xffffff);
      root.addChild(sprite,mask);sprite.mask=mask;groups.push({root,piece});
    }
  } catch(error){for(const {root}of groups)root.destroy({children:true});throw error;}
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
      deliveredPackedRgbaBytes:bundles.reduce((n,b)=>n+b.data.objects.reduce((n,o)=>n+o.width*o.height*4,0),0),additionalDecodedTextureBytes:0,
      maskRectangleCount:plan.reduce((n,p)=>n+p.maskRects.length,0),sourceHash:bundles.length===1?bundles[0].config.sourceHash:null,
      sourceHashes:Object.fromEntries(bundles.map(b=>[b.data.fieldId,b.config.sourceHash])),
      baseSourceHashes:Object.fromEntries(bundles.map(b=>[b.data.fieldId,manifest.fields.find(f=>f.fieldId===b.data.fieldId).frames[0].sha256])),
      paddedBaseFieldIds:bundles.filter(b=>manifest.fields.find(f=>f.fieldId===b.data.fieldId).visualPaddingNative).map(b=>b.data.fieldId),disposed,
      depthAuthority:bundles.length===1?bundles[0].config.depthAuthority:'EXACT_MASTER_GROUND_PROJECTION_PER_FIELD',
      timer:'NONE',attached:Boolean(parent),sampling:'SHARED_BASE_QUAD_WITH_STENCIL'};}

  };
  return Object.freeze({...art,foreground,getDiagnostics(){return {...art.getDiagnostics(),foreground:foreground.getDiagnostics()};},
    async dispose(){if(disposed)return;disposed=true;for(const {root}of groups)if(!root.destroyed){root.parent?.removeChild(root);root.destroy({children:true});}
      parent=null;await art.dispose();}});
}

