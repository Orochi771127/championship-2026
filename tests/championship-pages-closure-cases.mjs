import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { auditPagesModuleClosure } from "../scripts/lib/pages-module-closure.mjs";

test("Pages detects removed transitive modules with import attributes and re-exports before publishing", () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"championship-pages-closure-"));
  fs.mkdirSync(path.join(root,"src"));
  fs.writeFileSync(path.join(root,"src/main.js"),'// import "fake-comment";\nimport data from "./data.json" with {type:"json"};\nexport {x} from "./child.js";');
  fs.writeFileSync(path.join(root,"src/data.json"),'{}');
  fs.writeFileSync(path.join(root,"src/child.js"),'export {x} from "./private.js";');
  const files=["src/main.js","src/data.json","src/child.js"];
  const audit=auditPagesModuleClosure({root,files,entries:["src/main.js"]});
  assert.deepEqual(audit.issues,[{kind:"EXCLUDED_DEPENDENCY",file:"src/child.js",specifier:"./private.js",target:"src/private.js"}]);
  fs.writeFileSync(path.join(root,"src/private.js"),'export const x=1;');
  assert.deepEqual(auditPagesModuleClosure({root,files:[...files,"src/private.js"],entries:["src/main.js"]}).issues,[]);
  // Only these newly created files are removed; no recursive path operation.
  for(const file of [...files,"src/private.js"])fs.unlinkSync(path.join(root,file));
  fs.rmdirSync(path.join(root,"src"));fs.rmdirSync(root);
});
