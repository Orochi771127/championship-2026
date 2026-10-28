// Social batch (Owner 2026-10-29): community links, the 數碼通行證 provider
// binding and first-bind gift, the local-vs-cloud save chooser, the brag card
// generator and preview, and the room lobby's Presence. No network, no real
// DOM: a small fake document and a recording 2D context stand in for them.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { SOCIAL_LINKS, SOCIAL_LINK_IDS, refuseSocialLinkReason, resolveSocialLinks, socialLinkHosts } from "../src/championship/config/socialLinksConfig.js";
import { createSocialLinkDock } from "../src/championship/app/socialLinkDock.js";
import { SOCIAL_COPY, socialText } from "../src/championship/text/socialText.js";
import { ONLINE_COPY } from "../src/championship/text/onlineText.js";
import { BRAG_CARD_SIZES, BRAG_CARD_SCALE, normalizeBragCardData, drawTamerBragCard, renderTamerBragCard, exportTamerBragCard } from "../src/championship/presentation/tamerBragCardGenerator.js";
import { publicPlayUrl, bragInviteText, bragCardFileName, buildBragPreviewContent } from "../src/championship/app/bragCardPreview.js";
import { describeSaveSides, chooseSaveSide, buildSaveConflictCards } from "../src/championship/app/saveConflictArbiter.js";
import { buildBindRewardContent } from "../src/championship/app/bindRewardPopup.js";
import { ONLINE_BIND_REWARD_BITS, normalizeOnlineBindReward, planOnlineBindReward } from "../src/championship/app/onlineBindRewardPolicy.js";
import { createLocalSimulationAdapter, cleanTransferCode } from "../src/championship/online/localSimulationMode.js";
import { createSupabaseAdapter, oauthReturnUrl } from "../src/championship/online/supabaseMode.js";
import { createChampionshipCloudService } from "../src/championship/online/championshipCloudService.js";
import { resolveOnlineServiceConfig } from "../src/championship/online/onlineServiceConfig.js";
import { createPvpRoomSession } from "../src/championship/online/pvpRoomSession.js";
import { summarizeSaveText } from "../src/championship/online/cloudSaveEnvelope.js";
import { bindProviderFlow, createOnlineAccountPanel } from "../src/championship/app/onlineAccountPanel.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY, deserializeChampionshipModernSave } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const noWin = { addEventListener() {}, removeEventListener() {} };
const LOCALES = ["zh-Hant", "en", "ja", "th", "vi"];
function memoryStorage() { const data = new Map(), touched = new Set(); return { getItem: k => { touched.add(k); return data.has(k) ? data.get(k) : null; }, setItem: (k, v) => { touched.add(k); data.set(k, String(v)); }, removeItem: k => { touched.add(k); data.delete(k); }, keys: () => [...data.keys()], touched: () => [...touched].sort() }; }

// ------------------------------------------------------------------ fake DOM
class FakeNode {
  constructor(tag, doc) { Object.assign(this, { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], parentNode: null, dataset: {}, attributes: new Map(), listeners: new Map(), className: "", textContent: "", hidden: false, style: { props: new Map(), setProperty(k, v) { this.props.set(k, String(v)); } } }); }
  append(...nodes) { for (const node of nodes) { if (node == null) continue; if (typeof node === "string") { this.children.push(Object.assign(new FakeNode("#text", this.ownerDocument), { textContent: node })); continue; } node.remove?.(); node.parentNode = this; this.children.push(node); } }
  prepend(node) { node.remove?.(); node.parentNode = this; this.children.unshift(node); }
  insertBefore(node, ref) { node.remove?.(); node.parentNode = this; const at = this.children.indexOf(ref); this.children.splice(at < 0 ? this.children.length : at, 0, node); }
  remove() { if (!this.parentNode) return; const list = this.parentNode.children; list.splice(list.indexOf(this), 1); this.parentNode = null; }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove?.(); this.children = []; this.append(...nodes); }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  async fire(type, extra = {}) { for (const fn of [...(this.listeners.get(type) ?? [])]) await fn({ type, preventDefault() {}, target: this, ...extra }); }
  click() { return this.fire("click"); }
  focus() {} select() {}
  matches(selector) { return selector.split(",").map(s => s.trim()).some(one => one.startsWith(".") ? one.slice(1).split(".").every(name => this.className.split(/\s+/).includes(name)) : this.tagName === one.toUpperCase()); }
  querySelectorAll(selector) { const found = []; const walk = node => { for (const child of node.children) { if (child.matches?.(selector)) found.push(child); walk(child); } }; walk(this); return found; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  get text() { return this.textContent + this.children.map(child => child.text).join(""); }
}
function fakeDocument() { const doc = { createElement: tag => new FakeNode(tag, doc), documentElement: { dataset: {} } }; doc.body = new FakeNode("body", doc); return doc; }

