// 📸 Brag card preview (OWNER_APPROVED_ADAPTATION 2026-10-29).
//
// The shutter (a 120 ms white flash and the arcade bus's `shutter` cue), the
// card composition, and the hologram preview in the shared dialog: the PNG as
// a plain <img> (an iPhone Home Screen app can long-press it into Photos, where
// <a download> is blocked), landscape / portrait, and three keys: the system
// share sheet with the PNG file, a PNG download, and the invite text with the
// friend code. Nothing here touches the save, storage or the network.

import publicPlaytest from "../../data/championship/public-playtest-runtime.v1.json" with { type: "json" };
import { renderTamerBragCard, exportTamerBragCard, releaseBragCardCanvas } from "../presentation/tamerBragCardGenerator.js";
import { socialText } from "../text/socialText.js";
import { getActiveGameTitle } from "../text/brandTerms.js";
import { getLocale } from "../text/locale.js";

/** The published game the card and the invite point to (the Owner's public playtest). */
export function publicPlayUrl(policy = publicPlaytest) {
  const url = new URL(policy.basePath, policy.origin);
  return Object.freeze({ href: url.href, display: `${url.host}${url.pathname}`.replace(/\/$/, "") });
}

export function bragInviteText({ code, room = null, locale = getLocale(), url = publicPlayUrl().href } = {}) {
  return socialText("inviteText", { title: getActiveGameTitle(locale), code: code ?? "", room: room ? socialText("inviteRoom", { room }, locale) : "", url }, locale);
}

export function bragCardFileName({ tamerCode = null, orientation = "landscape", now = new Date() } = {}) {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `cyber-partner-${(tamerCode ?? "tamer").toLowerCase()}-${orientation}-${day}.png`;
}

