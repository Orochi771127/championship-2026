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

function placeContact(atlas, binding, c, rect, scale, bodies, age=0) {
  const phase = binding.family === 'target_single' ? 'target_single' : 'contact';
  if (!atlas.ready(c.moveId, phase)) return false;
  const onCaster = binding.anchor.startsWith('caster_');
  const impact = binding.family === 'contact' && binding.anchor === 'impact_world' && c.actorId != null;
  const point = onCaster ? c.casterPoint : impact ? c.sourcePoint : c.targetPoint;
  if (!point) return false;
  const at = project(point, rect, scale);
  const body = bodies?.get(onCaster ? c.slot : c.targetSlot);
  const offset = bodyAnchors.get(binding.anchor);
  const facing = Math.sign(c.targetPoint[0] - (c.casterPoint ?? c.sourcePoint)[0]) || 1;
  if (offset) {
    if (!body || (onCaster && body.down)) return false;
    at.x = body.x + body.width * offset[0] * facing;
    at.y = body.top + body.height * (1-offset[1]);
  } else if (binding.anchor === 'target_ground') {
    at.y = rect.y + c.targetPoint[1]/4096*scale;
  }
  return atlas.place(c, c.moveId, phase, at.x, at.y, 0, scale, age, false, !offset,
    binding.family === 'melee' ? facing : 1);
}
const pilotFlightSelector = 0x0702;
const shrinkSteps = [0.77, 0.54, 0.31];

// Scale only along the painted beam axis. The measured extremities meet the native endpoints.
function placeBeam(atlas, id, key, start, end, scale, age, transient) {
  const span = atlas.span(key, 'beam');
  if (!span || !start || !end) return false;
  const dx=end.x-start.x, dy=end.y-start.y, distance=Math.hypot(dx,dy);
  if (distance < scale) return false;
  return atlas.place(id,key,'beam',start.x-dx*span.left/span.width,start.y-dy*span.left/span.width,
    Math.atan2(dy,dx),scale,age,false,transient,distance/(span.width*scale));
}

