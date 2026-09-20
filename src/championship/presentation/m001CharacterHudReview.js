// The existing HUD remains the owner. Replace only m001 in explicit loopback review.
export async function applyM001HudReview({baseUrl,fetchImpl,portraits,battle}){
  const url=new URL(baseUrl);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.searchParams.get('characterArtReview')!=='m001')throw Error('M001_HUD_REQUIRES_LOCAL_REVIEW');
  const prefix='assets/production/internal-character-review/m001-r05-anchored/hud-r01/';
  const response=await fetchImpl(new URL(prefix+'manifest.json',baseUrl));
  if(!response.ok)throw Error('M001_HUD_REVIEW_UNAVAILABLE');
  const m=await response.json(),id='species-008';
  if(m.entityId!=='m001_zurumon'||m.reviewOnly!==true||m.runtimeEligible!==false||m.publicReleasePermitted!==false
    ||m.portrait?.speciesId!==id||m.battle?.speciesId!==id||m.portrait.nativeScale!==2
    ||m.portrait.derivation!=='SOURCE_DB_SUB_FIRST_CELL_EXACTLY_EQUALS_MAIN000_VISIBLE_RGBA')throw Error('M001_HUD_REVIEW_INVALID');
  const baseline=battle.get(id);
  if(!baseline||JSON.stringify(m.battle.sequences.map(s=>[s.id,s.playbackMode,s.loopStartFrame,s.frames.map(f=>[f.cell,f.ticks])]))
    !==JSON.stringify(baseline.sequences.map(s=>[s.id,s.playbackMode,s.loopStartFrame,s.frames.map(f=>[f.cell,f.ticks])])) )throw Error('M001_HUD_TIMING_DRIFT');
  for(const cell of [m.portrait,...m.battle.cells])if(!cell.src.startsWith(prefix)||cell.src.includes('..')
    ||!cell.origin?.every(Number.isInteger)||cell.origin.length!==2
    ||![cell.width,cell.height].every(x=>Number.isInteger(x)&&x>0&&x<=64)||!/^[a-f0-9]{64}$/.test(cell.sha256))throw Error('M001_HUD_CELL_INVALID');
  if(!baseline.sequences.every(s=>s.frames.every(f=>m.battle.cells.some(c=>c.cell===f.cell))))throw Error('M001_HUD_CELL_MISSING');
  portraits.set(id,m.portrait);
  battle.set(id,{sequences:m.battle.sequences,cells:new Map(m.battle.cells.map(c=>[c.cell,c]))});
}
