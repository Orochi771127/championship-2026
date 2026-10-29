// 📸 Tamer brag card generator (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// Draws a shareable poster of the player's tamer licence on an offscreen 2D
// canvas at 2x: cyber dot grid and honeycomb, a chamfered gold frame, the
// approved game title plaque, the ace (or winning) partner's Database hero
// portrait on an attribute-coloured aura base, the tamer's record, and the
// referral strip with the friend code, an open room code and the game address.
//
// Original procedural art only: gradients, paths and text. The one image is a
// same-origin public runtime portrait; a cross-origin source is requested with
// CORS, and if the canvas still reads as tainted the card is redrawn without
// it, so toDataURL / toBlob never throw a SecurityError. No clock, no
// requestAnimationFrame, no storage; the canvas is released after export.

import { getActiveGameTitle } from "../text/brandTerms.js";
import { socialText } from "../text/socialText.js";
import { getLocale } from "../text/locale.js";

export const BRAG_CARD_SIZES = Object.freeze({
  landscape: Object.freeze({ width: 1200, height: 675 }),
  portrait: Object.freeze({ width: 720, height: 1280 })
});
export const BRAG_CARD_SCALE = 2;
// Aura colours per catalog attribute index: none, vaccine, virus, data, free.
export const BRAG_CARD_ATTRIBUTE_COLORS = Object.freeze(["#cfd8e3", "#4fc3ff", "#ff4fa3", "#5dff9a", "#ffd23f"]);
const SANS = '"Noto Sans TC", "PingFang TC", "Hiragino Sans", "Microsoft JhengHei", "Noto Sans Thai", "Segoe UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Roboto Mono", monospace';
const GOLD = ["#fff4c2", "#ffd76a", "#c8902c", "#8a5a12", "#ffe48a"];
const CYAN = "#6ee7ff";

const text = value => (typeof value === "string" ? value.trim() : "");
const clip = (value, max) => [...text(value)].slice(0, max).join("");
const int = (value, min, max) => (Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : null);

/** Everything the card prints, cleaned and bounded; missing figures stay null (drawn as "—"). */
export function normalizeBragCardData(input = {}, locale = getLocale()) {
  const partner = input.partner && typeof input.partner === "object" ? input.partner : null;
  const tamerCode = text(input.tamerCode).toUpperCase();
  const roomCode = text(String(input.roomCode ?? ""));
  return Object.freeze({
    locale,
    title: getActiveGameTitle(locale),
    tamerName: clip(input.tamerName, 24) || socialText("cardTamerFallback", {}, locale),
    rankName: clip(input.rankName, 24) || null,
    licenseName: clip(input.licenseName, 24) || null,
    winPercent: int(input.winPercent, 0, 100),
    battles: int(input.battles, 0, 99999),
    dexPercent: int(input.dexPercent, 0, 100),
    bits: int(input.bits, 0, 9999999),
    tamerCode: /^TM-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(tamerCode) ? tamerCode : null,
    roomCode: /^[0-9]{4,6}$/.test(roomCode) ? roomCode : null,
    playUrl: clip(input.playUrl, 64) || null,
    partner: partner ? Object.freeze({
      name: clip(partner.name, 20) || null,
      attributeIndex: int(partner.attributeIndex, 0, 4) ?? 0,
      portraitSrc: typeof partner.portraitSrc === "string" && partner.portraitSrc ? partner.portraitSrc : null,
      role: partner.role === "winner" ? "winner" : "ace"
    }) : null,
    victory: input.victory ? Object.freeze({ matchTitle: clip(input.victory.matchTitle, 28) || null }) : null
  });
}

