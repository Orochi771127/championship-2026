// Hand-drawn move effect sprites (UNIQUE_PIXEL_MOVE_VFX_20261108, Owner 2026-11-08:
// 「外觀盡量一樣但你幫我畫」, drawn with the pxl skill). Original drawings: each
// is drawn here from shapes after watching what the move does; no reference
// pixel, palette or layout is copied.
//
// Tone keys are recoloured at runtime by the move's own palette:
//   o outline   e edge (dark)   m main   x light   c highlight
// Fixed keys keep a material's own colour whatever the move:
//   s/S pale stem, g/G leaf, W/L/D steel body, k black.
// scripts/build-drawn-vfx-sprites.mjs turns these into
// src/championship/presentation/vfx/drawnVfxSprites.js.
pal({ R: "#e83030", o: "#1a1020", e: "#5a2a7a", m: "#9b52d6", x: "#c890f0", c: "#f6e6ff",
  s: "#f2e4c4", S: "#b89a70", g: "#58b03c", G: "#2a6a2a", W: "#ffffff", L: "#c6cfdb", D: "#48505e", k: "#101018" })
ramps("oemxc", "oSs", "oGg", "oDLW")

// ---------------------------------------------------------------- mushroom
// Standing: a domed cap with three big spots over a pale stem.
sprite("mushroom", { w: 26, h: 24, outline: "o" },
  ellipse(13, 9, 12, 9, "m"), rect(1, 9, 25, 4, "m"), rect(1, 12, 25, 1, "e"),
  shade([0, 10, 26, 3]), light([4, 1, 10, 4]),
  circ(7, 7, 2, "c"), circ(17, 5, 2, "c"), circ(20, 10, 1, "c"), px(11, 10, "x"), px(12, 10, "x"),
  rect(10, 13, 7, 10, "s"), rect(10, 13, 2, 10, "S"), rect(10, 13, 7, 1, "S"))
// Squashed flat as it pops out of the ground.
sprite("mushroom_flat", { w: 30, h: 13, outline: "o" },
  ellipse(15, 5, 14, 5, "m"), rect(1, 5, 29, 3, "m"), rect(1, 7, 29, 1, "e"), light([5, 1, 12, 2]),
  circ(8, 4, 1, "c"), circ(19, 3, 1, "c"), px(23, 5, "c"),
  rect(11, 8, 9, 4, "s"), rect(11, 8, 3, 4, "S"))
// Stretched tall as it springs up.
sprite("mushroom_tall", { w: 14, h: 30, outline: "o" },
  ellipse(7, 7, 6, 7, "m"), rect(1, 7, 13, 3, "m"), rect(1, 9, 13, 1, "e"), light([3, 1, 4, 4]),
  circ(5, 5, 1, "c"), px(9, 3, "c"), px(10, 7, "c"),
  rect(5, 10, 5, 19, "s"), rect(5, 10, 2, 19, "S"))
// The thrown spore, two sizes, with a glint.
sprite("spore_0", { w: 9, h: 9, outline: "o" }, circ(4, 4, 3, "m"), circ(4, 4, 2, "x"), px(3, 3, "c"), px(4, 3, "c"))
sprite("spore_1", { w: 13, h: 13, outline: "o" }, circ(6, 6, 5, "m"), circ(6, 6, 3, "x"), circ(5, 5, 1, "c"), shade([6, 8, 6, 4]),
  px(11, 1, "c"), px(10, 2, "x"))

// ---------------------------------------------------------------- spore cloud
// Lumpy puffs, lit from the top left, darker underneath.
const puff = (w, h, lobes) => [ ...lobes.map(([x, y, r]) => circ(x, y, r, "m")), shade([0, Math.round(h * 0.62), w, h]),
  // Smoke is granular: darker specks thicken towards the shaded underside.
  noise(0, Math.round(h * 0.35), w, h, "e", 0.18, 7, "m"), noise(0, 0, w, Math.round(h * 0.5), "x", 0.08, 3, "m"),
  ...lobes.filter(([, y]) => y < h * 0.6).map(([x, y, r]) => circ(x - Math.ceil(r / 3), y - Math.ceil(r / 3), Math.max(1, Math.floor(r / 2)), "x")) ]
