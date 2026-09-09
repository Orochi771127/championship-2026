import { execFileSync } from "node:child_process";
import test from "node:test";

test("licensed ROM-derived VFX conversion bundle is complete and quarantines legal evidence", () => {
  execFileSync(process.execPath, ["scripts/validate-licensed-vfx-conversion-v1.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe"
  });
});
