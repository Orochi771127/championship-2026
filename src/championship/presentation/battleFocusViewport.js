/** Phone composition over the existing authored stand positions. The ROM's
 * Q12 zoom is retained; focus centre adapts to this single field viewport.
 * This is not the unported DS world-camera/approach coordinate transform.
 */
export function battleFocusViewport({width,height,anchorX,anchorY,zoomQ12=4096,reducedMotion=false}) {
  const zoom = reducedMotion ? 1 : zoomQ12/4096;
  const weight = zoom-1;
  const x = (width*.5-anchorX)*weight + anchorX*(1-zoom);
  const y = (height*.65-anchorY)*weight + anchorY*(1-zoom);
  return Object.freeze({zoom,x,y,anchorX:anchorX*zoom+x,anchorY:anchorY*zoom+y});
}

// Decorative replacement for the observed digital curtains. No gameplay or
// randomness; pixel/scroll identity awaits the original 24-strip asset binding.
export function drawBattleDigitalCurtain(graphic,width,height,focus,reducedMotion) {
  graphic.clear();
  if (!focus?.overlayVisible) return;
  const size = Math.max(5,width/52), band = height*.2;
  const shift = reducedMotion ? 0 : focus.frame*size/8;
  graphic.rect(0,0,width,band).fill({color:0x004981,alpha:focus.overlayAlpha*.23});
  graphic.rect(0,height-band,width,band).fill({color:0x004981,alpha:focus.overlayAlpha*.23});
  for(let side=0;side<2;side++)for(let row=0;row<3;row++)for(let col=-2;col<38;col++){
    const x=((col*size*1.7+shift*(row%2?-1:1))%(width+size*2)+width+size*2)%(width+size*2)-size;
    const y=side ? height-(row+1)*size*2 : row*size*2;
    if ((col+row*3+side)%3===0) graphic.moveTo(x+size/2,y).lineTo(x+size/2,y+size*1.4);
    else graphic.rect(x,y,size*.85,size*1.4);
  }
  graphic.stroke({color:0x00b9ff,alpha:focus.overlayAlpha*.65,width:Math.max(1,size*.13)});
}
