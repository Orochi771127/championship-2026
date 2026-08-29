# Hunt field input ROM trace

Date: 2026-08-29

Scope: original YDIJ Hunt-field camera gesture only

Status: `ROM_VERIFIED` + `OWNER_VERIFIED_ORIGINAL_BEHAVIOR`

## Conclusion

The original Hunt field is explored through a camera window over the full field. Holding the stylus on the field and
dragging pans that window by the inverse pointer delta. It does **not** issue a move-to command to a player avatar.

For the 2026 portrait remake, 9:16 is therefore only the viewport. The player must be able to drag the field in both
axes until every reachable edge of the large map can be inspected. A captured creature is handled by the later
capture/result flow; field panning must not be represented as capture or as avatar locomotion.

Owner confirmation additionally identifies the original hand tool as contextual direct manipulation:

- Cage: drag empty field space to pan; grab a creature and drop it onto another valid cage/grid location.
- Hunt: drag empty field space to pan; after capture, the capture/result flow can accept the creature.

The exact Cage pick/drop precedence and the Hunt post-capture transaction still need their own handler traces. They
must not be guessed from the camera code below.

## Binary authority

- Research-only ROM: `YDIJ.nds`
- SHA-256: `8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1`
- Hunt/capture overlay: `arm9_overlay_0000.bin` (`OVL0`), loaded at `0x0210B000`
- ROM and unpacked payloads remain research-only and are not runtime/shipping assets.

## Reproducible static trace

OVL0 reads the shared touch state and coordinates, retains the preceding touch position, then applies the inverse
delta to two field-window coordinates:

| Address range | Observed operation | Interpretation |
|---|---|---|
| `0x0211C6B0..0x0211C6C8` | Read shared input state at `0x0210A714` and X/Y halfwords at `0x0210A730` | Hunt handler consumes the common stylus state |
| `0x0211C8F0..0x0211CA38` | Read the touch transition at `0x0210A71A`, save X/Y, perform field/entity hit tests, and maintain drag state | Contextual gesture begins on the Hunt field |
| `0x0211CA38..0x0211CA54` | Compute `previousX-currentX` and `previousY-currentY`; call `0x0211D9F0` while dragging | Pointer delta pans the field in the opposite direction |
| `0x0211CE68..0x0211CE84` | A second Hunt state repeats the same inverse-delta update | Panning is preserved across Hunt interaction states |
| `0x0211D9F0..0x0211DA54` | Add deltas to field-window X/Y and clamp them | This updates the camera/window, not an avatar target |

The clamp is especially decisive:

- horizontal maximum = field width minus `0x100` (256 pixels);
- vertical maximum = field height minus `0xC0` (192 pixels).

Those are the Nintendo DS screen dimensions. The values are camera-origin bounds over a larger world, and cannot be a
character destination constraint.

## 2026 implementation consequence

The current VS2 prototype does not have parity here: its field pointer handler converts a tap/drag to world coordinates
and calls `source.intents.moveTo(...)`, while its camera follows the product-authored actor. This remains useful prototype
scaffolding but must be replaced by a persistent, clamped camera-pan intent before Hunt input is called original-faithful.

Required event priority for the parity implementation:

1. an active capture/tool gesture owns the pointer;
2. an eligible creature/object hit may begin that contextual interaction;
3. otherwise a field drag pans the camera by inverse delta;
4. taps must not silently become avatar movement;
5. pointer cancel/up must release capture safely and preserve the final clamped camera origin.

This trace verifies the field-pan grammar and 256x192 clamp relationship. It does not yet verify inertia, elastic edge
behavior, multi-touch behavior, exact hit radii, or capture/result mutations.
