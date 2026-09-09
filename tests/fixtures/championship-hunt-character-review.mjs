import * as PIXI from "../../node_modules/pixi.js/dist/pixi.mjs";
import { createChampionshipPixiStage } from "../../src/championship/presentation/championshipPixiStage.js";
import { loadLicensedCharacterRoster, LICENSED_CHARACTER_MANIFEST } from "../../src/championship/presentation/licensedCharacterRoster.js";
import { mountHuntFieldPixiPresentation } from "../../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js";
import { NATIVE_HUNT_CHARACTER_FRAME_CONTRACT } from "../../src/championship/presentation/nativeHuntCharacterAction.js";
import { createNativeCharacterAnimationTimeline } from "../../src/championship/presentation/characterAnimationTimeline.js";

const json = async (path) => {
  const response = await fetch(new URL(`../../${path}`, import.meta.url));
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};
const [trace, manifest, productionIndex, characterRuntime] = await Promise.all([
  json("docs/research/HUNT_CHARACTER_ANIMATION_TRACE_2026-09-06.json"),
  json(LICENSED_CHARACTER_MANIFEST), json("assets/production/ART_PRODUCTION_INDEX.json"),
  json("assets/production/internal-faithful-baseline/characters-v1/m003_nyokimon/runtime.json")
]);
// Replay original setter/update calls through the port, rather than using the
// expected frame indices as the renderer's output. The comparison is visible
// through the source-cell / Pixi-cell rows below and also enforced at load.
const sequences = new Map(characterRuntime.sides.main.animations.map((a) => [a.id, a]));
let nativeTimeline = null;
const replayedFrames = trace.frames.map((frame) => {
  for (const call of trace.calls.filter((call) => call.tick === frame.tick)) {
    if (!call.before) continue;
    nativeTimeline ??= createNativeCharacterAnimationTimeline(sequences.get(call.before.sequenceId), { initialSnapshot: call.before });
    if (call.pc === "0x2047904") nativeTimeline = createNativeCharacterAnimationTimeline(sequences.get(call.r1));
    if (call.pc === "0x2047a08") nativeTimeline.advanceNative(call.r1, call.before.speedQ12);
  }
  const actual = nativeTimeline.getSnapshot();
  for (const key of ["sequenceId", "frameIndex", "cell", "elapsedQ12", "active", "playMode"]) {
    if (actual[key] !== frame.animation[key]) throw new Error(`NATIVE_ANIMATION_MISMATCH:${frame.tick}:${key}`);
  }
  return Object.freeze({ ...actual, flipBits: frame.animation.flipBits });
});
const stage = await createChampionshipPixiStage({ PIXI, canvasHost: document.querySelector("#field") });
const roster = await loadLicensedCharacterRoster({ PIXI, speciesIds: ["species-010"], manifest, productionIndex,
  manifestUrl: new URL(`../../${LICENSED_CHARACTER_MANIFEST}`, import.meta.url).href });
let tick = 143, reducedMotion = false, playing = false, viewingTicks = 0;
const source = {
  field: { tick(deltaMS) {
    if (!playing) return;
    // Review transport only: advances the cursor over immutable original
    // observations. It has no capture owner, persistence or gameplay writes.
    viewingTicks += Math.min(deltaMS, 1000) * 60 / 1000;
    const steps = Math.floor(viewingTicks); viewingTicks -= steps;
    tick = Math.min(trace.frames.length, tick + steps);
    if (tick === trace.frames.length) playing = false;
    render();
  }, getView({ viewportWidth, viewportHeight }) {
    const frame = trace.frames[tick - 1];
    const [worldX, worldY] = frame.worldQ12.map((n) => n / 2048);
    const hidden = frame.cardCount > 0 || frame.handController && (frame.handController.phase > 0 || frame.handController.counter >= 10);
    const scale = 3;
    return { gateId: "original-trace-gate-00", worldWidthPx: 2048, worldHeightPx: 2048,
      tileSizePx: 16, objects: [], visibleChunks: [], isBlockedTile: () => false,
      transform: { scale }, camera: { left: worldX - viewportWidth / scale / 2,
        top: worldY - viewportHeight / scale / 2, right: worldX + viewportWidth / scale / 2,
        bottom: worldY + viewportHeight / scale / 2 },
      player: { worldX, worldY, facing: "down" },
      wildCreatures: hidden ? [] : [{ wildId: "original-wild-7", speciesId: "species-010", worldX, worldY,
        facing: "down", nativeAnimation: { ...replayedFrames[tick - 1],
          frameIndex: reducedMotion ? 0 : replayedFrames[tick - 1].frameIndex, contract: NATIVE_HUNT_CHARACTER_FRAME_CONTRACT } }],
      selectedWildId: null, enclosure: null };
  } },
  intents: { panCamera() {}, selectWildAt() {}, abortEnclosureStroke() {} }
};
const scene = await mountHuntFieldPixiPresentation({ stage, source, characterBundle: roster });
const slider = document.querySelector("#frame");
function render() {
  slider.value = tick;
  document.querySelector("#play").textContent = playing ? "暫停記錄" : "播放記錄";
  scene.render();
  const frame = trace.frames[tick - 1];
  const actual = scene.getDiagnostics().nativeCharacterFrames[0];
  document.querySelector("#status").textContent = [
    `原作畫格 ${tick} / ${trace.frames.length}　AI ${frame.ai}　HP ${frame.hp}`,
    `原始序列 ${frame.animation.sequenceId}　來源幀 ${frame.animation.frameIndex}　來源 cell ${frame.animation.cell}`,
    `原始播放模式 ${frame.animation.playMode}　動畫 active=${frame.animation.active}`,
    actual ? `Pixi 已套用：序列 ${actual.sequenceId} / cell ${actual.cell} / 水平翻轉 ${actual.flipX}` : "Pixi 場景：角色已依收集階段隱藏",
    `可收集 ${Boolean(frame.ready)}　卡片數 ${frame.cardCount}　來源卡片 HP ${trace.card.currentHp}`,
    "驗收範圍：原作動作投影；正常 Hunt 生成、工具、返家綁定仍未通過。"
  ].join("\n");
}
slider.addEventListener("input", () => { tick = Number(slider.value); render(); });
document.querySelector("#play").addEventListener("click", () => {
  if (tick === trace.frames.length) tick = 1;
  playing = !playing; viewingTicks = 0; render();
});
document.querySelector("#phases").addEventListener("click", (event) => {
  const value = event.target.dataset.tick;
  if (value) { tick = Number(value); render(); }
});
document.querySelector("#previous").addEventListener("click", () => { tick = Math.max(1, tick - 1); render(); });
document.querySelector("#next").addEventListener("click", () => { tick = Math.min(trace.frames.length, tick + 1); render(); });
document.querySelector("#motion").addEventListener("click", (event) => {
  reducedMotion = !reducedMotion; event.target.textContent = `減少動態：${reducedMotion ? "開" : "關"}`; render();
});
render();
window.addEventListener("pagehide", () => { scene.dispose(); stage.destroy(); }, { once: true });
