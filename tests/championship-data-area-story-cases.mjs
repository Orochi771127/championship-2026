// Data Area story mode, part one "Unheard Echoes" (Owner 2026-10-29): the six
// chapters' data and copy, the progress state machine read from the gacha
// once-only ledger, the first-clear rewards (tickets + evolution metals), and
// the director's four staged mechanisms -- the partner signing its own name,
// the heavy partner stepping round the flower, the name / line overwrite
// glitches and the chapter 6 awakening -- run against stage and overlay fakes.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import {
  DATA_AREA_CAST, DATA_AREA_CHAPTER_IDS, DATA_AREA_CHAPTERS, DATA_AREA_ECHO_LOG, DATA_AREA_FACTIONS, DATA_AREA_LINKS, DATA_AREA_SEQUENCES,
  dataAreaChapter, dataAreaChapterKeys, dataAreaChapterPlayable, dataAreaChapterStates, dataAreaEchoLog, dataAreaRewardKey, validateDataAreaChapter
} from "../src/championship/data/dataAreaStoryCampaign.js";
import { DATA_AREA_STORY_COPY, DATA_AREA_STORY_LOCALES, dataAreaMetalKey, dataAreaText } from "../src/championship/text/dataAreaStoryText.js";
import { createDataAreaStoryDirector, resolveDataAreaClash } from "../src/championship/presentation/story/dataAreaStoryDirector.js";
import { gradeClashTap, DATA_AREA_CLASH_RING } from "../src/championship/presentation/story/dataAreaStoryOverlay.js";
import { dataAreaDailyKey } from "../src/championship/app/dataAreaStoryScreen.js";
import { claimGachaReward, createCyberGachaState, GACHA_METALS } from "../src/championship/gacha/cyberGacha.js";
import { TOOLBAR_PRODUCT_ENTRIES } from "../src/championship/app/championshipToolbar.js";
import { UI_COPY } from "../src/championship/text/uiText.js";
import { UI_COPY_EN } from "../src/championship/text/uiText.en.js";
import { UI_COPY_JA } from "../src/championship/text/uiText.ja.js";
import { UI_COPY_TH } from "../src/championship/text/uiText.th.js";
import { UI_COPY_VI } from "../src/championship/text/uiText.vi.js";

const zh = DATA_AREA_STORY_COPY["zh-Hant"];

// ---- data and copy -----------------------------------------------------------
test("six chapters validate, end, and use only keys present in all five locales", () => {
  assert.deepEqual(DATA_AREA_CHAPTER_IDS, ["da1-c1", "da1-c2", "da1-c3", "da1-c4", "da1-c5", "da1-c6"]);
  const keys = Object.keys(zh).sort();
  for (const locale of DATA_AREA_STORY_LOCALES) assert.deepEqual(Object.keys(DATA_AREA_STORY_COPY[locale]).sort(), keys, locale);
  for (const id of DATA_AREA_CHAPTER_IDS) {
    const chapter = dataAreaChapter(id);
    assert.deepEqual(validateDataAreaChapter(chapter), [], id);
    assert.equal(chapter.beats.at(-1).type, "end");
    for (const key of dataAreaChapterKeys(chapter)) for (const locale of DATA_AREA_STORY_LOCALES) assert.ok(DATA_AREA_STORY_COPY[locale][key]?.trim(), `${id} ${locale}:${key}`);
    assert.ok(DATA_AREA_LINKS.includes(chapter.link), id);
    for (const faction of chapter.factions) assert.ok(DATA_AREA_FACTIONS[faction], faction);
  }
  assert.deepEqual(validateDataAreaChapter(null), ["NO_BEATS"]);
  assert.ok(validateDataAreaChapter({ cast: [], beats: [{ type: "enter", who: "nobody" }, { type: "end" }] })[0].startsWith("BEAT_0_ACTOR"));
  assert.ok(Object.isFrozen(DATA_AREA_CHAPTERS) && Object.isFrozen(DATA_AREA_STORY_COPY.vi));
});

