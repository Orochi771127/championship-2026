// Keep Three.js out of the collection grid and locked details. An abandoned
// module load must not create a renderer on a closed or replaced detail.
export function mountSelectedMedalPresentation({host,src,presentationProfile,onState=()=>{},load=()=>import('./medalThreePresentation.js')}={}) {
  let disposed=false,presentation=null,state='loading';
  function report(value){if(disposed)return;state=value;onState(value);}
  report('loading');
  Promise.resolve().then(()=>disposed?null:load()).then(module=>{
    if(disposed||!module)return;
    presentation=module.mountMedalThreePresentation({host,src,presentationProfile,onState:report});
    if(disposed)presentation?.dispose();
  }).catch(()=>report('fallback'));
  return Object.freeze({
    reset(){presentation?.reset();},
    dispose(){if(disposed)return;disposed=true;presentation?.dispose();presentation=null;},
    getDiagnostics(){return {state,disposed,...presentation?.getDiagnostics()};}
  });
}
