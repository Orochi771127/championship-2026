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
function eligible(config,manifest,placements,location){
 return isOriginalRuntimeLocation(location)&&manifest?.assetId==='art:cage:final-intake:20261008'
  &&manifest.fields?.find(f=>f.fieldId===config.fieldId)?.frames?.[0]?.sha256===config.sourceHash
  &&placements.some(p=>p.fieldId===config.fieldId);
}
export function cm03ForegroundEligible(manifest,placements,location=globalThis.location){
 return eligible(FIELDS[0],manifest,placements,location);
}
export function cm24ForegroundEligible(manifest,placements,location=globalThis.location){
 return eligible(FIELDS[1],manifest,placements,location);
}
export function cageForegroundPlan(data,placements,{unit=4,wrapWidthPx=null}={}) {
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
      for(const repeat of wrapWidthPx?[-wrapWidthPx,0,wrapWidthPx]:[0])result.push({id:o.id,src:o.src,fieldId:data.fieldId,
        tileX:p.x+repeat,tileY:p.y,sourceTileX:p.x,sourceTileY:p.y,maskRects,
        x:p.x+x-rect.x+repeat,y:p.y+y-rect.y,width:right-x,height:bottom-y,
        crop:{x:x-o.x,y:y-o.y,width:right-x,height:bottom-y},depth:(p.y-rect.y)/unit+o.depthNative,
        slotIndex:p.slotIndex??p.fragmentOfSlot??null,repeat});
    }
  }
  return result;
}
export async function withCageForeground({PIXI,art,manifest,placements,location=globalThis.location,fetchImpl=globalThis.fetch,baseHref=globalThis.location?.href}) {
  const selected=FIELDS.filter(config=>eligible(config,manifest,placements,location));
  if(!selected.length)return art;
  const bundles=[];
  for(const config of selected){
   const response=await fetchImpl(new URL(config.manifest,baseHref));if(!response.ok)throw Error('CAGE_FOREGROUND_MANIFEST_HTTP_'+response.status);
   const data=await response.json(),plan=cageForegroundPlan(data,placements,{unit:art.field.nativePixelWorldScale,wrapWidthPx:art.field.wrapWidthPx});
   if(data.fieldId!==config.fieldId)throw Error('CAGE_FOREGROUND_SOURCE_MISMATCH');
   bundles.push({config,data,plan});
  }
  const plan=bundles.flatMap(bundle=>bundle.plan);
  // Reuse the exact base tile quad/UVs. A packed RGB overlay at a 1.5-device-
  // pixel scale can pick the neighbouring texel at nearest-sampling ties.
  // Stencil geometry reveals the same shared texture without a colour filter,
  // extra decoded image, offscreen surface, or a second asset owner.
  const groups=[];let disposed=false,parent=null;
  try {
    for(const piece of plan){
      const base=art.displayObject.children.find(s=>s.label===`runtime map art ${piece.fieldId}`&&s.x===piece.sourceTileX&&s.y===piece.sourceTileY);
      if(!base?.texture)throw Error('CAGE_FOREGROUND_BASE_TILE_MISSING');
      const root=new PIXI.Container({label:'cage foreground '+piece.id});root.zIndex=piece.depth;root.eventMode='none';
      const sprite=new PIXI.Sprite(base.texture);sprite.width=base.width;sprite.height=base.height;
      const mask=new PIXI.Graphics();for(const rect of piece.maskRects)mask.rect(...rect);mask.fill(0xffffff);
      root.addChild(sprite,mask);sprite.mask=mask;groups.push({root,piece});
    }
  } catch(error){for(const {root}of groups)root.destroy({children:true});throw error;}
  const foreground={
    attach(layer){parent=layer;for(const {root}of groups)layer.addChild(root);},
    syncViewport(fit){if(disposed)return;for(const {root,piece:p}of groups){root.position.set(fit.x+p.tileX*fit.scale,fit.y+p.tileY*fit.scale);root.scale.set(fit.scale);}},
    getDiagnostics(){return {fieldId:bundles.length===1?bundles[0].data.fieldId:null,fieldIds:bundles.map(b=>b.data.fieldId),
      objectCount:bundles.reduce((n,b)=>n+b.data.objects.length,0),spriteCount:groups.length,
      deliveredPackedRgbaBytes:bundles.reduce((n,b)=>n+b.data.objects.reduce((n,o)=>n+o.width*o.height*4,0),0),additionalDecodedTextureBytes:0,
      maskRectangleCount:plan.reduce((n,p)=>n+p.maskRects.length,0),sourceHash:bundles.length===1?bundles[0].config.sourceHash:null,
      sourceHashes:Object.fromEntries(bundles.map(b=>[b.data.fieldId,b.config.sourceHash])),disposed,
      depthAuthority:bundles.length===1?bundles[0].config.depthAuthority:'EXACT_MASTER_GROUND_PROJECTION_PER_FIELD',
      timer:'NONE',attached:Boolean(parent),sampling:'SHARED_BASE_QUAD_WITH_STENCIL'};}

  };
  return Object.freeze({...art,foreground,getDiagnostics(){return {...art.getDiagnostics(),foreground:foreground.getDiagnostics()};},
    async dispose(){if(disposed)return;disposed=true;for(const {root}of groups)if(!root.destroyed){root.parent?.removeChild(root);root.destroy({children:true});}
      parent=null;await art.dispose();}});
}
