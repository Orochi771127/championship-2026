// Story mode part one, the half-body story theater (Owner 2026-11-11): the
// chapter data, its five-locale copy, the scene plates on disk, the stage
// layouts and the director's branches, run against fakes. No DOM, storage or
// network is touched by the data or the director.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import crypto from "node:crypto";

import {
  STORY_VN_BACKGROUNDS, STORY_VN_CAST, STORY_VN_CHAPTERS, STORY_VN_CHAPTER_IDS, STORY_VN_MAIN_IDS, STORY_VN_SIDE_IDS, STORY_VN_SPEAKERS,
  storyVnChapterKeys, storyVnChapterStates, storyVnRewardKey, validateStoryVnChapter
} from "../src/championship/data/storyVnCampaign.js";
import { STORY_VN_COPY, STORY_VN_LOCALES, storyVnText } from "../src/championship/text/storyVnText.js";
import { STORY_RIFT_MAP_NODES } from "../src/championship/data/storyRiftMap.js";
import { storyVnBustLayout, storyVnPlateLayout } from "../src/championship/presentation/story/storyVnStage.js";
import { storyVnFieldClamp, storyVnFieldDepth, storyVnFieldLayout } from "../src/championship/presentation/story/storyVnField.js";
import { createStoryVnDirector } from "../src/championship/presentation/story/storyVnDirector.js";
import { databaseHeroPortrait } from "../src/championship/presentation/databaseHeroPortraits.js";
import { STORY_VN_EXPRESSIONS, STORY_VN_MOOD_EXPRESSION, storyVnExpression } from "../src/championship/data/storyVnExpressions.js";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ---- data -------------------------------------------------------------------
test("three parts of main chapters, side stories, requests and the part-three hub validate and end", () => {
  const p3 = ["vn3-c1", "vn3-c2", "vn3-c3", "vn3-c4", "vn3-c5", "vn3-c6"];
  const p4 = ["vn4-c1", "vn4-c2", "vn4-c3", "vn4-c4", "vn4-c5", "vn4-c6"];
  const p5 = ["vn5-c1", "vn5-c2", "vn5-c3", "vn5-c4", "vn5-c5", "vn5-c6"];
  assert.deepEqual(STORY_VN_MAIN_IDS, ["vn1-c1", "vn1-c2", "vn1-c3", "vn1-c4", "vn1-c5", "vn1-c6", "vn2-c1", "vn2-c2", "vn2-c3", "vn2-c4", "vn2-c5", "vn2-c6", ...p3, ...p4, ...p5]);
  assert.deepEqual(STORY_VN_SIDE_IDS, ["vn1-s1", "vn1-s2", "vn2-s1", "vn2-s2", "vn3-r1", "vn3-r2", "vn3-r3", "vn3-r4", "vn3-r5", "vn3-r6", "vn4-r1", "vn4-r2", "vn4-r3", "vn4-r4", "vn5-r1", "vn5-r2", "vn5-r3", "vn5-r4"]);
  assert.deepEqual(p5.map(id => STORY_VN_CHAPTERS[id].mapNumber), [26, 27, 28, 29, 30, 31]);
  assert.deepEqual(p5.map(id => STORY_VN_CHAPTERS[id].needs ?? 0), [0, 1, 1, 2, 3, 4], "part five opens on its own requests");
  assert.deepEqual(p4.map(id => STORY_VN_CHAPTERS[id].mapNumber), [20, 21, 22, 23, 24, 25]);
  assert.deepEqual(p4.map(id => STORY_VN_CHAPTERS[id].needs ?? 0), [0, 1, 1, 2, 3, 4], "part four opens on its own requests");
  for (const id of STORY_VN_CHAPTER_IDS) {
    assert.deepEqual(validateStoryVnChapter(id), [], id);
    assert.equal(STORY_VN_CHAPTERS[id].beats.at(-1).type, "end", id);
    if (STORY_VN_CHAPTERS[id].hub) assert.equal(STORY_VN_CHAPTERS[id].reward, undefined, `${id}: a hub pays nothing`);
    else assert.equal(STORY_VN_CHAPTERS[id].reward.tickets, 1, `${id}: one ticket per chapter (Owner 2026-11-11)`);
  }
  // Part three is walked: every chapter and request but the sparring one explores a field.
  for (const id of [...p3, "vn3-r1", "vn3-r2", "vn3-r3", "vn3-r5", "vn3-r6", "vn3-hub", "vn4-c1", "vn4-c2", "vn4-c3", "vn4-c4", "vn4-r1", "vn4-r3", "vn5-c1", "vn5-c2", "vn5-c3", "vn5-c5", "vn5-r1", "vn5-r4"]) assert.ok(STORY_VN_CHAPTERS[id].beats.some(beat => beat.type === "explore"), id);
  // A spot never stages actors over the field, and every field has a way out.
  assert.deepEqual(validateStoryVnChapter("x", { beats: [{ type: "explore", field: "lobby", spots: [{ id: "a", kind: "inspect", at: [10, 10], beats: [{ type: "enter", who: "partner" }] }] }, { type: "end" }] }),
    ["x#0.a#0: enter inside a spot", "x#0: no way out"]);
  // Every main chapter but the last pair has at least one real battle in the arc; the first, fifth and sixth fight.
  const battles = STORY_VN_MAIN_IDS.filter(id => STORY_VN_CHAPTERS[id].beats.some(beat => beat.type === "battle"));
  assert.deepEqual(battles, ["vn1-c1", "vn1-c5", "vn1-c6", "vn2-c1", "vn2-c2", "vn2-c3", "vn2-c4", "vn2-c5", "vn2-c6", "vn3-c6", "vn4-c2", "vn4-c5", "vn4-c6", "vn5-c4", "vn5-c6"]);
  const battleBeats = beats => beats.flatMap(beat => [beat, ...(beat.spots ?? []).flatMap(spot => battleBeats(spot.beats ?? []))]).filter(beat => beat.type === "battle");
  const presets = STORY_VN_MAIN_IDS.flatMap(id => battleBeats(STORY_VN_CHAPTERS[id].beats).flatMap(beat => beat.presets));
  assert.deepEqual(presets, [491, 515, 542, 530, 563, 551, 530, 568, 574, 515, 563, 542, 566, 562, 570, 569, 559, 561, 565]);
  // Every story battle is a native free-battle preset whose partner the story shows.
  for (const [key, cast] of Object.entries(STORY_VN_CAST)) if (cast.preset) assert.ok(presets.includes(cast.preset) || key === "rivalMon", key);
  const data = read("src/championship/data/storyVnCampaign.js");
  assert.deepEqual(data.match(/^import .*$/gm), ['import { STORY_VN_PART_TWO_BACKGROUNDS, STORY_VN_PART_TWO_CAST, STORY_VN_PART_TWO_CHAPTERS, STORY_VN_PART_TWO_SPEAKERS } from "./storyVnPartTwo.js";',
    'import { STORY_VN_PART_THREE_BACKGROUNDS, STORY_VN_PART_THREE_CAST, STORY_VN_PART_THREE_CHAPTERS, STORY_VN_PART_THREE_SPEAKERS } from "./storyVnPartThree.js";',
    'import { STORY_VN_PART_FOUR_BACKGROUNDS, STORY_VN_PART_FOUR_CAST, STORY_VN_PART_FOUR_CHAPTERS, STORY_VN_PART_FOUR_SPEAKERS } from "./storyVnPartFour.js";',
    'import { STORY_VN_PART_FIVE_BACKGROUNDS, STORY_VN_PART_FIVE_CAST, STORY_VN_PART_FIVE_CHAPTERS, STORY_VN_PART_FIVE_SPEAKERS } from "./storyVnPartFive.js";'], "pure data, the later parts only");
  assert.equal(read("src/championship/data/storyVnPartFive.js").match(/^import /m), null, "part five is pure data");
  assert.equal(read("src/championship/data/storyVnPartFour.js").match(/^import /m), null, "part four is pure data");
  assert.equal(read("src/championship/data/storyVnPartThree.js").match(/^import /m), null, "part three is pure data");
  assert.doesNotMatch(data, /https?:|localStorage|fetch\(|Math\.random/);
});

test("every key a chapter reads exists in all five locales, with the tamer and partner placeholders intact", () => {
  assert.deepEqual(STORY_VN_LOCALES, ["zh-Hant", "en", "ja", "th", "vi"]);
  const keys = Object.keys(STORY_VN_COPY["zh-Hant"]).sort();
  for (const locale of STORY_VN_LOCALES) assert.deepEqual(Object.keys(STORY_VN_COPY[locale]).sort(), keys, locale);
  for (const id of STORY_VN_CHAPTER_IDS) for (const key of storyVnChapterKeys(id)) assert.ok(keys.includes(key), `${id}: ${key}`);
  for (const cast of Object.values(STORY_VN_CAST)) if (cast.tagKey) assert.ok(keys.includes(cast.tagKey), cast.tagKey);
  for (const key of keys) {
    const holes = value => (value.match(/\{(tamer|partner)\}/g) ?? []).sort().join();
    for (const locale of STORY_VN_LOCALES) assert.equal(holes(STORY_VN_COPY[locale][key]), holes(STORY_VN_COPY["zh-Hant"][key]), `${locale}:${key}`);
  }
  assert.equal(storyVnText("V1_NAVI_INVITE", "en", { tamer: "Ann" }).startsWith("Ann,"), true);
  assert.equal(storyVnText("VN_REWARD_TICKETS", "ja", { n: 6 }), "ガチャチケット ×6");
  const coverage = read("scripts/check-locale-coverage.mjs");
  assert.match(coverage, /inspectScopedLocaleCopy\('src\/championship\/text\/storyVnText\.js', STORY_VN_COPY\)/);
});

test("progress rides the once-only reward ledger: chapters open in order, side stories after chapter two", () => {
  assert.deepEqual(STORY_VN_CHAPTER_IDS.map(storyVnRewardKey), ["story:vn1:c1", "story:vn1:c2", "story:vn1:c3", "story:vn1:c4", "story:vn1:c5", "story:vn1:c6", "story:vn1:s1", "story:vn1:s2",
    "story:vn2:c1", "story:vn2:c2", "story:vn2:c3", "story:vn2:c4", "story:vn2:c5", "story:vn2:c6", "story:vn2:s1", "story:vn2:s2",
    "story:vn3:c0", "story:vn3:c1", "story:vn3:c2", "story:vn3:c3", "story:vn3:c4", "story:vn3:c5", "story:vn3:c6",
    "story:vn3:s1", "story:vn3:s2", "story:vn3:s3", "story:vn3:s4", "story:vn3:s5", "story:vn3:s6",
    "story:vn4:c1", "story:vn4:c2", "story:vn4:c3", "story:vn4:c4", "story:vn4:c5", "story:vn4:c6", "story:vn4:s1", "story:vn4:s2", "story:vn4:s3", "story:vn4:s4",
    "story:vn5:c1", "story:vn5:c2", "story:vn5:c3", "story:vn5:c4", "story:vn5:c5", "story:vn5:c6", "story:vn5:s1", "story:vn5:s2", "story:vn5:s3", "story:vn5:s4"]);
  const view = (claimed, options) => storyVnChapterStates(claimed, options).map(s => `${s.id}:${s.state}`).join(" ");
  const states = (claimed, options) => Object.fromEntries(storyVnChapterStates(claimed, options).map(s => [s.id, s.state]));
  assert.ok(Object.values(states([], { entryOpen: false })).every(state => state === "locked"));
  assert.deepEqual([states([])["vn1-c1"], states([])["vn1-c2"], states([])["vn1-s1"]], ["open", "locked", "locked"]);
  const two = states(["story:vn1:c1", "story:vn1:c2"]);
  assert.deepEqual([two["vn1-c3"], two["vn1-c4"], two["vn1-s1"], two["vn1-s2"]], ["open", "locked", "open", "open"]);
  // Part two follows part one: chapter 8 opens once chapter 7 (vn1-c6) is cleared; its keys are story:vn2:*.
  const all1 = ["c1", "c2", "c3", "c4", "c5", "c6"].map(c => `story:vn1:${c}`);
  assert.equal(states(all1.slice(0, 5))["vn2-c1"], "locked");
  assert.equal(states(all1)["vn2-c1"], "open");
  assert.equal(storyVnRewardKey("vn2-s2"), "story:vn2:s2");
  assert.equal(states([...all1, "story:vn2:c1"])["vn2-s1"], "open");
  // A side story never gates the main line.
  assert.equal(states(["story:vn1:c1", "story:vn1:c2", "story:vn1:c3"])["vn1-c4"], "open");
  // Part three: the hub opens after chapter 13; each chapter after 14 also needs 1, 2, 3, 4, 5 cleared requests.
  const all2 = [...all1, ...["c1", "c2", "c3", "c4", "c5", "c6"].map(c => `story:vn2:${c}`)];
  assert.equal(states(all2.slice(0, -1))["vn3-hub"], "locked");
  const p3 = [...all2, "story:vn3:c1"];
  const row = storyVnChapterStates(p3).find(s => s.id === "vn3-c2");
  assert.deepEqual([states(all2)["vn3-hub"], states(all2)["vn3-c1"], row.state, row.lock, row.need, row.have], ["open", "open", "locked", "requests", 1, 0]);
  assert.deepEqual([states(p3)["vn3-r1"], states(p3)["vn3-r2"], states(p3)["vn3-r3"]], ["open", "open", "locked"]);
  assert.equal(states([...p3, "story:vn3:s2"])["vn3-c2"], "open");
  assert.equal(states([...p3, "story:vn3:s2", "story:vn3:c2"])["vn3-c3"], "locked", "chapter 16 needs two requests");
  assert.equal(states([...p3, "story:vn3:s1", "story:vn3:s2", "story:vn3:c2"])["vn3-c3"], "open");
  assert.ok(!storyVnChapterStates(all2).some(s => s.id === "vn3-hub" && s.state === "cleared"), "a hub is never cleared");
  // Part four follows chapter 19 and counts only its own requests.
  const all3 = [...all2, ...["c1", "c2", "c3", "c4", "c5", "c6"].map(c => `story:vn3:${c}`), ...["s1", "s2", "s3", "s4", "s5", "s6"].map(c => `story:vn3:${c}`)];
  assert.equal(states(all3)["vn4-c1"], "open");
  assert.equal(states([...all3, "story:vn4:c1"])["vn4-c2"], "locked", "part three's requests do not count for part four");
  assert.equal(states([...all3, "story:vn4:c1", "story:vn4:s1"])["vn4-c2"], "open");
});

test("the chart carries chapters 2-7 and the two side stories, each playing its story-theater chapter", () => {
  const vnNodes = STORY_RIFT_MAP_NODES.filter(node => node.vnChapterId);
  // Parts one and two sit on the chart chapter by chapter; part three is one node, its hall.
  assert.deepEqual(vnNodes.map(node => node.vnChapterId), [...STORY_VN_CHAPTER_IDS.filter(id => (STORY_VN_CHAPTERS[id].part ?? 1) <= 2), "vn3-hub"]);
  assert.deepEqual(vnNodes.filter(n => n.kind === "chapter").map(n => n.number), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  for (const node of vnNodes.filter(n => n.kind === "side")) {
    const branch = STORY_RIFT_MAP_NODES.find(n => n.id === node.branchOf);
    assert.equal(STORY_VN_CHAPTERS[node.vnChapterId].after, branch.vnChapterId, node.id);
  }
  for (const node of vnNodes) if (!node.side) assert.equal(STORY_VN_CHAPTERS[node.vnChapterId].mapNumber ?? null, node.kind === "side" ? null : node.number);
});

// ---- art ----------------------------------------------------------------------
test("the living scene plates (still + parallax loop) are on disk, hashed, light, and recorded", () => {
  const manifest = JSON.parse(read("assets/production/story/vn-backgrounds-v3/manifest.json"));
  assert.equal(manifest.rightsStatus, "ORIGINAL_GENERATED");
  assert.match(manifest.generation.inputs, /approved opening art/, "style comes from the game's own art");
  assert.match(manifest.generation.motion, /Depth Anything V2 Small/, "only the commercial-safe depth model");
  const byId = new Map(manifest.assets.map(asset => [asset.id, asset]));
  const ambients = new Set(["leaves", "petals", "confetti", "dust", "fireflies", "data", "shards", "sparks"]);
  let total = 0;
  for (const [id, plate] of Object.entries(STORY_VN_BACKGROUNDS)) {
    const asset = byId.get(id); assert.ok(asset, id);
    for (const [path, record, limit] of [[plate.src, asset.still, 120_000], [plate.motion, asset.clip, 300_000]]) {
      assert.equal(path, record.path, id);
      const bytes = fs.readFileSync(new URL(`../${path}`, import.meta.url));
      const sha = crypto.createHash("sha256").update(bytes).digest("hex");
      assert.equal(sha, record.sha256, path); assert.ok(path.includes(sha.slice(0, 16)), path);
      assert.ok(bytes.length < limit, `${path} stays light`); total += bytes.length;
    }
    assert.match(plate.motion, /\.mp4$/); assert.ok(ambients.has(plate.ambient), id);
    assert.ok(plate.ground > 0.7 && plate.ground < 0.9, id);
  }
  assert.equal(Object.keys(STORY_VN_BACKGROUNDS).length, 27);
  assert.ok(total < 7_600_000, `the twenty-seven scenes stay under 7.6 MB (${total})`);
  const index = JSON.parse(read("assets/production/ART_PRODUCTION_INDEX.json"));
  const record = index.entries.find(entry => entry.manifestPath === "assets/production/story/vn-backgrounds-v3/manifest.json");
  assert.ok(record, "art index record"); assert.equal(record.rightsStatus, "ORIGINAL_GENERATED"); assert.equal(record.runtimeEligible, true);
});

test("drawn expressions: every file is on disk and hashed, frames its head, stays light, and is reached by a line mood", () => {
  const manifest = JSON.parse(read("assets/production/story/vn-expressions-v1/manifest.json"));
  assert.equal(manifest.rightsStatus, "ORIGINAL_GENERATED");
  assert.match(manifest.generation.inputs, /own Database hero art/);
  const byPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
  let total = 0, count = 0;
  for (const [species, moods] of Object.entries(STORY_VN_EXPRESSIONS)) {
    // Ai-chan (the guide) is drawn from her own approved portraits; every other key is a Database partner.
    if (!/^aichan-(cat|catgirl)$/.test(species)) assert.ok(databaseHeroPortrait(Number(species)), `${species} is a Database partner`);
    for (const [expression, art] of Object.entries(moods)) {
      const asset = byPath.get(art.src); assert.ok(asset, art.src);
      const bytes = fs.readFileSync(new URL(`../${art.src}`, import.meta.url));
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), asset.sha256, art.src);
      assert.ok(bytes.length < 90_000, `${art.src} stays light`); total += bytes.length; count++;
      const [cx, cy, size] = art.face;
      assert.ok(cx > 0 && cx < art.width && cy > 0 && cy < art.height && size > art.width * 0.15, `${art.src} head inside the art`);
      assert.ok(Object.values(STORY_VN_MOOD_EXPRESSION).includes(expression), expression);
    }
  }
  assert.ok(count >= 30, `${count} drawn expressions`);
  assert.ok(total < 3_600_000, `expressions stay under 3.6 MB (${total})`);
  for (const form of ["aichan-cat", "aichan-catgirl"]) for (const mood of ["happy", "shock", "sad", "serious", "talk"]) assert.ok(storyVnExpression(form, mood), `${form} ${mood}`);
  // The recurring rival speaks with drawn faces; a mood with no drawing keeps the Database art.
  assert.equal(storyVnExpression(50, "angry").expression, "angry");
  assert.equal(storyVnExpression(50, "think").expression, "serious");
  assert.equal(storyVnExpression(50, "calm"), null);
  assert.equal(storyVnExpression(21, "happy"), null, "the player's partner keeps its own art");
});

