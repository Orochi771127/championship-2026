// Published site limit, checked against the actual output bytes before upload.
// https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
export const PAGES_SITE_BYTE_LIMIT=1_000_000_000;
export function assertPagesPayloadSize(files,limit=PAGES_SITE_BYTE_LIMIT){
 let bytes=0;
 for(const file of files){
  if(!Number.isSafeInteger(file.bytes)||file.bytes<0)throw Error('PUBLIC_PAGES_FILE_SIZE_INVALID: '+file.path);
  bytes+=file.bytes;
  if(!Number.isSafeInteger(bytes)||bytes>limit)throw Error('PUBLIC_PAGES_SITE_SIZE: '+bytes+' > '+limit);
 }
 return bytes;
}
/**
 * The rows that count toward the published site. The deploy builds with
 * --external-characters, so character art (CHARACTER_ASSET_PREFIX) lives on its
 * own host, which validate-character-asset-release.mjs sizes on its own. A plain
 * build (CI and browser jobs) still copies that art locally for its tests; it is
 * left out of this count so the gate measures the site that is actually deployed.
 */
export function deployedPagesRows(rows,{external=false,characterPrefix}={}){
 if(external||!characterPrefix)return rows;
 return rows.filter(row=>!row.path.startsWith(characterPrefix));
}
