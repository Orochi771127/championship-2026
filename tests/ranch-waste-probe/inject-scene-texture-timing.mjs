import fs from 'node:fs';import crypto from 'node:crypto';
const [input,output]=process.argv.slice(2);const src=fs.readFileSync(input,'utf8');const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
if(sha(src)!=='253b395eeae17428d1868aa3886b4723ebad34ad646ee250b4047aae50181549')throw Error('EXACT_REVIEWED_SCENE_REQUIRED');
function once(s,a,b){if(s.split(a).length!==2)throw Error('NON_UNIQUE_SEAM');return s.replace(a,b);}
const hook=`  const testWasteTexturePrevious=globalThis.__ranchWasteTextureAudit;
  const testWasteTextureIds=new WeakMap();let testWasteTextureNext=1;
  const testWasteObjectId=o=>{if(!o||(typeof o!=='object'&&typeof o!=='function'))return null;if(!testWasteTextureIds.has(o))testWasteTextureIds.set(o,testWasteTextureNext++);return testWasteTextureIds.get(o);};
  const testWasteImage=(image,frame)=>{if(!image)return null;const w=frame?.width??image.width,h=frame?.height??image.height;if(!(w>0&&h>0&&w<=4096&&h<=4096))throw Error('BOUNDED_TEXTURE_SIZE_REQUIRED');const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(image,frame?.x??0,frame?.y??0,w,h,0,0,w,h);return c.toDataURL('image/png');};
  const testWasteTextureApi=()=>({frames,targets:[...sprites].filter(([key])=>key.startsWith('food:')||key.startsWith('waste:')).map(([key,item])=>{
    const t=item.sprite.texture,s=t.source,r=s?.resource,m=item.mesh.material,map=m.map,f=t.frame;
    return {key,visible:item.mesh.visible,seen:item.seen,screenQuad:item.screenQuad,drawBinding:item.testWasteDrawBinding??null,
      pixi:{textureUid:t.uid??null,sourceUid:s?.uid??null,sourceId:testWasteObjectId(s),resourceId:testWasteObjectId(r),resourceType:r?.constructor?.name??null,resourceComplete:r?.complete??null,resourceNaturalWidth:r?.naturalWidth??null,resourceNaturalHeight:r?.naturalHeight??null,sourceDestroyed:s?.destroyed??null,resourceSrc:r?.currentSrc??r?.src??null,frame:{x:f.x,y:f.y,width:f.width,height:f.height},uvs:{...t.uvs},sourceWidth:s?.width,sourceHeight:s?.height,resourceWidth:r?.width,resourceHeight:r?.height,cropPng:testWasteImage(r,f)},
      three:{materialUuid:m.uuid,mapUuid:map?.uuid,mapVersion:map?.version,mapSourceVersion:map?.source?.version,imageId:testWasteObjectId(map?.image),imageIsPixiResource:map?.image===r,flipY:map?.flipY,uv:Array.from(item.mesh.geometry.attributes.uv.array),imageCropPng:testWasteImage(map?.image,f),samplerMapUuid:m.userData.testWasteShader?.uniforms?.map?.value?.uuid??null,samplerIsMaterialMap:m.userData.testWasteShader?.uniforms?.map?.value===map}};
  })});
  globalThis.__ranchWasteTextureAudit=testWasteTextureApi;
`;
let out=once(src,'  function materialFor(pixiTexture) {',hook+'  function materialFor(pixiTexture) {');
out=once(out,'    material.onBeforeCompile=shader=>{','    material.onBeforeCompile=shader=>{\n      material.userData.testWasteShader=shader;');
out=once(out,'    sprite.renderable=false;',`    if(key.startsWith('food:')||key.startsWith('waste:'))item.mesh.onAfterRender=globalThis.__ranchWasteBindingObserver===false?()=>{}:()=>{
      const gl=renderer.getContext(),program=gl.getParameter(gl.CURRENT_PROGRAM),active=gl.getParameter(gl.ACTIVE_TEXTURE),location=program?gl.getUniformLocation(program,'map'):null;
      let unit=null,binding=null;try{if(location!==null){unit=gl.getUniform(program,location);gl.activeTexture(gl.TEXTURE0+unit);binding=gl.getParameter(gl.TEXTURE_BINDING_2D);}}
      finally{gl.activeTexture(active);}
      const map=item.mesh.material.map,expected=renderer.properties.get(map).__webglTexture;
      item.testWasteDrawBinding={frame:frames,programId:testWasteObjectId(program),samplerUnit:unit,bindingId:testWasteObjectId(binding),expectedMapBindingId:testWasteObjectId(expected),bindingMatchesExpected:!!expected&&binding===expected,mapUuid:map.uuid,mapVersion:map.version,activeTextureRestored:gl.getParameter(gl.ACTIVE_TEXTURE)===active};
    };
    sprite.renderable=false;`);
out=once(out,'  function dispose(){','  function dispose(){\n    if(globalThis.__ranchWasteTextureAudit===testWasteTextureApi){if(testWasteTexturePrevious===undefined)delete globalThis.__ranchWasteTextureAudit;else globalThis.__ranchWasteTextureAudit=testWasteTexturePrevious;}');
fs.writeFileSync(output,'// TEST ONLY texture identity readback. Never ship.\n'+out,{flag:'wx'});console.log(JSON.stringify({sourceSha256:sha(src),outputSha256:sha(fs.readFileSync(output)),productionUnchanged:src===fs.readFileSync(input,'utf8')}));