/** The 120 ms shutter flash; reduced motion keeps a softer, shorter blink. */
export function playShutterFlash({ doc = globalThis.document, reducedMotion = false, setTimer = globalThis.setTimeout } = {}) {
  const flash = doc.createElement("div");
  flash.className = "cm-brag-flash"; flash.setAttribute("aria-hidden", "true"); flash.dataset.reduced = String(Boolean(reducedMotion));
  doc.body.append(flash);
  const duration = reducedMotion ? 80 : 120;
  const animation = flash.animate?.([{ opacity: 0 }, { opacity: reducedMotion ? 0.45 : 0.95, offset: 0.25 }, { opacity: 0 }], { duration, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  const remove = () => flash.remove();
  if (animation?.finished) animation.finished.then(remove, remove); else setTimer(remove, duration + 40);
  return flash;
}

/**
 * The preview's body: image, tip, orientation keys, share / download / copy
 * and a status line. `card` is { dataUrl, blob, width, height }.
 */
export function buildBragPreviewContent({ doc = globalThis.document, card, data, orientation = "landscape", inviteText, fileName,
  nav = globalThis.navigator, clipboard = globalThis.navigator?.clipboard ?? null, onOrientation = null, urlApi = globalThis.URL } = {}) {
  const el = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const key = (action, label, extra = "") => { const b = el("button", `cm-brag-preview__key cm-arcade-key ${extra}`.trim(), label); b.type = "button"; b.dataset.bragAction = action; return b; };
  const root = el("div", "cm-brag-preview"); root.dataset.orientation = orientation;
  const frame = el("div", "cm-brag-preview__frame");
  const image = el("img", "cm-brag-preview__image");
  image.src = card.dataUrl; image.alt = socialText("imageAlt", { name: data.tamerName }); image.width = card.width; image.height = card.height; image.decoding = "async";
  image.dataset.bytes = String(card.blob?.size ?? card.dataUrl.length);
  // The dialog turns off iOS long-press; this image opts back in so "Add to Photos" works in a Home Screen app.
  image.dataset.selectable = "true"; image.draggable = true;
  frame.append(image);
  const tip = el("p", "cm-brag-preview__tip", socialText("saveTip"));
  const orient = el("div", "cm-brag-preview__orient"); orient.setAttribute("role", "group");
  for (const value of ["landscape", "portrait"]) {
    const b = key(`orientation-${value}`, socialText(value), "cm-brag-preview__orient-key");
    b.setAttribute("aria-pressed", String(value === orientation));
    b.addEventListener("click", () => { if (value !== orientation) onOrientation?.(value); });
    orient.append(b);
  }
  const status = el("p", "cm-brag-preview__status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
  const say = (text, tone = "info") => { status.hidden = !text; status.textContent = text ?? ""; status.dataset.tone = tone; };
  const manual = el("textarea", "cm-brag-preview__invite"); manual.readOnly = true; manual.value = inviteText; manual.hidden = true; manual.rows = 3;
  manual.setAttribute("aria-label", socialText("copyInvite"));
  const share = key("share", socialText("shareSystem"), "cm-brag-preview__key--share");
  const download = key("download", socialText("download"), "cm-brag-preview__key--download");
  const copy = key("copy", socialText("copyInvite"), "cm-brag-preview__key--copy");
  const file = typeof File === "function" && card.blob ? new File([card.blob], fileName, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && nav?.canShare?.({ files: [file] }));
  share.dataset.supported = String(canShareFile || typeof nav?.share === "function");
  // Share runs inside the tap itself (no await before it), so the sheet keeps its user activation.
  share.addEventListener("click", () => {
    const title = socialText("shareTitle", { name: data.tamerName });
    let request = null;
    if (canShareFile) request = nav.share({ files: [file], title, text: inviteText });
    else if (typeof nav?.share === "function") request = nav.share({ title, text: inviteText });
    if (!request) { say(socialText("shareUnsupported"), "error"); return; }
    request.then(() => say(socialText("shareDone"), "ok"), error => say(error?.name === "AbortError" ? socialText("shareCancelled") : socialText("shareUnsupported"), error?.name === "AbortError" ? "info" : "error"));
  });
  download.addEventListener("click", () => {
    const link = el("a"); let href = card.dataUrl, revoke = null;
    if (card.blob && urlApi?.createObjectURL) { href = urlApi.createObjectURL(card.blob); revoke = () => urlApi.revokeObjectURL(href); }
    link.href = href; link.download = fileName; link.rel = "noopener"; link.hidden = true;
    doc.body.append(link); link.click(); link.remove();
    if (revoke) globalThis.setTimeout?.(revoke, 4000);
    say(socialText("downloaded"), "ok");
  });
  copy.addEventListener("click", async () => {
    try { if (!clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE"); await clipboard.writeText(inviteText); say(socialText("inviteCopied"), "ok"); manual.hidden = true; }
    catch { manual.hidden = false; manual.focus?.(); manual.select?.(); say(socialText("copyManual"), "error"); }
  });
  const actions = el("div", "cm-brag-preview__actions"); actions.append(share, download, copy);
  root.append(frame, tip, orient, actions, manual, status);
  return Object.freeze({ element: root, image, keys: Object.freeze({ share, download, copy }), say });
}

/**
 * The whole flow from a tap: flash and shutter cue at once, compose the card,
 * then open (or refresh) the preview dialog. `buildData` returns the card
 * input; `showChoiceDialog` is the shared dialog.
 */
export async function openBragCardPreview({ doc = globalThis.document, trigger = null, buildData, showChoiceDialog, fx = null, reducedMotion = false,
  render = renderTamerBragCard, exportCard = exportTamerBragCard, nav = globalThis.navigator, clipboard = globalThis.navigator?.clipboard ?? null } = {}) {
  playShutterFlash({ doc, reducedMotion });
  fx?.(trigger ?? doc.body, "shutter");
  const input = await buildData();
  let orientation = "landscape", view = null, settle = null;
  const compose = async value => {
    const rendered = await render(input, { doc, orientation: value });
    try { return { rendered, card: await exportCard(rendered.canvas) }; } finally { releaseBragCardCanvas(rendered.canvas); }
  };
  let current;
  try { current = await compose(orientation); }
  catch (error) {
    await showChoiceDialog({ title: socialText("previewTitle"), message: socialText("failed", { reason: error?.message ?? String(error) }),
      actions: [{ id: "done", label: socialText("done"), tone: "primary" }], cancelId: "done", doc });
    return Object.freeze({ ok: false, reason: error?.message ?? "BRAG_CARD_FAILED" });
  }
  const host = doc.createElement("div"); host.className = "cm-brag-preview-host";
  const mount = () => {
    const data = current.rendered.data;
    view = buildBragPreviewContent({ doc, card: current.card, data, orientation, nav, clipboard,
      inviteText: bragInviteText({ code: data.tamerCode, room: data.roomCode, locale: data.locale }),
      fileName: bragCardFileName({ tamerCode: data.tamerCode, orientation }),
      onOrientation: async value => {
        view?.say(socialText("working"));
        try { current = await compose(value); orientation = value; mount(); fx?.(host, "shutter"); }
        catch (error) { view?.say(socialText("failed", { reason: error?.message ?? String(error) }), "error"); }
      } });
    host.replaceChildren(view.element);
    host.dataset.orientation = orientation; host.dataset.bytes = String(current.card.blob?.size ?? 0);
  };
  mount();
  settle = await showChoiceDialog({ title: socialText("previewTitle"), content: host, variant: "brag",
    actions: [{ id: "done", label: socialText("done"), tone: "primary" }], cancelId: "done", focusId: "done", doc });
  return Object.freeze({ ok: true, choice: settle, card: current.card, orientation });
}