test("the script carries the chapter titles, the faction stances and the required lines", () => {
  assert.equal(zh.C1_TITLE, "牠把自己的名字寫了上去");
  assert.equal(zh.C2_TITLE, "所有人都叫作「參賽者」");
  assert.equal(zh.C3_TITLE, "裂隙裡也有人在等你");
  assert.equal(zh.C4_TITLE, "兩邊都簽過的計畫");
  assert.equal(zh.C5_TITLE, "一個不再有人難過的地方");
  assert.equal(zh.C6_TITLE, "把名字帶回賽場");
  assert.equal(zh.HUB_TITLE, "未被聽見的回聲");
  assert.equal(zh.CONTESTANT, "【參賽者】");
  assert.equal(zh.C3_RES_TRUE, "我想回家……");
  assert.equal(zh.C3_RES_FORCED, "我現在很好。");
  assert.equal(zh.C6_P_LEFT, "左邊交給我。這次，我知道自己要做什麼。");
  assert.equal(zh.C6_RIN3, "上次那場還沒打完。今天別想我放水。");
  assert.match(zh.C5_HUSH3, /如果牠已經不想記得，你還要替牠保留什麼？/);
  assert.match(zh.C5_ANSWER, /生命有權保留記憶，也有權暫緩、放下或離開；但沒有人有權替所有生命作決定！/);
  assert.match(zh.C1_N_END, /不代表關係/);
  assert.deepEqual(Object.keys(DATA_AREA_FACTIONS), ["lumen", "iron", "lotus"]);
  assert.equal(zh.FACTION_LUMEN, "心輝議會"); assert.equal(zh.FACTION_IRON, "黑鐵駭客"); assert.equal(zh.FACTION_LOTUS, "黑蓮");
  assert.match(zh.FACTION_LOTUS_BLIND, /螺旋虛空領主/);
  // Names are filled at play time, never translated.
  assert.equal(dataAreaText("C6_REG2", "en", { partner: "Mochi" }), "Mochi. …It wrote this name itself, didn't it?");
  assert.equal(dataAreaText("TASK_BREAK", "ja", { n: 1, total: 3 }), "故障した反響装置をタップ（1/3）");
  assert.equal(dataAreaText("NOPE"), null);
  assert.equal(dataAreaMetalKey("metal:chrono-ore-shard"), "METAL_CHRONO_ORE_SHARD");
});

test("every actor is one of the product's own partners, with the five story sequences", () => {
  for (const [key, cast] of Object.entries(DATA_AREA_CAST)) {
    if (key === "partner" || key === "partnerAwake") { assert.equal(cast.species, null); continue; }
    assert.ok(Number.isInteger(cast.species) && cast.species >= 8 && cast.species < 230, key);
  }
  assert.equal(DATA_AREA_CAST.rivalMon.heavy, true);
  assert.equal(DATA_AREA_CAST.rivalMon.species, 50); // GR23 Clockwork Dragon, Black Iron's heavy partner
  assert.deepEqual(DATA_AREA_SEQUENCES, { idle: 0, walk: 2, attack: 7, hit: 6, cheer: 33 });
  for (const file of ["src/championship/data/dataAreaStoryCampaign.js", "src/championship/presentation/story/DataAreaCyberStage.js",
    "src/championship/presentation/story/dataAreaStoryDirector.js", "src/championship/app/dataAreaStoryScreen.js"]) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /research\/|ART_REFERENCE_LIBRARY|YDIJ|mt_mchbg/, file);
    assert.doesNotMatch(text, /https?:\/\//, file);
  }
  const data = fs.readFileSync("src/championship/data/dataAreaStoryCampaign.js", "utf8");
  assert.doesNotMatch(data, /^\s*import\s/m);
  assert.doesNotMatch(data, /localStorage|fetch\(|Math\.random/);
});

// ---- progress and rewards ----------------------------------------------------
test("chapter states follow the reward ledger: one open at a time, cleared chapters replay", () => {
  const none = dataAreaChapterStates([]);
  assert.deepEqual(none.chapters.map(c => c.state), ["open", "locked", "locked", "locked", "locked", "locked"]);
  assert.equal(none.current, "da1-c1"); assert.equal(none.cleared, 0); assert.equal(none.total, 6);
  const claimed = [];
  for (const [i, id] of DATA_AREA_CHAPTER_IDS.entries()) {
    assert.equal(dataAreaChapterPlayable(id, claimed), true, id);
    if (i < 5) assert.equal(dataAreaChapterPlayable(DATA_AREA_CHAPTER_IDS[i + 1], claimed), false);
    claimed.push(dataAreaRewardKey(id), "journal:5");
  }
  const all = dataAreaChapterStates(claimed);
  assert.ok(all.chapters.every(c => c.state === "cleared"));
  assert.equal(all.current, "da1-c6"); assert.equal(all.cleared, 6);
  assert.equal(dataAreaRewardKey("da1-c4"), "story:da1:c4");
  assert.equal(dataAreaChapterPlayable("da1-c9", []), false);
});

test("the investigation notes unlock one cause line at chapters 3, 4 and 6", () => {
  assert.equal(DATA_AREA_ECHO_LOG.length, 3);
  const unlocked = keys => dataAreaEchoLog(keys).map(entry => entry.unlocked);
  assert.deepEqual(unlocked([]), [false, false, false]);
  assert.deepEqual(unlocked(["story:da1:c1", "story:da1:c2", "story:da1:c3"]), [true, false, false]);
  assert.deepEqual(unlocked(["story:da1:c3", "story:da1:c4"]), [true, true, false]);
  assert.deepEqual(unlocked(DATA_AREA_CHAPTER_IDS.map(dataAreaRewardKey)), [true, true, true]);
  assert.match(zh.LOG_A1, /悲傷本身不是污染/);
});