// ------------------------------------------------------------------ community links
test("community links accept only https on each channel's own hosts; the shipped config is empty and safe", () => {
  assert.deepEqual(SOCIAL_LINKS.map(link => link.id), ["discord", "facebook", "x", "bahamut"]);
  assert.deepEqual(SOCIAL_LINKS.map(link => link.color), ["#5865F2", "#1877F2", "#14171A", "#00B4D8"]);
  for (const link of SOCIAL_LINKS) assert.ok(link.url === "" || refuseSocialLinkReason(link.id, link.url) === null, link.id);
  const https = host => ["https:", "", host].join("/");
  assert.equal(refuseSocialLinkReason("discord", `${https("discord.gg")}/abcd`), null);
  assert.equal(refuseSocialLinkReason("discord", `${https("evil.example")}/discord.gg`), "LINK_HOST_NOT_ALLOWED");
  assert.equal(refuseSocialLinkReason("facebook", `${["http:", "", "www.facebook.com"].join("/")}/page`), "LINK_NOT_HTTPS");
  assert.equal(refuseSocialLinkReason("x", `${https("user:pw@x.com")}/a`), "LINK_HAS_CREDENTIALS");
  assert.equal(refuseSocialLinkReason("bahamut", `${https("forum.gamer.com.tw:8443")}/a`), "LINK_HAS_PORT");
  assert.equal(refuseSocialLinkReason("bahamut", "javascript:alert(1)"), "LINK_NOT_HTTPS");
  assert.equal(refuseSocialLinkReason("myspace", `${https("x.com")}`), "LINK_CHANNEL_UNKNOWN");
  assert.equal(refuseSocialLinkReason("discord", ""), "LINK_EMPTY");
  for (const id of SOCIAL_LINK_IDS) assert.ok(socialLinkHosts(id).length >= 2, id);
  const resolved = resolveSocialLinks([{ id: "discord", url: `${https("discord.gg")}/abcd`, color: "#5865F2", glyph: "🎮" }, { id: "x", url: `${https("evil.example")}`, color: "#000", glyph: "🐦" }]);
  assert.equal(resolved[0].href, `${https("discord.gg")}/abcd`); assert.equal(resolved[1].href, null); assert.equal(resolved[1].reason, "LINK_HOST_NOT_ALLOWED");
});

test("the dock opens configured links in a new tab with noopener and turns empty ones into a coming-soon notice", async () => {
  const doc = fakeDocument(), https = host => ["https:", "", host].join("/");
  const dock = createSocialLinkDock({ doc, links: resolveSocialLinks([{ id: "discord", url: `${https("discord.gg")}/abcd`, color: "#5865F2", ink: "#fff", glyph: "🎮" }, { id: "facebook", url: "", color: "#1877F2", ink: "#fff", glyph: "📘" }]) });
  const [open, soon] = dock.keys;
  assert.equal(open.tagName, "A"); assert.equal(open.target, "_blank"); assert.equal(open.rel, "noopener noreferrer"); assert.equal(open.href, `${https("discord.gg")}/abcd`);
  assert.match(open.className, /cm-arcade-key/); assert.equal(open.style.props.get("--social-color"), "#5865F2");
  assert.equal(soon.tagName, "BUTTON"); assert.equal(soon.getAttribute("aria-disabled"), "true"); assert.equal(soon.dataset.state, "soon");
  await soon.click();
  const status = dock.element.querySelector(".cm-social-dock__status");
  assert.equal(status.hidden, false); assert.match(status.textContent, /Facebook/);
});

test("social and online copy are complete in all five locales", () => {
  for (const table of [SOCIAL_COPY, ONLINE_COPY]) {
    const keys = Object.keys(table["zh-Hant"]);
    for (const locale of LOCALES) {
      assert.deepEqual(Object.keys(table[locale]).sort(), [...keys].sort(), locale);
      for (const key of keys) assert.ok(String(table[locale][key]).trim().length > 0, `${locale}:${key}`);
    }
  }
  assert.match(socialText("inviteText", { title: "T", code: "TM-AAAA-BBBB", room: "", url: "U" }, "en"), /TM-AAAA-BBBB/);
});

