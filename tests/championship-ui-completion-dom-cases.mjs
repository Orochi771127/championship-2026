// Controlled DOM/event contracts only. This fixture does not render layout or
// prove native keyboard, mobile touch, audio output or visual acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ControlledEvent, createControlledDocument } from './helpers/controlled-database-dom.mjs';
import { createChampionshipToolbar, TOOLBAR_MODES, TOOLBAR_MENUS, TOOLBAR_PRODUCT_ENTRIES } from '../src/championship/app/championshipToolbar.js';
import { toolbarMenuEntryIcon } from '../src/championship/presentation/toolbarMenuIcons.js';
import { createSettingsPanel } from '../src/championship/app/settings/settingsPanel.js';
import { createPreferenceStore } from '../src/championship/app/settings/preferenceStore.js';
import { createChampionshipPreferencePort } from '../src/championship/app/ChampionshipPersistentSavePort.js';
import { uiText } from '../src/championship/text/uiText.js';

const baseUrl = 'http://127.0.0.1:8746/championship.html'; // identity only; no network call
const click = button => button.dispatchEvent(new ControlledEvent('click', { isTrusted: true }));
function documentFixture(t) {
  const doc = createControlledDocument();
  const makeElement = doc.createElement;
  doc.createElement = function(tag) {
    const node = makeElement.call(this, tag);
    // Fixed stand-in geometry supports existing measurement code only.
    node.getBoundingClientRect = () => ({ height: 48 });
    Object.defineProperty(node, 'lastChild', { get() { return this.childNodes.at(-1) ?? null; } });
    return node;
  };
  doc.baseURI = baseUrl;
  const listeners = new Map();
  doc.addEventListener = (type, fn) => listeners.set(type, fn);
  doc.removeEventListener = (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); };
  const win = { matchMedia: () => ({ matches: true }), addEventListener() {}, removeEventListener() {} };
  doc.defaultView = win;
  const old = { document: globalThis.document, location: globalThis.location };
  globalThis.document = doc; globalThis.location = new URL(baseUrl);
  t.after(() => {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });
  return { doc, win, listeners };
}
function toolbarFixture(t) {
  const f = documentFixture(t), cues = [], entries = [];
  const toolbar = createChampionshipToolbar({ root: f.doc.body,
    onMenuEntry: (entry, context) => entries.push({ entry, context }),
    onUiCue: (name, event) => cues.push({ name, event })
  });
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  t.after(() => toolbar.dispose());
  return { ...f, toolbar, cues, entries, rail: toolbar.element.querySelector('.cm-toolbar__rail'),
    menu: toolbar.element.querySelector('.cm-toolbar__menu') };
}

test('real menu definitions render all thirteen icons including actions; existing text, button role and handlers remain', t => {
  const f = toolbarFixture(t), seen = [];
  for (const group of TOOLBAR_MENUS) {
    click(f.rail.querySelector(`[data-menu-id="${group.id}"]`));
    const definitions = [...group.entries, ...(TOOLBAR_PRODUCT_ENTRIES[group.id] ?? [])];
    const buttons = [...f.menu.querySelectorAll('[data-entry-id]')];
    assert.equal(buttons.length, definitions.length);
    for (const originalButton of buttons) {
      const entry = definitions.find(e => e.id === originalButton.dataset.entryId);
      if (f.menu.hidden) click(f.rail.querySelector(`[data-menu-id="${group.id}"]`));
      const button = f.menu.querySelector(`[data-entry-id="${entry.id}"]`);
      assert.equal(button.isConnected, true);
      seen.push(entry.id);
      assert.equal(button.type, 'button');
      assert.equal(button.getAttribute('role'), 'menuitem');
      assert.equal(button.getAttribute('aria-label'), uiText(entry.label));
      assert.equal(button.querySelector('.cm-toolbar__entry-label').textContent, uiText(entry.label));
      assert.equal(button.querySelector('.cm-toolbar__entry-hint').textContent, uiText(entry.hint));
      const image = button.querySelector('.cm-toolbar__entry-icon');
      assert.equal(image.src, toolbarMenuEntryIcon(entry, baseUrl).src);
      assert.equal(image.alt, '');
      click(button);
      assert.equal(f.entries.at(-1).entry, entry);
      assert.equal(f.cues.at(-1).name, 'select');
    }
  }
  assert.equal(new Set(seen).size, 13);
  assert.ok(['endDay', 'saveQuit', 'settings'].every(id => seen.includes(id)));
  assert.equal(f.rail.children.length, 8);
});

