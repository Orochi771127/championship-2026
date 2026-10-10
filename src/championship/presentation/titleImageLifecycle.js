// Keep decoded title art and stop unfinished image downloads once it is hidden.
// Returning to the same title restores the same URLs; no art or save changes.
export function createTitleImageLifecycle(title) {
  const images=[...title.querySelectorAll('img')].map(image=>({image,src:image.getAttribute('src'),released:false}));
  const panel=title.querySelector?.('.cm-title__panel');
  const originalBackground=panel?.style.backgroundImage??'';
  const backgroundUrl=panel?globalThis.getComputedStyle?.(panel)?.backgroundImage?.match(/^url\(["']?(.*?)["']?\)$/)?.[1]:null;
  let backgroundReleased=false;
  const backgroundReady=()=>backgroundUrl&&(globalThis.performance?.getEntriesByName?.(backgroundUrl)??[])
    .some(entry=>entry.responseEnd>0&&entry.decodedBodySize>0&&(!('responseStatus' in entry)||entry.responseStatus===200));
  return function syncTitleImages(paused=title.hidden) {
    for(const entry of images){
      if(paused&&!entry.image.complete&&entry.src&&!entry.released){
        entry.image.removeAttribute('src');entry.released=true;
      }else if(!paused&&entry.released){
        entry.image.setAttribute('src',entry.src);entry.released=false;
      }
    }
    if(paused&&panel&&!backgroundReleased&&!backgroundReady()){
      panel.style.backgroundImage='none';backgroundReleased=true;
    }else if(!paused&&backgroundReleased){
      panel.style.backgroundImage=originalBackground;backgroundReleased=false;
    }
  };
}
