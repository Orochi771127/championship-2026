import test from "node:test";
import assert from "node:assert/strict";
import { createChampionshipPixiStage } from "../src/championship/presentation/championshipPixiStage.js";

function harness() {
  let count=0;const events=[];const listeners=new Map();
  const host={width:390,height:600,appendChild(canvas){canvas.parentNode=this;},getBoundingClientRect(){return {width:this.width,height:this.height};}};
  class Application {
    constructor(){count++;this.canvas={classList:{add(){},remove(){}},setAttribute(){},style:{},hidden:false,addEventListener(n,f){listeners.set(n,f);},removeEventListener(n,f){if(listeners.get(n)===f)listeners.delete(n);}};this.screen={width:0,height:0};this.stage={children:[],addChild(c){this.children.push(c);}};this.ticker={started:true};this.renderer={resize:(width,height)=>{events.push("resize");Object.assign(this.screen,{width,height});}};}
    async init(){}
    start(){events.push("start");this.ticker.started=true;}
    stop(){events.push("stop");this.ticker.started=false;}
    destroy(){events.push("destroy");}
  }
  const api={Application,Assets:{},Container:class{},Graphics:class{},AnimatedSprite:class{},Sprite:class{},Spritesheet:class{},Rectangle:class{}};
  return {api,host,events,listeners,count:()=>count,emit(name){listeners.get(name)?.({preventDefault(){events.push("preventDefault");}});}};
}

test("GPU loss and restore reuse the same scene/canvas and reset observers before restarting",async()=>{
 const h=harness();const stage=await createChampionshipPixiStage({PIXI:h.api,canvasHost:h.host});
 const canvas=stage.app.canvas;stage.app.stage.children.push({identity:"retained"});
 stage.onContextRestored(()=>{assert.equal(stage.app.ticker.started,false);h.events.push("reset-clock");});
 h.emit("webglcontextlost");assert.equal(stage.contextLost,true);assert.equal(canvas.hidden,true);assert.equal(stage.app.ticker.started,false);
 h.host.width=320;stage.attach(h.host);assert.notEqual(stage.screen.width,320,"no resize against lost context");
 h.emit("webglcontextrestored");assert.equal(stage.contextLost,false);assert.equal(canvas.hidden,false);assert.equal(stage.screen.width,320);
 assert.equal(stage.app.ticker.started,true);assert.equal(stage.app.canvas,canvas);assert.equal(h.count(),1);assert.deepEqual(stage.app.stage.children,[{identity:"retained"}]);
 assert.ok(h.events.indexOf("reset-clock")<h.events.indexOf("start"));stage.destroy();
});

test("duplicate loss, observer exceptions, paused stages and destroy cannot create extra restarts",async()=>{
 const h=harness();const stage=await createChampionshipPixiStage({PIXI:h.api,canvasHost:h.host});
 stage.onContextLost(()=>{throw Error("observer");});stage.onContextRestored(()=>{throw Error("observer");});
 h.emit("webglcontextlost");h.emit("webglcontextlost");h.emit("webglcontextrestored");h.emit("webglcontextrestored");assert.equal(h.events.filter(x=>x==="start").length,1);
 stage.app.stop();h.emit("webglcontextlost");h.emit("webglcontextrestored");assert.equal(stage.app.ticker.started,false);
 h.emit("webglcontextlost");const stale=h.listeners.get("webglcontextrestored");stage.destroy();stale();assert.equal(stage.app.ticker.started,false);assert.equal(h.listeners.size,0);assert.equal(h.count(),1);
});
