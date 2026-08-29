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
    const rawSequenceWord = dataView.getUint16(offset, true);
    return Object.freeze({
      ordinal,
      rawSequenceWord,
      sequenceId: rawSequenceWord & 0x3fff,
      horizontalFlip: Boolean(rawSequenceWord & 0x8000),
      verticalFlip: Boolean(rawSequenceWord & 0x4000),
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

export function parseOriginalCageNanr(input) {
  const { data, dataView } = view(input);
  expectMagic(data, "RNAN", "NANR");
  if (decoder.decode(data.subarray(16, 20)) !== "KNBA" || data.length < 48) {
    throw new RangeError("Unsupported NANR animation bank");
  }
  const base = 24;
  const sequenceCount = dataView.getUint16(base, true);
  const totalFrameCount = dataView.getUint16(base + 2, true);
  const sequenceTableOffset = dataView.getUint32(base + 4, true);
  const frameTableOffset = dataView.getUint32(base + 8, true);
  const resultTableOffset = dataView.getUint32(base + 12, true);
  let parsedFrameCount = 0;
  const sequences = Array.from({ length: sequenceCount }, (_, sequenceId) => {
    const offset = base + sequenceTableOffset + sequenceId * 16;
    if (offset + 16 > data.length) throw new RangeError("NANR sequence table exceeds payload");
    const frameCount = dataView.getUint16(offset, true);
    const loopStartFrame = dataView.getUint16(offset + 2, true);
    const rawWordA = dataView.getUint32(offset + 4, true);
    const rawWordB = dataView.getUint32(offset + 8, true);
    const relativeFrameOffset = dataView.getUint32(offset + 12, true);
    if (frameCount < 1) throw new RangeError("NANR sequence has no frames");
    const frames = Array.from({ length: frameCount }, (_, frameIndex) => {
      const frameOffset = base + frameTableOffset + relativeFrameOffset + frameIndex * 8;
      if (frameOffset + 8 > data.length) throw new RangeError("NANR frame table exceeds payload");
      const relativeResultOffset = dataView.getUint32(frameOffset, true);
      const rawDurationTicks = dataView.getUint16(frameOffset + 4, true);
      const rawMarker = dataView.getUint16(frameOffset + 6, true);
      const resultOffset = base + resultTableOffset + relativeResultOffset;
      if (rawMarker !== 0xbeef || resultOffset + 2 > data.length) {
        throw new RangeError("NANR result/marker mismatch");
      }
      parsedFrameCount += 1;
      return Object.freeze({
        frameIndex,
        cellId: dataView.getUint16(resultOffset, true),
        rawDurationTicks,
        rawMarker,
        relativeResultOffset,
      });
    });
    return Object.freeze({
      sequenceId,
      frameCount,
      loopStartFrame,
      rawWordA,
      rawWordB,
      relativeFrameOffset,
      frames: Object.freeze(frames),
    });
  });
  if (parsedFrameCount !== totalFrameCount) throw new RangeError("NANR total frame count mismatch");
  return Object.freeze({
    format: "YDIJ_NANR_SEQUENCE_BANK",
    sequenceCount,
    totalFrameCount,
    sequenceTableOffset,
    frameTableOffset,
    resultTableOffset,
    timingSemantics: "RAW_TICKS_PRESERVED_NO_RATE_INFERENCE",
    bindingSemantics: "OPMD_LOW14_SELECTS_NANR_SEQUENCE_THEN_NANR_FRAME_SELECTS_NCER_CELL",
    sequences: Object.freeze(sequences),
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