sprite("puff_0", { w: 16, h: 13, outline: "o" }, ...puff(16, 13, [[5, 7, 4], [10, 6, 4], [8, 8, 4]]))
sprite("puff_1", { w: 26, h: 20, outline: "o" }, ...puff(26, 20, [[6, 12, 5], [12, 8, 6], [19, 11, 5], [12, 13, 6], [20, 15, 4]]))
sprite("puff_2", { w: 30, h: 24, outline: "o" }, ...puff(30, 24, [[6, 15, 5], [11, 9, 6], [19, 8, 6], [24, 14, 5], [15, 15, 8], [8, 19, 4], [22, 19, 4]]))
sprite("puff_3", { w: 30, h: 24, outline: "o" }, ...puff(30, 24, [[5, 6, 3], [14, 4, 3], [24, 7, 3], [3, 16, 2], [12, 13, 4], [22, 17, 3], [16, 21, 2]]))

// ---------------------------------------------------------------- explosion
// A flash, fireballs swelling out of a white-hot core, then cooling into smoke and embers.
const ball = (x, y, r) => [circ(x, y, r, "m"), circ(x - 1, y - 1, Math.max(1, r - 2), "x")]
sprite("blast_0", { w: 32, h: 32 }, circ(16, 16, 5, "x"), circ(16, 16, 3, "c"), px(16, 8, "c"), px(16, 24, "c"), px(8, 16, "c"), px(24, 16, "c"),
  px(11, 11, "x"), px(21, 21, "x"), px(21, 11, "x"), px(11, 21, "x"))
sprite("blast_1", { w: 32, h: 32, outline: "e" }, ...ball(12, 15, 5), ...ball(19, 13, 5), ...ball(17, 19, 5), circ(16, 15, 3, "c"))
sprite("blast_2", { w: 32, h: 32, outline: "e" }, ...ball(9, 14, 6), ...ball(17, 9, 6), ...ball(23, 15, 6), ...ball(12, 21, 6), ...ball(21, 22, 5),
  circ(16, 15, 5, "x"), circ(15, 14, 3, "c"))
sprite("blast_3", { w: 32, h: 32, outline: "e" }, ...ball(7, 14, 6), ...ball(15, 7, 7), ...ball(25, 13, 6), ...ball(10, 23, 6), ...ball(22, 23, 6),
  ...ball(16, 16, 8), circ(15, 15, 3, "c"), shade([0, 20, 32, 12]))
sprite("blast_4", { w: 32, h: 32, outline: "o" }, circ(9, 12, 6, "e"), circ(18, 8, 6, "e"), circ(24, 17, 5, "e"), circ(13, 20, 7, "e"), circ(21, 24, 5, "e"),
  circ(10, 11, 3, "m"), circ(19, 9, 3, "m"), circ(14, 19, 3, "m"), px(8, 10, "x"), px(18, 8, "x"), px(13, 18, "x"),
  circ(27, 4, 1, "m"), circ(3, 26, 1, "m"), px(29, 26, "x"))
sprite("blast_5", { w: 32, h: 32 }, circ(6, 7, 2, "e"), circ(26, 6, 2, "e"), circ(4, 24, 1, "m"), circ(28, 25, 2, "e"), circ(16, 4, 1, "m"),
  circ(16, 28, 1, "e"), px(11, 14, "x"), px(21, 18, "x"), px(9, 22, "m"), px(23, 11, "m"))

// Round two (Owner: 「照順序」): a bigger blast with no outline, ragged at the rim.
const fb = (x, y, r) => [circ(x, y, r, "e"), circ(x - 1, y - 1, Math.max(1, r - 1), "m"), circ(x - 2, y - 2, Math.max(1, r - 3), "x")]
const ring8 = (cx, cy, d, r, k = 8, a0 = 0.3) => Array.from({length: k}, (_, i) => fb(Math.round(cx + Math.cos(a0 + i * 6.283 / k) * d), Math.round(cy + Math.sin(a0 + i * 6.283 / k) * d * 0.9), r)).flat()
sprite("bigblast_0", { w: 48, h: 48 }, circ(24, 24, 7, "x"), circ(24, 24, 4, "c"), line(24, 10, 24, 15, "x"), line(24, 33, 24, 38, "x"), line(10, 24, 15, 24, "x"), line(33, 24, 38, 24, "x"),
  px(15, 15, "m"), px(33, 33, "m"), px(33, 15, "m"), px(15, 33, "m"))
