# Native UI skin implementation notes

Moved from the render-blocking stylesheet during the 2026-09-12 review.
Historical reasoning, not new original-game verification; current Owner direction and runtime contracts take precedence.
The 4:3 frame and automatic landscape are presentation choices.

## Source note 1

```css
/* Championship 2026 -- original-faithful interface skin, modernised.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The product screens had drifted to a light, generic mobile-dashboard look.
 * The original speaks one very specific interface language, and every screen of
 * it is built from the same parts:
 *
 *   1. a cyan hexagonal tech mesh over a deep blue ground;
 *   2. a gold ribbon across the top, cut into angled segments, carrying the
 *      season tab, the day, the mode and the clock;
 *   3. windows framed by a gold band between two dark lines, filled with a
 *      desaturated dark green;
 *   4. readout rows that are DARK inside with a bright green rim -- the green
 *      in the original is mostly outline and label, not fill;
 *   5. a rail of icon discs at the bottom, metal at rest and gold when chosen.
 *
 * MODERNISED, NOT COPIED
 * ----------------------
 * Same palette, same geometry, same information order. What changes is the
 * finish: two-stop gradients instead of banded ramps, one crisp rim instead of
 * three stacked outlines, soft ambient glow where the cartridge had none, real
 * type instead of a bitmap face, and touch-sized targets.
 *
 * Everything here is authored CSS. The only runtime art it references is the
 * approved toolbar cell set already under assets/production. No ROM, decoded or
 * reconstructed byte is loaded or shipped by this file. Scene and field art is
 * untouched; this file dresses chrome only.
 *
 * It loads last, so it re-skins the existing class vocabulary without asking
 * any screen to change its markup or its behaviour.
 */
```

## Source note 2

```css
/* ====================================================================== *
 * 4. CAPSULES
 * ----------------------------------------------------------------------
 * Two families, and the split matters: a SLOT is dark with a bright rim and
 * carries a value; a BUTTON is filled and is pressed. The original keeps far
 * more slots than buttons on screen, which is why it never looks green-heavy.
 * ====================================================================== */
```

## Source note 3

```css
/* ====================================================================== *
 * 5. APPLICATION -- the same parts, wired onto the screens we ship
 * ----------------------------------------------------------------------
 * Nothing below adds a class, moves a node or changes behaviour. Each rule
 * re-dresses a selector the screens already use, so the skin is one file to
 * review and one file to revert.
 * ====================================================================== */
```

## Source note 4

```css
/* Navigation entries are slots, not buttons: they take you somewhere, they do
   not commit anything. Only the two entries that actually change the world --
   ending the day and saving out -- are filled. This is the same restraint the
   original shows, and it is what keeps a five-item menu from reading as a wall
   of green. */
```

## Source note 5

```css
/* ====================================================================== *
 * 6. GATE, HUNT, FACILITY, SHOP, DATABASE  (.cm-vs2-root family)
 * ----------------------------------------------------------------------
 * The bright layers for these screens are written as
 * `.cm-vs2-root:is([data-screen=...])` and
 * `.cm-vs2-root[data-screen="X"] .cm-vs2-y`, so the skin carries the same
 * weight and wins on load order alone. No `!important` anywhere.
 * ====================================================================== */
```

## Source note 6

```css
/* ====================================================================== *
 * 7. BATTLE  (.cm-vs5-root family)
 * ----------------------------------------------------------------------
 * The original's battle chrome is the same window and slot language, and its
 * result screen is the one place a red band appears. Win and loss are the
 * only states that change the palette, so they are the only states here that
 * do.
 * ====================================================================== */
```

## Source note 7

```css
/* ====================================================================== *
 * 9. TITLE -- the original's start screen
 * ----------------------------------------------------------------------
 * The cartridge shows the logo over the same mesh the rest of the interface
 * uses, with the choices as capsules low on the screen. The logo art itself is
 * untouched; only the ground and the capsules are ours.
 * ====================================================================== */
```

## Source note 8