test("first clears pay gacha tickets and an evolution metal once; the key alone records progress", () => {
  const metalIds = new Set(GACHA_METALS.map(metal => metal.id));
  let total = 0;
  for (const id of DATA_AREA_CHAPTER_IDS) {
    const { reward } = dataAreaChapter(id);
    assert.ok(reward.tickets >= 6, id);
    assert.ok(Object.keys(reward.metals).length >= 1 && Object.keys(reward.metals).every(metal => metalIds.has(metal)), id);
    for (const locale of DATA_AREA_STORY_LOCALES) for (const metal of Object.keys(reward.metals)) assert.ok(DATA_AREA_STORY_COPY[locale][dataAreaMetalKey(metal)], `${locale} ${metal}`);
    total += reward.tickets;
  }
  assert.equal(total, 46);
  const start = createCyberGachaState();
  const first = claimGachaReward(start, "story:da1:c1", 6, { metals: { "metal:emma-shard": 2 } });
  assert.equal(first.granted, 6);
  assert.deepEqual(first.metals, { "metal:emma-shard": 2 });
  assert.equal(first.state.metals["metal:emma-shard"], 2);
  assert.ok(first.state.claimed.includes("story:da1:c1"));
  const again = claimGachaReward(first.state, "story:da1:c1", 6, { metals: { "metal:emma-shard": 2 } });
  assert.equal(again.granted, 0); assert.deepEqual(again.metals, {});
  assert.equal(again.state.tickets, first.state.tickets);
  assert.throws(() => claimGachaReward(start, "story:da1:c2", 1, { metals: { "metal:nope": 1 } }), /INVALID_REWARD_METAL/);
  const keyOnly = claimGachaReward(start, "story:da1:c2", 0);
  assert.equal(keyOnly.granted, 0); assert.ok(keyOnly.state.claimed.includes("story:da1:c2"));
  // The old two-argument call still works (journal milestones).
  assert.equal(claimGachaReward(start, "journal:5", 3).granted, 3);
});

