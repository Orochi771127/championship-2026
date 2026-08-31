# Faithful VFX internal runtime integration v1

This integration exposes four owner-authorized, non-public faithful VFX systems
through one caller-controlled Three.js runtime bundle:

- `hitspark_big`
- `hypereffect`
- `spark`
- `rain`

The runtime supports the standard GLB animation tracks, the original visibility
animation used by `hypereffect`, the original material animation used by
`spark`, and the texture-transform animation channels used by `spark` and
`rain`. The game owns the update delta and presentation trigger; this bundle
does not create a renderer, ticker, router, store, or save path.

`gate-earth.glb` is intentionally not mountable. Static ROM tracing verified
the Gate Select world-map loader, but did not prove that Gate Earth is consumed
there. It remains reference-only until an exact original call site is proven.

## Runtime boundary

- Asset ID: `art:vfx:faithful-original:internal-v1`
- Public runtime eligible: no
- Internal runtime eligible: yes
- Shipping ready: no
- Source payload committed by this integration: no
- Runtime manifest: generated under the ignored internal faithful baseline

The direct ROM-derived working files remain outside this integration commit.
Only source code, source-free hashes/trace receipts, and tests are committed.

## Verification

- Conversion validator: 5 source systems, 6 GLBs, 9 PNGs, 2 animation sidecars
- Internal baseline validator: 5 of 9 presentation slots, 2,473 files
- Node test suite: 314 passing, 0 failing
- Chromium runtime smoke test: all four systems load, animate, update, and
  dispose; caller-owned ticker confirmed; Gate Earth remains unmounted

The remaining game-side work is to map battle and weather presentation events
to these four system IDs. That event routing must not change simulation or save
state.
