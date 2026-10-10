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
    "gainDb": 6,
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
    "gainDb": 6,
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
    "gainDb": 6,
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
    "gainDb": 6,
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
  }
});

const BIOMES = Object.freeze({grass:'plains',savanna:'plains',forest:'plains',jungle:'plains',
  factory:'forge',mine:'forge',sewer:'forge',volcano:'forge',seaside:'harbor',ice:'moon',
  damp:'tidal',oasis:'tidal',canyon:'mystic',crag:'mystic',desert:'mystic',ruins:'mystic'});
const SCREENS = Object.freeze({RAISING_HOME:'moon',CAGE_EDIT:'moon',DATABASE:'moon',DIGIMON_LIST:'moon',
  HELP:'moon',TAMER_INFO:'moon',SHOP:'harbor',GATE_SELECT:'harbor',HUNT_LOADOUT:'harbor',
  MEDALS:'core',SCHEDULE:'core',BATTLE_SELECT:'core',CHAMPIONSHIP:'core'});
export function selectOriginalMusic({titleVisible=false,openingVisible=false,screen=null,tutorial=false,
  biome=null,chosen=null,outcome=null,attemptId=null}={}) {
  if (titleVisible) return {id:openingVisible?'lofi':'login'};
  if (screen==='BATTLE_FIELD') return {id:chosen?.championship===true && chosen.cursor===chosen.totalRounds-1?'battle_final':'battle_normal'};
  if (screen==='BATTLE_RESULT') return outcome?.ended && attemptId!=null
    ? {id:outcome.winningTeam===0?'victory':outcome.winningTeam===1?'defeat':'draw',attemptId}: {id:null};
  if (screen==='HUNT_FIELD'||screen==='HUNT_RESULT') return {id:tutorial?'plains':BIOMES[String(biome).toLowerCase()]??'plains'};
  if (screen==='RAISING_HOME' && tutorial) return {id:'lofi'};
  return {id:SCREENS[screen]??null};
}