test("every speaking cast member and every actor has Database hero art for its bust", () => {
  for (const [key, cast] of Object.entries(STORY_VN_CAST)) {
    if (cast.species === null) continue;
    const hero = databaseHeroPortrait(cast.species);
    assert.ok(hero?.src?.endsWith(".webp"), `${key} ${cast.species}`);
  }
  for (const speaker of Object.values(STORY_VN_SPEAKERS)) if (speaker.cast) assert.ok(STORY_VN_CAST[speaker.cast], speaker.cast);
});

test("plate layout covers the box, keeps the ground line low, and the bust turns its head toward the middle", () => {
  const wide = storyVnPlateLayout({ naturalWidth: 1536, naturalHeight: 1024, ground: 0.8, focus: 0.5 }, { width: 1366, height: 640 });
  assert.ok(wide.width >= 1366 && wide.height >= 640 && wide.left <= 0 && wide.top <= 0);
  assert.ok(Math.abs(wide.groundY - 640 * 0.9) < 1 || wide.top === 640 - wide.height, "ground near 90 % unless the plate runs out");
  const tall = storyVnPlateLayout({ naturalWidth: 1536, naturalHeight: 1024, ground: 0.8, focus: 0.62 }, { width: 390, height: 640 });
  assert.equal(tall.height, 640); assert.ok(tall.left < 0 && tall.left >= 390 - tall.width);
  const portrait = { width: 800, height: 800, face: [600, 240, 200] };
  const left = storyVnBustLayout(portrait, { frameWidth: 400, frameHeight: 600, side: "left" });
  const right = storyVnBustLayout(portrait, { frameWidth: 400, frameHeight: 600, side: "right" });
  assert.equal(left.mirror, false, "art facing right already looks into the screen from the left");
  assert.equal(right.mirror, true);
  assert.equal(Math.round(left.left + 600 * left.scale), 200, "head centred in the frame");
  assert.equal(Math.round(right.left + (800 - 600) * right.scale), 200, "mirrored head centred too");
  // The art always reaches the frame's foot (its crop edge hides behind the dialogue box), and stays within 1.35 frame widths.
  assert.ok(left.top + left.height >= 600, "art reaches the foot");
  assert.ok(left.width <= 400 * 1.35 + 0.5);
  const short = storyVnBustLayout({ width: 600, height: 300, face: [300, 120, 120] }, { frameWidth: 400, frameHeight: 600, side: "left" });
  assert.ok(short.top + short.height >= 600 && short.top + short.height <= 612, "a short (cropped) figure stands on the foot");
});

