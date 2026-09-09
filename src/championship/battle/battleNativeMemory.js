// Per-invocation VM object memory, not a store or save authority. Address aliases
// must agree: actor+24/offset0 and actor/offset24 refer to the same four bytes.
export function createBattleNativeMemory() {
  const bytes = new Map();
  function address(base, offset) {
    const at = base + offset;
    if (!Number.isSafeInteger(at) || at < 0 || at > 0xfffffffc) throw new Error('BATTLE_NATIVE_MEMORY_ADDRESS');
    return at;
  }
  function read(base, offset, size) {
    const at = address(base, offset);
    let result = 0;
    for (let i = 0; i < size; i++) result |= (bytes.get(at + i) ?? 0) << (i * 8);
    return result >>> 0;
  }
  function write(base, offset, value, size) {
    const at = address(base, offset);
    for (let i = 0; i < size; i++) bytes.set(at + i, (value >>> (i * 8)) & 255);
  }
  return Object.freeze({
    readU32: (base, offset) => read(base, offset, 4),
    readU16: (base, offset) => read(base, offset, 2),
    readS16: (base, offset) => (read(base, offset, 2) << 16) >> 16,
    readU8: (base, offset) => read(base, offset, 1),
    writeU32: (base, offset, value) => write(base, offset, value, 4),
    writeU16: (base, offset, value) => write(base, offset, value, 2),
    writeU8: (base, offset, value) => write(base, offset, value, 1)
  });
}
