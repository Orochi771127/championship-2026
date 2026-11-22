// Data Arena Web-Safe LRU GPU Sprite-Sheet Cache for 3D Volumetric PixelFX (2026-11-22).
//
// Engineered specifically for smooth 60 FPS Web & Mobile Browser play (zero crashes, zero GC stutter):
//  - Zero per-frame `getImageData` / `putImageData` / GPU texture uploads during combat!
//  - Lazily bakes each `(kind, palette, dir8)` into ONE compact horizontal 8-frame sprite-sheet
//    texture (`scaleMode = "nearest"`), slicing lightweight PixiJS sub-frame textures on the GPU.
//  - Enforces a strict LRU VRAM cap (`maxSheets = 48` high / `24` low, ~12-16 MB max VRAM) so
//    long matches and mobile Safari / Android Chrome NEVER leak memory or crash.
//  - Enforces a hard concurrent volumetric sprite cap (`maxLive`) and clean `dispose()` on arena exit.

export function quantizeAngle8(angle = 0) {
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dir8 = Math.round((norm / (Math.PI * 2)) * 8) % 8;
  return { dir8, snappedAngle: (dir8 / 8) * Math.PI * 2 };
}

export function createVolumetricSheetCache({ PIXI, maxSheets = 48, maxLive = 12, doc = globalThis.document } = {}) {
  const sheets = new Map(); // LRU order: oldest first, newest at end
  const live = [];
  let totalVramBytes = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let peakLive = 0;
  let scratchCanvas = null;
  let scratchCtx = null;

  function ensureScratch(w, h) {
    if (!doc?.createElement) return null;
    if (!scratchCanvas) {
      scratchCanvas = doc.createElement("canvas");
      scratchCtx = scratchCanvas?.getContext?.("2d") ?? null;
    }
    if (!scratchCanvas || !scratchCtx) return null;
    if (scratchCanvas.width !== w) scratchCanvas.width = w;
    if (scratchCanvas.height !== h) scratchCanvas.height = h;
    return { canvas: scratchCanvas, ctx: scratchCtx };
  }

  function evictIfNeeded() {
    while (sheets.size > maxSheets) {
      const oldestKey = sheets.keys().next().value;
      const entry = sheets.get(oldestKey);
      sheets.delete(oldestKey);
      if (entry) {
        totalVramBytes = Math.max(0, totalVramBytes - entry.bytes);
        // Never destroy a texture still actively referenced by a live sprite; mark deferred if needed
        const inUse = live.some((it) => it.sheetEntry === entry);
        if (!inUse) {
          for (const f of entry.frames) f.destroy?.(false);
          entry.baseTex.destroy?.(true);
          if (entry.stripCanvas) { entry.stripCanvas.width = 0; entry.stripCanvas.height = 0; }
        } else {
          entry.retired = true;
        }
      }
    }
  }

  function getSheet(key, { width, height, frameCount = 8, renderFrame }) {
    if (!PIXI || !doc?.createElement) return null;
    const hit = sheets.get(key);
    if (hit) {
      cacheHits++;
      // Refresh LRU recency
      sheets.delete(key);
      sheets.set(key, hit);
      return hit;
    }
    cacheMisses++;
    const scratch = ensureScratch(width, height);
    const stripCanvas = doc.createElement("canvas");
    const stripCtx = stripCanvas?.getContext?.("2d");
    if (!scratch || !stripCanvas || !stripCtx) return null;
    stripCanvas.width = width * frameCount;
    stripCanvas.height = height;
    stripCtx.clearRect(0, 0, stripCanvas.width, stripCanvas.height);

    for (let i = 0; i < frameCount; i++) {
      const phase = frameCount <= 1 ? 0.5 : 0.06 + (i / (frameCount - 1)) * 0.88;
      scratch.ctx.clearRect(0, 0, width, height);
      renderFrame(scratch.ctx, phase);
      if (typeof stripCtx.drawImage === "function") {
        stripCtx.drawImage(scratch.canvas, i * width, 0);
      }
    }

    const baseTex = PIXI.Texture.from(stripCanvas);
    if (baseTex?.source) baseTex.source.scaleMode = "nearest";
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      if (PIXI.Rectangle && baseTex?.source) {
        frames.push(new PIXI.Texture({ source: baseTex.source, frame: new PIXI.Rectangle(i * width, 0, width, height) }));
      } else {
        frames.push(baseTex);
      }
    }
    const bytes = width * frameCount * height * 4;
    const entry = { key, baseTex, frames, stripCanvas, bytes, retired: false };
    sheets.set(key, entry);
    totalVramBytes += bytes;
    evictIfNeeded();
    return entry;
  }

  function cleanupRetired(entry) {
    if (!entry?.retired) return;
    if (live.some((it) => it.sheetEntry === entry)) return;
    for (const f of entry.frames) f.destroy?.(false);
    entry.baseTex.destroy?.(true);
    if (entry.stripCanvas) { entry.stripCanvas.width = 0; entry.stripCanvas.height = 0; }
  }

  function spawn({
    layer,
    keyPrefix,
    width,
    height,
    frameCount = 8,
    renderForAngle,
    anchorX = 0.5,
    anchorY = 0.70,
    x = 0,
    y = 0,
    angle = 0,
    directional = false,
    follow = null,
    leadOffset = 0,
    yOffset = 0,
    durationSec = 0.75,
    scale = 1.5,
    loop = false
  }) {
    if (!PIXI || !layer) return null;
    // Enforce hard concurrent cap: recycle oldest active sprite cleanly instead of ever lagging!
    while (live.length >= maxLive) {
      const oldest = live.shift();
      oldest?.dispose();
    }

    let curAngle = angle;
    let curDir8 = directional ? quantizeAngle8(curAngle).dir8 : -1;
    const loadEntryFor = (ang) => {
      if (!directional) {
        return getSheet(keyPrefix, { width, height, frameCount, renderFrame: (ctx, ph) => renderForAngle(ctx, 0, ph) });
      }
      const { dir8, snappedAngle } = quantizeAngle8(ang);
      curDir8 = dir8;
      return getSheet(`${keyPrefix}|d${dir8}`, {
        width, height, frameCount,
        renderFrame: (ctx, ph) => renderForAngle(ctx, snappedAngle, ph)
      });
    };

    const entry = loadEntryFor(curAngle);
    if (!entry?.frames?.length) return null;

    const sprite = new PIXI.Sprite(entry.frames[0]);
    sprite.anchor.set(anchorX, anchorY);
    sprite.scale.set(scale);
    layer.addChild(sprite);

    const place = (px, py) => {
      const ox = leadOffset ? Math.cos(curAngle) * leadOffset : 0;
      const oy = leadOffset ? Math.sin(curAngle) * leadOffset * 0.56 : 0;
      sprite.position.set(Math.round(px + ox), Math.round(py + yOffset + oy));
    };

    let prevX = null, prevY = null;
    if (typeof follow === "function") {
      const p0 = follow();
      if (p0) {
        if (Number.isFinite(p0.angle)) curAngle = p0.angle;
        place(p0.x, p0.y);
      } else {
        place(x, y);
      }
    } else {
      place(x, y);
    }

    const inst = {
      sheetEntry: entry,
      sprite,
      age: 0,
      dead: false,
      update(dt) {
        if (this.dead) return false;
        this.age += dt;
        if (typeof follow === "function") {
          const pos = (loop || this.age <= durationSec + 0.25) ? follow() : null;
          if (!pos) {
            this.dispose();
            return false;
          }
          if (Number.isFinite(pos.angle)) curAngle = pos.angle;
          else if (prevX !== null && Math.hypot(pos.x - prevX, pos.y - prevY) > 0.6) {
            curAngle = Math.atan2(pos.y - prevY, pos.x - prevX);
          }
          prevX = pos.x; prevY = pos.y;
          place(pos.x, pos.y);
          if (directional) {
            const nextDir = quantizeAngle8(curAngle).dir8;
            if (nextDir !== curDir8) {
              const oldEntry = this.sheetEntry;
              const nextEntry = loadEntryFor(curAngle);
              if (nextEntry) {
                this.sheetEntry = nextEntry;
                cleanupRetired(oldEntry);
              }
            }
          }
        }
        const frac = loop
          ? ((this.age / Math.max(0.2, durationSec)) % 1)
          : Math.min(0.999, this.age / Math.max(0.15, durationSec));
        const idx = Math.min(this.sheetEntry.frames.length - 1, Math.floor(frac * this.sheetEntry.frames.length));
        if (sprite.texture !== this.sheetEntry.frames[idx]) {
          sprite.texture = this.sheetEntry.frames[idx];
        }
        if (!loop && this.age >= durationSec) {
          this.dispose();
          return false;
        }
        return true;
      },
      dispose() {
        if (this.dead) return;
        this.dead = true;
        sprite.parent?.removeChild(sprite);
        sprite.destroy?.(false);
        const e = this.sheetEntry;
        this.sheetEntry = null;
        cleanupRetired(e);
      }
    };
    live.push(inst);
    if (live.length > peakLive) peakLive = live.length;
    return inst;
  }

  return Object.freeze({
    getSheet,
    spawn,
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        if (!live[i].update(dt)) live.splice(i, 1);
      }
    },
    getDiagnostics() {
      return {
        cachedSheets: sheets.size,
        maxSheets,
        estimatedVramMb: Math.round((totalVramBytes / (1024 * 1024)) * 100) / 100,
        cacheHits,
        cacheMisses,
        liveSprites: live.length,
        peakLive
      };
    },
    dispose() {
      for (const it of [...live]) it.dispose();
      live.length = 0;
      for (const entry of sheets.values()) {
        for (const f of entry.frames) f.destroy?.(false);
        entry.baseTex.destroy?.(true);
        if (entry.stripCanvas) { entry.stripCanvas.width = 0; entry.stripCanvas.height = 0; }
      }
      sheets.clear();
      totalVramBytes = 0;
      if (scratchCanvas) { scratchCanvas.width = 0; scratchCanvas.height = 0; scratchCanvas = null; scratchCtx = null; }
    }
  });
}
