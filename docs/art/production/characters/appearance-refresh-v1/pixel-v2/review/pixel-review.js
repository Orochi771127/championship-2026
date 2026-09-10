import { resolvePreviewUrl, validatePreviewData, collectCoverage, masterMembers, patchConsumers,
  rasterizeSlot, parsePaletteColor, createPixelReviewPlayer, isAuthoredSlot } from "./pixel-review-model.js";

const $ = (id) => document.getElementById(id);
let data = null, player = null, palette = [], coverage = null, currentKey = null, selectedMaster = null;
let playing = false, displayMode = "sequence", accumulator = 0, previousTime = null, request = null;
let loadRevision = 0;

function el(tag, text, className) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function pause() { playing = false; accumulator = 0; $("play").textContent = "播放"; }
function currentSequence() { return data.sides[$("side").value].sequences.find((seq) => seq.id === Number($("sequence").value)); }

function drawNative(result) {
  const canvas = $("native-canvas");
  if (!result.authored) {
    canvas.width = 16; canvas.height = 24; $("native-size").textContent = "未繪製";
    $("native-empty").hidden = false; return;
  }
  const indices = result.master.indices;
  canvas.width = indices[0].length; canvas.height = indices.length;
  const context = canvas.getContext("2d"); context.imageSmoothingEnabled = false;
  const pixels = context.createImageData(canvas.width, canvas.height);
  const colors = palette.map(parsePaletteColor);
  indices.forEach((row, y) => row.forEach((index, x) => pixels.data.set(colors[index], (y * canvas.width + x) * 4)));
  context.putImageData(pixels, 0, 0);
  const enlargement = Math.max(1, Math.floor(192 / Math.max(canvas.width, canvas.height)));
  canvas.style.width = `${canvas.width * enlargement}px`; canvas.style.height = `${canvas.height * enlargement}px`;
  $("native-size").textContent = `${canvas.width} × ${canvas.height} 原生格`;
  $("native-empty").hidden = true;
}

function drawPose() {
  if (!data || !currentKey) return;
  const result = rasterizeSlot(data, currentKey, palette);
  const canvas = $("pose-canvas"); canvas.width = result.width; canvas.height = result.height;
  const context = canvas.getContext("2d"); context.imageSmoothingEnabled = false;
  const pixels = context.createImageData(result.width, result.height); pixels.data.set(result.rgba); context.putImageData(pixels, 0, 0);
  if ($("guides").checked) {
    const [x, y] = data.canvas.origin;
    context.strokeStyle = "#e4bb7088"; context.lineWidth = 1; context.setLineDash([4, 5]);
    context.beginPath(); context.moveTo(x + .5, 0); context.lineTo(x + .5, result.height);
    context.moveTo(0, y + .5); context.lineTo(result.width, y + .5); context.stroke();
    context.setLineDash([]); context.fillStyle = "#f2d39a"; context.fillRect(x - 2, y - 2, 5, 5);
  }
  $("unauthored").hidden = result.authored;
  canvas.dataset.authored = String(result.authored); canvas.dataset.texture = currentKey;
  $("current-key").textContent = currentKey.replace(`${data.entityId}/`, "");
  $("frame-state").textContent = result.authored ? "AUTHORED · 新像素候選" : "UNAUTHORED · 保留空白";
  drawNative(result);
}

function showReferences(masterId) {
  selectedMaster = masterId;
  $("selected-master").textContent = masterId;
  const members = masterMembers(data, masterId);
  $("members").replaceChildren(...members.map((key) => el("li", key.replace(`${data.entityId}/`, ""))));
  const relevant = patchConsumers(data).filter((patch) => patch.masters.includes(masterId));
  $("patches").replaceChildren(...(relevant.length ? relevant.map((patch) => el("p",
    `${patch.id} → ${patch.masters.length} 母版 / ${patch.slots.length} 槽位\n${patch.masters.join(" · ")}`)) : [el("p", "這個母版沒有已登記的共用 patch。", "muted")]));
  for (const button of $("masters").querySelectorAll("button")) {
    const selected = button.dataset.master === masterId; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected));
  }
}

