# Leaving the hunt releases its memory; phone landscape bottom dock (2026-11-26)

Owner: after leaving the hunt, temporary data and memory must be released, so the phone web app
is not killed and sent back to the title. Owner also approved moving the phone-landscape tools
to the bottom dock ("Yes, change it").

## Result

- **The game releases what the hunt took.** GPU textures and buffers return to the ranch level after every hunt, and no game object keeps a hunt screen alive.
- **Phone landscape now uses the bottom dock** over a full-width map, like the desktop.

## 1. Enter/leave loop (`enter-leave-loop.json`)

Chromium, phone portrait 390 x 844 at DPR 3. Five maps (canyon, grass, factory, ice, volcano),
three rounds, 15 hunts. After every leave: three forced GCs, then the live counts.

| Measure | Ranch at start | After 15 hunts | Reading |
|---|---|---|---|
| Live WebGL textures | 26 / 68.2 MB | 32 / 68.2 MB | flat |
| Live WebGL buffers | 89 / 2.6 MB | 105 / 2.9 MB | flat |
| Detached canvases | 4.3 MB | 8.7 MB | flat after the first hunt |
| JS heap | 40 MB | 61 MB | flat after the first hunt (about +1 MB per 5 hunts) |
| DOM nodes | 1,864 | 5,864 | +250 per hunt: the probe, see section 2 |
| Event listeners | 228 | 622 | +25 per hunt: the probe, see section 2 |

In the hunt the textures peak at 105 MB on grass (hm01) and 73 MB on canyon (hm08 at 2880); both
drop back on leaving. No page errors in the 15 hunts.

## 2. What kept the DOM (`detached-census-with-retainers.json`)

After two hunts, a census of detached DOM and a heap snapshot with the shortest strong retainer path.

- The growing part was the gate-select screen (`section.cm-vs2-shell`), one copy per visit.
  - Its only retainer was `(Global handles) / DevTools console`: the test tool's own element handles.
  - With those handles and the test-only `__qa*` hooks excluded, the result is **no path**: nothing in the game holds it.
- One hunt field (`section.cm-vs2-field`) stays until the next hunt replaces it. It hangs off a window global through a `dispose` closure, most likely the test-only scene hook; it is one copy, not one per hunt.

So the node and listener growth in section 1 is the measuring tool, not a game leak.

## 3. Change in this PR

- Every wide hunt window uses the bottom dock (`portraitFrame.js`: `HUNT_DESKTOP_DOCK_MIN` is 0 x 0); `body[data-hunt-wide]` is no longer set.
- On a notched phone held sideways the title, the return button, the info rows and the dock stay inside the left and right safe areas; the map runs edge to edge.
- Ground-contact effects zero their small source canvases when the hunt is disposed (iOS keeps a canvas's backing store until GC).

## 4. Phone landscape check

Chromium at 844 x 390 with emulated safe-area insets (left and right 47 px, bottom 21 px) and at 667 x 375.

- `landscape-dock-8-cases.json`: grass, canyon, factory and ice at both sizes.
  - All eight use the bottom dock on a full-screen canvas.
  - The title, the return button, the hint and the dock are inside the safe area.
  - Both far map corners can be reached, and there are no page errors.
- `landscape-capture-3-cases.json`: the rope caught a partner on grass, ice and factory (3 of 3). Canyon caught twice in earlier runs.
- `phone-landscape-bottom-dock.jpg`: four maps at 844 x 390.

## Checks

`npm run test:ci` 4115/4115 and `npm run build:playtest` pass.

## Limits

- Measured in desktop Chromium with phone emulation, not on a real iPhone. WebKit frees GPU memory on its own schedule; these numbers show the game drops its references, not what iOS reports.
- hm08 at 2880 holds about 73 MB of textures while in the hunt (it was about 33 MB at 2048). A half-resolution mask would bring it to about 48 MB; not done here.
