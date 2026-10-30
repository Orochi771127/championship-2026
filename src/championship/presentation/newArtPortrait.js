// Owner 2026-10-30: UI portraits (ranch card, ceremonies, hunt result, battle cards, Dex
// routes, Data Arena select) show each partner's current design -- its published Dex
// illustration -- not the original HUD cell. A species without one keeps its HUD art.
import {databaseHeroPortrait} from './databaseHeroPortraits.js';

export function newArtPortrait(speciesId) {
  const match = /species-(\d{3})$/.exec(String(speciesId ?? ''));
  const hero = match ? databaseHeroPortrait(Number(match[1])) : null;
  return hero ? Object.freeze({src: hero.src, sha256: hero.sha256, width: hero.width, height: hero.height}) : null;
}

// The illustration in place of a HUD portrait record: same longest side in native units
// (callers size the image from width/height x nativeScale), the illustration's own aspect.
export function newArtPortraitLike(speciesId, hud) {
  const art = hud ? newArtPortrait(speciesId) : null;
  if (!art) return hud ?? null;
  const k = Math.max(hud.width, hud.height) / Math.max(art.width, art.height);
  return Object.freeze({...hud, src: art.src, sha256: art.sha256, width: art.width * k, height: art.height * k, art: 'DATABASE_ILLUSTRATION'});
}
