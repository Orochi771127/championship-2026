import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EVOLUTION_TEXT_ROWS, EVOLUTION_GLYPH_ROW, EVOLUTION_WRITING_COLOR, evolutionWritingY} from '../src/championship/text/evolutionPresentationText.js';
import {createEvolutionGlyphBand, loadEvolutionGlyphArt} from '../src/championship/presentation/evolutionGlyphArt.js';
import manifest from '../assets/production/evolution-glyphs-v1/manifest.json' with {type:'json'};

// CPU-only presenter contract tests: no renderer, fonts, GPU or screenshot claim.
class Container {
  children=[]; listeners={}; x=0; y=0;
  constructor(options={}) {Object.assign(this,options);}
  addChild(child) {this.children.push(child);}
  on(name,fn) {this.listeners[name]=fn;}
  destroy() {this.listeners.destroyed?.();}
}
class Sprite {
  constructor(texture) {this.texture=texture;this.anchor={set:(...a)=>{this.anchorValue=a;}};this.position={set:(x,y)=>{this.x=x;this.y=y;}};}
}
class ColorMatrixFilter {destroy(){this.destroyed=true;}}
const PIXI={Container,Sprite,ColorMatrixFilter};

test('exactly five existing languages occupy separate single-line rows; glyphs replace row four',()=>{
  assert.deepEqual(EVOLUTION_TEXT_ROWS.map(r=>r.language),['en','zh-Hant','ja','vi','th']);
  assert.deepEqual(EVOLUTION_TEXT_ROWS.map(r=>r.text),['EVOLUTION','進化','進化（しんか）','TIẾN HÓA','วิวัฒนาการ']);
  assert.ok(EVOLUTION_TEXT_ROWS.every(r=>!/[\r\n]/.test(r.text)));
  assert.deepEqual([...EVOLUTION_TEXT_ROWS.map(r=>r.row),EVOLUTION_GLYPH_ROW].sort(),[0,1,2,3,4,5]);
  for(const height of [320,473,844]) {
    assert.equal(new Set([...EVOLUTION_TEXT_ROWS.map(r=>r.row),EVOLUTION_GLYPH_ROW].map(r=>evolutionWritingY(r,height))).size,6);
  }
});

test('four unchanged glyph textures use exactly the text RGB while preserving alpha',()=>{
  const art={assets:manifest.assets.map(a=>({...a,texture:{source:a.src}}))};
  const band=createEvolutionGlyphBand(PIXI,art);
  assert.deepEqual(band.container.children.map(s=>s.texture),art.assets.map(a=>a.texture));
  assert.deepEqual(band.container.children.map(s=>s.label),['CP-G01','CP-G02','CP-G03','CP-G04']);
  const ink=band.container.filters[0],m=ink.matrix;
  const expected=[(EVOLUTION_WRITING_COLOR>>16&255)/255,(EVOLUTION_WRITING_COLOR>>8&255)/255,(EVOLUTION_WRITING_COLOR&255)/255];
  for(const rgba of [[0,1,1,1],[1,0.7,0,0.5],[1,1,1,0],[0.2,0.3,0.8,0.25]]) {
    const result=Array.from({length:4},(_,row)=>rgba.reduce((sum,v,col)=>sum+v*m[row*5+col],m[row*5+4]));
    assert.deepEqual(result,[...expected,rgba[3]]);
  }
  band.container.destroy();assert.equal(ink.destroyed,true);
});

test('replacement row retains existing frame-based travel, narrow-screen sizing and reduced-motion policy',()=>{
  const band=createEvolutionGlyphBand(PIXI,{assets:manifest.assets.map(a=>({...a,texture:{}}))});
  for(const width of [280,320,390,844]) {
    band.update({width,height:473,totalFrames:35,reducedMotion:true});
    assert.equal(band.container.y,evolutionWritingY(4,473));
    assert.equal(band.container.x,width/2);
    for(const s of band.container.children) {
      assert.ok(band.container.x+s.x-s.width/2>=0);
      assert.ok(band.container.x+s.x+s.width/2<=width);
    }
    band.update({width,height:473,totalFrames:205,reducedMotion:true});
    assert.equal(band.container.x,width/2);
    band.update({width,height:473,totalFrames:35,reducedMotion:false});
    const before=band.container.x;
    band.update({width,height:473,totalFrames:65,reducedMotion:false});
    assert.ok(Math.abs(band.container.x-before+36)<1e-9);
  }
});

test('glyph load failure still releases successful loads; dimension failure releases all',async()=>{
  for(const badDimensions of [false,true]) {
    const unloaded=[];
    const mock={Assets:{load:async src=>{
      if(!badDimensions&&src.includes('CP-G02'))throw Error('missing');
      return {width:badDimensions?127:128,height:128};
    },unload:async src=>unloaded.push(src)}};
    await assert.rejects(loadEvolutionGlyphArt(mock),badDimensions?/EVOLUTION_GLYPH_DIMENSIONS/:/missing/);
    assert.equal(unloaded.length,badDimensions?4:3);
  }
});

test('field builds language rows before art load and never overwrites them with native word cells',()=>{
  const source=fs.readFileSync(new URL('../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',import.meta.url),'utf8');
  assert.ok(source.includes('const evolutionWords=EVOLUTION_TEXT_ROWS.map'));
  assert.ok(source.includes('fill:EVOLUTION_WRITING_COLOR'));
  assert.ok(source.includes('const i=EVOLUTION_TEXT_ROWS[index].row;'));
  assert.ok(source.includes('word.y=evolutionWritingY(i,app.screen.height)'));
  assert.ok(source.indexOf('const evolutionWords=')<source.indexOf('loadEvolutionGlyphArt(PIXI)'));
  assert.doesNotMatch(source,/EVOLUTION_SYMBOL_REPLACEMENT_TEXT|evolution-word-small|evolution-word'|text:i%2/);
  assert.match(source,/evolutionGlow\.ellipse\(center\.x,entry\.root\.y,radius\*1\.5,radius\/3\)/,'existing ring geometry retained');
  assert.match(source,/evolutionGlow\.rect\(x,y,2,4\)/,'existing particle geometry retained');
  assert.match(source,/!reducedMotion&&\(e\.phase===4\|\|e\.phase===5\)/,'existing native phase and reduced-motion gates retained');
});
