// VS2 -- Hunt field runtime.
//
// EVIDENCE POSITION
// -----------------
// The collision rule this runtime obeys is ROM-evidenced: attribute bit 0 or
// out-of-bounds blocks, and every other bit is unresolved. The runtime treats
// unresolved bits as traversable and never claims that is original behaviour.
//
// Normal entry supplies original generated individuals, native positions and
// initial HP through the application-owned RNG/history transaction. Those
// actors stay at their initialized positions until the native AI update binds.
// Product wandering, movement speeds and radius remain for explicit prototype
// fixtures only. Camera panning remains the existing product presentation.
// Explicit capture replay is separate from normal capture acceptance.
//
// The runtime holds no save state and no DOM. Time enters through tick(deltaMs)
// so the simulation is fully deterministic and testable without a browser.

import { computeFieldCameraWindow, computeVisibleChunkWindow, getFieldChunkBounds } from "../field/fieldCamera.js";
import { createCaptureStrokeRecognizer } from "./capture/captureStrokeRecognizer.js";
import { huntViewportTransform, huntWorldToNative } from "./huntFieldCoordinates.js";
import { nearestWildInHitRadius } from "./capture/huntEnclosureSession.js";
import { createWildCaptureFlow, initializeWildHp } from "./capture/wildCaptureFlow.js";
import { createNativeHuntFieldControls } from "./capture/nativeHuntFieldControls.js";

export const HUNT_PLAYER_SPEED_PX_PER_SECOND = 74;
export const HUNT_WILD_SPEED_PX_PER_SECOND = 24;
export const HUNT_ACTOR_RADIUS_PX = 5;
export const HUNT_ARRIVAL_EPSILON_PX = 1.5;
export const HUNT_WILD_WANDER_RADIUS_PX = 96;
export const HUNT_MOVEMENT_AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT_AUTHORED";
export const HUNT_MAX_STEP_MS = 50;

function seededRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function facingFrom(dx, dy, fallback) {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

export function createHuntRuntime({ world, fieldActor, wildCount = null, captureReplay = null, maxCardG = 0, nativeEntry = null, nativeControls = null } = {}) {
  if (!world || typeof world.isBlockedTile !== "function" || !world.definition) {
    throw new TypeError("createHuntRuntime requires a Championship hunt world");
  }
  if (!fieldActor || typeof fieldActor.actorId !== "string") {
    // The field actor is the tamer. In the original the Hunt HUD's creature panel
    // describes the WILD target, not a companion, so nothing here is a creature
    // the player brought.
    throw new TypeError("createHuntRuntime requires a field actor");
  }

  const tileSize = world.tileSizePx;

  /**
   * Reject a position whose actor footprint overlaps a blocked tile.
   *
   * A point test would let an actor stand half inside a wall. The footprint is a
   * square of HUNT_ACTOR_RADIUS_PX, which is a product-authored value: no
   * original actor radius is recovered.
   */
  function positionBlocked(x, y) {
    const minTileX = Math.floor((x - HUNT_ACTOR_RADIUS_PX) / tileSize);
    const maxTileX = Math.floor((x + HUNT_ACTOR_RADIUS_PX) / tileSize);
    const minTileY = Math.floor((y - HUNT_ACTOR_RADIUS_PX) / tileSize);
    const maxTileY = Math.floor((y + HUNT_ACTOR_RADIUS_PX) / tileSize);
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        if (world.isBlockedTile(tileX, tileY)) return true;
      }
    }
    return false;
  }

  /**
   * Move one actor toward a target, resolving each axis separately.
   *
   * Separate axes are what let an actor slide along a wall instead of sticking to
   * it, which is the difference between a field that feels traversable and one
   * that feels broken.
   */
  function step(actor, targetX, targetY, speed, seconds) {
    const dx = targetX - actor.worldX;
    const dy = targetY - actor.worldY;
    const distance = Math.hypot(dx, dy);
    if (distance <= HUNT_ARRIVAL_EPSILON_PX) {
      actor.moving = false;
      return true;
    }
    const travel = Math.min(distance, speed * seconds);
    const stepX = (dx / distance) * travel;
    const stepY = (dy / distance) * travel;

    let moved = false;
    const candidateX = actor.worldX + stepX;
    if (!positionBlocked(candidateX, actor.worldY)) {
      actor.worldX = candidateX;
      moved = true;
    }
    const candidateY = actor.worldY + stepY;
    if (!positionBlocked(actor.worldX, candidateY)) {
      actor.worldY = candidateY;
      moved = true;
    }
    actor.facing = facingFrom(stepX, stepY, actor.facing);
    actor.moving = moved;
    // Wedged against geometry: give up on this target rather than vibrate.
    return !moved;
  }

  const player = {
    actorId: fieldActor.actorId,
    displayName: fieldActor.displayName,
    worldX: world.spawn.x,
    worldY: world.spawn.y,
    facing: "down",
    moving: false,
    targetX: null,
    targetY: null
  };

  const liveObservation = captureReplay?.mode === "NATIVE_LIVE_STATE_REPLAY";
  if (world.nativeEntry && captureReplay !== null) throw Error("NATIVE_ENTRY_REPLAY_CONFLICT");
  if (world.nativeEntry && !nativeEntry?.encounter) throw Error("NATIVE_ENTRY_STATE_REQUIRED");
  const entryState = nativeEntry ? structuredClone({ nativeHuntIndex:nativeEntry.scene.nativeHuntIndex,
    fieldId:nativeEntry.scene.fieldId, season:nativeEntry.scene.season, hour:nativeEntry.scene.hour,
    releasedSlot:nativeEntry.releasedSlot, encounter:nativeEntry.encounter }) : null;
  let sourceWilds = wildCount === null ? world.wildCreatures : world.wildCreatures.slice(0, wildCount);
  if (liveObservation) {
    const encounter = captureReplay.encounter;
    if (encounter?.gateId !== world.gateId || !Array.isArray(encounter.wildRecords) || !encounter.wildRecords.length) {
      throw new TypeError("CAPTURE_LIVE_ENCOUNTER_GATE_REQUIRED");
    }
    sourceWilds = encounter.wildRecords.map((entry, index) => {
      const position = entry.positionQ12;
      if (entry.wildIndex !== index || !/^species-\d{3}$/.test(entry.speciesId)
        || !Array.isArray(position) || position.length !== 2
        || position.some((value) => !Number.isSafeInteger(value) || value < 0 || value >= 1024 * 4096)) {
        throw new TypeError("INVALID_CAPTURE_LIVE_RECORD");
      }
      return { wildId: `${world.gateId}:native-wild:${index}`, speciesId: entry.speciesId,
        worldX: position[0] / 2048, worldY: position[1] / 2048, wanderSeed: 0 };
    });
  }
  // Pending strokes are diagnostics only until the native tool path is closed.
  let enclosure = null;
  let selectedWildId = null;
  let cameraCenter = { x: player.worldX, y: player.worldY };

  function cameraRequest(viewportWidth, viewportHeight) {
    const transform = huntViewportTransform(viewportWidth, viewportHeight);
    return {
      centerX: cameraCenter.x, centerY: cameraCenter.y,
      viewportWidth: transform.worldWidth, viewportHeight: transform.worldHeight
    };
  }

  const wilds = sourceWilds.map((spawn) => ({
    wildId: spawn.wildId,
    speciesId: spawn.speciesId,
    homeX: spawn.worldX,
    homeY: spawn.worldY,
    worldX: spawn.worldX,
    worldY: spawn.worldY,
    facing: "down",
    moving: false,
    state: "IDLE",
    currentHp: spawn.currentHp ?? null,
    maxHp: spawn.maxHp ?? null,
    targetX: null,
    targetY: null,
    pauseMs: 400 + ((spawn.wanderSeed % 11) * 220),
    random: seededRandom(spawn.wanderSeed)
  }));

  // Explicit research replay only. Native normal initialization does not confer
  // capture authority before AI, tool input and animation completion bind.
  const captureFlows = new Map();
  if (captureReplay !== null) {
    if ((!liveObservation && captureReplay.mode !== "NATIVE_DATAFLOW_REPLAY") || !Array.isArray(captureReplay.records)
      || captureReplay.records.length !== 1) throw new TypeError("ONE_NATIVE_CAPTURE_REPLAY_REQUIRED");
    for (const record of captureReplay.records) {
      const wild = wilds[record.wildIndex];
      if (!wild || wild.speciesId !== record.speciesId) throw new TypeError("CAPTURE_REPLAY_SPECIES_MISMATCH");
      captureFlows.set(wild.wildId, createWildCaptureFlow({ ...record, wildId: wild.wildId,
        hp: initializeWildHp(record.hpInitialization) }));
    }
  }
  const controls = world.nativeEntry && nativeControls ? createNativeHuntFieldControls({
    ...nativeControls, records:entryState.encounter.actors, wildIds:wilds.map(w=>w.wildId),
    environment:nativeEntry.scene.environment,rng:nativeEntry.rng,maxCardG,night:nativeEntry.scene.variant.night }) : null;
  const cardEntries = () => controls ? controls.getOnCardEntries() : [...captureFlows.values()].map((flow) => flow.snapshot()).filter((entry) => entry.state === "ON_CARD");
  const captureVisible = (wild) => {
    const captured = captureFlows.get(wild.wildId)?.snapshot();
    return !captured?.nativePhase.wildHidden && !["ON_CARD", "HOME_COMMITTED", "RELEASED"].includes(captured?.state);
  };

  let elapsedMs = 0;

  /** Choose the next wander destination inside the creature's home radius. */
  function pickWanderTarget(wild) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = wild.random() * Math.PI * 2;
      const radius = HUNT_WILD_WANDER_RADIUS_PX * (0.25 + (wild.random() * 0.75));
      const x = wild.homeX + (Math.cos(angle) * radius);
      const y = wild.homeY + (Math.sin(angle) * radius);
      if (!positionBlocked(x, y)) {
        wild.targetX = x;
        wild.targetY = y;
        wild.state = "WANDERING";
        return;
      }
    }
    // Nowhere reachable this time: idle, and try again after the next pause.
    wild.targetX = null;
    wild.targetY = null;
    wild.state = "IDLE";
  }

  function advance(deltaMs) {
    const seconds = deltaMs / 1000;
    elapsedMs += deltaMs;
    controls?.tick(deltaMs,[(cameraCenter.x-256)/2,(cameraCenter.y-192)/2]);

    if (player.targetX !== null) {
      const done = step(player, player.targetX, player.targetY, HUNT_PLAYER_SPEED_PX_PER_SECOND, seconds);
      if (done) {
        player.targetX = null;
        player.targetY = null;
        player.moving = false;
      }
    } else {
      player.moving = false;
    }

    for (const wild of wilds) {
      if (world.nativeEntry || liveObservation || captureFlows.has(wild.wildId)) continue; // Native AI update remains a separate binding.
      if (wild.targetX === null) {
        wild.pauseMs -= deltaMs;
        wild.moving = false;
        wild.state = "IDLE";
        if (wild.pauseMs <= 0) pickWanderTarget(wild);
        continue;
      }
      const done = step(wild, wild.targetX, wild.targetY, HUNT_WILD_SPEED_PX_PER_SECOND, seconds);
      if (done) {
        wild.targetX = null;
        wild.targetY = null;
        wild.moving = false;
        wild.state = "IDLE";
        wild.pauseMs = 500 + Math.floor(wild.random() * 2600);
      }
    }
  }

  return Object.freeze({
    world,
    movementAuthority: HUNT_MOVEMENT_AUTHORITY,
    getNativeEntryState: () => structuredClone(entryState),
    getNativeReturnContext: () => nativeEntry && controls ? Object.freeze({biomeIndex:nativeEntry.scene.biomeIndex,
      releasedSlot:nativeEntry.releasedSlot, carriedAtEntry:!!nativeEntry.encounter.historyWrite}) : null,
    applyReturnedIndividuals(entries) {
      if (!controls) throw Error("HUNT_NATIVE_RETURN_UNAVAILABLE");
      controls.applyReturnedIndividuals(entries);
    },

    /** Request movement toward a world point. Out-of-world requests are clamped. */
    moveTo(worldX, worldY) {
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
      player.targetX = Math.max(0, Math.min(world.worldWidthPx, worldX));
      player.targetY = Math.max(0, Math.min(world.worldHeightPx, worldY));
      return true;
    },

    stop() {
      player.targetX = null;
      player.targetY = null;
      player.moving = false;
    },

    /**
     * Advance the simulation.
     *
     * Long frames are split into bounded steps so a background tab or a slow
     * frame cannot teleport an actor through geometry.
     */
    tick(deltaMs) {
      if(controls?.getState().fault)return;
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
      let remaining = Math.min(deltaMs, 1000);
      while (remaining > 0) {
        const slice = Math.min(remaining, HUNT_MAX_STEP_MS);
        advance(slice);
        if(controls?.getState().fault)return;
        remaining -= slice;
      }
    },

    getElapsedMs() {
      return elapsedMs;
    },

    getPlayer() {
      return Object.freeze({
        actorId: player.actorId,
        displayName: player.displayName,
        worldX: player.worldX,
        worldY: player.worldY,
        tileX: Math.floor(player.worldX / tileSize),
        tileY: Math.floor(player.worldY / tileSize),
        facing: player.facing,
        moving: player.moving
      });
    },

    getWildCreatures() {
      if (controls) return controls.getActors();
      return wilds.filter(captureVisible).map((wild) => Object.freeze({
        wildId: wild.wildId,
        speciesId: wild.speciesId,
        worldX: wild.worldX,
        worldY: wild.worldY,
        facing: wild.facing,
        moving: wild.moving,
        state: wild.state,
        currentHp: captureFlows.get(wild.wildId)?.snapshot().currentHp ?? wild.currentHp,
        maxHp: captureFlows.get(wild.wildId)?.snapshot().maxHp ?? wild.maxHp,
        hpEvidence: captureFlows.has(wild.wildId) ? "ROM_DATAFLOW_REPLAY" : world.nativeEntry ? "ROM_VERIFIED_INITIALIZATION" : "UNKNOWN_REQUIRES_TRACE",
        behaviourEvidence: world.nativeEntry ? "NATIVE_INITIALIZED_AI_UPDATE_PENDING" : "PRODUCT_AUTHORED_NOT_ORIGINAL"
      }));
    },

    /** A persistent camera independent of the retained developer actor fixture. */
    getCamera(viewportWidth, viewportHeight) {
      return computeFieldCameraWindow(world.definition, cameraRequest(viewportWidth, viewportHeight));
    },

    panCamera(deltaX, deltaY, viewportWidth, viewportHeight) {
      if (![deltaX, deltaY].every(Number.isFinite) || enclosure) return false;
      const cameraViewport = cameraRequest(viewportWidth, viewportHeight);
      const current = computeFieldCameraWindow(world.definition, {
        ...cameraViewport, centerX: cameraCenter.x, centerY: cameraCenter.y
      });
      const next = computeFieldCameraWindow(world.definition, {
        ...cameraViewport,
        centerX: (current.left + current.right) / 2 + deltaX,
        centerY: (current.top + current.bottom) / 2 + deltaY
      });
      cameraCenter = { x: (next.left + next.right) / 2, y: (next.top + next.bottom) / 2 };
      return true;
    },

    selectWildAt(worldX, worldY) {
      if (controls) return controls.selectAt(worldX,worldY);
      if (enclosure || ![worldX, worldY].every(Number.isFinite)) return false;
      const target = nearestWildInHitRadius(worldX, worldY, wilds.filter(captureVisible));
      selectedWildId = target?.wildId ?? null;
      return target !== null;
    },

    getSelectedWildId() { return controls ? controls.getSelectedWildId() : selectedWildId; },
    getToolState: () => controls?.getState() ?? null,
    selectTool: kind => controls?.selectTool(kind) ?? false,
    toolPointerDown: (x,y) => controls?.pointerDown(x,y) ?? false,
    toolPointerMove: (x,y) => controls?.pointerMove(x,y) ?? false,
    toolPointerUp: (x,y) => controls?.pointerUp(x,y) ?? false,

    getCaptureRecord(wildId) { return controls ? controls.getCaptureRecord(wildId) : captureFlows.get(wildId)?.snapshot() ?? null; },
    attachNativeRope(wildId) { return captureFlows.get(wildId)?.attach() ?? false; },
    tickNativeRope(wildId, input) { return captureFlows.get(wildId)?.tickPull(input) ?? null; },
    tickNativeCapturePhases(wildId) { return captureFlows.get(wildId)?.tickNativePhases() ?? null; },
    completeNativeDownAnimation(wildId) { return captureFlows.get(wildId)?.completeDownAnimation() ?? false; },
    collectNativeHand(wildId) {
      const usedG = cardEntries().reduce((sum, entry) => sum + entry.gCost, 0);
      return captureFlows.get(wildId)?.hand({ maxG: maxCardG, usedG }) ?? Object.freeze({ accepted: false, reason: "NATIVE_RECORD_REQUIRED" });
    },
    tickNativeCardInsertionPhase(wildId) { return captureFlows.get(wildId)?.tickCardInsertionPhase() ?? false; },
    getOnCardEntries() { return Object.freeze(cardEntries()); },
    renameOnCardEntry(wildId, name) { return controls ? controls.rename(wildId,name) : captureFlows.get(wildId)?.rename(name) ?? false; },
    releaseOnCardEntry(wildId) { return controls ? controls.release(wildId) : captureFlows.get(wildId)?.releaseFromCard() ?? false; },
    completeHomeCaptureCommit() { controls?.commit(); for (const flow of captureFlows.values()) flow.markHomeCommitted(); },
    hasPendingCaptureAnimation() {
      if (controls) return controls.hasPending();
      return [...captureFlows.values()].some((flow) => ["DOWN_ANIMATION", "HAND_ANIMATION"].includes(flow.snapshot().state));
    },

    getCaptureAvailability() {
      if (controls) return controls.getAvailability();
      const native = captureFlows.get(selectedWildId)?.snapshot();
      return Object.freeze({
        state: "UNKNOWN_REQUIRES_TRACE", canCollect: false,
        targetWildId: selectedWildId,
        currentHp: native?.currentHp ?? null,
        dataflowEvidence: "BOUNDED_NATIVE_REPLAY_CLOSED",
        required: Object.freeze(["LIVE_ENCOUNTER_RNG_AND_RECORD", "NATIVE_TOOL_ROUTING_AND_CADENCE", "WILD_AI_PULL_EVENT_AND_ANIMATION"])
      });
    },

    /** Which modular chunks the same camera currently covers. */
    getVisibleChunks(viewportWidth, viewportHeight) {
      const request = cameraRequest(viewportWidth, viewportHeight);
      const window = computeVisibleChunkWindow(world.definition, request);
      const chunks = [];
      for (let chunkY = window.startChunkY; chunkY <= window.endChunkY; chunkY += 1) {
        for (let chunkX = window.startChunkX; chunkX <= window.endChunkX; chunkX += 1) {
          chunks.push(getFieldChunkBounds(world.definition, { chunkX, chunkY }));
        }
      }
      return chunks;
    },

    // Developer-only stroke inspection. No pointer adapter invokes this until
    // tool dispatch, sample cadence/lifetime and spatial query have been traced.
    beginEnclosureStroke(worldX, worldY) {
      if (enclosure) return false;
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
      const target = nearestWildInHitRadius(worldX, worldY, wilds);
      if (!target) return false;
      const recognizer = createCaptureStrokeRecognizer();
      const native = huntWorldToNative({ x: worldX, y: worldY });
      recognizer.begin(native.x, native.y);
      enclosure = {
        recognizer,
        targetWildId: target.wildId,
        speciesId: target.speciesId
      };
      player.targetX = null;
      player.targetY = null;
      player.moving = false;
      return true;
    },

    extendEnclosureStroke(worldX, worldY) {
      if (!enclosure) return false;
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
      const native = huntWorldToNative({ x: worldX, y: worldY });
      enclosure.recognizer.move(native.x, native.y);
      return true;
    },

    endEnclosureStroke() {
      if (!enclosure) return null;
      // Old geometry is an explicitly unverified diagnostic, never ownership.
      const geometry = enclosure.recognizer.end();
      const verdict = Object.freeze({
        outcome: "TOOL_TRACE_REQUIRED",
        wildId: enclosure.targetWildId,
        speciesId: enclosure.speciesId,
        successAuthority: "UNKNOWN_REQUIRES_TRACE",
        geometryEvidence: "LEGACY_PROTOTYPE_NOT_ORIGINAL",
        geometry
      });
      enclosure = null;
      return verdict;
    },

    abortEnclosureStroke() {
      controls?.cancel();
      const hadStroke = enclosure !== null;
      enclosure = null;
      for (const flow of captureFlows.values()) flow.release();
      return hadStroke;
    },

    getEnclosureStroke() {
      if (!enclosure) return null;
      return Object.freeze({
        points: enclosure.recognizer.getPoints().map(({ x, y }) => ({ x: x * 2, y: y * 2 })),
        targetWildId: enclosure.targetWildId,
        geometryEvidence: "LEGACY_PROTOTYPE_NOT_ORIGINAL",
        active: true
      });
    }
  });
}
