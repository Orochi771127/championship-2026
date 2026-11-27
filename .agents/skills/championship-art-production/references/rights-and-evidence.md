# Rights and evidence

Use before assigning provenance, rights or shipping status to any art.

## Authority by question

There is no single ranking. Use the
[authority by question](../../../../docs/README.md#authority-by-question)
table and answer each question from its own source:

| Question | Source |
|---|---|
| What did the original art or game do? | Verified ROM/emulator evidence and provenance. Current code, art or Owner preference cannot prove it. |
| What does this checkout draw today? | Current source, production manifests and executed acceptance for this commit. |
| What may this task change? | The latest explicit Owner direction for this batch. A deliberate departure is `OWNER_APPROVED_ADAPTATION`; it never rewrites source evidence. |
| Is this asset accepted, licensed or publishable? | The production index, rights records, visual and device acceptance, and the public-playtest policy, each kept separate. |

Task authorization never stands in for provenance, rights evidence or
original-behaviour verification. Record a conflict inside its question
instead of blending. A proposal from another tool or chat is only a proposal
until the Owner adopts it for the batch.

## Rights status

`rightsStatus` is separate from readiness:

- `ROM_COPYRIGHTED_REFERENCE` — research only, never shipping.
- `PROJECT_ORIGINAL` / `ORIGINAL_CREATED` — made for this product without ROM pixels.
- `OWNER_OWNED`, `LICENSED` — with the record that proves it.
- `UNKNOWN` — blocks shipping.

`READY_FOR_RUNTIME` means loadable, not shippable. Shipping needs all of: an
allowed rights status, any required replacement done, human approval recorded,
runtime visual QA passed. Public-playtest approvals cover only their recorded
assets and destinations; they are not commercial-release clearance.

## Generated and reference inputs

- Image or 3D generation for shipping art takes text and the project's own
  originals as inputs, never ROM frames, `ART_REFERENCE_LIBRARY` files or
  third-party characters. Record the tool, model and inputs in the asset's
  manifest.
- Third-party brand and franchise names (products, devices, characters) never
  appear in asset names, style names or shipped copy.
- Fonts, music and sound effects need their licence recorded the same way.

## Evidence labels

Keep the strongest justified label and never upgrade uncertainty:
`ROM_VERIFIED`, `PARTIAL`, `UNKNOWN_REQUIRES_TRACE`, `OWNER_APPROVED_ADAPTATION`.
Unproven animation or effect meanings keep raw identifiers (`RAW_SLOT_33`).
Source (NDS) coordinates are reference coordinates, never web coordinates.
