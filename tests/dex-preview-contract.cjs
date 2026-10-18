const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');const {pathToFileURL}=require('node:url');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Preview contracts follow the existing accepted HUD route. A large encyclopedia
// painting is only the established fallback when that route has no config.
async function previewExpectations(root){
 const {publicHudCharacterConfig}=await import(pathToFileURL(path.resolve('src/championship/presentation/publicCharacterCatalog.js')).href);
 const heroes=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/database-hero-portraits.public.v1.json'))).entries;
 const result=new Map();
 for(const id of [211,222,229,230]){
  const config=publicHudCharacterConfig(`species-${id}`);
  if(!config){const hero=heroes.find(row=>row.speciesIndex===id);assert.ok(hero);result.set(id,{...hero,url:new URL(hero.src,'https://orochi771127.github.io/championship-2026/').href,route:'SELECTED_ILLUSTRATION_FALLBACK'});continue;}
  const bytes=fs.readFileSync(path.join(root,config.hudPath));assert.equal(sha(bytes),config.hudSha256);
  const hud=JSON.parse(bytes),portrait=hud.portrait;
  assert.equal(hud.entityId,config.entityId);assert.equal(portrait.entityId,config.entityId);assert.equal(portrait.speciesId,`species-${id}`);
  assert.equal(portrait.cell,0);assert.equal(portrait.sequenceId,0);assert.equal(portrait.nativeScale,2);assert.equal(portrait.rasterScale,4);
  const image=fs.readFileSync(path.join(root,portrait.src));assert.equal(sha(image),portrait.sha256);
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16),portrait.rasterWidth);assert.equal(image.readUInt32BE(20),portrait.rasterHeight);
  result.set(id,{speciesIndex:id,speciesId:portrait.speciesId,entityId:portrait.entityId,src:portrait.src,sha256:portrait.sha256,
   width:portrait.rasterWidth,height:portrait.rasterHeight,url:new URL(portrait.src,'https://orochi771127.github.io/championship-2026/').href,route:'UNCHANGED_ACCEPTED_HUD'});
 }
 return result;
}
module.exports={previewExpectations};
