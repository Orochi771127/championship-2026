import {publicRuntimeAsset} from './publicRuntimeAssets.js';

const states = ['default', 'selected', 'release-confirm'];
const frames = new Map(states.map(state => {
  const asset = publicRuntimeAsset(`art:ui:capture-frame:a:${state}`);
  if (!asset || asset.width !== 320 || asset.height !== 320) throw Error('CAPTURE_FRAME_NOT_REGISTERED');
  return [state, new URL('../../../' + asset.src, import.meta.url).href];
}));

// Owner-selected A: original vector artwork, mounted only by the result view.
// It decorates the existing portrait and intents; no game or save state is read.
export function appendOriginalCaptureFrame(host) {
  const image = document.createElement('img');
  image.className = 'cm-original-capture-frame__art';
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.decoding = 'async';
  image.draggable = false;
  host.classList.add('cm-original-capture-frame');
  host.append(image);
  function setState(state = 'default') {
    if (!frames.has(state)) throw Error('CAPTURE_FRAME_STATE_INVALID');
    if (host.dataset.frameState === state) return;
    host.dataset.frameState = state;
    image.src = frames.get(state);
  }
  setState();
  return Object.freeze({setState});
}
