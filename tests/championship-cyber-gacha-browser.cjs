// Cyber Gachapon UI gate (Owner 2026-10-29, second pass), controlled browser run.
// Phone portrait 393x740. Checks that no system emoji appears on the gacha
// surfaces, the shop tab's ticket badge is never clipped, the toolbar badge
// clears its label, the bottom plates have contrast, one tap turns the machine
// (16 capsules moving), a ten-pull always deals exactly ten cards, the synth
// keys keep one line, the last list row scrolls clear of the footer, no page
// error, and storage keeps the same keys. Saves the phone screenshots.
// Run against an isolated QA origin (CHAMPIONSHIP_QA_ORIGIN), never the
// Owner's own save origin.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const output = require("./browser-qa-output.cjs")("cyber-gacha");
fs.mkdirSync(output, { recursive: true });
const base = process.env.CHAMPIONSHIP_QA_ORIGIN || "http://127.0.0.1:8732";
const attempts = Number(process.env.GACHA_TEN_PULLS || 6);
// The page under test: the source page by default, or the built artifact on the same origin.
const gamePage = process.env.CHAMPIONSHIP_QA_PAGE || "/championship.html";
const EMOJI = "\\p{Extended_Pictographic}";

// Every text node, alt, title and aria-label under the given selectors.
function emojiHits([selectors, source]) {
  const pattern = new RegExp(source, "u");
  const hits = [];
  for (const root of document.querySelectorAll(selectors)) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (pattern.test(node.textContent)) hits.push(node.textContent.trim());
    for (const el of root.querySelectorAll("[alt], [title], [aria-label]")) {
      for (const name of ["alt", "title", "aria-label"]) if (pattern.test(el.getAttribute(name) ?? "")) hits.push(`${name}=${el.getAttribute(name)}`);
    }
  }
  return hits;
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 740 }, deviceScaleFactor: 3 });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shot = (name) => page.screenshot({ path: path.join(output, name) });
  // Freeze the show mid-motion for a picture; only animations that were running resume.
  const freeze = () => page.evaluate(() => { globalThis.__gachaFrozen = document.getAnimations().filter((a) => a.playState === "running"); globalThis.__gachaFrozen.forEach((a) => a.pause()); });
  const thaw = () => page.evaluate(() => { (globalThis.__gachaFrozen ?? []).forEach((a) => a.play()); globalThis.__gachaFrozen = []; });
  const report = {};
  try {
    await page.goto(base + "/tests/fixtures/championship-owned-party.html");
    await page.locator("#prepare").click();
    await page.locator("#status").filter({ hasText: "受控存檔已準備" }).waitFor();
    await page.goto(base + gamePage + "?gachaQa");
    await page.locator("#cm-login").waitFor();
    if (await page.locator("#cm-film-skip").isVisible().catch(() => false)) await page.locator("#cm-film-skip").click();
    await page.waitForFunction(() => document.querySelector("#cm-login")?.disabled === false);
    await page.locator("#cm-login").click();
    await page.locator("#cm-continue").click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor();
    const keys = () => page.evaluate(() => Object.keys(localStorage).sort());
    // The game's own keys only: one save, its diagnostics, preferences and the session checkpoint.
    const GAME_KEYS = new Set(["championshipModernSave:v1", "championshipModernSave:runtimeDiagnostics:v1",
      "championshipModernSave:preferences:v1", "championshipSessionCheckpoint:v1"]);
    await page.waitForFunction(() => globalThis.__championshipGachaQa);
    report.granted = await page.evaluate((n) => globalThis.__championshipGachaQa.grantTickets(n).granted, 10 * attempts);

    // Toolbar: the ticket badge rides inside the Shop key without covering 商店.
    await page.waitForFunction(() => document.querySelector('[data-quick-id="shop"] .cm-gacha-dock-badge:not([hidden])'));
    const dock = await page.evaluate(() => {
      const key = document.querySelector('[data-quick-id="shop"]');
      const label = key.querySelector(".cm-toolbar__entry-label").getBoundingClientRect();
      const badge = key.querySelector(".cm-gacha-dock-badge").getBoundingClientRect();
      return { overlap: !(badge.left >= label.right || badge.right <= label.left || badge.top >= label.bottom || badge.bottom <= label.top), text: key.querySelector(".cm-gacha-dock-badge").textContent };
    });
    assert.equal(dock.overlap, false, "the dock badge never covers the Shop label");
    assert.doesNotMatch(dock.text, new RegExp(EMOJI, "u"), "the dock badge is the ticket picture and a number");
    await shot("00-ranch-dock.png");

    await page.locator('[data-quick-id="shop"]').click();
    await page.locator('.cm-vs2-shop__tab[data-category="PLUGINS"]').click();
    await page.locator(".cm-gacha").waitFor();
    await page.waitForTimeout(700);

    // The tab badge is whole: inside every clipping ancestor up to the screen.
    const badge = await page.evaluate(() => {
      const el = document.querySelector('.cm-vs2-shop__tab[data-category="PLUGINS"] > .cm-gacha-dock-badge');
      const box = el.getBoundingClientRect(), cut = [];
      for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX === "visible" && style.overflowY === "visible" && style.clipPath === "none") continue;
        const r = node.getBoundingClientRect();
        if (box.top < r.top - 0.5 || box.left < r.left - 0.5 || box.right > r.right + 0.5 || box.bottom > r.bottom + 0.5) cut.push(node.className);
      }
      return { cut, overflow: getComputedStyle(el.parentElement).overflow, height: box.height, text: el.textContent };
    });
    assert.deepEqual(badge.cut, [], "no ancestor clips the tab's ticket badge");
    assert.equal(badge.overflow, "visible");
    report.tabBadge = badge;

    // No system emoji on the shop tabs or anywhere in the gacha.
    assert.deepEqual(await page.evaluate(emojiHits, [".cm-vs2-shop__tabs, .cm-gacha", EMOJI]), [], "the gacha shows no system emoji");

    // Dark plates: the rates text has real contrast.
    const contrast = await page.evaluate(() => {
      const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const plate = document.querySelector(".cm-gacha__rates"), style = getComputedStyle(plate);
      const [a, b] = [lum(style.color), lum(style.backgroundColor)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    assert.ok(contrast >= 4.5, `rates plate contrast ${contrast.toFixed(2)} >= 4.5`);
    report.ratesContrast = Number(contrast.toFixed(2));
    const capsules = await page.evaluate(() => document.querySelectorAll(".cm-gacha__dome .cm-gacha__ball").length);
    assert.equal(capsules, 16, "sixteen capsules live in the dome");
    await shot("01-machine.png");

    // Ten-pulls: one tap turns the crank, the pile tumbles, one capsule drops,
    // cracks, and exactly ten cards land. Repeat (再轉十次) until SSR or UR shows.
    let shown = null;
    for (let attempt = 1; attempt <= attempts && !shown; attempt += 1) {
      if (attempt === 1) await page.locator(".cm-gacha__pull--ten").click();
      else await page.locator(".cm-gacha__reveal .cm-gacha__action--again").click();
      if (attempt === 1) {
        await page.waitForFunction(() => document.querySelector(".cm-gacha__stage")?.dataset.state === "dispense");
        await page.waitForTimeout(110);
        await freeze();
        const tumble = await page.evaluate(() => ({
          moving: [...document.querySelectorAll(".cm-gacha__dome .cm-gacha__ball")].filter((b) => b.getAnimations().length > 0).length,
          crank: document.querySelector(".cm-gacha__crank-img").getAnimations().length,
          chute: !document.querySelector(".cm-gacha__chute").hidden
        }));
        assert.equal(tumble.moving, 16, "all sixteen capsules tumble");
        assert.equal(tumble.crank, 1, "the crank turns by itself on one tap");
        assert.equal(tumble.chute, true, "a capsule comes out of the chute");
        await shot("02-tumble.png");
        await thaw();
        await page.waitForFunction(() => document.querySelector(".cm-gacha__reveal")?.dataset.phase === "cards");
        await page.waitForTimeout(70);
        await freeze();
        await shot("02b-crack.png");
        await thaw();
      }
      await page.waitForFunction(() => document.querySelector(".cm-gacha__reveal")?.dataset.phase === "done");
      const deal = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".cm-gacha__reveal .cm-gacha__cards > .cm-gacha__card")];
        const stage = getComputedStyle(document.querySelector(".cm-gacha__reveal"));
        return { count: cards.length, rarities: cards.map((c) => c.dataset.rarity), image: stage.backgroundImage, title: document.querySelector(".cm-gacha__reveal-title").textContent };
      });
      assert.equal(deal.count, 10, "a ten-pull deals exactly ten cards");
      assert.match(deal.image, /radial-gradient/, "the stage is the opaque deep-space gradient");
      assert.deepEqual(await page.evaluate(emojiHits, [".cm-gacha__reveal", EMOJI]), [], "the reveal shows no system emoji");
      if (deal.rarities.some((r) => r === "SSR" || r === "UR")) shown = deal;
      report[`pull${attempt}`] = deal.rarities.join(" ");
    }
    await page.waitForTimeout(500);
    await shot("03-ten-pull.png");
    report.highRarityShown = Boolean(shown);
    await page.locator(".cm-gacha__reveal .cm-gacha__action--primary").click();
    assert.equal(await page.locator(".cm-gacha__reveal:not(.cm-gacha__picker)").isHidden(), true, "確定收下 closes the stage");

    // The synthesizer needs five chips in hand: spin again until there are.
    const chipsInHand = () => page.evaluate(() => globalThis.__championshipGachaQa.frame().chips.reduce((sum, chip) => sum + chip.owned, 0));
    for (let extra = 0; extra < 4 && await chipsInHand() < 5; extra += 1) {
      await page.locator(".cm-gacha__pull--ten").click();
      await page.waitForFunction(() => document.querySelector(".cm-gacha__reveal")?.dataset.phase === "done");
      assert.equal(await page.locator(".cm-gacha__reveal .cm-gacha__cards > .cm-gacha__card").count(), 10);
      await page.locator(".cm-gacha__reveal .cm-gacha__action--primary").click();
    }
    // Synthesizer: one-line keys, plates, auto-fill, and the list clears the footer.
    await page.locator('.cm-gacha__mode[data-mode="SYNTH"]').click();
    await page.locator(".cm-gacha__pane--synth .cm-gacha__tile").first().waitFor();
    const keysLine = await page.evaluate(() => [...document.querySelectorAll(".cm-gacha__pane--synth .cm-gacha__actions .cm-gacha-key")].map((key) => {
      const label = key.querySelector(".cm-gacha-key__label");
      return { text: label.textContent, oneLine: label.getClientRects().length === 1 && label.scrollWidth <= label.clientWidth + 1 };
    }));
    assert.ok(keysLine.every((key) => key.oneLine), `synth keys keep one line: ${JSON.stringify(keysLine)}`);
    assert.deepEqual(keysLine.map((key) => key.text), ["自動填入低階晶片", "開始熔煉合成"]);
    await page.locator(".cm-gacha__pane--synth .cm-gacha__action").first().click();
    // Not enough spare R chips for the one-tap fill: put five in by hand.
    for (let i = 0; i < 12 && await page.locator(".cm-gacha__slot[data-rarity]").count() < 5; i += 1) {
      await page.locator(".cm-gacha__pane--synth .cm-gacha__tile:not([disabled]):not([data-locked])").first().click();
    }
    assert.equal(await page.locator(".cm-gacha__slot[data-rarity]").count(), 5, "five chips in the furnace");
    await page.evaluate(() => { document.querySelector(".cm-gacha__pane--synth").scrollTop = 0; });
    await page.waitForTimeout(400);
    await shot("04-synth.png");
    // Smelt: the furnace roars, one capsule cracks, one metal card lands.
    await page.locator(".cm-gacha__pane--synth .cm-gacha__action--primary").click();
    await page.waitForFunction(() => document.querySelector(".cm-gacha__reveal")?.dataset.phase === "done");
    const smelted = await page.evaluate(() => [...document.querySelectorAll(".cm-gacha__reveal .cm-gacha__cards > .cm-gacha__card")].map((c) => c.dataset.kind));
    assert.deepEqual(smelted, ["METAL"], "five chips smelt into one evolution metal");
    assert.equal(await page.locator(".cm-gacha__reveal .cm-gacha__action--again").isHidden(), true, "a smelt offers no re-pull");
    await page.waitForTimeout(400);
    await shot("04c-smelt.png");
    await page.locator(".cm-gacha__reveal .cm-gacha__action--primary").click();
    const clearOfFooter = (pane) => page.evaluate((selector) => {
      const el = document.querySelector(selector);
      el.scrollTop = el.scrollHeight;
      const tiles = el.querySelectorAll(".cm-gacha__tile"), last = tiles[tiles.length - 1];
      return el.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom;
    }, pane);
    const synthClear = await clearOfFooter(".cm-gacha__pane--synth");
    assert.ok(synthClear >= 40, `the last synth row scrolls clear of the edge (${synthClear}px)`);
    await page.waitForTimeout(200);
    await shot("04b-synth-bottom.png");

    await page.locator('.cm-gacha__mode[data-mode="BAG"]').click();
    await page.locator(".cm-gacha__pane--bag .cm-gacha__tile").first().waitFor();
    await page.locator(".cm-gacha__pane--bag .cm-gacha__tile").first().click();
    await page.waitForTimeout(300);
    await shot("05-bag.png");
    const bagClear = await clearOfFooter(".cm-gacha__pane--bag");
    assert.ok(bagClear >= 40, `the last bag row scrolls clear of the edge (${bagClear}px)`);
    await page.waitForTimeout(200);
    await shot("05b-bag-bottom.png");
    assert.deepEqual(await page.evaluate(emojiHits, [".cm-vs2-shop__tabs, .cm-gacha", EMOJI]), [], "synth and bag show no system emoji");

    const keysAfter = await keys();
    assert.deepEqual(keysAfter.filter((key) => !GAME_KEYS.has(key)), [], "the gacha adds no storage key: it lives in the one save");
    report.storageKeys = keysAfter;
    assert.deepEqual(errors, [], "no page error");
    report.ok = true;
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.error = String(error?.stack ?? error);
    report.pageErrors = errors;
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    await shot("failure.png").catch(() => {});
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
