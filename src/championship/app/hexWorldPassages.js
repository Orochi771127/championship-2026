// Facility editor passages (Owner 2026-10-27). The editor shows exactly what
// the ranch will do: it composes the draft layout with the raising ground the
// game itself builds (composeProductRanchGround → connectRanchGround) and
// reads its passages, closed borders and safe exits. Nothing here decides a
// rule; a mark that disagreed with the ranch would be a bug.
import { composeProductRanchGround } from '../raising/nativeRaisingRanchRing.js';
import { ranchSafeExits } from '../cage/ranchConnections.js';
import { RANCH_ECOLOGY_GROUPS, ranchEcologyType } from '../cage/ranchEcology.js';
import { getCageDefinitionByModuleId } from '../cage/cageCatalog.js';
import { cageName } from '../text/zhHant.js';

const view = (p) => p.map((entry) => ({ moduleId: entry.moduleId, slotIndex: entry.slotIndex, instanceId: entry.instanceId }));

/** Passages, closed shared borders and open safe exits of a layout, or null if it cannot stand. */
export function hexWorldPassageView(placements) {
  let ground;
  try { ground = composeProductRanchGround({ placements: view(placements ?? []), landCapacity: 100 }); }
  catch { return null; }
  const nav = ground.navigation, { exits, edgesByOwner } = ranchSafeExits(ground);
  const instanceOf = (owner) => ground.placements[owner]?.instanceId ?? null;
  const reasonOf = new Map(nav.boundaries.map((b) => [b.id, b.reason ?? (b.compatible ? 'CONNECTED' : 'CLOSED')]));
  const joins = (owner) => ranchEcologyType(ground.placements[owner]?.moduleId) !== null;
  return Object.freeze({
    connections: nav.connections.map((c) => Object.freeze({ id: c.id, a: c.a, b: c.b,
      instances: Object.freeze([instanceOf(c.left), instanceOf(c.right)]) })),
    closed: nav.boundaries.filter((b) => reasonOf.get(b.id) !== 'CONNECTED')
      .map((b) => Object.freeze({ id: b.id, a: b.a, b: b.b, reason: reasonOf.get(b.id) })),
    // Exits still open to the outside: not inside a passage already, on a cage that can join.
    exits: [...edgesByOwner].flatMap(([owner, edges]) => joins(owner) ? edges
      .filter((e) => exits.get(e.id)?.has(owner) && reasonOf.get(e.id) !== 'CONNECTED')
      .map((e) => Object.freeze({ id: e.id, a: e.a, b: e.b, polygon: e.polygon, instanceId: instanceOf(owner) })) : []),
    outlines: [...edgesByOwner].map(([owner, edges]) => Object.freeze({ instanceId: instanceOf(owner),
      moduleId: ground.placements[owner]?.moduleId, edges: Object.freeze(edges.map((e) => Object.freeze({ id: e.id, a: e.a, b: e.b }))) }))
  });
}

/** Passages a candidate placement would open, by the same rule, or null if it cannot stand. */
export function hexWorldPassageGain(placements, candidate) {
  const before = hexWorldPassageView(placements), after = hexWorldPassageView([...(placements ?? []), candidate]);
  if (!before || !after) return null;
  const had = new Set(before.connections.map((c) => c.id));
  return after.connections.filter((c) => !had.has(c.id));
}

/** Cages one may join (its ecology group), named; same-type-only when the group is itself. */
export function ranchSynergyPartners(moduleId) {
  const type = ranchEcologyType(moduleId);
  if (type === null) return Object.freeze({ type: null, sameTypeOnly: false, names: Object.freeze([]), definitions: Object.freeze([]) });
  const index = getCageDefinitionByModuleId(moduleId)?.cageDefinitionIndex;
  const group = RANCH_ECOLOGY_GROUPS[type] ?? [index];
  return Object.freeze({ type, sameTypeOnly: group.length < 2, definitions: Object.freeze([...group]),
    names: Object.freeze(group.map((definition) => cageName(definition, ''))) });
}
