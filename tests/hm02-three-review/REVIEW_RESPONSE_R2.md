# Independent review response R2 — 2026-10-21 16:01 UTC

Scope unchanged: HM02 fixed camera, frozen v2 assets, loopback-only diagnostic entry, no remote/publication/browser actions. v3/optional LOD files not adopted.

## Changes
1. Main now checks loopback, explicit query and HM02 field BEFORE helper import. Actual inline main code is executed in unit tests with injected importer: prod/no-query/HM01/HM08 do zero imports; import rejection locally falls back, not outer mount failure.
2. Shader debug handler records failure; `shaderFailureGuard.draw` throws only AFTER Three render returns. Shared pass then disposes and restores original native art/occluders before original Pixi draw. Mocked actual pilot proves unwind order. Real invalid-GLSL injection still mandatory in GPU harness.
3. ALL fetch/body/digest/parse await boundaries use AbortSignal race; external mount abort propagates to internal controller. No Three renderer exists until CPU assets finish. Late parse results dispose without reactivating owner. Context constructor/setup and out-of-pass disposal always reset Pixi state. Actual pilot tests cancel eight fetch/body/parse sites, handle rejected fetch/hash/parse, test subsequent original Pixi draw.
4. Generated InstancedMeshes are tracked and `dispose()` called once; source geometry/material/texture disposal de-duplicated. Owned decoded ImageBitmap-like resources `close()` once. Tests verify counts; GPU ten-entry resource accounting remains pending.
5. Shared actor quad/bounds helper includes sprite.x/y, trim, native anchor, scales/flips. Ground support finite height and exact pinned terrain identity required. Offscreen actor meshes do not allocate/update textures or shadows. Removed every-frame material.needsUpdate churn.
6. Same-stage target and legacy renderTexture bypass tests added. Full mixed Three+Pixi offscreen scene extraction is explicitly UNSUPPORTED; bypass is only preservation of original Pixi call, not a claim of composite capture.

## Exact dependency proof / remaining build gate
- Read current package blob 844eea13ce79871fb31b4199eee9bf78addd4ddc and lock blob ccf6005e4a21413a1e022b163cee890561ab84d1. Both exact Three0.185.1/Pixi8.19.0, lock integrity entries saved.
- Actual main loads Pixi from public-runtime/vendor-pixi.mjs (blob80721f098ea46d2fb00708607a907398a6397597), not a bare import. Runtime gate now requires PIXI.VERSION exactly8.19.0. Three.REVISION only185 cannot prove patch; exact package/build evidence required in addition.
- Current HTML import map maps only exact `three` to node_modules/three/build/three.module.js; it has NO addons-prefix mapping. Fixed GLTFLoader import to exact relative node_modules/three/examples/jsm/loaders/GLTFLoader.js (same package), avoiding raw browser's unresolvable bare addons path.
- `DEPENDENCY_EVIDENCE.json` records package/lock/HTML/build pipeline blobs. `dependency-preflight.mjs` must run on actual staged repo: assert installed pkg + lock exact versions, resolve actual caller importmap/addon path, import Three/GLTFLoader/vendorPixi and validate exports/hash files.
- This workspace has exact installed Three0.185.1 used for CPU Scene/geometry lifecycle tests, but no staged game/Pixi module. Thus **actual staged-repo preflight and compiled caller-build resolution remain PENDING, and harness launch is blocked on them**. No claim of full resolver execution; no installs or source allowlist expansion made. Parent CI must preserve approved-source packaging and record bundle input hashes.

## Results
381 numerical assertions plus original mocks PASS. New tests: actual main four negative gates/module failure; four general abort races; actual pilot eight abort sites/four errors/success/shader-failure recovery; instance/resource/ImageBitmap cleanup; same-stage target/legacy bypass; exact bounds with large local offsets. Syntax all files and both exact-source patch dry-runs PASS. No shader/GPU/mobile evidence manufactured.

### R2.1 ownership handoff race correction (16:03 UTC)
Independent reviewer found abort microtask between fulfilled parse and outer assignment could bypass earlier disposal. Both terrain/prototype assignments now immediately check disposed/aborted state and explicitly dispose the delivered GLTF before exiting. Added20 actual-pilot regressions:10 microtask depths×terrain/prototype; allPASS. Reviewer original10-depth repro now reports exact2 disposals/0renderers/0listeners at every depth. No resource owner resurrection.
