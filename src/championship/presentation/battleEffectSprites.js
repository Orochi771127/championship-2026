// A projection of live effect actors, with no animation clock or gameplay state.
// The owning battle scene shares its camera, depth layer and sole Pixi ticker.
export function projectBattleEffectSprite(effect, cell, rect, nativeScale, brightnessQ12 = 4096) {
  const [x, y, z] = effect.point;
  const color = shift => Math.round(((effect.tint >> shift) & 31) * 255 / 31 * brightnessQ12 / 4096);
  return {
    x:rect.x + x / 4096 * nativeScale,
    y:rect.y + (y - z) / 4096 * nativeScale,
    depth:rect.y + y / 4096 * nativeScale,
    scaleX:nativeScale / cell.pixelsPerNativePixel * effect.scaleX / 4096 * (effect.flip & 1 ? -1 : 1),
    scaleY:nativeScale / cell.pixelsPerNativePixel * effect.scaleY / 4096 * (effect.flip & 2 ? -1 : 1),
    rotation:Math.atan2(effect.sin, effect.cos),
    alpha:effect.alpha / 31,
    tint:(color(0) << 16) | (color(5) << 8) | color(10),
    anchorX:cell.origin[0] / cell.frame[2], anchorY:cell.origin[1] / cell.frame[3]
  };
}

export function createBattleEffectSprites({PIXI, parent, art}) {
  const actors = new Map(), missing = new Set(), seenCells = new Set();
  let created = 0, released = 0, disposed = false;
  function remove(id) {
    const entry = actors.get(id);
    parent.removeChild(entry.sprite);
    entry.sprite.destroy(); // shared cell textures remain owned by the art bundle
    actors.delete(id); released++;
  }
  return {
    update(effects, rect, nativeScale, brightnessQ12 = 4096) {
      if (disposed) return;
      const live = new Set();
      for (const effect of effects) {
        const key = `${effect.bankId}:${effect.cell}`;
        const cell = art.getCell(effect.bankId, effect.cell);
        if (!cell) { missing.add(key); continue; }
        live.add(effect.id); seenCells.add(key);
        let entry = actors.get(effect.id);
        if (!entry) {
          entry = {sprite:new PIXI.Sprite(cell.texture)};
          actors.set(effect.id, entry); parent.addChild(entry.sprite); created++;
        }
        const sprite = entry.sprite;
        sprite.texture = cell.texture;
        const p = projectBattleEffectSprite(effect, cell, rect, nativeScale, brightnessQ12);
        sprite.anchor.set(p.anchorX, p.anchorY);
        sprite.position.set(p.x, p.y); sprite.scale.set(p.scaleX, p.scaleY);
        sprite.rotation = p.rotation; sprite.alpha = p.alpha; sprite.tint = p.tint;
        sprite.zIndex = p.depth;
        sprite.visible = !cell.blank && p.alpha > 0 && p.scaleX !== 0 && p.scaleY !== 0;
        // A finished once animation can remain visible while its owning VM
        // waits. Presence in the pool's live snapshot is the visibility truth.
        entry.sample = {id:effect.id, bankId:effect.bankId, cell:effect.cell, visible:sprite.visible, ...p};
      }
      for (const id of actors.keys()) if (!live.has(id)) remove(id);
    },
    getDiagnostics:() => ({assetId:art.assetId, active:actors.size, created, released,
      visible:[...actors.values()].filter(e=>e.sprite.visible).length,
      missingCells:[...missing], seenCells:[...seenCells], sprites:[...actors.values()].map(e => ({...e.sample}))}),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of actors.keys()) remove(id);
    }
  };
}
