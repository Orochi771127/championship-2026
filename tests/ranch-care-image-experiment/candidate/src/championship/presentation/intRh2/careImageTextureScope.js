// Care-only candidate workaround: fresh HTML image resources, no worker bitmap cache.
export function createCareImageTextureScope(PIXI,{signal,createImage=()=>new Image()}={}) {
  const textures=new Set(),images=new Set(),pending=new Map();let disposed=false;
  const abortError=()=>signal?.reason??new DOMException('Care image scope disposed','AbortError');
  const requireLive=()=>{if(disposed||signal?.aborted)throw abortError();};
  function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const cancel of pending.values())cancel();pending.clear();for(const texture of textures)texture.destroy(true);textures.clear();for(const image of images)image.removeAttribute('src');images.clear();}
  signal?.addEventListener('abort',dispose,{once:true});if(signal?.aborted)dispose();
  async function load(url){
    requireLive();const image=createImage();images.add(image);image.crossOrigin='anonymous';image.decoding='async';
    let rejectAbort;const cancelled=new Promise((_,reject)=>{rejectAbort=reject;});pending.set(image,()=>rejectAbort(abortError()));
    try{
      image.src=url;await Promise.race([image.decode(),cancelled]);requireLive();
      if(!image.complete||!(image.naturalWidth>0&&image.naturalHeight>0))throw Error('CARE_IMAGE_DECODE_NOT_READY');
      const texture=PIXI.Texture.from(image,true);textures.add(texture);return texture;
    }catch(error){images.delete(image);image.removeAttribute('src');throw error;}
    finally{pending.delete(image);}
  }
  return Object.freeze({load,dispose});
}
