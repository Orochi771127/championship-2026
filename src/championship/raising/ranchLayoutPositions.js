// Move occupants with the physical facility they are currently visiting.
// Home assignment and care state remain in the existing Raising owner.
export function ranchPositionAfterLayout(oldGround,nextGround,positionQ12,homeReference){
  const world=positionQ12.map(n=>n/4096);
  const physical=oldGround.navigation?.ownerAt(world)??oldGround.placement(homeReference);
  const next=nextGround.placement(physical?.instanceId??homeReference)??nextGround.placement(homeReference)??nextGround.placement(35);
  if(!physical||!next)return [...positionQ12];
  const oldOrigin=oldGround.origin(physical.instanceId??physical.definitionIndex),origin=nextGround.origin(next.instanceId??next.definitionIndex);
  const proposed=[origin[0]+world[0]-oldOrigin[0],origin[1]+world[1]-oldOrigin[1]];
  const valid=(x,y)=>nextGround.readTerrain(Math.floor(x/8),Math.floor(y/8))!==1
    &&nextGround.cageAt(x,y)?.ownerIndex===next.ownerIndex;
  if(valid(...proposed))return [Math.round(proposed[0]*4096),Math.round(proposed[1]*4096),positionQ12[2]];
  let nearest=null;
  for(let y=0;y<nextGround.height;y++)for(let x=0;x<nextGround.width;x++){
    const px=x*8+4,py=y*8+4;if(!valid(px,py))continue;
    const distance=(px-proposed[0])**2+(py-proposed[1])**2;
    if(!nearest||distance<nearest.distance)nearest={distance,x:px,y:py};
  }
  if(!nearest)throw Error('RANCH_LAYOUT_NO_SAFE_POSITION');
  return [nearest.x*4096,nearest.y*4096,positionQ12[2]];
}
