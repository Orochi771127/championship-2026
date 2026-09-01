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
- Git-tracked Node test suite: 332 passing, 0 failing
- Chromium runtime smoke test: all four systems load, animate, update, and
  dispose; caller-owned ticker confirmed; Gate Earth remains unmounted

## Battle and weather presentation events

The event routing is implemented by
`CHAMPIONSHIP_BATTLE_WEATHER_VFX_EVENTS.v1.json` and the corresponding
presentation-only event bus/controller:

- confirmed large battle hit → `hitspark_big` on the battle channel;
- confirmed Hyper phase entry → `hypereffect` on the battle channel;
- explicit common Spark request → `spark` on the common channel;
- rain state transition → looping `rain` on the weather channel until stopped.

Battle, common and weather channels can coexist. They share the caller's update
delta and add no save or simulation state. Because the product does not yet have
a battle screen or authoritative weather state, no existing gameplay input is
pretended to be one of these events. Spark and rain remain explicit-only until
their original callers are traced or the product introduces an authoritative
state transition.

The Chromium integration gate loads all four real converted systems through
these events, verifies three concurrent channels, replaces a large hit with the
Hyper effect, stops rain independently, and disposes every resource.
