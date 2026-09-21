const CONFIG=Object.freeze({
  m002:Object.freeze({entityId:'m002_choromon',speciesId:'species-009',folder:'m002_choromon-hf-r01'}),
  m003:Object.freeze({entityId:'m003_nyokimon',speciesId:'species-010',folder:'m003_nyokimon-hf-r03'}),
  m004:Object.freeze({entityId:'m004_bubbmon',speciesId:'species-011',folder:'m004_bubbmon-hf-r03'}),
  m005:Object.freeze({entityId:'m005_pitchmon',speciesId:'species-012',folder:'m005_pitchmon-hf-r06'}),
  m006:Object.freeze({entityId:'m006_punimon',speciesId:'species-013',folder:'m006_punimon-hf-r06'}),
  m007:Object.freeze({entityId:'m007_botamon',speciesId:'species-014',folder:'m007_botamon-hf-r06'}),
  m008:Object.freeze({entityId:'m008_poyomon',speciesId:'species-015',folder:'m008_poyomon-hf-r03'}),
  m009:Object.freeze({entityId:'m009_mokumon',speciesId:'species-016',folder:'m009_mokumon-hf-r06'}),
  m010:Object.freeze({entityId:'m010_yukimibotamon',speciesId:'species-017',folder:'m010_yukimibotamon-hf-r01'}),
  m011:Object.freeze({entityId:'m011_yuramon',speciesId:'species-018',folder:'m011_yuramon-hf-r02'}),
  m012:Object.freeze({entityId:'m012_petimon',speciesId:'species-019',folder:'m012_petimon-hf-r03'}),
  m101:Object.freeze({entityId:'m101_caprimon',speciesId:'species-020',folder:'m101_caprimon-hf-r06'}),
  m102:Object.freeze({entityId:'m102_koromon',speciesId:'species-021',folder:'m102_koromon-hf-r03'}),
  m103:Object.freeze({entityId:'m103_tanemon',speciesId:'species-022',folder:'m103_tanemon-hf-r03'}),
  m104:Object.freeze({entityId:'m104_tunomon',speciesId:'species-023',folder:'m104_tunomon-hf-r02'}),
  m105:Object.freeze({entityId:'m105_tokomon',speciesId:'species-024',folder:'m105_tokomon-hf-r01'})
});

/** The existing HUD remains authoritative; replace one reviewed species locally. */
export async function applyCandidateCharacterHudReview({baseUrl,fetchImpl,portraits,battle}){
  const url=new URL(baseUrl),config=['localhost','127.0.0.1','[::1]'].includes(url.hostname)
    ?CONFIG[url.searchParams.get('characterArtReview')]:null;
  if(!config)throw Error('CANDIDATE_HUD_REQUIRES_LOCAL_REVIEW');
  const prefix=`assets/production/internal-character-review/${config.folder}/hud-r01/`;
  const response=await fetchImpl(new URL(prefix+'manifest.json',baseUrl));
  if(!response.ok)throw Error('CANDIDATE_HUD_REVIEW_UNAVAILABLE');
  const manifest=await response.json();
  if(manifest.entityId!==config.entityId||manifest.reviewOnly!==true||manifest.runtimeEligible!==false
    ||manifest.publicReleasePermitted!==false||manifest.portrait?.speciesId!==config.speciesId
    ||manifest.battle?.speciesId!==config.speciesId||manifest.portrait.nativeScale!==2
    ||manifest.portrait.derivation!=='ORIGINAL_CANDIDATE_MAIN_CELL_000_VISIBLE_RGBA')
    throw Error('CANDIDATE_HUD_REVIEW_INVALID');
  const baseline=battle.get(config.speciesId);
  if(!baseline||JSON.stringify(manifest.battle.sequences.map(sequence=>[sequence.id,sequence.playbackMode,
      sequence.loopStartFrame,sequence.frames.map(frame=>[frame.cell,frame.ticks])]))
    !==JSON.stringify(baseline.sequences.map(sequence=>[sequence.id,sequence.playbackMode,
      sequence.loopStartFrame,sequence.frames.map(frame=>[frame.cell,frame.ticks])])))
    throw Error('CANDIDATE_HUD_TIMING_DRIFT');
  for(const cell of [manifest.portrait,...manifest.battle.cells])if(!cell.src.startsWith(prefix)||cell.src.includes('..')
    ||!cell.origin?.every(Number.isInteger)||cell.origin.length!==2
    ||![cell.width,cell.height].every(value=>Number.isInteger(value)&&value>0&&value<=64)
    ||!/^[a-f0-9]{64}$/.test(cell.sha256))throw Error('CANDIDATE_HUD_CELL_INVALID');
  if(!baseline.sequences.every(sequence=>sequence.frames.every(frame=>manifest.battle.cells.some(cell=>cell.cell===frame.cell))))
    throw Error('CANDIDATE_HUD_CELL_MISSING');
  portraits.set(config.speciesId,manifest.portrait);
  battle.set(config.speciesId,{sequences:manifest.battle.sequences,
    cells:new Map(manifest.battle.cells.map(cell=>[cell.cell,cell]))});
}
