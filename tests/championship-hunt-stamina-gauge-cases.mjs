import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { huntStaminaGauge } from "../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js";

// Owner QA, 2026-09-12: "狩獵場捕捉也看不到他的耐力減少，可是原作有耐力減少".
// The simulation was never at fault -- currentHp and maxHp were published to
// the renderer every frame and simply never drawn. These pin the rule that
// decides what the player sees, so it cannot silently go quiet again.

test("a worn-down creature shows its gauge, an untouched one does not", () => {
  assert.equal(huntStaminaGauge({ currentHp: 40, maxHp: 40 }, false).visible, false,
    "an untouched creature would only add noise");
  assert.equal(huntStaminaGauge({ currentHp: 39, maxHp: 40 }, false).visible, true,
    "the first point of damage must already be visible -- depletion is the thing being watched");
  assert.equal(huntStaminaGauge({ currentHp: 0, maxHp: 40 }, false).visible, true);
  // The creature being worked on shows its gauge even before the first hit,
  // so aiming a tool does not require guessing.
  assert.equal(huntStaminaGauge({ currentHp: 40, maxHp: 40 }, true).visible, true);
});

test("the fraction tracks the published hit points and never leaves the bar", () => {
  assert.equal(huntStaminaGauge({ currentHp: 30, maxHp: 40 }, true).fraction, 0.75);
  assert.equal(huntStaminaGauge({ currentHp: 0, maxHp: 40 }, true).fraction, 0);
  // Neither of these should be reachable, which is exactly why they are pinned:
  // a gauge is not the place to discover an out-of-range hit point value.
  assert.equal(huntStaminaGauge({ currentHp: -5, maxHp: 40 }, true).fraction, 0);
  assert.equal(huntStaminaGauge({ currentHp: 99, maxHp: 40 }, true).fraction, 1);
});

test("the fill reads healthy to critical, and the three bands are distinct", () => {
  const colour = (currentHp) => huntStaminaGauge({ currentHp, maxHp: 100 }, true).color;
  const high = colour(100), mid = colour(40), low = colour(10);
  assert.notEqual(high, mid);
  assert.notEqual(mid, low);
  assert.notEqual(high, low);
  assert.equal(colour(51), high, "above half still reads healthy");
  assert.equal(colour(50), mid, "at half it has stopped reading healthy");
  assert.equal(colour(22), low, "at the low threshold it reads critical");
});

test("a creature with no published hit points draws nothing rather than a wrong bar", () => {
  for (const wild of [undefined, null, {}, { currentHp: 5 }, { maxHp: 5 },
    { currentHp: 5, maxHp: 0 }, { currentHp: Number.NaN, maxHp: 40 },
    { currentHp: 5, maxHp: Number.POSITIVE_INFINITY }]) {
    assert.equal(huntStaminaGauge(wild, true).visible, false, `refused: ${JSON.stringify(wild)}`);
  }
});

test("both published wild-creature paths carry the hit points this gauge reads", () => {
  // The renderer reads currentHp/maxHp off the view. Two producers supply that
  // view -- the native controls and the fallback runtime -- and a gauge that
  // silently stops drawing because one of them dropped a field is precisely
  // the failure being repaired here.
  const controls = fs.readFileSync("src/championship/hunt/capture/nativeHuntFieldControls.js", "utf8");
  assert.match(controls, /currentHp\s*:\s*a\.currentHp/, "native controls still publish currentHp");
  assert.match(controls, /maxHp\s*:\s*a\.maxHp/, "native controls still publish maxHp");
  const runtime = fs.readFileSync("src/championship/hunt/huntRuntime.js", "utf8");
  assert.match(runtime, /currentHp\s*:/, "the fallback runtime still publishes currentHp");
  assert.match(runtime, /maxHp\s*:/, "the fallback runtime still publishes maxHp");
});

test("the gauge sits on the creature, centred and below its feet, and never outruns its track", () => {
  const g = huntStaminaGauge({ currentHp: 20, maxHp: 40 }, true);
  assert.equal(g.x, -g.width / 2, "centred on the actor");
  assert.equal(g.y > 0, true, "below the feet, which are at y 0, not over the body");
  assert.equal(g.width > 0 && g.height > 0, true);
  assert.equal(g.fillWidth, g.width / 2, "half the hit points fills half the track");

  const full = huntStaminaGauge({ currentHp: 40, maxHp: 40 }, true);
  assert.equal(full.fillWidth, full.width, "a full gauge fills exactly its track and no more");

  // A nearly-dead creature must still show something: a gauge that vanishes at
  // one hit point reads as "gone", which is the opposite of what it is for.
  const sliver = huntStaminaGauge({ currentHp: 1, maxHp: 4000 }, true);
  assert.equal(sliver.fillWidth >= 1, true, "a sliver of stamina is still drawn");
  assert.equal(sliver.fillWidth <= sliver.width, true);

  // Zero is the one case that draws no fill at all.
  assert.equal(huntStaminaGauge({ currentHp: 0, maxHp: 40 }, true).fillWidth, 0);
});
