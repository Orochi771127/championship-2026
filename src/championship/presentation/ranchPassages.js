// Ground-level connectors consume the exact navigation routes. They are
// below actors and existing foreground occluders; no mask or sort override.
export function withRanchPassages({PIXI,art,connections=[]}){
  if(!connections.length||!art?.field?.productGrid)return art;
  const unit=art.field.nativePixelWorldScale??4,graphic=new PIXI.Graphics();
  graphic.label='ranch connected passages';graphic.eventMode='none';
  const path=(points,width,color)=>{graphic.moveTo(points[0][0]*unit,points[0][1]*unit);
    for(const [x,y] of points.slice(1))graphic.lineTo(x*unit,y*unit);
    graphic.stroke({width:width*unit,color,cap:'round',join:'round'});};
  for(const connection of connections){
    // A small raised-free sandstone walkway covers only the opened joint.
    // The rest of an obstacle-bearing rim remains a readable boundary.
    path(connection.route,22,0x6b7660);
    path(connection.route,18,0xdedac2);
    for(const [x,y] of connection.route){
      graphic.roundRect((x-5)*unit,(y-3)*unit,10*unit,6*unit,1.5*unit).fill({color:0xf0ecd7,alpha:.65});
    }
  }
  art.displayObject.addChild(graphic);
  let disposed=false;
  return Object.freeze({...art,getDiagnostics(){return {...art.getDiagnostics(),ranchPassages:connections.length};},
    async dispose(){if(disposed)return;disposed=true;graphic.parent?.removeChild(graphic);graphic.destroy();await art.dispose();}});
}
