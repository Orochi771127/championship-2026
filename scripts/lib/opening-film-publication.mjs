import {OPENING_FILM,OPENING_FILM_ENABLED} from '../../src/championship/app/openingFilm.js';

const root='assets/production/opening-film-ns33-r1/';
const webFiles=Object.freeze([
 {path:OPENING_FILM.webSrc,sha256:OPENING_FILM.webSha256},
 {path:OPENING_FILM.poster,sha256:OPENING_FILM.posterSha256}
].map(Object.freeze));

export function openingFilmPublicationFiles(enabled=OPENING_FILM_ENABLED){return enabled?[...webFiles]:[];}
export function assertOpeningFilmPublication(files,enabled=OPENING_FILM_ENABLED){
 const selected=files.filter(file=>file.startsWith(root)).sort();
 const expected=openingFilmPublicationFiles(enabled).map(row=>row.path).sort();
 if(JSON.stringify(selected)!==JSON.stringify(expected))throw Error('TITLE_FILM_PUBLICATION_POLICY');
 return {enabled,files:selected.length};
}
