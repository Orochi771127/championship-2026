// Per-style effects for the Dex "Preview special" (Owner 2026-10-28): vines
// that burst from under the training dummy, arcing missiles with smoke,
// lightning from above, a flame stream, thorn fans, spore clouds and so on, in
// place of one straight beam for every partner. The style comes from the move's
// theme (moveVfxThemes.js); the move's own battle cells ride on top when the
// atlas is available (showcaseBankCells.js).
//
// Each style has two beats inside the sandbox sequencer: `travel` starts at the
// travel beat and must land by the contact beat (+300 ms); `impact` runs after
// the hit-stop. DOM + Web Animations only, every node lives in the sandbox's
// fx layer and is cleared with it.

/** Styles whose travelling element can carry the move's body cell. */
export const SHOWCASE_CARRIER_STYLES = Object.freeze(['missile', 'gatling', 'shell', 'fireball', 'seed', 'ice', 'dark', 'leaf', 'spore']);
const MELEE = new Set(['strike', 'claw', 'slash', 'pierce']);
export const showcaseStyleIsMelee = style => MELEE.has(style);

const rad = deg => (deg * Math.PI) / 180;
/** A parabola from a to b peaking `lift` px above the straight line. */
function arcPoints(a, b, lift, steps = 10) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - lift * 4 * t * (1 - t);
    const dx = (b.x - a.x), dy = (b.y - a.y) - lift * 4 * (1 - 2 * t);
    points.push({t, x, y, angle: Math.atan2(dy, dx)});
  }
  return points;
}

/** Shared toolkit bound to one preview run. */
function kit(ctx) {
  const {spawn, animate, later, full} = ctx;
  const along = (element, points, duration, {spin = 0, scale = [1, 1], easing = 'linear', delay = 0, rotate = true} = {}) => {
    const origin = points[0];
    return animate(element, points.map(p => ({offset: p.t,
      transform: `translate(${(p.x - origin.x).toFixed(1)}px, ${(p.y - origin.y).toFixed(1)}px) rotate(${(rotate ? p.angle : 0) + spin * p.t}rad) scale(${scale[0] + (scale[1] - scale[0]) * p.t})`})),
    {duration, easing, delay});
  };
  const fade = (element, duration, delay = 0) => animate(element, [{opacity: 1}, {opacity: 0}], {duration, delay, easing: 'ease-in'});
  const drop = (element, ms) => later(ms, () => element.remove());
  const puff = (className, x, y, {rise = 30, grow = 2.2, duration = 600, delay = 0, drift = 0} = {}) => {
    const element = spawn(`cm-vfx ${className}`, x, y);
    animate(element, [{opacity: 0, transform: 'translate(0, 0) scale(0.4)'}, {opacity: 0.95, offset: 0.2, transform: `translate(${drift * 0.3}px, ${-rise * 0.2}px) scale(1)`},
      {opacity: 0, transform: `translate(${drift}px, ${-rise}px) scale(${grow})`}], {duration, delay, easing: 'ease-out'});
    drop(element, duration + delay + 40);
    return element;
  };
  const burst = (className, x, y, count, {reach = 50, duration = 380, spread = Math.PI * 2, base = -Math.PI / 2, delay = 0, size = 1} = {}) => {
    const ring = spread >= Math.PI * 2;
    for (let i = 0; i < (full ? count : Math.min(count, 3)); i++) {
      const angle = ring ? base + (i / count) * Math.PI * 2 + (i % 2) * 0.2 : base + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0);
      const element = spawn(`cm-vfx ${className}`, x, y);
      const r = reach * (0.7 + ((i * 37) % 10) / 22);
      animate(element, [{opacity: 1, transform: `rotate(${angle}rad) translateX(0) scale(${size})`},
        {opacity: 0, transform: `rotate(${angle}rad) translateX(${r}px) scale(${size * 0.4})`}], {duration, delay, easing: 'cubic-bezier(.1,.7,.3,1)'});
      drop(element, duration + delay + 40);
    }
  };
  return {along, fade, drop, puff, burst};
}

