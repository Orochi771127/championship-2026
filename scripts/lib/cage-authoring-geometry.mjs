// Read-only projection of current gameplay/placement authorities for art QA.
import fs from 'node:fs';
import { originalStartingRanch, NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, validateNativeRanch } from '../../src/championship/cage/nativeRanchLayout.js';
import { listCageDefinitions } from '../../src/championship/cage/cageCatalog.js';
import { ORIGINAL_CAGE_SHAPE_MASKS, ORIGINAL_CAGE_DEFINITION_SHAPES, ranchBoardCell, originalRanchFieldTileOrigin } from '../../src/championship/cage/ranchSlotGeometry.js';
import { createRaisingCageArtPlan } from '../../src/championship/presentation/raisingCageArtPlan.js';
import { createNativeRaisingGround } from '../../src/championship/raising/nativeRaisingGround.js';
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from '../../src/championship/presentation/originalCageVisualBindings.js';

export function cageAuthoringGeometry() {
  const manifest = JSON.parse(fs.readFileSync('assets/production/cage/licensed-runtime-v1/manifest.json', 'utf8'));
  const waiting = { moduleId: WAITING_ROOM_MODULE, slotIndex: 0 };
  const vacant = slotIndex => ({ moduleId: 'championship:2026:cage:0', slotIndex });
  const scenarios = [
    ['upper-row', [waiting, vacant(8)]],
    ['lower-row', [waiting, vacant(9)]],
    ['wrap-edge', [waiting, vacant(13)]],
    ['starting-ranch', originalStartingRanch().placements]
  ].map(([id, placements]) => {
    const frame = { layoutVersion: NATIVE_RANCH_LAYOUT, unlockedCount: 14, placements };
    const ground = createNativeRaisingGround(frame);
    return { id, placements, plan: createRaisingCageArtPlan({ ...frame, manifest }),
      ground: { width: ground.width, height: ground.height,
        terrain: Array.from(ground.terrain), owners: Array.from(ground.owners) } };
  });
  const shapeIndex = ORIGINAL_CAGE_DEFINITION_SHAPES[0];
  return { definitionIndex: 0, shapeIndex, shapeMask: ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex],
    coordinateSpaces: ['CAGE_EDIT_BOARD_256x192', 'OCCUPANCY_COLUMN_MAJOR', 'ORIGINAL_FIELD_DESTINATION_TILES', 'OBJECT_LOCAL_NATIVE_PIXELS'],
    boardCells: [8,9].map(ranchBoardCell), tileOrigins: [8,9].map(slot => originalRanchFieldTileOrigin(slot, shapeIndex)), scenarios };
}
export function cageModularPlacementPlans(definitionIndex) {
  const manifest=JSON.parse(fs.readFileSync('assets/production/cage/licensed-runtime-v1/manifest.json','utf8'));
  if(definitionIndex===36){
    // Structural lids are emitted by the existing art plan, never purchased or
    // placed as a facility. Group wrapped fragments by their original empty bay.
    const scenarios=[];
    for(const unlockedCount of [14,16,18,20]){
      const placements=[{moduleId:WAITING_ROOM_MODULE,slotIndex:0}];
      const plan=createRaisingCageArtPlan({manifest,placements,layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount});
      const groups=new Map();
      for(const p of plan.placements.filter(p=>p.structuralRole==='LID')){
        const slot=p.slotIndex??p.fragmentOfSlot;
        if(!groups.has(slot))groups.set(slot,[]);
        groups.get(slot).push(p);
      }
      for(const [slotIndex,fragments] of groups)scenarios.push({id:`lid-${unlockedCount}-slot-${slotIndex}`,
        unlockedCount,slotIndex,wrapWidthPx:plan.wrapWidthPx,heightPx:704,fragments});
    }
    return {definitionIndex,fieldId:'field_cm29_01',source:'EXISTING_STRUCTURAL_LID_ART_PLAN',scenarios};
  }
  const definition=listCageDefinitions().find(d=>d.cageDefinitionIndex===definitionIndex);
  if (!definition || definitionIndex>35) throw new Error('UNSUPPORTED_FACILITY_DEFINITION');
  const scenarios=[];
  for (const unlockedCount of [14,16,18,20]) {
    for (const slotIndex of definitionIndex===35 ? [0] : Array.from({length:unlockedCount-4},(_,i)=>i+4)) {
      const waiting={moduleId:WAITING_ROOM_MODULE,slotIndex:0};
      const placements=definitionIndex===35 ? [waiting] : [waiting,{moduleId:definition.moduleId,slotIndex}];
      if (!validateNativeRanch(placements,unlockedCount)) continue;
      const plan=createRaisingCageArtPlan({manifest,placements,layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount});
      scenarios.push({id:`ranch-${unlockedCount}-slot-${slotIndex}`,unlockedCount,slotIndex,
        wrapWidthPx:plan.wrapWidthPx,heightPx:704,
        fragments:plan.placements.filter(p=>p.cageDefinitionIndex===definitionIndex)});
    }
  }
  return {definitionIndex,fieldId:getOriginalCageVisualBinding(definitionIndex).fieldId,
    source:'EXISTING_NATIVE_RANCH_VALIDATION_AND_ART_PLAN',scenarios};
}
export function cageSeamReviewPlans(definitions=[0,1,15], includeStarting=true) {
  const manifest=JSON.parse(fs.readFileSync('assets/production/cage/licensed-runtime-v1/manifest.json','utf8'));
  const waiting={moduleId:WAITING_ROOM_MODULE,slotIndex:0};
  const scenarios=[];
  for(const unlockedCount of [14,16,18,20]){
    const entries=includeStarting ? [{id:`starting-${unlockedCount}`,placements:originalStartingRanch().placements}] :
      [{id:`empty-${unlockedCount}`,placements:[waiting]}];
    for(const definitionIndex of definitions){
      const definition=listCageDefinitions().find(d=>d.cageDefinitionIndex===definitionIndex);
      for(let slotIndex=4;slotIndex<unlockedCount;slotIndex++){
        const placements=[waiting,{moduleId:definition.moduleId,slotIndex}];
        if(validateNativeRanch(placements,unlockedCount))entries.push({id:`definition-${definitionIndex}-${unlockedCount}-${slotIndex}`,placements});
      }
    }
    for(const entry of entries){
      if(!validateNativeRanch(entry.placements,unlockedCount))throw Error('SEAM_REVIEW_INVALID_PLACEMENT');
      scenarios.push({...entry,unlockedCount,plan:createRaisingCageArtPlan({manifest,placements:entry.placements,
        unlockedCount,layoutVersion:NATIVE_RANCH_LAYOUT})});
    }
  }
  return {source:'EXISTING_NATIVE_RANCH_VALIDATION_AND_ART_PLAN',scenarios};
}

