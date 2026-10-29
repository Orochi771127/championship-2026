// Data Area story director (OWNER_APPROVED_ADAPTATION 2026-10-29): plays one
// "Unheard Echoes" chapter on the grid theater. It walks the chapter's beats
// (data/dataAreaStoryCampaign.js) and drives two layers it is handed:
//   stage    DataAreaCyberStage -- props, the partners acting, tags, noise
//   overlay  dataAreaStoryOverlay -- dialogue, choices, files, tasks, clash HUD
// plus an `evolve` hook for the awakening (the arcade evolution runner in
// preview mode: nothing is written).
//
// The four staged mechanisms:
//   sign             the partner runs up and stamps its own name on the entry form
//   flower           a heavy partner stops at a flower, "!", and steps round it
//   overwrite-names  name plates and floating tags glitch into "[Contestant]"
//   overwrite-line   "I want to go home" struck through and forced to "I am fine now"
//   awaken           "Leave the left to me" -> idle strobe evolution -> new form
//
// It owns no game state. One AbortController ends a run (skip, dispose);
// `from` fast-forwards silently to a labelled beat (QA and replays).

import { DATA_AREA_CAST, DATA_AREA_CHAPTERS, DATA_AREA_SPEAKERS, validateDataAreaChapter } from "../../data/dataAreaStoryCampaign.js";
import { dataAreaText } from "../../text/dataAreaStoryText.js";
import { storySleep } from "./HybridStoryDirector.js";

export const DATA_AREA_DIRECTOR_OUTCOMES = Object.freeze(["completed", "skipped", "aborted", "refused"]);
export const DATA_AREA_CLASH_DAMAGE = Object.freeze({ perfect: 42, good: 30, miss: 0, assist: 12, counter: 26 });
export const DATA_AREA_CLASH_HP = Object.freeze({ spar: 100, vanguard: 110, boss: 150 });

/** One clash, pure: grades in, HP and the outcome out (also used by the tests). */
export function resolveDataAreaClash({ kind = "spar", grades = [], ally = false }) {
  let foe = DATA_AREA_CLASH_HP[kind] ?? 100, ours = 100;
  const log = grades.map(grade => {
    const hit = DATA_AREA_CLASH_DAMAGE[grade] ?? 0, assist = ally ? DATA_AREA_CLASH_DAMAGE.assist : 0;
    foe = Math.max(0, foe - hit - assist);
    if (grade === "miss") ours = Math.max(0, ours - DATA_AREA_CLASH_DAMAGE.counter);
    return { grade, foe, ours };
  });
  return Object.freeze({ won: foe <= 0, foe, ours, log: Object.freeze(log) });
}