sprite("bigblast_1", { w: 48, h: 48 }, ...ring8(24, 24, 7, 6, 6), circ(24, 24, 7, "x"), circ(23, 23, 4, "c"))
sprite("bigblast_2", { w: 48, h: 48 }, ...ring8(24, 24, 11, 8, 7), ...fb(24, 24, 10), circ(23, 23, 7, "x"), circ(22, 22, 4, "c"),
  circ(8, 12, 1, "m"), circ(41, 34, 1, "m"))
sprite("bigblast_3", { w: 48, h: 48 }, ...ring8(24, 25, 14, 9, 8), ...ring8(24, 24, 7, 7, 5, 1), circ(23, 23, 6, "x"), circ(22, 22, 3, "c"),
  circ(4, 20, 2, "e"), circ(44, 28, 2, "e"), circ(20, 3, 1, "m"), circ(30, 45, 1, "m"))
sprite("bigblast_4", { w: 48, h: 48 }, ...ring8(24, 25, 15, 8, 8), circ(24, 24, 9, "e"), circ(21, 21, 4, "m"), circ(29, 28, 3, "m"),
  circ(24, 24, 5, "_"), circ(13, 30, 3, "_"), circ(34, 15, 2, "_"), circ(3, 12, 2, "e"), circ(45, 38, 2, "e"), px(22, 6, "x"))
sprite("bigblast_5", { w: 48, h: 48 }, circ(7, 9, 3, "e"), circ(40, 8, 2, "e"), circ(5, 37, 2, "e"), circ(43, 39, 3, "e"), circ(24, 5, 2, "m"),
  circ(24, 43, 2, "e"), circ(15, 22, 1, "m"), circ(34, 26, 1, "m"), px(12, 30, "x"), px(36, 17, "x"), px(26, 33, "m"), px(19, 14, "m"))

// Lightning: a jagged channel with forks, three different strikes, bright core in a glow.
const bolt = pts => { const out = []; for (let i = 2; i < pts.length; i += 2) out.push(line(pts[i - 2], pts[i - 1], pts[i], pts[i + 1], "x", 3)); for (let i = 2; i < pts.length; i += 2) out.push(line(pts[i - 2], pts[i - 1], pts[i], pts[i + 1], "c")); return out }
sprite("bolt_0", { w: 34, h: 18 }, ...bolt([1, 9, 6, 4, 10, 11, 15, 6, 19, 13, 24, 5, 28, 10, 33, 8]), line(15, 6, 17, 1, "m"), line(24, 5, 22, 1, "m"), line(19, 13, 21, 17, "m"))
sprite("bolt_1", { w: 34, h: 18 }, ...bolt([1, 8, 5, 12, 9, 5, 14, 10, 18, 3, 23, 12, 27, 7, 33, 10]), line(9, 5, 7, 1, "m"), line(23, 12, 26, 16, "m"), line(14, 10, 12, 15, "m"))
sprite("bolt_2", { w: 34, h: 18 }, ...bolt([1, 10, 4, 6, 9, 9, 13, 3, 17, 11, 22, 6, 26, 13, 33, 7]), line(13, 3, 16, 1, "m"), line(26, 13, 24, 17, "m"), line(4, 6, 2, 2, "m"))

// A hit of rays: thin lines thrown out from the contact, as an arrowhead strikes.
const rays = (len, gap, k = 8) => Array.from({length: k}, (_, i) => { const a = i * 6.283 / k + 0.2, l = len * (i % 2 ? 0.7 : 1);
  return line(Math.round(16 + Math.cos(a) * gap), Math.round(16 + Math.sin(a) * gap), Math.round(16 + Math.cos(a) * (gap + l)), Math.round(16 + Math.sin(a) * (gap + l)), i % 2 ? "x" : "c") })
sprite("rays_0", { w: 32, h: 32 }, circ(16, 16, 3, "c"), ...rays(5, 3))
sprite("rays_1", { w: 32, h: 32 }, circ(16, 16, 2, "x"), ...rays(9, 4))
sprite("rays_2", { w: 32, h: 32 }, ...rays(5, 10), px(16, 16, "m"))

// ---------------------------------------------------------------- bomb
sprite("bomb", { w: 20, h: 22, outline: "o" }, circ(9, 13, 8, "e"), circ(8, 12, 6, "m"), circ(6, 9, 2, "x"), px(5, 8, "c"),
  rect(13, 3, 4, 3, "D"), rect(13, 3, 4, 1, "L"), line(16, 3, 18, 0, "S"), px(19, 0, "c"), px(18, 1, "x"))

