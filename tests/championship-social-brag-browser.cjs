// Social batch browser gate (Owner 2026-10-29): the ranch System menu's passport
// strip and community dock, the Google bind rehearsal and first-bind gift preview,
// Tamer Info's passport in a Home Screen app (6-character transfer code), the brag
// card's real canvas PNG in both layouts, the local-vs-cloud chooser, and the
// 通訊對戰 / 密碼對戰 lobbies (room code, Presence, countdown into the battle).
//
// It replaces the page's save with the repository QA save, so it refuses the
// Owner's 8732 origin; run it against an isolated server:
//   CHAMPIONSHIP_QA_URL=http://127.0.0.1:<port>/championship.html node tests/championship-social-brag-browser.cjs
// Screenshots and qa-results.json go to CHAMPIONSHIP_QA_OUTPUT_ROOT (default .tmp/browser-qa/social-brag).
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium, devices } = require("playwright");
const opening = require("./championship-browser-opening.cjs");
const WT = path.resolve(__dirname, "..");
const URL = process.env.CHAMPIONSHIP_QA_URL;
if (!URL) throw new Error("Set CHAMPIONSHIP_QA_URL to an isolated QA server");
if (new globalThis.URL(URL).port === "8732") throw new Error("Refusing the Owner save origin 8732");
const OUT = process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT ?? path.join(WT, ".tmp/browser-qa/social-brag");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const note = (step, ok, detail = "") => { results.push({ step, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`); };
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, name) }); console.log(`  shot ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function closeMenus(page) { await page.evaluate(() => document.querySelector(".cm-toolbar__menu:not([hidden])") && document.body.click()); }
async function openMenu(page, id) {
  await page.locator(`.cm-toolbar__cell[data-menu-id="${id}"]`).click();
  await page.waitForSelector(`.cm-toolbar__menu[data-menu-id="${id}"]:not([hidden])`, { timeout: 10000 });
}
async function dialogAction(page, action, timeout = 10000) {
  const button = page.locator(`dialog.cm-dialog[open] [data-action="${action}"]`).last();
  await button.waitFor({ state: "visible", timeout });
  await button.click();
}
async function toRanch(page) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator("[data-screen='RAISING_HOME']").count()) return;
    const back = page.locator(".cm-screen-back:visible").first();
    if (await back.count()) await back.click(); else break;
    await sleep(600);
  }
  await page.waitForSelector("[data-screen='RAISING_HOME']", { timeout: 20000 });
}

/** The repository QA save with a tamer name, re-validated by the game's own serializer. */
async function namedQaSave() {
  const save = await import(pathToFileURL(path.join(WT, "src/championship/app/championshipStandaloneSave.js")).href);
  const parsed = JSON.parse(fs.readFileSync(path.join(WT, "qa/championship-full-qa-save.json"), "utf8").trim());
  parsed.progression.nativeOpening = { version: 1, trainerName: "阿光", tutorialStep: null };
  return save.serializeChampionshipModernSave(save.deserializeChampionshipModernSave(JSON.stringify(parsed)));
}