export function createDataAreaStoryDirector({
  stage = null, overlay, locale = "zh-Hant", reducedMotion = false, chapters = DATA_AREA_CHAPTERS,
  evolve = null, doc = globalThis.document, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, onBeat = null,
  switchStage = null
} = {}) {
  if (!overlay || typeof overlay.say !== "function") throw new TypeError("DATA_AREA_OVERLAY_REQUIRED");
  // `switchStage(kind, location)` swaps the grid theater for a 3-D field and back
  // (Moonlight-style locations); without it, field beats stay on the grid stage.
  const gridStage = stage;
  let controller = null, playing = null, disposed = false, onField = false;

  return Object.freeze({
    get isPlaying() { return playing !== null; },
    /**
     * Play a chapter. params: { tamer, partner (name), partnerSpecies,
     * partnerAwakeSpecies, autoPlay, from (a beat label to start at) }.
     * Resolves { outcome, chapterId, choices, clashes, mechanisms, lines }.
     */
    async play(chapterId, params = {}) {
      if (disposed) return Object.freeze({ outcome: "refused", reason: "DISPOSED", chapterId });
      if (playing) return Object.freeze({ outcome: "refused", reason: "ALREADY_PLAYING", chapterId });
      const chapter = chapters[chapterId];
      const problems = validateDataAreaChapter(chapter);
      if (problems.length) return Object.freeze({ outcome: "refused", reason: problems[0], chapterId });
      controller = new AbortController();
      const signal = controller.signal;
      const log = { lines: 0, choices: [], clashes: [], mechanisms: [], flags: [], exits: [] };
      const t = (key, extra = {}) => dataAreaText(key, locale, { tamer: params.tamer ?? "", partner: params.partner ?? "", ...extra }) ?? key;
      const nameOverrides = new Map();
      const startIndex = params.from ? chapter.beats.findIndex(beat => beat.label === params.from) : 0;
      let instant = startIndex > 0;
      const sleep = ms => (instant ? Promise.resolve() : storySleep(reducedMotion ? Math.min(ms, 160) : ms, { signal, doc, setTimer, clearTimer }));
      stage = gridStage; onField = false;
      const anchorAt = at => {
        if (typeof at !== "string") return at;
        const anchor = stage?.anchor?.(at);
        return anchor ? [anchor.x, anchor.y] : [0, 0];
      };
      const castSpec = (key, beat = {}) => {
        const cast = DATA_AREA_CAST[key];
        const species = key === "partner" ? params.partnerSpecies : key === "partnerAwake" ? (params.partnerAwakeSpecies ?? params.partnerSpecies) : cast.species;
        return { species, at: anchorAt(beat.at ?? [0, 0]), from: instant ? null : beat.from ?? null, face: beat.face ?? null,
          tag: cast.tagKey ? t(cast.tagKey) : null, faction: cast.faction, overwritten: cast.overwritten === true, boss: cast.boss === true, heavy: cast.heavy === true };
      };
      const speakerName = speaker => nameOverrides.get(speaker) ?? t(DATA_AREA_SPEAKERS[speaker]?.nameKey ?? "SPEAKER_NARRATOR");
      const actorOf = target => DATA_AREA_SPEAKERS[target]?.actor ?? (Object.hasOwn(DATA_AREA_CAST, target) ? target : null);
      // The awakened partner keeps the cast key "partner" until the awaken mechanism swaps it.
      const live = who => (who === "partner" && !stage?.has?.("partner") && stage?.has?.("partnerAwake") ? "partnerAwake" : who);

      async function say(speaker, text) {
        stage?.speaking?.(actorOf(speaker) ? live(actorOf(speaker)) : null);
        if (instant) return;
        await overlay.say({ speaker, name: speakerName(speaker), faction: DATA_AREA_SPEAKERS[speaker]?.faction ?? null, text, signal });
        log.lines += 1;
      }

      async function mechanism(beat) {
        log.mechanisms.push(beat.id);
        switch (beat.id) {
          case "sign": {
            if (instant) return;
            const form = overlay.signForm({ tamer: params.tamer ?? "", signal });
            await Promise.race([form.armed, new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))]);
            const home = stage?.position?.("partner") ?? [-0.58, 0.36];
            await stage?.bubble?.("partner", "!");
            await stage?.move?.("partner", beat.spot && onField ? anchorAt(beat.spot) : [0.05, 0.62], { face: "right" });
            await stage?.act?.("partner", "attack", { face: "right" });
            form.stamp(params.partner ?? "");
            stage?.bubble?.("partner", "heart");
            await stage?.act?.("partner", "cheer");
            await sleep(1100);
            form.close();
            await stage?.move?.("partner", home, { face: "right" });
            return;
          }
          case "flower": {
            const who = beat.who, flower = beat.prop;
            const spec = castSpec(who, { at: beat.from, face: "left" });
            await stage?.enter?.(who, { ...spec, from: null }, { instant });
            const sceneFlower = (chapter.beats.find(b => b.type === "scene" && (b.props ?? []).some(p => p.id === flower))?.props ?? []).find(p => p.id === flower)?.at;
            const flowerAt = sceneFlower ?? anchorAt(flower);
            const start = anchorAt(beat.from), lane = start[1];
            // Up to the flower on its own lane, "!", a careful step round behind it, past, then square off.
            // Grid units are platform fractions; field units are metres ("behind" is +y on a field).
            const route = onField
              ? [[flowerAt[0] + 1.5, lane], [flowerAt[0] + 0.9, flowerAt[1] + 1.4], [flowerAt[0] - 1.0, flowerAt[1] + 1.4]]
              : [[flowerAt[0] + 0.26, lane], [flowerAt[0] + 0.2, flowerAt[1] - 0.36], [flowerAt[0] - 0.16, flowerAt[1] - 0.36]];
            await stage?.move?.(who, route[0], { instant });
            stage?.bubble?.(who, "!");
            await sleep(700);
            await stage?.move?.(who, route[1], { instant });
            await stage?.move?.(who, route[2], { instant });
            await stage?.move?.(who, anchorAt(beat.to), { instant, face: "left" });
            await stage?.act?.(who, "attack", { face: "left", instant });
            stage?.face?.("partner", "right");
            return;
          }
          case "overwrite-names": {
            for (const target of beat.targets ?? []) {
              const restore = beat.to === "restore";
              const speakerEntry = DATA_AREA_SPEAKERS[target];
              if (restore) nameOverrides.delete(target); else if (speakerEntry) nameOverrides.set(target, t("CONTESTANT"));
              const actor = actorOf(target);
              const cast = actor ? DATA_AREA_CAST[actor] : null;
              const tag = restore ? (cast?.tagKey ? t(cast.tagKey) : "") : t("CONTESTANT");
              const tagged = stage?.setTag?.(live(actor), tag, { glitch: !beat.quiet, instant, state: restore ? "restored" : "overwritten" });
              if (speakerEntry && !beat.quiet && !instant) await overlay.glitchName?.(speakerName(target), { signal, alarm: !restore });
              await tagged;
            }
            return;
          }
          case "overwrite-line": {
            stage?.speaking?.(actorOf(beat.speaker));
            if (instant) return;
            stage?.noise?.(true);
            await overlay.sayOverwritten({ speaker: beat.speaker, name: speakerName(beat.speaker), faction: DATA_AREA_SPEAKERS[beat.speaker]?.faction ?? null,
              from: t(beat.fromKey), to: t(beat.toKey), signal });
            stage?.noise?.(false);
            log.lines += 1;
            return;
          }
          case "awaken": {
            const into = beat.into ?? "partnerAwake";
            if (!instant && evolve) {
              try { await evolve({ fromSpecies: params.partnerSpecies, toSpecies: params.partnerAwakeSpecies ?? params.partnerSpecies, fromName: params.partner ?? "", signal }); }
              catch (error) { if (signal.aborted) throw error; }
            }
            await stage?.transform?.("partner", into, castSpec(into, { at: stage?.position?.("partner") ?? [-0.55, 0.3], face: "right" }));
            if (!instant) { stage?.bubble?.(into, "spark"); await stage?.act?.(into, "cheer", { face: "right" }); }
            return;
          }
          default: throw new Error(`DATA_AREA_MECH_${beat.id}`);
        }
      }

      async function runTask(beat) {
        if (instant) return;
        switch (beat.id) {
          case "gift": {
            const gift = stage?.gift?.("partner");
            overlay.taskPrompt(t("TASK_GIFT"));
            await new Promise((resolve, reject) => {
              const off = stage?.target?.("actor", "partner", () => { off?.(); resolve(); }) ?? null;
              const stop = () => { off?.(); reject(signal.reason); };
              signal.addEventListener("abort", stop, { once: true });
              if (overlay.auto || !off) setTimer(() => { off?.(); resolve(); }, 900);
            });
            overlay.taskPrompt(null);
            gift?.setAttribute?.("data-taken", "true");
            stage?.propState?.("gift", "taken");
            stage?.bubble?.("partner", "heart");
            overlay.toast(t("GIFT_ITEM"), { kind: "gift" });
            try { doc?.dispatchEvent?.(new CustomEvent("cm-fx", { detail: { kind: "sparkle" } })); } catch { /* decoration */ }
            await sleep(600);
            gift?.remove?.();
            return;
          }
          case "break-echo": {
            const total = beat.count ?? 3;
            for (let n = 0; n < total; n++) {
              overlay.taskPrompt(t("TASK_BREAK", { n, total }));
              await new Promise((resolve, reject) => {
                const off = stage?.target?.("prop", beat.prop, () => { off?.(); resolve(); }) ?? null;
                signal.addEventListener("abort", () => { off?.(); reject(signal.reason); }, { once: true });
                if (overlay.auto || !off) setTimer(() => { off?.(); resolve(); }, 700);
              });
              stage?.act?.("rivalMon", "attack", { face: "right" });
              await stage?.act?.("partner", "attack", { face: "right" });
              stage?.propState?.(beat.prop, n + 1 >= total ? "broken" : `cracked-${n + 1}`);
            }
            overlay.taskPrompt(null);
            stage?.flash?.();
            await sleep(700);
            return;
          }
          case "cosign": {
            overlay.taskPrompt(t("TASK_COSIGN"));
            await overlay.cosign({ signal });
            overlay.taskPrompt(null);
            stage?.propState?.(beat.prop, "unlocked");
            await sleep(500);
            return;
          }
          case "identify": {
            const targets = [...(beat.targets ?? [])], total = targets.length;
            let found = 0;
            overlay.taskPrompt(t("TASK_IDENTIFY", { n: 0, total }));
            await new Promise((resolve, reject) => {
              const offs = [];
              const done = key => {
                found += 1;
                stage?.setTag?.(key, t(DATA_AREA_CAST[key].tagKey), { state: "restored" });
                stage?.bubble?.(key, "heart");
                stage?.face?.("partner", (stage?.position?.(key)?.[0] ?? 0) > (stage?.position?.("partner")?.[0] ?? 0) ? "right" : "left");
                overlay.taskPrompt(t("TASK_IDENTIFY", { n: found, total }));
                if (found >= total) { for (const off of offs) off?.(); resolve(); }
              };
              targets.forEach((key, index) => {
                let used = false;
                const off = stage?.target?.("actor", key, () => { if (used) return; used = true; off?.(); done(key); }) ?? null;
                offs.push(off);
                if (overlay.auto || !off) setTimer(() => { if (used) return; used = true; off?.(); done(key); }, 600 + index * 500);
              });
              signal.addEventListener("abort", () => { for (const off of offs) off?.(); reject(signal.reason); }, { once: true });
            });
            overlay.taskPrompt(null);
            return;
          }
          default: throw new Error(`DATA_AREA_TASK_${beat.id}`);
        }
      }

      async function clash(beat) {
        const kind = beat.kind ?? "spar", rounds = beat.rounds ?? 3, ally = beat.ally ? live(beat.ally) : null;
        const hero = live("partner");
        const preset = DATA_AREA_CAST[beat.foe]?.preset;
        if (!instant && preset !== undefined && typeof params.battle === "function") {
          // Moonlight-style hand-off: a banner, a fade, the game's own auto battle, then back on the result's branch.
          stage?.alarm?.(kind !== "spar");
          try { await overlay.warning({ word: kind === "spar" ? t("BATTLE_BANNER") : t("WARNING"), sub: t(kind === "boss" ? "CLASH_TITLE_BOSS" : kind === "vanguard" ? "CLASH_TITLE_VANGUARD" : "CLASH_TITLE_SPAR"), signal }); }
          finally { stage?.alarm?.(false); }
          await stage?.fade?.("out");
          const result = await params.battle({ presetIndices: [preset], kind, chapterId, signal });
          await stage?.fade?.("in");
          if (result?.ok) {
            log.clashes.push({ id: beat.id, won: result.won === true, battle: true });
            if (result.won) await stage?.act?.(hero, "cheer");
            else { stage?.bubble?.(hero, "heart"); await stage?.act?.(hero, "cheer"); }
            return result.won ? beat.win : beat.lose;
          }
        }
        if (instant) {
          const result = resolveDataAreaClash({ kind, grades: Array(rounds).fill("perfect"), ally: Boolean(ally) });
          log.clashes.push({ id: beat.id, won: result.won, grades: [] });
          return result.won ? beat.win : beat.lose;
        }
        const title = t(kind === "boss" ? "CLASH_TITLE_BOSS" : kind === "vanguard" ? "CLASH_TITLE_VANGUARD" : "CLASH_TITLE_SPAR");
        const foeCast = DATA_AREA_CAST[beat.foe];
        const hud = overlay.clash({ title, partnerName: params.partner ?? "", allyName: ally ? t(DATA_AREA_CAST[beat.ally].tagKey) : null, foeName: foeCast.tagKey ? t(foeCast.tagKey) : t("CONTESTANT") });
        const maxFoe = DATA_AREA_CLASH_HP[kind] ?? 100;
        hud.setHp("ours", 1); hud.setHp("theirs", 1);
        // Everyone faces the foe; the foe faces our partner.
        const xOf = key => { const p = stage?.position?.(key); return p ? (onField ? p[0] + p[1] : p[0]) : 0; };
        const toward = (from, to) => (xOf(to) >= xOf(from) ? "right" : "left");
        const heroFace = toward(hero, beat.foe), allyFace = ally ? toward(ally, beat.foe) : null, foeFace = toward(beat.foe, hero);
        stage?.face?.(hero, heroFace); if (ally) stage?.face?.(ally, allyFace); stage?.face?.(beat.foe, foeFace);
        const grades = [];
        try {
          for (let n = 1; n <= rounds; n++) {
            const grade = await hud.round(n, rounds, { signal });
            grades.push(grade);
            const state = resolveDataAreaClash({ kind, grades, ally: Boolean(ally) });
            if (grade === "miss") {
              await stage?.act?.(beat.foe, "attack", { face: foeFace });
              await stage?.act?.(hero, "hit", { face: heroFace });
            } else {
              const strike = stage?.act?.(hero, "attack", { face: heroFace });
              if (ally) stage?.act?.(ally, "attack", { face: allyFace });
              await strike;
              await stage?.act?.(beat.foe, "hit", { face: foeFace });
            }
            hud.setHp("theirs", state.foe / maxFoe); hud.setHp("ours", state.ours / 100);
            await sleep(260);
            if (state.won) break;
          }
          const result = resolveDataAreaClash({ kind, grades, ally: Boolean(ally) });
          log.clashes.push({ id: beat.id, won: result.won, grades: [...grades] });
          hud.finish(result.won);
          if (result.won) await stage?.act?.(hero, "cheer");
          else { stage?.bubble?.(hero, "heart"); await stage?.act?.(hero, "cheer"); }
          await sleep(1300);
          return result.won ? beat.win : beat.lose;
        } finally { hud.close(); }
      }

      async function toStage(kind, location = null) {
        if (!switchStage) return;
        const next = await switchStage(kind, location, { instant });
        if (next) { stage = next; onField = kind === "field"; }
      }

      /** Free exploration of a field: NPC talks, trigger events (once), exits gated by flags. */
      async function explore(beat) {
        const flags = new Set(log.flags);
        for (const npc of beat.npcs ?? []) await stage?.enter?.(npc.who, castSpec(npc.who, { at: npc.at, face: npc.face }), { instant: true });
        const markOn = id => { if (id) stage?.mark?.(id, true); };
        const markOff = id => { if (id) stage?.mark?.(id, false); };
        if (instant || !onField || typeof stage?.explore !== "function") {
          // No field here (fast-forward or the 2-D fallback): the required events play in order.
          for (const [id, trigger] of Object.entries(beat.triggers ?? {})) {
            if (!trigger.required) continue;
            if (!instant) await runList(trigger.beats ?? []);
            flags.add(id); log.flags.push(id);
          }
          return Object.keys(beat.exits ?? {})[0] ?? null;
        }
        let mark = beat.mark ?? null;
        overlay.objectiveHint?.(beat.hintKey ? t(beat.hintKey) : null); markOn(mark);
        try {
          return await new Promise((resolve, reject) => {
            let busy = false, session = null;
            const run = job => {
              if (busy) return; busy = true; session.lock(true);
              job().then(() => { busy = false; overlay.rest?.(); session?.lock(false); }, error => { session?.end(); reject(error); });
            };
            overlay.rest?.();
            session = stage.explore({
              partner: live("partner"), npcs: (beat.npcs ?? []).map(npc => npc.who), labels: { talk: t("BTN_TALK"), inspect: t("BTN_INSPECT") },
              onTalk: key => {
                const npc = (beat.npcs ?? []).find(entry => entry.who === key); if (!npc) return;
                run(async () => { for (const line of npc.talk ?? []) await say(line.speaker ?? key, t(line.key)); });
              },
              onTrigger: id => {
                const trigger = beat.triggers?.[id];
                if (!trigger || (trigger.once && flags.has(id))) return;
                run(async () => {
                  await runList(trigger.beats ?? []);
                  if (!flags.has(id)) { flags.add(id); log.flags.push(id); }
                  if (trigger.ends) { session.end(); resolve(id); return; }
                  if (trigger.hintAfter) overlay.objectiveHint?.(t(trigger.hintAfter));
                  if (trigger.mark) { markOff(mark); mark = trigger.mark; markOn(mark); }
                });
              },
              onExit: id => {
                const exit = beat.exits?.[id]; if (!exit || busy) return;
                const missing = (exit.requires ?? []).filter(flag => !flags.has(flag));
                if (missing.length) { run(async () => { await say(exit.lockedSpeaker ?? "partner", t(exit.lockedKey ?? "HAB_GATE_LOCKED")); }); return; }
                session.end(); resolve(id);
              }
            });
            signal.addEventListener("abort", () => { session?.end(); reject(signal.reason); }, { once: true });
          });
        } finally { overlay.objectiveHint?.(null); markOff(mark); }
      }

      async function runList(beats, { top = false } = {}) {
        const labels = new Map(beats.map((beat, index) => [beat.label, index]).filter(([label]) => label));
        let index = 0, guard = 0;
        while (index < beats.length) {
          signal.throwIfAborted();
          if (++guard > 600) throw new Error("DATA_AREA_BEAT_LOOP");
          if (top && instant && index >= startIndex) instant = false;
          const beat = beats[index];
          if (top) onBeat?.({ index, beat, instant });
          switch (beat.type) {
            case "field": await toStage("field", beat.location); break;
            case "camera": await stage?.camera?.(stage?.has?.(beat.target) || Array.isArray(beat.target) ? beat.target : anchorAt(beat.target), { ms: beat.ms ?? 600, instant }); break;
            case "fade": await stage?.fade?.(beat.dir ?? "in", { instant }); break;
            case "explore": { const exit = await explore(beat); log.exits.push(exit); break; }
            case "scene": if (onField) await toStage("grid"); await stage?.setScene?.(beat.set, beat.props ?? [], { instant }); break;
            case "enter": await stage?.enter?.(beat.who, castSpec(beat.who, beat), { instant }); break;
            case "exit": await stage?.exit?.(live(beat.who), beat.to ?? "warp", { instant }); break;
            case "move": await stage?.move?.(live(beat.who), anchorAt(beat.to), { instant, face: beat.face ?? null }); break;
            case "act": await stage?.act?.(live(beat.who), beat.action, { face: beat.face ?? null, instant }); break;
            case "bubble": if (!instant) { stage?.bubble?.(live(beat.who), beat.glyph); await sleep(520); } break;
            case "noise": stage?.noise?.(Boolean(beat.on)); break;
            case "line": await say(beat.speaker, t(beat.key)); break;
            case "file": if (!instant) await overlay.file({ title: t(beat.key), body: t(`${beat.key}_BODY`), signal }); break;
            case "warning": if (!instant) { stage?.alarm?.(true); try { await overlay.warning({ sub: t(beat.subKey ?? "WARNING_SUB_OVERWRITE"), signal }); } finally { stage?.alarm?.(false); } } break;
            case "objectives": {
              if (beat.keys) log.objectives = beat.keys;
              const keys = log.objectives ?? [];
              overlay.objectives({ title: t("OBJ_TITLE"), items: keys.map((key, i) => ({ text: t(key), done: i < (beat.done ?? 0) })) });
              if (!instant && beat.done) await sleep(420);
              break;
            }
            case "wait": await sleep(beat.ms ?? 0); break;
            case "mech": await mechanism(beat); break;
            case "task": await runTask(beat); break;
            case "clash": { const next = await clash(beat); const target = labels.get(next); if (target === undefined) throw new Error(`DATA_AREA_LABEL_${next}`); index = target; continue; }
            case "choice": {
              let picked = 0;
              if (!instant) picked = await overlay.choose({ prompt: t(beat.key), options: beat.options.map(option => t(option.key)), signal });
              const option = beat.options[picked] ?? beat.options[0];
              log.choices.push({ key: beat.key, picked: option.key });
              const target = labels.get(option.next); if (target === undefined) throw new Error(`DATA_AREA_LABEL_${option.next}`);
              index = target; continue;
            }
            case "jump": { const target = labels.get(beat.next); if (target === undefined) throw new Error(`DATA_AREA_LABEL_${beat.next}`); index = target; continue; }
            case "end": return;
            default: throw new Error(`DATA_AREA_BEAT_${beat.type}`);
          }
          index += 1;
        }
      }
      const runBeats = () => runList(chapter.beats, { top: true });

      let outcome = "completed";
      playing = (async () => {
        try {
          overlay.open?.({ title: `${t("CH_NUM", { n: chapter.number })} · ${t(chapter.titleKey)}`, auto: Boolean(params.autoPlay),
            onSkip: () => controller?.abort(new Error("STORY_SKIPPED")), canSkip: params.canSkip !== false });
          await runBeats();
        } catch (error) {
          outcome = error?.message === "STORY_SKIPPED" ? "skipped" : "aborted";
          if (outcome === "aborted" && error?.message !== "STORY_ABORTED") console.warn(`DATA_AREA_DIRECTOR: ${error?.message ?? error}`);
        } finally {
          overlay.close?.();
          stage?.speaking?.(null); stage?.noise?.(false); stage?.alarm?.(false);
          if (onField) { try { await switchStage?.("grid"); } catch { /* the field is gone */ } }
          stage = gridStage; onField = false;
          controller = null;
        }
        return Object.freeze({ outcome, chapterId, lines: log.lines, choices: Object.freeze(log.choices), clashes: Object.freeze(log.clashes), mechanisms: Object.freeze(log.mechanisms),
          flags: Object.freeze([...log.flags]), exits: Object.freeze([...log.exits]) });
      })();
      try { return await playing; } finally { playing = null; }
    },
    skip() { controller?.abort(new Error("STORY_SKIPPED")); },
    dispose() { disposed = true; controller?.abort(new Error("STORY_ABORTED")); }
  });
}
