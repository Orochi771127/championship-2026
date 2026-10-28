import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedReleasePoint, releaseOffset, reviewedIdleBreath, reviewedWinHop, reviewedMoveRate, REVIEWED_WALK_REFERENCE}
  from '../src/championship/presentation/dataArena/dataArenaReviewedMotion.js';

const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} ≈ ${b}`);

test('default release point leaves at chest height and reaches along the aim',()=>{
  const right=reviewedReleasePoint({x:100,y:200,angle:0,roleHeight:80});
  close(right.x,100+80*.38);close(right.y,200-80*.55);
  const down=reviewedReleasePoint({x:100,y:200,angle:Math.PI/2,roleHeight:80});
  close(down.x,100);close(down.y,200-80*.55+80*.38*.6);
  const left=reviewedReleasePoint({x:100,y:200,angle:Math.PI,roleHeight:80});
  assert.ok(left.x<100&&right.x>100,'reach follows the aim on both sides');
});
test('authored release points follow the sprite scale, mirror and ground shift',()=>{
  const release={frameIndex:2,point:[40,-120]};
  const facingRight=reviewedReleasePoint({x:10,y:20,angle:0,roleHeight:80,release,scaleX:.25,scaleY:.25});
  close(facingRight.x,10+10);close(facingRight.y,20-30);
  const mirrored=reviewedReleasePoint({x:10,y:20,angle:Math.PI,roleHeight:80,release,scaleX:-.25,scaleY:.25});
  close(mirrored.x,10-10);
  const grounded=reviewedReleasePoint({x:10,y:20,angle:0,roleHeight:80,release,scaleX:.25,scaleY:.25,groundShift:3,density:4});
  close(grounded.y,20+(-120-12)*.25);
});
test('a released shot eases from the release point onto its path and stays there',()=>{
  assert.deepEqual(releaseOffset(null,0),[0,0]);
  assert.deepEqual(releaseOffset([30,-20],0),[30,-20]);
  const mid=releaseOffset([30,-20],.06);
  assert.ok(mid[0]>0&&mid[0]<30*.5,'ease-out: most of the gap closes in the first half');
  assert.deepEqual(releaseOffset([30,-20],.12),[0,-0]);
  assert.deepEqual(releaseOffset([30,-20],5),[0,-0]);
});
test('idle breathing, victory hops and walk cadence stay small and bounded',()=>{
  for(let t=0;t<4;t+=.05){
    const breath=reviewedIdleBreath(t,1.3);assert.ok(breath>=.985-1e-12&&breath<=1.015+1e-12);
    const hop=reviewedWinHop(t);assert.ok(hop>=0&&hop<=9+1e-12);
  }
  close(reviewedWinHop(0),0);close(reviewedWinHop(.55),0,1e-9);
  close(reviewedMoveRate(REVIEWED_WALK_REFERENCE,0),1);
  close(reviewedMoveRate(0,0),.6);close(reviewedMoveRate(2000,0),1.6);
  close(reviewedMoveRate(150,200),1);
});
test('the arena scene wires reviewed motion into sampling, release effects and shots',()=>{
  const scene=readFileSync(new URL('../src/championship/presentation/dataArena/dataArenaPixiScene.js',import.meta.url),'utf8');
  assert.match(scene,/moveRate:reviewedMoveRate\(vx,vy\),victory:seq===DATA_ARENA_SEQUENCES\.WIN/);
  assert.match(scene,/releasePoint\(angle\)\{\s*if\(!reviewedArena\)return null;/);
  assert.match(scene,/const fx=relayLook\(event\.moveId,event\.team\),\{x,y,reviewed\}=releaseAt\(event\);/);
  assert.match(scene,/entry\.origin = releaseOrigins\.get\(projectile\.actionId\) \?\? null;/);
  // A relay ends on its KO pause, so the side still standing takes the WIN sequence there.
  assert.match(scene,/relayWinner === 'player' \? DATA_ARENA_SEQUENCES\.WIN/);
  assert.match(scene,/relayWinner === 'rival' \? DATA_ARENA_SEQUENCES\.WIN/);
  // Native (non-reviewed) art keeps the original hand offset.
  assert.match(scene,/x: event\.x \+ Math\.cos\(event\.angle\) \* 26, y: event\.y - BEAM_ELEVATION \+ Math\.sin\(event\.angle\) \* 26, reviewed: false/);
});