// ---------------------------------------------------------------- cherries
sprite("cherry", { w: 20, h: 20, outline: "o" },
  line(6, 11, 11, 2, "G"), line(14, 12, 11, 2, "G"), ellipse(14, 3, 4, 2, "g"), px(12, 3, "G"), px(13, 3, "G"),
  circ(6, 14, 5, "m"), circ(14, 15, 4, "m"), shade([4, 16, 14, 4]), circ(4, 12, 1, "c"), px(13, 13, "c"), px(12, 13, "x"))

// ---------------------------------------------------------------- missile
// A steel missile with a red nose band and fins; the exhaust takes the move's colour.
sprite("missile", { w: 30, h: 12, outline: "o" },
  poly([7, 3, 22, 3, 28, 6, 22, 9, 7, 9], "L"), rect(7, 3, 15, 2, "W"), rect(7, 7, 15, 2, "D"), rect(19, 3, 2, 6, "e"),
  poly([7, 3, 10, 3, 7, 0, 5, 0], "D"), poly([7, 9, 10, 9, 7, 12, 5, 12], "D"),
  poly([0, 4, 7, 3, 7, 9, 0, 8], "m"), poly([2, 5, 7, 4, 7, 8, 2, 7], "x"), px(5, 6, "c"), px(6, 6, "c"))

// Missiles differ move by move (Owner: 「飛彈的外型可以做一些變化」). All face right; the
// remade cells mirror them to the native left-facing convention.
// A stubby armoured canister: thick steel drum, rivet bands, a rounded nose, knobs for fins.
sprite("missile_fat", { w: 30, h: 16, outline: "o" },
  rect(5, 3, 18, 10, "L"), rect(5, 3, 18, 3, "W"), rect(5, 10, 18, 3, "D"), ellipse(23, 8, 5, 5, "L"), px(25, 6, "W"), px(24, 5, "W"),
  rect(10, 3, 2, 10, "D"), rect(17, 3, 2, 10, "D"), circ(8, 2, 1, "D"), circ(8, 14, 1, "D"), circ(14, 2, 1, "D"), circ(14, 14, 1, "D"),
  poly([0, 6, 5, 4, 5, 12, 0, 10], "m"), poly([1, 7, 5, 6, 5, 10, 1, 9], "x"), px(3, 8, "c"))
// A swept-wing missile whose body takes the move's colour: white nose, big rear fins.
sprite("missile_finned", { w: 30, h: 16, outline: "o" },
  poly([6, 5, 22, 5, 28, 8, 22, 11, 6, 11], "m"), rect(6, 5, 16, 2, "x"), rect(6, 9, 16, 2, "e"), poly([22, 5, 28, 8, 22, 11], "W"), px(24, 7, "L"),
  poly([6, 5, 12, 5, 6, 0, 3, 0], "e"), poly([6, 11, 12, 11, 6, 16, 3, 16], "e"), poly([13, 5, 17, 5, 14, 2], "e"), poly([13, 11, 17, 11, 14, 14], "e"),
  poly([0, 6, 6, 6, 6, 10, 0, 10], "x"), px(2, 8, "c"), px(1, 8, "c"))
// A long thin dart: dark body in the move's colour, a red-tipped nose, small fins, a short jet.
sprite("missile_dart", { w: 32, h: 10, outline: "o" },
  rect(6, 3, 20, 4, "e"), rect(6, 3, 20, 1, "m"), poly([26, 3, 31, 5, 26, 7], "R"), rect(24, 3, 2, 4, "W"),
  poly([6, 3, 10, 3, 7, 0], "m"), poly([6, 7, 10, 7, 7, 10], "m"), poly([15, 3, 18, 3, 16, 1], "m"),
  rect(0, 4, 6, 2, "x"), px(1, 4, "c"), px(2, 5, "c"))
// A rocket fist: a steel fist with knuckle plates, flame out of the wrist.
sprite("rocketfist", { w: 28, h: 18, outline: "o" },
  rect(9, 3, 8, 12, "L"), rect(9, 3, 8, 3, "W"), rect(17, 2, 7, 14, "L"), rect(17, 2, 7, 2, "W"),
  rect(23, 4, 2, 3, "D"), rect(23, 8, 2, 3, "D"), rect(23, 12, 2, 3, "D"), rect(19, 14, 4, 3, "L"), rect(9, 12, 8, 3, "D"),
  poly([0, 5, 9, 4, 9, 14, 0, 13], "m"), poly([2, 7, 9, 6, 9, 12, 2, 11], "x"), px(5, 9, "c"), px(6, 9, "c"))
