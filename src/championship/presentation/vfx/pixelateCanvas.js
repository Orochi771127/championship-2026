// Pixel look for generated effect textures (OWNER_APPROVED_ADAPTATION 2026-11-05,
// MOVE_VFX_KIT_20261105: the AI battle keeps its sequence cells, so its
// dressing -- glows, dust, marks, storms -- is drawn in the same pixel style
// instead of smooth gradients beside 4x pixel cells).
//
// The canvas keeps its size: each `block` square takes its average colour, its
// alpha is stepped to `levels`, and faint blocks drop out (block 1 = stepped
// bands only). Textures made from it should sample `nearest`.

/** Pixelate a 2D canvas in place; returns it. A canvas without pixel access is returned untouched. */
export function pixelateCanvas(canvas, {block = 4, levels = 4, floor = 0.1} = {}) {
  const context = canvas?.getContext?.('2d');
  if (!context?.getImageData || !context.putImageData) return canvas;
  const {width, height} = canvas;
  const image = context.getImageData(0, 0, width, height), data = image.data;
  for (let by = 0; by < height; by += block) for (let bx = 0; bx < width; bx += block) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = by; y < Math.min(height, by + block); y++) for (let x = bx; x < Math.min(width, bx + block); x++) {
      const i = (y * width + x) * 4, w = data[i + 3];
      r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; a += w; n++;
    }
    const alpha = a / n / 255, stepped = alpha < floor ? 0 : Math.ceil(alpha * levels) / levels;
    const [cr, cg, cb] = a ? [r / a, g / a, b / a] : [0, 0, 0];
    for (let y = by; y < Math.min(height, by + block); y++) for (let x = bx; x < Math.min(width, bx + block); x++) {
      const i = (y * width + x) * 4;
      data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = Math.round(stepped * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
