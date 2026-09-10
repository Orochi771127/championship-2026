# BM07 Cyberspace R1 prompt record

Generator: OpenAI image generation through the Codex imagegen skill, 2026-09-02.

## Generation

Create an original production-ready independent cyberspace battle arena on a 3:2 landscape canvas. Use a high three-quarter tactical camera, a complete closed indigo/teal circuitry perimeter, four original energy pylons, and a broad dark glass/data floor. Keep the central area readable at mobile size. No characters, UI, text, logos, franchise symbols, or recognizable copyrighted motifs.

## Cleanup edit

Remove all model-drawn standing-zone rings and reconstruct the underlying floor while preserving the arena, framing, lighting, palette, and texture. Add no new marks or symbols.

## Deterministic postprocess

`scripts/build-battle-bm07-cyberspace.py` adds exactly six rings at centers `(440,400)`, `(768,400)`, `(1096,400)`, `(440,632)`, `(768,632)`, `(1096,632)`, all with radius `96`. These coordinates are original production choices and were not extracted from the ROM reference.
