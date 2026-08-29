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
      tileIndex: raw & 0x3fff,
      horizontalFlip: Boolean(raw & 0x4000),
      verticalFlip: Boolean(raw & 0x8000),
    });
  });
  return Object.freeze({
    format: "YDIJ_NBSR_DIRECT14_TILEMAP_V2",
    version,
    width,
    height,
    layerCount,
    tileEntrySemantics: "DIRECT_14_BIT_TILE_INDEX_PLUS_HIGH_2_FLIP_FLAGS",
    cells: Object.freeze(cells),
  });
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
    const rawCellWord = dataView.getUint16(offset, true);
    return Object.freeze({
      ordinal,
      rawCellWord,
      cellId: rawCellWord & 0x3fff,
      horizontalFlip: Boolean(rawCellWord & 0x8000),
      verticalFlip: Boolean(rawCellWord & 0x4000),
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

export function parseOriginalCageBsar(input) {
  const { data, dataView } = view(input);
  expectMagic(data, "BSAR", "BSAR");
  const version = dataView.getUint32(4, true);
  const unknownHeaderWord0 = dataView.getUint32(8, true);
  const frameCount = dataView.getUint32(12, true);
  const unknownHeaderWord2 = dataView.getUint32(16, true);
  if (version !== 2 || frameCount < 1) throw new RangeError(`Unsupported BSAR version/frame count ${version}/${frameCount}`);
  let cursor = 20;
  const frameDurationsRawTicks = Array.from({ length: frameCount }, () => {
    const value = dataView.getUint32(cursor, true);
    cursor += 4;
    return value;
  });
  const width = dataView.getUint32(cursor, true);
  const height = dataView.getUint32(cursor + 4, true);
  cursor += 8;
  const gridSymbols = Array.from({ length: width * height }, () => {
    const value = dataView.getUint16(cursor, true);
    cursor += 2;
    return value;
  });
  const symbolCount = dataView.getUint32(cursor, true);
  cursor += 4;
  expectLength(data, cursor + symbolCount * frameCount * 2, "BSAR");
  if (gridSymbols.some((symbol) => symbol >= symbolCount)) throw new RangeError("BSAR grid symbol is out of range");
  const symbols = Array.from({ length: symbolCount }, (_, symbolIndex) => Object.freeze({
    symbolIndex,
    frameTileEntries: Object.freeze(Array.from({ length: frameCount }, () => {
      const raw = dataView.getUint16(cursor, true);
      cursor += 2;
      return Object.freeze({
        raw,
        tileIndex: raw & 0x03ff,
        horizontalFlip: Boolean(raw & 0x0400),
        verticalFlip: Boolean(raw & 0x0800),
        paletteBank: (raw >>> 12) & 0x0f,
      });
    })),
  }));
  return Object.freeze({
    format: "YDIJ_BSAR_ANIMATED_TILEMAP_V2",
    version,
    unknownHeaderWord0,
    frameCount,
    unknownHeaderWord2,
    frameDurationsRawTicks: Object.freeze(frameDurationsRawTicks),
    timingSemantics: "RAW_TICKS_PRESERVED_NO_RATE_INFERENCE",
    width,
    height,
    gridSymbols: Object.freeze(gridSymbols),
    symbolCount,
    symbols: Object.freeze(symbols),
  });
}
