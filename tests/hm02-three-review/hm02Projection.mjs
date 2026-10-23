export function projection(spec) {
  if (spec?.worldWidthPx !== 2880 || spec.worldHeightPx !== 2880 || spec.unitsPerWorldPixel !== 1/45 || spec.elevationDegrees !== 55) throw new Error('HM02_UNVERIFIED_PROJECTION');
  const s=Math.sin(55*Math.PI/180), c=Math.cos(55*Math.PI/180), k=45;
  return Object.freeze({
    s,c,k,
    ground(x,y,height=0) { return [(x-1440)/k,height,(y-1440+k*c*height)/(k*s)]; },
    screen([x,h,z]) { return [1440+k*x,1440+k*s*z-k*c*h]; },
    // Explicit native-origin -> ground support offset. Never anchor to texture trim.
    actorVertex({worldX,worldY,worldZ=0,supportOffsetY,groundHeight},dx,dy) {
      if (![worldX,worldY,worldZ,supportOffsetY,groundHeight,dx,dy].every(Number.isFinite)) throw new Error('HM02_ACTOR_SUPPORT_REQUIRED');
      const base=this.ground(worldX,worldY+supportOffsetY,groundHeight);
      return [base[0]+dx/k,base[1]+(supportOffsetY-dy+worldZ)/(k*c),base[2]];
    },
    viewport(view,width,height) {
      const scale=view.transform.scale, rect=view.viewRect??view.camera, o=view.viewportOffset??{x:0,y:0};
      if (!(scale>0)) throw new Error('HM02_INVALID_SCALE');
      return {center:this.ground(rect.left+(width/2-o.x)/scale,rect.top+(height/2-o.y)/scale),halfWidth:width/(2*scale*k),halfHeight:height/(2*scale*k)};
    }
  });
}
export function hm02PilotAllowed({enabled=false,fieldId,manifest,renderer,reviewHarness=false}) {
  return enabled===true && ['field_hm02_01','field_hm02_02'].includes(fieldId)
    && manifest?.schema==='HM02_THREE_PILOT.v1' && (manifest?.qaApproved===true || reviewHarness===true)
    && renderer?.gl?.getContextAttributes?.().stencil===true
    && typeof renderer.resetState==='function';
}
