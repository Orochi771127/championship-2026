// The compositions of each ceremony (2026-10-15). Builders only lay out nodes
// for ui/ceremony.css; the words arrive already translated from the caller,
// and every image is an existing registered asset handed in by the caller.
import { appendCeremonySparks, ceremonyNode } from "./ceremonyRunner.js";

const sparkCount = (env, full) => (env.motion === "full" ? full : 0);

function plate(doc, { kicker, title, meta }) {
  const node = ceremonyNode(doc, "div", "cm-cer-plate");
  if (kicker) node.append(ceremonyNode(doc, "span", "cm-cer-kicker", kicker));
  node.append(ceremonyNode(doc, "p", "cm-cer-title", title));
  if (meta) node.append(ceremonyNode(doc, "span", "cm-cer-meta", meta));
  return node;
}

function rings(doc, parent, count = 3) {
  for (const suffix of ["a", "b", "c"].slice(0, count)) parent.append(ceremonyNode(doc, "span", `cm-cer-ring cm-cer-ring--${suffix}`));
}

/** 傳送門連線: a portal swells, a beam drops through it, the gate is named. */
export function buildGateEntry(stage, env, { kicker, gateName, meta, hint }) {
  const doc = stage.ownerDocument;
  const root = ceremonyNode(doc, "div", "cm-cer-gate");
  const portal = ceremonyNode(doc, "div", "cm-cer-gate__portal");
  portal.append(ceremonyNode(doc, "span", "cm-cer-gate__beam"));
  rings(doc, portal);
  portal.append(ceremonyNode(doc, "span", "cm-cer-gate__orbit"), ceremonyNode(doc, "span", "cm-cer-gate__core"));
  const card = plate(doc, { kicker, title: gateName, meta });
  card.append(ceremonyNode(doc, "span", "cm-cer-gate__track"));
  root.append(portal, card);
  stage.append(root);
  if (hint) stage.append(ceremonyNode(doc, "span", "cm-cer-hint", hint));
}

/** 捕獲成功: a ring and sparks where the catch is announced, a small plate. */
export function buildCapture(stage, env, { kicker, name, chip }) {
  const doc = stage.ownerDocument;
  const root = ceremonyNode(doc, "div", "cm-cer-capture");
  const burst = ceremonyNode(doc, "div", "cm-cer-capture__burst");
  rings(doc, burst, 2);
  appendCeremonySparks(doc, burst, sparkCount(env, 12));
  const card = plate(doc, { kicker, title: name });
  if (chip) card.append(ceremonyNode(doc, "span", "cm-cer-card-chip", chip));
  root.append(burst, card);
  stage.append(root);
}

/** 徽章獲得: the medal spins in on gold rays; the plate names the title. */
export function buildMedal(stage, env, { kicker, title, meta, medal, hint }) {
  const doc = stage.ownerDocument;
  const root = ceremonyNode(doc, "div", "cm-cer-medal");
  const medalStage = ceremonyNode(doc, "div", "cm-cer-medal__stage");
  medalStage.append(ceremonyNode(doc, "span", "cm-cer-rays"));
  rings(doc, medalStage, 2);
  appendCeremonySparks(doc, medalStage, sparkCount(env, 16));
  if (medal?.src) {
    const image = doc.createElement("img");
    image.className = "cm-cer-medal__art";
    image.src = medal.src;
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("error", () => image.replaceWith(ceremonyNode(doc, "span", "cm-cer-medal__fallback")), { once: true });
    medalStage.append(image);
  } else {
    medalStage.append(ceremonyNode(doc, "span", "cm-cer-medal__fallback"));
  }
  root.append(medalStage, plate(doc, { kicker, title, meta }));
  stage.append(root);
  if (hint) stage.append(ceremonyNode(doc, "span", "cm-cer-hint", hint));
}

/** 進化: the new form swells out of light; the plate says who became what. */
export function buildEvolve(stage, env, { kicker, title, meta, portrait, hint }) {
  const doc = stage.ownerDocument;
  const root = ceremonyNode(doc, "div", "cm-cer-evolve");
  const art = ceremonyNode(doc, "div", "cm-cer-evolve__stage");
  art.append(ceremonyNode(doc, "span", "cm-cer-rays"));
  rings(doc, art, 2);
  appendCeremonySparks(doc, art, sparkCount(env, 14));
  if (portrait?.src) {
    const image = doc.createElement("img");
    image.className = "cm-cer-evolve__art";
    image.src = portrait.src;
    image.alt = "";
    image.decoding = "async";
    // Whole-number scale keeps the pixel grid (the HUD bank's native rule).
    const scale = Math.max(1, Math.round((portrait.nativeScale ?? 1) * 2));
    image.style.width = `${portrait.width * scale}px`;
    image.style.height = `${portrait.height * scale}px`;
    image.addEventListener("error", () => image.remove(), { once: true });
    art.append(image);
  }
  root.append(art, plate(doc, { kicker, title, meta }));
  stage.append(root);
  if (hint) stage.append(ceremonyNode(doc, "span", "cm-cer-hint", hint));
}

/** 對戰開場: the two sides slide in and meet at the VS mark. */
export function buildVersus(stage, env, { playerLabel, playerNames, opponentLabel, opponentNames, mark = "VS" }) {
  const doc = stage.ownerDocument;
  const root = ceremonyNode(doc, "div", "cm-cer-versus");
  const side = (team, label, names) => {
    const node = ceremonyNode(doc, "div", `cm-cer-versus__side cm-cer-versus__side--${team}`);
    node.append(ceremonyNode(doc, "span", "cm-cer-versus__team", label));
    for (const name of names.slice(0, 3)) node.append(ceremonyNode(doc, "span", "cm-cer-versus__name", name));
    return node;
  };
  root.append(side("player", playerLabel, playerNames), ceremonyNode(doc, "span", "cm-cer-versus__mark", mark), side("opponent", opponentLabel, opponentNames));
  stage.append(root);
}
