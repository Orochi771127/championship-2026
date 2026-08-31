# Faithful HD96 UI/HUD reference package

This package locks all 96 verified NXR scene records to the 1,369 decoded node
placements and linked Nitro resource evidence. It also provides deterministic
4x nearest-neighbour background and sprite-cell witness sheets for visual and
layout comparison.

The 9:16 contract uses a 1080x1920 reference canvas. A 256x192 original screen
maps to a 1080x810 semantic zone at scale 4.21875. The main zone starts at y=150
and the sub zone starts at y=960, leaving 150px safe bands above and below.
Scenes whose screen role cannot be established from the file identity remain
`UNKNOWN_REQUIRES_TRACE` and deliberately have no projected portrait position.

These files are not final smooth hand-redrawn UI and are not runtime or shipping
assets. They remain under `docs/art/production` until the reported licence is
linked, the corresponding clean production replacements are reviewed by a
human, and runtime visual QA passes. DOM owns the final application UI; the
single PixiJS application continues to own playable 2D fields.
