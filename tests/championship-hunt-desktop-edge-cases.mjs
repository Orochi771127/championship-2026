// Owner 2026-11-25: on desktop (wide hunt layout) dragging to a map edge showed
// blank page beside the map. The wide view must stay inside the map, fill the
// window even on 2048 maps, and pan back from an edge without a dead zone.
import assert from "node:assert/strict";
import test from "node:test";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { createHuntWorld } from "../src/championship/hunt/huntWorld.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { huntClampViewCenter, huntPresentationViewport } from "../src/championship/hunt/huntPresentationViewport.js";
import { createHuntViewportBinding, panHuntPresentationCamera } from "../src/championship/hunt/huntPresentationBinding.js";

const runtime = () => createHuntRuntime({ world: createHuntWorld(listChampionshipGates()[0]), fieldActor: { actorId: "test", displayName: "Test" } });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

function fillsWindow(view, worldWidth, worldHeight) {
  const r = view.viewRect, m = view.visibleMapRect;
  assert.ok(r.left >= -1e-9 && r.top >= -1e-9, `view starts inside the map ${JSON.stringify(r)}`);
  assert.ok(r.right <= worldWidth + 1e-6 && r.bottom <= worldHeight + 1e-6, `view ends inside the map ${JSON.stringify(r)}`);
  near(m.right - m.left, r.width, "map covers the whole window width");
  near(m.bottom - m.top, r.height, "map covers the whole window height");
}

test("huntClampViewCenter stops the view edge at the map edge", () => {
  assert.equal(huntClampViewCenter(-500, 1000, 2880), 500);
  assert.equal(huntClampViewCenter(5000, 1000, 2880), 2380);
  assert.equal(huntClampViewCenter(1200, 1000, 2880), 1200);
  assert.equal(huntClampViewCenter(10, 3000, 2048), 1024);
});

test("wide desktop view never shows a margin at any map corner", () => {
  for (const world of [2048, 2880]) for (const [vw, vh, rw] of [[1920, 1000, 470], [1440, 820, 390], [1280, 720, 350], [2560, 1340, 620], [844, 390, 180]]) {
    for (const [cx, cy] of [[256, 256], [world - 256, world - 256], [256, world - 256], [world / 2, world / 2]]) {
      const view = huntPresentationViewport({ viewportWidth: vw, viewportHeight: vh, referenceWidth: rw,
        worldWidthPx: world, worldHeightPx: world,
        canonicalCamera: { left: cx - 256, right: cx + 256, top: cy - 400, bottom: cy + 400 } });
      fillsWindow(view, world, world);
      const portraitScale = rw / 512;
      assert.ok(view.transform.scale >= portraitScale - 1e-12, "never zooms out past the portrait reference");
      if (vw / portraitScale <= world && vh / portraitScale <= world) near(view.transform.scale, portraitScale, "keeps reference scale when the map is big enough");
    }
  }
});

test("portrait layout is unchanged", () => {
  const camera = { left: 0, right: 512, top: 0, bottom: 1024 };
  const view = huntPresentationViewport({ viewportWidth: 390, viewportHeight: 780, worldWidthPx: 2048, worldHeightPx: 2048, canonicalCamera: camera });
  assert.equal(view.viewRect, camera);
  near(view.transform.scale, 390 / 512, "portrait scale");
});

test("1920 wide window shows the whole 2048 map width with no margin", () => {
  const rt = runtime();
  const binding = createHuntViewportBinding(() => ({ mode: "wide", referenceWidth: 470, referenceHeight: 900 }));
  const read = () => binding.read(rt, 1920, 1000);
  for (let i = 0; i < 40; i++) panHuntPresentationCamera(rt, -200, 0, read().panRequest);
  const view = read();
  near(view.viewRect.left, 0, "left edge pinned");
  near(view.viewRect.right, rt.world.worldWidthPx, "right edge pinned: zoomed to fit width");
  fillsWindow(view, rt.world.worldWidthPx, rt.world.worldHeightPx);
});

test("wide drag reaches the edge without blank and drags back at once", () => {
  const rt = runtime();
  const binding = createHuntViewportBinding(() => ({ mode: "wide", referenceWidth: 470, referenceHeight: 900 }));
  const read = () => binding.read(rt, 1440, 820);
  const { worldWidthPx: W, worldHeightPx: H } = rt.world;
  // Drag far into the top-left corner.
  for (let i = 0; i < 40; i++) panHuntPresentationCamera(rt, -200, -200, read().panRequest);
  let view = read();
  near(view.viewRect.left, 0, "left edge pinned to the map");
  near(view.viewRect.top, 0, "top edge pinned to the map");
  fillsWindow(view, W, H);
  // One small drag back moves the view by exactly that amount (no dead zone).
  panHuntPresentationCamera(rt, 40, 30, view.panRequest);
  const back = read();
  near(back.viewRect.left, 40, "drag back from the left edge moves immediately");
  near(back.viewRect.top, 30, "drag back from the top edge moves immediately");
  // Bottom-right corner as well.
  for (let i = 0; i < 40; i++) panHuntPresentationCamera(rt, 300, 300, read().panRequest);
  view = read();
  near(view.viewRect.right, W, "right edge pinned to the map");
  near(view.viewRect.bottom, H, "bottom edge pinned to the map");
  fillsWindow(view, W, H);
  // Native camera focus stays inside the runtime's own portrait clamp range.
  const focus = rt.getCameraFocus(), portrait = rt.getCamera(470, 900);
  near(focus.x, (portrait.left + portrait.right) / 2, "native focus is a legal portrait camera centre");
});
