// Story mode director (OWNER_APPROVED_ADAPTATION 2026-11-11): runs one chapter
// of the half-body visual novel beat by beat (data/storyVnCampaign.js) on the
// stage (storyVnStage.js) and the theater chrome (storyVnTheater.js).
//
// The host supplies what the director cannot know: the player's partner, the
// species names, the real auto battle (runBattle) and the first-clear claim.
// Skip / Esc fast-forwards lines until the next decision (a choice, a tap task
// or a battle). Leave aborts: nothing is claimed. The director writes nothing
// itself; the only state change is the host's claim at the end.

import { STORY_VN_CAST, STORY_VN_SPEAKERS, storyVnChapter, validateStoryVnChapter } from "../../data/storyVnCampaign.js";
import { storyVnText } from "../../text/storyVnText.js";
import { createStoryVnStage } from "./storyVnStage.js";
import { createStoryVnTheater } from "./storyVnTheater.js";

const INTERACTIVE = new Set(["choice", "tap", "battle"]);

export function createStoryVnDirector({
  doc = globalThis.document, host = doc.body, locale = "zh-Hant", reducedMotion = false, motionPlates = true, guideForm = "cat",
  speciesName = () => "", runBattle = null, claim = null,
  createStage = createStoryVnStage, createTheater = createStoryVnTheater
} = {}) {
  let running = null;

  async function play(chapterId, { tamer = "", partner = "", partnerSpecies = null, from = null } = {}) {
    if (running) return { outcome: "busy", chapterId };
    const chapter = storyVnChapter(chapterId);
    const problems = validateStoryVnChapter(chapterId, chapter);
    if (problems.length) return { outcome: "invalid", chapterId, problems };
    const params = { tamer, partner };
    const t = (key, extra = {}) => storyVnText(key, locale, { ...params, ...extra }) ?? key;
    const theater = createTheater({ doc, host, text: key => t(key), reducedMotion });
    const stage = createStage({ host: theater.stageHost, doc, reducedMotion, motionPlates });
    const life = new AbortController();
    let skipping = false;
    const tags = new Map(); // cast key -> "contestant" while overwritten
    const choices = [], battles = [];
    let objectiveItems = [];

    const speciesOf = key => key === "partner" ? partnerSpecies : STORY_VN_CAST[key]?.species ?? null;
    const castTag = key => {
      if (key === "partner") return null;
      if (tags.get(key) === "contestant") return t("CONTESTANT");
      const tagKey = STORY_VN_CAST[key]?.tagKey;
      return tagKey ? t(tagKey) : null;
    };
    function fastForward(on) { skipping = Boolean(on); theater.setFastForward(skipping); }
    const instant = () => skipping || reducedMotion;
    function guard() { if (life.signal.aborted) throw new DOMException("story aborted", "AbortError"); }
    // Every wait on the player races Leave, so a tap that never comes cannot hold the chapter open.
    const aborted = new Promise((_, reject) => life.signal.addEventListener("abort", () => reject(new DOMException("story aborted", "AbortError")), { once: true }));
    aborted.catch(() => {});
    const until = promise => Promise.race([promise, aborted]);
    const pause = ms => until(new Promise(resolve => setTimeout(resolve, ms)));

    async function line(beat) {
      const speaker = STORY_VN_SPEAKERS[beat.speaker];
      const narrator = beat.speaker === "narrator";
      const castKey = beat.alt && speaker.alt ? speaker.alt : speaker.cast;
      const side = beat.speaker === "partner" ? "right" : "left";
      if (!narrator) {
        if (castKey === "aichan") stage.setBust("left", { guide: guideForm || "cat" }, { key: "aichan", mood: beat.mood ?? "calm" });
        else { const species = speciesOf(castKey); if (species !== null) stage.setBust(side, { species }, { key: castKey, mood: beat.mood ?? "calm" }); }
      }
      // A speaker whose name plate is overwritten speaks as "【contestant】".
      const overwritten = castKey && tags.get(castKey) === "contestant";
      const name = narrator ? "" : overwritten ? t("CONTESTANT") : t(speaker.nameKey);
      const species = castKey && castKey !== "aichan" ? speciesOf(castKey) : null;
      const caption = speaker.tamer && species !== null ? t("VN_PARTNER_OF", { name: speciesName(species) }) : "";
      for (const s of ["left", "right"]) stage.bustMood(s, { active: !narrator && s === (castKey === "aichan" ? "left" : side), mood: beat.mood ?? "calm" });
      stage.speaking(castKey && stage.has(castKey) ? castKey : null);
      if (castKey && stage.has(castKey) && !skipping) {
        if (beat.mood === "shock") stage.bubble(castKey, "!");
        else if (beat.mood === "angry") stage.bubble(castKey, "anger");
      }
      await until(theater.say({ name, sub: caption, side: castKey === "aichan" ? "left" : side, faction: speaker.faction ?? "", narrator,
        text: t(beat.key), overwrite: beat.overwrite ? t(beat.overwrite) : null }));
    }

    async function battle(beat) {
      fastForward(false);
      await until(theater.battleBanner({ title: t(beat.titleKey), go: t("VN_BATTLE_GO") }));
      guard();
      let result = null;
      if (typeof runBattle === "function") {
        theater.setHidden(true);
        try { result = await until(runBattle({ presetIndices: beat.presets, signal: life.signal })); }
        catch (error) { if (error?.name === "AbortError") throw error; result = null; }
        finally { if (!life.signal.aborted) theater.setHidden(false); }
      }
      guard();
      if (!result?.ok) { await until(theater.toast(t("VN_BATTLE_REFUSED"))); battles.push({ presets: [...beat.presets], played: false, won: null }); return beat.win; }
      battles.push({ presets: [...beat.presets], played: true, won: Boolean(result.won) });
      await until(theater.toast(t(result.won ? "VN_BATTLE_WON" : "VN_BATTLE_LOST"), 1200));
      return result.won ? beat.win : beat.lose;
    }

    async function tap(beat) {
      fastForward(false);
      theater.hideBox();
      theater.prompt(t(beat.promptKey, { n: 0, total: beat.targets.length }));
      for (const [index, target] of beat.targets.entries()) {
        guard();
        theater.prompt(t(beat.promptKey, { n: index, total: beat.targets.length }));
        const label = beat.labels?.[index] ? t(beat.labels[index]) : t("VN_TAP");
        const handle = stage.tapTarget(target, { label, signal: life.signal });
        const hit = await until(handle.done);
        if (!hit) guard();
        if (beat.restore && target.who) { tags.delete(target.who); await stage.setTag(target.who, castTag(target.who), { instant: instant(), state: "restored" }); }
        else stage.fx("flash");
      }
      theater.prompt(null);
    }

    async function run(beats) {
      const index = new Map(beats.map((beat, i) => [beat.label, i]).filter(([label]) => label));
      let i = from && index.has(from) ? index.get(from) : 0;
      // Starting mid-chapter (review): the scene that beat stands in comes up first.
      const scene = i > 0 ? beats.slice(0, i).reverse().find(beat => beat.type === "bg") : null;
      if (scene) { await stage.setPlate(scene.id, { instant: true }); theater.location(scene.titleKey ? t(scene.titleKey) : null); }
      while (i < beats.length) {
        guard();
        const beat = beats[i];
        if (skipping && INTERACTIVE.has(beat.type)) fastForward(false);
        let next = null;
        switch (beat.type) {
          case "bg":
            if (!beat.keep) stage.clearActors();
            theater.hideBox();
            stage.setBust("left", null); stage.setBust("right", null);
            await stage.setPlate(beat.id, { cut: beat.cut ?? "fade", instant: instant() });
            theater.location(beat.titleKey ? t(beat.titleKey) : null);
            break;
          case "enter": {
            const spec = STORY_VN_CAST[beat.who];
            await stage.enter(beat.who, { species: speciesOf(beat.who), spec, x: beat.x, from: beat.from ?? null, face: beat.face ?? "left", tag: castTag(beat.who), instant: instant() });
            break;
          }
          case "exit": stage.dropBustOf(beat.who); await stage.exit(beat.who, beat.to ?? "warp", { instant: instant() }); break;
          case "move": await stage.move(beat.who, beat.x, { instant: instant(), face: beat.face ?? null }); break;
          case "act": await stage.act(beat.who, beat.action, { face: beat.face ?? null, instant: instant() }); break;
          case "bubble": if (!skipping) stage.bubble(beat.who, beat.glyph); break;
          case "line": await line(beat); break;
          case "choice": {
            const picked = await until(theater.choose({ prompt: t(beat.key), options: beat.options.map(option => t(option.key)) }));
            choices.push({ key: beat.key, option: beat.options[picked].key });
            next = beat.options[picked].next;
            break;
          }
          case "fx":
            if (beat.kind === "warning") await until(theater.warning({ title: t("WARNING"), sub: t(beat.subKey) }));
            else stage.fx(beat.kind, { on: beat.on !== false });
            if (beat.kind === "resonance" && !instant()) await pause(900);
            break;
          case "file": await until(theater.card({ title: t(beat.key), body: t(`${beat.key}_BODY`), close: t("FILE_CLOSE") })); break;
          case "form":
            await until(theater.form({ title: t("FORM_TITLE"), tamerLabel: t("FORM_TAMER"), tamer, partnerLabel: t("FORM_PARTNER"), partner, hint: t("FORM_HINT"), done: t("FORM_DONE") }));
            break;
          case "tag":
            for (const who of beat.who) {
              if (beat.to === "contestant") tags.set(who, "contestant"); else tags.delete(who);
              await stage.setTag(who, castTag(who), { glitch: !beat.quiet, instant: instant(), state: beat.to === "contestant" ? "overwritten" : "restored" });
            }
            break;
          case "tap": await tap(beat); break;
          case "objectives":
            if (beat.keys) objectiveItems = beat.keys.map(key => t(key));
            theater.objectives({ title: t("OBJ_TITLE"), items: objectiveItems, done: beat.done ?? 0 });
            break;
          case "battle": next = await battle(beat); break;
          case "wait": if (!instant()) await pause(beat.ms); break;
          case "jump": next = beat.next; break;
          case "end": return;
          default: break;
        }
        i = next ? index.get(next) : i + 1;
      }
    }

    // Ai-chan hosts every main chapter: a "last time" recap once the first scene is up,
    // a bond moment with the partner and a "next time" teaser before the clear card.
    const hosted = !chapter.side && storyVnText(`AIR_${chapter.mapNumber}`, locale) !== null;
    function hostBeats(beats) {
      if (!hosted || from) return beats;
      const first = beats.findIndex(beat => beat.type === "bg");
      const recap = { type: "line", speaker: "aichan", key: `AIR_${chapter.mapNumber}`, mood: "happy" };
      return first < 0 ? [recap, ...beats] : [...beats.slice(0, first + 1), recap, ...beats.slice(first + 1)];
    }
    const BOND = [["BOND_OPT_PAT", "BOND_REACT_PAT"], ["BOND_OPT_FIVE", "BOND_REACT_FIVE"], ["BOND_OPT_CHEER", "BOND_REACT_CHEER"]];
    let bond = null;
    async function bondMoment() {
      fastForward(false);
      if (partnerSpecies !== null) stage.setBust("right", { species: partnerSpecies }, { key: "partner", mood: "happy" });
      stage.bustMood("left", { active: false, mood: "calm" }); stage.bustMood("right", { active: true, mood: "happy" });
      const picked = await until(theater.choose({ prompt: t("BOND_PROMPT"), options: BOND.map(([key]) => t(key)) }));
      bond = BOND[picked][0];
      if (stage.has("partner") && !instant()) stage.act("partner", "cheer").catch(() => {});
      if (!instant()) stage.fx("resonance");
      await line({ speaker: "partner", key: BOND[picked][1], mood: "happy" });
      await until(theater.toast(t("BOND_TOAST"), 1100));
    }

    const label = chapter.side ? t("VN_SIDE_LABEL") : t("VN_CHAPTER_NUM", { n: chapter.mapNumber });
    running = { chapterId, theater, stage, life };
    theater.open({
      label: `${label}　${t(chapter.titleKey)}`,
      onSkip: () => { if (!skipping) fastForward(true); },
      onQuit: () => life.abort()
    });
    let outcome = "completed";
    try {
      if (!from) await until(theater.titleCard({ kicker: chapter.side ? t("VN_SIDE_LABEL") : t(chapter.partKey ?? "PART_ONE"), title: t(chapter.titleKey), sub: chapter.side ? "" : label }));
      await run(hostBeats(chapter.beats));
      if (hosted) {
        await bondMoment();
        await line({ speaker: "aichan", key: `AIN_${chapter.mapNumber}`, mood: "talk" });
      }
      fastForward(false);
      theater.hideBox(); theater.objectives({ items: [] });
      const reward = (typeof claim === "function" ? await claim(chapterId) : null) ?? null;
      const lines = [];
      if (reward?.granted) lines.push(`${t(chapter.side ? "VN_SIDE_REWARD" : "VN_REWARD")}　${t("VN_REWARD_TICKETS", { n: reward.granted })}`);
      else if (reward?.claimedBefore) lines.push(t("VN_REWARD_DONE"));
      for (const extra of reward?.lines ?? []) lines.push(extra);
      if (bond) lines.push(t("VN_BOND_LINE"));
      await Promise.race([
        theater.clearCard({ kicker: t("VN_CLEAR"), title: t(chapter.titleKey), echo: t(chapter.echoKey), lines, back: t("VN_BACK") }),
        new Promise(resolve => life.signal.addEventListener("abort", resolve, { once: true }))
      ]);
      return { outcome: "completed", chapterId, choices, battles, bond, reward, log: theater.log() };
    } catch (error) {
      outcome = error?.name === "AbortError" ? "aborted" : "failed";
      if (outcome === "failed") console.warn(`STORY_VN_FAILED: ${error?.message ?? error}`);
      return { outcome, chapterId, choices, battles, log: theater.log() };
    } finally {
      theater.close(); stage.dispose(); theater.dispose();
      running = null;
    }
  }

  return Object.freeze({
    play,
    get isPlaying() { return Boolean(running); },
    /** Loopback QA: the live chapter's state. */
    state() {
      if (!running) return null;
      return { chapterId: running.chapterId, actors: running.stage.keys(), left: running.stage.bustKey("left"), right: running.stage.bustKey("right"), log: running.theater.log().length };
    },
    stop() { running?.life.abort(); }
  });
}