// A giant missile: a long body with a painted cone in the move's colour and a black stripe.
sprite("missile_big", { w: 32, h: 16, outline: "o" },
  rect(6, 4, 18, 8, "L"), rect(6, 4, 18, 2, "W"), rect(6, 10, 18, 2, "D"), poly([24, 4, 31, 8, 24, 12], "m"), poly([24, 4, 27, 6, 24, 6], "x"),
  rect(13, 4, 2, 8, "k"), poly([6, 4, 11, 4, 6, 0, 3, 0], "D"), poly([6, 12, 11, 12, 6, 16, 3, 16], "D"),
  poly([0, 5, 6, 5, 6, 11, 0, 11], "m"), poly([1, 6, 6, 6, 6, 10, 1, 10], "x"), px(3, 8, "c"))

// ---------------------------------------------------------------- little fish
// A small fish, two strokes of the tail; a shoal leaps in an arc.
sprite("fish_0", { w: 12, h: 8, outline: "o" }, ellipse(6, 4, 4, 2, "m"), rect(3, 3, 6, 1, "x"), px(8, 3, "k"), poly([0, 1, 3, 4, 0, 7], "e"), px(5, 6, "e"))
sprite("fish_1", { w: 12, h: 8, outline: "o" }, ellipse(6, 4, 4, 2, "m"), rect(3, 3, 6, 1, "x"), px(8, 3, "k"), poly([0, 2, 3, 4, 1, 6], "e"), px(5, 6, "e"))

// ---------------------------------------------------------------- more things
sprite("gear", { w: 24, h: 24, outline: "o" }, circ(12, 12, 8, "m"), ...Array.from({length: 8}, (_, i) => { const a = i * 0.785; return rect(Math.round(12 + Math.cos(a) * 9) - 2, Math.round(12 + Math.sin(a) * 9) - 2, 4, 4, "m") }),
  circ(12, 12, 4, "e"), circ(12, 12, 2, "_"), light([4, 3, 8, 5]), shade([10, 14, 12, 8]))
sprite("bone", { w: 24, h: 12, outline: "o" }, rect(5, 4, 14, 4, "m"), circ(4, 3, 3, "m"), circ(4, 8, 3, "m"), circ(19, 3, 3, "m"), circ(19, 8, 3, "m"), rect(5, 4, 14, 1, "x"), px(3, 2, "c"), px(18, 2, "c"), rect(5, 7, 14, 1, "e"))
sprite("clock", { w: 22, h: 24, outline: "o" }, circ(5, 4, 3, "m"), circ(16, 4, 3, "m"), circ(11, 14, 9, "m"), circ(11, 14, 7, "W"), line(11, 14, 11, 9, "k"), line(11, 14, 15, 14, "k"),
  px(11, 8, "D"), px(11, 20, "D"), px(5, 14, "D"), px(17, 14, "D"), line(6, 22, 4, 23, "e"), line(16, 22, 18, 23, "e"), px(4, 3, "c"))
// A cat's eye: an almond of gold, a round iris and a black slit pupil with a glint.
sprite("eye", { w: 30, h: 16, outline: "o" }, poly([0, 8, 6, 3, 15, 1, 24, 3, 30, 8, 24, 13, 15, 15, 6, 13], "x"), circ(15, 8, 6, "m"), circ(15, 8, 4, "e"),
  rect(14, 2, 3, 13, "k"), px(12, 5, "c"), px(13, 5, "c"), px(12, 6, "c"), shade([2, 11, 26, 5]))
sprite("ghost", { w: 24, h: 26, outline: "o" }, circ(12, 15, 9, "m"), rect(5, 18, 14, 6, "m"), circ(8, 14, 2, "k"), circ(16, 14, 2, "k"), rect(9, 20, 6, 2, "e"),
  px(10, 20, "k"), px(13, 20, "k"), circ(6, 6, 3, "x"), circ(12, 3, 3, "x"), circ(18, 6, 3, "x"), circ(12, 7, 4, "m"), light([5, 8, 6, 4]))
