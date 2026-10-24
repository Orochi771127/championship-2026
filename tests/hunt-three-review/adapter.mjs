// Explicit test-only compiler adapter. NEVER applied by the exact build.
// Every replacement must occur once in the pinned cf14c7ab overlay.
export const extraInputs=Object.freeze({'src/championship/presentation/vs2/huntThree/actionsReviewBridge.mjs':'bridge.mjs'});
const once=(source,before,after)=>{if(source.split(before).length!==2)throw Error('HUNT_ACTIONS_ADAPTER_ANCHOR_DRIFT');return source.replace(before,after);};
export function instrument(file,source){
 if(file==='src/championship/app/main.js'){
  source=once(source,'const scene = await mountHuntFieldPixiPresentation({\n          threePilot,',`const scene = await mountHuntFieldPixiPresentation({
          reviewAuthority:(ids=[])=>({screen:app.getScreen(),rng:app.getGameplayRngState(),persistent:app.getHuntPersistentState(),calendar:app.getCalendar(),cards:app.getHuntRuntime()?.getOnCardEntries()??[],records:ids.map(id=>app.getHuntRuntime()?.getCaptureRecord(id)??null),tool:app.getHuntRuntime()?.getToolState()??null,collection:app.getRaisingInstances().map(r=>({instanceId:r.instanceId,speciesId:r.speciesId,successAuthority:r.source?.successAuthority??null,profile:r.profile??null}))}),
          threePilot,`);
 }
 if(file==='src/championship/presentation/vs2/createHuntFieldPixiPresentation.js'){
  source="import {installHuntActionsProbe} from './huntThree/actionsReviewBridge.mjs';\n"+source;
  source=once(source,'  onActorFrame = null,','  onActorFrame = null,\n  reviewAuthority = null,');
  source=once(source,'  let threeActive = false;','  let threeActive = false;\n  let actionsProbe = null;');
  source=once(source,'    source.field.tick(ticker.deltaMS);','    const actionsStart=performance.now();\n    source.field.tick(ticker.deltaMS);\n    const actionsSimulationEnd=performance.now();');
  source=once(source,'    fieldArt?.update(ticker.deltaMS);','    const actionsSyncStart=performance.now();\n    fieldArt?.update(ticker.deltaMS);');
  source=once(source,'    render(ticker.deltaMS);','    render(ticker.deltaMS);\n    const actionsSyncEnd=performance.now();');
  source=once(source,'    for (const node of wildNodes.values()) node.characterController?.update(ticker);','    for (const node of wildNodes.values()) node.characterController?.update(ticker);\n    actionsProbe?.observe({wallMs:actionsStart,elapsedMS:ticker.elapsedMS,deltaMS:ticker.deltaMS,speed:ticker.speed,simulationMs:actionsSimulationEnd-actionsStart,presentationSyncMs:actionsSyncEnd-actionsSyncStart,charactersMs:performance.now()-actionsSyncEnd});');
  source=once(source,'  render();\n\n  return Object.freeze({',`  render();
  actionsProbe = installHuntActionsProbe({app,fieldArt,threePilot,
    getView:()=>source.field.getView({viewportWidth:app.screen.width,viewportHeight:app.screen.height}),
    getNodes:()=>wildNodes,getDrawOrder:()=>{actorLayer.sortChildren();return [...wildNodes].sort((a,b)=>actorLayer.children.indexOf(a[1])-actorLayer.children.indexOf(b[1])).map(([id])=>id);},
    renderPresentation:()=>render(),readAuthority:reviewAuthority});

  return Object.freeze({`);
  source=once(source,'      threePilot?.dispose();','      if(actionsProbe)actionsProbe.disposePilot(()=>threePilot?.dispose());else threePilot?.dispose();\n      actionsProbe?.dispose();');
 }
 if(file==='src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs'){
  source="import {actionsIdentity} from './actionsReviewBridge.mjs';\n"+source;
  source=once(source,'  const camera=new THREE.OrthographicCamera', '  let actionsReviewPass=[];\n  const camera=new THREE.OrthographicCamera');
  source=once(source,'    setReviewSuspended(value){',`    actionsReviewSnapshot(){return {rendererIdentity:actionsIdentity(renderer),reviewPass:actionsReviewPass,actors:[...actors].map(([id,a])=>({id,visible:a.visible,positions:[...a.geometry.attributes.position.array],opacity:a.material.opacity,tint:a.material.color.getHex(THREE.SRGBColorSpace),depthWrite:a.material.depthWrite,depthTest:a.material.depthTest,shadow:a.userData.shadow?{visible:a.userData.shadow.visible,opacity:a.userData.shadow.material.opacity,positions:[...a.userData.shadow.geometry.attributes.position.array]}:null}))};},
    // Instrumented-artifact-only reference render; never changes native state.
    actionsReviewRender({omitIds=[],depthReference=false,drawOrder=[],stress=null,unoccludedTarget=null}={},draw){
      if(!reviewHarness||typeof draw!=='function')throw Error('ACTIONS_REVIEW_ONLY');
      const saved=[],calls=[],originals=new Map();
      for(const name of ['setScissor','setScissorTest','clear','render']){const original=renderer[name];originals.set(name,original);renderer[name]=function(...args){if(calls.length<16)calls.push({method:name,args:name==='setScissor'?args.slice(0,4):name==='setScissorTest'?[Boolean(args[0])]:[]});return original.apply(this,args);};}
      try{for(const [id,a]of actors){saved.push([a,a.visible,a.material.depthWrite,a.renderOrder,a.userData.shadow?.visible,a.material.opacity,a.userData.shadow?.material.opacity,a.material.depthTest]);
        if(omitIds.includes(id)){a.visible=false;if(a.userData.shadow)a.userData.shadow.visible=false;}
        if(depthReference){a.material.depthWrite=false;a.renderOrder=drawOrder.indexOf(id)+1;}
        if(unoccludedTarget===id){a.material.depthTest=false;a.renderOrder=100000;}
        if(stress?.id===id){a.material.opacity=stress.opacity;if(a.userData.shadow)a.userData.shadow.material.opacity=stress.shadowOpacity;}
      }return draw();}finally{actionsReviewPass=calls;for(const [name,original]of originals)renderer[name]=original;for(const [a,visible,depthWrite,renderOrder,shadow,opacity,shadowOpacity,depthTest]of saved){a.visible=visible;a.material.depthWrite=depthWrite;a.material.depthTest=depthTest;a.renderOrder=renderOrder;a.material.opacity=opacity;if(a.userData.shadow){a.userData.shadow.visible=shadow;a.userData.shadow.material.opacity=shadowOpacity;}}}
    },
    setReviewSuspended(value){`);
 }
 return source;
}
