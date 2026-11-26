// Static hunt map audit (2026-11-26). Run from the worktree root:
//   node scripts/qa/hunt-map-static-audit.mjs > report.json
// Per map: manifest + every referenced asset (exists, bytes, sha), formats (GLB Draco, WebP),
// image sizes, decoded GPU estimate, fallback frames, catalog size per field.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { MAPS } from '../../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import { createNativeHuntEnvironment } from '../../src/championship/hunt/capture/nativeHuntSceneSources.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const expansions = JSON.parse(fs.readFileSync('src/data/championship/catalogs/hunt-art-expansions-20261023.json', 'utf8')).environments;
const fallback = JSON.parse(fs.readFileSync('assets/production/hunt/three-fallback-20261023/manifest.json', 'utf8'));

function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { kind, w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { kind, w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { kind, w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  return { kind };
}
function glbInfo(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) return { ok: false };
  const j = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  const images = (j.images ?? []).map(img => {
    if (img.bufferView === undefined) return { external: img.uri };
    const v = j.bufferViews[img.bufferView];
    const start = 28 + buf.readUInt32LE(12) + (v.byteOffset ?? 0);
    const bytes = buf.subarray(start, start + v.byteLength);
    const mime = img.mimeType;
    let size = null;
    if (mime === 'image/png') size = { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
    else if (mime === 'image/webp') size = webpSize(bytes);
    return { mime, bytes: v.byteLength, ...size };
  });
  const tris = (j.meshes ?? []).reduce((n, m) => n + m.primitives.reduce((k, p) => k + (p.indices !== undefined ? j.accessors[p.indices].count / 3 : 0), 0), 0);
  return { ok: true, draco: (j.extensionsRequired ?? []).includes('KHR_draco_mesh_compression'), externalBuffers: (j.buffers ?? []).some(b => b.uri),
    meshes: j.meshes?.length ?? 0, triangles: Math.round(tris), materials: j.materials?.length ?? 0, images };
}

const out = {};
for (const [key, map] of Object.entries(MAPS)) {
  const r = { worldSize: map.worldSize, directory: map.directory, problems: [] };
  const mbytes = fs.readFileSync(map.directory + map.manifest.file);
  if (mbytes.length !== map.manifest.bytes || sha(mbytes) !== map.manifest.sha256) r.problems.push('MANIFEST_PIN_MISMATCH');
  const m = JSON.parse(mbytes);
  r.schema = m.schema;
  const assets = [];
  const visit = (v, where) => {
    if (Array.isArray(v)) v.forEach((x, i) => visit(x, where + '[' + i + ']'));
    else if (v && typeof v === 'object') {
      if (typeof v.file === 'string' && typeof v.sha256 === 'string') assets.push({ ...v, where });
      for (const [k, x] of Object.entries(v)) visit(x, where + '.' + k);
    }
  };
  visit(m, '');
  const seen = new Set();
  let total = 0, gpu = 0;
  r.files = [];
  for (const a of assets) {
    if (seen.has(a.file)) continue; seen.add(a.file);
    const p = map.directory + a.file;
    if (!fs.existsSync(p)) { r.problems.push('MISSING ' + a.file); continue; }
    const b = fs.readFileSync(p); total += b.length;
    if (b.length !== a.bytes || sha(b) !== a.sha256) r.problems.push('HASH ' + a.file);
    const ext = path.extname(a.file);
    const f = { file: a.file, bytes: b.length };
    if (ext === '.glb') {
      Object.assign(f, glbInfo(b));
      if (!f.draco) r.problems.push('GLB_NOT_DRACO ' + a.file);
      if (f.externalBuffers) r.problems.push('GLB_EXTERNAL ' + a.file);
      for (const img of f.images) { if (img.w) gpu += img.w * img.h * 4; }
    } else if (ext === '.webp') {
      Object.assign(f, webpSize(b));
      if (!f.w) r.problems.push('BAD_WEBP ' + a.file);
    } else if (ext === '.json') {
      JSON.parse(b.toString('utf8'));
    } else r.problems.push('UNEXPECTED_FORMAT ' + a.file);
    r.files.push(f);
  }
  // frames of baked maps
  if (m.fields && !Array.isArray(m.fields)) {
    for (const [fid, field] of Object.entries(m.fields)) for (const fr of field.frames ?? []) {
      if (fr.width !== map.worldSize || fr.height !== map.worldSize) r.problems.push(`FRAME_SIZE ${fid} ${fr.width}`);
      gpu = Math.max(gpu, 0) + fr.width * fr.height * 4 * (field.frames.length);
    }
  }
  r.downloadBytes = total;
  r.gpuEstimateMB = Math.round(gpu / 1048576);
  // catalog + fallback per field
  r.fields = {};
  for (const fid of map.fields) {
    const env = expansions[fid];
    const e = env ? createNativeHuntEnvironment(env) : null;
    const fb = fallback.fields.find(f => f.fieldId === fid);
    let fbInfo = null;
    if (fb) {
      const fp = fb.frames[0].src, b = fs.existsSync(fp) ? fs.readFileSync(fp) : null;
      fbInfo = b ? { bytes: b.length, ...webpSize(b), shaOk: sha(b) === fb.frames[0].sha256 } : { missing: fp };
      if (!b || sha(b) !== fb.frames[0].sha256) r.problems.push('FALLBACK_BAD ' + fid);
      else if (fbInfo.w !== map.worldSize) r.problems.push(`FALLBACK_SIZE ${fid} ${fbInfo.w}`);
    } else if (key !== 'hm01') r.problems.push('FALLBACK_MISSING ' + fid);
    if (!e) r.problems.push('CATALOG_MISSING ' + fid);
    else if (e.width * 16 !== map.worldSize) r.problems.push(`CATALOG_SIZE ${fid} ${e.width}`);
    r.fields[fid] = { tiles: e ? `${e.width}x${e.height}` : null, fallback: fbInfo };
  }
  out[key] = r;
}
console.log(JSON.stringify(out, null, 1));
