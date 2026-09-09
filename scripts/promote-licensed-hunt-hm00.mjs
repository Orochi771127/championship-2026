// Deprecated wrapper. The Hunt tutorial field now ships inside the 30-field runtime bundle.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "promote-licensed-hunt-runtime.mjs");
const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
process.exit(result.status ?? 1);
