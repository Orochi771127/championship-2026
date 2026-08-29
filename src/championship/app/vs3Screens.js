// VS3 -- Hunt Result presentation.
//
// Consumes only the injected Gate/Hunt presentation source. The field
// gesture already decided the enclosure; this screen reports the instance
// that was brought home.

import { VS2_UI_AUTHORITY, VS2_PRESENTATION_MODES } from "./vs2Screens.js";

const RESULT_TITLE = "HUNT RESULT";
const RESULT_OUTCOME = "BROUGHT HOME";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
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

export function createHuntResultView({ root, source }) {
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
  shell.setAttribute("aria-label", block.title);
  const header = element("header", "cm-vs2-header");
  const copy = element("div", "cm-vs2-header__copy");
  copy.append(
    element("span", "cm-vs2-kicker", "EXPEDITION"),
    element("h1", "cm-vs2-title", block.title || RESULT_TITLE),
    element("p", "cm-vs2-subtitle", block.outcomeLabel || RESULT_OUTCOME)
  );
  header.append(copy);

  const body = element("div", "cm-vs2-result__body");
  body.append(
    element("p", "cm-vs2-result__species", block.displayName),
    element("p", "cm-vs2-result__note", "This instance is now in your collection. Home does not yet show new arrivals.")
  );
  if (mode === VS2_PRESENTATION_MODES.DEVELOPER) {
    body.append(element(
      "p",
      "cm-vs2-evidence",
      `${block.successAuthority}. Original odds untraced. Tether ${block.tetherBand}.`
    ));
  }

  const footer = element("footer", "cm-vs2-footer");
  const home = element("button", "cm-vs2-action cm-vs2-action--primary", "RETURN HOME");
  home.type = "button";
  home.setAttribute("aria-label", "Return to Raising Home");
  footer.append(home);

  shell.append(header, body, footer);
  root.append(shell);

  home.addEventListener("click", () => source.intents.confirmHuntResult());

  function render(nextFrame) {
    const next = nextFrame?.huntResult;
    if (!next) return;
    copy.querySelector(".cm-vs2-title").textContent = next.title;
    copy.querySelector(".cm-vs2-subtitle").textContent = next.outcomeLabel;
    body.querySelector(".cm-vs2-result__species").textContent = next.displayName;
  }

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
