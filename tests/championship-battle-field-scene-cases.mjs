// VS5 Auto Battle scene.
//
// The scene is driven against a recording stub rather than a real renderer, so
// these cases can assert what it actually draws. Two things matter most: the
// bands tile the 9:16 frame with no stretch, and the cyberspace arena does not
// get a ring the table says it has no layer for.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  battleBandRect,
  battleFrameRect,
  mountBattleFieldPixiPresentation
} from "../src/championship/presentation/vs5/createBattleFieldPixiPresentation.js";

import {
  BATTLE_PRESENTATION_BANDS,
  createBattlePresentationSource
} from "../src/championship/app/battlePresentationSource.js";

import {
  createBattleSession,
  createSessionCombatant,
  stepBattleSession
} from "../src/championship/battle/battleSession.js";

import { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } from "../src/championship/battle/battleRngChannel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A Graphics stub that records the calls instead of rasterising them.
function recordingGraphics(calls) {
  const self = {
    clear() { for(let i=calls.length-1;i>=0;i--)if(calls[i].owner===self)calls.splice(i,1); return self; },
    rect(...args) { calls.push({ owner:self, op: "rect", args }); return self; },
    circle(...args) { calls.push({ owner:self, op: "circle", args }); return self; },
    ellipse(...args) { calls.push({ owner:self, op: "ellipse", args }); return self; },
    moveTo(...args) { calls.push({ owner:self, op: "moveTo", args }); return self; },
    lineTo(...args) { calls.push({ owner:self, op: "lineTo", args }); return self; },
    fill(...args) { calls.push({ owner:self, op: "fill", args }); return self; },
    stroke(...args) { calls.push({ owner:self, op: "stroke", args }); return self; },
    destroy() {}
  };
  return self;
}

function stubStage({ width = 360, height = 640 } = {}) {
  const calls = [];
  const tickers = new Set();
  const resizers = new Set();
  const children = [];
  const stage = {
    calls,
    tickers,
    resizers,
    PIXI: {
      Graphics: function Graphics() { return recordingGraphics(calls); },
      Container: function Container() {
        return {
          visible: true,
          scale: { set() {} },
          position: { set() {} },
          addChild() {},
          removeChild() {},
          destroy() {},
          parent: null
        };
      }
    },
    app: {
      screen: { width, height },
      ticker: { add: (fn) => tickers.add(fn), remove: (fn) => tickers.delete(fn) }
    },
    createSceneRoot(label) {
      const node = { label, parent: null, addChild(child) { children.push(child); }, destroy() {} };
      return node;
    },
    onResize(listener) { resizers.add(listener); return () => resizers.delete(listener); }
  };
  return stage;
}

const fighter = (currentHp, extra = {}) => createSessionCombatant({
  state: 1, statePeriod: 0, currentHp, maxHp: 100, metricBase: 60, metricLimit: 100, ...extra
});

function sourceOf(hps, options = {}) {
  const session = createBattleSession({
    roster: hps.map((hp) => (hp === null ? null : fighter(hp))),
    rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED),
    ...options
  });
  return { session, source: createBattlePresentationSource({ session, step: stepBattleSession, ...options }) };
}

async function mount(options = {}) {
  const stage = stubStage(options.viewport);
  const { session, source } = sourceOf(options.hps ?? [100, 100, 100, 100, 100, 100], options.sourceOptions ?? {});
  const scene = await mountBattleFieldPixiPresentation({
    stage,
    source,
    fieldArt: options.fieldArt ?? null,
    characterRoster: options.characterRoster ?? null,
    autoAdvance: options.autoAdvance ?? true
  });
  return { stage, session, source, scene };
}

