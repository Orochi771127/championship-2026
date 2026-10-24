// Derived from exact source geometry and existing native ENTER movement only.
// See tests/prove_cave_support.py; this does not alter collision or passage rules.
export const HM01_ENTER_SUPPORT=Object.freeze({
  "schema": "HUNT_HM01_ENTER_SUPPORT_PROOF.v1",
  "status": "GEOMETRY_COVERAGE_CPU_VERIFIED_NOT_GPU",
  "glbSHA256": "e90423e80e5ec917854cc406b77e32815ae6912d5629126a2f92e209537da5ee",
  "heightGridSHA256": "a46ee687ea5c3f1f7865dbddceca8ced3798772707f90d30c29728728d9935ba",
  "nativePassageSourceSHA256": "ff916582853288fce21fec54c216066cea0e2e31ba2a8ee18aa222aeceaa9fc0",
  "nativeExpansionSourceSHA256": "96c08652454cf2474372da63a5e84a5c50c2e10a736256dc4b5bd269620d45be",
  "method": "Every clipped standable-ground triangle is inside the rectangle, pairwise area-disjoint, and total area equals the rectangle within1e-5 world-px\u00b2. Thus continuous coverage apart from floating-point boundary tolerance; all clipped heights within0.001 GLTF unit of0. No sampled-only support inference.",
  "maxScreenErrorPx": 0.007500133214769325,
  "requiredNativePhase": "ENTER",
  "regions": [
    {
      "id": "hm01-cave-north-native-enter",
      "bounds": {
        "left": 560,
        "right": 592,
        "top": 52,
        "bottom": 80
      },
      "sourceTrianglePieces": 3,
      "areaWorldPx2": 896.0,
      "expectedAreaWorldPx2": 896,
      "pairwiseOverlapAreaWorldPx2": 0.0,
      "sourceHeightRange": [
        0.0003806948661804199,
        0.0003806948661804199
      ],
      "flatSupportHeight": 0
    },
    {
      "id": "hm01-cave-centre-native-enter",
      "bounds": {
        "left": 1264,
        "right": 1296,
        "top": 932,
        "bottom": 960
      },
      "sourceTrianglePieces": 6,
      "areaWorldPx2": 896.0,
      "expectedAreaWorldPx2": 896,
      "pairwiseOverlapAreaWorldPx2": 0.0,
      "sourceHeightRange": [
        0.0003806948661804199,
        0.0003806948661804199
      ],
      "flatSupportHeight": 0
    },
    {
      "id": "hm01-cave-south-native-enter",
      "bounds": {
        "left": 1264,
        "right": 1296,
        "top": 2484,
        "bottom": 2512
      },
      "sourceTrianglePieces": 5,
      "areaWorldPx2": 896.0,
      "expectedAreaWorldPx2": 896,
      "pairwiseOverlapAreaWorldPx2": 0.0,
      "sourceHeightRange": [
        0.0003806948661804199,
        0.0003806948661804199
      ],
      "flatSupportHeight": 0
    }
  ]
});
