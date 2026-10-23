import {withSharedUnpackState} from './sharedGLState.mjs';
// One existing canvas/context/ticker. Never creates a context, RAF, or app.
// https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi
const owners=new WeakMap();
export function installSharedPass({app,threeRenderer,draw,onFailure}) {
  const pixi=app.renderer;
  if (owners.has(pixi)) throw new Error('HM02_SHARED_PASS_ALREADY_OWNED');
  if (threeRenderer.getContext()!==pixi.gl || threeRenderer.domElement!==app.canvas) throw new Error('HM02_CONTEXT_NOT_SHARED');
  const original=pixi.render;
  let disposed=false, inside=false, notificationError=null;
  function render(options,...args) {
    const root=options?.container??options;
    if (disposed || inside || root!==app.stage || options?.target || options?.renderTexture || args[0]?.renderTexture) return original.call(this,options,...args);
    inside=true;
    try {
      threeRenderer.resetState();
      const rendered=withSharedUnpackState(pixi.gl,draw);
      pixi.resetState();
      if(rendered===false)return original.call(this,options,...args);
      return original.call(this,{...(options?.container?options:{}),container:app.stage,clear:false},...args);
    } catch(error) {
      dispose();
      // Failure observers must not prevent native fallback drawing/restoration.
      try{onFailure?.(error);}catch(failure){notificationError=String(failure?.message??failure);}
      pixi.resetState();
      return original.call(this,options,...args);
    } finally {inside=false;}
  }
  function dispose() {
    if(disposed)return; disposed=true;
    if(pixi.render===render)pixi.render=original;
    owners.delete(pixi);
    // Shared context belongs to Pixi: NEVER forceContextLoss here.
  }
  owners.set(pixi,render);pixi.render=render;
  return {dispose,getDiagnostics:()=>({notificationError})};
}
