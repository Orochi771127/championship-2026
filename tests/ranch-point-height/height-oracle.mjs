// TEST ONLY: independent native-XY barycentric oracle, no production sampler imports.
export function expectedHeight(metadata,bridges,fieldId,local){
 const hits=[];
 const weights=t=>{const [[ax,ay],[bx,by],[cx,cy]]=t,det=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(det)<1e-12)return null;const b=((local[0]-ax)*(cy-ay)-(local[1]-ay)*(cx-ax))/det,c=((bx-ax)*(local[1]-ay)-(by-ay)*(local[0]-ax))/det,a=1-b-c;return Math.min(a,b,c)>=-1e-8?[a,b,c]:null;};
 for(const sheet of metadata.fields.find(f=>f.fieldId===fieldId).supportSheets)for(const t of sheet.nativeGroundProjectionTriangles)if(weights(t))hits.push({height:sheet.height,kind:'physical',sheet:sheet.id});
 if(hits.length)return hits.sort((a,b)=>b.height-a.height)[0];
 if(fieldId===bridges.fieldId)for(const bridge of bridges.bridges)for(const indices of bridge.indices){const w=weights(indices.map(i=>bridge.pointLocalNative[i]));if(w)hits.push({height:w.reduce((sum,v,i)=>sum+v*bridge.vertices[indices[i]][1],0),kind:'logical',bridgeId:bridge.id});}
 return hits.length?hits.sort((a,b)=>b.height-a.height)[0]:null;
}
