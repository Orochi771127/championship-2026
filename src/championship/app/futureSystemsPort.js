// Future-systems ports (Owner 2026-10-28): guest identity and account binding,
// tamer cards and friends, and story-mode chapters.
//
// Today every port answers locally: the player is a guest whose progress lives
// in the one product save, friends and cloud sync report that they need an
// account, and story chapters are validated data the cutscene stage plays. A
// later Firebase/Supabase (or any) backend replaces only the adapter passed in;
// callers, the save and its firewall do not change. No network, no second save,
// no second router. Storage goes through ChampionshipPersistentSavePort.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GUEST_ID = /^guest-[0-9a-f]{16}$/;

function defaultRandomBytes(count) {
  const bytes = new Uint8Array(count);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

// ---------------------------------------------------------------- AuthAndCloudSyncPort

/**
 * Guest identity now, account binding later. `identityStore` is the guest
 * identity side-port ({ read() → {text,error}, write(text) → {ok,error} }); a
 * missing or failing store still yields a working in-memory guest.
 * `cloudAdapter` (absent today) supplies { bindAccount, mergeGuestSave }.
 */
export function createAuthAndCloudSyncPort({ identityStore = null, cloudAdapter = null,
  now = () => new Date().toISOString(), randomBytes = defaultRandomBytes } = {}) {
  let identity = null;
  function readStored() {
    const { text } = identityStore?.read?.() ?? {};
    if (typeof text !== "string") return null;
    try {
      const value = JSON.parse(text);
      return value?.version === 1 && GUEST_ID.test(value.guestId) && typeof value.createdAt === "string" ? value : null;
    } catch { return null; }
  }
  function getSessionIdentity() {
    if (identity) return identity;
    let stored = readStored(), persisted = Boolean(stored);
    if (!stored) {
      const hex = [...randomBytes(8)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      stored = { version: 1, guestId: `guest-${hex}`, createdAt: now() };
      persisted = identityStore?.write?.(JSON.stringify(stored))?.ok === true;
    }
    identity = Object.freeze({ mode: "GUEST", guestId: stored.guestId, createdAt: stored.createdAt,
      provider: null, linked: false, persisted });
    return identity;
  }
  return Object.freeze({
    getSessionIdentity,
    /** Link the guest to an account provider (e.g. "google", "apple", "email"). */
    async bindAccount(provider) {
      if (typeof provider !== "string" || !provider) throw new TypeError("ACCOUNT_PROVIDER_REQUIRED");
      if (!cloudAdapter?.bindAccount) return Object.freeze({ ok: false, reason: "ACCOUNT_BINDING_UNAVAILABLE", provider });
      return cloudAdapter.bindAccount({ provider, identity: getSessionIdentity() });
    },
    /** Upload the guest's local save as the account's first cloud copy. */
    async mergeGuestSaveToCloud(localSave) {
      if (localSave === null || typeof localSave !== "object") throw new TypeError("LOCAL_SAVE_REQUIRED");
      if (!cloudAdapter?.mergeGuestSave) return Object.freeze({ ok: false, reason: "CLOUD_SYNC_UNAVAILABLE" });
      return cloudAdapter.mergeGuestSave({ identity: getSessionIdentity(), save: localSave });
    }
  });
}

// ---------------------------------------------------------------- SocialFriendPort

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (const unit of new TextEncoder().encode(text)) { hash ^= unit; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
}

/** A readable tamer card code, TM-XXXX-XXXX, stable for one guest and tamer name. */
export function tamerIdCode({ guestId, trainerName = "" } = {}) {
  if (typeof guestId !== "string" || !guestId) throw new TypeError("GUEST_ID_REQUIRED");
  const words = [fnv1a(`${guestId}|${trainerName}`), fnv1a(`${trainerName}|${guestId}|tm`)];
  let chars = "";
  for (const word of words) for (let shift = 15; shift >= 0; shift -= 5) chars += CROCKFORD[(word >>> shift) & 31];
  return `TM-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}
export function isTamerIdCode(code) {
  return typeof code === "string" && /^TM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(code);
}

/** A friend's defence team for an AI mirror friendly: up to three partners. */
export function normalizeFriendDefenseTeam(team) {
  if (!Array.isArray(team) || team.length < 1 || team.length > 3) throw new TypeError("DEFENSE_TEAM_SIZE");
  return Object.freeze(team.map(member => {
    if (!Number.isInteger(member?.speciesIndex) || member.speciesIndex < 0) throw new TypeError("DEFENSE_TEAM_SPECIES");
    return Object.freeze({ speciesIndex: member.speciesIndex, nickname: typeof member.nickname === "string" ? member.nickname : null,
      generation: Number.isInteger(member.generation) ? member.generation : null });
  }));
}

export function createSocialFriendPort({ auth, socialAdapter = null, now = () => new Date().toISOString() } = {}) {
  if (!auth?.getSessionIdentity) throw new TypeError("AUTH_PORT_REQUIRED");
  const needsAccount = Object.freeze({ ok: false, reason: "FRIENDS_REQUIRE_ACCOUNT" });
  return Object.freeze({
    getTamerCard({ trainerName = "" } = {}) {
      const identity = auth.getSessionIdentity();
      return Object.freeze({ code: tamerIdCode({ guestId: identity.guestId, trainerName }), trainerName, mode: identity.mode });
    },
    async listFriends() { return socialAdapter?.listFriends ? socialAdapter.listFriends(auth.getSessionIdentity()) : Object.freeze([]); },
    async addFriend(code) {
      if (!isTamerIdCode(code)) return Object.freeze({ ok: false, reason: "INVALID_TAMER_CODE" });
      return socialAdapter?.addFriend ? socialAdapter.addFriend({ identity: auth.getSessionIdentity(), code }) : needsAccount;
    },
    async getFriendDefenseTeam(code) {
      if (!isTamerIdCode(code)) return Object.freeze({ ok: false, reason: "INVALID_TAMER_CODE" });
      return socialAdapter?.getDefenseTeam ? socialAdapter.getDefenseTeam(code) : needsAccount;
    },
    /** The request a mirror friendly sends to the existing battle runtime later. */
    createMirrorMatchRequest({ friendCode, defenseTeam }) {
      if (!isTamerIdCode(friendCode)) throw new TypeError("INVALID_TAMER_CODE");
      return Object.freeze({ kind: "AI_MIRROR_FRIENDLY", friendCode, team: normalizeFriendDefenseTeam(defenseTeam), createdAt: now() });
    }
  });
}

// ---------------------------------------------------------------- StoryCampaignPort

export const STORY_CHAPTER_SCHEMA_VERSION = 1;
export const STORY_CAMERA_EFFECTS = Object.freeze(["none", "kenBurns", "pushIn", "shake", "flash"]);
const UNLOCK_KINDS = Object.freeze(["always", "newGame", "tutorialCompleted", "tamerRank", "chapterCleared"]);
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function illustrationList(value, where) {
  if (value === undefined || value === null) return Object.freeze([]);
  const list = Array.isArray(value) ? value : [value];
  if (list.length > 3) throw new TypeError(`STORY_ILLUSTRATIONS_MAX_3:${where}`);
  return Object.freeze(list.map(entry => {
    const art = typeof entry === "string" ? { src: entry } : entry;
    if (typeof art?.src !== "string" || !art.src || /^(?:[a-z]+:)?\/\//i.test(art.src)) throw new TypeError(`STORY_ILLUSTRATION_SRC:${where}`);
    return Object.freeze({ src: art.src, width: Number.isInteger(art.width) ? art.width : null,
      height: Number.isInteger(art.height) ? art.height : null, slot: typeof art.slot === "string" ? art.slot : null });
  }));
}

/**
 * Validate one chapter script and return it frozen and normalized. Throws a
 * TypeError naming the first problem. Illustrations are same-origin relative
 * paths only, so an imported script cannot point the game at a remote host.
 */
export function validateStoryChapter(chapter) {
  if (!chapter || typeof chapter !== "object") throw new TypeError("STORY_CHAPTER_REQUIRED");
  if (chapter.schemaVersion !== STORY_CHAPTER_SCHEMA_VERSION) throw new TypeError("STORY_SCHEMA_VERSION");
  if (!ID.test(chapter.chapterId ?? "")) throw new TypeError("STORY_CHAPTER_ID");
  const unlock = chapter.unlockCondition ?? { kind: "always" };
  if (!UNLOCK_KINDS.includes(unlock.kind)) throw new TypeError("STORY_UNLOCK_KIND");
  if (unlock.kind === "tamerRank" && !Number.isInteger(unlock.min)) throw new TypeError("STORY_UNLOCK_RANK");
  if (unlock.kind === "chapterCleared" && !ID.test(unlock.chapterId ?? "")) throw new TypeError("STORY_UNLOCK_CHAPTER");
  if (!Array.isArray(chapter.beats) || chapter.beats.length === 0 || chapter.beats.length > 200) throw new TypeError("STORY_BEATS");
  const beats = chapter.beats.map((beat, index) => {
    const where = `${chapter.chapterId}#${index}`;
    if (typeof beat?.text !== "string" || !beat.text.trim()) throw new TypeError(`STORY_BEAT_TEXT:${where}`);
    const cameraEffect = beat.cameraEffect ?? "kenBurns";
    if (!STORY_CAMERA_EFFECTS.includes(cameraEffect)) throw new TypeError(`STORY_CAMERA_EFFECT:${where}`);
    const choices = (beat.choices ?? []).map(choice => {
      if (!ID.test(choice?.id ?? "") || typeof choice.label !== "string" || !choice.label) throw new TypeError(`STORY_CHOICE:${where}`);
      return Object.freeze({ id: choice.id, label: choice.label, next: Number.isInteger(choice.next) ? choice.next : null });
    });
    if (choices.length > 4) throw new TypeError(`STORY_CHOICES_MAX_4:${where}`);
    const autoAdvanceMs = beat.autoAdvanceMs ?? null;
    if (autoAdvanceMs !== null && !(Number.isFinite(autoAdvanceMs) && autoAdvanceMs >= 500)) throw new TypeError(`STORY_AUTO_ADVANCE:${where}`);
    return Object.freeze({ id: typeof beat.id === "string" ? beat.id : `beat-${index}`,
      speaker: typeof beat.speaker === "string" && beat.speaker ? beat.speaker : null, text: beat.text,
      illustration: illustrationList(beat.illustration, where), cameraEffect, choices: Object.freeze(choices), autoAdvanceMs });
  });
  for (const [index, beat] of beats.entries()) for (const choice of beat.choices)
    if (choice.next !== null && (choice.next <= index || choice.next >= beats.length)) throw new TypeError(`STORY_CHOICE_TARGET:${chapter.chapterId}#${index}`);
  return Object.freeze({ schemaVersion: STORY_CHAPTER_SCHEMA_VERSION, chapterId: chapter.chapterId,
    title: typeof chapter.title === "string" ? chapter.title : null, unlockCondition: Object.freeze({ ...unlock }), beats: Object.freeze(beats) });
}

