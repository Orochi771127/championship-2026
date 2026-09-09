// VS2-P browser gate.
//
// Walks the complete authorized presentation flow in real Chromium at every
// contract viewport. The default path is PLAYER_MODE; a second bounded pass
// proves DEVELOPER_EVIDENCE_MODE without introducing player-facing semantics.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { openFreshGame, openHunt, selectEnterableGate, RAISING_HOME, GATE_CONFIRM } = require("./championship-browser-opening.cjs");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs2");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const CONTRACT_PATH = path.resolve("docs/contracts/championship/VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.json");
const CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));
const UI_AUTHORITY = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
const PLAYER_MODE = "PLAYER_MODE";
const DEVELOPER_MODE = "DEVELOPER_EVIDENCE_MODE";
const PLAYER_FORBIDDEN = /ROM VERIFIED|RAW_SLOT|UNKNOWN_REQUIRES_TRACE|CLAUDE_NEUTRAL|implementation diagnostic/i;

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  assert.ok(match, `invalid contract viewport: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const VIEWPORTS = CONTRACT.responsiveTargets.mustPass.map(parseViewport);
const CAPTURE_VIEWPORTS = new Set([CONTRACT.responsiveTargets.reference, "393x852"]);

fs.mkdirSync(SCREENSHOTS, { recursive: true });

function name({ width, height }) {
  return `${width}x${height}`;
}

async function auditPresentationLayout(page, viewport, screen) {
  const result = await page.evaluate(() => {
    const root = document.getElementById("cm-root");
    const controls = [...root.querySelectorAll("button:not([disabled]), a[href], [role='button']")]
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          label: node.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      });
    return {
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      rootOverflowX: root.scrollWidth > root.clientWidth + 1,
      rootWidth: root.getBoundingClientRect().width,
      rootHeight: root.getBoundingClientRect().height,
      uiAuthority: root.dataset.uiAuthority,
      presentationMode: root.dataset.presentationMode,
      text: root.innerText,
      clippedControls: controls.filter((control) =>
        control.left < -1 || control.right > innerWidth + 1 || control.top < -1 || control.bottom > innerHeight + 1),
      undersizedControls: controls.filter((control) => control.width < 44 || control.height < 44)
    };
  });

  assert.equal(result.documentOverflowX, false, `${name(viewport)} ${screen}: document horizontal overflow`);
  assert.equal(result.rootOverflowX, false, `${name(viewport)} ${screen}: root horizontal overflow`);
  assert.equal(result.uiAuthority, UI_AUTHORITY, `${name(viewport)} ${screen}: wrong UI authority`);
  assert.equal(result.presentationMode, PLAYER_MODE, `${name(viewport)} ${screen}: wrong default mode`);
  assert.doesNotMatch(result.text, PLAYER_FORBIDDEN, `${name(viewport)} ${screen}: developer evidence leaked into Player Mode`);
  assert.deepEqual(result.clippedControls, [], `${name(viewport)} ${screen}: clipped controls`);
  assert.deepEqual(result.undersizedControls, [], `${name(viewport)} ${screen}: enabled controls below 44px`);
  return {
    screen,
    root: `${Math.round(result.rootWidth)}x${Math.round(result.rootHeight)}`,
    uiAuthority: result.uiAuthority,
    presentationMode: result.presentationMode,
    horizontalOverflow: false,
    clippedControls: 0,
    undersizedEnabledControls: 0
  };
}

async function walk(browser, viewport, { capture }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const problems = [];
  const screens = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });

  const shot = async (step) => {
    if (capture) await page.screenshot({ path: path.join(SCREENSHOTS, `vs2-${step}-${name(viewport)}.png`) });
  };

  // Title LOGIN plus the full New Game opening; see championship-browser-opening.
  await openFreshGame(page, BASE_URL);
  await page.waitForSelector("#cm-root.int-rh2-root", { timeout: 20000 });
  await page.waitForSelector(RAISING_HOME, { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot("1-raising");

  await openHunt(page);
  await page.waitForFunction(() => document.getElementById("cm-root")?.dataset.gatePresentation === "THREE_BOUNDED_WORLD_MODE");
  const gates = await page.locator(".cm-vs2-gate").count();
  assert.equal(gates, 16, `${name(viewport)}: gate count`);
  assert.equal(await page.locator("canvas[data-renderer='THREE_BOUNDED_GATE_SELECT']").count(), 1,
    `${name(viewport)}: bounded Three Gate renderer count`);
  assert.equal(await page.locator("#cm-root").getAttribute("data-gate-presentation"), "THREE_BOUNDED_WORLD_MODE",
    `${name(viewport)}: Player Mode did not default to the 3D world`);
  const confirm = page.locator(".cm-vs2-footer .cm-vs2-action--primary");
  assert.equal(await confirm.isDisabled(), true, `${name(viewport)}: confirm must start gated`);
  const visibleWorldNodes = page.locator(".cm-vs2-gate3d__node-hit:not([hidden])");
  assert.ok(await visibleWorldNodes.count() >= 1, `${name(viewport)}: no selectable 3D nodes are visible`);
  // A new tamer holds 0 Bits at rank 0, so most destinations are correctly
  // refused; the confirm enables on one this player may actually enter.
  await selectEnterableGate(page);
  assert.equal(await confirm.isDisabled(), false, `${name(viewport)}: confirm must enable on selection`);
  screens.push(await auditPresentationLayout(page, viewport, "GATE_SELECT"));
  await shot("2-gates");

  await confirm.click();
  await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
  const begin = page.locator(".cm-vs2-footer .cm-vs2-action--primary");
  // VS2-R2 replaced the companion picker with the recovered structure. An empty
  // loadout is permitted - no original rule requires anything equipped - so BEGIN
  // is no longer gated on a selection.
  assert.equal(await begin.isDisabled(), false, `${name(viewport)}: an empty loadout must be permitted`);

  const classRows = page.locator("[data-equipment-class]");
  const pluginRows = page.locator("[data-plugin-position]");
  assert.equal(await classRows.count(), 5, `${name(viewport)}: five recovered equipment classes`);
  assert.equal(await pluginRows.count(), 4, `${name(viewport)}: four recovered plugin positions`);
  assert.equal(await page.locator(".cm-vs2-member").count(), 0, `${name(viewport)}: the companion picker survived`);

  // Equipping and clearing both work, and neither gates entry.
  const ropeOption = page.locator("[data-equipment-class='ROPE'] .cm-vs2-loadout__option").first();
  await ropeOption.click();
  assert.equal(await ropeOption.getAttribute("data-selected"), "true", `${name(viewport)}: rope did not equip`);
  assert.equal(await begin.isDisabled(), false, `${name(viewport)}: equipping must not gate entry`);
  screens.push(await auditPresentationLayout(page, viewport, "HUNT_LOADOUT"));
  await shot("3-loadout");

  await begin.click();
  await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
  await page.waitForTimeout(900);

  const canvases = await page.locator("canvas").count();
  assert.equal(canvases, 1, `${name(viewport)}: exactly one Pixi canvas must exist`);
  const fallback = await page.evaluate(() => document.getElementById("cm-root").dataset.fieldFallback ?? "none");
  assert.equal(fallback, "none", `${name(viewport)}: the field fell back instead of rendering`);

  // The eight-position placeholder rail is Developer Mode evidence now: Player
  // Mode shows the recovered Hunt tools instead, so a player never meets eight
  // disabled shells. The developer walk below still asserts the RAW_SLOT rail.
  const slots = await page.locator(".cm-vs2-slot").count();
  const rawLabels = await page.locator(".cm-vs2-slot__raw").count();
  const huntTools = await page.locator(".cm-hunt-tools .cm-vs2-action").count();
  assert.equal(slots, 0, `${name(viewport)}: placeholder slots leaked into Player Mode`);
  assert.equal(rawLabels, 0, `${name(viewport)}: RAW_SLOT labels leaked into Player Mode`);
  assert.ok(huntTools >= 1, `${name(viewport)}: Player Mode has no Hunt tools`);
  screens.push(await auditPresentationLayout(page, viewport, "HUNT_FIELD"));
  await shot("4-field");

  const canvasBox = await page.locator(".cm-vs2-field__canvas").boundingBox();
  assert.ok(canvasBox.height > 200, `${name(viewport)}: the field has no room to render`);
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.75, canvasBox.y + canvasBox.height * 0.7);
  await page.waitForTimeout(1600);
  screens.push(await auditPresentationLayout(page, viewport, "EXPLORE"));
  await shot("5-explored");

  await page.locator(".cm-vs2-hud__exit").click();
  await page.waitForSelector(RAISING_HOME, { timeout: 15000 });
  await page.waitForTimeout(600);
  const canvasesAfter = await page.locator("canvas").count();
  assert.equal(canvasesAfter, 1, `${name(viewport)}: the stage was rebuilt instead of re-attached`);
  await shot("6-returned");

  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  assert.deepEqual(keys.filter((key) => key !== "championshipModernSave:v1"), [],
    `${name(viewport)}: a second storage key appeared`);
  assert.deepEqual(problems, [], `${name(viewport)}: console or page errors`);
  await context.close();
  return {
    viewport: name(viewport), captured: capture, gates,
    placeholderSlots: slots, huntTools,
    canvasesDuringHunt: canvases, canvasesAfterReturn: canvasesAfter, screens
  };
}

async function verifyDeveloperMode(browser) {
  const viewport = parseViewport(CONTRACT.responsiveTargets.reference);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const join = BASE_URL.includes("?") ? "&" : "?";
  await openFreshGame(page, `${BASE_URL}${join}presentation=developer`);
  await page.waitForSelector(RAISING_HOME, { timeout: 20000 });
  await openHunt(page);
  assert.equal(await page.locator("#cm-root").getAttribute("data-presentation-mode"), DEVELOPER_MODE);
  assert.ok(await page.locator(".cm-vs2-evidence").count() >= 1, "developer Gate evidence missing");
  await selectEnterableGate(page, { selector: ".cm-vs2-gate" });
  await page.locator(GATE_CONFIRM).click();
  // No companion step: an empty loadout is permitted, so BEGIN follows directly.
  await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
  await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
  await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
  assert.equal(await page.locator(".cm-vs2-slot__raw").count(), 8, "developer RAW_SLOT evidence count");
  assert.equal(await page.locator(".cm-vs2-slot:not([disabled])").count(), 0, "developer mode bound an unknown slot");
  assert.match(await page.locator(".cm-vs2-toolbar").innerText(), /MODE 2.*ROM VERIFIED/s);
  await context.close();
  return { viewport: name(viewport), presentationMode: DEVELOPER_MODE, rawSlotLabels: 8, toolbarSlotsBound: 0, verdict: "PASS" };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const results = [];
  let developerMode;
  try {
    for (const viewport of VIEWPORTS) {
      results.push(await walk(browser, viewport, { capture: CAPTURE_VIEWPORTS.has(name(viewport)) }));
    }
    developerMode = await verifyDeveloperMode(browser);
  } finally {
    await browser.close();
  }

  const report = {
    gate: "CHAMPIONSHIP_VS2_P_BROWSER_QA",
    date: new Date().toISOString(),
    baseUrl: BASE_URL,
    contract: `${CONTRACT.contractId}/${CONTRACT.version}`,
    uiAuthority: UI_AUTHORITY,
    requiredViewports: CONTRACT.responsiveTargets.mustPass,
    evidenceViewports: [...CAPTURE_VIEWPORTS],
    results,
    developerMode,
    invariants: {
      pixiApplicationsPerScreen: 1,
      stageRebuiltOnScreenChange: false,
      toolbarSlots: 8,
      toolbarSlotsBound: 0,
      playerModeRawLabels: 0,
      storageKeys: ["championshipModernSave:v1"],
      captureSurfacePresent: false
    },
    verdict: "PASS"
  };
  fs.writeFileSync(path.join(OUTPUT, "VS2_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`CHAMPIONSHIP_VS2_P_BROWSER_QA_PASS viewports=${results.length} evidence=${CAPTURE_VIEWPORTS.size}`);
})().catch((error) => {
  console.error(`CHAMPIONSHIP_VS2_P_BROWSER_QA_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});
