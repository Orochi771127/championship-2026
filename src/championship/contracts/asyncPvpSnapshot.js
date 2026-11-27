// Asynchronous PvP ghost-team snapshot contract (championship.asyncPvp.v1).
//
// Pure, deterministic, server-optional contract designed for Steam single-player
// ghost battles and lightweight JSON sharing (< 1 KB per 3-partner team).
// Validates species existence, optional roster allowlist, stat-curve ceilings,
// move-slot uniqueness, legal burst form lineage, byte budget and checksum.

import statCurve from '../../data/championship/catalogs/creature-stat-curve.r1.json' with { type: 'json' };
import { isKnownSpeciesIndex, productHuntSpecies } from './productSpeciesData.js';
import { burstFormsFor } from './productBurstEvolution.js';

export const ASYNC_PVP_SCHEMA = 'championship.asyncPvp.v1';
export const ASYNC_PVP_VERSION = 1;
export const ASYNC_PVP_MAX_BYTES = 1024;
export const ASYNC_PVP_MAX_SYNC_LEVEL = 50;
// Allows full native rung ceiling + max sync-level & training headroom without admitting absurd edits.
export const ASYNC_PVP_STAT_HEADROOM = 1.65;

const CURVE_ROWS = statCurve.rows ?? statCurve.records;
const MOVE_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const ROSTER_VER_RE = /^[A-Za-z0-9._-]{1,24}$/;
const TOP_KEYS = Object.freeze(['s', 'v', 'rv', 'tn', 'ts', 'tm', 'ck']);
const MEMBER_KEYS = Object.freeze(['sp', 'lv', 'p', 'st', 'mv', 'bf']);

/** Declarative JSON Schema (Draft 2020-12 compatible) for tooling and backend validation. */
export const ASYNC_PVP_SNAPSHOT_JSON_SCHEMA = Object.freeze({
  $schema: 'urn:json-schema:draft-2020-12',
  $id: 'urn:championship:schema:async-pvp-team:v1',
  title: 'Cyber Partner Async PvP Ghost Team Snapshot v1',
  type: 'object',
  additionalProperties: false,
  required: ['s', 'v', 'rv', 'tn', 'ts', 'tm', 'ck'],
  properties: {
    s: { const: ASYNC_PVP_SCHEMA },
    v: { const: ASYNC_PVP_VERSION },
    rv: { type: 'string', pattern: '^[A-Za-z0-9._-]{1,24}$' },
    tn: { type: 'string', minLength: 1, maxLength: 24 },
    ts: { type: 'integer', minimum: 0 },
    tm: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sp', 'lv', 'p', 'st'],
        properties: {
          sp: { type: 'integer', minimum: 8, maximum: 999 },
          lv: { type: 'integer', minimum: 1, maximum: ASYNC_PVP_MAX_SYNC_LEVEL },
          p: { type: 'integer', minimum: 0, maximum: 7 },
          st: {
            type: 'array',
            minItems: 7,
            maxItems: 7,
            items: { type: 'integer', minimum: 1 }
          },
          mv: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,32}$' }
          },
          bf: { type: 'integer', minimum: 8, maximum: 999 }
        }
      }
    },
    ck: { type: 'string', pattern: '^[0-9a-f]{16}$' }
  }
});

function utf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

/** Deterministic 64-bit FNV-1a integrity digest (16 lowercase hex chars). */
export function computeAsyncPvpChecksum(unsignedPayload) {
  const canonical = JSON.stringify({
    s: unsignedPayload.s,
    v: unsignedPayload.v,
    rv: unsignedPayload.rv,
    tn: unsignedPayload.tn,
    ts: unsignedPayload.ts,
    tm: unsignedPayload.tm
  });
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const bytes = new TextEncoder().encode(canonical);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/** Compute the legal upper bound for each of the 7 stats of a given species. */
export function asyncPvpStatCeilings(speciesIndex, syncLevel = ASYNC_PVP_MAX_SYNC_LEVEL) {
  if (!isKnownSpeciesIndex(speciesIndex) || speciesIndex < 8) return null;
  const hunt = productHuntSpecies(speciesIndex);
  if (!hunt?.rungs || hunt.rungs.length < 7) return null;
  const levelFactor = 1 + (Math.max(1, Math.min(ASYNC_PVP_MAX_SYNC_LEVEL, syncLevel)) - 1) / (ASYNC_PVP_MAX_SYNC_LEVEL - 1) * (ASYNC_PVP_STAT_HEADROOM - 1);
  return Object.freeze(hunt.rungs.slice(0, 7).map((rung, col) => {
    const clampedRung = Math.max(0, Math.min(CURVE_ROWS.length - 1, rung));
    const baseMax = CURVE_ROWS[clampedRung][col === 0 ? 0 : Math.min(col, 6)];
    return Math.ceil(baseMax * levelFactor);
  }));
}

function sanitizeTrainerName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
}

/**
 * Construct a compact, checksummed <1KB Async PvP team snapshot.
 * Throws if the resulting snapshot fails legality validation.
 */
