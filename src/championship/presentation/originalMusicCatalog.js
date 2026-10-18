// Owner-approved original audio presentation; provisional mapping and gain, listening acceptance pending.
export const ORIGINAL_MUSIC_CUES = Object.freeze({
  "core": {
    "path": "./assets/production/original-music-r1/bgm_central_radiant_core.mp3",
    "loop": true,
    "gainDb": -5.1,
    "trimStart": 0,
    "trimEnd": 1.728,
    "crossfade": 0.8
  },
  "mystic": {
    "path": "./assets/production/original-music-r1/bgm_eastern_mystic_mountains.mp3",
    "loop": true,
    "gainDb": 9.3,
    "trimStart": 1.9463,
    "trimEnd": 0.6961,
    "crossfade": 0.8
  },
  "moon": {
    "path": "./assets/production/original-music-r1/bgm_ethereal_moon_lakefront.mp3",
    "loop": true,
    "gainDb": 3.7,
    "trimStart": 0,
    "trimEnd": 1.2319,
    "crossfade": 0.8
  },
  "lofi": {
    "path": "./assets/production/original-music-r1/bgm_linkara_lofi.mp3",
    "loop": true,
    "gainDb": 12,
    "trimStart": 0.5888,
    "trimEnd": 2.0086,
    "crossfade": 0.8
  },
  "login": {
    "path": "./assets/production/original-music-r1/bgm_login_page.mp3",
    "loop": true,
    "gainDb": 1.1,
    "trimStart": 0,
    "trimEnd": 1.4464,
    "crossfade": 0.8
  },
  "plains": {
    "path": "./assets/production/original-music-r1/bgm_northern_verdant_plains.mp3",
    "loop": true,
    "gainDb": -5.4,
    "trimStart": 1.7717,
    "trimEnd": 1.0123,
    "crossfade": 0.8
  },
  "forge": {
    "path": "./assets/production/original-music-r1/bgm_southeast_forge_hills.mp3",
    "loop": true,
    "gainDb": 7.6,
    "trimStart": 0,
    "trimEnd": 0.6285,
    "crossfade": 0.8
  },
  "harbor": {
    "path": "./assets/production/original-music-r1/bgm_southern_harbor_nexus.mp3",
    "loop": true,
    "gainDb": 1.7,
    "trimStart": 0,
    "trimEnd": 0.4872,
    "crossfade": 0.8
  },
  "tidal": {
    "path": "./assets/production/original-music-r1/bgm_southwest_tidal_frontier.mp3",
    "loop": true,
    "gainDb": 9.4,
    "trimStart": 0,
    "trimEnd": 1.9305,
    "crossfade": 0.8
  },
  "battle_normal": {
    "path": "./assets/production/original-music-r1/championship_battle_normal_r1.ogg",
    "loop": true,
    "gainDb": -8.5,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0,
    "fallbackPath": "./assets/production/original-music-r1/championship_battle_normal_r1.m4a"
  },
  "battle_final": {
    "path": "./assets/production/original-music-r1/championship_battle_final_r1.ogg",
    "loop": true,
    "gainDb": -8.6,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0,
    "fallbackPath": "./assets/production/original-music-r1/championship_battle_final_r1.m4a"
  },
  "victory": {
    "path": "./assets/production/original-music-r1/championship_victory_r1.ogg",
    "loop": false,
    "gainDb": -9.6,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0,
    "fallbackPath": "./assets/production/original-music-r1/championship_victory_r1.m4a"
  },
  "defeat": {
    "path": "./assets/production/original-music-r1/championship_defeat_r1.ogg",
    "loop": false,
    "gainDb": -8.4,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0,
    "fallbackPath": "./assets/production/original-music-r1/championship_defeat_r1.m4a"
  },
  "draw": {
    "path": "./assets/production/original-music-r1/championship_draw_r1.ogg",
    "loop": false,
    "gainDb": -9.1,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0,
    "fallbackPath": "./assets/production/original-music-r1/championship_draw_r1.m4a"
  },
  "a_quiet_evening_training": {
    "path": "./assets/production/scene-music-r1/raising/a_quiet_evening_training.mp3",
    "loop": true,
    "gainDb": -11.7,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0.8
  },
  "unison_under_fire": {
    "path": "./assets/production/scene-music-r1/battle/unison_under_fire.mp3",
    "loop": true,
    "gainDb": -11.7,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0.8
  },
  "south_pole_siege": {
    "path": "./assets/production/scene-music-r1/battle/south_pole_siege.mp3",
    "loop": true, "gainDb": -11.7, "trimStart": 0, "trimEnd": 0, "crossfade": 0.8
  },
  "titan_s_final_strike": {
    "path": "./assets/production/scene-music-r1/battle/titan_s_final_strike.mp3",
    "loop": true, "gainDb": -11.7, "trimStart": 0, "trimEnd": 0, "crossfade": 0.8
  },
  "mirage_of_the_arena": {
    "path": "./assets/production/scene-music-r1/battle/mirage_of_the_arena.mp3",
    "loop": true, "gainDb": -11.6, "trimStart": 0, "trimEnd": 0, "crossfade": 0.8
  },
  "inferno_overdrive": {
    "path": "./assets/production/scene-music-r1/battle/inferno_overdrive.mp3",
    "loop": true, "gainDb": -10.7, "trimStart": 0, "trimEnd": 0, "crossfade": 0.8
  },
  "federation_siege": {
    "path": "./assets/production/scene-music-r1/battle/federation_siege.mp3",
    "loop": true,
    "gainDb": -11.5,
    "trimStart": 0,
    "trimEnd": 0,
    "crossfade": 0.8
  }
});

