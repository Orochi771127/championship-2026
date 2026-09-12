import { speciesNameForId } from "../text/zhHant.js";
import { uiText } from "../text/uiText.js";
// VS3 -- Hunt Result presentation.
//
// Consumes only the injected Gate/Hunt presentation source. Collection has
// already inserted a record into the card; this screen edits its name and
// requests the existing app's result-to-Home save transaction.

import { PRODUCT_GIVEN_NAME_MAX_LENGTH } from "./championshipRaisingProduction.js";
import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from "./vs2Screens.js";

const RESULT_TITLE = "HUNT RESULT";
const RESULT_OUTCOME = "BROUGHT HOME";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = uiText(text);
  return node;
}

function presentationMode() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("presentation") === "developer"
      ? VS2_PRESENTATION_MODES.DEVELOPER
      : VS2_PRESENTATION_MODES.PLAYER;
  } catch {
    return VS2_PRESENTATION_MODES.PLAYER;
  }
}

/**
 * Owner QA, 2026-09-12: "原作結束狩獵會看得到抓到的數碼獸的外觀". This screen
 * showed the species name and nothing else, so you could not see what you had
 * caught. `hudArt` is the same registered portrait bank the Raising home and
 * the battle result already draw from, which keeps one art language rather
 * than introducing a second source for the same creature.
 */
