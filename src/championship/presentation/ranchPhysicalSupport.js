// Exact six low ground fields plus admitted CM18 treads / CM34 mat. Not navigation authority.
export const SUPPORT_METADATA_SHA='a92e0a1931d30b972f18b6f0a69b21c59e8349013fe2dff7d9ce74de4c4ec516';
export const SUPPORT_MAX_TRIANGLES=72;
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function loadSupportMetadata(text){
 if(typeof text!=='string'||await sha256(new TextEncoder().encode(text))!==SUPPORT_METADATA_SHA)throw Error('SUPPORT_METADATA_HASH_MISMATCH');
 const data=JSON.parse(text);
 if(data.schema!==1||data.fields.length!==8||data.fields.reduce((n,f)=>n+f.primitives.reduce((m,p)=>m+p.triangles.length,0),0)!==156)throw Error('SUPPORT_METADATA_SCHEMA');
 return new Map(data.fields.map(f=>[f.fieldId,f]));
}
export async function validateSupportGeometry(spec,modelSha,meshes){
 if(spec.glbSha256!==modelSha)throw Error('SUPPORT_MODEL_HASH_MISMATCH');
 if(spec.primitives.length!==1||meshes.length!==1)throw Error('SUPPORT_PRIMITIVE_COUNT');
 const p=spec.primitives[0],mesh=meshes[0],g=mesh.geometry,pos=g.attributes.position,idx=g.index;
 if(p.nodeIndex!==0||p.meshIndex!==0||p.primitiveIndex!==0||!pos||!idx||pos.count!==p.positionCount||idx.count!==p.triangleCount*3)throw Error('SUPPORT_GEOMETRY_SHAPE');
 const xyz=new Float32Array(pos.count*3),indices=new Uint32Array(idx.count);
 for(let i=0;i<pos.count;i++){xyz[i*3]=pos.getX(i);xyz[i*3+1]=pos.getY(i);xyz[i*3+2]=pos.getZ(i);}
 for(let i=0;i<idx.count;i++)indices[i]=idx.getX(i);
 if(await sha256(xyz.buffer)!==p.positionSha256Float32LE||await sha256(indices.buffer)!==p.indexSha256Uint32LE)throw Error('SUPPORT_GEOMETRY_HASH_MISMATCH');
 if(p.triangles.length>SUPPORT_MAX_TRIANGLES)throw Error('SUPPORT_TRIANGLE_BUDGET');
 for(const t of p.triangles){
  if(!Number.isInteger(t.sourceTriangleIndex)||t.sourceTriangleIndex<0||t.sourceTriangleIndex>=p.triangleCount)throw Error('SUPPORT_TRIANGLE_INDEX');
  for(let v=0;v<3;v++)for(let k=0;k<3;k++)if(xyz[indices[t.sourceTriangleIndex*3+v]*3+k]!==t.vertices[v][k])throw Error('SUPPORT_TRIANGLE_VERTEX_MISMATCH');
  if(!t.vertices.every(v=>v.every(Number.isFinite)&&v[1]===t.supportY))throw Error('SUPPORT_NON_HORIZONTAL');
 }
 return p.triangles;
}
export function eligibleSupportOwner(owner,instances,{requireRenderVisible=true}={}){
 if(!owner||owner.groundComponent!=='NOMINAL_GROUND'||!Number.isInteger(owner.ownerIndex)||!Number.isFinite(owner.shift)||typeof owner.fieldId!=='string')return {status:'DENIED_MISSING_OWNER',instance:null};
 const matched=instances.filter(i=>i.p.ownerIndex===owner.ownerIndex&&i.p.fieldId===owner.fieldId&&i.shift===owner.shift);
 if(matched.length!==1)return {status:'DENIED_OWNER_NOT_UNIQUE',instance:null};
 if(!matched[0].supportMesh)return {status:'DENIED_UNVERIFIED_GEOMETRY',instance:null};
 if(requireRenderVisible&&matched[0].object?.visible===false)return {status:'DENIED_INVISIBLE_SUPPORT',instance:null};
 for(let o=matched[0].supportMesh;o;o=o.parent)if(o.visible===false&&(requireRenderVisible||o!==matched[0].object))return {status:'DENIED_INVISIBLE_SUPPORT',instance:null};
 return {status:'VERIFIED_OWNER',instance:matched[0]};
}
// Coordinates are normalized screen (bottom-left). Identical endpoints use
// identical edge arithmetic on both triangles, including the inclusive edge.
export function encodeProjectedTriangle(vertices,height){
 const area=(vertices[1][0]-vertices[0][0])*(vertices[2][1]-vertices[0][1])-(vertices[1][1]-vertices[0][1])*(vertices[2][0]-vertices[0][0]);
 if(!Number.isFinite(area)||area===0)throw Error('SUPPORT_DEGENERATE_PROJECTED_TRIANGLE');
 const out=new Float32Array(16),signs=[];
 for(let e=0;e<3;e++){
  let a=vertices[e],b=vertices[(e+1)%3];const c=vertices[(e+2)%3];
  if(a[0]>b[0]||(a[0]===b[0]&&a[1]>b[1]))[a,b]=[b,a];
  out.set([...a,...b],e*4);
  signs.push(Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])));
 }
 out.set([height,...signs],12);return out;
}
export function projectedTriangleTouchesBox(v,b){return Math.max(...v.map(p=>p[0]))>=b.minX&&Math.min(...v.map(p=>p[0]))<=b.maxX&&Math.max(...v.map(p=>p[1]))>=b.minY&&Math.min(...v.map(p=>p[1]))<=b.maxY;}
