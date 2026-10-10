// Owner-selected BM03 R2 local visual candidate. Alpha/height approximation,
// never original gameplay evidence or a physically reconstructed character mesh.
import {createPixiAssetScope} from './pixiCharacterRuntimeBundle.js';

const ROOT='assets/production/battle/bm03-volcano-review-r2/';
export function isBm03ShadowCandidate(fieldArt,location=globalThis.location) {
  return ['localhost','127.0.0.1','[::1]','::1'].includes(location?.hostname)
    && fieldArt?.field?.fieldId==='field_bm03_01'
    && fieldArt?.assetId==='art:battle:original-opus:v1:bm03-volcano-review-r2';
}

// The October stage batch reuses this same bounded loader and baked-pose
// cache. Scene-specific light/receiver data are selected only on local review.
export function resolveGroundShadowCandidateRoot(fieldArt,location=globalThis.location) {
  if(isBm03ShadowCandidate(fieldArt,location))return ROOT;
  if(!['localhost','127.0.0.1','[::1]','::1'].includes(location?.hostname)
    || fieldArt?.assetId!=='art:battle:original-opus:v1:stage-review-20261007')return null;
  const fieldId=fieldArt?.field?.fieldId;
  if(fieldId==='field_bm03_01')return ROOT; // preserve the existing R2 assets
  return /^field_bm(?:01|02|04|05|06|07|08|09|10|11)_01$/.test(fieldId??'')
    ? `assets/production/battle/stage-review-20261007/fields/${fieldId}/` : null;
}

// Coordinates are density-four source pixels relative to the stable native
// ground point. Apply the same origin rotation as the visible actor BEFORE the
// fixed-light projection. Neither facing nor rotation flips the sun direction.
export function projectBm03AlphaPoints(points,frame,baseBounds,facing,rotation,profile,light) {
  const cos=Math.cos(rotation),sin=Math.sin(rotation),cx=(baseBounds[0]+baseBounds[2])*2,by=baseBounds[3]*4;
  const posed=points.map(([x,y,a])=>{
    const sx=(x+frame.offset[0])*facing,sy=y+frame.offset[1];
    return [sx*cos-sy*sin-cx*facing,sx*sin+sy*cos-by,a];
  });
  const bodyHeight=Math.max(1,...posed.filter(p=>p[2]>32/255).map(p=>-p[1]));
  return posed.map(([x,y,a])=>{
    const distance=Math.max(0,Math.min(bodyHeight,-y-.5)),n=distance/bodyHeight;
    const fraction=profile[0]+(profile[1]-profile[0])*n*n*(3-2*n);
    const h=distance*fraction/light.verticalScale;
    return {x:x+h*light.fullDelta[0],y:y+h*light.fullDelta[1],a,h,
      contact:y>=-profile[2]&&y<=5 ? [x,Math.max(-1.25,Math.min(1.25,y*.25)),a] : null};
  });
}

export function bm03LiftProjection(heightNativePx,nativeScale,light) {
  const height=Math.max(0,heightNativePx??0)*4/light.verticalScale;
  return {x:height*light.groundDelta[0]*nativeScale/4,
    y:height*light.groundDelta[1]*nativeScale/4,
    contactAlpha:Math.max(0,1-Math.max(0,heightNativePx??0)/2)};
}