// ---- director -------------------------------------------------------------------
function fakes({ choose = () => 0, board = () => null } = {}) {
  const calls = [];
  const stage = {
    setPlate: async id => calls.push(["plate", id]), enter: async key => calls.push(["enter", key]), exit: async key => calls.push(["exit", key]),
    move: async () => {}, act: async () => {}, clearActors: () => {}, has: () => true, keys: () => [], bubble: () => {}, setTag: async (key, text) => calls.push(["tag", key, text]),
    speaking: () => {}, setBust: (side, who) => calls.push(["bust", side, who?.species ?? (who?.guide ? "aichan" : who?.navi ? "navi" : null)]), bustMood: () => {}, bustKey: () => null, dropBustOf: () => {},
    fx: kind => calls.push(["fx", kind]), tapTarget: () => ({ done: Promise.resolve(true) }), dispose: () => calls.push(["stage-dispose"])
  };
  const theater = {
    stageHost: {}, open: () => {}, close: () => {}, dispose: () => calls.push(["theater-dispose"]), setFastForward: on => calls.push(["fast", on]), setHidden: () => {},
    titleCard: async () => {}, location: () => {}, hideBox: () => {}, prompt: () => {}, objectives: () => {}, warning: async () => {}, toast: async text => calls.push(["toast", text]),
    say: async line => calls.push(["say", line.name, line.text]), choose: async ({ options }) => choose(options), card: async card => calls.push(["card", card.title]), form: async form => calls.push(["form", form.partner]),
    board: async ({ items }) => { calls.push(["board", items.map(item => item.id)]); return board(items); },
    battleBanner: async () => {}, clearCard: async card => calls.push(["clear", card.lines]), log: () => []
  };
  return { calls, createStage: () => stage, createTheater: () => theater };
}

