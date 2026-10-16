// Display names and scene choices are PRODUCT_AUTHORED UI metadata, not artist tags.
// Keep stable IDs independent of names and languages. Audio remains in the existing catalog.
import { ORIGINAL_MUSIC_CUES } from './originalMusicCatalog.js';

const entries = [
  ['core', '中央輝光核心', 'Central Radiant Core', ['system']],
  ['mystic', '東方秘境群山', 'Eastern Mystic Mountains', ['exploration']],
  ['moon', '空靈月湖畔', 'Ethereal Moon Lakefront', ['raising', 'exploration', 'system']],
  ['lofi', '林卡拉慢拍', 'Linkara Lo-fi', ['raising', 'opening']],
  ['login', '啟程之頁', 'Login Page', ['title']],
  ['plains', '北境翠綠平原', 'Northern Verdant Plains', ['exploration']],
  ['forge', '東南熔爐丘陵', 'Southeast Forge Hills', ['exploration']],
  ['harbor', '南方港灣樞紐', 'Southern Harbor Nexus', ['exploration', 'system']],
  ['tidal', '西南潮汐邊境', 'Southwest Tidal Frontier', ['exploration']],
  ['battle_normal', '錦標賽對戰', 'Championship Battle', ['battle']],
  ['battle_final', '錦標賽決戰', 'Championship Final', ['battle']],
  ['victory', '勝利之聲', 'Victory', ['result']],
  ['defeat', '敗北之聲', 'Defeat', ['result']],
  ['draw', '平手之聲', 'Draw', ['result']],
  ['a_quiet_evening_training', '靜夜修練', 'A Quiet Evening Training', ['raising']],
  ['unison_under_fire', '烽火同心', 'Unison Under Fire', ['battle']],
  ['federation_siege', '聯邦圍城', 'Federation Siege', ['battle']]
];

export const SCENE_MUSIC_TRACKS = Object.freeze(entries.map(([id, zh, en, categories]) =>
  Object.freeze({ id, titles: Object.freeze({ zh, en }), categories: Object.freeze(categories) })));
export const SCENE_MUSIC_PREFERENCES = Object.freeze({ raising: 'raisingMusic', battle: 'battleMusic' });

/** Result stingers stay outcome-driven, and cannot be selected as looping BGM. */
export function musicChoicesForScene(scene) {
  return SCENE_MUSIC_TRACKS.filter(track => track.categories.includes(scene) && ORIGINAL_MUSIC_CUES[track.id]?.loop);
}

/** Owner rule: Chinese locales show Chinese; every other UI language shows English only. */
export function musicTrackTitle(id, locale = 'zh-Hant') {
  const track = SCENE_MUSIC_TRACKS.find(entry => entry.id === id);
  if (!track) return '';
  return track.titles[/^zh(?:-|$)/i.test(locale) ? 'zh' : 'en'];
}

/** Resolve only the authorized scene's preference. Invalid/stale IDs preserve its original cue. */
export function resolveSceneMusic(id, scene, preferences = {}) {
  if (!ORIGINAL_MUSIC_CUES[id]?.loop) return id;
  // Arena routes use these same combat IDs directly, so they share the player's choice.
  const category = scene ?? (id === 'battle_normal' || id === 'battle_final' ? 'battle' : null);
  const preference = preferences[SCENE_MUSIC_PREFERENCES[category]];
  return musicChoicesForScene(category).some(track => track.id === preference) ? preference : id;
}
