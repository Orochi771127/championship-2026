import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const args=process.argv.slice(2),opt=n=>args[args.indexOf(n)+1];
const input=opt('--input'),output=opt('--output'),expected=opt('--expected-sha');
if(!args.includes('--input')||!args.includes('--output')||!args.includes('--expected-sha')||!input||!output||!/^[a-f0-9]{64}$/.test(expected??''))throw Error('REQUIRED_INPUT_OUTPUT_SHA');
if(path.resolve(input)===path.resolve(output))throw Error('REFUSE_SOURCE_OVERWRITE');
const source=fs.readFileSync(input,'utf8'),sha=crypto.createHash('sha256').update(source).digest('hex');
if(sha!==expected)throw Error('SOURCE_HASH_MISMATCH:'+sha);
function once(s,n,r){if(s.split(n).length!==2)throw Error('NON_UNIQUE_SEAM:'+n);return s.replace(n,r);}
let patched=once(source,'    entry.shadow.clear();',`    entry.testOnlyContactDiagnostic={
      kind:'TEST_ONLY_CHOSEN_PRODUCTION_SHADOW',entityId:entry.entityId,speciesId:entry.speciesId,
      mode:geometry.reviewedContactShadow?'reviewed':geometry.contactShadow?'egg':'fallback',
      ellipses:(geometry.reviewedContactShadow??[contact]).map(v=>({...v})),
      visible:{...visible},
      contactShadowArt:entry.contactShadowArt??null
    };
    entry.shadow.clear();`);
patched=once(patched,'  const careImageTextures=createCareImageTextureScope(stage.PIXI,{signal:lifetime.signal});',`  globalThis.__startupProvenance.markSignal(lifetime.signal,'FOREGROUND_RAISING_SCOPE',{stack:new Error().stack});
  const testOriginalScopedLoad=PIXI.Assets.load;
  PIXI.Assets.load=function(value){globalThis.__startupProvenance.recordDemand(value,lifetime.signal);return Reflect.apply(testOriginalScopedLoad,this,arguments);};
  const careImageTextures=createCareImageTextureScope(stage.PIXI,{signal:lifetime.signal});`);
patched=once(patched,'          bodyTop,footY:entry.root.y,',`          testOnlyContactDiagnostic:(()=>{const s=entry.nativeFramePresenter?.getSnapshot();entry.shadow.toGlobal(new PIXI.Point(0,0));return {
            ...entry.testOnlyContactDiagnostic,
            frame:s?{sequenceId:s.sequenceId,cell:s.cell,texture:s.texture,flipX:s.flipX,flipY:s.flipY,geometry:s.geometry}:null,
            nativeLift:entry.visualLift??0,groundAdmission:entry.root.threeGroundAdmission??null,supportOwner:entry.root.threeSupportOwner??null,
            root:{x:entry.root.x,y:entry.root.y,scaleX:entry.root.scale.x,scaleY:entry.root.scale.y},
            shadowParentIsRoot:entry.shadow.parent===entry.root,
            shadowLocalMatrix:((m)=>({a:m.a,b:m.b,c:m.c,d:m.d,tx:m.tx,ty:m.ty}))(entry.shadow.localTransform),rootLocalMatrix:((m)=>({a:m.a,b:m.b,c:m.c,d:m.d,tx:m.tx,ty:m.ty}))(entry.root.localTransform),parentWorldMatrix:((m)=>({a:m.a,b:m.b,c:m.c,d:m.d,tx:m.tx,ty:m.ty}))(entry.root.parent.getGlobalTransform(new PIXI.Matrix(),false)),
            shadow:{x:entry.shadow.x,y:entry.shadow.y,scaleX:entry.shadow.scale.x,scaleY:entry.shadow.scale.y,visible:entry.shadow.visible},
            ellipseScreen:(entry.testOnlyContactDiagnostic?.ellipses??[]).map(e=>{const p=entry.shadow.toGlobal(new PIXI.Point(e.x,e.y));return {x:p.x,y:p.y};})
          };})(),
          bodyTop,footY:entry.root.y,`);
