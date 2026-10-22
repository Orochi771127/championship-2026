// Authored raised treads/mat only. Not a global height or navigation override.
export const CONTACT_HEIGHT_FIELDS=new Set(['field_cm18_01','field_cm34_01']);
export function transformContactTriangles(triangles,m){
 if(!Array.isArray(m)&&!ArrayBuffer.isView(m))throw Error('CONTACT_MATRIX_REQUIRED');
 if(m.length!==16||!Array.from(m).every(Number.isFinite)||Math.abs(m[1])+Math.abs(m[9])>1e-12||m[5]<=0||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)throw Error('CONTACT_TRANSFORM_NOT_HORIZONTAL_AFFINE');
 return triangles.map(t=>({...t,vertices:t.vertices.map(([x,y,z])=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]])}));
}
export function contactHeightAtPoint(triangles,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 const hits=[];
 for(const t of triangles){
  const [a,b,c]=t.vertices;if(![a,b,c].every(v=>v.length===3&&v.every(Number.isFinite))||Math.abs(a[1]-b[1])+Math.abs(a[1]-c[1])>1e-10)throw Error('CONTACT_WORLD_TRIANGLE_NOT_HORIZONTAL');
  const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(area)<1e-16)throw Error('CONTACT_DEGENERATE_TRIANGLE');
  const scale=Math.max(1,...[[a,b],[b,c],[c,a]].map(([v,w])=>(v[0]-w[0])**2+(v[2]-w[2])**2)),epsilon=1e-12*scale,sign=Math.sign(area);
  if([[a,b],[b,c],[c,a]].every(([v,w])=>sign*((w[0]-v[0])*(z-v[2])-(w[2]-v[2])*(x-v[0]))>=-epsilon))hits.push({height:a[1],sourceTriangleIndex:t.sourceTriangleIndex});
 }
 // Only exact containing authored triangles participate. Shared-edge ties choose
 // upper incident tread, then smallest immutable source index; input order irrelevant.
 hits.sort((a,b)=>b.height-a.height||a.sourceTriangleIndex-b.sourceTriangleIndex);
 return hits.length?{...hits[0],containingSourceTriangleIndices:hits.map(h=>h.sourceTriangleIndex),kind:'AUTHORED_POINT_CONTACT_HEIGHT'}:null;
}

// Separate, explicitly derived collision surfaces. Never physical render/support triangles.
export const LOGICAL_BRIDGES_SHA='8f6a8eec7fa71381de68f5dc0f7b30399bf89d62e91742281a60bb7e43293a50';
export async function loadLogicalBridges(text,physicalFields){
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!==LOGICAL_BRIDGES_SHA)throw Error('LOGICAL_BRIDGES_HASH_MISMATCH');
 const data=JSON.parse(text),spec=physicalFields.get(data.fieldId);
 if(data.fieldId!=='field_cm18_01'||!spec||spec.glbSha256!==data.glbSha256||data.sourceMetadataSha256!=='a8c073714c9457a880f6df0b5424fbed00d28ca64a2d10925b04a3068767f599'||data.bridges.length!==4)throw Error('LOGICAL_BRIDGES_AUTHORITY_MISMATCH');
 return data.bridges.flatMap(b=>b.indices.map((indices,i)=>({bridgeId:b.id,fromSheet:b.fromSheet,toSheet:b.toSheet,logicalTriangleIndex:i,vertices:indices.map(k=>b.vertices[k])})));
}
export function logicalContactHeightAtPoint(triangles,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 const hits=[];
 for(const t of triangles){
  const [a,b,c]=t.vertices;
  if(![a,b,c].every(v=>v.length===3&&v.every(Number.isFinite)))throw Error('LOGICAL_CONTACT_NONFINITE');
  const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
  if(Math.abs(area)<1e-16)throw Error('LOGICAL_CONTACT_DEGENERATE');
  const scale=Math.max(1,...[[a,b],[b,c],[c,a]].map(([v,w])=>(v[0]-w[0])**2+(v[2]-w[2])**2)),epsilon=1e-12*scale,sign=Math.sign(area);
  if(![[a,b],[b,c],[c,a]].every(([v,w])=>sign*((w[0]-v[0])*(z-v[2])-(w[2]-v[2])*(x-v[0]))>=-epsilon))continue;
  const wb=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/area,wc=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/area;
  hits.push({height:a[1]+wb*(b[1]-a[1])+wc*(c[1]-a[1]),bridgeId:t.bridgeId,fromSheet:t.fromSheet,toSheet:t.toSheet,logicalTriangleIndex:t.logicalTriangleIndex,kind:'DERIVED_LOGICAL_STAIR_CONTACT_HEIGHT'});
 }
 hits.sort((a,b)=>b.height-a.height||a.bridgeId.localeCompare(b.bridgeId)||a.logicalTriangleIndex-b.logicalTriangleIndex);
 return hits[0]??null;
}