// A gate of light: a double outlined arch on two posts, the opening faintly lit.
sprite("arch", { w: 24, h: 32 }, clip([0, 0, 24, 13], ellipse(12, 12, 11, 11, "x", true), ellipse(12, 12, 9, 9, "m", true)),
  rect(1, 12, 2, 20, "x"), rect(21, 12, 2, 20, "x"), rect(3, 12, 1, 20, "m"), rect(20, 12, 1, 20, "m"),
  dither(5, 6, 14, 26, "_", "c", 0.22), rect(0, 30, 4, 2, "m"), rect(20, 30, 4, 2, "m"))

// ---------------------------------------------------------------- heart
sprite("heart", { w: 16, h: 14, outline: "o", mx: true }, `
  .mmm....
  mxxmm...
  mxcmmm..
  mxmmmmmm
  mmmmmmmm
  emmmmmmm
  .emmmmmm
  ..emmmmm
  ...emmmm
  ....emmm
  .....emm
  ......em
  .......e`)

// ---------------------------------------------------------------- splash
sprite("splash_0", { w: 24, h: 16, outline: "o" }, ellipse(12, 12, 9, 3, "m"), ellipse(12, 12, 6, 2, "x"), circ(8, 7, 2, "m"), circ(15, 5, 2, "m"), px(15, 4, "c"))
sprite("splash_1", { w: 28, h: 20, outline: "o" }, ellipse(14, 16, 12, 3, "m"), circ(5, 8, 2, "m"), circ(11, 4, 2, "x"), circ(18, 3, 2, "m"),
  circ(23, 8, 2, "x"), px(11, 3, "c"), px(23, 7, "c"))
sprite("splash_2", { w: 30, h: 22, outline: "o" }, ellipse(15, 19, 13, 2, "e"), circ(3, 13, 1, "m"), circ(9, 7, 2, "m"), circ(21, 6, 2, "m"),
  circ(27, 13, 1, "m"), px(15, 3, "x"), px(9, 6, "c"))

// ================================================================ set pieces (BESPOKE_MOVE_VFX_PROGRAM_20261111)
// Bespoke contact pieces a move's choreography animates (moveVfxSetPieces.js). Tone keys take the move's palette;
// W stays white (fangs, a horn's glint).

// Flame jaws: the upper jaw, a burning arch with four white fangs hanging from it; the lower jaw is its flip.
sprite("jaw_top", { w: 44, h: 22, outline: "o" },
  // an arched jaw: a band between two arcs, hotter along its crown
  clip((x, y) => ((x - 22) / 22) ** 2 + ((y - 20) / 20) ** 2 <= 1 && ((x - 22) / 16) ** 2 + ((y - 21) / 13) ** 2 > 1 && y <= 18,
    rect(0, 0, 44, 22, "m")),
  clip((x, y) => ((x - 22) / 21) ** 2 + ((y - 20) / 19) ** 2 <= 1 && ((x - 22) / 19) ** 2 + ((y - 21) / 17) ** 2 > 1 && y <= 12,
    rect(0, 0, 44, 22, "x")),
  hline(15, 1, 14, "c"),
  // fangs hang from the inner arc and lean in toward the bite
  poly([6, 13, 9, 11, 9, 20], "W"), poly([12, 9, 15, 8, 15, 19], "W"), poly([29, 8, 32, 9, 29, 19], "W"), poly([35, 11, 38, 13, 35, 20], "W"),
  px(8, 12, "L"), px(14, 9, "L"), px(30, 9, "L"), px(36, 12, "L"))
sprite("jaw_bottom", { base: "jaw_top", flip: "y" })

// One claw mark: a long tapered gash, hot at its heart; the choreography rakes three in a row.
sprite("claw_mark", { w: 12, h: 40, outline: "o" },
  poly([10, 0, 11, 2, 3, 39, 1, 37], "m"), poly([9, 3, 10, 5, 4, 34, 3, 33], "x"), line(9, 6, 5, 28, "c"))

// A horn spear tip pointing right: a ridged horn with a hot glint along its top edge.
sprite("horn_tip", { w: 36, h: 14, outline: "o" },
  poly([0, 2, 6, 0, 35, 7, 6, 13, 0, 11], "m"), poly([6, 2, 30, 7, 6, 6], "x"), line(8, 3, 28, 6, "c"),
  vline(10, 2, 9, "e"), vline(17, 3, 7, "e"), px(33, 7, "W"))

