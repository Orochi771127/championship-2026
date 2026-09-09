import assert from "node:assert/strict";
import test from "node:test";
import { createChampionshipToolbar, TOOLBAR_MODES } from "../src/championship/app/championshipToolbar.js";

function documentStub() {
  const listeners = new Map();
  const doc = {
    defaultView: {
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
    },
    createElement() {
      const styles = new Map();
      return {
        ownerDocument: doc, children: [], dataset: {}, attributes: {}, events: {}, height: 0,
        style: {
          setProperty(key, value) { styles.set(key, value); },
          removeProperty(key) { styles.delete(key); },
          getPropertyValue(key) { return styles.get(key) ?? ""; }
        },
        append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } },
        replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(type, listener) { this.events[type] = listener; },
        getBoundingClientRect() { return { height: this.height }; },
        querySelector(selector) { return this.children.find((child) => child.className === selector.slice(1)) ?? null; },
        querySelectorAll(selector) {
          const key = selector === "[data-menu-id]" ? "menuId" : selector === "[data-cell-index]" ? "cellIndex" : "toolId";
          return this.children.flatMap((child) => [
            ...(child.dataset[key] ? [child] : []), ...child.querySelectorAll(selector)
          ]);
        },
        remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); }
      };
    }
  };
  doc.body = doc.createElement();
  return { doc, listeners };
}

function fixture(t, { observerAvailable = true } = {}) {
  const { doc, listeners } = documentStub();
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.ResizeObserver;
  const observations = [];
  let observer;
  globalThis.document = doc;
  globalThis.ResizeObserver = observerAvailable ? class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target, options) { observations.push({ target, options }); }
    disconnect() { this.disconnected = true; }
  } : undefined;
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = previousObserver;
  });
  const entries = [];
  const toolbar = createChampionshipToolbar({ root: doc.body, onMenuEntry: (entry) => entries.push(entry) });
  const [menu, rail] = toolbar.element.children;
  rail.height = 52.8;
  return { doc, toolbar, menu, rail, observer, observations, listeners, entries };
}

test("toolbar tracks the full rail after safe-area or font changes without reserving submenu height", (t) => {
  const { doc, toolbar, menu, rail, observer, observations } = fixture(t);
  const height = () => doc.body.style.getPropertyValue("--cm-toolbar-height");
  assert.equal(height(), "0px");
  assert.deepEqual(observations, [{ target: rail, options: { box: "border-box" } }]);
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  assert.equal(height(), "53px");
  rail.children[7].events.click();
  assert.equal(menu.hidden, false);
  menu.height = 180;
  rail.height = 86.8;
  observer.callback();
  assert.equal(height(), "87px", "only the padded rail reserves screen space");
  toolbar.setMode(null);
  assert.equal(height(), "0px");
  assert.equal(menu.hidden, true);
  toolbar.setMode(TOOLBAR_MODES.HUNT);
  assert.equal(height(), "87px");
  toolbar.dispose();
  assert.equal(observer.disconnected, true);
  observer.callback();
  assert.equal(height(), "", "a queued observer cannot recreate disposed layout state");
  assert.equal(doc.body.dataset.toolbar, undefined);
});

test("toolbar resize fallback has the same visibility and disposal behavior", (t) => {
  const { doc, toolbar, rail, listeners } = fixture(t, { observerAvailable: false });
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  rail.height = 68;
  listeners.get("resize")();
  assert.equal(doc.body.style.getPropertyValue("--cm-toolbar-height"), "68px");
  toolbar.dispose();
  assert.equal(listeners.size, 0);
  assert.equal(doc.body.style.getPropertyValue("--cm-toolbar-height"), "");
});


test("Hunt never displays Raising care tools or menus and returning Home restores them", (t) => {
  const { toolbar, rail } = fixture(t);
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  const labels = rail.children.map((button) => button.children[0].textContent);
  rail.children[1].events.click();
  assert.equal(toolbar.getSelectedTool(), "feed");
  toolbar.setMode(TOOLBAR_MODES.HUNT);
  assert.equal(toolbar.getSelectedTool(), null);
  assert.equal(rail.children.length, 8);
  assert.ok(rail.children.every((button) => button.disabled && button.children[0].textContent === "—"));
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  assert.deepEqual(rail.children.map((button) => button.children[0].textContent), labels);
  assert.ok(rail.children.every((button) => !button.disabled));
  toolbar.dispose();
});
