// Synchronous ownership boundary. Restore exact Pixi unpack state even on
// constructor/upload/draw failure; resetState alone does not restore pixelStore.
export function withSharedUnpackState(gl, callback) {
  const defaults = {
    UNPACK_ALIGNMENT: 4, UNPACK_FLIP_Y_WEBGL: false,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: false,
    UNPACK_COLORSPACE_CONVERSION_WEBGL: gl.NONE,
    UNPACK_ROW_LENGTH: 0, UNPACK_IMAGE_HEIGHT: 0,
    UNPACK_SKIP_PIXELS: 0, UNPACK_SKIP_ROWS: 0, UNPACK_SKIP_IMAGES: 0
  };
  if (typeof gl.getParameter !== 'function' || typeof gl.pixelStorei !== 'function')
    throw new Error('HUNT_SHARED_UNPACK_STATE_UNAVAILABLE');
  const previous = [];
  try {
    for (const [name, value] of Object.entries(defaults)) {
      if (gl[name] === undefined) continue;
      previous.push([gl[name], gl.getParameter(gl[name])]);
      gl.pixelStorei(gl[name], value);
    }
    const result = callback();
    if (result?.then) throw new Error('HUNT_SHARED_GL_BOUNDARY_MUST_BE_SYNCHRONOUS');
    return result;
  } finally {
    for (const [name, value] of previous.reverse()) gl.pixelStorei(name, value);
  }
}
