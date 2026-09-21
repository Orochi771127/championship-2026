// VS3 browser gate: ordinary opening, equipped rope, native capture,
// memory card, result naming and home membership. Browser time controls input
// sampling without changing gameplay state, odds, HP or RNG authorities.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { startGame, openFreshGame, openHunt, captureOneWild, leaveHuntField, liveWilds, RAISING_HOME } = require("./championship-browser-opening.cjs");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = require("./browser-qa-output.cjs")("vs3");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const VIEWPORT = { width: 390, height: 844 };
const TARGET_SPECIES = process.env.CHAMPIONSHIP_QA_TARGET_SPECIES || null;
const TARGET_GATE = process.env.CHAMPIONSHIP_QA_GATE || null;
const INITIAL_CLOCK = process.env.CHAMPIONSHIP_QA_CLOCK || '2026-09-10T12:34:56Z';
const WORLD_END_DAYS = Number(process.env.CHAMPIONSHIP_QA_END_DAYS || 0);
const WORLD_HOUR = Number(process.env.CHAMPIONSHIP_QA_WORLD_HOUR || 7);
const REVIEW_KEY = new URL(BASE_URL).searchParams.get('characterArtReview');
const REVIEW_CONFIG = {
  m001:{speciesId:'species-008',folder:'m001-r05-anchored'},
  m002:{speciesId:'species-009',folder:'m002_choromon-hf-r01'},
  m003:{speciesId:'species-010',folder:'m003_nyokimon-hf-r03'},
  m004:{speciesId:'species-011',folder:'m004_bubbmon-hf-r03'},
  m005:{speciesId:'species-012',folder:'m005_pitchmon-hf-r06'},
  m006:{speciesId:'species-013',folder:'m006_punimon-hf-r06'},
  m007:{speciesId:'species-014',folder:'m007_botamon-hf-r06'},
  m008:{speciesId:'species-015',folder:'m008_poyomon-hf-r03'},
  m009:{speciesId:'species-016',folder:'m009_mokumon-hf-r06'},
  m010:{speciesId:'species-017',folder:'m010_yukimibotamon-hf-r01'},
  m011:{speciesId:'species-018',folder:'m011_yuramon-hf-r02'},
  m012:{speciesId:'species-019',folder:'m012_petimon-hf-r03'},
  m101:{speciesId:'species-020',folder:'m101_caprimon-hf-r06'},
  m102:{speciesId:'species-021',folder:'m102_koromon-hf-r03'},
  m103:{speciesId:'species-022',folder:'m103_tanemon-hf-r03'},
  m104:{speciesId:'species-023',folder:'m104_tunomon-hf-r02'},
  m105:{speciesId:'species-024',folder:'m105_tokomon-hf-r01'}
}[REVIEW_KEY] ?? null;

fs.mkdirSync(SCREENSHOTS, { recursive: true });

