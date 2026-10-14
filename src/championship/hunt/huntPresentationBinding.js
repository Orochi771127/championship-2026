// Layout snapshots only; runtime remains the sole camera/gameplay authority.
// Requests are registered internally so tutorial completion never trusts a
// player-supplied rectangle or boolean visibility claim.
import { huntViewportTransform } from './huntFieldCoordinates.js';
import { huntPresentationViewport } from './huntPresentationViewport.js';
import { computeVisibleChunkWindow, getFieldChunkBounds } from '../field/fieldCamera.js';

const requests = new WeakMap();
const finiteDimension = value => Number.isFinite(value) && value > 0 && value <= 16384;
export function getHuntPresentationRequest(request, runtime) {
  const entry = request && typeof request === 'object' ? requests.get(request) : null;
  return entry?.runtime === runtime ? entry : null;
}

export function readHuntPresentationViewport(runtime, request) {
  const entry = getHuntPresentationRequest(request, runtime);
  if (!entry) return null;
  const { viewportWidth, viewportHeight, referenceWidth, referenceHeight, mode } = entry;
  const camera = runtime.getCamera(referenceWidth, referenceHeight);
  const focus = runtime.getCameraFocus();
  const canonicalTransform = huntViewportTransform(referenceWidth, referenceHeight);
  const canonicalTransformWidth = canonicalTransform.worldWidth;
  const canonicalTransformHeight = canonicalTransform.worldHeight;
  const rawFocusRect = {
    left: focus.x - canonicalTransformWidth / 2,
    right: focus.x + canonicalTransformWidth / 2,
    top: focus.y - canonicalTransformHeight / 2,
    bottom: focus.y + canonicalTransformHeight / 2
  };
  const projection = huntPresentationViewport({
    viewportWidth, viewportHeight,
    canonicalCamera: mode === 'wide' ? rawFocusRect : runtime.getCamera(viewportWidth, viewportHeight),
    referenceWidth: mode === 'wide' ? referenceWidth : null,
    worldWidthPx: runtime.world.worldWidthPx, worldHeightPx: runtime.world.worldHeightPx
  });
  const rect = projection.visibleMapRect;
  const chunkWindow = rect ? computeVisibleChunkWindow(runtime.world.definition, {
    centerX: (rect.left + rect.right) / 2, centerY: (rect.top + rect.bottom) / 2,
    viewportWidth: rect.right - rect.left, viewportHeight: rect.bottom - rect.top
  }) : null;
  const visibleChunks = [];
  if (chunkWindow) for (let y = chunkWindow.startChunkY; y <= chunkWindow.endChunkY; y++)
    for (let x = chunkWindow.startChunkX; x <= chunkWindow.endChunkX; x++)
      visibleChunks.push(getFieldChunkBounds(runtime.world.definition, { chunkX: x, chunkY: y }));
  return { ...projection, camera, visibleChunks, panRequest: request };
}

// Called by the existing presentation source. Root supplies the actual layout
// contract; no device test, native-height guess or new global gate lives here.
export function createHuntViewportBinding(getLayout = null) {
  const sessions = new WeakMap();
  return Object.freeze({
    read(runtime, viewportWidth, viewportHeight) {
      if (typeof getLayout !== 'function') return null;
      const layout = getLayout({ viewportWidth, viewportHeight });
      if (!layout || !['portrait', 'wide'].includes(layout.mode)
          || ![viewportWidth, viewportHeight, layout.referenceWidth, layout.referenceHeight].every(finiteDimension)
          || layout.mode === 'wide' && layout.referenceWidth > viewportWidth) return null;
      let canonical = sessions.get(runtime);
      if (!canonical) {
        canonical = Object.freeze({ referenceWidth: layout.referenceWidth, referenceHeight: layout.referenceHeight });
        sessions.set(runtime, canonical);
      }
      if (layout.mode === 'wide' && canonical.referenceWidth > viewportWidth) return null;
      const request = Object.freeze({});
      requests.set(request, Object.freeze({ runtime, viewportWidth, viewportHeight, mode: layout.mode, ...canonical }));
      return readHuntPresentationViewport(runtime, request);
    }
  });
}

// App's existing tutorial camera step calls this only after its own checkpoint
// and action checks. It pans the original canonical window, then recomputes
// visibility from the current runtime. It never advances a tutorial itself.
export function panHuntPresentationCamera(runtime, deltaX, deltaY, request, target = null) {
  const entry = getHuntPresentationRequest(request, runtime);
  if (!entry) return null;
  const accepted = runtime.panCamera(deltaX, deltaY, entry.referenceWidth, entry.referenceHeight);
  const viewport = readHuntPresentationViewport(runtime, request);
  return {
    accepted,
    targetVisible: !!target && viewport.containsViewportPoint(viewport.toViewportPoint({ x: target.worldX, y: target.worldY }))
  };
}
