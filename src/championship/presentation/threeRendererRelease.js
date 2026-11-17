// Releasing a Three.js WebGLRenderer completely (memory audit 2026-11-17).
//
// Three.js r185 keeps ONE DFG lookup DataTexture ("DFG_LUT", a 16x16 RG
// half-float table made by WebGLPrograms' getDFGLUT()) for the whole page and
// hands it to every physically based material. Each WebGLRenderer that uploads
// it adds its own 'dispose' listener to that shared texture, and
// renderer.dispose() never removes the listener. Nothing ever disposes the
// page-wide table, so every renderer the game had made stayed reachable from
// it: its WebGL context, canvas, render lists and the DOM around the canvas
// (measured: one old ranch scene, and one battle-select prism with its whole
// menu, per battle).
//
// disposeThreeRenderer() disposes the renderer, loses a private context, and
// then disposes the shared table: every renderer's listener runs once and lets
// go. A renderer still in use uploads the 1 KB table again on its next frame.

import { EventDispatcher } from "../../../node_modules/three/build/three.module.js";

let sharedLut = null;

// The table is not exported: notice it the first time a renderer registers on it.
const WATCH = Symbol.for("championship.threeSharedLutWatch");
const proto = EventDispatcher.prototype;
if (!proto.addEventListener[WATCH]) {
  const add = proto.addEventListener;
  const watched = function addEventListener(type, listener) {
    if (sharedLut === null && type === "dispose" && this?.isDataTexture === true && this.name === "DFG_LUT") sharedLut = this;
    return add.call(this, type, listener);
  };
  watched[WATCH] = true;
  proto.addEventListener = watched;
}

/** Let every renderer drop the page-wide DFG table (each re-uploads it when it next draws). */
export function releaseThreeSharedTextures() {
  try { sharedLut?.dispose(); } catch { /* a renderer that is already gone */ }
}

/** The shared table's listener count (diagnostics and tests). */
export function threeSharedTextureListeners() {
  return sharedLut?._listeners?.dispose?.length ?? 0;
}

/**
 * Dispose a renderer for good. `loseContext` (default) also loses its private
 * WebGL context; pass false for a renderer that borrows another owner's context.
 */
export function disposeThreeRenderer(renderer, { loseContext = true } = {}) {
  if (!renderer) return;
  try { renderer.dispose(); }
  finally {
    try { if (loseContext) renderer.forceContextLoss?.(); }
    finally { releaseThreeSharedTextures(); }
  }
}