// ------------------------------------------------------------------ brag card
/** A 2D context that records what was drawn; text width is a stable estimate. */
function recordingContext({ taint = false } = {}) {
  const calls = [], texts = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = {
    calls, texts, font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "left", textBaseline: "alphabetic", shadowColor: "", shadowBlur: 0,
    save() { calls.push("save"); }, restore() { calls.push("restore"); }, setTransform(...a) { calls.push(["setTransform", ...a]); }, clearRect() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {}, setLineDash() {},
    createLinearGradient: gradient, createRadialGradient: gradient,
    measureText(text) { const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10); return { width: [...String(text)].length * size * 0.6 }; },
    fillText(text) { texts.push(String(text)); }, strokeText() {},
    drawImage(image) { calls.push(["drawImage", image?.id ?? null]); },
    getImageData() { if (taint) { const error = new Error("tainted"); error.name = "SecurityError"; throw error; } return { data: new Uint8ClampedArray(4) }; }
  };
  return ctx;
}
function fakeCanvas({ taint = false, dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", throwOnExport = false } = {}) {
  const context = recordingContext({ taint });
  return { width: 0, height: 0, context, getContext: () => context,
    toDataURL(type) { if (throwOnExport) { const error = new Error("tainted"); error.name = "SecurityError"; throw error; } return type === "image/png" ? dataUrl : ""; },
    toBlob(callback) { callback(new Blob([Buffer.from(dataUrl.split(",")[1], "base64")], { type: "image/png" })); } };
}
const CARD = { tamerName: "阿光", rankName: "大師", licenseName: "究極體", winPercent: 80, battles: 500, dexPercent: 100, bits: 9999999, tamerCode: "tm-er2b-wact",
  roomCode: "2913", playUrl: "orochi771127.github.io/championship-2026", partner: { name: "戰鬥暴龍獸", attributeIndex: 1, portraitSrc: "assets/production/x.webp" } };

test("brag card data is bounded: unknown figures stay blank, codes are checked, the title is the approved one", () => {
  const data = normalizeBragCardData({ ...CARD, winPercent: 140, battles: -3, bits: 12345678901, tamerCode: "nope", roomCode: "12", partner: { attributeIndex: 9 } }, "zh-Hant");
  assert.equal(data.title, "網線拍檔：錦標賽"); assert.equal(data.winPercent, 100); assert.equal(data.battles, 0); assert.equal(data.bits, 9999999);
  assert.equal(data.tamerCode, null); assert.equal(data.roomCode, null); assert.equal(data.partner.attributeIndex, 4); assert.equal(data.partner.name, null);
  const blank = normalizeBragCardData({}, "en");
  assert.equal(blank.tamerName, socialText("cardTamerFallback", {}, "en")); assert.equal(blank.winPercent, null); assert.equal(blank.partner, null);
  assert.equal(normalizeBragCardData(CARD).tamerCode, "TM-ER2B-WACT", "codes are upper-cased before the check");
});

test("both layouts draw the title, tamer, record, friend code, room code and game address without throwing", () => {
  for (const orientation of ["landscape", "portrait"]) {
    const ctx = recordingContext();
    const layout = drawTamerBragCard(ctx, normalizeBragCardData(CARD, "zh-Hant"), { orientation, portrait: { image: { id: "portrait" }, width: 864, height: 790 } });
    assert.deepEqual([layout.width, layout.height], [BRAG_CARD_SIZES[orientation].width, BRAG_CARD_SIZES[orientation].height]);
    const all = ctx.texts.join("\n");
    for (const expected of ["網線拍檔：錦標賽", "阿光", "TM-ER2B-WACT", "2913", "80%", "500", "100%", "9,999,999", "orochi771127.github.io/championship-2026", "戰鬥暴龍獸"]) assert.ok(all.includes(expected), `${orientation}: ${expected}`);
    assert.ok(ctx.calls.some(call => Array.isArray(call) && call[0] === "drawImage" && call[1] === "portrait"), `${orientation}: the partner art is drawn`);
    assert.equal(ctx.calls.filter(c => c === "save").length, ctx.calls.filter(c => c === "restore").length, `${orientation}: balanced save/restore`);
  }
  // No art: a crest with the partner's initial, never a stand-in character.
  const crest = recordingContext();
  drawTamerBragCard(crest, normalizeBragCardData({ ...CARD, partner: { name: "戰鬥暴龍獸", attributeIndex: 2 } }), {});
  assert.ok(crest.texts.includes("戰")); assert.ok(!crest.calls.some(call => Array.isArray(call) && call[0] === "drawImage"));
});

test("rendering at 2x exports a non-empty PNG, and a tainted canvas is redrawn without the portrait instead of throwing", async () => {
  const doc = fakeDocument();
  const clean = await renderTamerBragCard(CARD, { doc, orientation: "landscape", createCanvas: (w, h) => Object.assign(fakeCanvas(), { width: w, height: h }), loadImage: async () => ({ image: { id: "portrait" }, width: 864, height: 790 }) });
  assert.deepEqual([clean.width, clean.height], [1200 * BRAG_CARD_SCALE, 675 * BRAG_CARD_SCALE]); assert.equal(clean.portraitDrawn, true);
  const exported = await exportTamerBragCard(clean.canvas);
  assert.match(exported.dataUrl, /^data:image\/png;base64,/); assert.ok(exported.blob.size > 0); assert.equal(exported.type, "image/png");
  const signature = [...new Uint8Array(await exported.blob.arrayBuffer()).slice(0, 8)];
  assert.deepEqual(signature, [137, 80, 78, 71, 13, 10, 26, 10], "the blob is a PNG");
  const tainted = await renderTamerBragCard(CARD, { doc, orientation: "portrait", createCanvas: (w, h) => Object.assign(fakeCanvas({ taint: true }), { width: w, height: h }), loadImage: async () => ({ image: { id: "portrait" }, width: 864, height: 790 }) });
  assert.equal(tainted.portraitDrawn, false, "a tainted portrait is dropped, so export can never throw SecurityError");
  assert.deepEqual([tainted.width, tainted.height], [720 * BRAG_CARD_SCALE, 1280 * BRAG_CARD_SCALE]);
  await assert.rejects(() => exportTamerBragCard(fakeCanvas({ throwOnExport: true })), /BRAG_CARD_EXPORT_BLOCKED/);
  await assert.rejects(() => exportTamerBragCard(fakeCanvas({ dataUrl: "data:," })), /BRAG_CARD_EXPORT_EMPTY/);
  const missing = await renderTamerBragCard({ ...CARD, partner: null }, { doc, createCanvas: (w, h) => Object.assign(fakeCanvas(), { width: w, height: h }), loadImage: async () => { throw new Error("must not load"); } });
  assert.equal(missing.portraitDrawn, false);
});

test("the preview shows the PNG as a long-press-savable image and shares the file, downloads it and copies the invite", async () => {
  const doc = fakeDocument(), shared = [], copied = [];
  const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  const card = { dataUrl: "data:image/png;base64,iVBORw0KGgo=", blob, width: 2400, height: 1350 };
  const data = normalizeBragCardData(CARD, "zh-Hant");
  const invite = bragInviteText({ code: data.tamerCode, room: data.roomCode, locale: "zh-Hant" });
  assert.match(invite, /TM-ER2B-WACT/); assert.match(invite, /2913/); assert.match(invite, /orochi771127\.github\.io\/championship-2026\//);
  const nav = { canShare: ({ files }) => files?.length === 1, share: async payload => { shared.push(payload); } };
  const view = buildBragPreviewContent({ doc, card, data, inviteText: invite, fileName: bragCardFileName({ tamerCode: data.tamerCode, now: new Date("2026-10-29T00:00:00Z") }), nav, clipboard: { writeText: async text => { copied.push(text); } },
    urlApi: { createObjectURL: () => "blob:card", revokeObjectURL() {} } });
  assert.equal(view.image.src, card.dataUrl); assert.equal(view.image.dataset.selectable, "true", "the dialog's long-press block is lifted for the image");
  await view.keys.share.click(); await Promise.resolve();
  assert.equal(shared.length, 1); assert.equal(shared[0].files[0].name, "cyber-partner-tm-er2b-wact-landscape-20261029.png"); assert.equal(shared[0].files[0].type, "image/png");
  await view.keys.copy.click();
  assert.deepEqual(copied, [invite]);
  await view.keys.download.click();
  assert.ok(view.element.querySelector(".cm-brag-preview__status").textContent.length > 0);
  // No file sharing: text share; no share at all: a clear message, never an exception.
  const plain = buildBragPreviewContent({ doc, card, data, inviteText: invite, fileName: "x.png", nav: {}, clipboard: null });
  assert.equal(plain.keys.share.dataset.supported, "false");
  await plain.keys.share.click();
  assert.equal(plain.element.querySelector(".cm-brag-preview__status").dataset.tone, "error");
  await plain.keys.copy.click();
  assert.equal(plain.element.querySelector(".cm-brag-preview__invite").hidden, false, "without a clipboard the invite is shown for a manual copy");
  assert.equal(publicPlayUrl().display, "orochi771127.github.io/championship-2026");
});

// ------------------------------------------------------------------ save chooser
test("the chooser compares name, rank, days, Bits and partners side by side and never picks for the player", async () => {
  const local = { trainerName: "阿光", rank: 9, days: 2, bits: 100, roster: 6, updatedAt: "2026-10-29T02:09:00.000Z" };
  const cloud = { trainerName: "阿光", rank: 9, days: 1, bits: 900, roster: 6, updatedAt: "2026-10-29T02:08:00.000Z" };
  const rows = Object.fromEntries(describeSaveSides({ local, remote: cloud, remoteMeta: { deviceLabel: "iPhone · Safari" } }).map(row => [row.id, row]));
  assert.deepEqual(Object.keys(rows), ["name", "rank", "days", "bits", "roster", "updated", "device"]);
  assert.equal(rows.days.lead, "local"); assert.equal(rows.bits.lead, "remote"); assert.equal(rows.roster.lead, null); assert.equal(rows.updated.lead, "local"); assert.equal(rows.device.remote, "iPhone · Safari");
  const doc = fakeDocument();
  const asked = [];
  const answer = id => async options => { asked.push(options); return id; };
  assert.equal(await chooseSaveSide({ showChoiceDialog: answer(null), doc, local, remote: cloud }), "later", "a dismissed or blocked dialog changes nothing");
  assert.equal(await chooseSaveSide({ showChoiceDialog: answer("remote"), doc, local, remote: cloud }), "remote");
  assert.deepEqual(asked[1].actions.map(a => a.id), ["later", "remote", "local"]); assert.equal(asked[1].cancelId, "later"); assert.equal(asked[1].focusId, "later");
  await chooseSaveSide({ showChoiceDialog: answer("later"), doc, local, remote: cloud, remoteKind: "incoming" });
  assert.deepEqual(asked[2].actions.map(a => a.id), ["later", "remote"], "a transfer code has nothing to upload");
  const backups = [];
  const cards = buildSaveConflictCards({ doc, local, remote: cloud, onBackup: () => backups.push(1) });
  await cards.querySelector(".cm-arbiter__backup").click();
  assert.equal(backups.length, 1);
  assert.equal(await chooseSaveSide({ doc, local, remote: cloud }), "later", "no dialog available: nothing moves");
});

test("the save summary carries rank and calendar days for the chooser", () => {
  const save = JSON.parse(fs.readFileSync("qa/championship-full-qa-save.json", "utf8"));
  const summary = summarizeSaveText(JSON.stringify(save));
  assert.equal(summary.rank, 9); assert.equal(summary.days, 1); assert.equal(summary.roster, 6); assert.equal(summary.bits, 9999999);
  const later = JSON.parse(save.raisingHome); later.payload.year = 1; later.payload.season = 2; later.payload.dayOfSeason = 3;
  assert.equal(summarizeSaveText(JSON.stringify({ ...save, raisingHome: JSON.stringify(later) })).days, 32 + 16 + 4);
});

// ------------------------------------------------------------------ first-bind gift
test("the first-bind gift is bounded, paid once per save and recorded in the save's flags", async () => {
  assert.equal(normalizeOnlineBindReward(null), null);
  assert.throws(() => normalizeOnlineBindReward({ version: 1, provider: "myspace", bits: 1, claimedAt: "2026-10-29T00:00:00.000Z" }), /INVALID_ONLINE_BIND_REWARD/);
  assert.throws(() => normalizeOnlineBindReward({ version: 1, provider: "google", bits: ONLINE_BIND_REWARD_BITS + 1, claimedAt: "2026-10-29T00:00:00.000Z" }), /BITS/);
  const capped = planOnlineBindReward({ bits: 9999000, cap: 9999999, current: null, provider: "discord", rewardBits: 999999, claimedAt: "2026-10-29T00:00:00.000Z" });
  assert.equal(capped.credited, 999, "a server answer is clamped to the policy and the wallet cap");
  assert.equal(planOnlineBindReward({ bits: 0, cap: 10, current: capped.record, provider: "google", claimedAt: "2026-10-29T00:00:00.000Z" }).reason, "BIND_REWARD_ALREADY_CLAIMED");

  const storage = memoryStorage();
  const app = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-10-29T12:00:00.000Z", locks: null });
  await app.newGame(); app.save();
  const before = app.getShopFrame().bits;
  assert.match(app.getSaveReference(), /\S/);
  const paid = app.claimOnlineBindReward({ provider: "google", rewardBits: ONLINE_BIND_REWARD_BITS });
  assert.equal(paid.ok, true); assert.equal(paid.credited, Math.min(ONLINE_BIND_REWARD_BITS, app.getShopFrame().bitsCap - before));
  assert.equal(app.getShopFrame().bits, before + paid.credited);
  assert.equal(app.claimOnlineBindReward({ provider: "facebook", rewardBits: ONLINE_BIND_REWARD_BITS }).reason, "BIND_REWARD_ALREADY_CLAIMED", "one gift per save, whichever account asks");
  const stored = deserializeChampionshipModernSave(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(stored.flags.onlineBindReward, { version: 1, provider: "google", bits: paid.credited, claimedAt: "2026-10-29T12:00:00.000Z" });
  assert.equal(stored.shop.bits, before + paid.credited);
  app.save();
  assert.deepEqual(deserializeChampionshipModernSave(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY)).flags.onlineBindReward.provider, "google", "later saves keep the marker");
  await app.dispose();
  const reopened = createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, now: () => "2026-10-29T13:00:00.000Z", locks: null });
  assert.ok(await reopened.continueGame());
  assert.equal(reopened.getOnlineBindReward().provider, "google");
  assert.equal(reopened.claimOnlineBindReward({ provider: "discord", rewardBits: 5000 }).reason, "BIND_REWARD_ALREADY_CLAIMED", "the marker survives Continue");
  await reopened.dispose();
  assert.deepEqual(storage.touched(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  const fresh = createChampionshipStandaloneApp({ storage: memoryStorage(), catalog, cages: presentation.cages, locks: null });
  await fresh.newGame(); fresh.save();
  assert.equal(deserializeChampionshipModernSave(fresh.persistenceFacade().exportRecovery().text).flags.onlineBindReward, undefined, "an unpaid save keeps its old shape");
  await fresh.dispose();
});

test("the gift popup labels a simulation preview and shows the provider", () => {
  const doc = fakeDocument();
  const preview = buildBindRewardContent({ doc, bits: 5000, provider: "discord", simulated: true });
  assert.equal(preview.dataset.simulated, "true"); assert.match(preview.text, /5,000/); assert.match(preview.text, /Discord/);
  assert.ok(preview.querySelector(".cm-bind-reward__note"), "a preview says it pays nothing");
  assert.equal(buildBindRewardContent({ doc, bits: 5000, provider: "google" }).querySelector(".cm-bind-reward__note"), null);
});

// ------------------------------------------------------------------ cloud service and adapters
test("the local simulation rehearses Google / Facebook / Discord binding in memory and only previews the gift", async () => {
  const service = createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: { supabaseUrl: "", supabaseAnonKey: "" }, runtime: null }), win: noWin, nav: { onLine: true } });
  const guest = await service.getIdentitySummary();
  assert.equal(guest.isAnonymous, true); assert.deepEqual(guest.providers, []);
  assert.equal((await service.claimBindReward({ saveRef: "x" })).reason, "ACCOUNT_NOT_LINKED");
  const bound = await service.bindProvider("discord");
  assert.equal(bound.ok, true); assert.equal(bound.simulated, true);
  const linked = await service.getIdentitySummary();
  assert.equal(linked.isAnonymous, false); assert.deepEqual(linked.providers, ["discord"]); assert.equal(linked.simulated, true);
  await service.bindProvider("google");
  assert.deepEqual((await service.getIdentitySummary()).providers, ["discord", "google"]);
  const gift = await service.claimBindReward({ saveRef: "x" });
  assert.equal(gift.ok, true); assert.equal(gift.preview, true); assert.equal(gift.rewardBits, 5000);
  assert.equal((await service.claimBindReward({ saveRef: "x" })).reason, "BIND_REWARD_ALREADY_CLAIMED");
  assert.equal((await service.bindProvider("myspace")).reason, "PROVIDER_UNSUPPORTED");
  const sayings = [], confirms = [], bonds = [];
  const flow = await bindProviderFlow({ service, provider: "facebook", confirm: async options => { confirms.push(options.variant); return "allow"; }, say: (text, tone) => sayings.push(tone), onProviderBound: async provider => bonds.push(provider) });
  assert.equal(flow.ok, true); assert.deepEqual(confirms, ["provider-sim"]); assert.deepEqual(bonds, ["facebook"]);
  const cancelled = await bindProviderFlow({ service: createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: {}, runtime: null }), win: noWin, nav: { onLine: true } }), provider: "google", confirm: async () => "cancel" });
  assert.equal(cancelled.reason, "CANCELLED");
  service.setActiveRoom({ roomCode: "2913", matchId: "m-1" }); assert.equal(service.state.activeRoom.roomCode, "2913");
  service.setActiveRoom(null); assert.equal(service.state.activeRoom, null);
});