(async () => {
  const { listChampionshipGates } = await import("../src/championship/gate/gateCatalog.js");
  const { createHuntWorld } = await import("../src/championship/hunt/huntWorld.js");
  let seededSaveEntries=null;
  if(WORLD_END_DAYS>0){
    assert.ok(Number.isInteger(WORLD_END_DAYS)&&WORLD_END_DAYS<=31,'QA end-day count must be 0..31');
    assert.ok(Number.isInteger(WORLD_HOUR)&&WORLD_HOUR>=7&&WORLD_HOUR<22,'QA world hour must be 7..21');
    const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
    const catalog=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json','utf8'));
    const {cages}=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json','utf8'));
    const saved=new Map();const storage={getItem:key=>saved.get(key)??null,
      setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
    const seedDate=new Date(INITIAL_CLOCK);
    const fixture=createChampionshipStandaloneApp({storage,catalog,cages,rngClock:()=>({
      hour:seedDate.getUTCHours(),minute:seedDate.getUTCMinutes(),second:seedDate.getUTCSeconds()})});
    await fixture.newGame({trainerName:'測試',eggName:'小蛋'});
    for(let day=0;day<WORLD_END_DAYS;day+=1){
      assert.equal(fixture.endDay()?.accepted,true,'fixture must use the public End Day rule');
      fixture.advanceRaisingPresentation({frames:40});
      assert.equal(fixture.acknowledgeRaisingCalendar(),true);
      fixture.advanceRaisingPresentation({frames:26});
    }
    if(WORLD_HOUR>7)fixture.advanceClock({units:(WORLD_HOUR-7)*60*400});
    assert.equal(fixture.save().phase,'SAVED');
    seededSaveEntries=[...saved.entries()];
    await fixture.dispose();
  }

  // The gate a fresh tamer can actually walk into: rank 0 and 0 Bits only pass
  // the fee-free, initially-available row of the ROM's gate table. Taking the
  // first row instead charged 450 Bits and needed rank 3, so the confirm button
  // was correctly disabled and the capture flow never started.
  const entryGate = listChampionshipGates().find((gate) => TARGET_GATE ? gate.gateId===TARGET_GATE : gate.entranceFeeBits === 0 && gate.unlockKind === 0);
  assert.ok(entryGate, "the catalog must offer one fee-free initial gate");
  // The gate's spawn table is no longer what fills the field -- the native
  // controller owns the wilds -- so it is kept only to assert the gate is a
  // populated one before the browser is even launched.
  const world = createHuntWorld(entryGate);
  assert.ok(world.wildCreatures[0], `${entryGate.gateId} must spawn a wild creature`);

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, timezoneId:'UTC' });
  const page = await context.newPage();
  await page.clock.install({time: new Date("2026-09-10T12:00:00Z")});
  // Original startup RNG is clock-seeded. Keep its clock input reproducible
  // across source/artifact servers while performance/timer time still advances.
  await page.clock.setFixedTime(new Date(INITIAL_CLOCK));
  const problems = [];
  const reviewAssets=new Set(),boundSamples=[];
  page.on('response',r=>{if(r.ok()&&REVIEW_CONFIG&&r.url().includes(`/internal-character-review/${REVIEW_CONFIG.folder}/`))
    reviewAssets.add(new URL(r.url()).pathname);});
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });

  try {
    // Developer Mode publishes the live actor positions this gate has to aim at:
    // the native controller owns the wilds and moves them every frame, so
    // nothing outside the running field can work out where they are.
    const join = BASE_URL.includes("?") ? "&" : "?";
    const runUrl=`${BASE_URL}${join}gateMode=fallback&presentation=developer`;
    if(seededSaveEntries){
      await page.goto(runUrl,{waitUntil:'networkidle'});
      await page.evaluate(entries=>{localStorage.clear();for(const [key,value] of entries)localStorage.setItem(key,value);},seededSaveEntries);
      await page.reload({waitUntil:'networkidle'});
      await startGame(page,{continueGame:true});
    }else await openFreshGame(page,runUrl);
    await page.waitForSelector(RAISING_HOME, { timeout: 20000 });
    if(seededSaveEntries){
      assert.equal(await page.locator('.cm-status-bar__season').getAttribute('data-season'),['spring','summer','autumn','winter'][Math.floor(WORLD_END_DAYS/8)%4]);
      assert.equal(await page.locator('.cm-status-bar__time').textContent(),`${String(WORLD_HOUR).padStart(2,'0')}:00`);
    }
    const residentCountBefore = await page.locator("[data-resident-count]").getAttribute("data-resident-count");
    await openHunt(page);
    await page.locator(`.cm-vs2-gates [data-gate-id="${entryGate.gateId}"]`).click();
    assert.equal(await page.locator('.cm-vs2-gates [aria-selected="true"]').getAttribute('data-gate-id'),entryGate.gateId,
      'the requested review gate must be the selected normal UI destination');
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
    // The rope tool is disabled until one is equipped, and the rope is what
    // binds a target: an empty loadout can reach the field but cannot capture.
    await page.locator('[data-equipment-class="ROPE"] [data-item-id]').first().click();
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
    const canvas = page.locator(".cm-vs2-field__canvas canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    let initialWilds=[];
    for(let attempt=0;attempt<60&&initialWilds.length===0;attempt+=1){
      await page.waitForTimeout(250);
      initialWilds=await liveWilds(page);
    }

    // The field hint is the tool system's now, and it is Traditional Chinese:
    // the default movement/grab line, replaced per tool once one is selected.
    // "Draw a circle" survives as the ROPE tool's own hint, not the default.
    const hint = await page.locator(".cm-vs2-field__hint").innerText();
    assert.match(hint, /拖曳地面移動視野/);
    assert.doesNotMatch(await page.locator("#cm-root").innerText(), /\bCAPTURE\b/);

    const canvasBox = await canvas.boundingBox();
    assert.ok(canvasBox && canvasBox.height > 200, "Hunt field canvas is too small");

    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-field-before-loop-390x844.png") });

    // Pause virtual time only after reaching the field through ordinary UI.
    // Feed each pointer sample through the real clock/controller/render loop.
    await page.clock.pauseAt(new Date(new Date(INITIAL_CLOCK).getTime() + 60_000));
    if(TARGET_SPECIES)assert.ok(initialWilds.some(w=>w.speciesId===TARGET_SPECIES),'requested donor must actually spawn; requested gate '
      +entryGate.gateId+'; observed '+JSON.stringify(initialWilds.map(w=>({wildId:w.wildId,speciesId:w.speciesId}))));
    const capturedWildId = await captureOneWild(page, canvasBox, { attempts: 12, controlledClock: true, targetSpeciesId: TARGET_SPECIES,
      onBound:TARGET_SPECIES?async bound=>{boundSamples.push(bound);await page.screenshot({path:path.join(SCREENSHOTS,'target-bound.png')});}:null });
    const capturedSpeciesId=initialWilds.find(w=>w.wildId===capturedWildId)?.speciesId
      ??boundSamples.find(w=>w.wildId===capturedWildId)?.speciesId??null;
    if(TARGET_SPECIES)assert.equal(capturedSpeciesId,TARGET_SPECIES,
      'must capture the reviewed donor, including a target spawned after the first field snapshot');
    await page.clock.resume();
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-after-loop-390x844.png") });
    assert.deepEqual(problems, [], 'capture must not hide browser or asset errors');
    assert.ok(capturedWildId, `no wild reached the memory card. canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`);

    const leftField = await leaveHuntField(page);
    assert.equal(leftField, "HUNT_RESULT", "a wild on the card must open Hunt Result on the way out");
    const resultText = await page.locator("#cm-root").innerText();
    const resultPortrait=await page.locator('.cm-vs2-result__portrait').getAttribute('src');
    if(REVIEW_CONFIG&&TARGET_SPECIES===REVIEW_CONFIG.speciesId){
      assert.match(resultPortrait,new RegExp(`internal-character-review/${REVIEW_CONFIG.folder}/hud-r01/main-cell_000\\.png$`));
      assert.ok([...reviewAssets].some(p=>p.endsWith(`/${REVIEW_CONFIG.folder}/main.png`)),'moving original actor bank loaded');
      assert.ok(boundSamples.some(w=>w.speciesId===TARGET_SPECIES&&w.state==='TETHERED'),'actual donor bound state observed');
      await page.locator('.cm-vs2-result__portrait').evaluate(img=>img.decode());
    }
    assert.doesNotMatch(resultText, /\bCAPTURE\b/);
    assert.equal(await page.locator("[data-cm-name-edit]").count(), 1);
    await page.locator("[data-cm-name-edit]").fill("Ember");
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-result-390x844.png") });

    const residentsBefore = Number(residentCountBefore);
    await page.locator(".cm-vs2-action--primary").click();
    await page.waitForSelector(RAISING_HOME, { timeout: 15000 });
    await page.waitForSelector("[data-resident-count]", { timeout: 15000 });
    const residentCount = await page.locator("[data-resident-count]").getAttribute("data-resident-count");
    assert.equal(Number(residentCount), residentsBefore + 1, "enclosed instance must appear at Raising Home");
    const raisingSamples=[];
    if(REVIEW_CONFIG&&TARGET_SPECIES===REVIEW_CONFIG.speciesId){
      const host='.int-rh2-field-host[data-resident-screen-positions]';
      await page.locator(host).waitFor({state:'visible',timeout:15000});
      for(let i=0;i<10;i++){
        const rows=await page.locator(host).evaluate(node=>JSON.parse(node.dataset.residentScreenPositions||'[]'));
        const candidate=rows.find(row=>row.speciesIndex===Number(TARGET_SPECIES.slice(-3)));
        if(candidate)raisingSamples.push({speciesIndex:candidate.speciesIndex,state:candidate.state,
          nativeFrame:candidate.nativeFrame,sequenceId:candidate.sequenceId,x:candidate.x,y:candidate.y});
        await page.waitForTimeout(180);
      }
      assert.ok(raisingSamples.length>=2,'captured candidate must render in the normal Raising field');
      assert.ok(new Set(raisingSamples.map(row=>row.nativeFrame)).size>=2,
        'normal Raising field must advance the candidate native animation frames');
    }
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-returned-home-390x844.png") });

    assert.deepEqual(problems, [], "console or page errors");
    const report = {
      gate: "CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA",
      date: new Date().toISOString(),
      baseUrl: BASE_URL,
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
      selectedGateId: entryGate.gateId,
      capturedWildId,
      capturedSpeciesId,
      resultPortrait,reviewAssets:[...reviewAssets],boundSamples,raisingSamples,
      captureButtonPresent: false,
      inputCadence: "WAIT_FOR_OBSERVED_NATIVE_FRAME_PER_POINTER_SAMPLE",
      initialClock: INITIAL_CLOCK + " (UTC, fixed Date for original clock-seeded RNG)",
      setup: new URL(BASE_URL).searchParams.get('qa')==='unlock' ? "ISOLATED_QA_GATE_UNLOCK_NORMAL_NATIVE_SPAWN_AND_POINTER_CAPTURE" : "NORMAL_NEW_GAME_AND_LOADOUT_NO_STATE_INJECTION",
      worldRouteSetup:{endDaysThroughPublicAppFixture:WORLD_END_DAYS,targetHour:WORLD_HOUR,
        browserEntry:seededSaveEntries?'CONTINUE_NORMAL_SAVE':'NEW_GAME'},
      verdict: "PASS"
    };
    fs.writeFileSync(path.join(OUTPUT, "VS3_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log("CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA_PASS");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});
