// VS2 -- Hunt field runtime.
//
// EVIDENCE POSITION
// -----------------
// The collision rule this runtime obeys is ROM-evidenced: attribute bit 0 or
// out-of-bounds blocks, and every other bit is unresolved. The runtime treats
// unresolved bits as traversable and never claims that is original behaviour.
//
// Movement speeds, the wander model, and the actor radius are PRODUCT_AUTHORED.
// No original wild-creature movement, spawn rule, aggression, flee response or
// encounter trigger is traced, so wild creatures wander inside a bounded radius
// of where they spawned and do nothing else. They do not see the player, react to
// the player, approach, flee, chase, or trigger anything. That is deliberate:
// VS3 owns Capture, and a wild creature that reacted to the player would be an
// unauthorised down payment on it.
//
// The runtime holds no save state and no DOM. Time enters through tick(deltaMs)
// so the simulation is fully deterministic and testable without a browser.

import { computeFieldCameraWindow, computeVisibleChunkWindow, getFieldChunkBounds } from "../field/fieldCamera.js";

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

export function createHuntRuntime({ world, fieldActor, wildCount = null } = {}) {
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

  const sourceWilds = wildCount === null ? world.wildCreatures : world.wildCreatures.slice(0, wildCount);
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
    targetX: null,
    targetY: null,
    pauseMs: 400 + ((spawn.wanderSeed % 11) * 220),
    random: seededRandom(spawn.wanderSeed)
  }));

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
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
      let remaining = Math.min(deltaMs, 1000);
      while (remaining > 0) {
        const slice = Math.min(remaining, HUNT_MAX_STEP_MS);
        advance(slice);
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
      return wilds.map((wild) => Object.freeze({
        wildId: wild.wildId,
        speciesId: wild.speciesId,
        worldX: wild.worldX,
        worldY: wild.worldY,
        facing: wild.facing,
        moving: wild.moving,
        state: wild.state,
        behaviourEvidence: "PRODUCT_AUTHORED_NOT_ORIGINAL"
      }));
    },

    /** The camera window over the world for a given viewport, always clamped in. */
    getCamera(viewportWidth, viewportHeight) {
      return computeFieldCameraWindow(world.definition, {
        centerX: player.worldX,
        centerY: player.worldY,
        viewportWidth: Math.max(1, viewportWidth),
        viewportHeight: Math.max(1, viewportHeight)
      });
    },

    /** Which modular chunks the camera currently covers. */
    getVisibleChunks(viewportWidth, viewportHeight) {
      const request = {
        centerX: player.worldX,
        centerY: player.worldY,
        viewportWidth: Math.max(1, viewportWidth),
        viewportHeight: Math.max(1, viewportHeight)
      };
      const window = computeVisibleChunkWindow(world.definition, request);
      const chunks = [];
      for (let chunkY = window.startChunkY; chunkY <= window.endChunkY; chunkY += 1) {
        for (let chunkX = window.startChunkX; chunkX <= window.endChunkX; chunkX += 1) {
          chunks.push(getFieldChunkBounds(world.definition, { chunkX, chunkY }));
        }
      }
      return chunks;
    }
  });
}
