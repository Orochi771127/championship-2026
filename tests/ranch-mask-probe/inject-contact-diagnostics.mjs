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
patched=once(patched,'          bodyTop,footY:entry.root.y,',`          testOnlyContactDiagnostic:(()=>{const s=entry.nativeFramePresenter?.getSnapshot();return {
            ...entry.testOnlyContactDiagnostic,
            frame:s?{sequenceId:s.sequenceId,cell:s.cell,texture:s.texture,flipX:s.flipX,flipY:s.flipY,geometry:s.geometry}:null,
            nativeLift:entry.visualLift??0,
            root:{x:entry.root.x,y:entry.root.y,scaleX:entry.root.scale.x,scaleY:entry.root.scale.y},
            shadow:{x:entry.shadow.x,y:entry.shadow.y,scaleX:entry.shadow.scale.x,scaleY:entry.shadow.scale.y,visible:entry.shadow.visible},
            ellipseScreen:(entry.testOnlyContactDiagnostic?.ellipses??[]).map(e=>{const p=entry.shadow.toGlobal(new PIXI.Point(e.x,e.y));return {x:p.x,y:p.y};})
          };})(),
          bodyTop,footY:entry.root.y,`);
patched=once(patched,'  let disposed = false;',`  let disposed = false;
  let testContactLast=null,testContactSerial=0,testContactPaused=false,testContactWasStarted=false;
  const testContactPrevious=globalThis.__ranchContactAudit;
  const testContactApi={
    snapshot:()=>testContactLast?JSON.parse(JSON.stringify(testContactLast)):null,
    pause:()=>{if(!testContactPaused){testContactWasStarted=app.ticker.started;app.ticker.stop();testContactPaused=true;}return testContactApi.snapshot();},
    resume:()=>{if(testContactPaused){testContactPaused=false;if(testContactWasStarted&&!disposed)app.ticker.start();}return testContactApi.snapshot();}
  };
  globalThis.__ranchContactAudit=testContactApi;`);
patched=once(patched,'      onActorFrame([...actors].map(([creatureId,entry])=>{','      const testContactPositions=[...actors].map(([creatureId,entry])=>{');
patched=once(patched,'      }));\n    }\n  }\n\n  function',`      });
      testContactLast=JSON.parse(JSON.stringify({serial:++testContactSerial,positions:testContactPositions,three:fieldArt?.threeScene?.getDiagnostics?.()??null}));
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
