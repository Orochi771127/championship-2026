import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {ranchBorderWithinSharedSegments} from '../src/championship/presentation/ranchBorderMembership.js';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/ranch-v4/cm07-border-fixtures.json',import.meta.url)));
const metadata=JSON.parse(fs.readFileSync(new URL('./fixtures/ranch-v4/cm07-metadata.json',import.meta.url))).find(r=>r.id==='field_cm07_01').metadata;
const nodes=metadata.nodes.filter(n=>/joint|fascia|rim-light/.test(n.name));
const world=(x,y)=>new THREE.Vector3((x+y/Math.sin(52*Math.PI/180))/(16*Math.SQRT2),0,(-x+y/Math.sin(52*Math.PI/180))/(16*Math.SQRT2));
let checks=0;
for(const c of fixtures.cases)for(const wrap of [-960,0,960])for(const nested of [false,true]){
 const root=new THREE.Group();root.position.copy(world(c.left*13+wrap,c.left*7));
 const parent=new THREE.Group();
 if(nested){parent.position.set(1.25,.35,-.75);parent.rotation.set(.3,.5,.2);parent.scale.setScalar(1.3);parent.updateMatrix();}
 root.add(parent);
 for(const n of nodes){
  const ac=metadata.accessors[metadata.meshes[n.mesh].primitives[0].attributes.POSITION];
  const geom=new THREE.BufferGeometry();geom.boundingBox=new THREE.Box3(new THREE.Vector3(...ac.min),new THREE.Vector3(...ac.max));
  const mesh=new THREE.Mesh(geom);mesh.position.fromArray(n.translation??[0,0,0]);mesh.quaternion.fromArray(n.rotation??[0,0,0,1]);mesh.scale.fromArray(n.scale??[1,1,1]);mesh.updateMatrix();
  if(nested){mesh.matrix.premultiply(parent.matrix.clone().invert());mesh.matrixAutoUpdate=false;}
  parent.add(mesh);root.updateMatrixWorld(true);
  const box=geom.boundingBox,corners=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const v=root.worldToLocal(mesh.localToWorld(new THREE.Vector3(x,y,z)));corners.push({x:v.x,z:v.z});
  }
  const expected=ranchBorderWithinSharedSegments(fixtures.nodes.find(f=>f.name===n.name).points,c.sharedEdges);
  assert.equal(ranchBorderWithinSharedSegments(corners,c.sharedEdges),expected,`${c.left}/${c.right}/wrap${wrap}/nested${nested}/${n.name}`);checks++;
  parent.remove(mesh);geom.dispose();mesh.material.dispose();
 }
}
console.log(JSON.stringify({status:'PASS_THREE_MATH_NOT_WEBGL',threeRevision:THREE.REVISION,legalAdjacentPairs:fixtures.cases.length,wraps:[-960,0,960],hierarchies:['direct','nested_translation_rotation_uniformscale'],classifications:checks}));