test("transfer codes are six characters, single use, and read the way people type them", async () => {
  const sim = createLocalSimulationAdapter({ random: () => 0.3 });
  await sim.ensureIdentity({});
  await sim.uploadSave({ payload: "{}", contentSha256: "a".repeat(64), gameRevision: 1, summary: {}, deviceLabel: "t" }, null);
  const made = await sim.createTransferCode();
  assert.match(made.transferCode, /^[0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$/);
  assert.ok(Date.parse(made.expiresAt) - Date.now() <= 15 * 60 * 1000 + 1000, "valid for 15 minutes");
  assert.equal(cleanTransferCode(" abc-oil "), "ABC011");
  assert.equal((await sim.redeemTransferCode(` ${made.transferCode.toLowerCase().replace("-", " ")} `)).ok, true);
  assert.equal((await sim.redeemTransferCode(made.transferCode)).reason, "TRANSFER_CODE_INVALID", "single use");
});

function fakeLibrary(log) {
  let session = null;
  return { createClient() { return {
    auth: { async getSession() { return { data: { session } }; }, async signInAnonymously() { session = { user: { id: "u1", is_anonymous: true, identities: [] } }; return { data: session, error: null }; },
      async linkIdentity(args) { log.push(["link", args.provider, args.options?.redirectTo]); return { data: { url: "provider" }, error: null }; },
      async signInWithOAuth(args) { log.push(["oauth", args.provider, args.options?.redirectTo]); return { data: {}, error: null }; } },
    async rpc(name, args) { log.push(["rpc", name, args]); if (name === "ensure_tamer_profile") return { data: { userId: "u1", tamerCode: "TM-AAAA-BBBB", bindRewardClaimed: false }, error: null };
      if (name === "claim_bind_reward") return { data: { ok: true, repeat: false, rewardBits: 5000, provider: "facebook" }, error: null }; return { data: null, error: { code: "PGRST202" } }; },
    channel() { const ch = { handlers: [], on(type, filter, fn) { ch.handlers.push([type, filter?.event, fn]); return ch; }, subscribe(fn) { log.push(["subscribe"]); fn?.("SUBSCRIBED"); return ch; }, async track(meta) { log.push(["track", meta.role]); },
      presenceState() { return { host: [{}], guest: [{}] }; } }; log.push(["channel", ch]); return ch; },
    removeChannel() {}, realtime: { async setAuth() {} } }; } };
}

test("the cloud adapter links Google / Facebook / Discord through linkIdentity, claims the gift by RPC and tracks room Presence", async () => {
  const log = [];
  const win = { location: { origin: "https://example.test", pathname: "/championship-2026/" }, addEventListener() {}, removeEventListener() {} };
  assert.equal(oauthReturnUrl(win, "discord"), "https://example.test/championship-2026/?cm_link=discord");
  const adapter = createSupabaseAdapter({ library: fakeLibrary(log), url: "u", anonKey: "k", win, setIntervalFn: () => 0, clearIntervalFn() {} });
  await adapter.ensureIdentity({});
  for (const provider of ["google", "facebook", "discord"]) assert.equal((await adapter.bindProvider(provider)).redirect, true);
  assert.deepEqual(log.filter(e => e[0] === "link").map(e => [e[1], e[2]]), ["google", "facebook", "discord"].map(p => [p, `https://example.test/championship-2026/?cm_link=${p}`]));
  assert.equal((await adapter.bindProvider("myspace")).reason, "PROVIDER_UNSUPPORTED");
  assert.equal((await adapter.signInWithProvider("discord")).redirect, true); assert.ok(log.some(e => e[0] === "oauth" && e[1] === "discord"));
  const claim = await adapter.claimBindReward("f".repeat(64));
  assert.equal(claim.rewardBits, 5000); assert.deepEqual(log.find(e => e[0] === "rpc" && e[1] === "claim_bind_reward")[2], { p_save_ref: "f".repeat(64) });
  const roles = [];
  const stop = adapter.subscribeMatch("m1", () => {}, { presence: { role: "host" }, onPresence: list => roles.push(list) });
  await new Promise(resolve => setTimeout(resolve, 0));
  const channel = log.filter(e => e[0] === "channel").at(-1)[1];
  assert.ok(log.some(e => e[0] === "track" && e[1] === "host"), "the host tracks itself once subscribed");
  channel.handlers.find(h => h[0] === "presence" && h[1] === "sync")[2]();
  assert.deepEqual(roles.at(-1), ["host", "guest"]);
  stop();
});

test("a room session reports the opponent's Presence from the simulation", async () => {
  let now = 0; const queue = [];
  const timers = { setTimer(fn, ms) { queue.push({ at: now + ms, fn }); return queue.length; }, clearTimer() {}, async tick(ms) { const until = now + ms; for (;;) { queue.sort((a, b) => a.at - b.at); const next = queue[0]; if (!next || next.at > until) break; now = next.at; queue.shift(); await next.fn(); await Promise.resolve(); } now = until; } };
  const sim = createLocalSimulationAdapter({ random: () => 0.5, setTimer: timers.setTimer, clearTimer: timers.clearTimer, simulateGuestReply: async invite => `R:${invite}` });
  await sim.ensureIdentity({});
  const session = createPvpRoomSession({ adapter: sim, game: { createInvite: async () => ({ ok: true, inviteCode: "INV" }), prepareGuest: async () => ({ ok: true }), prepareHost: async () => ({ ok: true, parties: [[], []] }) }, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  await session.host({ instanceIds: ["a"] });
  assert.equal(session.state.peerOnline, false, "alone in the room");
  await timers.tick(1600);
  assert.equal(session.state.peerOnline, true, "the challenger is present");
  session.dispose();
});

test("showing the passport on Tamer Info or in the System menu never signs in: it paints the device's own code until the player presses something", async () => {
  const { createPassportStrip } = await import("../src/championship/app/onlineAccountPanel.js");
  const doc = fakeDocument();
  let asked = 0;
  const real = createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: {}, runtime: null }), win: noWin, nav: { onLine: true } });
  const service = { ...real, get state() { return real.state; }, subscribe: fn => real.subscribe(fn), getIdentitySummary: async () => { asked++; return real.getIdentitySummary(); } };
  const panel = createOnlineAccountPanel({ service, doc, fallbackCode: () => "TM-LOCA-L000" });
  panel.mount(doc.createElement("div"), { eager: false });
  assert.equal(panel.element.dataset.tamerCode, "TM-LOCA-L000");
  const strip = createPassportStrip({ service, doc, fallbackCode: () => "TM-LOCA-L000" });
  assert.equal(strip.element.querySelector(".cm-online__code").textContent, "TM-LOCA-L000");
  assert.equal(asked, 0, "no identity request (and so no cloud sign-in) just for showing them");
  panel.dispose(); strip.dispose();
});