// ------------------------------------------------------------------ styles
const STYLES = {
  // ---------------------------------------------------------------- melee
  strike: {
    impact(ctx, k) {
      const ring = ctx.spawn('cm-vfx cm-vfx--shock', ctx.to.x, ctx.to.y);
      ctx.animate(ring, [{opacity: 1, transform: 'scale(0.2)'}, {opacity: 0, transform: 'scale(1.8)'}], {duration: 360, easing: 'ease-out'});
      k.drop(ring, 400);
      k.burst('cm-vfx--streak', ctx.to.x, ctx.to.y, 8, {reach: 60});
      for (let i = 0; i < 3; i++) k.puff('cm-vfx--dust', ctx.ground.x + (i - 1) * 22, ctx.ground.y, {rise: 12, grow: 1.8, duration: 520, delay: i * 40});
    }
  },
  claw: {
    impact(ctx, k) {
      for (let i = 0; i < 3; i++) {
        const mark = ctx.spawn('cm-vfx cm-vfx--claw', ctx.to.x + (i - 1) * 16, ctx.to.y + (i - 1) * 6);
        ctx.animate(mark, [{opacity: 0, transform: 'rotate(-58deg) scaleX(0)'}, {opacity: 1, offset: 0.35, transform: 'rotate(-58deg) scaleX(1)'},
          {opacity: 0, transform: 'rotate(-58deg) scaleX(1.05) scaleY(0.3)'}], {duration: 320, delay: i * 45, easing: 'ease-out'});
        k.drop(mark, 420 + i * 45);
      }
      k.burst('cm-vfx--streak', ctx.to.x, ctx.to.y, 6, {reach: 46});
    }
  },
  slash: {
    impact(ctx, k) {
      for (let i = 0; i < 2; i++) {
        const arc = ctx.spawn('cm-vfx cm-vfx--crescent', ctx.to.x, ctx.to.y);
        const tilt = i ? 150 : -30;
        ctx.animate(arc, [{opacity: 0, transform: `rotate(${tilt - 70}deg) scale(0.6)`}, {opacity: 1, offset: 0.3, transform: `rotate(${tilt}deg) scale(1)`},
          {opacity: 0, transform: `rotate(${tilt + 40}deg) scale(1.15)`}], {duration: 340, delay: i * 90, easing: 'ease-out'});
        k.drop(arc, 460 + i * 90);
      }
      k.burst('cm-vfx--streak', ctx.to.x, ctx.to.y, 6, {reach: 52});
    }
  },
  pierce: {
    impact(ctx, k) {
      const thrust = ctx.spawn('cm-vfx cm-vfx--thrust', ctx.to.x - 40, ctx.to.y);
      ctx.animate(thrust, [{opacity: 0, transform: 'scaleX(0)'}, {opacity: 1, offset: 0.3, transform: 'scaleX(1)'}, {opacity: 0, transform: 'scaleX(1.2) scaleY(0.2)'}],
        {duration: 300, easing: 'ease-out'});
      k.drop(thrust, 340);
      k.burst('cm-vfx--streak', ctx.to.x + 18, ctx.to.y, 7, {reach: 58, spread: rad(70), base: 0});
    }
  },

  // ------------------------------------------------------- insect / plant
  vine: {
    travel(ctx, k) {
      // The ground splits under the dummy; vines rise and lash round it.
      const crack = ctx.spawn('cm-vfx cm-vfx--crack', ctx.ground.x, ctx.ground.y);
      ctx.animate(crack, [{opacity: 0, transform: 'scaleX(0.2)'}, {opacity: 1, transform: 'scaleX(1)'}], {duration: 160});
      k.drop(crack, 1300);
      const count = 2 + ctx.tier;
      for (let i = 0; i < count; i++) {
        const x = ctx.ground.x + (i - (count - 1) / 2) * 15;
        const vine = ctx.spawn('cm-vfx cm-vfx--vine', x, ctx.ground.y);
        const lean = (i - (count - 1) / 2) * 9;
        ctx.animate(vine, [{transform: `rotate(${lean}deg) scaleY(0)`}, {offset: 0.55, transform: `rotate(${lean * 1.4}deg) scaleY(1.08)`},
          {offset: 0.8, transform: `rotate(${-lean * 0.6}deg) scaleY(0.95)`}, {transform: `rotate(${lean * 0.3}deg) scaleY(1)`}],
          {duration: 300, delay: 80 + i * 40, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'both'});
        ctx.animate(vine, [{opacity: 1}, {opacity: 0}], {duration: 260, delay: 1000, fill: 'forwards'});
        k.drop(vine, 1300);
      }
      // One long whip from the caster's side cracks across the dummy.
      const whip = ctx.spawn('cm-vfx cm-vfx--whip', ctx.casterGround.x + 20, ctx.casterGround.y - 10);
      const reach = Math.hypot(ctx.to.x - ctx.casterGround.x, ctx.to.y - ctx.casterGround.y);
      whip.style.width = `${Math.round(reach)}px`;
      const aim = Math.atan2(ctx.to.y - ctx.casterGround.y + 10, ctx.to.x - ctx.casterGround.x - 20);
      ctx.animate(whip, [{opacity: 0, transform: `rotate(${aim - 0.9}rad) scaleX(0.1)`}, {opacity: 1, offset: 0.55, transform: `rotate(${aim - 0.25}rad) scaleX(0.85)`},
        {opacity: 1, offset: 0.85, transform: `rotate(${aim + 0.05}rad) scaleX(1)`}, {opacity: 0, transform: `rotate(${aim}rad) scaleX(1)`}], {duration: 420, delay: 0, easing: 'ease-in'});
      k.drop(whip, 460);
    },
    impact(ctx, k) {
      k.burst('cm-vfx--leafbit', ctx.to.x, ctx.to.y, 10, {reach: 64, duration: 620});
      const wrap = ctx.spawn('cm-vfx cm-vfx--wrap', ctx.to.x, ctx.to.y + 10);
      ctx.animate(wrap, [{opacity: 0, transform: 'scale(1.6) rotate(-40deg)'}, {opacity: 1, offset: 0.4, transform: 'scale(1) rotate(0deg)'}, {opacity: 0, transform: 'scale(0.9) rotate(20deg)'}],
        {duration: 640, easing: 'ease-out'});
      k.drop(wrap, 700);
    }
  },
  thorn: {
    travel(ctx, k) {
      const count = 3 + ctx.tier;
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 1;
        const x = ctx.casterGround.x + 40 + (ctx.ground.x - ctx.casterGround.x - 40) * t;
        const y = ctx.casterGround.y + (ctx.ground.y - ctx.casterGround.y) * t;
        const spike = ctx.spawn('cm-vfx cm-vfx--thorn', x, y);
        const size = 0.55 + t * 0.7;
        ctx.animate(spike, [{opacity: 0, transform: `scale(${size}, 0)`}, {opacity: 1, offset: 0.45, transform: `scale(${size}, ${size * 1.15})`},
          {opacity: 1, offset: 0.7, transform: `scale(${size}, ${size})`}, {opacity: 0, transform: `scale(${size}, ${size * 0.2})`}],
          {duration: 520, delay: t * 280, easing: 'ease-out'});
        k.drop(spike, 560 + t * 280);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 5; i++) {
        const spike = ctx.spawn('cm-vfx cm-vfx--thorn cm-vfx--thorn-big', ctx.ground.x + (i - 2) * 14, ctx.ground.y);
        const lean = (i - 2) * 16;
        ctx.animate(spike, [{opacity: 0, transform: `rotate(${lean}deg) scaleY(0)`}, {opacity: 1, offset: 0.3, transform: `rotate(${lean}deg) scaleY(1.2)`},
          {opacity: 0, transform: `rotate(${lean}deg) scaleY(0.4)`}], {duration: 560, delay: Math.abs(i - 2) * 40, easing: 'ease-out'});
        k.drop(spike, 640);
      }
      k.burst('cm-vfx--leafbit', ctx.to.x, ctx.to.y, 6, {reach: 40});
    }
  },
  leaf: {
    travel(ctx, k) {
      const count = 4 + ctx.tier * 2;
      for (let i = 0; i < count; i++) {
        const leaf = ctx.spawn('cm-vfx cm-vfx--leaf', ctx.from.x, ctx.from.y);
        const lift = ((i % 3) - 1) * 46 + 20;
        k.along(leaf, arcPoints(ctx.from, {x: ctx.to.x + ((i % 2) * 2 - 1) * 8, y: ctx.to.y + ((i % 4) - 1.5) * 9}, lift), 300,
          {spin: 9, delay: (i / count) * 120, easing: 'cubic-bezier(.3,0,.8,.6)', rotate: false});
        ctx.carry?.(leaf, i === 0);
        k.drop(leaf, 300 + 130);
      }
    },
    impact(ctx, k) {
      k.burst('cm-vfx--leafbit', ctx.to.x, ctx.to.y, 12, {reach: 70, duration: 640});
      const swirl = ctx.spawn('cm-vfx cm-vfx--swirl', ctx.to.x, ctx.to.y);
      ctx.animate(swirl, [{opacity: 0.9, transform: 'rotate(0deg) scale(0.6)'}, {opacity: 0, transform: 'rotate(260deg) scale(1.6)'}], {duration: 600, easing: 'ease-out'});
      k.drop(swirl, 640);
    }
  },
  seed: {
    travel(ctx, k) {
      const count = Math.min(3, 1 + Math.floor(ctx.tier / 2));
      for (let i = 0; i < count; i++) {
        const seed = ctx.spawn('cm-vfx cm-vfx--seed', ctx.from.x, ctx.from.y);
        k.along(seed, arcPoints(ctx.from, {x: ctx.ground.x + (i - (count - 1) / 2) * 20, y: ctx.ground.y - 6}, 90 + i * 16), 300, {spin: 8, delay: i * 30, rotate: false});
        ctx.carry?.(seed, i === 0);
        k.drop(seed, 340 + i * 30);
      }
    },
    impact(ctx, k) {
      // The seeds take root: sprouts burst up round the dummy.
      for (let i = 0; i < 4; i++) {
        const sprout = ctx.spawn('cm-vfx cm-vfx--vine cm-vfx--sprout', ctx.ground.x + (i - 1.5) * 16, ctx.ground.y);
        ctx.animate(sprout, [{opacity: 1, transform: `rotate(${(i - 1.5) * 14}deg) scaleY(0)`}, {opacity: 1, offset: 0.4, transform: `rotate(${(i - 1.5) * 18}deg) scaleY(1)`},
          {opacity: 0, transform: `rotate(${(i - 1.5) * 10}deg) scaleY(0.9)`}], {duration: 700, delay: i * 40, easing: 'ease-out'});
        k.drop(sprout, 760 + i * 40);
      }
      k.burst('cm-vfx--pollen', ctx.to.x, ctx.to.y, 12, {reach: 56, duration: 700});
    }
  },
  spore: {
    travel(ctx, k) {
      for (let i = 0; i < 3 + ctx.tier; i++) {
        const ball = ctx.spawn('cm-vfx cm-vfx--sporeball', ctx.from.x, ctx.from.y);
        k.along(ball, arcPoints(ctx.from, {x: ctx.to.x - 6 + i * 4, y: ctx.to.y + (i % 3 - 1) * 12}, (i % 2 ? 1 : -1) * 22), 300, {delay: i * 25, rotate: false, scale: [0.6, 1.3]});
        ctx.carry?.(ball, i === 0);
        k.drop(ball, 330 + i * 25);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 6; i++) k.puff('cm-vfx--cloud', ctx.to.x + (i % 3 - 1) * 22, ctx.to.y + (i < 3 ? -8 : 14), {rise: 26, grow: 2.4, duration: 900, delay: i * 50, drift: (i % 2 ? 1 : -1) * 10});
      k.burst('cm-vfx--pollen', ctx.to.x, ctx.to.y, 14, {reach: 60, duration: 900});
    }
  },

  // ----------------------------------------------------- machine ordnance
  missile: {
    travel(ctx, k) {
      const count = 1 + ctx.tier;
      for (let i = 0; i < count; i++) {
        const missile = ctx.spawn('cm-vfx cm-vfx--missile', ctx.from.x, ctx.from.y - 10);
        const target = {x: ctx.to.x + ((i % 3) - 1) * 12, y: ctx.to.y + ((i % 2) * 2 - 1) * 8};
        const points = arcPoints({x: ctx.from.x, y: ctx.from.y - 10}, target, 70 + (i % 3) * 30, 12);
        k.along(missile, points, 300 - i * 12, {delay: i * 22, easing: 'cubic-bezier(.45,0,.9,.8)'});
        ctx.carry?.(missile, i === 0);
        for (let s = 1; s <= 4; s++) {
          const p = points[s * 2];
          k.puff('cm-vfx--trail-smoke', p.x, p.y, {rise: 8, grow: 1.6, duration: 420, delay: i * 22 + s * 50});
        }
        k.drop(missile, 300 + i * 22);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 1 + ctx.tier; i++) {
        const blast = ctx.spawn('cm-vfx cm-vfx--blast', ctx.to.x + ((i % 3) - 1) * 16, ctx.to.y + ((i % 2) * 2 - 1) * 10);
        ctx.animate(blast, [{opacity: 1, transform: 'scale(0.2)'}, {opacity: 0.95, offset: 0.35, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(1.35)'}],
          {duration: 360, delay: i * 70, easing: 'ease-out'});
        k.drop(blast, 420 + i * 70);
      }
      for (let i = 0; i < 5; i++) k.puff('cm-vfx--smoke', ctx.to.x + (i - 2) * 14, ctx.to.y - 4, {rise: 44, grow: 2.6, duration: 1000, delay: 120 + i * 50, drift: (i - 2) * 6});
      k.burst('cm-vfx--debris', ctx.to.x, ctx.to.y, 9, {reach: 70, duration: 520});
    }
  },
  gatling: {
    travel(ctx, k) {
      const count = 6 + ctx.tier * 2;
      const muzzle = ctx.spawn('cm-vfx cm-vfx--muzzle', ctx.from.x + 10, ctx.from.y);
      ctx.animate(muzzle, [{opacity: 1, transform: 'scale(1)'}, {opacity: 0.4, transform: 'scale(0.7)'}], {duration: 60, iterations: Math.ceil(300 / 60)});
      k.drop(muzzle, 320);
      for (let i = 0; i < count; i++) {
        const bullet = ctx.spawn('cm-vfx cm-vfx--bullet', ctx.from.x + 10, ctx.from.y);
        const target = {x: ctx.to.x, y: ctx.to.y + (((i * 7) % 5) - 2) * 7};
        k.along(bullet, arcPoints({x: ctx.from.x + 10, y: ctx.from.y}, target, 0, 2), 110, {delay: (i / count) * 260});
        if (i === 0) ctx.carry?.(bullet, true);
        k.drop(bullet, 110 + (i / count) * 260 + 20);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 6; i++) {
        const spark = ctx.spawn('cm-vfx cm-vfx--blast cm-vfx--blast-small', ctx.to.x + ((i * 13) % 30) - 15, ctx.to.y + ((i * 7) % 24) - 12);
        ctx.animate(spark, [{opacity: 1, transform: 'scale(0.3)'}, {opacity: 0, transform: 'scale(1.2)'}], {duration: 200, delay: i * 50});
        k.drop(spark, 260 + i * 50);
      }
      k.puff('cm-vfx--smoke', ctx.to.x, ctx.to.y, {rise: 30, grow: 2, duration: 800, delay: 200});
    }
  },
  shell: {
    travel(ctx, k) {
      const shell = ctx.spawn('cm-vfx cm-vfx--shell', ctx.from.x, ctx.from.y - 12);
      k.along(shell, arcPoints({x: ctx.from.x, y: ctx.from.y - 12}, ctx.to, 130, 12), 300, {easing: 'cubic-bezier(.35,0,.75,.75)'});
      ctx.carry?.(shell, true);
      k.drop(shell, 300);
      k.puff('cm-vfx--trail-smoke', ctx.from.x + 8, ctx.from.y - 16, {rise: 18, grow: 2.4, duration: 600});
    },
    impact(ctx, k) {
      const blast = ctx.spawn('cm-vfx cm-vfx--blast cm-vfx--blast-big', ctx.to.x, ctx.to.y);
      ctx.animate(blast, [{opacity: 1, transform: 'scale(0.2)'}, {opacity: 1, offset: 0.3, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(1.4)'}], {duration: 520, easing: 'ease-out'});
      k.drop(blast, 560);
      const ring = ctx.spawn('cm-vfx cm-vfx--shock', ctx.ground.x, ctx.ground.y);
      ctx.animate(ring, [{opacity: 1, transform: 'scale(0.3, 0.12)'}, {opacity: 0, transform: 'scale(3, 0.9)'}], {duration: 520, easing: 'ease-out'});
      k.drop(ring, 560);
      for (let i = 0; i < 7; i++) k.puff('cm-vfx--smoke', ctx.to.x + (i - 3) * 12, ctx.to.y - 6, {rise: 70, grow: 3, duration: 1200, delay: 80 + i * 40, drift: (i - 3) * 7});
      k.burst('cm-vfx--debris', ctx.to.x, ctx.to.y, 12, {reach: 90, duration: 640});
    }
  },

  // ------------------------------------------------------------- elements
  fireball: {
    travel(ctx, k) {
      const count = ctx.tier >= 4 ? 3 : ctx.tier >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const ball = ctx.spawn('cm-vfx cm-vfx--fireball', ctx.from.x, ctx.from.y);
        const points = arcPoints(ctx.from, {x: ctx.to.x, y: ctx.to.y + (i - (count - 1) / 2) * 14}, 26 + i * 18, 10);
        k.along(ball, points, 280, {delay: i * 30, easing: 'cubic-bezier(.4,0,.9,.7)'});
        ctx.carry?.(ball, i === 0);
        for (let s = 2; s < 10; s += 2) k.puff('cm-vfx--ember', points[s].x, points[s].y, {rise: 14, grow: 0.6, duration: 360, delay: i * 30 + s * 26});
        k.drop(ball, 280 + i * 30);
      }
    },
    impact(ctx, k) {
      const blast = ctx.spawn('cm-vfx cm-vfx--blast', ctx.to.x, ctx.to.y);
      ctx.animate(blast, [{opacity: 1, transform: 'scale(0.3)'}, {opacity: 0, transform: 'scale(1.5)'}], {duration: 420, easing: 'ease-out'});
      k.drop(blast, 460);
      for (let i = 0; i < 4; i++) k.puff('cm-vfx--flamelet', ctx.ground.x + (i - 1.5) * 16, ctx.ground.y, {rise: 46, grow: 1.4, duration: 700, delay: i * 50});
      k.burst('cm-vfx--ember', ctx.to.x, ctx.to.y, 10, {reach: 60});
    }
  },
  flame: {
    travel(ctx, k) {
      const cone = ctx.spawn('cm-vfx cm-vfx--flame', ctx.from.x, ctx.from.y);
      const length = Math.hypot(ctx.to.x - ctx.from.x, ctx.to.y - ctx.from.y) + 30;
      cone.style.width = `${Math.round(length)}px`;
      const angle = Math.atan2(ctx.to.y - ctx.from.y, ctx.to.x - ctx.from.x);
      ctx.animate(cone, [{opacity: 0, transform: `rotate(${angle}rad) scaleX(0) scaleY(0.4)`}, {opacity: 1, offset: 0.35, transform: `rotate(${angle}rad) scaleX(1) scaleY(1)`},
        {opacity: 1, offset: 0.55, transform: `rotate(${angle}rad) scaleX(1) scaleY(0.82)`}, {opacity: 1, offset: 0.75, transform: `rotate(${angle}rad) scaleX(1) scaleY(1.1)`},
        {opacity: 0, transform: `rotate(${angle}rad) scaleX(1.04) scaleY(0.5)`}], {duration: 720, easing: 'linear'});
      k.drop(cone, 760);
      for (let i = 0; i < 8; i++) {
        const t = (i + 1) / 9;
        k.puff('cm-vfx--ember', ctx.from.x + (ctx.to.x - ctx.from.x) * t, ctx.from.y + (ctx.to.y - ctx.from.y) * t, {rise: 22, grow: 0.5, duration: 420, delay: 120 + i * 30});
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 5; i++) k.puff('cm-vfx--flamelet', ctx.ground.x + (i - 2) * 14, ctx.ground.y, {rise: 54, grow: 1.5, duration: 760, delay: i * 40});
      k.burst('cm-vfx--ember', ctx.to.x, ctx.to.y, 12, {reach: 64});
    }
  },
  water: {
    travel(ctx, k) {
      for (let i = 0; i < 10; i++) {
        const drop = ctx.spawn('cm-vfx cm-vfx--droplet', ctx.from.x, ctx.from.y);
        const wave = Math.sin(i * 1.3) * 14;
        k.along(drop, arcPoints(ctx.from, ctx.to, wave, 4), 220, {delay: i * 9, scale: [0.6, 1.2], rotate: false});
        if (i === 0) ctx.carry?.(drop, true);
        k.drop(drop, 240 + i * 9);
      }
      const jet = ctx.spawn('cm-vfx cm-vfx--jet', ctx.from.x, ctx.from.y);
      jet.style.width = `${Math.round(Math.hypot(ctx.to.x - ctx.from.x, ctx.to.y - ctx.from.y))}px`;
      const angle = Math.atan2(ctx.to.y - ctx.from.y, ctx.to.x - ctx.from.x);
      ctx.animate(jet, [{opacity: 0, transform: `rotate(${angle}rad) scaleX(0)`}, {opacity: 0.9, offset: 0.5, transform: `rotate(${angle}rad) scaleX(1)`},
        {opacity: 0, transform: `rotate(${angle}rad) scaleX(1) scaleY(0.3)`}], {duration: 520, easing: 'ease-out'});
      k.drop(jet, 560);
    },
    impact(ctx, k) {
      for (let i = 0; i < 10; i++) {
        const drop = ctx.spawn('cm-vfx cm-vfx--droplet', ctx.to.x, ctx.to.y);
        const dx = (i - 4.5) * 9;
        k.along(drop, arcPoints(ctx.to, {x: ctx.to.x + dx, y: ctx.ground.y}, 40 + (i % 3) * 14, 6), 520, {delay: i * 10, rotate: false, scale: [1, 0.5]});
        k.drop(drop, 560 + i * 10);
      }
      const ring = ctx.spawn('cm-vfx cm-vfx--ripple', ctx.ground.x, ctx.ground.y);
      ctx.animate(ring, [{opacity: 1, transform: 'scale(0.2, 0.08)'}, {opacity: 0, transform: 'scale(2.2, 0.7)'}], {duration: 620, easing: 'ease-out'});
      k.drop(ring, 660);
    }
  },
  ice: {
    travel(ctx, k) {
      const count = 2 + ctx.tier;
      for (let i = 0; i < count; i++) {
        const shard = ctx.spawn('cm-vfx cm-vfx--shard', ctx.from.x, ctx.from.y + (i - (count - 1) / 2) * 8);
        k.along(shard, arcPoints({x: ctx.from.x, y: ctx.from.y + (i - (count - 1) / 2) * 8}, {x: ctx.to.x, y: ctx.to.y + (i - (count - 1) / 2) * 6}, 6, 2), 240, {delay: i * 22, easing: 'ease-in'});
        ctx.carry?.(shard, i === 0);
        k.drop(shard, 260 + i * 22);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 5; i++) {
        const spike = ctx.spawn('cm-vfx cm-vfx--icespike', ctx.ground.x + (i - 2) * 15, ctx.ground.y);
        ctx.animate(spike, [{opacity: 0, transform: `rotate(${(i - 2) * 12}deg) scaleY(0)`}, {opacity: 1, offset: 0.25, transform: `rotate(${(i - 2) * 12}deg) scaleY(1.1)`},
          {opacity: 1, offset: 0.7, transform: `rotate(${(i - 2) * 12}deg) scaleY(1)`}, {opacity: 0, transform: `rotate(${(i - 2) * 12}deg) scaleY(1)`}], {duration: 820, delay: Math.abs(i - 2) * 50});
        k.drop(spike, 900);
      }
      k.burst('cm-vfx--frost', ctx.to.x, ctx.to.y, 10, {reach: 56, duration: 600});
    }
  },
  thunder: {
    travel(ctx, k) {
      const cloud = ctx.spawn('cm-vfx cm-vfx--thundercloud', ctx.to.x, 14);
      ctx.animate(cloud, [{opacity: 0, transform: 'scale(0.6)'}, {opacity: 1, offset: 0.4, transform: 'scale(1)'}, {opacity: 1, offset: 0.8}, {opacity: 0, transform: 'scale(1.1)'}],
        {duration: 900, easing: 'ease-out'});
      k.drop(cloud, 940);
      ctx.later(200, () => {
        for (let i = 0; i < 2 + Math.min(2, ctx.tier - 1); i++) {
          const bolt = ctx.spawn('cm-vfx cm-vfx--bolt', ctx.to.x + (i ? ((i % 2) * 2 - 1) * 18 : 0), 18);
          bolt.style.height = `${Math.max(40, Math.round(ctx.to.y - 18))}px`;
          if (i % 2) bolt.style.transform = 'scaleX(-1)';
          ctx.animate(bolt, [{opacity: 0}, {opacity: 1, offset: 0.1}, {opacity: 0.2, offset: 0.3}, {opacity: 1, offset: 0.45}, {opacity: 0.1, offset: 0.7}, {opacity: 1, offset: 0.8}, {opacity: 0}],
            {duration: 380, delay: i * 50});
          k.drop(bolt, 440 + i * 50);
        }
      });
    },
    impact(ctx, k) {
      k.burst('cm-vfx--zap', ctx.to.x, ctx.to.y, 10, {reach: 62, duration: 420});
      const flash = ctx.spawn('cm-vfx cm-vfx--blast', ctx.to.x, ctx.to.y);
      ctx.animate(flash, [{opacity: 1, transform: 'scale(0.4)'}, {opacity: 0, transform: 'scale(1.3)'}], {duration: 300});
      k.drop(flash, 340);
    }
  },
  quake: {
    travel(ctx, k) {
      const crack = ctx.spawn('cm-vfx cm-vfx--fissure', ctx.casterGround.x + 30, ctx.casterGround.y);
      const length = ctx.ground.x - ctx.casterGround.x - 30;
      crack.style.width = `${Math.max(20, Math.round(length))}px`;
      ctx.animate(crack, [{opacity: 1, transform: 'scaleX(0)'}, {opacity: 1, offset: 0.4, transform: 'scaleX(1)'}, {opacity: 0, transform: 'scaleX(1)'}], {duration: 900, easing: 'ease-out'});
      k.drop(crack, 940);
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 5;
        k.puff('cm-vfx--dust', ctx.casterGround.x + 30 + length * t, ctx.casterGround.y, {rise: 18, grow: 1.6, duration: 480, delay: t * 260});
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 3 + ctx.tier; i++) {
        const rock = ctx.spawn('cm-vfx cm-vfx--rockspike', ctx.ground.x + (i - (2 + ctx.tier) / 2) * 13, ctx.ground.y);
        const lean = (i - (2 + ctx.tier) / 2) * 10;
        ctx.animate(rock, [{opacity: 1, transform: `rotate(${lean}deg) scaleY(0)`}, {opacity: 1, offset: 0.2, transform: `rotate(${lean}deg) scaleY(1.15)`},
          {opacity: 1, offset: 0.7, transform: `rotate(${lean}deg) scaleY(1)`}, {opacity: 0, transform: `rotate(${lean}deg) scaleY(0.6)`}], {duration: 820, delay: i * 30});
        k.drop(rock, 880);
      }
      k.burst('cm-vfx--debris', ctx.to.x, ctx.ground.y - 10, 12, {reach: 80, spread: rad(150), duration: 620});
      for (let i = 0; i < 3; i++) k.puff('cm-vfx--dust', ctx.ground.x + (i - 1) * 24, ctx.ground.y, {rise: 22, grow: 2.4, duration: 800, delay: 60 + i * 40});
    }
  },
  wind: {
    travel(ctx, k) {
      const twister = ctx.spawn('cm-vfx cm-vfx--tornado', ctx.casterGround.x + 30, ctx.casterGround.y);
      for (let i = 0; i < 4; i++) twister.append(ctx.doc.createElement('i'));
      ctx.animate(twister, [{opacity: 0, transform: 'translateX(0) scale(0.5)'}, {opacity: 1, offset: 0.2, transform: 'translateX(0) scale(0.8)'},
        {opacity: 1, transform: `translateX(${Math.round(ctx.ground.x - ctx.casterGround.x - 30)}px) scale(1.1)`}], {duration: 300, easing: 'ease-in'});
      ctx.animate(twister, [{opacity: 1}, {opacity: 0}], {duration: 300, delay: 600, fill: 'forwards'});
      k.drop(twister, 940);
      ctx.carry?.(twister, true);
    },
    impact(ctx, k) {
      k.burst('cm-vfx--gust', ctx.to.x, ctx.to.y, 10, {reach: 70, duration: 520});
      const swirl = ctx.spawn('cm-vfx cm-vfx--swirl', ctx.to.x, ctx.to.y);
      ctx.animate(swirl, [{opacity: 1, transform: 'rotate(0deg) scale(0.5)'}, {opacity: 0, transform: 'rotate(-320deg) scale(1.5)'}], {duration: 640, easing: 'ease-out'});
      k.drop(swirl, 680);
    }
  },
  holy: {
    travel(ctx, k) {
      const pillar = ctx.spawn('cm-vfx cm-vfx--lightpillar', ctx.ground.x, ctx.ground.y);
      ctx.animate(pillar, [{opacity: 0, transform: 'scaleX(0.1)'}, {opacity: 1, offset: 0.35, transform: 'scaleX(1)'}, {opacity: 1, offset: 0.7, transform: 'scaleX(0.8)'},
        {opacity: 0, transform: 'scaleX(0.2)'}], {duration: 880, easing: 'ease-out'});
      k.drop(pillar, 920);
      for (let i = 0; i < 2 + ctx.tier; i++) {
        const arrow = ctx.spawn('cm-vfx cm-vfx--lightarrow', ctx.to.x + (i - (1 + ctx.tier) / 2) * 16, 0);
        ctx.animate(arrow, [{opacity: 0, transform: 'translateY(0)'}, {opacity: 1, offset: 0.3}, {opacity: 1, transform: `translateY(${Math.round(ctx.to.y)}px)`}],
          {duration: 260, delay: 40 + i * 30, easing: 'ease-in'});
        k.drop(arrow, 320 + i * 30);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 2; i++) {
        const ring = ctx.spawn('cm-vfx cm-vfx--halo', ctx.ground.x, ctx.ground.y);
        ctx.animate(ring, [{opacity: 1, transform: 'scale(0.2, 0.08)'}, {opacity: 0, transform: 'scale(2.2, 0.7)'}], {duration: 600, delay: i * 120, easing: 'ease-out'});
        k.drop(ring, 760);
      }
      k.burst('cm-vfx--sparkle', ctx.to.x, ctx.to.y, 12, {reach: 64, duration: 700});
    }
  },
  dark: {
    travel(ctx, k) {
      const orb = ctx.spawn('cm-vfx cm-vfx--darkorb', ctx.from.x, ctx.from.y);
      k.along(orb, arcPoints(ctx.from, ctx.to, 18, 8), 300, {scale: [0.5, 1.4], rotate: false, easing: 'cubic-bezier(.5,0,.8,.6)'});
      ctx.carry?.(orb, true);
      k.drop(orb, 300);
      for (let i = 0; i < 5; i++) k.puff('cm-vfx--shade', ctx.from.x + (ctx.to.x - ctx.from.x) * (i / 5), ctx.from.y + (ctx.to.y - ctx.from.y) * (i / 5), {rise: 10, grow: 1.8, duration: 500, delay: i * 50});
    },
    impact(ctx, k) {
      const void_ = ctx.spawn('cm-vfx cm-vfx--void', ctx.to.x, ctx.to.y);
      ctx.animate(void_, [{opacity: 0, transform: 'scale(1.8) rotate(0deg)'}, {opacity: 1, offset: 0.4, transform: 'scale(0.5) rotate(120deg)'}, {opacity: 0, transform: 'scale(2) rotate(200deg)'}],
        {duration: 700, easing: 'ease-in-out'});
      k.drop(void_, 740);
      k.burst('cm-vfx--shadebit', ctx.to.x, ctx.to.y, 12, {reach: 66, duration: 620, delay: 260});
    }
  },
  sound: {
    travel(ctx, k) {
      const angle = Math.atan2(ctx.to.y - ctx.from.y, ctx.to.x - ctx.from.x);
      for (let i = 0; i < 5; i++) {
        const ring = ctx.spawn('cm-vfx cm-vfx--soundring', ctx.from.x, ctx.from.y);
        ctx.animate(ring, [{opacity: 0.9, transform: `translate(0, 0) rotate(${angle}rad) scale(0.4)`},
          {opacity: 0, transform: `translate(${ctx.to.x - ctx.from.x}px, ${ctx.to.y - ctx.from.y}px) rotate(${angle}rad) scale(1.6)`}], {duration: 300, delay: i * 50, easing: 'linear'});
        k.drop(ring, 360 + i * 50);
      }
    },
    impact(ctx, k) {
      for (let i = 0; i < 3; i++) {
        const ring = ctx.spawn('cm-vfx cm-vfx--soundring', ctx.to.x, ctx.to.y);
        ctx.animate(ring, [{opacity: 1, transform: 'scale(0.3)'}, {opacity: 0, transform: 'scale(2.4)'}], {duration: 520, delay: i * 90, easing: 'ease-out'});
        k.drop(ring, 620 + i * 90);
      }
      k.burst('cm-vfx--note', ctx.to.x, ctx.to.y, 6, {reach: 60, duration: 760});
    }
  },
  beam: {
    travel(ctx, k) {
      const beam = ctx.spawn('cm-showcase__beam', ctx.from.x, ctx.from.y);
      const dx = ctx.to.x - ctx.from.x, dy = ctx.to.y - ctx.from.y, angle = Math.atan2(dy, dx);
      beam.style.width = `${Math.round(Math.hypot(dx, dy))}px`;
      ctx.animate(beam, [{opacity: 0, transform: `rotate(${angle}rad) scaleX(0)`}, {opacity: 1, offset: 0.35, transform: `rotate(${angle}rad) scaleX(1)`},
        {opacity: 1, offset: 0.8, transform: `rotate(${angle}rad) scaleX(1) scaleY(0.8)`}, {opacity: 0, transform: `rotate(${angle}rad) scaleX(1) scaleY(0.1)`}],
        {duration: 520, easing: 'ease-out'});
      k.drop(beam, 560);
    },
    impact(ctx, k) {
      k.burst('cm-vfx--streak', ctx.to.x, ctx.to.y, 10, {reach: 70});
    }
  }
};

/** Run one style's beat. Unknown styles fall back to the plain strike/orb. */
export function playShowcaseStyle(beat, style, ctx) {
  const player = STYLES[style] ?? STYLES.strike;
  const run = player[beat];
  if (typeof run !== 'function') return false;
  run(ctx, kit(ctx));
  return true;
}
export const SHOWCASE_STYLE_NAMES = Object.freeze(Object.keys(STYLES));
