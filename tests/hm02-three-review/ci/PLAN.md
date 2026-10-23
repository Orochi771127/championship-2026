# Draft test PR / phase-one isolation

User authorized a separate HM02 draft-test PR, not public deployment. Freeze R2.1 renderer + v2 assets. V5/LOD are NOT selected. Every source file/asset/catalog lives under tests/hm02-three-review except the workflow. No production source/allowlist/contracts/import-map changes; no source .blend/master/highres.

CI order: npm ci -> unchanged production build+validate -> dependency-preflight on staged exact packages/vendor/importmap -> esbuild compile actual main+renderer candidates via canonical-path read-only overlays -> offline/native identity/lifecycle gates -> CI Chromium synthetic diagnostics. Browser script refuses non-GitHub CI and no local socket/browser retry is authorized.

Playwright routes canonical pilot module URLs and frozen asset URLs to test-only files; normal application/default builds remain unchanged. The main/renderer snapshots are exact-source candidates, not silently applied files. Overlay compile rejects changed source blobs, so publisher must rebase if fresh main moves. The native180²catalog is ONLY read/compared with production128²cells; not inserted into a user's game.

GPU fixture uses obvious yellow rectangular synthetic actor, actual v2 GLBs, fixed camera and true shared Pixi/Three context. It tests lower-body native-origin grounding, a red synthetic foreground pillar, nativeZ screenshot, intentional GLSL error same-frame fallback, actual gated-loader v2 cave fallback/HM01 exclusion,10 reentries,DPR/resize,context lost/restored. Screenshots/report are CI artifacts7days. Software-GPU CI != mobile performance. Reentry memory counters are captured, not exact GPU byte proof.

V2 cave test MUST fallback; it is NOT 3D cave acceptance. V5 ground flattening/cave art improvements need separate reviewed manifest/version. Full actual game mount/capture/caves/spawn/native actor sourcealpha/MEAT depth/normal shop navigation/daynight and real Safari/Android remain later gates. Phase-one synthetic fixture and overlay compilation do NOT replace actual main-entry/full-game acceptance. No localStorage/sessionStorage/game save writes, no user account/data/session or thirdparty requests.

Known bounded fixture omissions: no production background atlas comparison, no native-character delivery art, no full composite texture extraction. Shader injection is deliberately isolated and must not enter runtime source. Checks may expose first actual GPU issues; workflow passing is diagnostic-only, not merge/deploy approval.

Native catalog check correction from execution: original terrain128²is unchanged; direction palette is preserved as a prefix, but expansion deliberately changes documented east/south boundary cells x127/y127 to connect the added region. Test verifies only those exact recorded seam exceptions, never silently permits interior ESC changes. Three cave mouths belong to one shared caveGroup.65,536 cell checks pass against saved current contract; this is not RNG escape/gameplay proof.