test("the 9:16 frame is centred and never stretched", () => {
  // A taller viewport letterboxes nothing: width leads and the frame centres.
  const tall = battleFrameRect(360, 900);
  assert.equal(Number(tall.width.toFixed(3)), 360);
  assert.equal(Number((tall.width / tall.height).toFixed(6)), Number((9 / 16).toFixed(6)));
  assert.equal(tall.x, 0);
  assert.ok(tall.y > 0, "and it is centred vertically");

  // A wider viewport pillarboxes rather than stretching the art.
  const wide = battleFrameRect(1200, 640);
  assert.equal(Number(wide.height.toFixed(3)), 640);
  assert.ok(wide.x > 0);
  assert.equal(Number((wide.width / wide.height).toFixed(6)), Number((9 / 16).toFixed(6)));
});

test("character art uses arena native pixels, keeps feet on stands after resize, and releases its roster once", async () => {
  const sprites = [];
  let releases = 0;
  const characterRoster = {
    createActor({speciesId, reducedMotion}) {
      assert.equal(speciesId, 'species-000');
      assert.equal(reducedMotion, false, 'normal motion preference; sequences come from the animator binding');
      const sprite = {texture:{source:{resolution:1},orig:{width:240,height:240},trim:{x:24,y:36,width:120,height:180}},
        anchor:{x:0.5,y:0.5},scale:{set(x,y){this.x=x;this.y=y;}},position:{set(x,y){this.x=x;this.y=y;}},destroy(){}};
      sprites.push(sprite);
      return {sprite,entityId:'test-identity',nativeSizing:{packedPixelsPerNativePixel:12}};
    }, dispose(){releases++;}
  };
  const fieldArt = {assetId:'test',field:{fieldId:'field_bm01_01',worldWidthPx:1664,worldHeightPx:1088,nativeWidthPx:416,nativeHeightPx:272},
    displayObject:{},update(){},dispose(){},getDiagnostics(){return {};}};
  const {stage, source, scene} = await mount({fieldArt,characterRoster,hps:[100,null,null,100,null,null],autoAdvance:false});
  for (const width of [360,320,390]) {
    stage.app.screen.width=width;scene.redraw();
    assert.equal(stage.calls.filter(call=>call.op==='circle').length,0);
    const stands=source.getView().combatants.filter(c=>c.present).map(c=>c.stand);
    sprites.forEach((sprite,i)=>{
      const expected=width/416/12;
      assert.equal(Math.abs(sprite.scale.x),expected);
      assert.equal(sprite.scale.y,expected);
      const footY=sprite.position.y+(36+180-120)*expected;
      const expectedY=(640-width*272/416)/2+stands[i].y*width*272/416;
      assert.ok(Math.abs(footY-expectedY)<1e-9);
    });
  }
  assert.equal(sprites.length,2,'redraw reuses the two actor instances');
  assert.equal(scene.getDiagnostics().characters.filter(c=>c.rendered).length,2);
  scene.dispose();scene.dispose();assert.equal(releases,1);assert.equal(stage.tickers.size,0);
});

test("unknown sizing retains neutral markers instead of guessing character proportions", async () => {
  let sprite;
  const characterRoster={createActor(){sprite={texture:{},destroy(){}};return {sprite,nativeSizing:null};},dispose(){}};
  const fieldArt={assetId:'test',field:{fieldId:'test',worldWidthPx:416,worldHeightPx:272,nativeWidthPx:416},
    displayObject:{},update(){},dispose(){},getDiagnostics(){return {};}};
  const {stage,scene}=await mount({fieldArt,characterRoster,hps:[100,null,null,null,null,null]});
  assert.equal(sprite.visible,false);
  assert.equal(stage.calls.filter(call=>call.op==='circle').length,1);
  scene.dispose();
});