test("opening the System menu never issues a guest pass: the strip only reads a code that already exists", () => {
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  const extras = main.slice(main.indexOf("function systemMenuExtras"), main.indexOf("async function setOwnDefenseTeam"));
  assert.match(extras, /fallbackCode: issuedTamerCode/);
  assert.doesNotMatch(extras, /localTamerCode|futureSystems\(\)/);
  assert.match(main, /const issuedTamerCode = \(\) => \{ try \{ return typeof createChampionshipGuestIdentityPort\(\{ storage: window\.localStorage \}\)\.read\(\)\.text === 'string' \? localTamerCode\(\) : null;/);
});

test("the passport panel shows the three provider keys and puts the in-app routes first in a Home Screen app", async () => {
  const doc = fakeDocument();
  const service = createChampionshipCloudService({ config: resolveOnlineServiceConfig({ file: {}, runtime: null }), win: noWin, nav: { onLine: true } });
  const panel = createOnlineAccountPanel({ service, doc, standalone: true });
  const host = doc.createElement("div"); panel.mount(host);
  await service.getIdentitySummary(); panel.refresh();
  const keys = panel.element.querySelectorAll(".cm-passport__provider").map(key => key.dataset.provider);
  assert.deepEqual(keys, ["google", "facebook", "discord"]);
  const order = panel.element.children.map(child => child.className.split(" ").find(name => name.startsWith("cm-passport__")) ?? child.className.split(" ")[0]);
  assert.ok(order.indexOf("cm-passport__standalone") < order.indexOf("cm-passport__providers"), "standalone: 6-character code and email come before OAuth");
  assert.equal(panel.element.querySelector(".cm-passport__standalone").hidden, false);
  assert.equal(panel.element.dataset.passport, "guest");
  panel.dispose();
});
