import * as THREE from '../../../node_modules/three/build/three.module.js';

// Owner 2026-11-03: ground decals (contact shadow, selection ring, bloodline ring)
// lie on the floor the player sees. Several cages carry thin cosmetic sheets --
// the sports field's grass and track, sand, snow -- a few hundredths above the
// walk height, and a decal drawn at the walk height was hidden under them.
// Walking, support and actor depth keep the walk height; only decals use this.
export const RANCH_DECAL_FLOOR=Object.freeze({
  // Grid cell in world units (16 native px per unit).
  cell:.25,
  // Highest sheet a decal may follow above the walk height; props are taller.
  maxRise:.06,
  // A face counts as floor when its normal is this close to straight up.
  minUp:.97
});

const keyOf=(i,j)=>i+','+j;

/** Model-local floor heights: every near-horizontal face, per grid cell. */
export function createRanchDecalFloorGrid(root,{cell=RANCH_DECAL_FLOOR.cell,minUp=RANCH_DECAL_FLOOR.minUp}={}){
  const cells=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();
  const add=(i,j,y)=>{const key=keyOf(i,j),list=cells.get(key);if(!list)cells.set(key,[y]);else if(!list.includes(y))list.push(y);};
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    const position=mesh.isMesh?mesh.geometry?.attributes?.position:null;
    if(!position)return;
    const index=mesh.geometry.index,count=index?index.count:position.count;
    for(let t=0;t+2<count;t+=3){
      const [ia,ib,ic]=index?[index.getX(t),index.getX(t+1),index.getX(t+2)]:[t,t+1,t+2];
      a.fromBufferAttribute(position,ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position,ib).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position,ic).applyMatrix4(mesh.matrixWorld);
      u.subVectors(b,a);v.subVectors(c,a);u.cross(v);
      const length=u.length();if(!(length>0)||Math.abs(u.y)/length<minUp)continue;
      // The highest corner, so a decal never sinks into a gently sloped sheet.
      const y=Math.round(Math.max(a.y,b.y,c.y)*1000)/1000;
      const i0=Math.floor(Math.min(a.x,b.x,c.x)/cell),i1=Math.floor(Math.max(a.x,b.x,c.x)/cell);
      const j0=Math.floor(Math.min(a.z,b.z,c.z)/cell),j1=Math.floor(Math.max(a.z,b.z,c.z)/cell);
      let hit=false;
      for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
        const x=(i+.5)*cell,z=(j+.5)*cell;
        const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(d===0)continue;
        const l1=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,l2=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;
        if(l1>=0&&l2>=0&&l1+l2<=1){add(i,j,y);hit=true;}
      }
      // A face smaller than a cell still marks the cell holding its centre.
      if(!hit)add(Math.floor((a.x+b.x+c.x)/3/cell),Math.floor((a.z+b.z+c.z)/3/cell),y);
    }
  });
  const keys=[...cells.keys()].map(k=>k.split(',').map(Number));
  const bounds=keys.length?{i0:Math.min(...keys.map(k=>k[0])),i1:Math.max(...keys.map(k=>k[0])),j0:Math.min(...keys.map(k=>k[1])),j1:Math.max(...keys.map(k=>k[1]))}:null;
  return Object.freeze({cell,cells,bounds});
}

/**
 * The highest floor sheet within `radius` of world (x, z), above the walk height
 * `base` by at most maxRise; `base` when no such sheet exists. Cages are only
 * translated in the ranch, so a placement's local point is world minus offset.
 */
export function ranchDecalFloorHeight(placed,x,z,base,radius=0,{maxRise=RANCH_DECAL_FLOOR.maxRise}={}){
  let height=base;
  for(const {grid,offset} of placed){
    const lx=x-offset.x,lz=z-offset.z,r=Math.max(0,radius),cell=grid.cell,box=grid.bounds;
    const i0=Math.floor((lx-r)/cell),i1=Math.floor((lx+r)/cell),j0=Math.floor((lz-r)/cell),j1=Math.floor((lz+r)/cell);
    if(!box||i1<box.i0||i0>box.i1||j1<box.j0||j0>box.j1)continue;
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
      const list=grid.cells.get(keyOf(i,j));if(!list)continue;
      for(const local of list){const y=local+offset.y;if(y>height&&y<=base+maxRise)height=y;}
    }
  }
  return height;
}
