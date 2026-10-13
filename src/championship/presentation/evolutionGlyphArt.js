// Owner-selected original glyphs decorate the existing evolution writing band.
// They consume only its native frame clock; this module owns no ticker or rules.
import manifest from '../../../assets/production/evolution-glyphs-v1/manifest.json' with { type: 'json' };

export async function loadEvolutionGlyphArt(PIXI) {
  const results = await Promise.allSettled(manifest.assets.map(async asset => ({
    ...asset, texture: await PIXI.Assets.load(asset.src)
  })));
  const loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  let disposal = null;
  const dispose = () => disposal ??= Promise.allSettled(loaded.map(asset => PIXI.Assets.unload(asset.src)));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) { await dispose(); throw failed.reason; }
  if (loaded.some(asset => asset.texture.width !== manifest.selectedSize || asset.texture.height !== manifest.selectedSize)) {
    await dispose(); throw new Error('EVOLUTION_GLYPH_DIMENSIONS');
  }
  return { assets: loaded, dispose };
}

export function createEvolutionGlyphBand(PIXI, art) {
  const container = new PIXI.Container({ label: 'Owner original evolution glyphs' });
  container.eventMode = 'none';
  const sprites = art.assets.map(asset => {
    const sprite = new PIXI.Sprite(asset.texture);
    sprite.label = asset.id;
    sprite.eventMode = 'none';
    sprite.anchor.set(...asset.anchor);
    container.addChild(sprite);
    return sprite;
  });
  return {
    container,
    update({ width, height, totalFrames, reducedMotion }) {
      const size = Math.min(28, width / 12), gap = size * 0.4;
      const bandWidth = sprites.length * size + (sprites.length - 1) * gap;
      sprites.forEach((sprite, index) => {
        sprite.width = sprite.height = size;
        sprite.position.set((index - (sprites.length - 1) / 2) * (size + gap), 0);
      });
      // Between the first two existing text rows, behind the evolving actor.
      container.y = height / 6;
      const travel = width + bandWidth;
      const offset = Math.max(0, totalFrames - 35) * 1.2;
      container.x = reducedMotion ? width / 2
        : ((width / 2 + bandWidth / 2 - offset) % travel + travel) % travel - bandWidth / 2;
    }
  };
}