const BIOMES = Object.freeze({grass:'plains',savanna:'plains',forest:'plains',jungle:'plains',
  factory:'forge',mine:'forge',sewer:'forge',volcano:'forge',seaside:'harbor',ice:'moon',
  damp:'tidal',oasis:'tidal',canyon:'mystic',crag:'mystic',desert:'mystic',ruins:'mystic'});
const SCREENS = Object.freeze({RAISING_HOME:'moon',CAGE_EDIT:'moon',DATABASE:'moon',DIGIMON_LIST:'moon',
  HELP:'moon',TAMER_INFO:'moon',SHOP:'harbor',GATE_SELECT:'harbor',HUNT_LOADOUT:'harbor',
  MEDALS:'core',SCHEDULE:'core',BATTLE_SELECT:'core',CHAMPIONSHIP:'core'});
// Owner-specified field assignments; unassigned fields retain the prior normal/final cues.
export const BATTLE_FIELD_MUSIC = Object.freeze({
  3: 'titan_s_final_strike', 4: 'south_pole_siege', 5: 'mirage_of_the_arena', 7: 'inferno_overdrive'
});
// Owner delegated these two reversible product assignments on 2026-10-18.
// Paired survival -> Unison; successive tournament opponents -> Federation.
// This is a gameplay/title-informed choice, not a listening acceptance claim.
export const DATA_ARENA_MUSIC = Object.freeze({HARBOR:'unison_under_fire',TOURNAMENT:'federation_siege'});
export function selectDataArenaMusic(mode) { return DATA_ARENA_MUSIC[mode] ?? 'battle_normal'; }
export function selectOriginalMusic({titleVisible=false,openingVisible=false,screen=null,tutorial=false,
  biome=null,chosen=null,outcome=null,attemptId=null}={}) {
  if (titleVisible) return {id:openingVisible?'lofi':'login'};
  if (screen==='BATTLE_FIELD') {
    // Championship presentation uses arena 10 regardless of the match record.
    const arenaIndex = chosen?.championship ? 10 : chosen?.arenaIndex;
    return {id:BATTLE_FIELD_MUSIC[arenaIndex] ?? (chosen?.championship===true && chosen.cursor===chosen.totalRounds-1?'battle_final':'battle_normal')};
  }
  if (screen==='BATTLE_RESULT') return outcome?.ended && attemptId!=null
    ? {id:outcome.winningTeam===0?'victory':outcome.winningTeam===1?'defeat':'draw',attemptId}: {id:null};
  if (screen==='HUNT_FIELD'||screen==='HUNT_RESULT') return {id:tutorial?'plains':BIOMES[String(biome).toLowerCase()]??'plains'};
  if (screen==='RAISING_HOME' && tutorial) return {id:'lofi'};
  return {id:SCREENS[screen]??null};
}