export function createAutoMoveAtlas({PIXI, front, ground, reducedMotion}) {
  const atlas = createMoveAtlas({PIXI, front, ground, reducedMotion, records, maxSheets:12, mode:'auto',
    assetRoot:'assets/production/vfx/auto-moves/', labelPrefix:'auto-move'});
  const flights = new Map(), owned = new Set(), contactIds = new Set();
  const attachedContacts = new Map(), ownedTaunts = new Set();
  const cues = new Set(), claimedContacts = new Set(), claimedSupport = new Set();
  function remember(set, key) {
    set.add(key);
    if (set.size > 256) set.delete(set.values().next().value);
  }
  const recipients = new Map(), ownedSupport = new Set(), heals = new Set();
  function update(view, rect, scale, dt, events, bodies) {
    ownedTaunts.clear(); owned.clear(); contactIds.clear(); ownedSupport.clear(); heals.clear(); atlas.beginFrame();
    for (const event of events) {
      const neutral = event.type === 'NEUTRAL_RELEASE';
      const taunt=event.type==='TAUNT_RECIPIENT';
      const r = neutral ? event : (taunt || event.type === 'SUPPORT') ? event.receipt : null;
      if (!r) continue;
      const supportKey=r.actionId+'/'+r.targetSlot;
      if (!neutral && !r.result) { remember(claimedSupport,supportKey); continue; }
      const phase = neutral ? 'release' : 'recipient';
      if (!atlas.ready(r.moveId, phase)) continue;
      const slot = neutral ? r.slot : r.targetSlot;
      if (!bodies?.get(slot)) continue;
      recipients.set(r, {key:r.moveId,phase,slot,age:0});
      if (taunt) ownedTaunts.add(r.id);
      else if (!neutral) {
        ownedSupport.add(r); remember(claimedSupport,supportKey);
        if (r.result === 'heal') heals.add(slot + '/' + (r.hpAfter-r.hpBefore));
      }
    }
    for (const [id, recipient] of recipients) {
      const {key,phase,slot,age} = recipient, body=bodies?.get(slot);
      if (!body || body.down || age >= atlas.duration(key,phase)) { recipients.delete(id); continue; }
      atlas.place(id,key,phase,body.x,body.top+body.height*0.5,0,scale,age,false);
      recipient.age += dt;
    }
    for (const [id,attached] of attachedContacts) {
      const {binding,c,phase}=attached;
      if (attached.age>=atlas.duration(c.moveId,phase) || !placeContact(atlas,binding,c,rect,scale,bodies,attached.age)) {
        attachedContacts.delete(id);continue;
      }
      attached.age+=dt;
    }
    const live = new Set();
    for (const event of events) if (event.type === 'LAUNCH') atlas.request(event.moveId);
    // The actor remains in its native allocation and collision lifecycle.
    for (const a of view.nativeLifecycle?.effectActors ?? []) {
      const o = a.origin;
      const family = autoMoveBindings.get(o?.moveId)?.family;
      if (family !== 'travel' && family !== 'beam') continue;
      if (!o.contactProbe && !(o.moveId === 76 && o.selector === pilotFlightSelector)) continue;
      live.add(a.id);
      let shot = flights.get(a.id);
      if (!shot) {
        shot = {key:o.moveId, family, draw:atlas.ready(o.moveId,family), actionId:o.actionId, slot:o.slot, age:0, ended:null};
        flights.set(a.id,shot);
        if (shot.key === 122 && shot.draw && !cues.has(o.actionId)) {
          const body=bodies?.get(o.slot);
          if (body && atlas.place(o,122,'cue',body.x+body.width*0.30*body.facing,body.top+body.height*0.5,
            0,scale,0,false,true)) remember(cues,o.actionId);
        }
      }
      if (!shot.draw) continue;
      if (family === 'beam') {
        const body=bodies?.get(o.slot);
        if (body && placeBeam(atlas,shot,o.moveId,{x:body.x,y:body.top+body.height*0.5},
          project(a.point,rect,scale),scale,shot.age,false)) owned.add(a.id);
        shot.age += dt;
        continue;
      }
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
        if (placeContact(atlas, binding, c, rect, scale, bodies)) {
          contactIds.add(c.id);
          if(bodyAnchors.has(binding.anchor))attachedContacts.set(c.id,{binding,c,phase:binding.family==='target_single'?'target_single':'contact',age:dt});
        }
      } else if (binding?.family === 'beam' || binding?.family === 'travel') {
        const shot = flights.get(c.actorId);
        const same = shot?.actionId === c.actionId && shot.slot === c.slot && shot.key === c.moveId;
        if (binding.family === 'beam' && !(same && owned.has(c.actorId))) {
          // A non-projectile contact can supply a true endpoint even when there is no live beam actor.
          const start=project(c.casterPoint,rect,scale), end=project(c.targetPoint,rect,scale);
          const body=bodies?.get(c.slot);
          if(body) start.y -= body.height*0.5;
          placeBeam(atlas,c,c.moveId,start,end,scale,0,true);
        }
        if (c.moveId !== 76) {
          if (same && !shot.draw) continue;
          const point=project(c.actorId ? c.sourcePoint : c.targetPoint,rect,scale);
          if (atlas.place(c.id,c.moveId,'contact',point.x,point.y,0,scale,0,false,true)) contactIds.add(c.id);
          continue;
        }
        if (!shot?.draw || shot.actionId !== c.actionId || shot.slot !== c.slot) continue;
        if (!shot.ended) { shot.ended = {age:0}; shot.point = c.sourcePoint; }
        contactIds.add(c.id);
      }
    }
    for (const [id,shot] of flights) {
      if (!live.has(id) && (!shot.ended || shot.ended.age >= 167)) { flights.delete(id); continue; }
      if (!shot.draw || shot.family === 'beam' || (shot.ended && shot.ended.age >= 167)) continue;
      const [x,y,z] = shot.point;
      const size = shot.ended ? shrinkSteps[Math.min(2,Math.floor(shot.ended.age*3/167))] : 1;
      atlas.place(shot,shot.key,'travel',rect.x+x/4096*scale,rect.y+(y-z)/4096*scale,
        shot.angle,scale*(shot.key===76 ? 0.5 : 1)*size,shot.age,false);
      if (shot.ended) shot.ended.age += dt;
      shot.age += dt;
    }
    for (const id of contactIds) remember(claimedContacts,id);
    for (const actor of view.nativeLifecycle?.effectActors ?? []) {
      const o=actor.origin;
      if (o && (claimedContacts.has(o.contactId) || (o.supportTarget !== undefined && claimedSupport.has(o.actionId+'/'+o.supportTarget)))) owned.add(actor.id);
    }
    atlas.endFrame(dt);
  }
  return {update, supports:key=>records.has(key), ownsActor:id=>owned.has(id), ownsContact:id=>contactIds.has(id),
    ownsTaunt:id=>ownedTaunts.has(id),
    ownsNativeImpact:id=>claimedContacts.has(id),
    ownsSupport:r=>ownedSupport.has(r), ownsHeal:(slot,amount)=>heals.has(slot+"/"+amount),
    diagnostics:()=>({...atlas.diagnostics(),flightIds:[...owned],contactIds:[...contactIds]}),
    dispose(){attachedContacts.clear();ownedTaunts.clear();claimedContacts.clear();claimedSupport.clear();cues.clear();recipients.clear();ownedSupport.clear();heals.clear();flights.clear();owned.clear();contactIds.clear();atlas.dispose();}};
}