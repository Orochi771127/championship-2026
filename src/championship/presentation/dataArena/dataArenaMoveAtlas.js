import {createMoveAtlas} from '../moveAtlas.js';

const records = new Map([
  ['arcBolt', 623], ['arcFan', 624], ['arcField', 625],
  ['arcStorm', 626], ['barkGuard', 627], ['boltDash', 628],
  ['brutalCharge', 629], ['cinderGuard', 630], ['clawSweep', 631],
  ['coreNova', 632], ['dawnLance', 633], ['duskGuard', 634],
  ['emberBolt', 635], ['fangRush', 636], ['flameRing', 637],
  ['foamZone', 638], ['frostFan', 639], ['frostStep', 640],
  ['glacierGuard', 641], ['grovePulse', 642], ['haloPulse', 643],
  ['iceCage', 644], ['iceShard', 645], ['impactNova', 646],
  ['impactShot', 647], ['ironGuard', 648], ['leafFan', 649],
  ['nightPulse', 650], ['quakeSlam', 651], ['radiantDash', 652],
  ['rockGuard', 653], ['scatterLight', 654], ['seedBolt', 655],
  ['shadeBolt', 656], ['shadeField', 657], ['shadeStep', 658],
  ['shardStorm', 659], ['shardVolley', 660], ['stormGuard', 661],
  ['sunShield', 662], ['sunSpear', 663], ['surfRush', 664],
  ['thornRush', 665], ['tideBolt', 666], ['tideGuard', 667],
  ['tideWave', 668], ['vineSnare', 669], ['vortex', 670],
  ['whiteout', 671]
]);
// Painted extents in source pixels, measured separately for each clip from its pivot.
const groundRadii = new Map([
  ['arcField/warning', 26], ['arcField/burst', 26],
  ['flameRing/warning', 29], ['flameRing/burst', 29],
  ['foamZone/warning', 29], ['foamZone/burst', 30],
  ['iceCage/warning', 26], ['iceCage/burst', 28],
  ['quakeSlam/warning', 26], ['quakeSlam/burst', 27],
  ['shadeField/warning', 29], ['shadeField/burst', 30],
  ['vineSnare/warning', 30], ['vineSnare/burst', 27],
  ['clawSweep/burst', 28], ['coreNova/burst', 26],
  ['grovePulse/burst', 28], ['haloPulse/burst', 27],
  ['impactNova/burst', 28], ['nightPulse/burst', 27],
  ['vortex/burst', 35], ['whiteout/burst', 34]
]);
const assetRoot = 'assets/production/vfx/arena-moves/';

export function createArenaMoveAtlas(options) {
  return createMoveAtlas({...options, records, groundRadii, assetRoot, mode:'arena', labelPrefix:'arena-move'});
}
