import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Parse without linking or executing product modules. Node's ESM parser handles
// comments, re-exports and JSON import attributes; a regex is not a JS parser.
const parser = `import vm from 'node:vm';
let input='';for await(const chunk of process.stdin)input+=chunk;
const results=JSON.parse(input).map(({file,source})=>{
  try{return {file,imports:new vm.SourceTextModule(source).dependencySpecifiers};}
  catch(error){return {file,error:error.message};}
});process.stdout.write(JSON.stringify(results));`;

export function auditPagesModuleClosure({ root, files, entries, importMap = {} }) {
  const available = new Set(files), visited = new Set(), issues = [];
  let pending = [...entries];
  const resolve = (from, specifier) => {
    const mapped = importMap[specifier] ?? specifier;
    if (!mapped.startsWith(".") && !mapped.startsWith("/")) return null;
    const base = Object.hasOwn(importMap, specifier) ? "" : path.posix.dirname(from);
    const result = path.posix.normalize(path.posix.join(base, mapped)).split(/[?#]/)[0];
    return result.startsWith("../") || result.startsWith("/") ? null : result;
  };
  while (pending.length) {
    const sources = [];
    for (const file of new Set(pending)) {
      if (visited.has(file)) continue;
      visited.add(file);
      if (!available.has(file) || !fs.statSync(path.join(root, file), { throwIfNoEntry:false })?.isFile()) {
        issues.push({ kind:"MISSING_MODULE", file }); continue;
      }
      if (/\.(?:m?js)$/.test(file)) sources.push({ file, source:fs.readFileSync(path.join(root, file), "utf8") });
    }
    pending = [];
    if (!sources.length) continue;
    const result = spawnSync(process.execPath, ["--experimental-vm-modules", "--input-type=module", "-e", parser],
      { input:JSON.stringify(sources), encoding:"utf8", maxBuffer:16*1024*1024, windowsHide:true });
    if (result.error || result.status !== 0) throw result.error ?? new Error(`PAGES_MODULE_PARSER_FAILED: ${result.stderr}`);
    for (const row of JSON.parse(result.stdout)) {
      if (row.error) { issues.push({ kind:"INVALID_MODULE", file:row.file, reason:row.error }); continue; }
      for (const specifier of row.imports) {
        const target = resolve(row.file, specifier);
        if (target === null) issues.push({ kind:"UNRESOLVED_IMPORT", file:row.file, specifier });
        else if (!available.has(target)) issues.push({ kind:"EXCLUDED_DEPENDENCY", file:row.file, specifier, target });
        else pending.push(target);
      }
    }
  }
  return { scope:"STATIC_ESM_AND_EXPLICIT_DYNAMIC_ENTRIES", visited:[...visited].sort(), issues };
}

export function assertPagesModuleClosure(args) {
  const audit = auditPagesModuleClosure(args);
  if (audit.issues.length) throw new Error(`PAGES_MODULE_CLOSURE_FAILED (${audit.issues.length}):\n${JSON.stringify(audit.issues, null, 2)}`);
  return audit;
}