export function createHuntResultView({ root, source, hudArt = null }) {
  const frame = source.getFrame();
  const block = frame.huntResult;
  if (!block) throw new Error("CHAMPIONSHIP_HUNT_RESULT_NOT_ACTIVE");
  const mode = presentationMode();

  root.replaceChildren();
  root.className = "cm-vs2-root";
  root.dataset.uiAuthority = VS2_UI_AUTHORITY;
  root.dataset.presentationMode = mode;
  root.dataset.screen = frame.screen;

  const shell = element("section", "cm-vs2-shell cm-vs2-result");
  shell.setAttribute("aria-label", uiText(block.title));
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "EXPEDITION"),
    element("h1", "cm-vs2-title", block.title || RESULT_TITLE),
    element("p", "cm-vs2-subtitle", block.outcomeLabel || RESULT_OUTCOME)
  );
  header.append(copy);

  const body = element("div", "cm-vs2-result__body");
  const portrait = document.createElement("img");
  portrait.className = "cm-vs2-result__portrait";
  portrait.alt = "";
  portrait.decoding = "async";
  // The name carries the identity for a reader; the portrait is decoration
  // beside it, so it stays out of the accessibility tree rather than repeating
  // the species that is already announced below it.
  portrait.setAttribute("aria-hidden", "true");
  const species = element("p", "cm-vs2-result__species", speciesNameForId(block.speciesId, block.speciesLabel || block.displayName));

  // The Raising home draws this bank at its native scale beside a stat block,
  // where it is an identifier. Here it is the answer to "what did I catch",
  // and at native scale on a phone it reads as an icon rather than a reveal.
  // Doubling keeps the same art and the same pixel grid.
  const PORTRAIT_DISPLAY_SCALE = 2;

  // A missing or unregistered portrait hides the image rather than leaving a
  // broken one: the screen still has to name and rename the catch.
  function paintPortrait(speciesId) {
    const image = hudArt?.getPortrait(speciesId) ?? null;
    portrait.hidden = !image;
    if (!image) return;
    if (portrait.getAttribute("src") !== image.src) portrait.src = image.src;
    const scale = image.nativeScale * PORTRAIT_DISPLAY_SCALE;
    portrait.style.width = `${image.width * scale}px`;
    portrait.style.height = `${image.height * scale}px`;
  }
  paintPortrait(block.speciesId);
  const nameField = element("label", "cm-vs2-result__name");
  nameField.append(element("span", "cm-vs2-result__name-label", "GIVEN NAME"));
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "cm-vs2-result__name-input";
  nameInput.maxLength = PRODUCT_GIVEN_NAME_MAX_LENGTH;
  nameInput.value = block.displayName ?? "";
  let presentedName = nameInput.value;
  nameInput.setAttribute("data-cm-name-edit", "");
  nameInput.setAttribute("aria-label", uiText("Given name"));
  nameInput.autocomplete = "off";
  nameInput.spellcheck = false;
  nameField.append(nameInput);
  body.append(
    portrait,
    species,
    nameField,
    element("p", "cm-vs2-result__note", "Name them, then return home. They will be waiting in the habitat.")
  );
  if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
    body.append(element(
      "p",
      "cm-vs2-evidence",
      `${block.successAuthority}.`
    ));
  }

  const footer = element("footer", "cm-vs2-footer");
  const roster = element("div", "cm-vs2-result__roster");
  roster.setAttribute("aria-label", uiText("Memory card and Home roster"));
  const releasePrompt = element("div", "cm-vs2-result__release");
  releasePrompt.setAttribute("role", "group");
  releasePrompt.setAttribute("aria-label", uiText("Confirm release"));
  body.append(roster, releasePrompt);
  const error = element("p", "cm-vs2-result__note");
  error.setAttribute("role", "alert");
  footer.append(error);
  const home = element("button", "cm-vs2-action cm-vs2-action--primary", "RETURN HOME");
  home.type = "button";
  home.setAttribute("aria-label", uiText("Return to Raising Home"));
  footer.append(home);

  shell.append(header, body, footer);
  root.append(shell);

  function commitName() {
    const nextName = nameInput.value.trim();
    if (nextName && nextName !== presentedName) source.intents.setHuntResultName(nextName);
  }

  nameInput.addEventListener("change", commitName);
  nameInput.addEventListener("input", commitName);
  home.addEventListener("click", () => {
    commitName();
    source.intents.confirmHuntResult();
  });

  function render(nextFrame) {
    const next = nextFrame?.huntResult;
    if (!next) return;
    copy.querySelector(".cm-vs2-title").textContent = uiText(next.title);
    copy.querySelector(".cm-vs2-subtitle").textContent = uiText(next.outcomeLabel);
    species.textContent = speciesNameForId(next.speciesId, next.speciesLabel || next.displayName);
    paintPortrait(next.speciesId);
    nameField.hidden = !next.speciesId;
    if (document.activeElement !== nameInput) nameInput.value = next.displayName ?? "";
    presentedName = next.displayName ?? "";
    error.textContent = uiText(next.commitError === "SAVE_FAILED"
      ? "Save failed. Your Digimon is still on the memory card. Return Home again to retry."
      : next.commitError === "HOME_ROSTER_FULL" ? "Your home roster is full. Your Digimon remains on the memory card." : "");
    error.hidden = !error.textContent;
    roster.replaceChildren();
    for (const row of next.rows ?? []) {
      const line = element("div", "cm-vs2-result__row");
      const label = `${uiText(row.kind === "CARD" ? "MEMORY CARD" : "HOME")} — ${row.displayName}`;
      line.append(element("span", "", label));
      const release = element("button", "cm-vs2-action", "RELEASE");
      release.type = "button";
      release.dataset.releaseKey = row.key;
      release.setAttribute("aria-label", uiText(`Release ${label}`));
      release.disabled = !row.canRelease || Boolean(next.pendingRelease);
      if (!row.canRelease) release.title = uiText("Release is not yet available for this resident.");
      release.addEventListener("click", () => source.intents.requestHuntResultRelease(row.key));
      line.append(release); roster.append(line);
    }
    releasePrompt.replaceChildren();
    releasePrompt.hidden = !next.pendingRelease;
    home.disabled = Boolean(next.pendingRelease);
    if (next.pendingRelease) {
      releasePrompt.append(element("p", "", `Release ${next.pendingRelease.displayName}?`));
      const cancel = element("button", "cm-vs2-action", "CANCEL");
      const confirm = element("button", "cm-vs2-action", "CONFIRM RELEASE");
      cancel.type = confirm.type = "button";
      cancel.addEventListener("click", () => source.intents.cancelHuntResultRelease());
      confirm.addEventListener("click", () => source.intents.confirmHuntResultRelease());
      releasePrompt.append(cancel, confirm);
    }
  }

  render(frame);
  return Object.freeze({
    render,
    dispose() {
      root.replaceChildren();
      root.className = "";
      delete root.dataset.uiAuthority;
      delete root.dataset.presentationMode;
      delete root.dataset.screen;
    }
  });
}
