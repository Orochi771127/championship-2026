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