/** Whether a chapter is open for the given progress ({ newGame, tutorialCompleted, tamerRank, clearedChapters }). */
export function isStoryChapterUnlocked(chapter, progress = {}) {
  const unlock = chapter.unlockCondition;
  if (unlock.kind === "always") return true;
  if (unlock.kind === "newGame") return progress.newGame === true;
  if (unlock.kind === "tutorialCompleted") return progress.tutorialCompleted === true;
  if (unlock.kind === "tamerRank") return Number.isInteger(progress.tamerRank) && progress.tamerRank >= unlock.min;
  return Array.isArray(progress.clearedChapters) && progress.clearedChapters.includes(unlock.chapterId);
}

/**
 * Chapters registered in code, plus a loader for chapter files added later
 * (same-origin JSON). `fetchJson(url)` is injected so tests and the shipping
 * build choose their own transport.
 */
export function createStoryCampaignPort({ chapters = [], fetchJson = null } = {}) {
  const registry = new Map();
  const register = chapter => { const valid = validateStoryChapter(chapter); registry.set(valid.chapterId, valid); return valid; };
  for (const chapter of chapters) register(chapter);
  return Object.freeze({
    register,
    getChapter(chapterId) { return registry.get(chapterId) ?? null; },
    listChapters(progress = {}) {
      return Object.freeze([...registry.values()].map(chapter => Object.freeze({ chapterId: chapter.chapterId, title: chapter.title,
        unlocked: isStoryChapterUnlocked(chapter, progress) })));
    },
    async loadChapter(url) {
      if (typeof fetchJson !== "function") throw new TypeError("STORY_LOADER_UNAVAILABLE");
      if (typeof url !== "string" || /^(?:[a-z]+:)?\/\//i.test(url)) throw new TypeError("STORY_CHAPTER_URL_MUST_BE_RELATIVE");
      return register(await fetchJson(url));
    }
  });
}
