// Owner identified these Claude-authored sports-park frames on 2026-10-21.
// Select their matching art/layer provenance together; do not select by mtime.
import sports from '../../data/championship/catalogs/ranch-sports-art.r1.json' with {type:'json'};
const selected=new Map(sports.fields.map(f=>[f.fieldId,f]));
export function selectRanchCageArt(manifest){
  return {...manifest,fields:manifest.fields.map(f=>selected.get(f.fieldId)??f)};
}
export function ranchCageLayerGroups(manifest,placements){
  if(manifest.assetId===sports.sourceAssetId)return [{manifest,placements}];
  const groups=[{manifest,placements:placements.filter(p=>!selected.has(p.fieldId))},
    {manifest:{...manifest,assetId:sports.sourceAssetId},placements:placements.filter(p=>selected.has(p.fieldId))}];
  return groups.filter(g=>g.placements.length);
}
export function selectedRanchSportsField(fieldId){return selected.get(fieldId)??null;}
