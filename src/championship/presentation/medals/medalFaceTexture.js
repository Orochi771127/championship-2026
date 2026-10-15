/** Own exactly one face texture; late completion cannot revive a closed view. */
export function createMedalFaceTexture({load,onReady,onError}) {
  let texture=null,disposed=false;
  const released=new Set();
  function release(value){if(value&&!released.has(value)){released.add(value);value.dispose();}}
  const loaded=load(value=>{
    if(disposed){release(value);if(value)value.image=null;return;}
    texture=value;onReady(value);
  },()=>{if(!disposed)onError();});
  texture??=loaded;
  if(disposed)release(texture);
  return Object.freeze({dispose(){if(disposed)return;disposed=true;release(texture);if(texture)texture.image=null;texture=null;}});
}
