// Auto's native effect pool owns motion and contact. Keys are battle records in Auto mode.
import {createMoveAtlas} from '../moveAtlas.js';

import {autoMoveBindings} from './autoMoveBindings.js';

const records = new Map([...autoMoveBindings.keys()].map(key => [key, key]));
const bodyAnchors = new Map([
  ['caster_head', [0.12, 0.82]], ['caster_shoulder', [0.22, 0.66]],
  ['caster_limb', [0.35, 0.46]], ['caster_front_foot', [0.30, 0.12]],
  ['caster_body', [0.10, 0.48]], ['target_body', [0, 0.45]]
]);

function project(point, rect, scale) {
  return {x:rect.x+point[0]/4096*scale, y:rect.y+(point[1]-point[2])/4096*scale};
}

function placeContact(atlas, binding, c, rect, scale, bodies) {
  const phase = binding.family === 'target_single' ? 'target_single' : 'contact';
  if (!atlas.ready(c.moveId, phase)) return false;
  const onCaster = binding.anchor.startsWith('caster_');
  const point = onCaster ? c.casterPoint : c.targetPoint;
  if (!point) return false;
  const at = project(point, rect, scale);
  const body = bodies?.get(onCaster ? c.slot : c.targetSlot);
  const offset = bodyAnchors.get(binding.anchor);
  const facing = Math.sign(c.targetPoint[0] - (c.casterPoint ?? c.sourcePoint)[0]) || 1;
  if (offset) {
    if (!body) return false;
    at.x += body.width * offset[0] * facing;
    at.y -= body.height * offset[1];
  } else if (binding.anchor === 'target_ground') {
    at.y = rect.y + c.targetPoint[1]/4096*scale;
  }
  return atlas.place(c, c.moveId, phase, at.x, at.y, 0, scale, 0, false, true,
    binding.family === 'melee' ? facing : 1);
}
const flightSelector = 0x0702;
const shrinkSteps = [0.77, 0.54, 0.31];

export function createAutoMoveAtlas({PIXI, front, ground, reducedMotion}) {
  const atlas = createMoveAtlas({PIXI, front, ground, reducedMotion, records, maxSheets:12, mode:'auto',
    assetRoot:'assets/production/vfx/auto-moves/', labelPrefix:'auto-move'});
  const flights = new Map(), owned = new Set(), contactIds = new Set();
  const recipients = new Map(), ownedSupport = new Set(), heals = new Set();
  function update(view, rect, scale, dt, events, bodies) {
    owned.clear(); contactIds.clear(); ownedSupport.clear(); heals.clear(); atlas.beginFrame();
    for (const event of events) {
      const neutral = event.type === 'NEUTRAL_RELEASE';
      const r = neutral ? event : event.type === 'SUPPORT' ? event.receipt : null;
      if (!r || (!neutral && !r.result)) continue;
      const phase = neutral ? 'release' : 'recipient';
      if (!atlas.ready(r.moveId, phase)) continue;
      const slot = neutral ? r.slot : r.targetSlot;
      if (!bodies?.get(slot)) continue;
      recipients.set(r, {key:r.moveId,phase,slot,age:0});
      if (!neutral) {
        ownedSupport.add(r);
        if (r.result === 'heal') heals.add(slot + '/' + (r.hpAfter-r.hpBefore));
      }
    }
    for (const [id, recipient] of recipients) {
      const {key,phase,slot,age} = recipient, body=bodies?.get(slot);
      if (!body || body.down || age >= atlas.duration(key,phase)) { recipients.delete(id); continue; }
      atlas.place(id,key,phase,body.x,body.top+body.height*0.5,0,scale,age,false);
      recipient.age += dt;
    }
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
      const binding = autoMoveBindings.get(c.moveId);
      if (binding && ['melee','target_single','contact'].includes(binding.family)) {
        if (placeContact(atlas, binding, c, rect, scale, bodies)) contactIds.add(c.id);
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
    ownsSupport:r=>ownedSupport.has(r), ownsHeal:(slot,amount)=>heals.has(slot+"/"+amount),
    diagnostics:()=>({...atlas.diagnostics(),flightIds:[...owned],contactIds:[...contactIds]}),
    dispose(){recipients.clear();ownedSupport.clear();heals.clear();flights.clear();owned.clear();contactIds.clear();atlas.dispose();}};
}