import {createPixiAssetScope} from './pixiCharacterRuntimeBundle.js';
import {reviewedNumericClip,sampleReviewedCharacterClip,createReviewedArenaPlayback} from './reviewedCharacterAnimation.js';
import {reviewedCharacterSelection,reviewedCharacterSelections} from './reviewedSelection.js';

export {reviewedCharacterSelection,reviewedCharacterSelections};
// The original atlas pages of these species are retired; only timing/geometry remain.
export const reviewedReplacesOriginal=(speciesId,href)=>reviewedCharacterSelection(speciesId,href)?.replacesOriginal===true;
export function reviewedSpeciesForEntity(config,bindings,baseUrl){
  const ids=[...new Set(bindings.filter(b=>b.entityId===config.entityId)
    .map(b=>reviewedCharacterSelection(b.speciesId,baseUrl)?.speciesId).filter(Boolean))];
  if(ids.length>1)throw Error('REVIEWED_ENTITY_CANONICAL_IDENTITY_CONFLICT');
  return ids[0]??config.speciesId;
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');

export async function attachReviewedCharacterAnimation({bundle,PIXI,speciesId,baseUrl,signal,usage='all',requiredNumeric=null,fetchImpl=globalThis.fetch}) {
  const entry=reviewedCharacterSelection(speciesId,baseUrl);
  if(!entry)return bundle;
  const url=new URL(entry.path,baseUrl).href;
  let document;
  try{
    const response=await fetchImpl(url,{signal});
    if(!response.ok)throw Error('REVIEWED_ANIMATION_HTTP_'+response.status);
    const text=await response.text();
    if(await digest(new TextEncoder().encode(text))!==entry.sha256)throw Error('REVIEWED_ANIMATION_HASH');
    document=JSON.parse(text);
    // The public manifest lists frames as [{id,...}]; the runtime reads them by id.
    if(Array.isArray(document.frames))document={...document,frames:Object.fromEntries(document.frames.map(({id,...f})=>[id,f]))};
    if(document.schemaVersion!==1||document.speciesId!==entry.speciesId||document.displayCode!==entry.displayCode
      ||!['REVIEWED_CHARACTER_ANIMATION_LOCAL','REVIEWED_CHARACTER_ANIMATION_PUBLIC'].includes(document.kind))throw Error('REVIEWED_ANIMATION_IDENTITY');
  }catch(error){await bundle.dispose();throw error;}
  if(requiredNumeric&&!reviewedNumericClip(document,requiredNumeric.side,requiredNumeric.id))return bundle;
  const scope=createPixiAssetScope(PIXI,baseUrl,{signal});
  const images=new Map(),textures=new Map(),geometry=new Map();
  const needed=new Set(usage==='all'?Object.keys(document.frames):document.clips.filter(c=>usage==='arena'?c.mode==='arena':c.mode!=='arena')
    .flatMap(c=>[...c.frames.map(f=>f.assetId),...(c.neutralReturn?[c.neutralReturn.assetId]:[])]));
  // web-v2 packs each mode on its own pages; a frame shared with Arena carries
  // an Arena page placement so one mode never downloads the other's pages.
  const frameEntries=Object.entries(document.frames).filter(([key])=>needed.has(key))
    .map(([key,f])=>[key,usage==='arena'&&f.arena?{...f,...f.arena}:f]);
  let disposed=false,disposal=null;
  const dispose=()=>disposal??=(async()=>{
    disposed=true;
    for(const texture of textures.values())texture.destroy(false);
    textures.clear();
    await Promise.allSettled([...images.keys()].map(key=>scope.Assets.unload(key)));
    images.clear();await bundle.dispose();
  })();
  try {
    const assets=[...new Map(frameEntries.map(([,f])=>[f.image,f])).values()];
    let next=0;
    const results=await Promise.allSettled(Array.from({length:Math.min(4,assets.length)},async()=>{
      while(next<assets.length){
        signal?.throwIfAborted();const frame=assets[next++];
        if(!/^(images|web-atlas-v1|web-atlas-v2)\/[a-f0-9]{64}\.(png|webp)$/.test(frame.image))throw Error('REVIEWED_IMAGE_PATH');
        const imageUrl=new URL(frame.image,url).href;
        // Check immutable reviewed bytes before decoding. Pixi owns decoding/cache.
        const result=await fetchImpl(imageUrl,{signal});if(!result.ok)throw Error('REVIEWED_IMAGE_HTTP_'+result.status);
        if(await digest(await result.arrayBuffer())!==frame.sha256)throw Error('REVIEWED_IMAGE_HASH');
        images.set(imageUrl,await scope.Assets.load(imageUrl));signal?.throwIfAborted();
      }
    }));
    const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
    // Presenters mirror reviewed art on the native flipBits, so General art must face
    // the way the native cells do. A set drawn facing the other way is selected with
    // generalMirror: its General frames load mirrored about the pivot (texture UVs,
    // trim, origin and bounds), leaving the reviewed pixels and manifest unchanged.
    const mirrorGeneral=usage==='general'&&entry.generalMirror===true;
    // Stage body size on General screens: generalDisplayScale (selection) draws a set
    // larger or smaller in native units by changing its effective density only.
    const displayScale=usage==='general'&&entry.generalDisplayScale>0?entry.generalDisplayScale:1;
    for(const [key,f] of frameEntries){
      const image=images.get(new URL(f.image,url).href),size=f.sourceSize;
      if(!size?.every(v=>Number.isFinite(v)&&v>0)||!f.origin?.every(Number.isFinite)||!(f.density>0))throw Error('REVIEWED_FRAME_GEOMETRY');
      const density=f.density/displayScale;
      const crop=f.frame??[0,0,...size],stored=f.trim??[0,0,...size];
      const trim=mirrorGeneral?[size[0]-stored[0]-stored[2],stored[1],stored[2],stored[3]]:stored;
      const origin=mirrorGeneral?[size[0]-f.origin[0],f.origin[1]]:f.origin;
      const source=image.source;
      if(crop[0]<0||crop[1]<0||crop[0]+crop[2]>source.pixelWidth||crop[1]+crop[3]>source.pixelHeight)throw Error('REVIEWED_FRAME_OUTSIDE_IMAGE');
      source.scaleMode='nearest';
      const texture=new PIXI.Texture({source,frame:new PIXI.Rectangle(...crop),orig:new PIXI.Rectangle(0,0,...size),
        trim:f.trim||mirrorGeneral?new PIXI.Rectangle(...trim):undefined,...(mirrorGeneral?{rotate:12}:{})});// 12 = groupD8.MIRROR_HORIZONTAL
      textures.set(key,texture);
      geometry.set(key,{scale:density,origin,sourceSize:size,blank:false,mirrored:mirrorGeneral,
        nativeBounds:[(trim[0]-origin[0])/density,(trim[1]-origin[1])/density,
          (trim[0]+trim[2]-origin[0])/density,(trim[1]+trim[3]-origin[1])/density]});
    }
    // Data Arena sizes a body to its role height from one constant reference, as native
    // art is sized from its standing frame: the median height of the facing-down walk.
    if(usage==='arena'){
      const walk=document.clips.find(c=>c.mode==='arena'&&c.direction==='D'&&['move','walk'].includes(c.action))
        ??document.clips.find(c=>c.mode==='arena'&&['move','walk'].includes(c.action));
      const heights=(walk?.frames??[]).map(f=>geometry.get(f.assetId)?.nativeBounds).filter(Boolean).map(b=>b[3]-b[1]).sort((a,b)=>a-b);
      const referenceHeight=heights.length?heights[heights.length>>1]:64;
      for(const g of geometry.values())g.referenceHeight=referenceHeight;
      // arenaGroundFromWalk (selection): a set whose Arena pivots sit inside the body
      // gets one ground correction per direction (median feet of that direction's
      // walk), applied to every action in the direction so relative motion is kept.
      if(entry.arenaGroundFromWalk===true){
        const moved=new Set();
        for(const dir of new Set(document.clips.filter(c=>c.mode==='arena').map(c=>c.direction))){
          // A clip without a heading (the static KO) grounds its own contact instead of a walk's.
          const reference=dir==null?document.clips.find(c=>c.mode==='arena'&&c.direction==null)
            :document.clips.find(c=>c.mode==='arena'&&c.direction===dir&&['move','walk'].includes(c.action));
          const feet=(reference?.frames??[])
            .map(f=>geometry.get(f.assetId)?.nativeBounds?.[3]).filter(Number.isFinite).sort((a,b)=>a-b);
          const shift=feet.length?feet[feet.length>>1]:0;
          if(!(shift>0))continue;
          for(const c of document.clips)if(c.mode==='arena'&&c.direction===dir)for(const f of c.frames){
            const g=geometry.get(f.assetId);if(!g||moved.has(f.assetId))continue;moved.add(f.assetId);
            g.origin=[g.origin[0],g.origin[1]+shift*g.scale];g.nativeBounds=[g.nativeBounds[0],g.nativeBounds[1]-shift,g.nativeBounds[2],g.nativeBounds[3]-shift];
            g.groundShift=shift;
          }
        }
      }
    }
    return Object.freeze({...bundle,reviewedAnimation:document,createActor(options={}){
      if(disposed)throw Error('REVIEWED_ANIMATION_DISPOSED');
      // A legacy entity can back more than one original species. The selected
      // artwork belongs to its canonical identity, never every entity alias.
      if(options.speciesId&&options.speciesId.replace(/^championship:creature:/,'')!==entry.speciesId)return bundle.createActor(options);
      const actor=bundle.createActor(options),sprite=actor.sprite;
      const baselineAnchor={x:sprite.anchor.x,y:sprite.anchor.y};
      const side=options.side??'main',baseline=bundle.runtime.sides[side]?.animations??[];
      const source=new Map(baseline.map(a=>[a.id,a]));
      let current=null;
      const restoreBaselineAnchor=()=>sprite.anchor.set(baselineAnchor.x,baselineAnchor.y);
      const apply=(sample)=>{
        if(!sample||!textures.has(sample.assetId))return null;
        const placement=geometry.get(sample.assetId),raw=sample.offset??[0,0],offset=placement.mirrored?[-raw[0],raw[1]]:raw;
        const adjusted={...placement,origin:placement.origin.map((v,i)=>v-offset[i]),
          nativeBounds:placement.nativeBounds.map((v,i)=>v+offset[i%2]/placement.scale)};
        sprite.texture=textures.get(sample.assetId);sprite.anchor.set(adjusted.origin[0]/placement.sourceSize[0],adjusted.origin[1]/placement.sourceSize[1]);
        current={...sample,geometry:adjusted,mirrorX:document.frames[sample.assetId].mirrorX===true,sourceFrameIndex:sample.frameIndex};return current;
      };
      const nativeApply=frame=>{
        restoreBaselineAnchor();
        const native=actor.nativeFramePresenter?.apply(frame)??null;
        const sequence=source.get(frame?.sequenceId),binding=reviewedNumericClip(document,side,frame?.sequenceId);
        // Owner 2026-10-28: a flipped native frame mirrors the reviewed artwork (the
        // presenter mirrors the sprite from flipBits) instead of showing the original.
        if(!frame||!sequence||!binding){current=null;return native;}
        const ticks=sequence.frames.slice(0,frame.frameIndex).reduce((n,f)=>n+f.ticks,0)+(frame.elapsedQ12??0)/4096;
        return {...native,...apply(sampleReviewedCharacterClip(document,side,frame.sequenceId,binding.clip,ticks*1000/60,{holdFirst:options.reducedMotion,nativeActive:frame.active,
          terminal:[15,25].includes(frame.sequenceId)&&['down','down_ko','bound_down'].includes(binding.clip.action)}))};
      };
      let id=options.animation??0,elapsed=0,fallbackId=null;
      const fallback=(deltaMS=0)=>{
        current=null;restoreBaselineAnchor();
        if(fallbackId!==id){fallbackId=id;return actor.controller?.setAnimation(id);}
        // Missing terminal drawings hold the existing legal source pose.
        return (side==='sub'?id===5:[15,25].includes(id))?actor.controller?.getSnapshot():actor.controller?.update?.({deltaMS});
      };
      const controller={setAnimation(value){id=value;elapsed=0;return this.update({deltaMS:0});},update({deltaMS=0}){
        elapsed+=Math.max(0,deltaMS);const binding=reviewedNumericClip(document,side,id);
        if(!binding)return fallback(deltaMS);
        const sample=apply(sampleReviewedCharacterClip(document,side,id,binding.clip,options.reducedMotion?0:elapsed,{holdFirst:options.reducedMotion,terminal:side==='sub'?id===5:[15,25].includes(id)}));
        if(!sample)return fallback(deltaMS);
        fallbackId=null;return sample;
      },getSnapshot:()=>current??actor.controller?.getSnapshot()};
      if(usage!=='arena')controller.update({deltaMS:0});
      const arenaPlayback=createReviewedArenaPlayback(document,{...options,nativeFallback:bundle.getDiagnostics?.().nativePixels!==false});
      const battleAnimator=actor.battleAnimator?{...actor.battleAnimator,apply(request){
        restoreBaselineAnchor();
        const native=actor.battleAnimator.apply(request),binding=reviewedNumericClip(document,side,request.sequenceId);
        if(!native||!binding){current=null;return native;}
        const sequence=source.get(request.sequenceId)??source.get(0);if(!sequence?.frames?.length){current=null;return native;}
        const ticks=sequence.frames.slice(0,native.frameIndex).reduce((n,f)=>n+f.ticks,0)+(native.elapsedQ12??0)/4096;
        const sample=apply(sampleReviewedCharacterClip(document,side,request.sequenceId,binding.clip,ticks*1000/60,{holdFirst:options.reducedMotion,nativeActive:native.active,
          terminal:[15,25].includes(request.sequenceId)}));
        return {...native,...sample,baseBounds:geometry.get(reviewedNumericClip(document,side,0)?.clip?.frames?.[0]?.assetId)?.nativeBounds??native.baseBounds};
      },getSnapshot:()=>current}:null;
      return Object.freeze({...actor,controller,
        nativeFramePresenter:actor.nativeFramePresenter?{...actor.nativeFramePresenter,apply:nativeApply,getSnapshot:()=>current}:null,
        battleAnimator,reviewedArena:{referenceHeight:[...geometry.values()][0]?.referenceHeight??null,
          observe:event=>arenaPlayback.observe(event),reset:()=>arenaPlayback.reset(),sample(state){
          const sample=arenaPlayback.sample(state);if(sample.fallbackSequenceId!==undefined){
            current=null;actor.controller?.setAnimation(sample.fallbackSequenceId);restoreBaselineAnchor();return sample;
          }
          return apply(sample)??sample;
        },getSnapshot:()=>current},
        sequencePlayer:options.nativeSequence?{advanceNative(delta){const native=actor.sequencePlayer.advanceNative(delta);elapsed+=delta/4096*1000/60;const sampled=controller.update({deltaMS:0});return {...native,...sampled};},getSnapshot:()=>({...actor.sequencePlayer.getSnapshot(),...current})}:actor.sequencePlayer});
    },getDiagnostics:()=>{
      const base=bundle.getDiagnostics(),sources=[...new Set([...images.values()].map(texture=>texture.source))];
      const pages=sources.map((source,i)=>({sourceIndex:(base.textureMemory?.sourceCount??0)+i,width:source.pixelWidth,height:source.pixelHeight,
        baseRgbaBytes:source.pixelWidth*source.pixelHeight*4,countedInEstimate:true,side:'reviewed',page:i}));
      const bytes=pages.reduce((n,p)=>n+p.baseRgbaBytes,0),memory=base.textureMemory;
      return {...base,...(memory?{textureMemory:{...memory,pageCount:memory.pageCount+pages.length,sourceCount:memory.sourceCount+sources.length,
        estimatedBaseRgbaBytes:memory.estimatedBaseRgbaBytes===null?null:memory.estimatedBaseRgbaBytes+bytes,atlasPages:[...memory.atlasPages,...pages]}}:{}),
        reviewedAnimation:{displayCode:entry.displayCode,loadedFrames:textures.size,loadedImages:images.size,estimatedBaseRgbaBytes:bytes,
          measurement:'BASE_RGBA8_ESTIMATE_NOT_GPU_USAGE',scope:entry.replacesOriginal===true?'REPLACES_ORIGINAL':'LOCAL_ONLY',usage,mainMirror:'MIRRORS_REVIEWED_ON_FLIPBITS'}};
    },dispose});
  }catch(error){await dispose();throw error;}
}

// The existing result scene owns this sprite, native result tick counter and
// ticker. Its HUD cells remain the legal fallback; no second scene is mounted.
export async function loadReviewedResultSub({PIXI,sprite,speciesId,sequenceId,baseUrl=globalThis.location?.href,signal,fetchImpl=globalThis.fetch}){
  if(!reviewedCharacterSelection(speciesId,baseUrl))return null;
  const baseline={runtime:{sides:{main:{animations:[]},sub:{animations:[]}}},
    createActor:()=>({sprite,controller:{setAnimation(){},getSnapshot:()=>null}}),getDiagnostics:()=>({}),async dispose(){}};
  const bundle=await attachReviewedCharacterAnimation({bundle:baseline,PIXI,speciesId,baseUrl,signal,fetchImpl,usage:'general',requiredNumeric:{side:'sub',id:sequenceId}});
  if(!bundle.reviewedAnimation){await bundle.dispose();return null;}
  const binding=reviewedNumericClip(bundle.reviewedAnimation,'sub',sequenceId);
  const actor=bundle.createActor({side:'sub',animation:sequenceId});
  const entry=reviewedCharacterSelection(speciesId,baseUrl),display=entry?.generalDisplayScale>0?entry.generalDisplayScale:1;
  const boxes=binding.clip.frames.map(f=>{
    const frame=bundle.reviewedAnimation.frames[f.assetId],trim=frame.trim??[0,0,...frame.sourceSize],offset=f.offset??[0,0],d=frame.density/display;
    const box={left:(trim[0]-frame.origin[0]+offset[0])/d,top:(trim[1]-frame.origin[1]+offset[1])/d,
      right:(trim[0]+trim[2]-frame.origin[0]+offset[0])/d,bottom:(trim[1]+trim[3]-frame.origin[1]+offset[1])/d};
    return entry?.generalMirror===true?{...box,left:-box.right,right:-box.left}:box;
  });
  let lastTick=0;
  return {bounds:{left:Math.min(...boxes.map(b=>b.left)),top:Math.min(...boxes.map(b=>b.top)),right:Math.max(...boxes.map(b=>b.right)),bottom:Math.max(...boxes.map(b=>b.bottom))},
    sample(nativeResultTicks){const deltaMS=Math.max(0,nativeResultTicks-lastTick)*1000/60;lastTick=nativeResultTicks;return actor.controller.update({deltaMS});},
    dispose:()=>bundle.dispose()};
}
