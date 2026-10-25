# Growth artwork integration, 2026-10-25

Owner scope: integrate the 38 completed growth-stage characters, add GR39/40/41 as raisable and combat-capable identities, merge main and publish. Dot performs this work directly; no Codex delegation. Publication uses replacement rather than shipping two complete sets. Archived original artwork is unchanged.

## Presentation

- 38 new runtime selections; GR04/13/32 remain unchanged.
- Main presentation maps 1,066 of 1,520 numeric contexts. The other 454 contexts retain existing same-character artwork rather than inventing source semantics.
- All 38 expose eight directions for movement, melee, ranged and hit in Data Arena. Some hit clips intentionally have one impact pose; this is not a claim that every action has four drawings.
- Numeric Main cell IDs, durations, playback modes and gameplay clocks remain unchanged. Mapped texture keys now point to new art; an authored sampler resolves additional poses using that existing clock.
- Old atlas pages remain only if an unmapped action still references them. Legacy prefetch selection follows the replacement runtime.
- Selected-frame atlases are repacked without resampling. All 76 derived WebP pages were decoded and compared byte-for-byte against their packed RGBA canvas. The 38 Main/Arena sets total 59,110,598 image bytes before HUD files.
- Lossy WebP experiments were not selected for publication. Original art packages remain privately archived. No source masters/intake files are included in the public artifact.

## New playable identities

| Code | Stable ID | HP minimum | TP minimum | Attack | Defense | Wisdom | Speed | Rung budget |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| GR39 星河山豬 | species-231 | 760 | 26 | 38 | 38 | 26 | 26 | 55 |
| GR40 星核豆獸 | species-237 | 600 | 38 | 26 | 30 | 38 | 30 | 55 |
| GR41 雷霆貓狼 | species-239 | 520 | 30 | 38 | 26 | 26 | 46 | 55 |

Values are lower curve bounds, not guaranteed spawned individuals. The existing initializer adds bounded random variation; resistance bounds use rung minus three. A 55-rung total matches the median of the 38 existing growth records but does not establish equal battle power. The initial pass was corrected after tracing the named consumers: offset 0x68 is Wisdom; 0x6c is Speed.

Existing numeric templates 35, 68 and 36 supply lifecycle, trait behavior, entry requirements and outgoing evolution branches respectively. Their existing move lists are explicitly selected, not silently treated as new original moves. New identities, stat allocation and movement speeds remain distinct. No new mature-form artwork or invented family-chain completion is claimed. Each new form is available as an additional choice when the corresponding native growth form becomes eligible, then can use that template's existing mature branches.

Relay mode uses its existing normalized role stats and element kits: boar/body/earth, bean/core/light, wolf/quadruped/storm. It does not copy the main game's HP into Arena.

The native 0–227 identities and absent sentinel 228 remain untouched. New persistent profiles use the existing product-species save path. Product network catalog revision increments to 2, so old product-version invitation codes must be regenerated rather than mixing incompatible catalogs.

## Verification boundary

Controlled tests cover all 38 render hashes/directions, new profile persistence, complete outgoing evolution playback, existing native registration and transport fixtures, and real battle simulation through damage and settlement for each new identity. Renderer workflow captures real Pixi streaming and directional placement separately. Browser, CI and live deployment status must be established for the final commit; build success alone is not deployment.