// A molten core: a cracked round ember, darker in its cracks, white-hot inside.
sprite("core", { w: 18, h: 18, outline: "o" },
  circ(9, 9, 8, "m"), circ(8, 8, 5, "x"), circ(7, 7, 2, "c"), line(3, 12, 8, 9, "e"), line(13, 4, 10, 8, "e"), line(14, 13, 10, 10, "e"))

// A cannon's muzzle ring: a thick ring with four notches, the shot's breath at its centre.
sprite("muzzle", { w: 26, h: 26, outline: "o" },
  circ(13, 13, 12, "m"), circ(13, 13, 9, "_"), ring(13, 13, 10, "x"), circ(13, 13, 4, "c"),
  rect(12, 0, 3, 3, "e"), rect(12, 23, 3, 3, "e"), rect(0, 12, 3, 3, "e"), rect(23, 12, 3, 3, "e"))

// ---------------------------------------------------------------- set pieces, batch 2 (strike and slash signatures)
// A fist driving right: four knuckles, a thumb folded under, a hot rim on the striking face.
sprite("fist", { w: 26, h: 24, outline: "o" },
  rect(2, 5, 14, 15, "m"), rect(0, 8, 4, 9, "e"),
  // four knuckles stacked on the striking face, each lit on top
  rect(14, 4, 6, 17, "m"), circ(20, 6, 2, "m"), circ(21, 10, 2, "m"), circ(21, 14, 2, "m"), circ(20, 18, 2, "m"),
  // dark grooves between the knuckles so each reads on its own
  hline(18, 8, 6, "o"), hline(18, 12, 6, "o"), hline(18, 16, 6, "o"),
  px(20, 5, "c"), px(21, 9, "c"), px(21, 13, "c"), px(20, 17, "c"),
  // finger seams and the thumb folded under
  hline(10, 8, 7, "e"), hline(10, 12, 8, "e"), hline(10, 16, 7, "e"), rect(5, 18, 10, 4, "x"), hline(6, 18, 8, "c"))
// The star of a blow landing: eight points, white at its heart.
sprite("impact_star", { w: 30, h: 30, outline: "o" },
  poly([15, 0, 18, 11, 29, 15, 18, 19, 15, 29, 12, 19, 1, 15, 12, 11], "m"),
  poly([4, 4, 13, 12, 12, 13], "x"), poly([26, 4, 17, 12, 18, 13], "x"), poly([4, 26, 13, 18, 12, 17], "x"), poly([26, 26, 17, 18, 18, 17], "x"),
  circ(15, 15, 4, "x"), circ(15, 15, 2, "c"))
// A ground crack seen from the side: a jagged split with chips thrown up.
sprite("crack", { w: 48, h: 14, outline: "o" },
  poly([0, 10, 10, 8, 16, 11, 24, 7, 31, 10, 38, 8, 47, 11, 38, 12, 30, 13, 22, 11, 14, 13, 6, 12], "e"),
  line(6, 11, 40, 10, "k"), poly([12, 6, 14, 2, 16, 6], "m"), poly([28, 5, 31, 0, 33, 5], "m"), poly([40, 6, 41, 3, 43, 6], "m"), px(31, 1, "x"))
// A blade arc: a crescent of light, white along its cutting edge.
sprite("blade_arc", { w: 40, h: 40, outline: "o" },
  clip((x, y) => (x - 6) ** 2 + (y - 20) ** 2 <= 33 ** 2 && (x + 2) ** 2 + (y - 20) ** 2 > 30 ** 2, rect(0, 0, 40, 40, "m")),
  clip((x, y) => (x - 6) ** 2 + (y - 20) ** 2 <= 33 ** 2 && (x - 1) ** 2 + (y - 20) ** 2 > 31 ** 2, rect(0, 0, 40, 40, "x")),
  clip((x, y) => (x - 6) ** 2 + (y - 20) ** 2 <= 33 ** 2 && (x - 4) ** 2 + (y - 20) ** 2 > 32 ** 2, rect(0, 0, 40, 40, "c")))
// Speed streaks behind a rush: three lines of falling length.
sprite("streaks", { w: 40, h: 14, outline: "o" },
  hline(2, 2, 36, "x"), hline(10, 6, 28, "m"), hline(4, 11, 32, "x"), px(37, 2, "c"), px(37, 11, "c"))
