// One existing canvas/context/ticker. Never creates a context, RAF, or app.
// https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi
const owners=new WeakMap();
export function installSharedPass({app,threeRenderer,draw,onFailure}) {
  const pixi=app.renderer;
  if (owners.has(pixi)) throw new Error('HM02_SHARED_PASS_ALREADY_OWNED');
  if (threeRenderer.getContext()!==pixi.gl || threeRenderer.domElement!==app.canvas) throw new Error('HM02_CONTEXT_NOT_SHARED');
  const original=pixi.render;
  let disposed=false, inside=false;
  function render(options,...args) {
    const root=options?.container??options;
    if (disposed || inside || root!==app.stage || options?.target || options?.renderTexture || args[0]?.renderTexture) return original.call(this,options,...args);
    inside=true;
    try {
      threeRenderer.resetState();
      draw();
      pixi.resetState();
      return original.call(this,{...(options?.container?options:{}),container:app.stage,clear:false},...args);
    } catch(error) {
      dispose(); onFailure(error); pixi.resetState();
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
  return {dispose};
}
