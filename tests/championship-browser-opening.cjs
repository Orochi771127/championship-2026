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
//
// The native capture is a four-stage gesture and every stage was found by
// driving the running game, not by reading a spec:
//
//   1. PAN     the wilds wander out of the camera window and the player does
//              not follow them, so a scripted run has to bring one back into
//              view first. Dragging the ground only pans while the HAND tool is
//              held; with ROPE selected a drag is a rope stroke instead.
//   2. ROPE    a FAST loop around the target binds it (WILD -> TETHERED). The
//              hint says 快速畫圈 and means it: pacing the loop so the native
//              sampler sees more of it measured WORSE, because a slow loop
//              gives the target time to walk out. Binding is chancy even when
//              the aim is right -- roughly one stroke in three -- so the retry
//              envelope, not the stroke shape, is what makes a run land.
//   3. PULL    holding still on a bound target does nothing. The rope has to be
//              dragged taut, roughly 120px, and then HELD: releasing restores
//              the target's durability (放鬆可恢復耐久) and it recovers, which
//              is why a pull-release-pull loop oscillates TETHERED/DOWN_ANIMATION
//              forever. Held continuously it reaches HAND_READY in ~4-5s.
//   4. HAND    switch to the hand and tap; the actor leaves the live list once
//              it is on the memory card.
//
// The wilds are owned by the native controller and move every frame, so their
// positions cannot be computed from the gate's spawn table. Developer Mode
// publishes them on the field host, which is why a capture run needs
// `presentation=developer`.
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

/**
 * Capture one wild through the native gesture chain.
 *
 * Returns the captured wildId, or null once the budget is spent. Binding is
 * genuinely chancy -- the target keeps moving while the loop is being drawn --
 * so the caller's budget is a retry envelope, not a timeout on one attempt.
 */
async function captureOneWild(page, box, { attempts = 12 } = {}) {
  const centre = { x: box.width / 2, y: box.height / 2 };
  const find = async (id) => (await liveWilds(page)).find((wild) => wild.wildId === id) ?? null;
  const onScreen = (list) => list.filter((wild) => wild.x > 40 && wild.y > 40 && wild.x < box.width - 50 && wild.y < box.height - 60);
  // A standing target first, then the closest. A loop takes real time to draw
  // and a walking creature is usually out of it by the time it closes, which is
  // most of why a scripted bind misses.
  const nearest = (list) => list
    .map((wild) => ({ wild, distance: Math.hypot(wild.x - centre.x, wild.y - centre.y) }))
    .sort((a, b) => (a.wild.moving === b.wild.moving ? a.distance - b.distance : (a.wild.moving ? 1 : -1)))[0] ?? null;

  async function panToward(wild) {
    // huntFieldPointer reports dx as (previous - current)/scale and the camera
    // centre moves by +dx, so pulling the pointer back by the offset brings the
    // target in. The drag has to start on empty ground or it selects instead.
    const from = { x: box.x + centre.x, y: box.y + centre.y };
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
    await page.waitForTimeout(200);
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let pick = nearest(await liveWilds(page));
    if (!pick) { await page.waitForTimeout(300); continue; }
    if (pick.distance > 90) {
      await selectHuntTool(page, "手");
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
        await selectHuntTool(page, "手");
        await panToward(target);
        target = await find(pick.wild.wildId);
        if (!target) break;
      }
      await selectHuntTool(page, "繩索");
      // Wait out a stride rather than drawing around a target mid-step.
      for (let settle = 1; settle <= 6 && target.moving; settle += 1) {
        await page.waitForTimeout(220);
        target = await find(pick.wild.wildId);
        if (!target) break;
      }
      if (!target) break;
      // Two rules shape this loop, and both come from the recognizer rather than
      // from taste:
      //   * recognizeNativeRopeStroke refuses a loop whose left-to-top extreme
      //     span is 25 native pixels or less. Screen pixels are ~0.66 native at
      //     this viewport, so radius 48 gives ~45 and clears it with room.
      //   * the stroke is sampled by the native controller's own ~60Hz step
      //     rather than by pointermove, and it needs six samples -- but pacing
      //     the loop to feed that clock measured WORSE, because a slow loop
      //     gives the target time to walk out of it. Fast and wide wins.
      const cx = box.x + target.x, cy = box.y + target.y, radius = 48, arc = 20;
      await page.mouse.move(cx + radius, cy);
      await page.mouse.down();
      for (let step = 1; step <= arc; step += 1) {
        const angle = (step / arc) * Math.PI * 2;
        await page.mouse.move(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
      await page.mouse.up();
      await page.waitForTimeout(340);
      const now = await find(target.wildId);
      if (now?.state === "TETHERED") bound = now;
    }
    if (!bound) continue;

    // Taut and held: never release until it is down, or it recovers.
    await page.mouse.move(box.x + bound.x, box.y + bound.y);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) await page.mouse.move(box.x + bound.x + step * 10, box.y + bound.y);
    let down = null;
    for (let poll = 1; poll <= 30; poll += 1) {
      await page.waitForTimeout(400);
      const now = await find(bound.wildId);
      if (!now || now.state === "WILD") break;          // the rope gave out
      if (now.state === "HAND_READY") { down = now; break; }
    }
    await page.mouse.up();
    if (!down) continue;

    await selectHuntTool(page, "手");
    for (let tap = 1; tap <= 10; tap += 1) {
      const now = await find(bound.wildId);
      if (!now) return bound.wildId;                     // on the card, off the live list
      await page.mouse.click(box.x + now.x, box.y + now.y);
      await page.waitForTimeout(320);
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
