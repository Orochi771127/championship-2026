// Dex display renditions re-encoded for the web on 2026-10-29 (Owner approved). The approval
// ledgers pinned the lossless renditions published before that; map a published row back to the
// rendition it supersedes, as the display rendition recipe records it, so they still verify.
const fs=require('node:fs'),path=require('node:path');
const recipe=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','docs/contracts/championship/DATABASE_HERO_DISPLAY_RENDITIONS.v1.json'),'utf8'));
const webRenditions=new Map(recipe.rows.filter(row=>row.display.supersedes).map(row=>[row.display.src,row.display]));
function beforeWebRendition(entry){
  const web=entry&&webRenditions.get(entry.src);
  return web&&web.sha256===entry.sha256?{...entry,src:web.supersedes.src,sha256:web.supersedes.sha256}:entry;
}
module.exports={beforeWebRendition,webRenditions};
