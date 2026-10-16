// Data Arena -- original procedural textures, generated once per mount.
//
// No image files: every texture below is drawn to a canvas when the arena
// mounts and destroyed when it leaves, so the mode adds no download and no
// asset-rights question. Shots draw their hit radius as the solid, outlined
// core; glow is a separate soft sprite, so what you see is what collides.

const TAU = Math.PI * 2;

function canvas(width, height) {
  const element = globalThis.document?.createElement?.("canvas");
  if (!element) return null;
  element.width = width; element.height = height;
  return element.getContext("2d") ? element : null;
}

export function createDataArenaTextures(PIXI) {
  if (!canvas(1, 1)) return null;
  const owned = [];
  const make = (width, height, draw, { nearest = false } = {}) => {
    const element = canvas(width, height), ctx = element.getContext("2d");
    draw(ctx, width, height);
    const texture = PIXI.Texture.from(element);
    if (nearest) texture.source.scaleMode = "nearest";
    owned.push(texture);
    return texture;
  };
  const radial = (size, stops) => make(size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  });

  // A disc whose solid core radius is `core` px inside a `size` canvas.
  const shotCore = (size, core, fill, rim, highlight) => make(size, size, (ctx) => {
    const c = size / 2;
    ctx.beginPath(); ctx.arc(c, c, core, 0, TAU); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = Math.max(1.5, core * 0.22); ctx.strokeStyle = rim; ctx.stroke();
    ctx.beginPath(); ctx.arc(c - core * 0.25, c - core * 0.25, core * 0.42, 0, TAU); ctx.fillStyle = highlight; ctx.fill();
  });
  const drawIce=(ctx,cracked=false)=>{
    const fill=ctx.createLinearGradient(0,0,64,64);fill.addColorStop(0,'rgba(215,247,255,.96)');fill.addColorStop(.5,'rgba(106,198,230,.92)');fill.addColorStop(1,'rgba(176,228,246,.96)');
    ctx.fillStyle=fill;ctx.fillRect(0,0,64,64);ctx.strokeStyle='rgba(225,252,255,.95)';ctx.lineWidth=2;ctx.strokeRect(1,1,62,62);
    ctx.lineWidth=cracked?2.4:1;ctx.strokeStyle=cracked?'rgba(18,69,90,.9)':'rgba(230,252,255,.65)';
    ctx.beginPath();ctx.moveTo(1,25);ctx.lineTo(21,31);ctx.lineTo(34,19);ctx.lineTo(43,40);ctx.lineTo(63,47);ctx.moveTo(34,19);ctx.lineTo(45,1);ctx.moveTo(43,40);ctx.lineTo(32,63);ctx.stroke();
  };
  const drawScorch=ctx=>{
    const g=ctx.createRadialGradient(32,32,4,32,32,31);g.addColorStop(0,'rgba(24,15,9,.8)');g.addColorStop(.6,'rgba(40,25,14,.50)');g.addColorStop(1,'rgba(36,26,18,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    ctx.strokeStyle='rgba(12,9,6,.55)';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(10+i*8,25+(i%3)*5);ctx.lineTo(13+i*7,42+(i%2)*3);ctx.stroke();}
  };

  const textures = {
    glow: radial(64, [[0, "rgba(255,255,255,0.9)"], [0.35, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]),
    soft: radial(64, [[0, "rgba(255,255,255,0.7)"], [0.6, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]]),
    shadow: make(64, 32, (ctx) => {
      const g = ctx.createRadialGradient(32, 16, 2, 32, 16, 32);
      g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.scale(1, 0.5); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 32, 0, TAU); ctx.fill(); ctx.restore();
    }),
    dot: make(4, 4, (ctx) => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 4, 4); }, { nearest: true }),
    spark: make(12, 3, (ctx) => { const g = ctx.createLinearGradient(0, 0, 12, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "#fff"); ctx.fillStyle = g; ctx.fillRect(0, 0, 12, 3); }),
    shard: make(8, 8, (ctx) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(8, 4); ctx.lineTo(4, 8); ctx.lineTo(0, 4); ctx.fill(); }),
    ring: make(128, 128, (ctx) => { ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(64, 64, 58, 0, TAU); ctx.stroke(); }),
    beamCore: make(4, 32, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 32);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.35, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "#fff");
      g.addColorStop(0.65, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 32);
    }),
    beamGlow: make(4, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64);
    }),
    // Shots: solid cores at the exact collision radius (size/2 canvas scale 1).
    emberShot: shotCore(32, 9, "#ffb347", "#7a2300", "#fff4c2"),
    orb: make(32, 32, (ctx) => {
      ctx.beginPath(); ctx.arc(16, 16, 10, 0, TAU); ctx.fillStyle = "rgba(255,92,214,0.35)"; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#ff5cd6"; ctx.stroke();
      ctx.beginPath(); ctx.arc(16, 16, 4, 0, TAU); ctx.fillStyle = "#fff"; ctx.fill();
    }),
    shardShot: make(40, 40, (ctx) => {
      ctx.beginPath(); ctx.moveTo(20, 6); ctx.lineTo(33, 20); ctx.lineTo(20, 34); ctx.lineTo(7, 20); ctx.closePath();
      ctx.fillStyle = "#2a1145"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#e9d8ff"; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, 12); ctx.lineTo(26, 20); ctx.lineTo(20, 28); ctx.lineTo(14, 20); ctx.closePath(); ctx.fillStyle = "#8f5bff"; ctx.fill();
    }),
    tide: shotCore(32, 9, "#7fe9ff", "#0b5c8a", "#ffffff"),
    // Player skill shot: a bright capsule whose round head is the 9 px hit radius.
    bolt: make(48, 32, (ctx) => {
      const g = ctx.createLinearGradient(0, 16, 48, 16); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.55, "rgba(255,255,255,0.75)"); g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(4, 13); ctx.lineTo(30, 9); ctx.arc(30, 16, 7, -Math.PI / 2, Math.PI / 2); ctx.lineTo(4, 19); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(32, 16, 9, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
    }),
    pickup: make(20, 20, (ctx) => {
      ctx.beginPath(); ctx.moveTo(10, 1); ctx.lineTo(18, 10); ctx.lineTo(10, 19); ctx.lineTo(2, 10); ctx.closePath();
      ctx.fillStyle = "#5ff3ff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#e9ffff"; ctx.stroke();
    }),
    // Cell effects (64 px tiles).
    flame: [0, 1, 2, 3].map((variant) => make(64, 80, (ctx) => {
      const tongue = (x, h, w, color) => {
        const bend=Math.sin(variant*Math.PI/2+x)*w*.34,top=76-h;
        ctx.beginPath();ctx.moveTo(x-w,72);
        ctx.bezierCurveTo(x-w*1.15,55,x+w*.2,top+h*.43,x+bend,top);
        ctx.bezierCurveTo(x+w*.82+bend,top+h*.36,x+w*.2,top+h*.43,x+w*.77,top+h*.62);
        ctx.bezierCurveTo(x+w*1.5,68,x+w*.55,78,x,78);
        ctx.bezierCurveTo(x-w*.6,78,x-w*.92,76,x-w,72);
        ctx.closePath();ctx.fillStyle=color;ctx.fill();
      };
      const glow=ctx.createRadialGradient(32,68,2,32,63,28);
      glow.addColorStop(0,'rgba(255,143,32,.32)');glow.addColorStop(1,'rgba(255,70,12,0)');ctx.fillStyle=glow;ctx.fillRect(0,36,64,44);
      tongue(32,48,20,'rgba(235,71,17,.72)');tongue(20+Math.sin(variant)*3,34,11,'rgba(255,127,30,.78)');
      tongue(43-Math.cos(variant)*3,39,10,'rgba(255,147,42,.82)');tongue(31,27,10,'rgba(255,218,122,.9)');
    })),
    iceCracked:make(64,64,ctx=>drawIce(ctx,true)),
    iceMelt:make(64,64,ctx=>{ctx.fillStyle='rgba(150,222,245,.7)';for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(8+i*6,14+(i%3)*11);ctx.lineTo(17+i*4,19+(i%3)*11);ctx.lineTo(10+i*6,27+(i%3)*10);ctx.closePath();ctx.fill();}}),
    scorchWet:make(64,64,ctx=>{drawScorch(ctx);const g=ctx.createRadialGradient(30,34,1,30,34,27);g.addColorStop(0,'rgba(63,146,170,.23)');g.addColorStop(1,'rgba(63,146,170,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);}),
    timberChip:make(24,8,ctx=>{ctx.fillStyle='#b28850';ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(21,0);ctx.lineTo(24,5);ctx.lineTo(3,8);ctx.closePath();ctx.fill();ctx.strokeStyle='#4f3821';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(3,4);ctx.lineTo(20,3);ctx.stroke();}),
    ice: make(64, 64, (ctx) => {
      ctx.fillStyle = "rgba(196,240,255,0.88)"; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 62, 62);
      ctx.strokeStyle = "rgba(120,200,235,0.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(8, 50); ctx.lineTo(26, 30); ctx.lineTo(40, 36); ctx.moveTo(30, 8); ctx.lineTo(44, 22); ctx.lineTo(58, 18); ctx.stroke();
    }),
    crack: make(64, 64, (ctx) => {
      ctx.strokeStyle = "rgba(20,40,70,0.95)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(4, 30); ctx.lineTo(20, 26); ctx.lineTo(30, 38); ctx.lineTo(46, 30); ctx.lineTo(60, 36);
      ctx.moveTo(30, 38); ctx.lineTo(26, 58); ctx.moveTo(20, 26); ctx.lineTo(24, 6); ctx.stroke();
    }),
    wet: make(64, 64, (ctx) => {
      // Soft, overlapping puddles: wet plating reads as a sheen, not a tile grid.
      for (const [x, y, rx, ry] of [[22, 26, 22, 14], [42, 40, 20, 13], [30, 48, 14, 9]]) {
        const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
        g.addColorStop(0, "rgba(70,150,200,0.26)"); g.addColorStop(1, "rgba(70,150,200,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
      }
    }),
    ash: make(64, 64, drawScorch),
    water: make(256, 128, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#0d4f7a"); g.addColorStop(1, "#0a3a60");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = "rgba(120,220,255,0.28)"; ctx.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 8) { const y = 16 + row * 32 + Math.sin((x / 256) * TAU * 2 + row) * 5; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(160,240,255,0.18)";
      for (let i = 0; i < 18; i++) ctx.fillRect((i * 53) % 256, (i * 37) % 128, 10, 2);
    }),
    // Enemies: original "noise" creatures of corrupted feeling-data.
    noise: make(56, 56, (ctx) => {
      ctx.fillStyle = "#1b0f2e"; ctx.beginPath(); ctx.roundRect(8, 12, 40, 36, 10); ctx.fill();
      ctx.fillStyle = "#ff3fa4"; ctx.fillRect(10, 18, 12, 4); ctx.fillStyle = "#3ff6ff"; ctx.fillRect(34, 40, 12, 4);
      ctx.strokeStyle = "#ff8ad0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(8, 12, 40, 36, 10); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(28, 30, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ff2f7d"; ctx.beginPath(); ctx.arc(26, 30, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = "#1b0f2e"; ctx.fillRect(14, 48, 6, 6); ctx.fillRect(36, 48, 6, 6);
    }),
    ember: make(56, 64, (ctx) => {
      ctx.beginPath(); ctx.moveTo(28, 2); ctx.quadraticCurveTo(52, 30, 44, 50); ctx.quadraticCurveTo(28, 64, 12, 50); ctx.quadraticCurveTo(4, 30, 28, 2);
      ctx.fillStyle = "#ff6a1a"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#5a1400"; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(28, 18); ctx.quadraticCurveTo(40, 36, 34, 48); ctx.quadraticCurveTo(28, 54, 22, 48); ctx.quadraticCurveTo(16, 36, 28, 18);
      ctx.fillStyle = "#ffd36b"; ctx.fill();
      ctx.fillStyle = "#2b0800"; ctx.fillRect(20, 36, 5, 6); ctx.fillRect(31, 36, 5, 6);
    }),
    sentinel: make(64, 72, (ctx) => {
      ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(60, 34); ctx.lineTo(32, 70); ctx.lineTo(4, 34); ctx.closePath();
      ctx.fillStyle = "#24103d"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#cfb6ff"; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 14); ctx.lineTo(48, 34); ctx.lineTo(32, 56); ctx.lineTo(16, 34); ctx.closePath(); ctx.fillStyle = "#6b3cff"; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(32, 32, 6, 0, TAU); ctx.fill();
    }),
    // Fallback silhouettes when no approved creature art is available here.
    fallback: Object.fromEntries([["PLAYER", "#ff9a3c"], ["MATE", "#4fd6ff"], ["BOSS", "#7a5cff"]].map(([role, color]) => [role, make(96, 96, (ctx) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(48, 60, 34, 28, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, 36, 18, 16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(48, 60, 34, 28, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(24, 34, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(23, 34, 2.5, 0, TAU); ctx.fill();
    })])),
    // Crowd: four spectator silhouettes with a light-catching rim.
    fans: ["#2f3f66", "#3d2f5e", "#264d57", "#4a3550"].map((color, i) => make(16, 24, (ctx) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(8, 6, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.roundRect(2, 11, 12, 13, 4); ctx.fill();
      ctx.fillStyle = ["#7fd7ff", "#ff9bd6", "#9cffc1", "#ffd27f"][i]; ctx.fillRect(2, 13, 12, 2);
    })),
    lightCone: make(64, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(38, 0); ctx.lineTo(64, 256); ctx.lineTo(0, 256); ctx.closePath(); ctx.fill();
    }),
    wave: make(96, 48, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 96, 0); g.addColorStop(0, "rgba(120,230,255,0)"); g.addColorStop(0.7, "rgba(150,240,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0.95)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(48, 24, 46, 22, 0, 0, TAU); ctx.fill();
    }),
    arrow: make(32, 32, (ctx) => {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(30, 16); ctx.lineTo(6, 4); ctx.lineTo(12, 16); ctx.lineTo(6, 28); ctx.closePath(); ctx.fill();
    })
  };
  return Object.freeze({
    ...textures,
    destroy() { for (const texture of owned.splice(0)) texture.destroy(true); }
  });
}
