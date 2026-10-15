// Display-only alpha tracing. Source pixels are read, never changed. Limits are
// deliberately independent of quality tier so saver cannot lose wing/puppet tips.
export const MEDAL_SILHOUETTE_LIMITS=Object.freeze({sourceSide:1024,sampleSide:256,alpha:64,minComponentPixels:4,maxLoops:64,maxVertices:4096,maxEdges:20000,maxSimplifyChecks:2000000});
const fail=reason=>({ok:false,reason,shapes:[]});
const area=points=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
function contains(points,[x,y]){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function simplify(points,budget){
  // Split the closed loop at its opposite point, then iterative RDP. A sub-half
  // pixel error retains one-pixel strings/holes and bounds staircase smoothing.
  let far=1,distance=0;for(let i=1;i<points.length;i++){const d=(points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2;if(d>distance){distance=d;far=i;}}
  function part(list){const keep=new Set([0,list.length-1]),stack=[[0,list.length-1]];
    while(stack.length){const [start,end]=stack.pop(),a=list[start],b=list[end],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;let best=.45**2,index=-1;
      for(let i=start+1;i<end;i++){if(--budget.remaining<0)throw Error('simplification_limit');const p=list[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0,d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;if(d>best){best=d;index=i;}}
      if(index>=0){keep.add(index);stack.push([start,index],[index,end]);}
    }return [...keep].sort((a,b)=>a-b).map(i=>list[i]);
  }
  return [...part(points.slice(0,far+1)).slice(0,-1),...part([...points.slice(far),points[0]]).slice(0,-1)];
}
/** Accept native RGBA pixels; return normalized image-aligned outer/hole loops. */
export function traceMedalSilhouette({width,height,data}={}){
  const L=MEDAL_SILHOUETTE_LIMITS;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>L.sourceSide||height>L.sourceSide||!data||data.length!==width*height*4)return fail('invalid_alpha_pixels');
  const scale=Math.min(1,L.sampleSide/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),mask=new Uint8Array(w*h);
  // Area-averaged alpha rather than point sampling prevents isolated high-alpha
  // noise and preserves antialiased narrow features when reducing512px art.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let total=0,count=0;const y0=Math.floor(y*height/h),y1=Math.floor((y+1)*height/h),x0=Math.floor(x*width/w),x1=Math.floor((x+1)*width/w);
    for(let sy=y0;sy<y1;sy++)for(let sx=x0;sx<x1;sx++){total+=data[(sy*width+sx)*4+3];count++;}mask[y*w+x]=total/count>=L.alpha?1:0;
  }
  const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let keptPixels=0,removedPixels=0,components=0;
  for(let start=0;start<mask.length;start++){if(!mask[start]||visited[start])continue;let head=0,tail=1;queue[0]=start;visited[start]=1;
    while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(const n of [x?i-1:-1,x+1<w?i+1:-1,y?i-w:-1,y+1<h?i+w:-1])if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}}
    if(tail<L.minComponentPixels){removedPixels+=tail;for(let i=0;i<tail;i++)mask[queue[i]]=0;}else{keptPixels+=tail;components++;}
  }
  if(!keptPixels)return fail('empty_alpha');if(components>L.maxLoops)return fail('component_limit');
  const edges=[],starts=new Map(),stride=w+1;
  function edge(x,y,dx,dy,dir){const start=y*stride+x,end=(y+dy)*stride+x+dx,id=edges.length;edges.push({start,end,x,y,dir,used:false});if(!starts.has(start))starts.set(start,[]);starts.get(start).push(id);}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!mask[y*w+x])continue;
    if(!y||!mask[(y-1)*w+x])edge(x,y,1,0,0);if(x===w-1||!mask[y*w+x+1])edge(x+1,y,0,1,1);
    if(y===h-1||!mask[(y+1)*w+x])edge(x+1,y+1,-1,0,2);if(!x||!mask[y*w+x-1])edge(x,y+1,0,-1,3);
    if(edges.length>L.maxEdges)return fail('edge_limit');
  }
  const loops=[],budget={remaining:L.maxSimplifyChecks};let vertices=0;
  try{for(const first of edges){if(first.used)continue;const raw=[];let current=first;
    while(true){if(current.used)return fail('invalid_contour');current.used=true;raw.push([current.x,current.y]);if(current.end===first.start)break;
      const candidates=(starts.get(current.end)??[]).map(i=>edges[i]).filter(e=>!e.used);
      // At diagonal contacts turn right first: separate touching components,
      // rather than splicing them into a self-crossing figure-eight polygon.
      candidates.sort((a,b)=>[1,0,3,2].indexOf((a.dir-current.dir+4)%4)-[1,0,3,2].indexOf((b.dir-current.dir+4)%4));
      current=candidates[0];if(!current)return fail('open_contour');
    }
    const signedArea=area(raw);if(Math.abs(signedArea)<L.minComponentPixels)continue;
    const points=simplify(raw,budget);if(points.length<3||area(points)*signedArea<=0)return fail('collapsed_contour');
    vertices+=points.length;if(vertices>L.maxVertices)return fail('vertex_limit');loops.push({points,area:signedArea});if(loops.length>L.maxLoops)return fail('loop_limit');
  }}catch{return fail('simplification_limit');}
  const outers=loops.filter(l=>l.area>0).map(l=>({...l,holes:[]}));
  for(const hole of loops.filter(l=>l.area<0)){const parent=outers.filter(o=>contains(o.points,hole.points[0])).sort((a,b)=>a.area-b.area)[0];if(!parent)return fail('unparented_hole');parent.holes.push(hole.points);}
  if(!outers.length)return fail('no_outline');
  // Coordinates preserve the source's full canvas, padding and aspect. Do not
  // normalize individual islands, because that would move detached ornaments.
  const longest=Math.max(width,height),convert=points=>points.map(([x,y])=>[(x/w-.5)*width/longest*2.28,(.5-y/h)*height/longest*2.28]);
  return {ok:true,reason:null,width,height,sampleWidth:w,sampleHeight:h,shapes:outers.map(o=>({outer:convert(o.points),holes:o.holes.map(convert)})),stats:{components:outers.length,holes:loops.length-outers.length,vertices,edges:edges.length,keptPixels,removedPixels,maxDimension:L.sampleSide}};
}
/** One bounded read at selected texture completion; tainted/unsupported images
 * use the existing static face instead of inventing a generic circular base. */
export function readMedalSilhouette(image,doc){
  const width=image?.naturalWidth??image?.width,height=image?.naturalHeight??image?.height,L=MEDAL_SILHOUETTE_LIMITS;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>L.sourceSide||height>L.sourceSide)return fail('invalid_image_size');
  let canvas;
  try{canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return fail('alpha_read_unavailable');context.drawImage(image,0,0,width,height);return traceMedalSilhouette(context.getImageData(0,0,width,height));}
  catch{return fail('alpha_read_failed');}finally{if(canvas){canvas.width=1;canvas.height=1;}}
}
