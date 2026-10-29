// Visual review of the reviewed character action art as the game draws it (Owner 2026-10-29: every
// action wired into the game must be checkable by eye). Read-only: it serves this checkout on an
// isolated loopback port (never the Owner's 8732 save) and writes contact sheets under .tmp.
//
// For each playable role, one row per clip, frames placed on their pivot over a ground line:
//   General - every Main/Sub clip a native sequence id reaches, sampled through the shipped reviewed
//             controller (loadPublicCharacterRoster, presentation 'raising', flipBits 0). The ranch draws
//             these moving LEFT, so every drawing must face left. Clips no sequence id reaches are drawn
//             from the manifest with the same mirror policy and labelled as a data preview.
//   Arena   - move, melee and ranged for each heading L R UL UR DL DR, sampled through reviewedArena and drawn
//             with the scene's applyReviewedArenaPoseScale; a cell must face its heading.
// Frames the facing gate reports (scripts/lib/reviewed-action-facing.mjs) are outlined red; accepted
// exceptions are outlined amber. A General frame whose drawn mirror differs from the gate's model of the
// loader is listed as a MODEL_MISMATCH (that would make the gate's verdicts untrustworthy).
//
// usage: node scripts/review-reviewed-actions.mjs [--codes GR38,MA20] [--out .tmp/action-review] [--port 8767]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodeFacingMasks, facingOutliers } from './lib/reviewed-action-facing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const out = path.resolve(root, arg('--out', '.tmp/action-review'));
const port = Number(arg('--port', '8767'));
if (port === 8732) throw Error('ACTION_REVIEW_NEVER_USES_THE_OWNER_PORT');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const selection = read('src/data/championship/reviewed-animation-selection.v1.json').characters.filter((e) => e.playableIdentity !== false);
const maskDoc = read('docs/contracts/championship/REVIEWED_ACTION_FACING_MASKS.v1.json');
const exceptions = read('docs/contracts/championship/REVIEWED_ACTION_FACING_EXCEPTIONS.v1.json').entries;
const masks = decodeFacingMasks(maskDoc);
const wanted = arg('--codes', null)?.split(',');
const roles = wanted ? selection.filter((e) => wanted.includes(e.displayCode)) : selection;
fs.mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], { cwd: root, env: { ...process.env, CHAMPIONSHIP_PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => { server.stdout.on('data', (d) => /listening|http:\/\//i.test(String(d)) && resolve()); server.on('exit', reject); setTimeout(resolve, 4000); });
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHAMPIONSHIP_CHROME ? { executablePath: process.env.CHAMPIONSHIP_CHROME } : { channel: 'chrome' }) });
const summary = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${origin}/championship.html`);
  await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false, null, { timeout: 120000 });
  await page.evaluate(() => { document.body.innerHTML = ''; });
  for (const entry of roles) {
    const manifest = read(entry.path);
    const flagged = facingOutliers({ entry, manifest, roleMasks: masks[entry.displayCode], grid: maskDoc.grid, headings: maskDoc.arenaHeadings });
    const accepted = new Set(exceptions.filter((x) => x.displayCode === entry.displayCode).map((x) => `${x.clip}|${x.frame}`));
    const marks = Object.fromEntries(flagged.map((f) => [`${f.clip}|${f.frame}`, accepted.has(`${f.clip}|${f.frame}`) ? 'accepted' : 'flagged']));
    const result = await page.evaluate(renderRole, { entry, manifest, marks });
    const files = [];
    result.images.forEach((dataUrl, i) => {
      const file = `${entry.displayCode}-${i + 1}.png`; files.push(file);
      fs.writeFileSync(path.join(out, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
    });
    const row = { displayCode: entry.displayCode, name: entry.displayName, files, clips: result.clips, previews: result.previews,
      flagged: flagged.filter((f) => marks[`${f.clip}|${f.frame}`] === 'flagged'), accepted: flagged.filter((f) => marks[`${f.clip}|${f.frame}`] === 'accepted'),
      mismatches: result.mismatches, errors: result.errors };
    summary.push(row);
    console.log(entry.displayCode.padEnd(5), 'clips', result.clips, 'previews', result.previews, 'flagged', row.flagged.length, 'accepted', row.accepted.length,
      'mismatch', result.mismatches.length, result.errors.length ? 'errors ' + result.errors.join('; ') : '');
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ origin, pageErrors: errors, roles: summary }, null, 1));
  fs.writeFileSync(path.join(out, 'index.html'), indexPage(summary));
  console.log('wrote', path.relative(root, path.join(out, 'index.html')), 'roles', summary.length,
    'flagged', summary.reduce((n, r) => n + r.flagged.length, 0), 'mismatches', summary.reduce((n, r) => n + r.mismatches.length, 0), 'pageErrors', errors.length);
} finally {
  await browser.close();
  server.kill();
}

function indexPage(rows) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const body = rows.map((r) => `<section id="${r.displayCode}"><h2>${esc(r.displayCode)} ${esc(r.name ?? '')}
 <small>${r.clips} clips · ${r.flagged.length} flagged · ${r.accepted.length} accepted · ${r.mismatches.length} model mismatches</small></h2>
 ${r.flagged.length ? `<p class="bad">${r.flagged.map((f) => esc(`${f.usage} ${f.action ?? ''} ${f.direction ?? ''} ${f.frame} (${f.drawn} → ${f.mirrored})`)).join('<br>')}</p>` : ''}
 ${r.files.map((f) => `<img src="${f}" loading="lazy" alt="${esc(r.displayCode)} action sheet">`).join('')}</section>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Reviewed action sheets</title>
<style>body{background:#1e2228;color:#e6e6e6;font:14px system-ui;margin:16px}img{max-width:100%;display:block;margin:6px 0}
.bad{color:#ff8a80}small{color:#9aa;font-weight:400}nav a{color:#9cf;margin-right:8px}</style>
<h1>Reviewed action sheets</h1><p>General rows must face LEFT (the ranch mirrors them for right). Arena cells must face their heading.
Red outline: facing gate outlier. Amber: accepted exception. Pivot = tick on the ground line.</p>
<nav>${rows.map((r) => `<a href="#${r.displayCode}">${r.displayCode}${r.flagged.length ? '*' : ''}</a>`).join('')}</nav>${body}`;
}

// Runs in the page. Draws one role and returns PNG data URLs (rows split so no image exceeds ~6,000 px).
async function renderRole({ entry, manifest, marks }) {
  const PIXI = await import('/assets/production/public-runtime/vendor-pixi.mjs');
  const { loadPublicCharacterRoster } = await import('/src/championship/presentation/publicCharacterRoster.js');
  const anim = await import('/src/championship/presentation/reviewedCharacterAnimation.js');
  const arenaRoster = await import('/src/championship/presentation/dataArena/dataArenaRoster.js');
  const scene = await import('/src/championship/presentation/dataArena/dataArenaPixiScene.js');
  globalThis.__reviewApp ??= await (async () => { const app = new PIXI.Application(); await app.init({ width: 64, height: 64, background: '#3a3f47', antialias: false }); return app; })();
  const app = globalThis.__reviewApp, errors = [], mismatches = [], rows = [];
  const frames = Array.isArray(manifest.frames) ? Object.fromEntries(manifest.frames.map(({ id, ...f }) => [id, f])) : manifest.frames;
  const predicted = (id) => (entry.generalMirror === true) !== (entry.generalMirrorFrames ?? []).includes(id);
  const capture = (sprite, assetId, extra = {}) => { const s = new PIXI.Sprite(sprite.texture); s.anchor.copyFrom(sprite.anchor); s.scale.copyFrom(sprite.scale); return { sprite: s, assetId, ...extra }; };

  // General: every clip a native Main id reaches, through the ranch's own path (roster actor with
  // presentation 'raising' -> nativeFramePresenter.apply at flipBits 0). The reviewed clip is sampled
  // at native ticks, so each step is requested at its midpoint as elapsed time on native frame 0.
  const reached = new Map();
  let roster = null;
  try {
    roster = await loadPublicCharacterRoster({ PIXI, speciesIds: [entry.speciesId], sides: ['main'] }, location.href);
    const actor = roster.createActor({ speciesId: entry.speciesId, side: 'main', presentation: 'raising' });
    if (!actor?.nativeFramePresenter) errors.push('NO_RAISING_PRESENTER');
    for (let id = 0; id < 40 && actor?.nativeFramePresenter; id++) {
      const binding = anim.reviewedNumericClip(manifest, 'main', id);
      if (!binding || reached.has(binding.clip.id)) continue;
      reached.set(binding.clip.id, `main ${id}`);
      const clip = binding.clip, cells = [];
      let elapsed = 0;
      for (const step of clip.frames) {
        const ms = elapsed + step.durationMs / 2; elapsed += step.durationMs;
        let sample = null;
        try {
          sample = actor.nativeFramePresenter.apply({ contract: 'HUNT_CHARACTER_PRESENTATION.v1', sequenceId: id, frameIndex: 0,
            elapsedQ12: Math.round(ms * 60 / 1000 * 4096), flipBits: 0, active: true });
        } catch (error) { errors.push(`main${id}: ${String(error.message).slice(0, 60)}`); break; }
        if (!sample?.assetId) { errors.push(`main${id}: native fallback`); break; }
        const mirrored = actor.sprite.texture.rotate === 12;
        if (mirrored !== predicted(sample.assetId)) mismatches.push({ clip: clip.id, frame: sample.assetId, drawn: mirrored, model: predicted(sample.assetId) });
        if (!cells.length || cells.at(-1).assetId !== sample.assetId) cells.push(capture(actor.sprite, sample.assetId));
      }
      rows.push({ title: `ranch main ${id} · ${clip.action ?? ''} · ${clip.id}`, clip: clip.id, cells, kind: 'general' });
    }
  } catch (error) { errors.push('GENERAL ' + String(error.message).slice(0, 120)); }

  // General clips no native id reaches: a data preview with the same mirror policy.
  let previews = 0;
  for (const clip of manifest.clips.filter((c) => (c.mode === 'main' || c.mode === 'sub') && !reached.has(c.id))) {
    const cells = [];
    for (const id of [...new Set(clip.frames.map((s) => s.assetId))]) {
      const f = frames[id], source = (await PIXI.Assets.load(new URL(f.image, new URL(entry.path, location.href)).href)).source;
      const trim = f.trim ?? [0, 0, ...f.sourceSize];
      const texture = new PIXI.Texture({ source, frame: new PIXI.Rectangle(...(f.frame ?? [0, 0, ...f.sourceSize])) });
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set((f.origin[0] - trim[0]) / trim[2], (f.origin[1] - trim[1]) / trim[3]);
      sprite.scale.set((predicted(id) ? -1 : 1) / f.density, 1 / f.density);
      cells.push({ sprite, assetId: id });
    }
    if (cells.length) { previews++; rows.push({ title: `data preview (not a ranch main id) · ${clip.mode} · ${clip.action ?? ''} · ${clip.id}`, clip: clip.id, cells, kind: 'preview' }); }
  }

  // Arena: move and melee per heading through reviewedArena and the scene's pose scale.
  let arenaBundle = null;
  try {
    const bundle = arenaBundle = await arenaRoster.loadDataArenaCharacter({ art: arenaRoster.dataArenaArtRecord(entry.speciesId), PIXI });
    const actor = bundle.createActor({ side: 'main', animation: 0 }), arena = actor.reviewedArena;
    if (!arena) errors.push('NO_REVIEWED_ARENA');
    const headings = { L: [-1, 0], UL: [-1, -1], DL: [-1, 1], R: [1, 0], UR: [1, -1], DR: [1, 1] };
    let t = 0, castId = 1;
    for (const [heading, [x, y]] of arena ? Object.entries(headings) : []) {
      for (const action of ['move', 'melee', 'ranged']) {
        arena.reset(); t += 10;
        const cells = [], seen = new Set(), state = { hp: 100, vx: x * 80, vy: y * 80, facing: x };
        let clipId = null;
        const take = (s) => { if (!s?.assetId) return; clipId ??= s.clipId; if (seen.has(s.assetId)) return; seen.add(s.assetId);
          const sprite = capture(actor.sprite, s.assetId).sprite; scene.applyReviewedArenaPoseScale(sprite, s, 110); cells.push({ sprite, assetId: s.assetId, clip: s.clipId }); };
        if (action === 'move') for (let k = 0; k < 60; k++) take(arena.sample({ time: t + k / 30, ...state }));
        else {
          arena.sample({ time: t, ...state }); const id = castId++, angle = Math.atan2(y, x);
          const moveType = action === 'melee' ? 'MELEE' : 'RANGED';
          arena.observe({ type: 'CAST', actionId: id, t: t + 0.01, angle, moveId: 'review', moveType });
          take(arena.sample({ time: t + 0.02, ...state, castId: id }));
          arena.observe({ type: 'CAST_RELEASE', actionId: id, t: t + 0.03, angle, moveId: 'review', moveType });
          for (let k = 1; k < 60; k++) take(arena.sample({ time: t + 0.03 + k / 30, ...state, castId: id }));
        }
        if (cells.length) rows.push({ title: `arena ${action} ${heading} ${heading.includes('L') ? '← must face left' : 'must face right →'} · ${clipId}`, clip: clipId, cells, kind: 'arena' });
      }
    }
  } catch (error) { errors.push('ARENA ' + String(error.message).slice(0, 120)); }

  // Layout: a label column, then fixed cells; one scale per row so the pivots share a ground line.
  const LABEL = 300, CW = 104, CH = 112, PER = 12, ROWS_PER_IMAGE = 48;
  const lines = rows.flatMap((r) => Array.from({ length: Math.ceil(r.cells.length / PER) }, (_, i) => ({ ...r, cells: r.cells.slice(i * PER, (i + 1) * PER), cont: i > 0 })));
  const images = [];
  for (let start = 0; start < lines.length; start += ROWS_PER_IMAGE) {
    const chunk = lines.slice(start, start + ROWS_PER_IMAGE), stage = new PIXI.Container();
    const W = LABEL + PER * CW, H = 28 + chunk.length * CH;
    stage.addChild(new PIXI.Graphics().rect(0, 0, W, H).fill(0x3a3f47));
    stage.addChild(Object.assign(new PIXI.Text({ text: `${entry.displayCode} ${entry.displayName ?? ''}  (${start / ROWS_PER_IMAGE + 1}/${Math.ceil(lines.length / ROWS_PER_IMAGE)})`, style: { fill: 0xffffff, fontSize: 15 } }), { x: 8, y: 5 }));
    chunk.forEach((line, r) => {
      const y0 = 28 + r * CH;
      const color = line.kind === 'preview' ? 0x9aa4b0 : line.kind === 'arena' ? 0xa8d8ff : 0xffd27a;
      stage.addChild(Object.assign(new PIXI.Text({ text: (line.cont ? '… ' : '') + line.title, style: { fill: color, fontSize: 11, wordWrap: true, wordWrapWidth: LABEL - 12 } }), { x: 8, y: y0 + 6 }));
      // Pixi bounds cover the whole source canvas; the drawing is the texture trim around the anchor.
      const art = line.cells.map(({ sprite: s }) => {
        const o = s.texture.orig, t = s.texture.trim ?? { x: 0, y: 0, width: o.width, height: o.height };
        const x0 = (t.x - s.anchor.x * o.width) * s.scale.x, x1 = (t.x + t.width - s.anchor.x * o.width) * s.scale.x;
        return { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: (t.y - s.anchor.y * o.height) * s.scale.y, maxY: (t.y + t.height - s.anchor.y * o.height) * s.scale.y };
      });
      const top = Math.min(...art.map((a) => a.minY)), bottom = Math.max(0, ...art.map((a) => a.maxY));
      const side = Math.max(1e-3, ...art.map((a) => Math.max(-a.minX, a.maxX)));
      const k = Math.min((CH - 26) / Math.max(1e-3, bottom - top), (CW / 2 - 4) / side);
      const ground = y0 + 8 - top * k;
      line.cells.forEach((c, i) => {
        const cx = LABEL + i * CW + CW / 2, a = art[i];
        stage.addChild(new PIXI.Graphics().moveTo(cx - CW / 2 + 4, ground).lineTo(cx + CW / 2 - 4, ground).stroke({ color: 0x5b626c, width: 1 })
          .moveTo(cx, ground - 3).lineTo(cx, ground + 3).stroke({ color: 0x8fd18f, width: 1 }));
        c.sprite.scale.set(c.sprite.scale.x * k, c.sprite.scale.y * k); c.sprite.position.set(cx, ground); stage.addChild(c.sprite);
        const mark = marks[`${c.clip ?? line.clip}|${c.assetId}`];
        if (mark) stage.addChild(new PIXI.Graphics().rect(cx + a.minX * k - 2, ground + a.minY * k - 2, (a.maxX - a.minX) * k + 4, (a.maxY - a.minY) * k + 4)
          .stroke({ color: mark === 'flagged' ? 0xff4040 : 0xffb020, width: 2 }));
        stage.addChild(Object.assign(new PIXI.Text({ text: String(c.assetId).slice(-12), style: { fill: 0x9aa4b0, fontSize: 9 } }), { x: cx - CW / 2 + 3, y: y0 + CH - 13 }));
      });
    });
    images.push(await app.renderer.extract.base64({ target: stage, frame: new PIXI.Rectangle(0, 0, W, H) }));
    stage.destroy({ children: true });
  }
  // Textures belong to the loaded bundles: release them only after drawing.
  roster?.dispose?.(); await arenaBundle?.dispose?.();
  return { images, clips: rows.length, previews, mismatches, errors };
}
