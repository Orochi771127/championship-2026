import {loadPublicRenderDescriptor,validatePublicRenderDescriptor} from './publicRenderDescriptors.js';
// Owner-supplied original cells for loopback research comparison. Numeric
// animation/collision remain in the existing pool. No generated-art fallback.
import publicPlaytest from '../../data/championship/public-playtest-runtime.v1.json' with {type:'json'};
export const BATTLE_EFFECT_ART_MANIFEST = 'assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json';
export const BATTLE_EFFECT_ART_ID = 'art:vfx:battle-effects:local-reference:v1';

export function isLocalBattleEffectPreview(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const local = ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    // The Owner's 2026-09-10 publication instruction adds one exact Pages
    // destination. It does not relabel the source assets as rights-verified.
    const approvedPlaytest = publicPlaytest.status === 'OWNER_AUTHORIZED_PUBLIC_PLAYTEST'
      && url.origin === publicPlaytest.origin && url.pathname.startsWith(publicPlaytest.basePath);
    return local || approvedPlaytest;
  } catch { return false; }
}

function requireProductionPath(value) {
  if (typeof value !== 'string' || !/^assets\/production\/[A-Za-z0-9_./-]+$/.test(value)
    || value.split('/').some(part => part === '..' || part === '.')) throw new Error('BATTLE_EFFECT_ART_PATH_INVALID');
}

export function validateBattleEffectArt(manifest){return structuredClone(validatePublicRenderDescriptor(manifest,'battle-effects'));}

export async function loadBattleEffectArt({PIXI, manifest, productionIndex, baseUrl = globalThis.location?.href}) {
  if (!isLocalBattleEffectPreview(baseUrl)) throw new Error('BATTLE_EFFECT_ART_LOCAL_PREVIEW_ONLY');
  const checked = validateBattleEffectArt(manifest, productionIndex);
  const texture = await PIXI.Assets.load(checked.image.src);
  const cells = new Map();
  let disposal;
  try {
    if (texture.width !== checked.image.width || texture.height !== checked.image.height) {
      throw new Error('BATTLE_EFFECT_ART_IMAGE_DIMENSIONS');
    }
    texture.source.scaleMode = 'nearest';
    for (const cell of checked.cells) {
      const frame = new PIXI.Texture({source:texture.source, frame:new PIXI.Rectangle(...cell.frame)});
      cells.set(`${cell.bankId}:${cell.cell}`, {...cell, texture:frame});
    }
  } catch (error) {
    for (const cell of cells.values()) cell.texture.destroy(false);
    await PIXI.Assets.unload(checked.image.src);
    throw error;
  }
  return {
    assetId:checked.assetId,
    getCell:(bankId, cell) => cells.get(`${bankId}:${cell}`) ?? null,
    dispose() {
      if (disposal) return disposal;
      for (const cell of cells.values()) cell.texture.destroy(false);
      cells.clear();
      disposal = Promise.resolve(PIXI.Assets.unload(checked.image.src));
      return disposal;
    }
  };
}

export async function loadRegisteredBattleEffectArt({PIXI, baseUrl, fetchImpl = globalThis.fetch}) {
  if (!isLocalBattleEffectPreview(baseUrl)) return null;
  const manifest=await loadPublicRenderDescriptor('battle-effects',{baseUrl,fetchImpl});
  return loadBattleEffectArt({PIXI,manifest,baseUrl});
}