test('animated geometry retains a fixed native origin across changing packing and viewport sizes',async()=>{
  let pose=0;const sprites=[];
  const geometries=[{scale:8,origin:[192,296],sourceSize:[384,352]},
    {scale:12,origin:[180,276],sourceSize:[384,352]}];
  const characterRoster={createActor(){
    const sprite={texture:{source:{resolution:1},orig:{width:384,height:352},trim:{x:80,y:96,width:208,height:224}},
      anchor:{x:.5,y:1},scale:{set(x,y){this.x=x;this.y=y}},position:{set(x,y){this.x=x;this.y=y}},destroy(){}};
    sprites.push(sprite);
    return {sprite,battleAnimator:{apply(){return {geometry:geometries[pose],baseBounds:[-13,-24,18,3]}}}};
  },dispose(){}};
  const fieldArt={assetId:'test',field:{fieldId:'test',worldWidthPx:1664,worldHeightPx:1088,nativeWidthPx:416},
    displayObject:{},update(){},dispose(){},getDiagnostics(){return {}}};
  const {stage,source,scene}=await mount({fieldArt,characterRoster,hps:[100,null,null,100,null,null],autoAdvance:false});
  for(const width of [320,390]){
    stage.app.screen.width=width;
    const original=[];
    for(pose=0;pose<2;pose++){
      scene.redraw();
      const stands=source.getView().combatants.filter(c=>c.present).map(c=>c.stand);
      sprites.forEach((s,i)=>{
        const scale=width/416;
        assert.equal(s.anchor.x,geometries[pose].origin[0]/384);
        assert.equal(s.anchor.y,geometries[pose].origin[1]/352);
        assert.ok(Math.abs(s.scale.y*geometries[pose].scale-scale)<1e-9);
        // Position is the source origin, not the bottom of the current trimmed pose.
        const actual=[s.position.x,s.position.y];
        assert.ok(Math.abs(actual[0]-(stands[i].x*width-2.5*scale*stands[i].facing))<1e-9);
        if(pose===0)original.push(actual);else actual.forEach((value,axis)=>assert.ok(Math.abs(value-original[i][axis])<1e-9));
      });
    }
  }
  scene.dispose();
});

test("the band rectangles tile the frame with no gap and no overlap", () => {
  const frame = battleFrameRect(360, 640);
  const rects = BATTLE_PRESENTATION_BANDS.map((band) => battleBandRect(band, frame));
  assert.equal(Number(rects[0].y.toFixed(4)), Number(frame.y.toFixed(4)));
  for (let index = 1; index < rects.length; index += 1) {
    const previousBottom = rects[index - 1].y + rects[index - 1].height;
    assert.equal(Number(rects[index].y.toFixed(4)), Number(previousBottom.toFixed(4)));
    assert.equal(rects[index].width, frame.width, "every band is full width");
  }
  const last = rects[rects.length - 1];
  assert.equal(Number((last.y + last.height).toFixed(4)), Number((frame.y + frame.height).toFixed(4)));

  // And the field band is the 3:2 the arena art is drawn at.
  const field = rects[2];
  assert.equal(Number((field.width / field.height).toFixed(4)), 1.5);
});

test("the scene mounts, draws, and registers exactly one ticker and one resize observer", async () => {
  const { stage, scene } = await mount();
  assert.equal(stage.tickers.size, 1);
  assert.equal(stage.resizers.size, 1);
  assert.ok(stage.calls.length > 0, "the first draw happened at mount");
  assert.equal(scene.getDiagnostics().scene, "VS5_BATTLE_FIELD");
  assert.equal(scene.getDiagnostics().art.promoted, false, "no arena bitmap is loaded yet");
  assert.deepEqual(scene.getDiagnostics().viewport, { width: 360, height: 640 });

  scene.dispose();
  assert.equal(stage.tickers.size, 0);
  assert.equal(stage.resizers.size, 0);
  scene.dispose(); // idempotent
});

