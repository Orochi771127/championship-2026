// The one place the browser gates learn how a player reaches the game.
//
// WHY THIS FILE EXISTS
// --------------------
// Seven gates each hard-coded `page.click("#cm-new-game")`. When the title
// screen gained its LOGIN gate and New Game began running the original's
// opening, every one of them broke at the same line on the same day, and the
// VS1 acceptance gate had been silently failing for six days before anyone
// noticed. Duplicated boot code is what rotted, so the boot lives here now:
// when the opening changes again, it changes once.
//
// WHAT THE OPENING IS
// -------------------
// LOGIN reveals New Game / Continue. New Game then plays the scrolling story,
// the envelope, the welcome letter, the tamer name and its confirmation, the
// two gift letters, and finally the egg's name, which is what starts the game.
// None of it is skippable, so the gates perform it rather than reaching past
// it: that sequence IS the accepted boot path.

/** Reveal New Game / Continue. Every entry to the game goes through it. */
async function login(page) {
  await page.click("#cm-login");
}

/**
 * Play the New Game opening through to the egg's name.
 *
 * Assumes LOGIN has already been clicked. Returns the names it entered so a
 * caller can assert on the identity the opening created.
 */
async function playOpening(page, { trainerName = "測試", eggName = "小蛋" } = {}) {
  await page.click("#cm-new-game");
  // The story advances on click once a card has finished revealing, and ends on
  // its own otherwise. Nudge it so a gate does not sit through the full run.
  const story = page.locator(".cm-opening-story");
  for (let attempt = 0; attempt < 40 && (await page.locator(".cm-opening__envelope").count()) === 0; attempt += 1) {
    if (await story.count()) await story.click({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.click(".cm-opening__envelope");
  await page.click(".cm-opening__letter button");
  await page.fill("#cm-opening-name", trainerName);
  await page.click(".cm-opening__name button[type=submit]");
  // 是 / 否 on the tamer name; the first choice accepts it.
  await page.locator(".cm-opening__choices button").first().click();
  await page.click(".cm-opening__envelope");
  await page.click(".cm-opening__letter button");
  await page.click(".cm-opening__letter button");
  await page.fill("#cm-opening-name", eggName);
  await page.click(".cm-opening__name button[type=submit]");
  return { trainerName, eggName };
}

/**
 * Take an already-loaded page from the title screen into the running game.
 *
 * `continueGame` restores the stored save instead of playing the opening.
 */
async function startGame(page, { continueGame = false, ...names } = {}) {
  await login(page);
  if (continueGame) {
    await page.click("#cm-continue");
    return null;
  }
  return playOpening(page, names);
}

/**
 * Navigate and start, clearing the stored save first the way most gates do so
 * each run begins from a real New Game.
 */
async function openFreshGame(page, url, options = {}) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  return startGame(page, options);
}

/** Raising Home is ready and on screen. Replaces waiting on `.cm-vs2-entry`,
 *  which was a Home-screen button before Hunt moved into the shared toolbar. */
const RAISING_HOME = "[data-screen='RAISING_HOME']";

/**
 * Reach Gate Select from Raising Home.
 *
 * The standalone Hunt button on the Home screen is gone: entries live in the
 * shared toolbar's SYSTEM menu now, alongside database, battle and shop.
 */
async function openHunt(page, { timeout = 15000 } = {}) {
  await page.locator('button[data-menu-id="SYSTEM"]').click();
  await page.locator('[data-entry-id="hunt"]').click();
  await page.waitForSelector("[data-screen='GATE_SELECT']", { timeout });
  // The screen attribute lands before the shell is built. Callers measure the
  // shell, so waiting on the attribute alone hands them a half-mounted screen.
  await page.waitForSelector(".cm-vs2-shell", { timeout });
  await page.waitForFunction(() => Boolean(document.getElementById("cm-root")?.dataset.gatePresentation), null, { timeout });
}

const GATE_CONFIRM = ".cm-vs2-footer .cm-vs2-action--primary";

/**
 * Select a destination this player can actually enter, and return its gate id.
 *
 * A fresh game holds 0 Bits and rank 0, and the ROM's gate table charges an
 * entrance fee and gates most destinations behind a tamer rank -- only the
 * fee-free, initially-available ones are open at that point. Picking "the first
 * visible node" therefore lands on a locked gate and leaves the confirm button
 * disabled, which is the game telling the truth, not a defect. Clicking until
 * the confirm enables keeps the gates honest about admission without pinning
 * them to whichever gate happens to be free today.
 *
 * `selector` chooses between the 3D world nodes and the fallback cards.
 */
async function selectEnterableGate(page, { selector = ".cm-vs2-gate3d__node-hit:not([hidden])" } = {}) {
  const nodes = page.locator(selector);
  const total = await nodes.count();
  for (let index = 0; index < total; index += 1) {
    const node = nodes.nth(index);
    await node.click();
    if (!(await page.locator(GATE_CONFIRM).isDisabled())) {
      return node.getAttribute("data-gate-id");
    }
  }
  throw new Error(`no enterable gate among ${total} matching ${selector}`);
}

// --- Hunt capture -----------------------------------------------------------
// Normal input chain: pan on empty ground, sampled circle, hold a taut rope,
// then hand collection. Developer diagnostics expose readonly rendered actor
// positions; no test writes actor state, RNG, HP or inventory.
// The VS3 gate controls browser time so every circle sample reaches the native
// controller. Twelve samples fit its twenty-update slot lifetime. Pull begins
// inside the actor rectangle and one update handles pointer-down before motion.
// Following the live target keeps the tether in range while original AI runs.
const WILD_POSITIONS = "[data-wild-screen-positions]";

async function liveWilds(page) {
  return page.evaluate((selector) => {
    const raw = document.querySelector(selector)?.dataset.wildScreenPositions;
    return raw ? JSON.parse(raw) : [];
  }, WILD_POSITIONS);
}

async function selectHuntTool(page, label) {
  await page.locator(".cm-hunt-tools .cm-vs2-action").filter({ hasText: label }).first().click();
  await page.waitForTimeout(120);
}

/** Capture through normal tools, returning the collected identity or null.
 * Virtual-time mode controls input cadence only; it never bypasses the game.
 */
async function captureOneWild(page, box, { attempts = 12, controlledClock = false } = {}) {
  const trace=async stage=>{if(process.env.CHAMPIONSHIP_QA_TRACE)console.log(stage,await page.locator('[data-hunt-tool-state]').getAttribute('data-hunt-tool-state'));};
  const advance = async ms => {
    if(!controlledClock)return page.waitForTimeout(ms);
    // Chromium may coalesce pointer events on its real compositor cadence.
    // Let input delivery finish while game time is paused, then step timers.
    await page.waitForTimeout(20);
    return page.clock.runFor(ms);
  };
  const sampleFrame=async()=>{
    const read=async()=>JSON.parse(await page.locator('[data-hunt-tool-state]').getAttribute('data-hunt-tool-state'));
    const before=await read();
    for(let poll=0;poll<8;poll++){
      await advance(17);const after=await read();
      if(after.fault)throw Error(after.fault);
      if(after.frame>before.frame)return after;
    }
    throw Error('native Hunt controller did not process the pointer sample: '+JSON.stringify({before,after:await read(),browser:await page.evaluate(()=>({time:performance.now(),visibility:document.visibilityState,screen:document.querySelector('#cm-root')?.dataset.screen}))}));
  };
  const tool = async label => {
    await page.locator('.cm-hunt-tools .cm-vs2-action').filter({hasText:label}).first().click({force:controlledClock});
    await advance(120);
  };
  const centre = { x: box.width / 2, y: box.height / 2 };
  const find = async (id) => (await liveWilds(page)).find((wild) => wild.wildId === id) ?? null;
  const onScreen = (list) => list.filter((wild) => wild.x > 40 && wild.y > 40 && wild.x < box.width - 50 && wild.y < box.height - 60);
  // Prefer lower-HP targets for the initial rope, then standing and nearby
  // targets. Their original HP, motion and capture conditions remain active.
  const nearest = (list) => list
    .map((wild) => ({ wild, distance: Math.hypot(wild.x - centre.x, wild.y - centre.y) }))
    .sort((a, b) => (a.wild.maxHp-b.wild.maxHp) || (a.wild.moving === b.wild.moving ? a.distance - b.distance : (a.wild.moving ? 1 : -1)))[0] ?? null;

  async function panToward(wild) {
    for(let pan=0;pan<12;pan++) {
      wild=await find(wild.wildId);
      if(!wild||Math.hypot(wild.x-centre.x,wild.y-centre.y)<45)return;
      // huntFieldPointer reports dx as (previous - current)/scale and the camera
      // centre moves by +dx, so pulling the pointer back by the offset brings the
      // target in. The drag has to start on empty ground or it selects instead.
      const occupied=await liveWilds(page);
      const blank=[{x:centre.x,y:centre.y},{x:30,y:centre.y},{x:box.width-30,y:centre.y},{x:centre.x,y:centre.y+100}]
        .find(p=>!occupied.some(a=>Math.abs(a.x-p.x)<35&&Math.abs(a.y-p.y)<55));
      if(!blank)return;
      const from = { x: box.x + blank.x, y: box.y + blank.y };
      const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
      const to = {
        x: clamp(from.x - (wild.x - centre.x), box.x + 6, box.x + box.width - 6),
        y: clamp(from.y - (wild.y - centre.y), box.y + 6, box.y + box.height - 6)
      };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let step = 1; step <= 10; step += 1) {
        await page.mouse.move(from.x + (to.x - from.x) * step / 10, from.y + (to.y - from.y) * step / 10);
      }
      await page.mouse.up();
      await advance(200);
    }
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const available=await liveWilds(page);
    let pick = nearest(onScreen(available))??nearest(available);
    if (!pick) { await advance(300); continue; }
    if (pick.distance > 90) {
      await tool("手");
      await panToward(pick.wild);
      pick = nearest(onScreen(await liveWilds(page)));
      if (!pick) continue;
    }

    // Several loops at the freshest position of the same target: the pan just
    // put it in reach, and a miss is usually the target having stepped out of
    // the loop while it was being drawn rather than the wrong target.
    let bound = null;
    for (let loop = 1; loop <= 6 && !bound; loop += 1) {
      let target = await find(pick.wild.wildId);
      if (!target) break;
      // Re-centre before every loop, not just the first. A missed stroke sends
      // the target running and the player does not follow, so without this the
      // second and later loops are drawn at a creature that has already left.
      if (Math.hypot(target.x - centre.x, target.y - centre.y) > 60) {
        await tool("手");
        await panToward(target);
        target = await find(pick.wild.wildId);
        if (!target) break;
      }
      await tool("繩索");
      // Wait out a stride rather than drawing around a target mid-step.
      for (let settle = 1; settle <= 6 && target.moving; settle += 1) {
        await advance(220);
        target = await find(pick.wild.wildId);
        if (!target) break;
      }
      if (!target) break;
      // Native recognition needs at least six samples and >25px extreme
      // span. Keep the whole circle within the twenty-update slot lifetime.
      const cx = box.x + target.x, cy = box.y + target.y, radius = 60, arc = controlledClock?12:20;
      await page.mouse.move(cx + radius, cy);
      await page.mouse.down();
      if(controlledClock) await sampleFrame();
      await trace('CIRCLE_DOWN');
      for (let step = 1; step <= arc; step += 1) {
        const angle = (step / arc) * Math.PI * 2;
        await page.mouse.move(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        if(controlledClock) await sampleFrame();
      }
      await page.mouse.up();
      if(controlledClock)await sampleFrame();
      await trace('CIRCLE_RELEASE');
      await advance(340);
      const now = await find(target.wildId);
      if (now?.state === "TETHERED") bound = now;
    }
    if (!bound) continue;
    if(process.env.CHAMPIONSHIP_QA_TRACE)console.log('BOUND',JSON.stringify(bound));
    if(bound.y<200||bound.y>box.height-100||bound.x<30||bound.x>box.width-110) {
      await tool('手');await panToward(bound);await tool('繩索');
      bound=await find(bound.wildId);
      if(!bound||bound.state!=='TETHERED'||bound.x<30||bound.x>box.width-110||bound.y<200||bound.y>box.height-100)continue;
    }

    // Taut and held: never release until it is down, or it recovers.
    await page.mouse.move(box.x + bound.x, box.y + bound.y - 8);
    await page.mouse.down();
    if(controlledClock){
      const attached=await sampleFrame();
      // Overlapping native hit boxes may select a different bound actor.
      // Follow the controller's selected rope target, not our intended target.
      bound=attached.rope?await find(attached.rope.wildId):null;
      if(!bound){await page.mouse.up();await sampleFrame();continue;}
    }
    for (let step = 1; step <= 12; step += 1) await page.mouse.move(box.x + bound.x + step * 7.5, box.y + bound.y - 15);
    let down = null;
    let refilling=false;
    for (let poll = 1; poll <= (controlledClock?6000:30); poll += 1) {
      const control=controlledClock?await sampleFrame():(await advance(400),null);
      const now = await find(bound.wildId);
      if (!now || now.state === "WILD") break;          // the rope gave out
      if (now.state === "HAND_READY") { down = now; break; }
      if(controlledClock){
        if(control.rope){
          if(control.rope.durability<40)refilling=true;
          if(control.rope.durability>control.rope.capacity*.85)refilling=false;
        }
        // Slack restores the rope without releasing; strong pulls point back
        // into the viewport instead of walking the actor off its right edge.
        const dx=centre.x-now.x,dy=centre.y-now.y,dist=Math.hypot(dx,dy);
        const length=refilling?20:140;
        const vx=dist>45?dx/dist:(now.x>centre.x?-1:1),vy=dist>45?dy/dist:0;
        await page.mouse.move(box.x+now.x+vx*length,box.y+now.y-15+vy*length);
      }
    }
    await page.mouse.up();
    if (!down) continue;

    await tool("手");
    for (let tap = 1; tap <= 10; tap += 1) {
      const now = await find(bound.wildId);
      if (!now) return bound.wildId;                     // on the card, off the live list
      await page.mouse.click(box.x + now.x, box.y + now.y);
      await advance(320);
    }
    if (!(await find(bound.wildId))) return bound.wildId;
  }
  return null;
}

/** exitHunt refuses while a capture animation is still running. */
async function leaveHuntField(page, { attempts = 30 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.locator(".cm-vs2-hud__exit").click();
    await page.waitForTimeout(500);
    const screen = await page.locator("#cm-root").getAttribute("data-screen");
    if (screen !== "HUNT_FIELD") return screen;
  }
  return page.locator("#cm-root").getAttribute("data-screen");
}

module.exports = {
  login, playOpening, startGame, openFreshGame, openHunt, selectEnterableGate,
  liveWilds, selectHuntTool, captureOneWild, leaveHuntField,
  RAISING_HOME, GATE_CONFIRM, WILD_POSITIONS
};