function renderFrameTable() {
  const sequence = currentSequence();
  $("frames").replaceChildren(...sequence.frames.map((frame, index) => {
    const row = el("tr"); row.dataset.frame = String(index);
    row.append(el("td", String(index)), el("td", String(frame.cell)), el("td", String(frame.ticks)),
      el("td", isAuthoredSlot(data, data.slots[frame.texture]) ? "AUTHORED" : "UNAUTHORED", isAuthoredSlot(data, data.slots[frame.texture]) ? "" : "missing"));
    return row;
  }));
}

function renderSequence() {
  if (!player) return;
  const snapshot = player.getSnapshot();
  const sequence = player.sequence;
  if (displayMode === "sequence") {
    currentKey = snapshot.texture;
    showReferences(data.slots[currentKey].masterId);
  }
  $("sequence-state").textContent = `${$("side").value.toUpperCase()} / Sequence ${sequence.id} · raw mode ${sequence.playbackMode} · loop start ${sequence.loopStartFrame ?? 0}\n圖格 ${snapshot.frameIndex + 1}/${snapshot.totalFrameReferences} · cell ${snapshot.cell} · ${snapshot.frameTicks} ticks · 已前進 ${snapshot.units} 原始單位\n這條序列 ${snapshot.authoredFrameReferences}/${snapshot.totalFrameReferences} 圖格引用已有新畫稿${snapshot.authoredFrameReferences < snapshot.totalFrameReferences ? "，其餘保持空白；尚未完成" : "；仍待美術與正常路徑驗收"}${!snapshot.active ? " · 來源模式已停止" : ""}${displayMode === "master" ? " · 正在單獨看母版" : ""}`;
  $("sequence-state").dataset.frameIndex = String(snapshot.frameIndex);
  $("sequence-state").dataset.active = String(snapshot.active);
  for (const row of $("frames").children) row.classList.toggle("current", displayMode === "sequence" && Number(row.dataset.frame) === snapshot.frameIndex);
  drawPose();
}

function chooseSequence() {
  pause(); displayMode = "sequence";
  player = createPixelReviewPlayer(data, $("side").value, Number($("sequence").value));
  renderFrameTable(); renderSequence();
}
function chooseSide() {
  $("sequence").replaceChildren(...data.sides[$("side").value].sequences.map((sequence) => {
    const option = el("option", String(sequence.id)); option.value = String(sequence.id); return option;
  }));
  chooseSequence();
}

function renderMasters() {
  const onlyAuthored = $("authored-only").checked;
  const nodes = coverage.masterIds.flatMap((id) => {
    const members = masterMembers(data, id); const authored = members.some((key) => isAuthoredSlot(data, data.slots[key]));
    if (onlyAuthored && !authored) return [];
    const button = el("button", undefined, `master-card${authored ? "" : " missing"}`); button.type = "button"; button.dataset.master = id;
    button.append(el("strong", id), el("span", authored ? "AUTHORED" : "UNAUTHORED"), el("small", `${members.length} 個槽位引用`));
    button.addEventListener("click", () => {
      pause(); displayMode = "master"; currentKey = members.find((key) => isAuthoredSlot(data, data.slots[key])) ?? members[0];
      showReferences(id); renderSequence();
    });
    return [button];
  });
  $("masters").replaceChildren(...nodes);
  if (selectedMaster) showReferences(selectedMaster);
}

function paletteStatus() {
  const changed = palette.map((color, index) => color !== data.palette[index] ? index : null).filter((index) => index !== null);
  if (!changed.length) { $("palette-state").textContent = "未修改色盤"; return; }
  const affected = coverage.masterIds.filter((id) => data.masters[id]?.indices?.some((row) => row.some((index) => changed.includes(index))));
  const slots = affected.reduce((sum, id) => sum + masterMembers(data, id).filter((key) => isAuthoredSlot(data, data.slots[key])).length, 0);
  $("palette-state").textContent = `暫存變更：色票 ${changed.join("、")} · 同步影響 ${affected.length} 母版 / ${slots} 槽位。重新載入或還原即可取消。`;
}
function renderPalette() {
  $("palette").replaceChildren(...palette.map((color, index) => {
    const label = el("label"); label.append(el("span", `INDEX ${String(index).padStart(2, "0")}`));
    if (index === 0) label.append(el("span", "透明", "transparent"));
    else {
      const input = el("input"); input.type = "color"; input.value = color.slice(0, 7); input.setAttribute("aria-label", `色票 ${index}`);
      const hex = el("input"); hex.type = "text"; hex.value = color.slice(0, 7); hex.maxLength = 7;
      hex.spellcheck = false; hex.setAttribute("aria-label", `色碼 ${index}`); hex.className = "hex-input";
      input.addEventListener("input", () => { palette[index] = input.value; hex.value = input.value; hex.removeAttribute("aria-invalid"); paletteStatus(); drawPose(); });
      hex.addEventListener("input", () => {
        const valid = /^#[0-9a-f]{6}$/i.test(hex.value); hex.setAttribute("aria-invalid", String(!valid));
        if (valid) { palette[index] = hex.value; input.value = hex.value; paletteStatus(); drawPose(); }
      });
      label.append(input, hex);
    }
    return label;
  }));
  paletteStatus();
}

