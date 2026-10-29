// Data Arena -- read-only adapter from the arena's cast to existing creature art.
//
// The arena reuses creatures the game already ships; it never edits their
// records, IDs, save data or art. Each cast member resolves through the same
// Owner hash-selected public playtest selection the main game uses
// (accepted-original-character-selection.r1.json) and the same location gate
// (isOriginalRuntimeLocation: loopback, or the approved public playtest URL).
// Anywhere else the arena draws its own original procedural silhouettes, so a
// mirror or fork never ships selected art outside its approval.
//
// Sequence ids are the raw Main-side requests the Battle presenter already
// resolves from CPU-checked notifications (battleCharacterAction.js):
// 0 stand, 2 walk, 7 attack, 6 hit, 15 down, 33 win.

import {publicCharacterConfig} from '../publicCharacterCatalog.js';
import {validatePublicCharacterRender} from '../publicCharacterRoster.js';
import {loadPixiCharacterRuntimeBundle} from '../pixiCharacterRuntimeBundle.js';
import {attachReviewedCharacterAnimation,reviewedReplacesOriginal} from '../reviewedCharacterLoader.js';
import { DATA_ARENA_BOSS, DATA_ARENA_MATE, DATA_ARENA_PARTNERS, DATA_ARENA_RIVALS } from "../../modes/dataArena/dataArenaConfig.js";
import { speciesNameForId } from "../../text/zhHant.js";
import { isOriginalRuntimeLocation } from "../originalRuntimeLocation.js";

export const DATA_ARENA_SEQUENCES = Object.freeze({ STAND: 0, WALK: 2, ATTACK: 7, HIT: 6, DOWN: 15, WIN: 33 });


/** One cast member's art record, or null when none is selected for this species. */
export function dataArenaArtRecord(speciesId, href = globalThis.location?.href) {
  const entry = publicCharacterConfig(speciesId);
  if (!entry || !href || !isOriginalRuntimeLocation(href)) return null;
  return Object.freeze({
    speciesId, entityId: entry.entityId, runtimeSha256:entry.runtimeSha256, baseUrl:href,
    runtimeUrl: new URL(entry.runtimePath, href).href,
    portraitUrl: new URL(entry.hudPath.replace('hud.render.json','main-cell_000.webp'), href).href
  });
}

export async function loadDataArenaCharacter({art,PIXI,signal,fetchImpl=globalThis.fetch}){
 const selected=publicCharacterConfig(art.speciesId);
 if(!selected||selected.entityId!==art.entityId||selected.runtimeSha256!==art.runtimeSha256)throw Error('DATA_ARENA_ART_IDENTITY_MISMATCH');
 const response=await fetchImpl(art.runtimeUrl,{signal});if(!response.ok)throw Error('DATA_ARENA_ART_HTTP_'+response.status);
 const text=await response.text(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==selected.runtimeSha256)throw Error('DATA_ARENA_ART_HASH');
 const runtime=JSON.parse(text);await validatePublicCharacterRender(runtime,selected);
 const baseUrl=art.baseUrl??new URL('/',art.runtimeUrl).href;
 const bundle=await loadPixiCharacterRuntimeBundle({PIXI,signal,fetchImpl,runtimeUrl:art.runtimeUrl,runtimeDocument:runtime,sides:['main'],cachePrefix:`data-arena:${art.entityId}:${hash}:`,
  pixels:!reviewedReplacesOriginal(art.speciesId,baseUrl)});
 return attachReviewedCharacterAnimation({bundle,PIXI,speciesId:art.speciesId,baseUrl,signal,usage:'arena',fetchImpl});
}

// QA-only: on an isolated loopback QA origin (port 8761 or 8762) with ?arenaQa=1,
// ?arenaQaCast=species-156,species-185 re-skins the fixed cast in order (partners,
// rivals, mate, boss) so new artwork can be checked in a real match. Kits, ids and
// rules stay the shipped cast's; any other origin ignores the parameter.
function qaCastSpecies(href) {
  try {
    const url = new URL(href);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["8761", "8762"].includes(url.port) || url.searchParams.get("arenaQa") !== "1") return null;
    const list = (url.searchParams.get("arenaQaCast") ?? "").split(",").filter((id) => /^species-\d{3}$/.test(id));
    return list.length ? list : null;
  } catch { return null; }
}

import { RELAY_ROSTER } from '../../modes/dataArena/dataArenaRelayRoster.js';

export function dataArenaCast(href = globalThis.location?.href, { includeRelay = false } = {}) {
  const qaCast = qaCastSpecies(href); let qaIndex = 0;
  const member = (role, shippedSpeciesId, extra = {}) => {
    const speciesId = qaCast ? qaCast[qaIndex++ % qaCast.length] : shippedSpeciesId;
    return Object.freeze({ role, speciesId, name: speciesNameForId(speciesId), art: dataArenaArtRecord(speciesId, href), ...extra });
  };
  return Object.freeze({
    partners: Object.freeze((includeRelay?RELAY_ROSTER:DATA_ARENA_PARTNERS).map((partner) => member("PLAYER", partner.speciesId, { partnerId: partner.id }))),
    mate: member("MATE", DATA_ARENA_MATE.speciesId),
    rivals: Object.freeze(DATA_ARENA_RIVALS.map((rival) => member(rival.champion ? "CHAMPION" : "RIVAL", rival.speciesId, { rivalId: rival.id, kit: rival.kit }))),
    boss: member("BOSS", DATA_ARENA_BOSS.speciesId)
  });
}
