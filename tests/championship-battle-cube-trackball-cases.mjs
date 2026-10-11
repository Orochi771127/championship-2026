import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Quaternion, Vector3, PerspectiveCamera, Mesh, BoxGeometry, MeshBasicMaterial, Raycaster, Vector2 } from '../node_modules/three/build/three.module.js';
import { bindBattleCubeTrackball, projectBattleTrackball, rotateBattleTrackball } from '../src/championship/presentation/vs5/battleCubeTrackball.js';

const rect = { left: 20, top: 30, width: 320, height: 230, right: 340, bottom: 260 };
const center = { clientX: 180, clientY: 145 };
function near(a, b, epsilon = 1e-10) { assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`); }
function setup() {
  class Target {
    listeners = new Map();
    addEventListener(type, callback) { const list = this.listeners.get(type) ?? new Set(); list.add(callback); this.listeners.set(type, list); }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    dispatch(type, options = {}) {
      const event = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: 'touch', ...center,
        preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
      for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
      return event;
    }
  }
  const canvas = new Target(), view = new Target();
  canvas.ownerDocument = { defaultView: view };
  canvas.getBoundingClientRect = () => rect;
  canvas.captured = new Set();
  canvas.setPointerCapture = id => canvas.captured.add(id);
  canvas.releasePointerCapture = id => { canvas.captured.delete(id); canvas.dispatch('lostpointercapture', { pointerId: id }); };
  canvas.focus = () => {};
  const orientation = new Quaternion();
  const cameraOrientation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.14);
  let changes = 0, taps = 0;
  const controls = bindBattleCubeTrackball({ canvas, orientation, cameraOrientation,
    onChange() { changes++; }, onTap() { taps++; } });
  return { canvas, view, orientation, cameraOrientation, controls, changes: () => changes, taps: () => taps };
}

test('projection is normalized, scale-independent and finite outside the canvas', () => {
  for (const [x, y] of [[180,145], [20,30], [-1000,3000]]) {
    const point = projectBattleTrackball(x,y,rect);
    near(point.length(),1);
    assert.ok(point.toArray().every(Number.isFinite));
    const doubled = projectBattleTrackball(x*2,y*2,{left:40,top:60,width:640,height:460});
    near(point.distanceTo(doubled),0);
  }
});

test('horizontal, vertical and diagonal drags independently rotate without snapping', () => {
  for (const [dx,dy] of [[35,0],[0,35],[35,24],[-22,-30]]) {
    const s=setup();
    s.canvas.dispatch('pointerdown');
    s.canvas.dispatch('pointermove',{clientX:180+dx,clientY:145+dy});
    s.canvas.dispatch('pointerup',{clientX:180+dx,clientY:145+dy});
    const angle=new Quaternion().angleTo(s.orientation);
    assert.ok(angle>0.05 && angle<Math.PI/2);
    near(s.orientation.length(),1);
    assert.equal(s.taps(),0);
    const stopped=s.orientation.clone();
    s.canvas.dispatch('pointermove',{clientX:300});
    near(stopped.angleTo(s.orientation),0,1e-7);
    s.controls.dispose();
  }
});

test('screen-relative quaternion maps grabbed direction correctly with a tilted camera', () => {
  const s=setup(), from=projectBattleTrackball(180,145,rect),to=projectBattleTrackball(220,170,rect);
  const grabbed=from.clone().applyQuaternion(s.cameraOrientation);
  rotateBattleTrackball(s.orientation,from,to,s.cameraOrientation);
  near(grabbed.applyQuaternion(s.orientation).distanceTo(to.clone().applyQuaternion(s.cameraOrientation)),0);
});

test('mixed-axis rotation produces roll and stays normalized after long use', () => {
  const s=setup();
  for(let i=0;i<1000;i++) {
    s.canvas.dispatch('pointerdown');
    s.canvas.dispatch('pointermove',{clientX:225,clientY:170});
    s.canvas.dispatch('pointermove',{clientX:198,clientY:195});
    s.canvas.dispatch('pointerup',{clientX:198,clientY:195});
  }
  near(s.orientation.length(),1);
  assert.ok(Math.abs(s.orientation.z)>0.01);
  assert.ok(s.orientation.toArray().every(Number.isFinite));
});

test('tap invokes once; compatibility click is suppressed', () => {
  const s=setup();
  s.canvas.dispatch('pointerdown');s.canvas.dispatch('pointerup');
  const click=s.canvas.dispatch('click');
  assert.equal(s.taps(),1);assert.equal(click.prevented,true);assert.equal(click.stopped,true);
  assert.equal(s.canvas.captured.size,0);assert.equal(s.controls.isDragging(),false);
});

test('travel out and back and movement only on pointerup are not taps', () => {
  for(const endOnly of [true,false]) {
    const s=setup();s.canvas.dispatch('pointerdown');
    if(!endOnly) { s.canvas.dispatch('pointermove',{clientX:210});s.canvas.dispatch('pointermove'); }
    s.canvas.dispatch('pointerup',endOnly?{clientX:210}:{});
    assert.equal(s.taps(),0);
  }
});

for(const type of ['pointercancel','lostpointercapture','touchcancel','blur']) {
  test(`${type} releases capture, never selects, and allows the next gesture`,()=>{
    const s=setup();s.canvas.dispatch('pointerdown');
    (type==='blur'?s.view:s.canvas).dispatch(type);
    s.canvas.dispatch('pointerup');
    assert.equal(s.taps(),0);assert.equal(s.controls.isDragging(),false);assert.equal(s.canvas.captured.size,0);
    s.canvas.dispatch('pointerdown');s.canvas.dispatch('pointerup');assert.equal(s.taps(),1);
  });
}

test('secondary pointer and wrong-id move/up/cancel cannot hijack a drag',()=>{
  const s=setup();s.canvas.dispatch('pointerdown');
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])
    s.canvas.dispatch(type,{pointerId:2,isPrimary:false,clientX:310});
  assert.equal(s.controls.isDragging(),true);assert.equal(s.changes(),0);assert.equal(s.taps(),0);
  s.canvas.dispatch('pointerup');assert.equal(s.taps(),1);
});

test('right button, failed capture and released mouse cannot trigger selection',()=>{
  const s=setup();s.canvas.dispatch('pointerdown',{button:2});assert.equal(s.controls.isDragging(),false);
  s.canvas.dispatch('pointerdown');s.canvas.dispatch('pointermove',{pointerType:'mouse',buttons:0});
  s.canvas.dispatch('pointerup');assert.equal(s.taps(),0);assert.equal(s.controls.isDragging(),false);
  s.canvas.setPointerCapture=()=>{throw new Error('lost pointer');};
  s.canvas.dispatch('pointerdown');s.canvas.dispatch('pointerup');assert.equal(s.taps(),0);
});

test('all arrow keys use small camera-relative steps; other keys do not select',()=>{
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']) {
    const s=setup();const event=s.canvas.dispatch('keydown',{key});
    near(new Quaternion().angleTo(s.orientation),Math.PI/12);
    assert.equal(event.prevented,true);assert.equal(s.taps(),0);
  }
  const s=setup();for(const key of ['Enter',' ','Escape'])s.canvas.dispatch('keydown',{key});
  assert.equal(s.changes(),0);assert.equal(s.taps(),0);
});

test('dispose mid-drag is idempotent and removes every listener and capture',()=>{
  const s=setup();s.canvas.dispatch('pointerdown');s.controls.dispose();s.controls.dispose();
  assert.equal(s.canvas.captured.size,0);assert.equal(s.controls.isDragging(),false);
  for(const target of [s.canvas,s.view]) for(const callbacks of target.listeners.values())assert.equal(callbacks.size,0);
  s.canvas.dispatch('pointerup');s.canvas.dispatch('keydown',{key:'ArrowRight'});
  assert.equal(s.taps(),0);assert.equal(s.changes(),0);
});

test('actual Three raycast resolves all six BoxGeometry material identities',()=>{
  const ids=['TITLE_MATCH','LINK_BATTLE','PASSWORD_BATTLE','PRACTICE_BATTLE','CHAMPIONSHIP','FREE_BATTLE'];
  const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const camera=new PerspectiveCamera(38,1,0.1,40);camera.position.set(0,0.9,6.4);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const cube=new Mesh(new BoxGeometry(2.4,2.4,2.4),ids.map(()=>new MeshBasicMaterial()));
  for(let index=0;index<6;index++) {
    cube.quaternion.setFromUnitVectors(new Vector3(...normals[index]),camera.position.clone().normalize());cube.updateMatrixWorld();
    const ray=new Raycaster();ray.setFromCamera(new Vector2(0,0),camera);
    assert.equal(ids[ray.intersectObject(cube,false)[0].face.materialIndex],ids[index]);
  }
  cube.geometry.dispose();cube.material.forEach(m=>m.dispose());
});

test('presenter keeps selection injected, six shortcuts and existing explicit-entry app wiring',()=>{
  const presenter=readFileSync(new URL('../src/championship/presentation/vs5/createBattleSelectThreePresentation.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
  assert.match(presenter,/selectFace\(SIDE_ORDER\[hit.face.materialIndex\]\)/);
  assert.match(presenter,/buttons.get\(faceId\).disabled/);
  assert.match(presenter,/onSelect\(faceId\)/);
  assert.match(presenter,/for \(const face of BATTLE_CUBE_FACES\)/);
  assert.match(app,/maxLength:22/);assert.match(app,/createInvite:instanceIds=>app.createLinkBattleInvite/);
  assert.match(app,/async onEnter\(/);
  assert.doesNotMatch(presenter,/requestAnimationFrame|setInterval|startMatch|onEnter\(/);
});


test('every presenter aria-label resolves through the existing locale dictionaries', async()=>{
  const {uiText}=await import('../src/championship/text/uiText.js');
  const {getLocale,setLocale}=await import('../src/championship/text/locale.js');
  const presenter=readFileSync(new URL('../src/championship/presentation/vs5/createBattleSelectThreePresentation.js',import.meta.url),'utf8');
  const keys=[...presenter.matchAll(/setAttribute\("aria-label", uiText\("([^"\n]+)"\)\)/g)].map(match=>match[1]);
  assert.equal(keys.length,3); // canvas, shortcut group and non-WebGL fallback
  const previous=getLocale();
  try {
    setLocale('zh-Hant');
    for(const key of keys)assert.equal(uiText(key),key);
    for(const locale of ['en','ja','th','vi']) {
      const dictionary=await import(`../src/championship/text/uiText.${locale}.js`);
      const table=dictionary[`TEXT_${locale.toUpperCase()}`];
      setLocale(locale);
      for(const key of keys) {
        assert.equal(typeof table[key],'string',`${locale} is missing aria-label: ${key}`);
        assert.notEqual(table[key],key);
        assert.equal(uiText(key),table[key]);
      }
    }
  } finally { setLocale(previous); }
});
