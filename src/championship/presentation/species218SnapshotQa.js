import {qaGate,createVerifiedSnapshotQaAdapter,verifyCandidateBytes} from './snapshotQaAdapter.js';
import {decodeSnapshotQaPng,snapshotQaCrop,snapshotQaPremultiply} from './snapshotQaPng.js';
import {stageBodyScale} from './stageBodySize.js';

const SPECIES='species-218', ENTITY='m535_slayerdramon';
const ROOT='assets/production/internal-character-review/species218-snapshot-qa-v1/';
const MANIFEST_HASH='11cf1e1d295176e648ab7e9da60929033d00680afac60952e139b901a5b18719';
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const canonical=id=>String(id??'').replace(/^championship:creature:/,'');
const events=runtime=>Object.fromEntries(Object.entries(runtime.sides).map(([side,v])=>[side,v.animations.map(s=>({id:s.id,mode:s.playbackMode,frames:s.frames.map(f=>({texture:f.texture,ticks:f.ticks}))}))]));

// Actual General loader seam. Default, production, Arena and other identities
// are exact no-ops and never request these local-only candidate files.
export async function attachSpecies218SnapshotQa({bundle,PIXI,speciesId,baseUrl,signal,usage,fetchImpl=globalThis.fetch}) {
  if(usage!=='general'||canonical(speciesId)!==SPECIES||!qaGate(baseUrl))return bundle;
  const sources=[],textures=new Map();let disposed=false,disposal=null;
  const release=()=>{for(const t of textures.values())t.destroy(false);textures.clear();for(const s of sources)s.destroy();sources.length=0;};
  const read=async name=>{
    signal?.throwIfAborted();
    const response=await fetchImpl(new URL(ROOT+name,baseUrl).href,{signal});
    if(!response.ok)throw Error('SNAPSHOT_QA_HTTP_'+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());signal?.throwIfAborted();return bytes;
  };
  try {
    if(bundle.runtime?.entityId!==ENTITY)throw Error('SNAPSHOT_QA_ENTITY');
    const raw=await read('manifest.json');if(await sha(raw)!==MANIFEST_HASH)throw Error('SNAPSHOT_QA_MANIFEST_HASH');
    const manifest=JSON.parse(new TextDecoder().decode(raw));
    const [assemblyBytes,runtimeBytes]=await Promise.all([read('candidate-assembly.json'),read('public-runtime.json')]);
    const adapter=await createVerifiedSnapshotQaAdapter({url:baseUrl,manifest,assemblyBytes,runtimeBytes});
    const runtime=JSON.parse(new TextDecoder().decode(runtimeBytes));
    if(JSON.stringify(events(bundle.runtime))!==JSON.stringify(events(runtime)))throw Error('SNAPSHOT_QA_OWNER_EVENTS_CHANGED');
    const stageScale=stageBodyScale(SPECIES);
    if(Object.values(manifest.records).some(r=>r.stageScale!==stageScale))throw Error('SNAPSHOT_QA_STAGE_SIZE_CHANGED');
    const assembly=JSON.parse(new TextDecoder().decode(assemblyBytes));
    const images=new Map(),geometry=new Map();
    for(const [key,record] of Object.entries(manifest.records)) {
      let image=images.get(record.fileSha256);
      if(!image){
        const bytes=await read('images/'+record.fileSha256+'.png');
        if(await sha(bytes)!==record.fileSha256)throw Error('SNAPSHOT_QA_IMAGE_HASH');
        image={bytes,...await decodeSnapshotQaPng(bytes)};images.set(record.fileSha256,image);
      }
      const pair=assembly.sequences.flatMap(s=>s.frames.map(f=>({s,f}))).find(({f})=>f.candidate_record===key);
      const draw=adapter.getDrawSpec({speciesId:SPECIES,entityId:ENTITY,side:pair.s.key.split(':')[0],sequenceId:Number(pair.s.key.split(':')[1]),frameIndex:pair.f.ordinal,elapsedQ12:0,active:1,flipBits:0});
      const rgba=snapshotQaCrop(image,record.rect);
      await verifyCandidateBytes(draw,{fileBytes:image.bytes,cropRgbaBytes:rgba});signal?.throwIfAborted();
      const [, ,width,height]=record.rect;
      const source=new PIXI.BufferImageSource({resource:snapshotQaPremultiply(rgba),width,height,resolution:1,format:'rgba8unorm',alphaMode:'premultiplied-alpha',scaleMode:'linear',autoGenerateMipmaps:true});
      sources.push(source);
      textures.set(key,new PIXI.Texture({source,frame:new PIXI.Rectangle(0,0,width,height),orig:new PIXI.Rectangle(0,0,width,height)}));
      const scale=record.density/stageScale;
      // Replaces native geometry (which already contains its stage scaling).
      // Do not multiply the scene or sprite a second time by stageScale.
      let left=width,top=height,right=0,bottom=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
      geometry.set(key,Object.freeze({scale,origin:[...record.origin],sourceSize:[width,height],blank:right===0,
        nativeBounds:[(left-record.origin[0])/scale,(top-record.origin[1])/scale,(right-record.origin[0])/scale,(bottom-record.origin[1])/scale]}));
    }
    signal?.throwIfAborted();
    return Object.freeze({...bundle,
      createActor(options={}) {
        if(disposed)throw Error('SNAPSHOT_QA_DISPOSED');
        const actor=bundle.createActor(options);
        if(canonical(options.speciesId??speciesId)!==SPECIES||!actor.nativeFramePresenter)return actor;
        const side=options.side??'main';let current=null;
        const presenter=Object.freeze({...actor.nativeFramePresenter,
          apply(frame) {
            if(disposed)throw Error('SNAPSHOT_QA_DISPOSED');
            if(!frame){current=actor.nativeFramePresenter.apply(frame);return current;}
            if(frame.speciesIndex!==undefined&&frame.speciesIndex!==218)throw Error('SNAPSHOT_QA_OWNER_IDENTITY');
            const draw=adapter.getDrawSpec({speciesId:SPECIES,entityId:ENTITY,side,sequenceId:frame.sequenceId,
              frameIndex:options.reducedMotion?0:frame.frameIndex,elapsedQ12:frame.elapsedQ12,active:frame.active,flipBits:frame.flipBits});
            const native=actor.nativeFramePresenter.apply(frame);current=native;
            if(!native)return native;
            if(draw.kind!=='QA_CANDIDATE_DESCRIPTOR')return native;
            actor.sprite.texture=textures.get(draw.representative);
            current=Object.freeze({...native,geometry:geometry.get(draw.representative),snapshotQa:{status:'HOLD',runtimeApproved:false,
              representative:draw.representative,eventOrdinal:draw.eventOrdinal,rawTicks:draw.rawTicks,rawMode:draw.rawMode,timebase:draw.timebase}});
            return current;
          },getSnapshot:()=>current});
        return Object.freeze({...actor,nativeFramePresenter:presenter});
      },
      getDiagnostics:()=>{
        const base=bundle.getDiagnostics?.()??{},memory=base.textureMemory;
        const pages=sources.map((s,i)=>({sourceIndex:(memory?.sourceCount??0)+i,width:s.pixelWidth,height:s.pixelHeight,
          baseRgbaBytes:s.pixelWidth*s.pixelHeight*4,countedInEstimate:true,side:'snapshot-qa',page:i}));
        const bytes=pages.reduce((n,p)=>n+p.baseRgbaBytes,0);
        return {...base,...(memory?{textureMemory:{...memory,pageCount:memory.pageCount+pages.length,sourceCount:memory.sourceCount+pages.length,
          estimatedBaseRgbaBytes:memory.estimatedBaseRgbaBytes===null?null:memory.estimatedBaseRgbaBytes+bytes,atlasPages:[...memory.atlasPages,...pages]}}:{}),
          snapshotQa:{status:'HOLD',runtimeApproved:false,loadedFrames:textures.size,estimatedBaseRgbaBytes:bytes,
            browserObserved:false,scope:'GENERAL_NATIVE_SNAPSHOT_ONLY'}};
      },
      dispose(){return disposal??=(async()=>{disposed=true;release();await bundle.dispose();})();}
    });
  } catch(error) {release();await bundle.dispose?.();throw error;}
}