// ---- director ------------------------------------------------------------------
function fakeTimers() {
  let now = 0; const queue = [];
  return {
    setTimer(fn, ms) { const entry = { at: now + ms, fn, id: Symbol("t") }; queue.push(entry); return entry.id; },
    clearTimer(id) { const index = queue.findIndex(entry => entry.id === id); if (index >= 0) queue.splice(index, 1); },
    async tick(ms) { const until = now + ms; while (true) { queue.sort((a, b) => a.at - b.at); const next = queue[0]; if (!next || next.at > until) break; now = next.at; queue.shift(); next.fn(); for (let i = 0; i < 6; i++) await Promise.resolve(); } now = until; for (let i = 0; i < 6; i++) await Promise.resolve(); }
  };
}
function fakeOverlay({ picks = [], grades = [] } = {}) {
  const calls = []; let opened = null, choice = 0, round = 0;
  return {
    calls, auto: false,
    get opened() { return opened; },
    open(options) { opened = options; calls.push(["open", options.title, options.canSkip]); },
    close() { calls.push(["close"]); },
    say({ speaker, name, text }) { calls.push(["say", speaker, name, text]); return Promise.resolve(); },
    glitchName(name) { calls.push(["glitchName", name]); return Promise.resolve(); },
    sayOverwritten({ speaker, name, from, to }) { calls.push(["overwrite", speaker, name, from, to]); return Promise.resolve(); },
    choose({ prompt, options }) { calls.push(["choose", prompt, options.length]); return Promise.resolve(picks[choice++] ?? 0); },
    file({ title, body }) { calls.push(["file", title, body]); return Promise.resolve(); },
    warning({ sub }) { calls.push(["warning", sub]); return Promise.resolve(); },
    objectives({ items }) { calls.push(["objectives", items.filter(item => item.done).length, items.length]); },
    taskPrompt(text) { if (text) calls.push(["task", text]); },
    toast(text) { calls.push(["toast", text]); },
    signForm({ tamer }) { calls.push(["signForm", tamer]); return { armed: Promise.resolve(), stamp(name) { calls.push(["stamp", name]); }, close() { calls.push(["formClose"]); } }; },
    cosign() { calls.push(["cosign"]); return Promise.resolve(); },
    clash({ title, allyName, foeName }) {
      calls.push(["clash", title, allyName, foeName]);
      return { setHp() {}, round() { return Promise.resolve(grades[round++] ?? "perfect"); }, finish(won) { calls.push(["clashEnd", won]); }, close() {} };
    }
  };
}
function fakeStage() {
  const calls = [], at = new Map(), tags = new Map();
  return {
    calls, tags,
    setScene(set, props) { at.clear(); calls.push(["scene", set, props.length]); },
    enter(key, spec) { at.set(key, spec.at); tags.set(key, spec.tag); calls.push(["enter", key, spec.species, spec.from]); },
    exit(key) { at.delete(key); calls.push(["exit", key]); },
    move(key, to) { if (at.has(key)) at.set(key, to); calls.push(["move", key, to]); },
    act(key, action) { calls.push(["act", key, action]); },
    face(key, face) { calls.push(["face", key, face]); },
    has: key => at.has(key),
    position: key => at.get(key) ?? null,
    bubble(key, glyph) { calls.push(["bubble", key, glyph]); },
    setTag(key, text, options) { tags.set(key, text); calls.push(["tag", key, text, options?.state]); },
    speaking() {}, noise(on) { calls.push(["noise", on]); }, alarm() {}, flash() {},
    propState(id, state) { calls.push(["prop", id, state]); },
    target(kind, id, onTap) { calls.push(["target", kind, id]); queueMicrotask(onTap); return () => {}; },
    transform(key, into, spec) { at.set(into, at.get(key)); at.delete(key); calls.push(["transform", key, into, spec.species]); },
    gift(key) { calls.push(["gift", key]); return null; }
  };
}
const fakeDoc = { hidden: false, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
async function run(chapterId, { picks, grades, from = null, evolve = null } = {}) {
  const timers = fakeTimers(), overlay = fakeOverlay({ picks, grades }), stage = fakeStage();
  const director = createDataAreaStoryDirector({ stage, overlay, doc: fakeDoc, locale: "zh-Hant", reducedMotion: true, evolve, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const playing = director.play(chapterId, { tamer: "小光", partner: "小紅", partnerSpecies: 21, partnerAwakeSpecies: 70, from });
  for (let i = 0; i < 400 && director.isPlaying; i++) await timers.tick(200);
  const result = await playing;
  return { result, overlay, stage, director };
}
const said = overlay => overlay.calls.filter(call => call[0] === "say");

test("chapter 1: the partner signs its own name, the heavy partner steps round the flower, a won spar", async () => {
  const { result, overlay, stage } = await run("da1-c1", { grades: ["perfect", "perfect", "good"] });
  assert.equal(result.outcome, "completed");
  assert.deepEqual(result.mechanisms, ["sign", "flower"]);
  assert.deepEqual(result.clashes.map(c => [c.id, c.won]), [["c1-spar", true]]);
  // Mechanism A: the form opens with the tamer, the partner runs up, attacks (the stamp), the name is its own.
  const form = overlay.calls.findIndex(c => c[0] === "signForm"), stamp = overlay.calls.findIndex(c => c[0] === "stamp");
  assert.ok(form >= 0 && stamp > form);
  assert.deepEqual(overlay.calls[form], ["signForm", "小光"]);
  assert.deepEqual(overlay.calls[stamp], ["stamp", "小紅"]);
  assert.ok(stage.calls.some(c => c[0] === "act" && c[1] === "partner" && c[2] === "attack"));
  // Mechanism B: the heavy partner enters, stops with "!", steps off its lane round the flower, squares off.
  const enter = stage.calls.findIndex(c => c[0] === "enter" && c[1] === "rivalMon");
  const bang = stage.calls.findIndex((c, i) => i > enter && c[0] === "bubble" && c[1] === "rivalMon" && c[2] === "!");
  const moves = stage.calls.filter((c, i) => i > enter && c[0] === "move" && c[1] === "rivalMon").map(c => c[2]);
  assert.ok(enter >= 0 && bang > enter);
  assert.equal(moves.length, 4);
  const flower = [0, 0]; // no field here: the flower anchor resolves to the origin, grid offsets apply
  assert.ok(moves[1][1] < flower[1] - 0.2 && moves[2][1] < flower[1] - 0.2, "the detour passes behind the flower (-y on the grid stage)");
  assert.ok(moves[1][0] > flower[0] && moves[2][0] < flower[0], "it passes the flower's x while off the lane");
  assert.ok(said(overlay).some(c => c[3] === zh.C1_RIN_WIN));
  assert.ok(!said(overlay).some(c => c[3] === zh.C1_P_LOSE));
  assert.equal(overlay.opened.title, "第 1 章 · 牠把自己的名字寫了上去");
  assert.deepEqual(overlay.calls.at(-1), ["close"]);
});

test("chapter 1 lost: positive feedback, the chapter still completes", async () => {
  const { result, overlay, stage } = await run("da1-c1", { grades: ["miss", "miss", "miss"] });
  assert.equal(result.outcome, "completed");
  assert.deepEqual(result.clashes.map(c => c.won), [false]);
  assert.ok(said(overlay).some(c => c[3] === zh.C1_P_LOSE) && said(overlay).some(c => c[3] === zh.C1_RIN_LOSE));
  assert.ok(stage.calls.some(c => c[0] === "bubble" && c[1] === "partner" && c[2] === "heart"));
  assert.ok(stage.calls.some(c => c[0] === "act" && c[1] === "partner" && c[2] === "cheer"));
  assert.deepEqual(overlay.calls.filter(c => c[0] === "clashEnd"), [["clashEnd", false]]);
});

test("chapter 2: name plates and tags are overwritten to [Contestant]; both evidence files show", async () => {
  const { result, overlay, stage } = await run("da1-c2", { picks: [1] });
  assert.equal(result.outcome, "completed");
  assert.deepEqual(result.mechanisms, ["overwrite-names", "overwrite-names"]);
  const reg = said(overlay).filter(c => c[1] === "registrar").map(c => c[2]);
  assert.deepEqual(reg, ["登記員・歐蘭", "【參賽者】"]);
  assert.equal(said(overlay).find(c => c[1] === "mechanic")[2], "【參賽者】");
  assert.ok(overlay.calls.some(c => c[0] === "glitchName" && c[1] === "【參賽者】"));
  assert.deepEqual(stage.calls.filter(c => c[0] === "tag").map(c => [c[1], c[2], c[3]]), [["registrarMon", "【參賽者】", "overwritten"], ["mechanicMon", "【參賽者】", "overwritten"]]);
  assert.deepEqual(overlay.calls.filter(c => c[0] === "file").map(c => c[1]), [zh.C2_FILE_COUNCIL, zh.C2_FILE_IRON]);
  assert.deepEqual(result.choices, [{ key: "C2_CHOICE", picked: "C2_OPT_IRON" }]);
  assert.ok(said(overlay).some(c => c[3] === zh.C2_RIN_PICK) && !said(overlay).some(c => c[3] === zh.C2_EI_PICK));
  assert.ok(overlay.calls.some(c => c[0] === "warning"));
});

test("chapter 3: the humming partner guides, the echo relay breaks in three taps, 'I want to go home' is forced to 'I am fine now'", async () => {
  const { result, overlay, stage } = await run("da1-c3");
  assert.equal(result.outcome, "completed");
  assert.deepEqual(overlay.calls.find(c => c[0] === "overwrite"), ["overwrite", "resident", "休養區居民・小望", "我想回家……", "我現在很好。"]);
  assert.deepEqual(stage.calls.filter(c => c[0] === "prop" && c[1] === "bc").map(c => c[2]), ["cracked-1", "cracked-2", "broken"]);
  assert.equal(stage.calls.filter(c => c[0] === "target" && c[2] === "bc").length, 3);
  assert.ok(stage.calls.some(c => c[0] === "enter" && c[1] === "guide" && c[2] === 51));
});

test("chapter 4: two keys open the plan both sides signed; three residents get their names back", async () => {
  const { result, overlay, stage } = await run("da1-c4", { picks: [0] });
  assert.equal(result.outcome, "completed");
  assert.ok(overlay.calls.some(c => c[0] === "cosign"));
  assert.ok(stage.calls.some(c => c[0] === "prop" && c[1] === "term" && c[2] === "unlocked"));
  assert.deepEqual(overlay.calls.find(c => c[0] === "file").slice(1), [zh.C4_FILE_PLAN, zh.C4_FILE_PLAN_BODY]);
  const restored = stage.calls.filter(c => c[0] === "tag" && c[3] === "restored").map(c => c[1]).sort();
  assert.deepEqual(restored, ["resident", "residentB", "residentC"]);
  assert.equal(stage.tags.get("resident"), "小望");
});

test("chapter 5: the soul question, the answer, WARNING and the vanguard with a Black Iron ally", async () => {
  const { result, overlay } = await run("da1-c5", { picks: [1], grades: ["good", "good", "good"] });
  assert.equal(result.outcome, "completed");
  assert.ok(said(overlay).some(c => c[3] === zh.C5_HUSH3));
  assert.ok(said(overlay).some(c => c[1] === "partner" && c[3] === zh.C5_ANSWER));
  assert.deepEqual(overlay.calls.find(c => c[0] === "warning"), ["warning", zh.WARNING_SUB_OVERWRITE]);
  const clash = overlay.calls.find(c => c[0] === "clash");
  assert.equal(clash[2], "凜的拍檔");
  assert.deepEqual(result.clashes.map(c => c.won), [true]);
});

test("chapter 6: 'Leave the left to me' triggers the awakening, the awakened partner fights the vessel, the registrar reads its name", async () => {
  const evolved = [];
  const { result, overlay, stage } = await run("da1-c6", { evolve: async options => { evolved.push(options); } });
  assert.equal(result.outcome, "completed");
  assert.ok(result.mechanisms.includes("awaken"));
  assert.equal(evolved.length, 1);
  assert.deepEqual([evolved[0].fromSpecies, evolved[0].toSpecies, evolved[0].fromName], [21, 70, "小紅"]);
  const left = said(overlay).findIndex(c => c[3] === zh.C6_P_LEFT);
  const transform = stage.calls.findIndex(c => c[0] === "transform");
  assert.ok(left >= 0 && transform >= 0);
  assert.deepEqual(stage.calls[transform].slice(1), ["partner", "partnerAwake", 70]);
  assert.ok(stage.calls.slice(transform).some(c => c[0] === "act" && c[1] === "partnerAwake" && c[2] === "attack"));
  assert.ok(stage.calls.some(c => c[0] === "act" && c[1] === "vessel" && c[2] === "hit"));
  assert.deepEqual(overlay.calls.filter(c => c[0] === "objectives").map(c => c[1]), [0, 1, 2, 3]);
  assert.equal(overlay.calls.find(c => c[0] === "clash")[1], zh.CLASH_TITLE_BOSS);
  const regNames = said(overlay).filter(c => c[1] === "registrar").map(c => c[2]);
  assert.deepEqual(regNames, ["【參賽者】", "登記員・歐蘭"]);
  assert.equal(said(overlay).find(c => c[3].startsWith("小紅。"))[3], "小紅。……這是牠自己寫的名字，對吧？");
  assert.equal(said(overlay).at(-2)[3], zh.C6_RIN3);
});

test("fast-forward to a label plays the earlier beats silently and starts at that line", async () => {
  const { result, overlay, stage } = await run("da1-c6", { from: "left", evolve: async () => {} });
  assert.equal(result.outcome, "completed");
  assert.equal(said(overlay)[0][3], zh.C6_P_LEFT);
  assert.ok(stage.calls.some(c => c[0] === "enter" && c[1] === "vessel" && c[3] === null), "earlier entrances are placed, not walked");
  const missing = await run("da1-c3", { from: "overwrite" });
  assert.equal(said(missing.overlay).length > 0, true);
  assert.equal(missing.overlay.calls.find(c => c[0] === "overwrite")[3], "我想回家……");
  assert.equal(missing.overlay.calls.filter(c => c[0] === "say").some(c => c[3] === zh.C3_N1), false);
});

test("skip ends a run cleanly; a second play is refused while one runs; locked or broken chapters are refused", async () => {
  const timers = fakeTimers(), overlay = fakeOverlay(), stage = fakeStage();
  overlay.say = ({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  const director = createDataAreaStoryDirector({ stage, overlay, doc: fakeDoc, reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const playing = director.play("da1-c2", { partnerSpecies: 21 });
  assert.deepEqual(await director.play("da1-c1"), { outcome: "refused", reason: "ALREADY_PLAYING", chapterId: "da1-c1" });
  await timers.tick(2000);
  overlay.opened.onSkip();
  assert.equal((await playing).outcome, "skipped");
  assert.equal((await director.play("nope")).outcome, "refused");
  director.dispose();
  assert.equal((await director.play("da1-c1")).reason, "DISPOSED");
});

test("the clash: grades to damage, the ally assist, and the timing ring", () => {
  assert.equal(resolveDataAreaClash({ kind: "spar", grades: ["perfect", "perfect", "good"] }).won, true);
  assert.equal(resolveDataAreaClash({ kind: "spar", grades: ["good", "good", "good"] }).won, false);
  assert.equal(resolveDataAreaClash({ kind: "vanguard", grades: ["good", "good", "good"], ally: true }).won, true);
  const lost = resolveDataAreaClash({ kind: "boss", grades: ["miss", "miss", "miss", "miss"], ally: true });
  assert.equal(lost.won, false); assert.equal(lost.ours, 0);
  assert.equal(gradeClashTap(DATA_AREA_CLASH_RING.ms - 1), "perfect");
  assert.equal(gradeClashTap(0), "miss");
  assert.equal(gradeClashTap(DATA_AREA_CLASH_RING.ms * 0.8), "good");
});

test("entries: the System menu entry, the five-locale badge copy and the partner's daily line", () => {
  const entry = TOOLBAR_PRODUCT_ENTRIES.SYSTEM.find(e => e.action === "OPEN_DATA_AREA_STORY");
  assert.equal(entry.label, "DATA_AREA_MENU");
  for (const table of [UI_COPY, UI_COPY_EN, UI_COPY_JA, UI_COPY_TH, UI_COPY_VI]) for (const key of ["DATA_AREA_BADGE", "DATA_AREA_BADGE_LABEL", "DATA_AREA_MENU", "DATA_AREA_MENU_HINT", "DATA_AREA_BATTLE_HINT"]) assert.ok(table[key], key);
  assert.equal(UI_COPY.DATA_AREA_MENU_HINT, "第一部：未被聽見的回聲");
  const days = new Set([0, 1, 2, 3, 4].map(d => dataAreaDailyKey(new Date(Date.UTC(2026, 9, 29 + d, 12)))));
  assert.deepEqual([...days].sort(), ["DAILY_1", "DAILY_2", "DAILY_3", "DAILY_4"]);
  const locale = fs.readFileSync("scripts/check-locale-coverage.mjs", "utf8");
  assert.match(locale, /dataAreaStoryText\.js/);
  assert.match(fs.readFileSync("championship.html", "utf8"), /dataAreaStory\.css/);
});

// ---- 3-D story fields (Blender locations) -------------------------------------
import { createWalkGrid, inZone } from "../src/championship/presentation/story/storyField3D.js";
import { DATA_AREA_FIELDS } from "../src/championship/data/dataAreaStoryCampaign.js";

test("walk grid: walkability, height, nearest cell and an A* route round an obstacle", () => {
  // 6 x 4 cells of 1 m; a wall in column 2 except the top row.
  const rows = ["111111", "110111", "110111", "110111"];
  const grid = createWalkGrid({ cell: 1, cols: 6, rows: 4, origin: [0, 0], walk: rows.join(""), height: Array.from({ length: 24 }, (_, i) => (i % 6) * 0.5) });
  assert.equal(grid.walkable(0.5, 0.5), true);
  assert.equal(grid.walkable(2.5, 2.5), false);
  assert.ok(Math.abs(grid.heightAt(1.5, 1.5) - 0.5) < 1e-9);
  assert.deepEqual(grid.nearest(2.5, 2.5, 1).length, 2);
  assert.equal(grid.clear([0.5, 2.5], [4.5, 2.5]), false);
  const route = grid.path([0.5, 3.5], [4.5, 3.5]);
  assert.ok(route?.length >= 2, "goes round");
  assert.ok(route.some(([, y]) => y < 1), "through the gap in the top row");
  assert.deepEqual(route.at(-1), [4.5, 3.5]);
  assert.equal(grid.path([0.5, 0.5], [0.5, 0.5]).length, 1);
  assert.equal(inZone({ x: 2, y: 2, size: [2, 1] }, 2.9, 2.4), true);
  assert.equal(inZone({ x: 2, y: 2, size: [2, 1] }, 3.1, 2), false);
});

test("the habitat field: original Blender data, every anchor reachable from the spawn", () => {
  assert.deepEqual(DATA_AREA_FIELDS, ["habitat", "plaza"]);
  {
    // The plaza: the terminal, the duel spot and the rival's lane are all reachable; the flower is not walked on.
    const plaza = JSON.parse(fs.readFileSync("assets/production/story/fields-v1/plaza/field.json", "utf8"));
    const g = createWalkGrid(plaza.walk), s0 = plaza.anchors.spawn;
    for (const id of ["terminal", "sign_spot", "registrar", "rival_enter", "rival_stop", "duel", "arena", "stands"]) assert.ok(g.path([s0.x, s0.y], [plaza.anchors[id].x, plaza.anchors[id].y]), `plaza ${id} reachable`);
    assert.equal(g.walkable(plaza.anchors.flower.x, plaza.anchors.flower.y), false);
    const lane = g.path([plaza.anchors.rival_enter.x, plaza.anchors.rival_enter.y], [plaza.anchors.flower.x + 0.9, plaza.anchors.flower.y + 1.4]);
    assert.ok(lane, "the detour behind the flower is walkable");
  }
  const dir = "assets/production/story/fields-v1/habitat";
  const data = JSON.parse(fs.readFileSync(`${dir}/field.json`, "utf8"));
  assert.equal(data.schema, "STORY_FIELD.v1");
  assert.equal(data.origin, "ORIGINAL_BLENDER_PRIMITIVES");
  assert.equal(data.camera.elevationDegrees, 52);
  const glb = fs.readFileSync(`${dir}/scene.glb`);
  assert.equal(glb.subarray(0, 4).toString("latin1"), "glTF");
  assert.equal(glb.length, data.glb.bytes);
  assert.equal(data.walk.walk.length, data.walk.cols * data.walk.rows);
  assert.equal(data.walk.height.length, data.walk.cols * data.walk.rows);
  const grid = createWalkGrid(data.walk);
  const spawn = data.anchors.spawn;
  assert.ok(grid.walkable(spawn.x, spawn.y));
  for (const id of ["npc_moon", "npc_bell", "gift", "nest", "gate", "sign", "lookout"]) {
    const a = data.anchors[id];
    const route = grid.path([spawn.x, spawn.y], [a.x, a.y]);
    assert.ok(route, `${id} reachable`);
    if (a.kind === "trigger" || a.kind === "exit") assert.ok(inZone(a, ...route.at(-1)) || Math.hypot(route.at(-1)[0] - a.x, route.at(-1)[1] - a.y) < 1.2, `${id} zone reached`);
  }
  // The pond is not walkable; the terrace is reached by its ramp only.
  assert.equal(grid.walkable(4.4, -3.6), false);
  assert.ok(grid.heightAt(-4.6, 4.4) > 1);
  const text = fs.readFileSync("scripts/build-story-field.py", "utf8");
  assert.doesNotMatch(text, /research-only|ART_REFERENCE_LIBRARY|MOONLIGHT|\.nds/);
});

test("chapter 1 on a field: talk, a locked gate before the gift, the gift event, then the gate", async () => {
  const timers = fakeTimers(), overlay = fakeOverlay(), grid = fakeStage(), field = fakeStage();
  const hints = [], marks = [];
  overlay.objectiveHint = text => { hints.push(text); };
  overlay.rest = () => {};
  field.anchor = id => ({ spawn: { x: 1, y: 2 }, npc_moon: { x: 3, y: 3 }, npc_bell: { x: 4, y: 4 } })[id] ?? null;
  field.mark = (id, on) => { marks.push([id, on]); };
  field.camera = () => Promise.resolve();
  field.fade = () => Promise.resolve();
  field.explore = handlers => {
    const session = { lock() {}, end() { session.ended = true; } };
    if (!handlers.npcs.includes("neighborA")) { queueMicrotask(() => handlers.onTrigger("terminal")); return session; } // the plaza
    // The player: talks to a neighbour, tries the gate too early, finds the gift, then the gate.
    queueMicrotask(async () => {
      handlers.onTalk("neighborA");
      for (let i = 0; i < 20; i++) await Promise.resolve();
      handlers.onExit("gate");
      for (let i = 0; i < 20; i++) await Promise.resolve();
      handlers.onTrigger("gift");
      for (let i = 0; i < 40; i++) { await timers.tick(200); }
      handlers.onTrigger("gift"); // once only
      handlers.onExit("gate");
    });
    return session;
  };
  const switches = [];
  const director = createDataAreaStoryDirector({ stage: grid, overlay, doc: fakeDoc, locale: "zh-Hant", reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer,
    switchStage: async (kind, location) => { switches.push([kind, location]); return kind === "field" ? field : grid; } });
  const playing = director.play("da1-c1", { tamer: "小光", partner: "小紅", partnerSpecies: 21, grades: [] });
  for (let i = 0; i < 600 && director.isPlaying; i++) await timers.tick(200);
  const result = await playing;
  assert.equal(result.outcome, "completed");
  assert.deepEqual(switches.map(s => s[0] + ":" + (s[1] ?? null)), ["field:habitat", "field:plaza", "grid:null"]);
  assert.deepEqual(result.flags, ["gift", "terminal"]);
  assert.deepEqual(result.exits, ["gate", "terminal"]);
  assert.ok(result.mechanisms.includes("sign") && result.mechanisms.includes("flower"));
  const lines = said(overlay).map(c => c[3]);
  assert.ok(lines.includes(dataAreaText("HAB_A_1", "zh-Hant", { partner: "小紅" })) && lines.includes(zh.HAB_A_2));
  assert.equal(lines.filter(l => l === zh.HAB_GATE_LOCKED).length, 1, "the gate refuses once before the gift");
  assert.equal(lines.filter(l => l === zh.C1_P_GIFT).length, 1, "the gift event plays once");
  assert.ok(lines.indexOf(zh.HAB_GATE_LOCKED) < lines.indexOf(zh.C1_P_GIFT));
  assert.deepEqual(hints.filter(Boolean), [zh.HINT_GIFT, zh.HINT_GATE, zh.HINT_SIGNUP]);
  assert.deepEqual(marks.filter(([, on]) => on).map(([id]) => id), ["gift", "gate", "terminal"]);
  assert.ok(field.calls.some(c => c[0] === "enter" && c[1] === "neighborA" && c[2] === 18));
  assert.ok(field.calls.some(c => c[0] === "enter" && c[1] === "rivalMon" && c[2] === 50), "the GR23 Clockwork Dragon arrives on the plaza");
});

// ---- story battles on the game's own auto battle ---------------------------------
import { freeBattlePreset } from "../src/championship/battle/nativeFreeBattle.js";

test("story opponents are native free-battle presets of the same species", () => {
  for (const [key, cast] of Object.entries(DATA_AREA_CAST)) {
    if (cast.preset === undefined) continue;
    assert.equal(freeBattlePreset(cast.preset).field00, cast.species, key);
  }
  assert.equal(DATA_AREA_CAST.rivalMon.preset, 491);
  assert.equal(DATA_AREA_CAST.vessel.species, 148);
  for (const id of DATA_AREA_CHAPTER_IDS) for (const beat of dataAreaChapter(id).beats) if (beat.type === "clash") assert.ok(DATA_AREA_CAST[beat.foe].preset !== undefined, `${id} ${beat.id} has a native opponent`);
});

test("a clash hands off to the auto battle and follows its real result", async () => {
  for (const won of [true, false]) {
    const timers = fakeTimers(), overlay = fakeOverlay(), stage = fakeStage(), requests = [];
    const director = createDataAreaStoryDirector({ stage, overlay, doc: fakeDoc, locale: "zh-Hant", reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
    const playing = director.play("da1-c1", { tamer: "小光", partner: "小紅", partnerSpecies: 21, battle: async request => { requests.push(request); return { ok: true, won }; } });
    for (let i = 0; i < 400 && director.isPlaying; i++) await timers.tick(200);
    const result = await playing;
    assert.equal(result.outcome, "completed");
    assert.deepEqual(requests.map(r => [r.presetIndices, r.kind]), [[[491], "spar"]]);
    assert.deepEqual(result.clashes, [{ id: "c1-spar", won, battle: true }]);
    assert.ok(!overlay.calls.some(c => c[0] === "clash"), "no timing clash when the real battle runs");
    assert.ok(overlay.calls.some(c => c[0] === "warning"), "the entry banner shows first");
    const lines = said(overlay).map(c => c[3]);
    assert.equal(lines.includes(zh.C1_RIN_WIN), won);
    assert.equal(lines.includes(zh.C1_P_LOSE), !won, "a loss still plays the partner's encouragement");
  }
  // No battle available: the timing clash stands in.
  const timers = fakeTimers(), overlay = fakeOverlay({ grades: ["perfect", "perfect", "perfect"] }), stage = fakeStage();
  const director = createDataAreaStoryDirector({ stage, overlay, doc: fakeDoc, reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const playing = director.play("da1-c1", { partnerSpecies: 21, battle: async () => ({ ok: false, reason: "BATTLE_NOT_READY" }) });
  for (let i = 0; i < 400 && director.isPlaying; i++) await timers.tick(200);
  assert.deepEqual((await playing).clashes.map(c => c.won), [true]);
  assert.ok(overlay.calls.some(c => c[0] === "clash"));
});