test('menu open/toggle, tool select/toggle and Done each request exactly one explicit click cue', t => {
  const f = toolbarFixture(t), system = f.rail.querySelector('[data-menu-id="SYSTEM"]');
  click(system); click(system);
  const feed = f.rail.querySelector('[data-tool-id="feed"]');
  click(feed); click(feed); click(feed);
  click(f.toolbar.element.querySelector('.cm-toolbar__tool-done'));
  assert.deepEqual(f.cues.map(c => c.name), ['open', 'back', 'select', 'back', 'select', 'back']);
  assert.ok(f.cues.every(c => c.event.type === 'click'));
  assert.equal(f.toolbar.getSelectedTool(), null);
});

test('cleanup, mode changes and automatic tutorial selection are silent; disabled controls never request reject', t => {
  const f = toolbarFixture(t);
  f.toolbar.closeMenu();
  f.toolbar.setTutorialTool('hand');
  assert.equal(f.toolbar.getSelectedTool(), 'hand');
  click(f.rail.querySelector('[data-tool-id="feed"]'));
  click(f.rail.querySelector('[data-menu-id="SYSTEM"]'));
  f.toolbar.setTutorialTool(null);
  f.toolbar.setMode(null); f.toolbar.setMode(TOOLBAR_MODES.TRAINING);
  assert.deepEqual(f.cues, []);
  f.toolbar.setTutorialTool('SYSTEM');
  click(f.rail.querySelector('[data-menu-id="SYSTEM"]'));
  const disabled = f.menu.querySelector('[data-entry-id="saveQuit"]');
  assert.equal(disabled.disabled, true);
  const count = f.cues.length;
  click(disabled);
  assert.equal(f.entries.length, 0);
  assert.equal(f.cues.length, count);
  assert.equal(f.menu.hidden, false, 'disabled event does not dismiss the menu');
});

test('Escape retains opener focus behavior and stays silent; simulated keyboard click still reaches the click handler', t => {
  const f = toolbarFixture(t), system = f.rail.querySelector('[data-menu-id="SYSTEM"]');
  click(system);
  f.listeners.get('keydown')(new ControlledEvent('keydown', { key: 'Escape' }));
  assert.equal(f.doc.activeElement, system);
  assert.equal(f.menu.hidden, true);
  assert.deepEqual(f.cues.map(c => c.name), ['open']);
  system.dispatchEvent(new ControlledEvent('click', { isTrusted: true, detail: 0 }));
  assert.equal(f.cues.at(-1).name, 'open');
  f.toolbar.closeMenu(); f.toolbar.dispose();
  assert.equal(f.cues.length, 2);
});

test('settings category/select and explicit back/close request one cue; programmatic close and Escape stay silent', t => {
  const { doc, win } = documentFixture(t), cues = [];
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = createPreferenceStore({ port: createChampionshipPreferencePort({ storage }) });
  const opener = doc.createElement('button'); doc.body.append(opener);
  const panel = createSettingsPanel({ doc, win, history: null, store,
    onUiCue: (name, event) => cues.push({ name, event }) });
  t.after(() => panel.dispose());
  panel.open({ from: opener });
  assert.deepEqual(cues, []);
  click(doc.querySelector('[data-category="sound"]'));
  assert.equal(panel.inspect().category, 'sound');
  assert.equal(panel.inspect().view, 'detail');
  click(doc.querySelector('.cm-settings__back'));
  assert.equal(panel.inspect().view, 'list');
  assert.equal(doc.activeElement.dataset.category, 'sound');
  click(doc.querySelector('.cm-settings__close'));
  assert.deepEqual(cues.map(c => c.name), ['select', 'back', 'back']);
  assert.equal(doc.activeElement, opener);
  panel.open({ from: opener }); panel.close();
  assert.equal(cues.length, 3);
  panel.open({ from: opener });
  doc.querySelector('.cm-settings').dispatchEvent(new ControlledEvent('keydown', { key: 'Escape' }));
  assert.equal(cues.length, 3);
});
