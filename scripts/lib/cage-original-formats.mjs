const decoder = new TextDecoder("ascii");

function bytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("Expected ArrayBuffer or Uint8Array");
}

function view(input) {
  const data = bytes(input);
  return { data, dataView: new DataView(data.buffer, data.byteOffset, data.byteLength) };
}

function expectLength(data, expected, label) {
  if (data.length !== expected) throw new RangeError(`${label} length ${data.length} != ${expected}`);
}

function expectMagic(data, expected, label) {
  const actual = decoder.decode(data.subarray(0, 4));
  if (actual !== expected) throw new RangeError(`${label} magic ${actual} != ${expected}`);
}

export function parseOriginalCageCol(input) {
  const data = bytes(input);
  if (data.length < 3 || data[0] !== 1) throw new RangeError("Unsupported YDIJ COL header");
  const width = data[1];
  const height = data[2];
  expectLength(data, 3 + width * height, "COL");
  return Object.freeze({
    format: "YDIJ_COL_RAW_V1",
    version: data[0],
    width,
    height,
    cells: data.slice(3),
    classSemantics: "RAW_CLASS_XX_NOT_REINTERPRETED",
  });
}

export function parseOriginalCageAtr(input) {
  const { data, dataView } = view(input);
  expectMagic(data, "DATR", "ATR");
  const version = dataView.getUint32(4, true);
  const width = dataView.getUint32(8, true);
  const height = dataView.getUint32(12, true);
  expectLength(data, 16 + width * height, "ATR");
  return Object.freeze({
    format: "YDIJ_DATR_RAW_V2",
    version,
    width,
    height,
    cells: data.slice(16),
    classSemantics: "RAW_CLASS_XX_NOT_REINTERPRETED",
  });
}

export function parseOriginalCageNbs(input) {
  const { data, dataView } = view(input);
  expectMagic(data, "NBSR", "NBS");
  const version = dataView.getUint32(4, true);
  const width = dataView.getUint32(8, true);
  const height = dataView.getUint32(12, true);
  const layerCount = dataView.getUint32(16, true);
  expectLength(data, 20 + width * height * 2, "NBS");
  const cells = Array.from({ length: width * height }, (_, index) => {
    const raw = dataView.getUint16(20 + index * 2, true);
    return Object.freeze({
      raw,
      tileIndex: raw & 0x03ff,
      horizontalFlip: Boolean(raw & 0x0400),
      verticalFlip: Boolean(raw & 0x0800),
      paletteBank: (raw >>> 12) & 0x0f,
    });
  });
  return Object.freeze({ format: "YDIJ_NBSR_TILEMAP_V2", version, width, height, layerCount, cells: Object.freeze(cells) });
}

export function parseOriginalCageOpm(input) {
  const { data, dataView } = view(input);
  expectMagic(data, "OPMD", "OPM");
  const version = dataView.getUint32(4, true);
  const nameLength = data[8];
  const bundleName = decoder.decode(data.subarray(9, 9 + nameLength));
  let cursor = (9 + nameLength + 1 + 3) & ~3;
  const placementCount = dataView.getUint32(cursor, true);
  cursor += 4;
  if (version !== 4) throw new RangeError(`Unsupported OPM version ${version}`);
  expectLength(data, cursor + placementCount * 16, "OPM");
  const placements = Array.from({ length: placementCount }, (_, ordinal) => {
    const offset = cursor + ordinal * 16;
    return Object.freeze({
      ordinal,
      cellId: dataView.getUint16(offset, true),
      sourceX: dataView.getUint16(offset + 2, true),
      sourceY: dataView.getUint16(offset + 4, true),
      rawFlags: dataView.getUint16(offset + 6, true),
      rawFloatA: dataView.getFloat32(offset + 8, true),
      rawFloatB: dataView.getFloat32(offset + 12, true),
      coordinateAuthority: "VERIFIED_SOURCE_REFERENCE_COORDINATES",
    });
  });
  return Object.freeze({
    format: "YDIJ_OPMD_RAW_V1",
    version,
    bundleName,
    placementCount,
    placements: Object.freeze(placements),
    placementSemantics: "SOURCE_ORDER_AND_COORDINATES_PRESERVED_NO_VISUAL_RELAYOUT",
  });
}