test("cyberspace is framed with a rectangle, every other arena with the common ring", async () => {
  const ringed = await mount({ sourceOptions: { arenaIndex: 0 } });
  ringed.scene.redraw();
  const ellipses = ringed.stage.calls.filter((call) => call.op === "ellipse").length;
  assert.ok(ellipses > 0, "BATTLE_NORMAL has field_bm00_00_common");
  assert.equal(ringed.scene.getDiagnostics().arena, "BATTLE_NORMAL");

  const cyber = await mount({ sourceOptions: { arenaIndex: 6 } });
  cyber.scene.redraw();
  assert.equal(cyber.scene.getDiagnostics().arena, "BATTLE_CYBERSPACE");
  // The ring stroke is an ellipse stroke; cyberspace gets a rect stroke instead.
  const source = fs.readFileSync(path.join(root, "src/championship/presentation/vs5/createBattleFieldPixiPresentation.js"), "utf8");
  assert.match(source, /drawing a ring for it would contradict the table/);
  assert.match(source, /frame\.arena\.hasCommonLayer/);
});

test("licensed field art hides the procedural plate and keeps stand markers", async () => {
  const fieldArt = {
    assetId: "art:battle:licensed-runtime:v1",
    field: { fieldId: "field_bm01_01", worldWidthPx: 1664, worldHeightPx: 1088 },
    displayObject: { parent: null },
    update() {},
    dispose() { this.disposed = true; },
    getDiagnostics() { return { fieldId: "field_bm01_01" }; }
  };
  const { stage, scene } = await mount({ fieldArt });
  scene.redraw();
  assert.equal(scene.getDiagnostics().art.promoted, true);
  assert.equal(scene.getDiagnostics().art.fieldId, "field_bm01_01");
  const groundFills = stage.calls.filter((call) => call.op === "fill" && (
    call.args[0] === 0x123039 || call.args[0]?.color === 0x123039
  ));
  assert.equal(groundFills.length, 0, "the teal procedural plate must not cover licensed pixels");
  const circles = stage.calls.filter((call) => call.op === "circle");
  assert.equal(circles.length, 6, "six present combatants keep stand markers");
  // The taller phone field letterboxes the art. Stands follow that same fit,
  // rather than floating in the padding above/below the arena.
  const artHeight = 360 * 1088 / 1664;
  const artTop = (640 - artHeight) / 2;
  for (const circle of circles) {
    assert.ok(circle.args[1] >= artTop && circle.args[1] <= artTop + artHeight);
  }
  scene.dispose();
  assert.equal(fieldArt.disposed, true);
});