patched=once(patched,'  let disposed = false;',`  let disposed = false;
  let testContactLast=null,testContactSerial=0,testContactPaused=false,testContactWasStarted=false;
  const testContactPrevious=globalThis.__ranchContactAudit;
  const testContactApi={
    actorImages:()=>[...actors].map(([creatureId,entry])=>{const texture=entry.sprite?.texture,resource=texture?.source?.resource,frame=texture?.frame;if(!resource||!frame)throw Error('ACTUAL_ACTOR_RESOURCE_REQUIRED');const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height;canvas.getContext('2d').drawImage(resource,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);return{creatureId,serial:testContactSerial,nativeFrame:entry.nativeFramePresenter?.getSnapshot(),textureUid:texture.uid,sourceUid:texture.source.uid,sourceLabel:texture.source.label??null,resourceType:resource.constructor.name,resourceSrc:resource.currentSrc??resource.src??null,complete:resource.complete??null,resourceWidth:resource.width,resourceHeight:resource.height,frame:{x:frame.x,y:frame.y,width:frame.width,height:frame.height},png:canvas.toDataURL('image/png')};}),
    careImages:()=>publicCare.cells.map(cell=>{const key=cell.role+'-'+cell.pose,texture=careArt.get(key)?.texture,resource=texture?.source?.resource,frame=texture?.frame;if(!resource||!frame)throw Error('ACTUAL_CARE_RESOURCE_REQUIRED');const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height;canvas.getContext('2d').drawImage(resource,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);return{key,sourceSpec:cell,textureUid:texture.uid,sourceUid:texture.source.uid,resourceType:resource.constructor.name,resourceSrc:resource.currentSrc??resource.src??null,complete:resource.complete??null,frame:{x:frame.x,y:frame.y,width:frame.width,height:frame.height},png:canvas.toDataURL('image/png')};}),
    pickScreenPoint:point=>{const beforeSerial=testContactSerial,native=screenToNativeGround(point),admission=native?source.getGroundSupport?.(native.x,native.y)??null:null;return{input:{x:point.x,y:point.y},native,admission,beforeSerial,afterSerial:testContactSerial,scope:'READ_ONLY_ACTUAL_PRODUCTION_POINTER_INVERSE_NOT_DISPATCHED_GESTURE'};},
    sourceActions:Object.freeze({
      getGroundSupport:(x,y)=>source.getGroundSupport(x,y),
      getActorFrame:id=>source.getActorFrame(id),
      getFoodFrame:()=>source.getFoodFrame(),
      placeFood:input=>source.intents.placeFood(input),
      relocateToGround:(id,input)=>source.intents.relocateToGround(id,input)
    }),
    renderPaused:()=>{if(!testContactPaused||app.ticker.started)throw Error('PAUSED_SHARED_TICKER_REQUIRED');updateAnimations({deltaMS:0});app.render();return testContactApi.snapshot();},
    snapshot:()=>testContactLast?JSON.parse(JSON.stringify(testContactLast)):null,
    pause:()=>{if(!testContactPaused){testContactWasStarted=app.ticker.started;app.ticker.stop();testContactPaused=true;}return testContactApi.snapshot();},
    resume:()=>{if(testContactPaused){testContactPaused=false;if(testContactWasStarted&&!disposed)app.ticker.start();}return testContactApi.snapshot();}
  };
  globalThis.__ranchContactAudit=testContactApi;`);
patched=once(patched,'      onActorFrame([...actors].map(([creatureId,entry])=>{','      const testContactPositions=[...actors].map(([creatureId,entry])=>{');
patched=once(patched,'      }));\n    }\n  }\n\n  function',`      });
      const testSupportTargets=[];
      const testSupportRecord=(kind,key,root,sprite)=>{
        if(!root||!sprite)return;
        const careMatch=[...careArt.entries()].filter(([,art])=>art.texture===sprite.texture).map(([key])=>key);
        testSupportTargets.push({kind,key,visible:root.visible&&sprite.visible,
          careIdentity:{pose:carePose(),elapsed:careElapsed,matchingKeys:careMatch,textureUid:sprite.texture?.uid??null,sourceUid:sprite.texture?.source?.uid??null},
          admission:root.threeGroundAdmission??null,owner:root.threeSupportOwner??null,
          groundScreen:root.threeGroundScreen??null,groundHeight:root.threeGroundHeight??null,groundContact:root.threeGroundContact??null,
          root:{x:root.x,y:root.y,scaleX:root.scale.x,scaleY:root.scale.y},
          sprite:{x:sprite.x,y:sprite.y,scaleX:sprite.scale.x,scaleY:sprite.scale.y,
            textureFrame:sprite.texture?.frame?{x:sprite.texture.frame.x,y:sprite.texture.frame.y,width:sprite.texture.frame.width,height:sprite.texture.frame.height}:null}});
      };
      for(const [key,entry] of actors)testSupportRecord('actor',key,entry.root,entry.sprite);
      for(const [key,root] of foodGraphics)testSupportRecord('food','food:'+key,root,root.children?.[1]);
      for(const [key,root] of wasteGraphics)testSupportRecord('waste','waste:'+key,root,root);
      const testContactRect=app.canvas.getBoundingClientRect();
      testContactLast=JSON.parse(JSON.stringify({serial:++testContactSerial,positions:testContactPositions,supportTargets:testSupportTargets,three:fieldArt?.threeScene?.getDiagnostics?.()??null,
        renderPlan:{nativePixelWorldScale:fieldArt?.field?.nativePixelWorldScale,placements:fieldArt?.field?.placements??[]},viewport:{appScreen:{width:app.screen.width,height:app.screen.height},rendererResolution:app.renderer.resolution,
          canvasRect:{left:testContactRect.left,top:testContactRect.top,width:testContactRect.width,height:testContactRect.height}}}));
      onActorFrame(testContactPositions);
    }
  }

  function`);
patched=once(patched,'      disposed = true;',`      testContactApi.resume();
      if(globalThis.__ranchContactAudit===testContactApi){if(testContactPrevious===undefined)delete globalThis.__ranchContactAudit;else globalThis.__ranchContactAudit=testContactPrevious;}
      disposed = true;`);
patched='// GENERATED TEST-ONLY CONTACT DIAGNOSTICS. NEVER SHIP.\n'+patched;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,patched,{flag:'wx'});
console.log(JSON.stringify({inputSha256:sha,outputSha256:crypto.createHash('sha256').update(patched).digest('hex'),productionSourceUnchanged:fs.readFileSync(input,'utf8')===source}));
