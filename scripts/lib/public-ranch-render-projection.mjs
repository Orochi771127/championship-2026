import {PUBLIC_CHARACTER_RENDER_KIND,characterRenderAnimations} from '../../src/championship/presentation/publicCharacterRenderContract.js';

const pick=(value,fields)=>Object.fromEntries(fields.map(key=>[key,value[key]]));
export function publicRanchRenderProjection(source){
  if(source?.schemaVersion!==1||source.renderer!=='PIXIJS_V8_SPRITESHEET'
    ||source.streaming?.schemaVersion!==1||source.streaming.side!=='main')throw Error('RANCH_RENDER_SOURCE_SCHEMA');
  const profile=source.artProfile;
  return {schemaVersion:1,kind:PUBLIC_CHARACTER_RENDER_KIND,entityId:source.entityId,renderer:source.renderer,
    artProfile:{scale:profile.scale,filter:profile.filter,logicalCanvas:[...profile.logicalCanvas],
      anchor:pick(profile.anchor,['x','y'])},
    timing:{tickRateHz:source.timing.tickRateHz},
    sides:Object.fromEntries(['main','sub'].map(side=>[side,{
      // The descriptor serves main-only ranch streaming. Sub keeps its native
      // motion contract for equality validation, with no legacy atlas URLs.
      atlases:side==='main'?source.sides.main.atlases.map(row=>pick(row,['data','image'])):[],
      animations:characterRenderAnimations(source.sides[side].animations)}])),
    geometry:{frames:Object.fromEntries(Object.entries(source.reviewGeometry.frames).map(([key,value])=>[
      key,pick(value,['blank','scale','origin','sourceSize','nativeBounds'])]))},
    streaming:{schemaVersion:1,side:'main',texturePages:{...source.streaming.texturePages},
      pages:source.streaming.pages.map(row=>pick(row,['data','image','width','height','bytes','dataSha256','imageSha256'])),
      sourceRuntimeSha256:source.streaming.sourceRuntimeSha256,sourceImageSha256:source.streaming.sourceImageSha256}};
}
