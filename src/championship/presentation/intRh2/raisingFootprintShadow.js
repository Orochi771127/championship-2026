// Contact shadow for every resident without a pixel-reviewed contact (shadow audit 2026-10-30,
// 2,898 ranch frames). On a 40-degree ground the lowest drawn pixel is the NEAREST foot, so the
// footprint lies behind it: the ellipse sits mostly under the body and only `front` of its depth
// shows in front of the feet. Its depth/width ratio is that of a ground ellipse at the ranch pitch,
// capped by the drawn height (a lying body is shallow), and a hovering frame keeps the shadow on
// the ground, smaller and lighter. The table gives each species' measured lower-body centre and
// width per ranch sequence (fractions of the drawn width).
import table from '../../../data/championship/raising-contact-footprints.v1.json' with {type:'json'};
import {RANCH_DEFAULT_VIEW_PITCH} from '../ranchThreeCoordinates.js';

export const RAISING_FOOTPRINT=Object.freeze({front:table.front,depthPerHeight:table.depthPerHeight,minDepth:table.minDepth,
  ratio:Math.sin(RANCH_DEFAULT_VIEW_PITCH*Math.PI/180)*table.depth});
const rows=new Map(table.rows.map(([id,sequence,offset,lower])=>[`${id}:${sequence}`,Object.freeze([offset,lower])]));
export function raisingFootprintRow(speciesId,sequenceId){
  return rows.get(`${speciesId?.replace(/^championship:creature:/,'')}:${sequenceId}`)??table.default;
}
// visible: drawn bounds in actor-local native px, ground at y = 0, already flipped when flipX.
export function getRaisingFootprintShadow(speciesId,sequenceId,visible,flipX=false){
  const {x,y,width,height}=visible??{};
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
  const [offset,lower]=raisingFootprintRow(speciesId,sequenceId),bottom=y+height;
  const hover=1/(1+Math.max(0,-bottom)/height);
  const radiusX=Math.min(Math.max(lower/2,.25),.46)*width*hover;
  const radiusY=Math.max(Math.min(radiusX*RAISING_FOOTPRINT.ratio,height*RAISING_FOOTPRINT.depthPerHeight),RAISING_FOOTPRINT.minDepth);
  return {x:x+width/2+offset*width*(flipX?-1:1),y:Math.max(bottom,0)-(1-RAISING_FOOTPRINT.front)*radiusY,radiusX,radiusY,alpha:hover};
}