// ------------------------------------------------------------------ drawing helpers
function chamfer(ctx, x, y, w, h, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}
function hexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath();
}
function linear(ctx, x0, y0, x1, y1, stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((color, i) => gradient.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), color));
  return gradient;
}
function alpha(hex, a) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${a})`;
}
/** The largest size from `size` down to `min` at which `value` fits `maxWidth`. */
function fit(ctx, value, maxWidth, size, min, weight = 900, family = SANS) {
  let current = size;
  for (; current > min; current -= 1) { ctx.font = `${weight} ${current}px ${family}`; if (ctx.measureText(value).width <= maxWidth) break; }
  ctx.font = `${weight} ${current}px ${family}`;
  return current;
}
function label(ctx, value, x, y, { size = 18, weight = 800, color = "#ffffff", align = "left", maxWidth = Infinity, min = 10, family = SANS, glow = null } = {}) {
  ctx.save();
  fit(ctx, value, maxWidth, size, min, weight, family);
  ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 18; }
  ctx.fillText(value, x, y);
  ctx.restore();
}
/** A small decorative bar pattern from the friend code; ornament only, not a scannable code. */
function seedBars(seed, count) {
  let hash = 2166136261;
  for (const ch of String(seed ?? "CHAMPIONSHIP")) { hash ^= ch.codePointAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  const bars = [];
  for (let i = 0; i < count; i++) { hash ^= hash << 13; hash >>>= 0; hash ^= hash >>> 17; hash ^= hash << 5; hash >>>= 0; bars.push(1 + (hash % 3)); }
  return bars;
}

function layoutFor(orientation) {
  if (orientation === "portrait") return Object.freeze({
    width: 720, height: 1280, align: "center",
    title: { x: 70, y: 52, w: 580, h: 108 }, ribbon: { x: 120, y: 172, w: 480, h: 40 },
    hero: { x: 80, y: 222, w: 560, h: 452, cx: 360, platformY: 676, rx: 230, ry: 50 },
    nameplate: { x: 140, y: 712, w: 440, h: 62 },
    tamer: { x: 60, y: 800, w: 600 }, stats: { x: 60, y: 968, w: 600, h: 172 },
    referral: { x: 60, y: 1154, w: 600, h: 72 }, play: { x: 60, y: 1244, w: 600 }
  });
  return Object.freeze({
    width: 1200, height: 675, align: "left",
    title: { x: 602, y: 46, w: 552, h: 90 }, ribbon: { x: 602, y: 146, w: 552, h: 36 },
    hero: { x: 56, y: 76, w: 512, h: 452, cx: 312, platformY: 528, rx: 214, ry: 46 },
    nameplate: { x: 112, y: 562, w: 400, h: 60 },
    tamer: { x: 602, y: 192, w: 552 }, stats: { x: 602, y: 352, w: 552, h: 158 },
    referral: { x: 602, y: 524, w: 552, h: 68 }, play: { x: 602, y: 618, w: 552 }
  });
}

function drawBackground(ctx, L, aura) {
  const { width: w, height: h } = L;
  ctx.fillStyle = linear(ctx, 0, 0, w, h, ["#060a1c", "#0c1738", "#170b33", "#0a0618"]);
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(L.hero.cx, L.hero.platformY - L.hero.h * 0.45, 20, L.hero.cx, L.hero.platformY - L.hero.h * 0.45, Math.max(w, h) * 0.55);
  glow.addColorStop(0, alpha(aura, 0.42)); glow.addColorStop(0.45, alpha(aura, 0.12)); glow.addColorStop(1, alpha(aura, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  // Honeycomb.
  ctx.save(); ctx.strokeStyle = "rgba(120, 220, 255, 0.07)"; ctx.lineWidth = 1;
  const r = 26, dx = r * Math.sqrt(3), dy = r * 1.5;
  for (let row = 0, y = 0; y < h + r; row++, y += dy) for (let x = row % 2 ? dx / 2 : 0; x < w + r; x += dx) { hexagon(ctx, x, y, r - 2); ctx.stroke(); }
  ctx.restore();
  // Dot grid (sparse: fine noise makes the shared PNG heavy without reading as detail).
  ctx.save(); ctx.fillStyle = "rgba(160, 230, 255, 0.12)";
  for (let y = 11; y < h; y += 22) for (let x = 11; x < w; x += 22) ctx.fillRect(x, y, 2, 2);
  ctx.restore();
  // Diagonal light streaks.
  ctx.save(); ctx.translate(w * 0.5, h * 0.5); ctx.rotate(-0.42);
  for (const [offset, width, a] of [[-w * 0.38, 70, 0.07], [-w * 0.05, 24, 0.10], [w * 0.22, 120, 0.05]]) {
    ctx.fillStyle = linear(ctx, offset, 0, offset + width, 0, [`rgba(255,255,255,0)`, `rgba(190,240,255,${a})`, `rgba(255,255,255,0)`]);
    ctx.fillRect(offset, -h * 1.2, width, h * 2.4);
  }
  ctx.restore();
}

function drawFrame(ctx, L) {
  const { width: w, height: h } = L, inset = 14, cut = 38;
  ctx.save();
  chamfer(ctx, inset, inset, w - inset * 2, h - inset * 2, cut);
  ctx.lineWidth = 14; ctx.strokeStyle = "#07040f"; ctx.stroke();
  ctx.lineWidth = 7; ctx.strokeStyle = linear(ctx, 0, 0, w, h, GOLD); ctx.stroke();
  chamfer(ctx, inset + 12, inset + 12, w - (inset + 12) * 2, h - (inset + 12) * 2, cut - 8);
  ctx.lineWidth = 1.6; ctx.strokeStyle = alpha(CYAN, 0.55); ctx.stroke();
  // Armour plates on the cut corners.
  ctx.fillStyle = linear(ctx, 0, 0, w, h, GOLD);
  for (const [x, y] of [[inset + 6, inset + 6], [w - inset - 6, inset + 6], [inset + 6, h - inset - 6], [w - inset - 6, h - inset - 6]]) { hexagon(ctx, x, y, 9); ctx.fill(); }
  ctx.restore();
}

function drawTitle(ctx, L, data) {
  const { x, y, w, h } = L.title, center = L.align === "center";
  ctx.save();
  chamfer(ctx, x, y, w, h, 18);
  ctx.fillStyle = "rgba(14, 8, 30, 0.82)"; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = linear(ctx, x, y, x + w, y + h, GOLD); ctx.stroke();
  const tx = center ? x + w / 2 : x + 26, maxWidth = w - 52;
  fit(ctx, data.title, maxWidth, center ? 44 : 40, 22);
  ctx.textAlign = center ? "center" : "left"; ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 5; ctx.strokeStyle = "#2a1300"; ctx.strokeText(data.title, tx, y + h * 0.56);
  ctx.fillStyle = linear(ctx, x, y, x, y + h * 0.6, ["#fffbe6", "#ffd76a", "#d29a30"]); ctx.fillText(data.title, tx, y + h * 0.56);
  label(ctx, "C H A M P I O N S H I P   2 0 2 6", tx, y + h * 0.86, { size: 15, weight: 800, color: CYAN, align: center ? "center" : "left", maxWidth });
  ctx.restore();
}

function drawRibbon(ctx, L, data) {
  const { x, y, w, h } = L.ribbon, center = L.align === "center";
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 14, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  if (data.victory) {
    ctx.fillStyle = linear(ctx, x, y, x + w, y, ["#7a0f2b", "#ff3d6e", "#ffb347", "#7a0f2b"]); ctx.fill();
    const line = `🏆 VICTORY · ${socialText("cardVictory", {}, data.locale)}${data.victory.matchTitle ? ` · ${data.victory.matchTitle}` : ""}`;
    label(ctx, line, center ? x + w / 2 : x + 24, y + h * 0.7, { size: 20, color: "#fff7e0", align: center ? "center" : "left", maxWidth: w - 48, glow: "rgba(255, 90, 120, 0.9)" });
  } else {
    ctx.fillStyle = "rgba(110, 231, 255, 0.12)"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = alpha(CYAN, 0.6); ctx.stroke();
    label(ctx, `◆ TAMER LICENSE · ${socialText("cardLicense", {}, data.locale)}`, center ? x + w / 2 : x + 24, y + h * 0.68, { size: 17, weight: 800, color: CYAN, align: center ? "center" : "left", maxWidth: w - 48 });
  }
  ctx.restore();
}

function drawHero(ctx, L, data, portrait) {
  const H = L.hero, aura = BRAG_CARD_ATTRIBUTE_COLORS[data.partner?.attributeIndex ?? 0] ?? BRAG_CARD_ATTRIBUTE_COLORS[0];
  ctx.save();
  // Light pillar from the base.
  ctx.fillStyle = linear(ctx, 0, H.platformY, 0, H.y, [alpha(aura, 0.30), alpha(aura, 0)]);
  ctx.fillRect(H.cx - H.rx * 0.78, H.y, H.rx * 1.56, H.platformY - H.y);
  // Attribute aura base: glow, rings and rune ticks.
  ctx.save(); ctx.translate(H.cx, H.platformY); ctx.scale(1, H.ry / H.rx);
  const base = ctx.createRadialGradient(0, 0, 10, 0, 0, H.rx * 1.15);
  base.addColorStop(0, alpha(aura, 0.55)); base.addColorStop(0.6, alpha(aura, 0.18)); base.addColorStop(1, alpha(aura, 0));
  ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0, 0, H.rx * 1.15, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = alpha(aura, 0.95); ctx.beginPath(); ctx.arc(0, 0, H.rx, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255, 255, 255, 0.55)"; ctx.setLineDash?.([14, 10]); ctx.beginPath(); ctx.arc(0, 0, H.rx * 0.74, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]);
  ctx.lineWidth = 3; ctx.strokeStyle = alpha(aura, 0.8);
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, r0 = H.rx * 1.02, r1 = H.rx * (i % 3 ? 1.07 : 1.13); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
  ctx.restore();
  // The partner: bottom-anchored on the base, glowing in its attribute colour.
  if (portrait) {
    const box = { w: H.w * 0.92, h: H.h * 0.96 };
    const ratio = Math.min(box.w / portrait.width, box.h / portrait.height);
    const dw = portrait.width * ratio, dh = portrait.height * ratio;
    ctx.save(); ctx.shadowColor = alpha(aura, 0.85); ctx.shadowBlur = 42;
    ctx.drawImage(portrait.image, H.cx - dw / 2, H.platformY - H.ry * 0.25 - dh, dw, dh);
    ctx.restore();
  } else {
    // No art yet: a crest with the partner's initial, never a stand-in character.
    const cy = H.platformY - H.h * 0.46, r = Math.min(H.w, H.h) * 0.3;
    ctx.save(); hexagon(ctx, H.cx, cy, r); ctx.fillStyle = linear(ctx, H.cx - r, cy - r, H.cx + r, cy + r, ["rgba(20, 30, 60, 0.95)", "rgba(40, 20, 70, 0.95)"]); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = alpha(aura, 0.95); ctx.shadowColor = alpha(aura, 0.9); ctx.shadowBlur = 30; ctx.stroke(); ctx.restore();
    const initial = [...(data.partner?.name ?? "?")][0] ?? "?";
    label(ctx, initial, H.cx, cy + r * 0.32, { size: Math.round(r * 0.95), color: "#ffffff", align: "center", glow: alpha(aura, 0.9) });
  }
  ctx.restore();
  // Nameplate.
  const N = L.nameplate;
  ctx.save(); chamfer(ctx, N.x, N.y, N.w, N.h, 14);
  ctx.fillStyle = "rgba(8, 12, 30, 0.88)"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = alpha(aura, 0.9); ctx.stroke();
  const role = socialText(data.partner?.role === "winner" ? "cardWinner" : "cardAce", {}, data.locale);
  const attribute = socialText(`attr${data.partner?.attributeIndex ?? 0}`, {}, data.locale);
  label(ctx, `${role} · ${attribute}`, N.x + N.w / 2, N.y + 22, { size: 14, weight: 800, color: alpha(aura, 1), align: "center", maxWidth: N.w - 30 });
  label(ctx, data.partner?.name ?? socialText("cardNoPartner", {}, data.locale), N.x + N.w / 2, N.y + N.h - 12, { size: 26, color: "#ffffff", align: "center", maxWidth: N.w - 30, min: 14 });
  ctx.restore();
}

function drawTamer(ctx, L, data) {
  const T = L.tamer, center = L.align === "center", x = center ? T.x + T.w / 2 : T.x, words = key => socialText(key, {}, data.locale);
  label(ctx, `${words("cardTamer")} · TAMER`, x, T.y + 20, { size: 16, weight: 800, color: CYAN, align: center ? "center" : "left", maxWidth: T.w });
  label(ctx, data.tamerName, x, T.y + 78, { size: 56, color: "#ffffff", align: center ? "center" : "left", maxWidth: T.w, min: 26, glow: "rgba(110, 231, 255, 0.75)" });
  // Rank medal, then the rank and licence beside it.
  const medalX = center ? T.x + T.w / 2 - 150 : T.x + 30, medalY = T.y + 126;
  ctx.save();
  ctx.beginPath(); ctx.arc(medalX, medalY, 28, 0, Math.PI * 2); ctx.fillStyle = linear(ctx, medalX - 28, medalY - 28, medalX + 28, medalY + 28, GOLD); ctx.fill();
  ctx.beginPath(); ctx.arc(medalX, medalY, 20, 0, Math.PI * 2); ctx.fillStyle = "#1a0f2e"; ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6.5 : 15; const px = medalX + r * Math.cos(a), py = medalY + r * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fillStyle = "#ffd76a"; ctx.fill();
  ctx.restore();
  const textX = medalX + 44, width = center ? 300 : T.w - 80;
  label(ctx, `${words("cardRank")}  ${data.rankName ?? "—"}`, textX, medalY - 2, { size: 26, color: "#ffe9a8", maxWidth: width, min: 14 });
  label(ctx, `${words("cardLicense")}  ${data.licenseName ?? "—"}`, textX, medalY + 26, { size: 17, weight: 700, color: "#c9d8ff", maxWidth: width, min: 11 });
}

function drawStats(ctx, L, data) {
  const S = L.stats, gap = 12, tw = (S.w - gap) / 2, th = (S.h - gap) / 2, words = key => socialText(key, {}, data.locale);
  const number = value => (value === null ? "—" : value.toLocaleString(data.locale));
  const tiles = [
    [words("cardWinRate"), data.winPercent === null ? "—" : `${data.winPercent}%`, "#7dffb2"],
    [words("cardBattles"), number(data.battles), "#ffffff"],
    [words("cardDex"), data.dexPercent === null ? "—" : `${data.dexPercent}%`, "#ffd76a"],
    [words("cardBits"), number(data.bits), "#ffe066"]
  ];
  tiles.forEach(([name, value, color], index) => {
    const x = S.x + (index % 2) * (tw + gap), y = S.y + Math.floor(index / 2) * (th + gap);
    ctx.save(); chamfer(ctx, x, y, tw, th, 12);
    ctx.fillStyle = "rgba(9, 16, 38, 0.82)"; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = alpha(CYAN, 0.4); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(x + 12, y + 12, 4, th - 24);
    ctx.restore();
    label(ctx, name, x + 26, y + 26, { size: 15, weight: 800, color: "#9fc7ff", maxWidth: tw - 36 });
    label(ctx, value, x + 26, y + th - 14, { size: 34, color, maxWidth: tw - 36, min: 16 });
  });
}

function drawReferral(ctx, L, data) {
  const R = L.referral, words = key => socialText(key, {}, data.locale), room = Boolean(data.roomCode);
  const codeW = room ? R.w * 0.62 : R.w, roomW = R.w - codeW - 12;
  ctx.save(); chamfer(ctx, R.x, R.y, codeW, R.h, 14);
  ctx.fillStyle = "rgba(30, 18, 4, 0.9)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = linear(ctx, R.x, R.y, R.x + codeW, R.y, GOLD); ctx.stroke(); ctx.restore();
  label(ctx, words("cardFriendCode"), R.x + 20, R.y + 24, { size: 15, weight: 800, color: "#ffd76a", maxWidth: codeW - 40 });
  label(ctx, data.tamerCode ?? "TM-????-????", R.x + 20, R.y + R.h - 13, { size: 32, color: "#fff4c2", maxWidth: codeW - 40, min: 16, family: MONO, glow: "rgba(255, 200, 80, 0.6)" });
  if (room) {
    const x = R.x + codeW + 12;
    ctx.save(); chamfer(ctx, x, R.y, roomW, R.h, 14);
    ctx.fillStyle = "rgba(40, 6, 30, 0.9)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#ff4fa3"; ctx.stroke(); ctx.restore();
    label(ctx, words("cardRoomCode"), x + 16, R.y + 24, { size: 15, weight: 800, color: "#ff9bd2", maxWidth: roomW - 32 });
    label(ctx, data.roomCode, x + 16, R.y + R.h - 13, { size: 32, color: "#ffffff", maxWidth: roomW - 32, min: 16, family: MONO, glow: "rgba(255, 79, 163, 0.7)" });
  }
}

function drawPlay(ctx, L, data) {
  const P = L.play, words = key => socialText(key, {}, data.locale), bars = seedBars(data.tamerCode, 34);
  const barsWidth = bars.reduce((sum, width) => sum + width + 2, 0);
  label(ctx, `${words("cardPlay")}  ${data.playUrl ?? ""}`.trim(), P.x, P.y, { size: 16, weight: 800, color: CYAN, maxWidth: P.w - barsWidth - 16, min: 10 });
  ctx.save(); ctx.fillStyle = alpha(CYAN, 0.75);
  let x = P.x + P.w - barsWidth;
  for (const width of bars) { ctx.fillRect(x, P.y - 16, width, 18); x += width + 2; }
  ctx.restore();
}

/** Draws the whole card onto a 2D context already scaled to logical pixels. Pure: inputs in, pixels out. */
export function drawTamerBragCard(ctx, data, { orientation = "landscape", portrait = null } = {}) {
  const L = layoutFor(orientation);
  const aura = BRAG_CARD_ATTRIBUTE_COLORS[data.partner?.attributeIndex ?? 0] ?? BRAG_CARD_ATTRIBUTE_COLORS[0];
  drawBackground(ctx, L, aura);
  drawHero(ctx, L, data, portrait);
  drawFrame(ctx, L);
  drawTitle(ctx, L, data);
  drawRibbon(ctx, L, data);
  drawTamer(ctx, L, data);
  drawStats(ctx, L, data);
  drawReferral(ctx, L, data);
  drawPlay(ctx, L, data);
  return L;
}

/**
 * Loads the portrait for drawing. Same-origin sources load as they are; any
 * other origin is requested with CORS so a permitted image never taints the
 * canvas. Resolves null on error or timeout, never rejects.
 */
export function loadBragCardImage(src, { doc = globalThis.document, timeoutMs = 8000, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  return new Promise(resolve => {
    if (!src || !doc?.createElement) { resolve(null); return; }
    const image = doc.createElement("img");
    let settled = false;
    const done = value => { if (settled) return; settled = true; clearTimer(timer); resolve(value); };
    const timer = setTimer(() => done(null), timeoutMs);
    try {
      const base = doc.baseURI ?? globalThis.location?.href;
      const url = new URL(src, base);
      if (base && url.origin !== new URL(base).origin) image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.addEventListener("load", () => done(image.naturalWidth > 0 ? { image, width: image.naturalWidth, height: image.naturalHeight } : null), { once: true });
      image.addEventListener("error", () => done(null), { once: true });
      image.src = url.href;
    } catch { done(null); }
  });
}

function isTainted(ctx) {
  try { ctx.getImageData(0, 0, 1, 1); return false; } catch { return true; }
}

/**
 * Renders the card on a fresh canvas at BRAG_CARD_SCALE. If the portrait
 * would taint the canvas, the card is drawn again without it.
 */
export async function renderTamerBragCard(input, { doc = globalThis.document, orientation = "landscape", scale = BRAG_CARD_SCALE, locale = getLocale(),
  createCanvas = (w, h) => { const canvas = doc.createElement("canvas"); canvas.width = w; canvas.height = h; return canvas; }, loadImage = src => loadBragCardImage(src, { doc }) } = {}) {
  const data = normalizeBragCardData(input, locale);
  const size = BRAG_CARD_SIZES[orientation] ?? BRAG_CARD_SIZES.landscape;
  const canvas = createCanvas(Math.round(size.width * scale), Math.round(size.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("BRAG_CARD_CANVAS_UNAVAILABLE");
  const portrait = data.partner?.portraitSrc ? await loadImage(data.partner.portraitSrc) : null;
  const paint = image => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(scale, 0, 0, scale, 0, 0); drawTamerBragCard(ctx, data, { orientation, portrait: image }); };
  paint(portrait);
  let portraitDrawn = Boolean(portrait);
  if (portrait && isTainted(ctx)) { paint(null); portraitDrawn = false; }
  return Object.freeze({ canvas, data, orientation, width: canvas.width, height: canvas.height, portraitDrawn });
}

function dataUrlToBlob(dataUrl, type) {
  const body = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = globalThis.atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** The PNG as a data URL (for the <img> preview) and a Blob (for share and download). */
export async function exportTamerBragCard(canvas, { type = "image/png" } = {}) {
  let dataUrl;
  try { dataUrl = canvas.toDataURL(type); } catch (error) { throw Object.assign(new Error("BRAG_CARD_EXPORT_BLOCKED"), { cause: error }); }
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(`data:${type};base64,`) || dataUrl.length < 64) throw new Error("BRAG_CARD_EXPORT_EMPTY");
  const blob = await new Promise(resolve => { try { canvas.toBlob(value => resolve(value), type); } catch { resolve(null); } }) ?? dataUrlToBlob(dataUrl, type);
  return Object.freeze({ dataUrl, blob, type, width: canvas.width, height: canvas.height, bytes: blob?.size ?? null });
}

/** Frees the canvas backing store (iOS keeps it until the size drops). */
export function releaseBragCardCanvas(canvas) {
  try { canvas.width = 0; canvas.height = 0; } catch { /* already gone */ }
}