```css
/* ====================================================================== *
 * 10. THE GAME COLUMN -- one width for every screen
 * ----------------------------------------------------------------------
 * Every playable screen is `min(100%, 430px)` wide and centred. The title
 * panel was sized `min(100vw, 56.25dvh)` instead, which on a tall window is
 * wider than the game, so the opening overlay it hosts -- the letter, the
 * envelope -- sat outside the frame the player reads as the game. Capping the
 * panel at the same 430px keeps the 9:16 shape on short windows and lines the
 * opening up with everything that follows on tall ones.
 * ====================================================================== */
```

## Source note 9

```css
/* ====================================================================== *
 * 11. TOOLBAR SLOTS -- corrected against the original hardware
 * ----------------------------------------------------------------------
 * Comparing the recovered ROM icons against a photo of the original running
 * showed the icons were right and their holder was not. The original's slots
 * are HEXAGONS carried in gold brackets along a gold rail, and the chosen tool
 * is a GREEN hexagon under a gold icon -- not a gold disc. The plate is drawn
 * as one inline SVG so the button itself stays unclipped and keeps its focus
 * ring; a clip-path on the button would eat it.
 *
 * The SVG uses flat polygons rather than a gradient on purpose. An SVG
 * gradient has to be referenced by fragment id, and inside a data URI that id
 * percent-encodes; the release build plan scans a stylesheet for every
 * resource reference and resolves it to a publishable file, skipping only the
 * data and fragment forms it recognises -- not the encoded one. A gradient here
 * would therefore be reported as a missing static resource and could never
 * ship. This comment avoids spelling the encoded form out for the same reason.
 * ====================================================================== */
```

## Source note 10

```css
/* ====================================================================== *
 * 12. REVIEW FIXES -- measured, not eyeballed
 * ----------------------------------------------------------------------
 * A walk of every screen measured three things: anything wider than its
 * column, text that does not fit its box, and interactive targets under 40px.
 * Two screens failed the third. Everything below is that failure and the two
 * icon decisions the Owner took on 2026-09-12.
 * ====================================================================== */
```

## Source note 11

```css
/* ---- 12.3 The cells with no approved art ------------------------------ *
   Five hunt tools and the save control have no cell in the approved set.
   They are authored on the same 16x16 grid, in the same five tones, with
   the same rest -> chosen palette swap the approved cells use, so one rail
   never reads as a different product from the other. Generated by
   .tmp/hunt_glyphs.py. Nothing is written under assets/production:
   promoting an asset is the Owner's decision, and this is chrome. */
```

## Source note 12

```css
/* ====================================================================== *
 * 13. THE HABITAT FRAME -- give it the shape its art was drawn for
 * ----------------------------------------------------------------------
 * Measured on a 430x880 phone: the frame was 426x519 (portrait, 0.82) while the
 * ranch draws 414x365 (landscape, 1.13). The fit is `contain` and must stay
 * `contain` -- the fitted rectangle is also what actor positions and drop
 * targets are resolved through, so cropping or a CSS transform here would move
 * the art away from where a drag lands. So 154px of the frame was empty, inside
 * a gold window, which reads as a hole rather than as ground.
 *
 * The original's habitat screen is 256x192. Giving the frame that same 4:3 and
 * centring it puts the leftover height OUTSIDE the window, where the mesh reads
 * as the digital world the ranch is a platform in -- which is what it is. The
 * ranch then fills its own frame, and nothing about the transform changes.
 *
 * Zooming to fill instead was tried and rejected: it needs 1.42x, which hides
 * 28% of the ranch width behind a pan on a screen whose whole point is seeing
 * your residents at a glance.
 * ====================================================================== */
```

## Source note 13

```css
/* ====================================================================== *
 * 14. LANDSCAPE -- the original's two screens, side by side
 * ----------------------------------------------------------------------
 * Turned sideways, the product did not break, but it was unusable: every shell
 * stayed a 430px column centred in an 844px window, so the habitat was crushed
 * to a 40px sliver, the shop showed one item, and the schedule was cut off.
 *
 * The answer is in the hardware. The original is TWO 256x192 screens, an
 * information screen above a touch screen. Portrait stacks them, which is how
 * the console is held. Landscape sets them side by side, which is what the
 * console's own emulators do, and it is the only arrangement that spends the
 * width instead of padding it away.
 *
 * Gated on a short landscape window so it reaches a phone on its side and not a
 * desktop, where the centred column is a deliberate frame rather than a
 * limitation.
 * ====================================================================== */
```
