// Deterministic 375x812 portrait PB-Rank Data Arena duel & staged-move QA runner.
// Runs live 1v1 AI-vs-AI duel FIRST (real spacing, dodges, guards, frame timing),
// then measures staged showcase moves centered in open arena space (knockback, separation,
// impact-frame cleanliness, guard-block honeycomb shield).
// Usage: node scripts/qa/film-duel-375.cjs <origin> <outDir>
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const [origin, outDir] = process.argv.slice(2);
if (!origin || !outDir) {
  console.error("Usage: node scripts/qa/film-duel-375.cjs <origin> <outDir>");
  process.exit(1);
}

const repo = process.cwd();
const W = +(process.env.W || 375);
const H = +(process.env.H || 812);
const SEED = +(process.env.SEED || 19);
const DUEL_SEC = +(process.env.DUEL_SEC || 8);
const MOVES = (process.env.MOVES || "pb-127,pb-256").split(",").filter(Boolean);
const TEAM = (process.env.TEAM || "relay-species-121").split(",");

fs.mkdirSync(outDir, { recursive: true });
const save = fs.readFileSync(path.join(repo, "qa/championship-full-qa-save.json"), "utf8");
const arenaRecords = JSON.stringify({
  schemaVersion: 1,
  kind: "DATA_ARENA_RECORDS",
  schema: "dataArena.v1",
  lastPartnerId: TEAM[0],
  lastMode: "RELAY",
  relayLoadouts: {},
  relayLoadoutsRev: 2,
  relayReserveId: TEAM[1] ?? null,
  relayThirdId: TEAM[2] ?? null,
  partners: {},
  modes: {},
  briefingSeen: true
});

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  await context.addInitScript(({ origin: orig, save: s, arenaRecords: ar }) => {
    if (location.origin === orig && !localStorage.getItem("relayQaSeeded")) {
      localStorage.setItem("championshipModernSave:v1", s);
      localStorage.setItem("championshipModernSave:dataArena:v1", ar);
      localStorage.setItem("relayQaSeeded", "1");
    }
  }, { origin, save, arenaRecords });

  await page.goto(`${origin}/championship.html?arenaQa=1&arenaSeed=${SEED}`);
  await page.waitForFunction(() => document.querySelector("#cm-login")?.disabled === false, null, { timeout: 90000 });
  await page.locator("#cm-opening-film video").evaluateAll((vs) => vs.forEach((v) => { v.playbackRate = 8; }));
  await page.click("#cm-login");
  await page.click("#cm-continue");
  await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 90000 });
  await page.click('button[data-menu-id="SYSTEM"]');
  await page.click('[data-entry-id="battle"]');
  await page.click("#cm-data-arena");
  await page.waitForSelector(".da-panel--select");
  await page.getByRole("button", { name: /立即出戰/ }).click();
  await page.waitForFunction(
    () => window.__dataArenaQA?.state() === "PLAY" && window.__dataArenaQA.snapshot()?.tournament?.status === "FIGHT",
    null,
    { timeout: 90000 }
  );
  await page.waitForTimeout(400);

  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  }));

  // 1) Live 1v1 AI-vs-AI duel sample FIRST (real combat, not training dummy!)
  await page.evaluate(() => {
    const q = window.__dataArenaQA;
    q.setControlMode?.("AUTO");
  });
  const duelDir = path.join(outDir, "duel-375");
  fs.mkdirSync(duelDir, { recursive: true });
  const duelSamples = [];
  const stepCount = Math.max(6, Math.round(DUEL_SEC / 0.5));
  for (let s = 0; s < stepCount; s++) {
    await page.waitForTimeout(500);
    const snap = await page.evaluate(() => {
      const q = window.__dataArenaQA;
      const st = q.snapshot();
      const rival = (st.rivals || []).find((x) => x.active) || st.rivals?.[0];
      return {
        t: +(st.time ?? 0).toFixed(2),
        sep: rival ? +Math.hypot(rival.x - st.player.x, rival.y - st.player.y).toFixed(1) : null,
        pHp: Math.round(st.player.hp ?? 0),
        rHp: rival ? Math.round(rival.hp ?? 0) : null,
        pGuard: (st.player.guardTimer ?? 0) > 0,
        rGuard: (rival?.guardTimer ?? 0) > 0
      };
    });
    duelSamples.push(snap);
    if (s === 2 || s === 6 || s === 10 || s === 14) {
      await page.screenshot({ path: path.join(duelDir, `duel-s${String(s).padStart(2, "0")}.png`) });
    }
  }
  const seps = duelSamples.map((d) => d.sep).filter((v) => Number.isFinite(v));
  const duelSummary = {
    samples: duelSamples.length,
    minSepPx: seps.length ? Math.min(...seps) : null,
    avgSepPx: seps.length ? +(seps.reduce((a, b) => a + b, 0) / seps.length).toFixed(1) : null,
    maxSepPx: seps.length ? Math.max(...seps) : null,
    guardSeen: duelSamples.some((d) => d.pGuard || d.rGuard)
  };

  // 2) Staged showcase moves centered in open arena space (away from right wall)
  const moveMetrics = [];
  for (const moveId of MOVES) {
    const dir = path.join(outDir, moveId);
    fs.mkdirSync(dir, { recursive: true });
    const staged = await page.evaluate(({ id }) => {
      const q = window.__dataArenaQA;
      q.review.freeze(true);
      return q.review.stage({ moveId: id, ultimate: false, px: 420, py: 480, rx: 660, ry: 480 });
    }, { id: moveId });
    await page.evaluate(() => window.__dataArenaQA.review.step(1.0));
    await page.waitForTimeout(80);
    const startRival = { x: staged.rival.x, y: staged.rival.y };
    await page.evaluate(() => window.__dataArenaQA.review.cast(0));

    let hitStep = -1;
    let peakKnockDist = 0;
    let sepAtHit = null;
    let sepAfter200ms = null;
    let impactCaptured = false;
    let postHitCaptured = false;
    const DT = 0.05;

    for (let i = 1; i <= 50; i++) {
      const info = await page.evaluate((dt) => {
        const q = window.__dataArenaQA;
        const r = q.review.step(dt);
        const s = q.snapshot();
        const rival = (s.rivals || []).find((x) => x.active) || s.rivals?.[0];
        return {
          time: r?.time ?? s.time,
          hitStop: r?.hitStop ?? 0,
          cast: r?.cast ?? null,
          px: s.player.x,
          py: s.player.y,
          rx: rival?.x ?? 0,
          ry: rival?.y ?? 0,
          rhp: rival?.hp ?? 0,
          rmax: rival?.maxHp ?? 1
        };
      }, DT);
      const dist = Math.hypot(info.rx - startRival.x, info.ry - startRival.y);
      const sep = Math.hypot(info.rx - info.px, info.ry - info.py);
      if (dist > peakKnockDist) peakKnockDist = dist;
      if (hitStep < 0 && (info.rhp < info.rmax || info.hitStop > 0.02)) {
        hitStep = i;
        sepAtHit = sep;
      }
      if (!impactCaptured && info.hitStop > 0.02) {
        impactCaptured = true;
        await page.waitForTimeout(30);
        await page.screenshot({ path: path.join(dir, "01-impact-frame.png") });
      }
      if (hitStep > 0 && i === hitStep + 4) {
        sepAfter200ms = sep;
        if (!postHitCaptured) {
          postHitCaptured = true;
          await page.waitForTimeout(30);
          await page.screenshot({ path: path.join(dir, "02-post-hit-200ms.png") });
        }
      }
      if (hitStep > 0 && i === hitStep + 10) {
        await page.waitForTimeout(30);
        await page.screenshot({ path: path.join(dir, "03-aftermath-500ms.png") });
      }
    }
    moveMetrics.push({
      moveId,
      hitStep,
      peakKnockDistPx: +peakKnockDist.toFixed(1),
      sepAtHitPx: sepAtHit === null ? null : +sepAtHit.toFixed(1),
      sepAfter200msPx: sepAfter200ms === null ? null : +sepAfter200ms.toFixed(1),
      impactCaptured,
      postHitCaptured
    });
    await page.evaluate(() => window.__dataArenaQA.review.step(1.5));
  }

  const report = { viewport: `${W}x${H}`, seed: SEED, overflow, duelSummary, moveMetrics, errors };
  fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length > 0 || overflow.overflowPx > 0) process.exitCode = 1;
})();
