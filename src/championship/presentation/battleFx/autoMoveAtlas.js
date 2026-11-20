// Auto's native effect pool owns motion and contact. Keys are battle records in Auto mode.
import {createMoveAtlas} from '../moveAtlas.js';

const records = new Map([[76, 76], [143, 143]]);
const flightSelector = 0x0702;
const shrinkSteps = [0.77, 0.54, 0.31];

export function createAutoMoveAtlas({PIXI, front, ground, reducedMotion}) {
  const atlas = createMoveAtlas({PIXI, front, ground, reducedMotion, records, mode:'auto',
    assetRoot:'assets/production/vfx/auto-moves/', labelPrefix:'auto-move'});
  const flights = new Map(), owned = new Set(), contactIds = new Set();
  function update(view, rect, scale, dt, events) {
    owned.clear(); contactIds.clear(); atlas.beginFrame();
    const live = new Set();
    for (const event of events) if (event.type === 'LAUNCH') atlas.request(event.moveId);
    for (const a of view.nativeLifecycle?.effectActors ?? []) {
      const o = a.origin;
      if (o?.moveId !== 76 || o.selector !== flightSelector) continue;
      live.add(a.id);
      let shot = flights.get(a.id);
      if (!shot) {
        shot = {draw:atlas.ready(76,'travel'), actionId:o.actionId, slot:o.slot, age:0, ended:null};
        flights.set(a.id,shot);
      }
      if (!shot.draw) continue;
      owned.add(a.id);
      if (!shot.ended) {
        shot.point = a.point;
        shot.angle = Math.atan2(a.sin,a.cos) + ((a.flip & 1) ? Math.PI : 0);
      }
    }
    for (const event of events) {
      if (event.type !== 'MOVE_CONTACT') continue;
      const c = event.contact;
      if (c.moveId === 143 && atlas.ready(143,'target_single')) {
        atlas.place(c,143,'target_single',rect.x+c.targetPoint[0]/4096*scale,
          rect.y+c.targetPoint[1]/4096*scale,0,scale,0,false,true);
        contactIds.add(c.id);
      } else if (c.moveId === 76) {
        const shot = flights.get(c.actorId);
        if (!shot?.draw || shot.actionId !== c.actionId || shot.slot !== c.slot) continue;
        if (!shot.ended) { shot.ended = {age:0}; shot.point = c.sourcePoint; }
        contactIds.add(c.id);
      }
    }
    for (const [id,shot] of flights) {
      if (!live.has(id) && (!shot.ended || shot.ended.age >= 167)) { flights.delete(id); continue; }
      if (!shot.draw || (shot.ended && shot.ended.age >= 167)) continue;
      const [x,y,z] = shot.point;
      const size = shot.ended ? shrinkSteps[Math.min(2,Math.floor(shot.ended.age*3/167))] : 1;
      atlas.place(shot,76,'travel',rect.x+x/4096*scale,rect.y+(y-z)/4096*scale,
        shot.angle,scale*0.5*size,shot.age,false);
      if (shot.ended) shot.ended.age += dt;
      shot.age += dt;
    }
    atlas.endFrame(dt);
  }
  return {update, supports:key=>records.has(key), ownsActor:id=>owned.has(id), ownsContact:id=>contactIds.has(id),
    diagnostics:()=>({...atlas.diagnostics(),flightIds:[...owned],contactIds:[...contactIds]}),
    dispose(){flights.clear();owned.clear();contactIds.clear();atlas.dispose();}};
}