// Rotated native reactions retain the existing cheap blob until that exact
// pose has an approved pre-baked cast. No synchronous raster generation occurs
// on the Pixi ticker, including first use of a rare native reaction.
export const bm03CanUseBakedPose = rotation => rotation === 0;
export async function createBm03GroundShadows({PIXI,parent,fieldArt,href=globalThis.location?.href}) {
  const root=resolveGroundShadowCandidateRoot(fieldArt);
  if(!root)return null;
  const response=await fetch(new URL(root+'shadows.json',href));
  if(!response.ok)throw Error('BM03_SHADOW_METADATA_UNAVAILABLE');
  const data=await response.json(),scope=createPixiAssetScope(PIXI,href);
  const baked=new Map(),actors=new Map(),seen=new Set(),fallbacks=new Set();
  let layer,mask,disposed=false,created=0,released=0;
  const unload=()=>Promise.all([scope.Assets.unload(root+'receiver.png'),scope.Assets.unload(root+'stamps.png')]);
  const releaseViews=()=>{for(const b of baked.values())for(const t of b.textures){t.destroy();released++;}baked.clear();};
  try{
    const sheet=await scope.Assets.load(root+'stamps.png');sheet.source.scaleMode='linear';
    for(const [key,cells] of Object.entries(data.stamps)){
      const textures=cells.map(c=>new PIXI.Texture({source:sheet.source,frame:new PIXI.Rectangle(...c.rect)}));
      created+=textures.length;baked.set(key,{offsets:cells.map(c=>c.offset),textures});
    }
    const texture=await scope.Assets.load(root+'receiver.png');texture.source.scaleMode='linear';
    layer=new PIXI.Container({label:'bounded per-frame ground shadows'});mask=new PIXI.Sprite(texture);
    parent.addChild(layer,mask);layer.mask=mask;
  }catch(error){layer?.destroy({children:true});mask?.destroy();releaseViews();await unload();throw error;}
  return {
    begin(rect){
      if(disposed)return;
      mask.position.set(rect.x,rect.y);mask.width=rect.width;mask.height=rect.height;
      for(const a of actors.values())for(const s of a.sprites)s.visible=false;
    },
    update({slot,actor,motion,facing,rotation,x,y,nativeScale,heightNativePx,alpha}){
      const frame=data.frames[motion?.texture],entity=data.entities[actor.entityId];
      if(disposed||!frame||!entity||JSON.stringify(frame.geometry)!==JSON.stringify(motion.geometry))return false;
      if(!bm03CanUseBakedPose(rotation)){fallbacks.add('ROTATED_NATIVE_REACTION_USES_EXISTING_BLOB');return false;}
      const resource=actor.sprite.texture.source.resource;
      const sourceUrl=resource?.src??actor.sprite.texture.source.label??'';
      if(!sourceUrl.includes(entity.folder))return false;
      const stamp=baked.get(motion.texture+'|'+facing);if(!stamp)return false;
      seen.add(motion.texture);
      let a=actors.get(slot);
      if(!a){a={sprites:stamp.textures.map(t=>new PIXI.Sprite(t))};actors.set(slot,a);layer.addChild(...a.sprites);}
      const lift=bm03LiftProjection(heightNativePx,nativeScale,data),scale=nativeScale/4;
      a.sprites.forEach((s,i)=>{const offset=stamp.offsets[i];s.texture=stamp.textures[i];s.position.set(x+offset[0]*scale+(i===0?lift.x:0),y+offset[1]*scale+(i===0?lift.y:0));s.scale.set(scale);s.alpha=alpha*(i===1?lift.contactAlpha:1);s.visible=s.alpha>0;});
      a.sample={slot,entityId:actor.entityId,texture:motion.texture,facing,rotation,x,y,heightNativePx:heightNativePx??0,contactAlpha:lift.contactAlpha,castOffset:[lift.x,lift.y],sourceUrl};
      return true;
    },
    end(){for(const [slot,a] of actors)if(a.sprites.every(s=>!s.visible)){for(const s of a.sprites)s.destroy();actors.delete(slot);}},
    getDiagnostics:()=>({candidate:true,approximate:true,disposed,bakedPoses:baked.size,cacheEntries:0,created,released,generationMs:0,maxGenerationMs:0,rotatedFallback:'EXISTING_CHEAP_BLOB',fallbacks:[...fallbacks],seenFrames:[...seen],actors:[...actors.values()].map(a=>({...a.sample})),receiver:data.receiverPolicy??'GROUND_ONLY_SAME_CAMERA_NO_COLLISION_AUTHORITY',fieldId:fieldArt.field.fieldId,assetRoot:root}),
    async dispose(){if(disposed)return;disposed=true;for(const a of actors.values())for(const s of a.sprites)s.destroy();actors.clear();layer.mask=null;layer.destroy();mask.destroy();releaseViews();await unload();}
  };
}
