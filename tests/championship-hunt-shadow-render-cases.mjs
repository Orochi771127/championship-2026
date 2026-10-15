import test from 'node:test';
import assert from 'node:assert/strict';
import {mountHuntFieldPixiPresentation} from '../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js';

function fixture(speciesId,contactShadowArt=null) {
  const nodes=[];
  class Container {
    constructor(options={}) {
      Object.assign(this,options);this.children=[];this.x=0;this.y=0;
      this.position={set:(x,y)=>{this.x=x;this.y=y;}};
      this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;}};
      nodes.push(this);
    }
    addChild(...children){for(const child of children){this.children.push(child);child.parent=this;}}
    removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parent=null;}
    removeChildren(){this.children=[];}
    destroy(){this.destroyed=true;}
  }
  class Graphics extends Container {
    constructor(){super();this.ellipses=[];const proxy=new Proxy(this,{get:(t,p)=>p in t?typeof t[p]==='function'? (...args)=>{const result=t[p](...args);return result===t?proxy:result;}:t[p]:()=>proxy});return proxy;}
    ellipse(x,y,radiusX,radiusY){this.ellipses.push({x,y,radiusX,radiusY});return this;}
    clear(){this.ellipses=[];return this;}
    fill(){return this;}
  }
  class Sprite extends Container {
    constructor(){super();this.texture={source:{resolution:1}};this.anchor={x:0,y:0,set:(x,y)=>{this.anchor.x=x;this.anchor.y=y;}};}
  }
  const root=new Container();const ticker=new Set();
  const stage={PIXI:{Container,Graphics,Sprite},app:{screen:{width:390,height:844},renderer:{},
    ticker:{add:fn=>ticker.add(fn),remove:fn=>ticker.delete(fn)},stage:{on(){},off(){}}},
    createSceneRoot:()=>root,markScene:()=>()=>{},onResize:()=>()=>{},onContextLost:()=>()=>{}};
  let frame=null;
  const wild={wildId:'shadow-review',speciesId,worldX:100,worldY:200,worldZ:0,facing:'right'};
  const view={gateId:'isolated',transform:{scale:1},camera:{left:0,top:0},visibleChunks:[],
    player:{worldX:0,worldY:0,facing:'right'},wildCreatures:[wild],objects:[]};
  const source={field:{tick(){},getView:()=>view},intents:{panCamera(){},selectWildAt(){},abortEnclosureStroke(){}}};
  const bundle={createActor:({speciesId:id})=>id?{sprite:new Sprite(),contactShadowArt,nativeFramePresenter:{apply:()=>frame,getSnapshot:()=>frame}}:null,
    dispose(){},getDiagnostics:()=>({})};
  return {nodes,stage,source,bundle,wild,view,ticker,setFrame:value=>{frame=value;}};
}

test('real Hunt renderer compensates every fallback frame without moving the native body',async()=>{
  const f=fixture('species-099');const scene=await mountHuntFieldPixiPresentation({stage:f.stage,source:f.source,characterBundle:f.bundle});
  const actor=f.nodes.find(n=>n.label==='wild creature');
  for(const flipX of [false,true])for(const flipY of [false,true])for(const height of [0,18,6,0]){
    const frame={flipX,flipY,geometry:{blank:false,scale:4,sourceSize:[256,256],origin:[100,160]}};
    f.setFrame(frame);f.wild.worldZ=height;scene.render();
    const shadow=actor.contactShadow;
    assert.equal(actor.y,200-height);assert.equal(actor.scale.y,flipY?-1:1);
    assert.equal(actor.y+actor.scale.y*(shadow.y+shadow.scale.y*shadow.ellipses[0].y),204);
    assert.deepEqual(actor.characterSprite.anchor,{x:100/256,y:160/256,set:actor.characterSprite.anchor.set});
    assert.equal(actor.characterSprite.scale.y,.5);
  }
  f.setFrame(null);f.wild.worldZ=12;scene.render();
  assert.equal(actor.y+actor.contactShadow.y+4,204);
  scene.dispose();assert.equal(f.ticker.size,0);
});

test('measured-to-fallback transition resets only footprint and keeps ground compensation',async()=>{
  const f=fixture('species-218');
  f.setFrame({cell:0,sequenceId:0,flipY:false,geometry:{blank:false,scale:4,sourceSize:[768,768],origin:[384,512]}});
  const scene=await mountHuntFieldPixiPresentation({stage:f.stage,source:f.source,characterBundle:f.bundle});
  const actor=f.nodes.find(n=>n.label==='wild creature');assert.equal(actor.contactShadow.ellipses.length,2);
  f.wild.worldZ=20;f.setFrame({flipY:true,geometry:{blank:true,scale:4,sourceSize:[768,768],origin:[384,512]}});scene.render();
  assert.equal(actor.characterSprite.visible,false);
  assert.deepEqual(actor.contactShadow.ellipses,[{x:0,y:4,radiusX:11,radiusY:4}]);
  assert.equal(actor.y+actor.scale.y*(actor.contactShadow.y+actor.contactShadow.scale.y*4),204);
  f.wild.worldZ=0;f.setFrame(null);scene.render();assert.equal(actor.contactShadow.y,0);assert.equal(actor.contactShadow.scale.y,1);
  f.view.wildCreatures=[];scene.render();assert.equal(actor.destroyed,true);scene.dispose();assert.equal(f.ticker.size,0);
});

test('actual Hunt scene binds the approved source-bank metadata and leaves body origins unchanged',async()=>{
 const art={entityId:'m203_elecmon',folder:'m203_elecmon-final-growth38-20261007',side:'main',sourceBankSha256:'ea39060f0570245b72161ec7a5d4ec3745043125cdbb5f2262f02908910f1b8c'};
 const f=fixture('species-036',art),geometry={blank:false,scale:4,sourceSize:[256,256],origin:[108,152]};
 const scene=await mountHuntFieldPixiPresentation({stage:f.stage,source:f.source,characterBundle:f.bundle});
 const actor=f.nodes.find(n=>n.label==='wild creature');
 for(const flipX of [false,true])for(const flipY of [false,true])for(const height of [0,18,6,0]){
  f.wild.worldZ=height;f.setFrame({sequenceId:0,cell:1,flipX,flipY,geometry});scene.render();
  assert.equal(actor.contactShadow.ellipses.length,4);assert.equal(actor.y,200-height);
  for(const e of actor.contactShadow.ellipses)assert.equal(actor.y+actor.scale.y*(actor.contactShadow.y+actor.contactShadow.scale.y*e.y),200+e.y);
  assert.equal(actor.characterSprite.anchor.x,108/256);assert.equal(actor.characterSprite.anchor.y,152/256);
  assert.equal(actor.characterSprite.scale.y,.5);
 }
 scene.dispose();assert.equal(f.ticker.size,0);
});