export function createAsyncPvpSnapshot({
  trainerName,
  rosterVersion = '2026.11',
  timestamp = Math.floor(Date.now() / 1000),
  team
}, options = {}) {
  const members = Array.isArray(team) ? team.map((m) => {
    const entry = {
      sp: m.speciesIndex ?? m.sp,
      lv: m.syncLevel ?? m.lv ?? 1,
      p: m.personalityIndex ?? m.p ?? 0,
      st: Array.isArray(m.stats ?? m.st) ? [...(m.stats ?? m.st)] : []
    };
    const moves = m.moves ?? m.mv;
    if (Array.isArray(moves) && moves.length > 0) entry.mv = [...moves];
    const burst = m.burstForm ?? m.bf;
    if (burst !== undefined && burst !== null) entry.bf = burst;
    return entry;
  }) : [];

  const unsigned = {
    s: ASYNC_PVP_SCHEMA,
    v: ASYNC_PVP_VERSION,
    rv: String(rosterVersion),
    tn: sanitizeTrainerName(trainerName),
    ts: Number.isSafeInteger(timestamp) ? timestamp : 0,
    tm: members
  };
  const snapshot = { ...unsigned, ck: computeAsyncPvpChecksum(unsigned) };
  const verdict = validateAsyncPvpSnapshot(snapshot, options);
  if (!verdict.ok) {
    const first = verdict.errors[0];
    throw new Error(`ASYNC_PVP_INVALID:${first.code}:${first.path}`);
  }
  return Object.freeze({
    snapshot: verdict.snapshot,
    json: verdict.json,
    bytes: verdict.bytes
  });
}

/**
 * Validate a raw Async PvP snapshot (JSON string or parsed object) against
 * schema, <1KB size cap, checksum, optional roster allowlist, stat ceilings,
 * move uniqueness, and legal burst lineage.
 */
