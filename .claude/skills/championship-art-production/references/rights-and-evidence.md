# Rights and evidence

Use before assigning provenance, rights or shipping status to any art.

## Authority order

1. The latest explicit Owner direction for this task (`docs/coordination/OWNER_DIRECTION.md`, newest dated entry that matches the batch).
2. `AGENTS.md`, `CLAUDE.md` and the project skills.
3. Current source, manifests and contracts (`docs/contracts/championship/`).
4. Primary evidence and its manifests (Championship Evidence MCP when available).
5. Older plans, reports and proposals, including other AI tools' suggestions.

Record a conflict between levels instead of silently merging them. A proposal
from another tool or chat is level 5 until the Owner adopts it.

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
