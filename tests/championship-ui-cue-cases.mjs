import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createAudioBus } from '../src/championship/presentation/audioBus.js';
import { createUiCuePlayer, UI_CUES, UI_CUE_THROTTLE_MS } from '../src/championship/presentation/uiCuePlayer.js';

const click = () => ({ type: 'click', isTrusted: true });
function fixture() {
  let ms = 0, contexts = 0;
  const nodes = [], oscillators = [];
  const param = () => ({ value: 1, events: [],
    setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; },
    exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); this.value = v; },
    cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; }
  });
  const node = kind => {
    const n = { kind, connections: [], disconnected: false,
      connect(target) { this.connections.push(target); },
      disconnect() { this.disconnected = true; }
    };
    nodes.push(n); return n;
  };
  class Context {
    constructor() { contexts++; this.state = 'running'; this.currentTime = 3; this.destination = node('destination'); }
    createGain() { return Object.assign(node('gain'), { gain: param() }); }
    createOscillator() {
      const osc = Object.assign(node('oscillator'), { frequency: param(), stops: [],
        start(t) { this.started = t; }, stop(t) { this.stops.push(t); }
      });
      oscillators.push(osc); return osc;
    }
  }
  const audio = createAudioBus({ AudioContextClass: Context, eventTarget: null });
  const player = createUiCuePlayer({ audio, now: () => ms });
  return { audio, player, nodes, oscillators, contexts: () => contexts, advance: (delta = 100) => { ms += delta; } };
}

test('three released short cues use one existing context and sfx bus; master/category volume applies once', () => {
  const f = fixture();
  f.audio.setLevels({ masterVolume: 50, sfxVolume: 40 });
  assert.deepEqual(Object.keys(UI_CUES), ['select', 'open', 'back']);
  for (const [name, cue] of Object.entries(UI_CUES)) {
    f.advance();
    assert.equal(f.player.play(name, click()), true);
    const osc = f.oscillators.at(-1), amp = osc.connections[0];
    assert.equal(amp.connections[0], f.audio.output('sfx').destination);
    assert.equal(osc.type, cue.type);
    assert.deepEqual(amp.gain.events.map(e => e[1]), [.0001, cue.peak, .0001]);
    assert.ok(osc.stops[0] - osc.started <= .101, name);
  }
  assert.equal(f.contexts(), 1);
  assert.equal(f.audio.gains().effective, .2);
  assert.ok(f.oscillators.slice(0, -1).every(o => o.disconnected && o.connections[0].disconnected));
  f.oscillators.at(-1).onended();
  assert.equal(f.oscillators.at(-1).connections[0].disconnected, true);
});

test('shared 80ms throttle and event identity prevent stacked cues from one click or rapid repeated clicks', () => {
  const f = fixture(), event = click();
  assert.equal(UI_CUE_THROTTLE_MS, 80);
  assert.equal(f.player.play('open', event), true);
  f.advance(100);
  assert.equal(f.player.play('select', event), false, 'same event remains consumed after throttle');
  assert.equal(f.player.play('back', click()), true);
  f.advance(79);
  assert.equal(f.player.play('back', click()), false);
  f.advance(1);
  assert.equal(f.player.play('select', click()), true);
  assert.equal(f.oscillators.length, 3);
});

test('synthetic clicks, pointerdown, keydown, absent events and unknown names are silent', () => {
  const f = fixture();
  for (const event of [undefined, { type: 'click', isTrusted: false }, { type: 'pointerdown', isTrusted: true }, { type: 'keydown', isTrusted: true }]) {
    assert.equal(f.player.play('select', event), false);
  }
  assert.equal(f.player.play('toString', click()), false);
  assert.equal(f.player.play('reject', click()), false, 'unbound candidate is outside release');
  assert.equal(f.contexts(), 0, 'no graph created for ineligible interactions');
});

test('mute, zero master and zero sfx neither start nor queue an oscillator, while music volume does not silence UI', () => {
  const f = fixture();
  for (const levels of [{ muted: true }, { muted: false, masterVolume: 0 }, { masterVolume: 100, sfxVolume: 0 }]) {
    f.audio.setLevels(levels);
    assert.equal(f.player.play('open', click()), false);
  }
  assert.equal(f.contexts(), 0);
  f.audio.setLevels({ sfxVolume: 100, musicVolume: 0 });
  assert.equal(f.player.play('open', click()), true);
  f.advance(); f.audio.setLevels({ muted: true });
  const mutedEvent = click();
  assert.equal(f.player.play('back', mutedEvent), false);
  f.audio.setLevels({ muted: false });
  assert.equal(f.player.play('back', mutedEvent), false, 'muted gestures never replay later');
  assert.equal(f.player.play('back', click()), true);
});

test('unavailable/suspended outputs and a failed audio graph stay silent without retry or delayed resume', () => {
  let resumes = 0;
  for (const output of [null, { context: { state: 'suspended', resume() { resumes++; } }, destination: {} },
    { context: { state: 'running', currentTime: 0, createOscillator() { throw Error('unavailable'); } }, destination: {} }]) {
    const player = createUiCuePlayer({ audio: { output: () => output }, now: () => 0 });
    assert.equal(player.play('select', click()), false);
  }
  assert.equal(resumes, 0);
});

test('stop/dispose release their voices without closing the application audio context', () => {
  const f = fixture();
  f.player.play('open', click()); f.player.stop();
  assert.equal(f.oscillators[0].disconnected, true);
  f.advance(); f.player.play('back', click()); f.player.dispose(); f.player.dispose();
  assert.equal(f.oscillators[1].connections[0].disconnected, true);
  f.advance(); assert.equal(f.player.play('select', click()), false);
  assert.equal(f.audio.state(), 'running');
});

test('runtime supplies the same settings bus and reject remains unbound pending a verified domain failure hook', async () => {
  const main = await readFile(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
  const toolbar = await readFile(new URL('../src/championship/app/championshipToolbar.js', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../src/championship/app/settings/settingsPanel.js', import.meta.url), 'utf8');
  assert.match(main, /createUiCuePlayer\(\{ audio: settings.audio \}\)/);
  assert.doesNotMatch(toolbar + settings + main, /onUiCue\(['"]reject['"]|uiCues\.play\(['"]reject['"]/);
});
