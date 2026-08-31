const FILE_HEADER_SIZE = 0x10;

function assertRange(bytes, offset, length, label) {
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error(`${label} is outside the source payload.`);
  }
}

function ascii(bytes, offset, length) {
  assertRange(bytes, offset, length, "ASCII field");
  return bytes.subarray(offset, offset + length).toString("ascii").replace(/\0+$/g, "");
}

function align4(value) {
  return (value + 3) & ~3;
}

function validateNitroHeader(bytes, expectedMagic, expectedSection) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Nitro source must be a Buffer.");
  assertRange(bytes, 0, 0x1c, "Nitro header");
  if (ascii(bytes, 0, 4) !== expectedMagic) throw new Error(`Expected ${expectedMagic} source.`);
  if (bytes.readUInt16LE(4) !== 0xfeff || bytes.readUInt16LE(6) !== 1) throw new Error("Unsupported Nitro byte order or version.");
  if (bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt16LE(12) !== FILE_HEADER_SIZE || bytes.readUInt16LE(14) !== 1) {
    throw new Error("Invalid Nitro file header.");
  }
  const sectionOffset = bytes.readUInt32LE(FILE_HEADER_SIZE);
  assertRange(bytes, sectionOffset, 8, `${expectedSection} section`);
  if (ascii(bytes, sectionOffset, 4) !== expectedSection) throw new Error(`Expected ${expectedSection} section.`);
  if (bytes.readUInt32LE(sectionOffset + 4) !== bytes.length - sectionOffset) throw new Error(`${expectedSection} section size mismatch.`);
  return sectionOffset;
}

function readDictionary(bytes, base, datumSize, label) {
  assertRange(bytes, base, 8, `${label} dictionary`);
  const revision = bytes[base];
  const count = bytes[base + 1];
  const size = bytes.readUInt16LE(base + 2);
  if (revision !== 0 || count === 0) throw new Error(`Unsupported ${label} dictionary header.`);
  assertRange(bytes, base, size, `${label} dictionary`);
  const namesOffset = base + size - count * 16;
  const dataOffset = namesOffset - count * datumSize;
  if (dataOffset < base + 8) throw new Error(`Invalid ${label} dictionary layout.`);
  const names = Array.from({ length: count }, (_, index) => ascii(bytes, namesOffset + index * 16, 16));
  if (names.some((name) => !name)) throw new Error(`${label} dictionary contains an empty name.`);
  return { count, size, dataOffset, namesOffset, names };
}

function readSingleAnimationOffset(bytes, sectionOffset, expectedName) {
  const dictionary = readDictionary(bytes, sectionOffset + 8, 4, "top-level animation");
  if (dictionary.count !== 1 || dictionary.names[0] !== expectedName) {
    throw new Error(`Expected one animation named ${expectedName}.`);
  }
  const relativeOffset = bytes.readUInt32LE(dictionary.dataOffset);
  const animationOffset = sectionOffset + relativeOffset;
  assertRange(bytes, animationOffset, 12, `${expectedName} animation`);
  return animationOffset;
}

function color1555(value) {
  const expand = (channel) => Math.round((channel / 31) * 255);
  return {
    encoded: value,
    rgb8: [expand(value & 0x1f), expand((value >>> 5) & 0x1f), expand((value >>> 10) & 0x1f)]
  };
}

function toRuns(values) {
  const runs = [];
  let start = 0;
  for (let index = 1; index <= values.length; index += 1) {
    if (values[index] !== values[start]) {
      runs.push({ startFrame: start, endFrame: index - 1, value: values[start] });
      start = index;
    }
  }
  return runs;
}

