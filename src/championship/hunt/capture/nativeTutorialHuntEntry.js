// Dedicated record16 / field32. Ordinary gate catalog and encounter pool stay intact.
import source from '../../../data/championship/catalogs/tutorial-hunt-scene.r1.json' with {type:'json'};
import {createNativeHuntEnvironment} from './nativeHuntSceneSources.js';
import {createNativeHuntIndividual} from './nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from './nativeHuntSources.js';
import {initializeNativeHuntAi,nativeHuntInitialSpeed} from './nativeHuntActorInitialization.js';
import {restoreChannelRng} from '../../battle/battleRngChannel.js';
import {createHuntInventory} from '../loadout/huntInventory.js';
import {createHuntLoadout} from '../loadout/huntLoadoutRuntime.js';
import {HUNT_EQUIPMENT_ITEMS,HUNT_STARTING_INVENTORY} from '../loadout/huntEquipmentCatalog.js';
export function prepareNativeTutorialHuntEntry(rngSnapshot){
 if(source.fields.length!==1||source.fields[0].nativeHuntIndex!==32||source.fields[0].fieldId!=='field_hm00_01')throw Error('TUTORIAL_FIELD32_REQUIRED');
 const rng=restoreChannelRng(rngSnapshot);
 // Original constructor builds both individuals before registering the two actors.
 const individuals=[13,21].map(index=>createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(index),rng,traitOverride:-1}));
 const actors=individuals.map((individual,index)=>{const speciesIndex=individual.fields['000'];individual.fields['004']=index;
  return {speciesIndex,individual,positionQ12:(index?[640,600,0]:[400,400,0]).map(n=>n*4096),facing:0,
   ai:{...initializeNativeHuntAi(rng),speedQ12:nativeHuntInitialSpeed(nativeHuntSpeciesByIndex(speciesIndex),individual.fields['018'])}};});
 const inventory=createHuntInventory({entries:HUNT_STARTING_INVENTORY}),loadout=createHuntLoadout({inventory});
 // Read-only original phase2 checkpoints corroborate category1/2/4, item0.
 for(const category of ['ROPE','SHOT','MEAT']){const item=HUNT_EQUIPMENT_ITEMS.find(i=>i.nativeSubcategory===category&&i.nativeItemIndex===0);loadout.selectEquipment(item.equipmentClass,item.itemId);}
 return {tutorial:true,rng,loadout,inventory,scene:{biomeId:'Tutorial',biomeIndex:16,nativeHuntIndex:32,
  fieldId:'field_hm00_01',season:0,hour:8,variant:{night:false},environment:createNativeHuntEnvironment(source.environments.field_hm00_01)},
  encounter:{actors},releasedSlot:null};
}