test("a chapter plays to its clear card, claims once, and shows the partner signing its own name", async () => {
  const f = fakes(); let claims = 0;
  const director = createStoryVnDirector({ doc: {}, host: {}, ...f, speciesName: () => "發條龍",
    runBattle: async ({ presetIndices }) => ({ ok: true, won: presetIndices[0] === 491 }), claim: async () => { claims++; return { granted: 6 }; } });
  const result = await director.play("vn1-c1", { tamer: "阿凱", partner: "小紅", partnerSpecies: 21 });
  assert.equal(result.outcome, "completed"); assert.equal(claims, 1);
  assert.deepEqual(result.battles, [{ presets: [491], played: true, won: true }]);
  assert.ok(f.calls.some(c => c[0] === "form" && c[1] === "小紅"));
  assert.ok(f.calls.some(c => c[0] === "say" && c[2] === "……不錯嘛。下次我可不會讓。"), "win branch line");
  assert.ok(!f.calls.some(c => c[0] === "say" && c[2] === "沒關係！輸掉的是這一場，不是我們。"), "lose branch skipped");
  assert.ok(f.calls.some(c => c[0] === "say" && c[1] === "黑鐵駭客・凜"));
  assert.ok(f.calls.some(c => c[0] === "bust" && c[1] === "right" && c[2] === 21), "the partner speaks from the right");
  assert.deepEqual(f.calls.find(c => c[0] === "clear")[1], ["首通獎勵　數碼轉蛋券 ×6", "與小紅的羈絆 ♥ +1"]);
  // Ai-chan hosts: a recap after the first scene, the bond moment and a teaser before the clear card.
  const said = f.calls.filter(c => c[0] === "say");
  assert.equal(said[0][1], "愛醬"); assert.ok(said[0][2].startsWith("上回"));
  assert.equal(result.bond, "BOND_OPT_PAT");
  assert.ok(said.some(c => c[2] === "嘿嘿……阿凱的手，暖暖的。"), "the partner answers the bond moment");
  assert.ok(said.at(-1)[1] === "愛醬" && said.at(-1)[2].startsWith("下回預告"));
  assert.ok(f.calls.some(c => c[0] === "bust" && c[1] === "left" && c[2] === "aichan"), "Ai-chan speaks from the left");
  assert.ok(f.calls.some(c => c[0] === "stage-dispose") && f.calls.some(c => c[0] === "theater-dispose"));
});

