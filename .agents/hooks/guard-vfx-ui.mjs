#!/usr/bin/env node
/**
 * Antigravity PreToolUse Deterministic Guard for Championship 2026.
 *
 * Enforces hard engineering red lines from AGENTS.md before file edits execute:
 *   1. Under `src/championship/presentation/vfx/`:
 *      Blocks newly added `setTimeout(`, `setInterval(`, or `requestAnimationFrame(`.
 *   2. Under `src/championship/app/**\/*.css`:
 *      - Blocks `backdrop-filter` / `-webkit-backdrop-filter` with any non-`none` value.
 *      - Blocks unauthorized edits touching `#cm-title` (title zero-diff gate),
 *        unless `ALLOW_TITLE_STYLE_EDIT=1` is explicitly set.
 *
 * Contract: reads Antigravity PreToolUse JSON on stdin, writes JSON decision on stdout.
 */
import fs from "node:fs";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function normalizePath(p) {
  return String(p || "").replaceAll("\\", "/");
}

function stripJsComments(code) {
  return String(code || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function stripCssComments(css) {
  return String(css || "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractAddedLines(targetText, replacementText) {
  const beforeLines = new Set(
    String(targetText || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  );
  return String(replacementText || "")
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return t.length > 0 && !beforeLines.has(t);
    })
    .join("\n");
}

function collectPayloads(args) {
  if (!args || typeof args !== "object") return [];
  const path = normalizePath(args.Path ?? args.path ?? args.TargetFile ?? args.target_file ?? "");
  if (!path) return [];

  // Single write_file / write_to_file
  const content = args.Content ?? args.content ?? args.CodeContent ?? null;
  if (typeof content === "string") {
    return [{ path, target: "", replacement: content, isWrite: true }];
  }

  // Single edit_file / replace_file_content
  const replacement = args.Replacement ?? args.replacement ?? args.ReplacementContent ?? null;
  if (typeof replacement === "string") {
    const target = args.Target ?? args.target ?? args.TargetContent ?? "";
    return [{ path, target, replacement, isWrite: false }];
  }

  // Multi-chunk edits
  const chunks = args.ReplacementChunks ?? args.edits ?? null;
  if (Array.isArray(chunks)) {
    return chunks.map((c) => ({
      path,
      target: String(c?.TargetContent ?? c?.target ?? ""),
      replacement: String(c?.ReplacementContent ?? c?.replacement ?? ""),
      isWrite: false
    }));
  }

  return [];
}

function checkVfxRules(entry) {
  const { path, target, replacement, isWrite } = entry;
  if (!/(?:^|\/)src\/championship\/presentation\/vfx\/.+\.(?:m?js|ts)$/i.test(path)) {
    return null;
  }
  const cleanBefore = stripJsComments(target);
  const cleanAfter = stripJsComments(replacement);
  const candidate = isWrite ? cleanAfter : extractAddedLines(cleanBefore, cleanAfter);

  const forbidden = /(?:^|[^\w$])(?:(?:globalThis|window)\s*\.\s*)?(setTimeout|setInterval|requestAnimationFrame)\s*\(/g;
  const hits = [...candidate.matchAll(forbidden)].map((m) => m[1]);
  if (hits.length > 0) {
    const unique = [...new Set(hits)].join(", ");
    return (
      `[VFX_REDLINE_BLOCK] 禁止在 ${path} 新增 ${unique}()。` +
      `請改由單一 PixiJS app.ticker 傳入的 dtMs（或 kit 內部 ticker 排程器）驅動，以確保支援 0.25x 慢動作、視覺頓幀與零洩漏銷毀。`
    );
  }
  return null;
}

function checkCssRules(entry) {
  const { path, target, replacement, isWrite } = entry;
  if (!/(?:^|\/)src\/championship\/app\/.+\.css$/i.test(path)) {
    return null;
  }

  const cleanBefore = stripCssComments(target);
  const cleanAfter = stripCssComments(replacement);
  const added = isWrite ? cleanAfter : extractAddedLines(cleanBefore, cleanAfter);

  // Rule 2a: forbid non-`none` backdrop-filter / -webkit-backdrop-filter
  const backdropRe = /(?:^|[;{\s])(?:-webkit-)?backdrop-filter\s*:\s*([^;}\n]+)/gi;
  for (const match of added.matchAll(backdropRe)) {
    const val = match[1].replace(/!important/gi, "").trim().toLowerCase();
    if (val && val !== "none" && val !== "initial" && val !== "unset") {
      return (
        `[UI_REDLINE_BLOCK] 禁止在 ${path} 新增 backdrop-filter: ${match[1].trim()}。` +
        `行動端 PixiJS 即時畫布上使用 backdrop-filter 會觸發 GPU read-back 導致嚴重掉幀（參見 tokens.css 與 arcade.css）。`
      );
    }
  }

  // Rule 2b: forbid unauthorized edits touching #cm-title (Title Zero-Diff)
  if (process.env.ALLOW_TITLE_STYLE_EDIT !== "1") {
    const titleRe = /#cm-title\b/i;
    if (titleRe.test(cleanBefore) || titleRe.test(cleanAfter)) {
      return (
        `[UI_REDLINE_BLOCK] 禁止未授權修改 ${path} 中涉及 #cm-title 的樣式（Title Zero-Diff 保護）。` +
        `#cm-title 標題與開場畫面維持 live main 原樣；若經 Owner 明確授權，請設定 ALLOW_TITLE_STYLE_EDIT=1。`
      );
    }
  }

  return null;
}

function main() {
  const raw = readStdin().trim();
  if (!raw) {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
    return;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
    return;
  }

  const args = payload?.toolCall?.args ?? {};
  const entries = collectPayloads(args);
  for (const entry of entries) {
    const vfxReason = checkVfxRules(entry);
    if (vfxReason) {
      process.stdout.write(JSON.stringify({ decision: "deny", reason: vfxReason }));
      return;
    }
    const cssReason = checkCssRules(entry);
    if (cssReason) {
      process.stdout.write(JSON.stringify({ decision: "deny", reason: cssReason }));
      return;
    }
  }

  process.stdout.write(JSON.stringify({ decision: "allow" }));
}

main();