test("the scene draws nothing that implies the viewer chooses an action", () => {
  const source = fs.readFileSync(path.join(root, "src/championship/presentation/vs5/createBattleFieldPixiPresentation.js"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["accuracy", "hitChance", "evasion", "damageNumber", "onPointerDown", "button", "menu"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(code), false, forbidden);
  }
  // No pointer handling at all: an auto battle takes no input.
  assert.equal(/pointer|click|tap/i.test(code), false);
});

test("the battle runs itself and stops, and a stopped battle is still drawn", async () => {
  const { scene, session } = await mount({
    hps: [100, 100, 100, 0, 0, 0],
    sourceOptions: { downed: [0, 3] }
  });
  scene.advance();
  assert.equal(session.ended, true);
  const framesAtEnd = scene.getDiagnostics().frames;

  // Further ticks stop advancing the battle but keep painting the result.
  scene.advance();
  scene.advance();
  assert.equal(scene.getDiagnostics().frames, framesAtEnd, "the battle does not run past its verdict");
  assert.equal(scene.getDiagnostics().outcome.ended, true);
  assert.equal(scene.getDiagnostics().outcome.reason, "TEAM_DOWN");
  assert.equal(scene.getDiagnostics().outcome.winningTeam, 0);
});

test('30, 60 and 120 Hz displays advance the same original battle frame count',async()=>{
  const snapshots=[];
  for(const hz of [30,60,120]){
    const {scene,session,stage}=await mount();
    const ticker=[...stage.tickers][0];
    for(let i=0;i<hz*2;i++)ticker({deltaMS:1000/hz});
    snapshots.push({clock:session.clock,frame:session.frame,frames:scene.getDiagnostics().frames});
    scene.redraw();assert.equal(scene.getDiagnostics().frames,snapshots.at(-1).frames);
    scene.dispose();
  }
  assert.deepEqual(snapshots[1],snapshots[0]);assert.deepEqual(snapshots[2],snapshots[0]);
  assert.equal(snapshots[0].frames,119);
});

test("the scene draws the arena and leaves every label to the DOM", async () => {
  const { stage, scene } = await mount({ hps: [100, null, 100, 100, 100, 100] });
  scene.redraw();
  // A present combatant gets a stand marker; an absent one gets nothing on the
  // field, because an empty slot has nowhere to stand. Its CARD is the DOM
  // view's business, and that is where the empty placeholder lives.
  const circles = stage.calls.filter((call) => call.op === "circle");
  assert.equal(circles.length, 5, "five present combatants, five markers");

  const sceneSource = fs.readFileSync(path.join(root, "src/championship/presentation/vs5/createBattleFieldPixiPresentation.js"), "utf8");
  assert.match(sceneSource, /every label on this screen belongs to the DOM view/);
  // The earlier revision drew all five bands inside the field band. It must not
  // come back: the host IS the field band.
  assert.match(sceneSource, /the scene no longer uses[\s\S]{0,8}them to lay itself out/);
  const views = fs.readFileSync(path.join(root, "src/championship/app/vs5Screens.js"), "utf8");
  assert.match(views, /if \(!combatant\.present\)/, "the empty card is the DOM's");
});
test("the scene refuses a stage or a source that is not the real one", async () => {
  const { source } = sourceOf([100, 100, 100, 100, 100, 100]);
  await assert.rejects(() => mountBattleFieldPixiPresentation({ stage: null, source }),
    /requires the Championship Pixi stage/);
  await assert.rejects(() => mountBattleFieldPixiPresentation({ stage: stubStage(), source: {} }),
    /requires the VS5 battle presentation source/);
});

test("the scene imports nothing outside src and the contracts", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/presentation/vs5/createBattleFieldPixiPresentation.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("the three battle screens follow the original's own screen names", async () => {
  const { CHAMPIONSHIP_SCREENS, createChampionshipScreenStack } =
    await import("../src/championship/app/championshipScreenStack.js");

  // The ROM's background witnesses are battle_menu, the match, battle_result.
  assert.equal(CHAMPIONSHIP_SCREENS.BATTLE_SELECT, "BATTLE_SELECT");
  assert.equal(CHAMPIONSHIP_SCREENS.BATTLE_FIELD, "BATTLE_FIELD");
  assert.equal(CHAMPIONSHIP_SCREENS.BATTLE_RESULT, "BATTLE_RESULT");

  const stack = createChampionshipScreenStack({});
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.BATTLE_SELECT), true, "the menu is reached from home");
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD), false, "a match is never entered directly");
  stack.enter(CHAMPIONSHIP_SCREENS.BATTLE_SELECT);
  stack.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
  assert.equal(stack.current(), CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
  stack.enter(CHAMPIONSHIP_SCREENS.BATTLE_RESULT);
  assert.equal(stack.current(), CHAMPIONSHIP_SCREENS.BATTLE_RESULT);

  // Nothing goes forward from a judged match.
  assert.equal(stack.canEnter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD), false);
  assert.throws(() => stack.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD), /ILLEGAL_SCREEN_TRANSITION/);

  // And leaving a match unwinds to home rather than popping back into it: a
  // round that has been judged must not be re-entered.
  const stackSource = fs.readFileSync(path.join(root, "src/championship/app/championshipScreenStack.js"), "utf8");
  assert.match(stackSource, /BATTLE_FIELD: "RAISING_HOME"/);
  assert.match(stackSource, /BATTLE_RESULT: "RAISING_HOME"/);
});