test("a lost battle takes the lose branch; a battle that cannot start carries on as a win", async () => {
  const lost = fakes();
  await createStoryVnDirector({ doc: {}, host: {}, ...lost, runBattle: async () => ({ ok: true, won: false }) }).play("vn1-c1", { partner: "小紅", partnerSpecies: 21 });
  assert.ok(lost.calls.some(c => c[0] === "say" && c[2] === "沒關係！輸掉的是這一場，不是我們。"));
  const refused = fakes();
  const result = await createStoryVnDirector({ doc: {}, host: {}, ...refused, runBattle: async () => ({ ok: false, reason: "TEAM_REQUIRED" }) }).play("vn1-c1", { partner: "小紅", partnerSpecies: 21 });
  assert.ok(refused.calls.some(c => c[0] === "toast" && c[1] === "現在無法開始對戰，劇情直接往下走。"));
  assert.deepEqual(result.battles, [{ presets: [491], played: false, won: null }]);
  assert.ok(refused.calls.some(c => c[0] === "say" && c[2] === "……不錯嘛。下次我可不會讓。"));
});

test("overwritten name plates speak as 【參賽者】 until restored, and choices take their branch", async () => {
  const f = fakes({ choose: () => 1 });
  const result = await createStoryVnDirector({ doc: {}, host: {}, ...f }).play("vn1-c2", { partner: "小紅", partnerSpecies: 21 });
  assert.deepEqual(result.choices, [{ key: "C2_CHOICE", option: "C2_OPT_IRON" }]);
  assert.ok(f.calls.some(c => c[0] === "say" && c[1] === "【參賽者】" && c[2].startsWith("【參賽者】，請入場")));
  assert.ok(f.calls.some(c => c[0] === "say" && c[2] === "中繼器放大了訊號，我不否認。但源頭不在我們這裡。"));
  assert.ok(!f.calls.some(c => c[0] === "say" && c[2] === "我們的推論沒錯……可是保全區，確實很久沒有人進去了。"));
});

