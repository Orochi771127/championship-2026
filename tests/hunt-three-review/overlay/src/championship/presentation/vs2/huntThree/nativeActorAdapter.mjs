import {actorLocalQuad} from './actorBounds.mjs';

// Read-only bridge from the existing Hunt presenter. Never apply a frame, tick
// animation, infer anatomical feet, or mutate the native simulation here.
export function nativeActorRecord(wild,node,{required=true}={}) {
  const sprite=node?.characterSprite,frame=node?.nativeFramePresenter?.getSnapshot();
  if(!sprite)throw new Error('HM02_EXISTING_NATIVE_SPRITE_REQUIRED');
  if(required && (frame?.authority!=='HUNT_CHARACTER_PRESENTATION.v1' || !frame.geometry))
    throw new Error('HM02_NATIVE_FRAME_AUTHORITY_REQUIRED');
  for(const n of [node,sprite,node.contactShadow]) {
    if(!n || (n.rotation??0)!==0 || (n.skew?.x??0)!==0 || (n.skew?.y??0)!==0)
      throw new Error('HM02_UNSUPPORTED_ACTOR_TRANSFORM');
  }
  if(![wild.worldX,wild.worldY,wild.worldZ??0,node.scale.x,node.scale.y].every(Number.isFinite))
    throw new Error('HM02_INVALID_NATIVE_COORDINATES');
  const hidden=sprite.visible===false || node.visible===false || frame?.geometry?.blank===true;
  const opacity=(node.alpha??wild.passageAlpha??1)*(sprite.alpha??1);
  if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error('HM02_INVALID_NATIVE_ALPHA');
  if(!Array.isArray(node.threeContactEllipses))throw new Error('HM02_EXISTING_SHADOW_BINDING_REQUIRED');
  return {wild,node,sprite,frame,hidden,opacity,quad:hidden?null:actorLocalQuad(node)};
}

// Apply the very same Pixi shadow-local + node transforms. Existing owner
// cancels worldZ / vertical mirrors; this bridge must not cancel them twice.
export function nativeShadowPoint(wild,node,x,y) {
  const shadow=node.contactShadow;
  const point=[wild.worldX+((shadow.x??0)+x*shadow.scale.x)*node.scale.x,
    wild.worldY-(wild.worldZ??0)+((shadow.y??0)+y*shadow.scale.y)*node.scale.y];
  if(!point.every(Number.isFinite))throw new Error('HM02_INVALID_NATIVE_SHADOW_TRANSFORM');
  return point;
}