(async () => {
  const SAVE = await namedQaSave();
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  // A Home Screen web app (iOS standalone): the passport puts the 6-character code and email routes first.
  await context.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true }); } catch {} });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(text => { localStorage.clear(); localStorage.setItem("championshipModernSave:v1", text); }, SAVE);
  await page.reload({ waitUntil: "networkidle" });
  await opening.startGame(page, { continueGame: true });
  await page.waitForSelector("[data-screen='RAISING_HOME']", { timeout: 60000 });
  await sleep(1500);
  note("continue QA save to ranch", true);

  // ---------------------------------------------------------------- 1. System menu: passport strip + community dock
  try {
    await openMenu(page, "SYSTEM");
    await page.waitForSelector(".cm-toolbar__community .cm-passport-strip .cm-online__code", { timeout: 10000 });
    await page.waitForFunction(() => /^TM-/.test(document.querySelector(".cm-passport-strip .cm-online__code")?.textContent ?? ""), null, { timeout: 10000 });
    await page.locator(".cm-toolbar__community").scrollIntoViewIfNeeded();
    await sleep(500);
    const info = await page.evaluate(() => ({
      providers: [...document.querySelectorAll(".cm-passport-strip .cm-passport__provider")].map(b => b.dataset.provider),
      dock: [...document.querySelectorAll(".cm-toolbar__community .cm-social-key")].map(k => `${k.dataset.socialId}:${k.dataset.state}:${k.tagName}`),
      overflow: document.documentElement.scrollWidth > innerWidth
    }));
    note("menu passport strip + dock", info.providers.join() === "google,facebook,discord" && info.dock.length === 4 && !info.overflow, JSON.stringify(info));
    await shot(page, "01a-menu-passport-dock.png");
    // Bind Google in the local simulation: consent rehearsal, then the gift preview.
    await page.locator('.cm-passport-strip .cm-passport__provider[data-provider="google"]').click();
    await page.waitForSelector('dialog.cm-dialog[open][data-variant="provider-sim"]', { timeout: 10000 });
    await sleep(400); await shot(page, "01b-provider-sim-consent.png");
    await dialogAction(page, "allow");
    await page.waitForSelector('dialog.cm-dialog[open][data-variant="reward"] .cm-bind-reward[data-simulated="true"]', { timeout: 10000 });
    await sleep(700); await shot(page, "01c-bind-reward-preview.png");
    note("google bind rehearsal + reward preview", true);
    await dialogAction(page, "claim");
  } catch (error) { note("menu passport strip + dock", false, error.message); await shot(page, "fail-01-menu.png"); }

  // ---------------------------------------------------------------- Tamer Info: passport panel, 6-character code, cloud backup
  try {
    await closeMenus(page);
    await openMenu(page, "MANAGEMENT");
    await page.locator('.cm-toolbar__entry[data-entry-id="tamer"]').click();
    await page.waitForSelector(".cm-tamer-shell .cm-passport", { timeout: 15000 });
    await sleep(800);
    await page.locator(".cm-tamer-shell .cm-brag-cta").scrollIntoViewIfNeeded();
    await shot(page, "01d-tamer-info-top.png");
    // Cloud backup first (the conflict chooser below compares against it).
    await page.locator('.cm-tamer-shell .cm-passport [data-online-action="backupNow"]').click();
    await page.waitForFunction(() => document.querySelector(".cm-tamer-shell .cm-passport .cm-online__sync")?.dataset.state === "SYNCED", null, { timeout: 10000 });
    await page.locator('.cm-tamer-shell .cm-passport [data-online-action="transferCode"]').click();
    await page.waitForSelector(".cm-tamer-shell .cm-passport__codebox:not([hidden])", { timeout: 10000 });
    const code = await page.locator(".cm-tamer-shell .cm-passport__codebox").getAttribute("data-transfer-code");
    await page.locator(".cm-tamer-shell .cm-passport").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector(".cm-tamer-shell .cm-passport").scrollIntoView({ block: "start" }));
    await sleep(500);
    const passport = await page.evaluate(() => ({ passport: document.querySelector(".cm-tamer-shell .cm-passport")?.dataset.passport, standalone: document.querySelector(".cm-tamer-shell .cm-passport")?.dataset.standalone,
      first: document.querySelector(".cm-tamer-shell .cm-passport > .cm-passport__standalone")?.hidden === false, guestBadge: Boolean(document.querySelector(".cm-tamer-code__guest")),
      overflow: document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll(".cm-tamer-shell .cm-passport, .cm-tamer-shell .cm-social-dock")].some(n => n.getBoundingClientRect().right > innerWidth + 1) }));
    note("passport standalone + 6-char transfer code", /^[0-9A-Z]{3}-[0-9A-Z]{3}$/.test(code ?? "") && passport.standalone === "true" && passport.passport === "linked" && !passport.guestBadge && !passport.overflow, `${code} ${JSON.stringify(passport)}`);
    await shot(page, "01e-tamer-passport-standalone.png");
    await page.evaluate(() => document.querySelector(".cm-tamer-shell .cm-social-dock").scrollIntoView({ block: "end" }));
    await sleep(500);
    await shot(page, "01f-tamer-passport-dock.png");
  } catch (error) { note("tamer info passport", false, error.message); await shot(page, "fail-01-tamer.png"); }

  // ---------------------------------------------------------------- 3. Brag card from Tamer Info
  try {
    await page.locator(".cm-tamer-shell .cm-brag-cta").scrollIntoViewIfNeeded();
    await page.locator(".cm-tamer-shell .cm-brag-cta").click();
    const flashSeen = await page.waitForSelector(".cm-brag-flash", { timeout: 2000 }).then(() => true).catch(() => false);
    await page.waitForSelector('dialog.cm-dialog[open][data-variant="brag"] .cm-brag-preview__image', { timeout: 20000 });
    const card = await page.evaluate(async () => {
      const img = document.querySelector('dialog[data-variant="brag"] .cm-brag-preview__image');
      await img.decode?.().catch(() => {});
      const src = img.src, base64 = src.slice(src.indexOf(",") + 1), bytes = atob(base64);
      return { prefix: src.slice(0, 22), bytes: bytes.length, signature: [...bytes.slice(0, 8)].map(c => c.charCodeAt(0)).join(","), width: img.naturalWidth, height: img.naturalHeight, selectable: img.dataset.selectable,
        share: document.querySelector('[data-brag-action="share"]')?.dataset.supported };
    });
    note("brag card PNG (landscape)", card.prefix === "data:image/png;base64," && card.bytes > 20000 && card.signature === "137,80,78,71,13,10,26,10" && card.width === 2400 && card.height === 1350,
      `${JSON.stringify(card)} flash=${flashSeen}`);
    await sleep(900); await shot(page, "03a-brag-preview-landscape.png");
    const landscapeData = await page.locator('dialog[data-variant="brag"] .cm-brag-preview__image').getAttribute("src");
    fs.writeFileSync(path.join(OUT, "03-card-landscape.png"), Buffer.from(landscapeData.split(",")[1], "base64"));
    await page.locator('[data-brag-action="orientation-portrait"]').click();
    await page.waitForFunction(() => document.querySelector('dialog[data-variant="brag"] .cm-brag-preview')?.dataset.orientation === "portrait", null, { timeout: 20000 });
    const portrait = await page.evaluate(async () => { const img = document.querySelector('dialog[data-variant="brag"] .cm-brag-preview__image'); await img.decode?.().catch(() => {}); return { width: img.naturalWidth, height: img.naturalHeight }; });
    note("brag card PNG (portrait)", portrait.width === 1440 && portrait.height === 2560, JSON.stringify(portrait));
    await sleep(900); await shot(page, "03b-brag-preview-portrait.png");
    const portraitData = await page.locator('dialog[data-variant="brag"] .cm-brag-preview__image').getAttribute("src");
    fs.writeFileSync(path.join(OUT, "03-card-portrait.png"), Buffer.from(portraitData.split(",")[1], "base64"));
    // Copy invite text (Playwright grants no clipboard here, so the manual box must appear instead of an error).
    await page.locator('[data-brag-action="copy"]').click();
    await sleep(300);
    const copyState = await page.evaluate(() => ({ status: document.querySelector('dialog[data-variant="brag"] .cm-brag-preview__status')?.textContent, manual: !document.querySelector(".cm-brag-preview__invite")?.hidden,
      invite: document.querySelector(".cm-brag-preview__invite")?.value }));
    note("copy invite text", /TM-/.test(copyState.invite ?? "") && /orochi771127\.github\.io\/championship-2026/.test(copyState.invite ?? ""), JSON.stringify(copyState));
    await dialogAction(page, "done");
  } catch (error) { note("brag card", false, error.message); await shot(page, "fail-03-brag.png"); }

  // ---------------------------------------------------------------- 2. Save chooser: local day moves on after the backup
  try {
    await toRanch(page);
    await openMenu(page, "MANAGEMENT");
    await page.locator('.cm-toolbar__entry[data-entry-id="endDay"]').click();
    // 「要結束今天嗎？」 → 是, then the new day's calendar card returns to the ranch.
    await page.locator(".int-rh2-day-confirm:not([hidden]) .int-rh2-system-button").first().click({ timeout: 10000 });
    await page.locator(".int-rh2-calendar:not([hidden])").click({ timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector(".int-rh2-calendar")?.hidden !== false, null, { timeout: 15000 }).catch(() => {});
    await sleep(2500);
    await openMenu(page, "SYSTEM");
    await page.locator(".cm-passport-strip__more").click();
    await page.waitForSelector(".cm-settings .cm-passport", { timeout: 15000 });
    await page.locator('.cm-settings .cm-passport [data-online-action="restoreCloud"]').click();
    const outcome = await Promise.race([
      page.waitForSelector('dialog.cm-dialog[open][data-variant="arbiter"]', { timeout: 15000 }).then(() => "arbiter"),
      page.waitForFunction(() => document.querySelector(".cm-settings .cm-passport .cm-online__status")?.dataset.tone === "ok", null, { timeout: 15000 }).then(() => "same")
    ]);
    if (outcome === "arbiter") {
      await sleep(600);
      const rows = await page.evaluate(() => [...document.querySelectorAll(".cm-arbiter__row")].map(r => [...r.children].map(c => c.textContent.trim()).join(" | ")));
      note("local vs cloud chooser", rows.length >= 6, rows.join(" // "));
      await shot(page, "02-save-arbiter.png");
      await dialogAction(page, "later");
      const kept = await page.locator(".cm-settings .cm-passport .cm-online__status").textContent();
      note("decide later leaves both copies", /沒有變更/.test(kept ?? ""), kept);
    } else note("local vs cloud chooser", false, "local equalled cloud; no chooser");
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(500);
    const closeSettings = page.locator(".cm-settings__close:visible").first();
    if (await closeSettings.count()) await closeSettings.click();
  } catch (error) { note("save chooser", false, error.message); await shot(page, "fail-02-arbiter.png"); }

  // ---------------------------------------------------------------- 4. Battle select: 密碼對戰 room lobby and 通訊對戰 quick lobby
  try {
    await toRanch(page);
    await page.locator('[data-quick-id="battle"]').click();
    await page.waitForSelector('.cm-vs5-cube__face[data-face-id="PASSWORD_BATTLE"]', { timeout: 30000 });
    await sleep(1500);
    // 通訊對戰: quick match / ladder mirror on the same passport identity.
    await page.evaluate(() => document.querySelector('.cm-vs5-cube__face[data-face-id="LINK_BATTLE"]').click());
    await page.waitForSelector('[data-online-panel="quick"] .cm-online__identity[data-tamer-code^="TM-"]', { timeout: 20000 });
    await page.waitForSelector('[data-online-panel="quick"] .cm-online__member', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-online-panel="quick"]').scrollIntoView({ block: "start" }));
    await sleep(600);
    const quick = await page.evaluate(() => ({ identity: document.querySelector('[data-online-panel="quick"] .cm-online__identity')?.textContent, keys: [...document.querySelectorAll('[data-online-panel="quick"] [data-online-action]')].map(b => b.dataset.onlineAction) }));
    note("link battle quick lobby shares the passport identity", /TM-/.test(quick.identity ?? "") && quick.keys.includes("quickMatch") && quick.keys.includes("ladder"), JSON.stringify(quick));
    await shot(page, "04d-link-quick-lobby.png");
    await page.evaluate(() => document.querySelector('.cm-vs5-cube__face[data-face-id="PASSWORD_BATTLE"]').click());
    await page.waitForSelector('[data-online-panel="room"] .cm-online__identity[data-tamer-code^="TM-"]', { timeout: 20000 });
    await page.waitForSelector('[data-online-panel="room"] .cm-online__member', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-online-panel="room"]').scrollIntoView({ block: "start" }));
    await sleep(600);
    await shot(page, "04a-password-room-lobby.png");
    await page.locator('[data-online-panel="room"] [data-online-action="createRoom"]').click();
    await page.waitForSelector('[data-online-panel="room"] .cm-online__roomcode:not([hidden])', { timeout: 10000 });
    const room = await page.locator('[data-online-panel="room"] .cm-online__roomcode').getAttribute("data-room-code");
    await sleep(150);
    await shot(page, "04b-room-waiting.png");
    note("room created with 4-digit code", /^[0-9]{4}$/.test(room ?? ""), room);
    await page.waitForFunction(() => document.querySelector('[data-online-panel="room"] .cm-online__presence')?.dataset.online === "true", null, { timeout: 8000 });
    await shot(page, "04c-room-opponent-online.png");
    note("opponent presence online", true);
    await page.waitForFunction(() => document.querySelector("[data-screen='BATTLE_FIELD']"), null, { timeout: 30000 });
    note("room countdown starts the link battle", true);
  } catch (error) { note("room lobby", false, error.message); await shot(page, "fail-04-room.png"); }

  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  note("storage keys stay the product's", keys.every(k => /^championship(ModernSave|SessionCheckpoint|ModernSettings|Preferences)/.test(k) || k.startsWith("championshipModernSave")), keys.join(","));
  note("no page errors", errors.length === 0, errors.slice(0, 8).join(" || "));
  fs.writeFileSync(path.join(OUT, "qa-results.json"), JSON.stringify({ url: URL, results, errors, keys }, null, 2));
  await browser.close();
  process.exitCode = results.every(r => r.ok) ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