export function decodeNsbva(bytes, nodeNames) {
  const sectionOffset = validateNitroHeader(bytes, "BVA0", "VIS0");
  const animationOffset = readSingleAnimationOffset(bytes, sectionOffset, "hypereffect");
  if (ascii(bytes, animationOffset, 4) !== "V\0AV") throw new Error("Unsupported VIS0 animation signature.");
  const frameCount = bytes.readUInt16LE(animationOffset + 4);
  const nodeCount = bytes.readUInt16LE(animationOffset + 6);
  const animationSize = bytes.readUInt32LE(animationOffset + 8);
  const packedLength = Math.ceil((frameCount * nodeCount) / 8);
  if (animationSize !== align4(12 + packedLength)) throw new Error("VIS0 packed visibility length mismatch.");
  assertRange(bytes, animationOffset, animationSize, "VIS0 animation payload");
  if (!Array.isArray(nodeNames) || nodeNames.length !== nodeCount || new Set(nodeNames).size !== nodeCount) {
    throw new Error(`VIS0 requires ${nodeCount} unique model node names.`);
  }

  const packed = bytes.subarray(animationOffset + 12, animationOffset + 12 + packedLength);
  const frames = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    let bits = "";
    for (let node = 0; node < nodeCount; node += 1) {
      const bit = frame * nodeCount + node;
      bits += String((packed[bit >>> 3] >>> (bit & 7)) & 1);
    }
    frames.push(bits);
  }
  return {
    schemaVersion: 1,
    kind: "nitro-visibility-animation",
    sourceFormat: "NSBVA_VIS0",
    animationName: "hypereffect",
    frameCount,
    nodeCount,
    timebase: { unit: "sourceFrame", frameRateHz: null, status: "CALLER_TIMING_UNRESOLVED" },
    packing: "FRAME_MAJOR_NODE_MAJOR_LSB_FIRST",
    nodeNames,
    frames
  };
}

function decodeDescriptor(bytes, animationOffset, descriptor, channelName, frameCount) {
  const constant = (descriptor & 0x20000000) !== 0;
  const sampleCount = (descriptor >>> 16) & 0x1fff;
  const unsupportedFlags = descriptor & 0xc0000000;
  if (unsupportedFlags !== 0 || sampleCount !== frameCount) throw new Error(`Unsupported ${channelName} descriptor 0x${descriptor.toString(16)}.`);
  const valueOrOffset = descriptor & 0xffff;
  if (constant) {
    return channelName === "polygonAlpha"
      ? { storage: "constant", value: valueOrOffset, denominator: 31 }
      : { storage: "constant", ...color1555(valueOrOffset) };
  }

  const bytesPerSample = channelName === "polygonAlpha" ? 1 : 2;
  const dataOffset = animationOffset + valueOrOffset;
  assertRange(bytes, dataOffset, sampleCount * bytesPerSample, `${channelName} samples`);
  const values = Array.from({ length: sampleCount }, (_, index) => (
    bytesPerSample === 1 ? bytes[dataOffset + index] : bytes.readUInt16LE(dataOffset + index * 2)
  ));
  if (channelName === "polygonAlpha") {
    if (values.some((value) => value > 31)) throw new Error("Polygon alpha sample exceeds the Nitro 0..31 range.");
    return { storage: "runs", denominator: 31, runs: toRuns(values) };
  }
  return { storage: "samples", values: values.map(color1555) };
}

export function decodeNsbma(bytes) {
  const sectionOffset = validateNitroHeader(bytes, "BMA0", "MAT0");
  const animationOffset = readSingleAnimationOffset(bytes, sectionOffset, "spark");
  if (ascii(bytes, animationOffset, 4) !== "M\0AM") throw new Error("Unsupported MAT0 animation signature.");
  const frameCount = bytes.readUInt16LE(animationOffset + 4);
  if (bytes.readUInt16LE(animationOffset + 6) !== 0) throw new Error("Unsupported MAT0 header flags.");
  const dictionary = readDictionary(bytes, animationOffset + 8, 20, "material animation");
  const channelNames = ["diffuse", "ambient", "specular", "emission", "polygonAlpha"];
  const tracks = dictionary.names.map((materialName, trackIndex) => {
    const entryOffset = dictionary.dataOffset + trackIndex * 20;
    const channels = Object.fromEntries(channelNames.map((channelName, channelIndex) => {
      const descriptor = bytes.readUInt32LE(entryOffset + channelIndex * 4);
      return [channelName, decodeDescriptor(bytes, animationOffset, descriptor, channelName, frameCount)];
    }));
    return { materialName, channels };
  });
  return {
    schemaVersion: 1,
    kind: "nitro-material-color-animation",
    sourceFormat: "NSBMA_MAT0",
    animationName: "spark",
    frameCount,
    timebase: { unit: "sourceFrame", frameRateHz: null, status: "CALLER_TIMING_UNRESOLVED" },
    tracks
  };
}