export function validateAsyncPvpSnapshot(input, { allowedSpecies = null } = {}) {
  const errors = [];
  const fail = (code, path, message) => errors.push(Object.freeze({ code, path, message }));

  let parsed = input;
  let json;
  if (typeof input === 'string') {
    const rawBytes = utf8ByteLength(input);
    if (rawBytes === 0) return Object.freeze({ ok: false, errors: Object.freeze([{ code: 'EMPTY_PAYLOAD', path: '$', message: 'Snapshot JSON is empty' }]) });
    if (rawBytes > ASYNC_PVP_MAX_BYTES) return Object.freeze({ ok: false, errors: Object.freeze([{ code: 'PAYLOAD_TOO_LARGE', path: '$', message: `Snapshot exceeds ${ASYNC_PVP_MAX_BYTES} bytes (${rawBytes})` }]) });
    try { parsed = JSON.parse(input); } catch { return Object.freeze({ ok: false, errors: Object.freeze([{ code: 'INVALID_JSON', path: '$', message: 'Malformed JSON' }]) }); }
    json = input;
  } else {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: 'INVALID_ROOT', path: '$', message: 'Snapshot must be an object' }]) });
    }
    json = JSON.stringify(input);
    const bytes = utf8ByteLength(json);
    if (bytes > ASYNC_PVP_MAX_BYTES) fail('PAYLOAD_TOO_LARGE', '$', `Serialized snapshot exceeds ${ASYNC_PVP_MAX_BYTES} bytes (${bytes})`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: 'INVALID_ROOT', path: '$', message: 'Snapshot must be an object' }]) });
  }

  for (const key of Object.keys(parsed)) {
    if (!TOP_KEYS.includes(key)) fail('UNKNOWN_FIELD', `$.${key}`, `Unexpected field ${key}`);
  }
  if (parsed.s !== ASYNC_PVP_SCHEMA) fail('INVALID_SCHEMA', '$.s', `Expected schema ${ASYNC_PVP_SCHEMA}`);
  if (parsed.v !== ASYNC_PVP_VERSION) fail('INVALID_VERSION', '$.v', `Expected version ${ASYNC_PVP_VERSION}`);
  if (typeof parsed.rv !== 'string' || !ROSTER_VER_RE.test(parsed.rv)) fail('INVALID_ROSTER_VERSION', '$.rv', 'Invalid rosterVersion');

  const cleanName = sanitizeTrainerName(parsed.tn);
  if (typeof parsed.tn !== 'string' || cleanName.length < 1 || cleanName.length > 24 || cleanName !== parsed.tn) {
    fail('INVALID_TRAINER_NAME', '$.tn', 'Trainer name must be 1..24 printable chars');
  }
  if (!Number.isSafeInteger(parsed.ts) || parsed.ts < 0) fail('INVALID_TIMESTAMP', '$.ts', 'Timestamp must be a non-negative integer');

  if (!Array.isArray(parsed.tm) || parsed.tm.length < 1 || parsed.tm.length > 3) {
    fail('INVALID_TEAM_SIZE', '$.tm', 'Team must contain 1..3 partners');
  } else {
    const allowSet = allowedSpecies instanceof Set ? allowedSpecies : Array.isArray(allowedSpecies) ? new Set(allowedSpecies) : null;
    parsed.tm.forEach((m, idx) => {
      const basePath = `$.tm[${idx}]`;
      if (!m || typeof m !== 'object' || Array.isArray(m)) {
        fail('INVALID_MEMBER', basePath, 'Member must be an object');
        return;
      }
      for (const k of Object.keys(m)) {
        if (!MEMBER_KEYS.includes(k)) fail('UNKNOWN_MEMBER_FIELD', `${basePath}.${k}`, `Unexpected member field ${k}`);
      }
      if (!Number.isInteger(m.sp) || m.sp < 8 || !isKnownSpeciesIndex(m.sp)) {
        fail('UNKNOWN_SPECIES', `${basePath}.sp`, `Unknown or non-combat speciesIndex ${m.sp}`);
      } else if (allowSet && !allowSet.has(m.sp)) {
        fail('DISALLOWED_SPECIES', `${basePath}.sp`, `Species ${m.sp} is outside the active roster allowlist`);
      }
      if (!Number.isInteger(m.lv) || m.lv < 1 || m.lv > ASYNC_PVP_MAX_SYNC_LEVEL) {
        fail('INVALID_SYNC_LEVEL', `${basePath}.lv`, `Sync level must be 1..${ASYNC_PVP_MAX_SYNC_LEVEL}`);
      }
      if (!Number.isInteger(m.p) || m.p < 0 || m.p > 7) {
        fail('INVALID_PERSONALITY', `${basePath}.p`, 'Personality index must be 0..7');
      }
      if (!Array.isArray(m.st) || m.st.length !== 7 || m.st.some((n) => !Number.isInteger(n) || n < 1)) {
        fail('INVALID_STATS_SHAPE', `${basePath}.st`, 'Stats must be 7 positive integers [hp,atk,def,spAtk,spDef,spd,tol]');
      } else if (Number.isInteger(m.sp) && m.sp >= 8 && isKnownSpeciesIndex(m.sp) && Number.isInteger(m.lv) && m.lv >= 1 && m.lv <= ASYNC_PVP_MAX_SYNC_LEVEL) {
        const ceilings = asyncPvpStatCeilings(m.sp, m.lv);
        if (ceilings) {
          m.st.forEach((val, col) => {
            if (val > ceilings[col]) {
              fail('STAT_EXCEEDS_CEILING', `${basePath}.st[${col}]`, `Stat ${val} exceeds legal ceiling ${ceilings[col]} for species ${m.sp} at lv ${m.lv}`);
            }
          });
        }
      }
      if (m.mv !== undefined) {
        if (!Array.isArray(m.mv) || m.mv.length < 1 || m.mv.length > 3 || m.mv.some((id) => typeof id !== 'string' || !MOVE_ID_RE.test(id))) {
          fail('INVALID_MOVES', `${basePath}.mv`, 'Moves must be 1..3 valid move identifiers');
        } else if (new Set(m.mv).size !== m.mv.length) {
          fail('DUPLICATE_MOVES', `${basePath}.mv`, 'Equipped moves must be unique');
        }
      }
      if (m.bf !== undefined) {
        if (!Number.isInteger(m.bf) || m.bf < 8 || !isKnownSpeciesIndex(m.bf)) {
          fail('INVALID_BURST_FORM', `${basePath}.bf`, `Unknown burst form ${m.bf}`);
        } else if (Number.isInteger(m.sp) && isKnownSpeciesIndex(m.sp)) {
          const legalForms = burstFormsFor(m.sp).map((entry) => entry.form);
          if (!legalForms.includes(m.bf)) {
            fail('ILLEGAL_BURST_LINEAGE', `${basePath}.bf`, `Species ${m.sp} cannot legally burst into ${m.bf}`);
          }
          if (allowSet && !allowSet.has(m.bf)) {
            fail('DISALLOWED_BURST_FORM', `${basePath}.bf`, `Burst form ${m.bf} is outside the active roster allowlist`);
          }
        }
      }
    });
  }

  if (typeof parsed.ck !== 'string' || !/^[0-9a-f]{16}$/.test(parsed.ck)) {
    fail('INVALID_CHECKSUM_FORMAT', '$.ck', 'Checksum must be 16 lowercase hex chars');
  } else if (Array.isArray(parsed.tm)) {
    const expected = computeAsyncPvpChecksum(parsed);
    if (parsed.ck !== expected) {
      fail('CHECKSUM_MISMATCH', '$.ck', 'Snapshot checksum does not match payload');
    }
  }

  if (errors.length > 0) return Object.freeze({ ok: false, errors: Object.freeze(errors) });

  const normalizedJson = JSON.stringify({
    s: parsed.s,
    v: parsed.v,
    rv: parsed.rv,
    tn: parsed.tn,
    ts: parsed.ts,
    tm: parsed.tm,
    ck: parsed.ck
  });
  const bytes = utf8ByteLength(normalizedJson);
  if (bytes > ASYNC_PVP_MAX_BYTES) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: 'PAYLOAD_TOO_LARGE', path: '$', message: `Snapshot exceeds ${ASYNC_PVP_MAX_BYTES} bytes (${bytes})` }]) });
  }
  return Object.freeze({ ok: true, snapshot: Object.freeze(structuredClone(parsed)), json: normalizedJson, bytes });
}