// Authoring adapter: never infer a footprint from raster tiles or decorations.
// Every edge belongs to a native bay. Shared edges cancel, leaving one union.
export function cageHexFootprints() {
  const hex=[[0,24],[48,0],[96,24],[96,88],[48,112],[0,88]];
  const fields=[];
  for(let definitionIndex=0;definitionIndex<=36;definitionIndex++){
    const binding=definitionIndex===36?ORIGINAL_CAGE_STRUCTURAL_VISUALS.find(v=>v.role==='LID'):getOriginalCageVisualBinding(definitionIndex);
    if(!binding)throw Error('HEX_FIELD_BINDING_MISSING');
    const shapeIndex=definitionIndex===36?0:ORIGINAL_CAGE_DEFINITION_SHAPES[definitionIndex];
    const mask=ORIGINAL_CAGE_SHAPE_MASKS[shapeIndex];
    const sourceOffsetX=(mask&1)?0:48;
    const cells=[],edges=new Map();
    for(let bit=0;bit<8;bit++){
      if(!(mask&(1<<bit)))continue;
      const x=Math.floor(bit/2)*96+(bit%2)*48-sourceOffsetX,y=(bit%2)*88;
      const polygon=hex.map(([xx,yy])=>[x+xx,y+yy]);
      cells.push({bit,column:Math.floor(bit/2),row:bit%2,polygon});
      for(let i=0;i<6;i++){
        const a=polygon[i],b=polygon[(i+1)%6];
        const reverse=JSON.stringify([b,a]);
        if(edges.has(reverse))edges.delete(reverse);else edges.set(JSON.stringify([a,b]),[a,b]);
      }
    }
    const boundaryEdges=[...edges.values()];
    const next=new Map(boundaryEdges.map(([a,b])=>[JSON.stringify(a),b]));
    const outline=[];let point=boundaryEdges[0][0];const first=JSON.stringify(point);
    do{
      outline.push(point);point=next.get(JSON.stringify(point));
      if(!point||outline.length>boundaryEdges.length)throw Error('HEX_BOUNDARY_NOT_CLOSED');
    }while(JSON.stringify(point)!==first);
    if(outline.length!==boundaryEdges.length)throw Error('HEX_BOUNDARY_DISCONNECTED');
    fields.push({fieldId:binding.fieldId,definitionIndex,shapeIndex,shapeMask:mask,
      sourceOffsetX,cells,outline,boundaryEdges,
      nativeSize:[Math.max(...outline.map(p=>p[0])),Math.max(...outline.map(p=>p[1]))]});
  }
  return {schemaVersion:1,authority:'EXISTING_NATIVE_SHAPE_MASK_UNION',
    hexNative:hex,cellWidth:96,cellHeight:112,columnPitch:96,rowOffset:[48,88],
    cropApplied:false,fields};
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/cage-authoring-geometry.mjs')) {
  const index=process.argv.indexOf('--definition');
  console.log(JSON.stringify(process.argv.includes('--hex-footprints') ? cageHexFootprints() : process.argv.includes('--stage3-batch1-review') ? cageSeamReviewPlans([6,33],false) : process.argv.includes('--stage2-batch3-review') ? cageSeamReviewPlans([9,10,11,19,31,32,34],false) : process.argv.includes('--stage2-batch2-review') ? cageSeamReviewPlans([2,3,26],false) : process.argv.includes('--stage2-review') ? cageSeamReviewPlans([4,27,28,30],false) : process.argv.includes('--seam-review') ? cageSeamReviewPlans() :
    index<0 ? cageAuthoringGeometry() : cageModularPlacementPlans(Number(process.argv[index+1]))));
}
