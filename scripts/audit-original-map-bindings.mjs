import { auditOriginalMapBindingsFile } from "./lib/nds-original-map-bindings.mjs";

const romPath = process.argv[2];
if (!romPath) {
  console.error("Usage: node scripts/audit-original-map-bindings.mjs <path-to-YDIJ.nds>");
  process.exitCode = 2;
} else {
  console.log(JSON.stringify(auditOriginalMapBindingsFile(romPath), null, 2));
}