test("leaving mid-line aborts without a claim; an invalid or busy start is refused", async () => {
  const f = fakes(); let claims = 0;
  let release;
  f.createTheater = (() => { const base = fakes().createTheater(); return () => ({ ...base, say: () => new Promise(resolve => { release = resolve; }) }); })();
  const director = createStoryVnDirector({ doc: {}, host: {}, ...f, claim: () => { claims++; return null; } });
  const run = director.play("vn1-c3", { partner: "小紅", partnerSpecies: 21 });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await director.play("vn1-c4")).outcome, "busy");
  director.stop();
  const result = await run;
  assert.equal(result.outcome, "aborted"); assert.equal(claims, 0); assert.equal(director.isPlaying, false);
  assert.equal(typeof release, "function");
  assert.equal((await director.play("nope")).outcome, "invalid");
});

// ---- wiring ---------------------------------------------------------------------
test("the app wires the theater into the chart, the real battle and the reward ledger", () => {
  const main = read("src/championship/app/main.js");
  assert.match(main, /onPlay: \(next, node\) => node\?\.vnChapterId === 'vn3-hub' \? openUnionHub\(\{ source: 'map' \}\) : node\?\.vnChapterId \? playVnChapter\(node\.vnChapterId/);
  // Part three's hall: picked chapters play and the player comes back to the hall; the board lists part three only.
  assert.match(main, /if \(result\?\.outcome !== 'picked'\) return result;\n\s+await playVnChapter\(result\.pick, \{ source: 'hub' \}\);/);
  assert.match(main, /storyVnStates\(\)\.filter\(state => \(STORY_VN_CHAPTERS\[state\.id\]\?\.part \?\? 1\) >= 3 && !state\.hub\)\.sort/);
  assert.match(main, /app\.prepareStoryBattle\(presetIndices, \[lead\.instanceId\]\)/);
  assert.match(main, /app\.claimGachaReward\?\.\(key, STORY_VN_CHAPTERS\[id\]\?\.reward\?\.tickets \?\? 0\)/);
  assert.match(main, /CHAMPIONSHIP_SCREENS\.RAISING_HOME && !vnRun\) closeStoryMap\(\);\n\s*followStoryBattle\(\);/);
  assert.match(main, /new URLSearchParams\(location\.search\)\.has\("storyVnQa"\)/);
  const app = read("src/championship/app/championshipStandaloneApp.js");
  assert.match(app, /prepared\.freeMatch=Object\.freeze\(\{id:'story',kind:'STORY',presetIndices:\[\.\.\.presetIndices\],slots:3,entryFee:0,payout:0\}\)/);
  assert.match(app, /getGachaClaimedRewards\(\)\{requireSession\(\);return Object\.freeze\(\[\.\.\.gachaState\(\)\.claimed\]\);\}/);
  const html = read("championship.html");
  assert.match(html, /href="\.\/src\/championship\/app\/ui\/storyVn\.css\?v=story-vn-1"/);
  for (const file of ["storyVnStage.js", "storyVnTheater.js", "storyVnDirector.js"]) {
    const source = read(`src/championship/presentation/story/${file}`).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(source, /requestAnimationFrame|getContext\(|new PIXI|THREE\./, `${file} stays DOM-only`);
    assert.doesNotMatch(source, /localStorage|https?:\/\//, file);
  }
});

// ---- exploration (part three) ----------------------------------------------------------------
/** A field that "walks" to the given spots in order, one per listen(). */
function fakeField(visits, calls) {
  return () => ({
    element: { hidden: false, dataset: {} }, open: async (spec, { spotList }) => calls.push(["field", spec.id, spotList.map(spot => spot.id)]),
    hidden: () => {}, pause: () => {}, dispose: () => calls.push(["field-dispose"]), position: () => [0.5, 0.86], activate: () => {},
    setSpotState: (id, state) => calls.push(["spot", id, state]),
    listen({ onSpot }) { const id = visits.shift(); if (id) setTimeout(() => onSpot(id), 0); }
  });
}

test("exploration: spots play their beats, a locked spot only answers, and the field closes at its last spot", async () => {
  const f = fakes(), cues = [];
  const director = createStoryVnDirector({ doc: {}, host: {}, ...f, createField: fakeField(["board", "subaru", "rin", "orlan", "board"], f.calls), cue: name => cues.push(name),
    recordBond: () => 15, claim: async () => ({ granted: 1 }) });
  const result = await director.play("vn3-c1", { tamer: "阿凱", partner: "小紅", partnerSpecies: 21 });
  assert.equal(result.outcome, "completed");
  assert.deepEqual(f.calls.find(c => c[0] === "field"), ["field", "lobby", ["subaru", "rin", "orlan", "board"]]);
  const said = f.calls.filter(c => c[0] === "say").map(c => c[2]);
  const at = text => said.indexOf(text);
  assert.ok(at("委託板等等再看，先跟大家打招呼吧！") >= 0 && at("委託板等等再看，先跟大家打招呼吧！") < at(storyVnText("P3C1_S1")), "the board answers before the greetings are done");
  assert.ok(f.calls.some(c => c[0] === "card" && c[1] === "沒有寄件人的委託"), "the board's note opens at the end");
  assert.ok(f.calls.some(c => c[0] === "spot" && c[1] === "board" && c[2] === "goal"), "the board lights up once everyone was greeted");
  assert.ok(said.indexOf(storyVnText("P3C1_N3")) > said.indexOf(storyVnText("P3C1_A5")), "the chapter goes on after the field");
  assert.deepEqual(f.calls.find(c => c[0] === "clear")[1].slice(-2), ["與小紅的羈絆 ♥ +1", "累計羈絆 ♥ 15"]);
  assert.ok(["talk", "discover", "choice", "bond", "clear"].every(cue => cues.includes(cue)), cues.join());
  assert.ok(f.calls.some(c => c[0] === "field-dispose"));
});

test("the reception hall: Ai-chan's counter opens the board, a pick ends the hall with it, the exit leaves without a claim", async () => {
  const items = [{ id: "vn3-c2", kind: "main", state: "locked" }, { id: "vn3-r1", kind: "request", state: "open" }];
  let claims = 0;
  const picked = fakes({ board: () => "vn3-r1" });
  const pick = await createStoryVnDirector({ doc: {}, host: {}, ...picked, createField: fakeField(["desk"], picked.calls), boardItems: () => items, claim: () => { claims++; return null; } })
    .play("vn3-hub", { partner: "小紅", partnerSpecies: 21 });
  assert.deepEqual([pick.outcome, pick.pick, claims], ["picked", "vn3-r1", 0]);
  assert.deepEqual(picked.calls.find(c => c[0] === "board"), ["board", ["vn3-c2", "vn3-r1"]]);
  assert.ok(!picked.calls.some(c => c[0] === "clear"), "a hall has no clear card");
  const left = fakes({ board: () => null });
  const out = await createStoryVnDirector({ doc: {}, host: {}, ...left, createField: fakeField(["desk", "door"], left.calls), boardItems: () => items, claim: () => { claims++; return null; } })
    .play("vn3-hub", { partner: "小紅", partnerSpecies: 21 });
  assert.deepEqual([out.outcome, claims], ["left", 0]);
});

test("the field lays a plate across the window, clamps walking to the ground band and scales figures by depth", () => {
  const wide = storyVnFieldLayout({ naturalWidth: 1536, naturalHeight: 1024, walk: [0.76, 0.95] }, { width: 390, height: 440 });
  assert.equal(Math.round(wide.height), 440); assert.ok(wide.width > 390 && wide.panMin < 0, "a phone window pans across the plate");
  const desk = storyVnFieldLayout({ naturalWidth: 1536, naturalHeight: 1024 }, { width: 1366, height: 600 });
  assert.equal(Math.round(desk.width), 1366); assert.equal(desk.panMin, 0);
  assert.ok(desk.top <= 0 && desk.top >= 600 - desk.height, "the plate always covers the window");
  assert.deepEqual(storyVnFieldClamp([1.2, 0.3], [0.76, 0.95]), [0.96, 0.76]);
  assert.ok(storyVnFieldDepth(0.95) > storyVnFieldDepth(0.76));
  const field = read("src/championship/presentation/story/storyVnField.js");
  assert.doesNotMatch(field, /requestAnimationFrame|getContext|WebGL|setInterval/, "DOM and Web Animations only");
});

