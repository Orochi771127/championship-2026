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