// A thrown knife, point right.
sprite("knife", { w: 22, h: 8, outline: "o" },
  poly([6, 2, 20, 4, 6, 6], "x"), hline(7, 4, 12, "c"), rect(0, 2, 6, 4, "e"), px(5, 4, "m"))

// ---------------------------------------------------------------- set pieces, batch 3 (fire, orb, lance, pierce, missile, claw)
// A flame tongue standing on its base: three licks, white-hot at the root.
sprite("flame", { w: 20, h: 30, outline: "o" },
  poly([10, 0, 14, 9, 18, 6, 17, 18, 19, 29, 1, 29, 3, 18, 2, 8, 6, 12], "m"),
  poly([10, 7, 13, 15, 15, 13, 14, 23, 6, 28, 5, 20, 7, 15], "x"), poly([10, 16, 12, 22, 11, 28, 8, 28, 8, 22], "c"))
// A lance of light pointing right: a long shaft that narrows to a hot point.
sprite("lance_beam", { w: 64, h: 12, outline: "o" },
  poly([0, 3, 50, 3, 63, 6, 50, 9, 0, 9], "m"), poly([0, 5, 52, 5, 60, 6, 52, 7, 0, 7], "x"), hline(4, 6, 54, "c"), px(62, 6, "W"))
// A toxic blob mid-splash: a lumpy body with two drips and bubbles.
sprite("blob", { w: 28, h: 24, outline: "o" },
  ellipse(14, 12, 12, 8, "m"), circ(6, 8, 4, "m"), circ(21, 7, 4, "m"), rect(8, 18, 3, 5, "m"), rect(18, 17, 2, 6, "m"),
  ellipse(12, 10, 6, 3, "x"), circ(19, 6, 1, "c"), circ(9, 9, 1, "c"), circ(16, 13, 2, "e"), px(16, 13, "x"))

// ---------------------------------------------------------------- set pieces, batch 4 (the remaining signatures)
// Small things a flurry throws, each lit from the top left.
sprite("note", { w: 12, h: 16, outline: "o" }, ellipse(4, 12, 3, 2, "m"), vline(7, 1, 11, "m"), poly([7, 1, 11, 4, 11, 6, 7, 4], "m"), px(3, 11, "c"), px(8, 2, "x"))
sprite("leaf", { w: 14, h: 10, outline: "o" }, poly([0, 5, 6, 0, 13, 4, 7, 9], "m"), line(1, 5, 12, 4, "e"), poly([3, 4, 6, 1, 9, 3], "x"))
sprite("feather_sm", { w: 16, h: 8, outline: "o" }, poly([0, 4, 12, 1, 15, 4, 12, 7], "m"), hline(1, 4, 13, "c"), poly([4, 3, 11, 2, 13, 4], "x"))
sprite("bubble_sm", { w: 12, h: 12, outline: "o" }, circ(6, 6, 5, "m"), circ(6, 6, 3, "_"), ring(6, 6, 4, "x"), px(4, 4, "c"), px(3, 5, "c"))
sprite("shard", { w: 10, h: 16, outline: "o" }, poly([5, 0, 9, 7, 5, 15, 1, 7], "m"), poly([5, 1, 7, 7, 5, 12], "x"), vline(5, 2, 8, "c"))
// A vortex: three arms coiling into a dark eye.
sprite("vortex", { w: 34, h: 34, outline: "o" },
  (c) => { for (let a = 0; a < 3; a++) for (let t = 0; t < 1; t += 0.01) { const ang = a * 2.094 + t * 5.5, r = 2 + t * 14;
    c.px(Math.round(17 + Math.cos(ang) * r), Math.round(17 + Math.sin(ang) * r), t > 0.6 ? "m" : t > 0.3 ? "x" : "c"); } },
  circ(17, 17, 3, "e"), px(17, 17, "o"))
// A vine rising and curling over at the top, with two leaves.
sprite("vine", { w: 16, h: 40, outline: "o" },
  (c) => { for (let y = 39; y > 6; y--) { const x = Math.round(7 + Math.sin(y / 5) * 3); c.px(x, y, "m"); c.px(x + 1, y, "e"); } },
  circ(11, 5, 3, "m"), circ(11, 5, 1, "_"), poly([2, 24, 7, 21, 6, 26], "x"), poly([13, 15, 9, 13, 10, 18], "x"))
