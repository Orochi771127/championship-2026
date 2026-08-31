import crypto from "node:crypto";
import fs from "node:fs";

export const CHAMPIONSHIP_ROM_SHA256 = "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1";

function u32(data, offset) {
  return data.readUInt32LE(offset);
}

function arm9FromRom(rom) {
  if (!Buffer.isBuffer(rom) || rom.length < 0x200) throw new TypeError("NDS ROM buffer required");
  const romOffset = u32(rom, 0x20);
  const ramAddress = u32(rom, 0x28);
  const byteLength = u32(rom, 0x2c);
  if (romOffset < 0x200 || byteLength === 0 || romOffset + byteLength > rom.length) {
    throw new RangeError("Invalid ARM9 bounds in NDS header");
  }
  return { data: rom.subarray(romOffset, romOffset + byteLength), ramAddress };
}

function readAsciiPointer(arm9, pointer, maximumLength = 96) {
  const offset = pointer - arm9.ramAddress;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= arm9.data.length) return null;
  const endLimit = Math.min(arm9.data.length, offset + maximumLength);
  let end = offset;
  while (end < endLimit && arm9.data[end] !== 0) {
    const byte = arm9.data[end];
    if (byte < 0x20 || byte > 0x7e) return null;
    end += 1;
  }
  if (end === offset || end === endLimit) return null;
  return arm9.data.toString("ascii", offset, end);
}

export function auditOriginalMapBindingsFromRom(rom) {
  const digest = crypto.createHash("sha256").update(rom).digest("hex").toUpperCase();
  if (digest !== CHAMPIONSHIP_ROM_SHA256) {
    throw new Error(`CHAMPIONSHIP_ROM_SHA256_MISMATCH: ${digest}`);
  }
  const arm9 = arm9FromRom(rom);
  const hunt = [];
  const cagePointers = [];

  for (let offset = 0; offset <= arm9.data.length - 12; offset += 4) {
    const first = u32(arm9.data, offset);
    const second = u32(arm9.data, offset + 4);
    const third = u32(arm9.data, offset + 8);
    const firstString = readAsciiPointer(arm9, first);
    const secondString = readAsciiPointer(arm9, second);
    const thirdString = readAsciiPointer(arm9, third);

    if (secondString?.startsWith("HUNT_") && thirdString?.startsWith("field_hm")) {
      hunt.push(Object.freeze({
        recordAddress: `0x${(arm9.ramAddress + offset).toString(16).toUpperCase().padStart(8, "0")}`,
        rawKey: first,
        huntId: secondString,
        fieldId: thirdString
      }));
    }
    if (firstString?.startsWith("field_cm")) {
      cagePointers.push(Object.freeze({
        recordAddress: arm9.ramAddress + offset,
        fieldId: firstString
      }));
    }
  }

  // The original Cage visual table is one contiguous 0x28-byte record family.
  // Other isolated field_cm pointers are not accepted as CageDefinition binds.
  const cageRuns = [];
  let run = [];
  for (const record of cagePointers) {
    if (run.length === 0 || record.recordAddress - run.at(-1).recordAddress === 0x28) run.push(record);
    else {
      cageRuns.push(run);
      run = [record];
    }
  }
  if (run.length) cageRuns.push(run);
  const cage = cageRuns.sort((a, b) => b.length - a.length)[0] ?? [];

  if (hunt.length !== 33) throw new Error(`ORIGINAL_HUNT_RECORD_COUNT_MISMATCH: ${hunt.length}`);
  if (cage.length !== 37) throw new Error(`ORIGINAL_CAGE_VISUAL_RECORD_COUNT_MISMATCH: ${cage.length}`);

  return Object.freeze({
    romSha256: digest,
    romGameCode: rom.toString("ascii", 0x0c, 0x10),
    arm9: Object.freeze({
      ramAddress: `0x${arm9.ramAddress.toString(16).toUpperCase().padStart(8, "0")}`,
      byteLength: arm9.data.length
    }),
    huntRecords: Object.freeze(hunt),
    cageVisualRecords: Object.freeze(cage.map((entry, recordIndex) => Object.freeze({
      recordIndex,
      recordAddress: `0x${entry.recordAddress.toString(16).toUpperCase().padStart(8, "0")}`,
      fieldId: entry.fieldId
    })))
  });
}

export function auditOriginalMapBindingsFile(romPath) {
  return auditOriginalMapBindingsFromRom(fs.readFileSync(romPath));
}
