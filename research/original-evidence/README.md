# Original evidence firewall

Original Championship evidence remains external to this product repository. This directory records policy and provenance only; it intentionally contains no ROM, Nitro, decoded graphics, contact sheets, reconstruction galleries, or forensic staging.

Lifecycle for all original evidence: `ROM_COPYRIGHTED_REFERENCE / REFERENCE_RECONSTRUCTION / RESEARCH_ONLY / NOT_SHIPPING_READY`.

Runtime code and production assets must never import or copy pixels from this area. See `docs/migration/PRE_MIGRATION_PROVENANCE.md` for checkpoint references.

## External research root

Owner-designated location, recorded here once so that contracts and reports can cite pack-relative paths instead of repeating an absolute path:

```
ORIGINAL_EVIDENCE_ROOT = R:\NEXUS LINK\原作
```

This root is **read-only reference**. Nothing under it is imported, copied, bundled, converted, or resolved at runtime. If it moves, update this line and nothing else: every other document cites paths relative to it.

## Evidence packs

| Pack | Holds |
|---|---|
| `YDIJ_3D_RESEARCH_PACK_2026-08-24/` | ROM-wide 3D inventory, overlay string cross-reference, per-subsystem focus copies |
| `YDIJ_3D_DECODED_REFERENCE_PACK_2026-08-24/` | decoded model structure, node candidates, model/animation associations, SHA-256 manifest |
| `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE2..4_2026-08-24/` | derived loader cross-reference census |
| `CLAUDE_CODE_YDIJ_HANDOFF/01_UI_ART_LAYOUT/` | UI source-asset, background and sprite-bundle inventories; 94-scene NXR analysis |
| `YDIJ_RAW_RESEARCH_EVIDENCE/` | raw forensic catalogs |

Metadata from these packs — names, counts, offsets, hashes, structural facts — is freely citable and is not copyrighted material. The `raw_3d_assets/`, `focus_*/` and extracted-image trees are ROM-derived and must never enter this repository.

## Contracts sourced from this evidence

| Contract | Subject |
|---|---|
| `docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json` | 8-slot contextual toolbar |
| `docs/contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json` | Original Gate Select 3D world map, 16 biome identities, day/night pairing |