async function loadData(path) {
  const revision = ++loadRevision; pause(); $("error").hidden = true; $("workspace").hidden = true; data = null;
  try {
    const url = resolvePreviewUrl(path, location.href);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`資料載入失敗 (${response.status})`);
    const parsed = validatePreviewData(await response.json());
    if (revision !== loadRevision) return;
    data = parsed; palette = [...data.palette]; coverage = collectCoverage(data);
    $("identity").textContent = `${data.entityId} · ${data.designVersion ?? "未標示版本"}`;
    $("master-count").textContent = `${coverage.authoredMasters} / ${coverage.totalMasters}`;
    $("slot-count").textContent = `${coverage.authoredSlots} / ${coverage.totalSlots}`;
    $("sequence-count").textContent = String(coverage.totalSequences);
    $("geometry").textContent = `固定畫布 ${data.canvas.width} × ${data.canvas.height} · 原點 (${data.canvas.origin.join(", ")}) · 每個原生像素 ${data.canvas.scale} × ${data.canvas.scale}`;
    $("workspace").hidden = false; $("side").value = "main";
    renderMasters(); renderPalette(); chooseSide();
  } catch (error) {
    if (revision !== loadRevision) return;
    $("error").textContent = error.message; $("error").hidden = false; $("identity").textContent = "資料尚未載入";
    $("master-count").textContent = "—"; $("slot-count").textContent = "—"; $("sequence-count").textContent = "—";
  }
}

$("manifest-form").addEventListener("submit", (event) => { event.preventDefault(); void loadData($("manifest-path").value); });
$("side").addEventListener("change", chooseSide); $("sequence").addEventListener("change", chooseSequence);
$("play").addEventListener("click", () => {
  if (!data) return; if (playing) { pause(); return; }
  displayMode = "sequence"; if (!player.getSnapshot().active) player.reset(); playing = true; $("play").textContent = "暫停"; renderSequence();
});
$("step-unit").addEventListener("click", () => { if (!player) return; pause(); displayMode = "sequence"; player.stepUnit(); renderSequence(); });
$("step-frame").addEventListener("click", () => { if (!player) return; pause(); displayMode = "sequence"; player.stepFrame(); renderSequence(); });
$("restart").addEventListener("click", () => { if (!player) return; pause(); displayMode = "sequence"; player.reset(); renderSequence(); });
$("reset-palette").addEventListener("click", () => { if (!data) return; palette = [...data.palette]; renderPalette(); drawPose(); });
$("guides").addEventListener("change", drawPose); $("authored-only").addEventListener("change", () => { if (data) renderMasters(); });
$("rate").addEventListener("change", () => { accumulator = 0; });
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); previousTime = null; });
function animate(time) {
  if (playing && player && previousTime !== null) {
    accumulator += Math.min(time - previousTime, 250);
    const interval = 1000 / Number($("rate").value);
    let changed = false;
    while (accumulator >= interval) { player.stepUnit(); accumulator -= interval; changed = true; if (!player.getSnapshot().active) { pause(); break; } }
    if (changed) renderSequence();
  }
  previousTime = time; request = requestAnimationFrame(animate);
}
window.addEventListener("pagehide", () => { pause(); cancelAnimationFrame(request); });
const initial = new URL(location.href).searchParams.get("manifest") ?? "../m201-a/build-r02/preview-data.json";
$("manifest-path").value = initial; request = requestAnimationFrame(animate); void loadData(initial);
