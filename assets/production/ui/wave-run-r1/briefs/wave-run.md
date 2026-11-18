# Art request: wave run (story + challenge) field pieces and the magnet talent (2026-11-18)

From Claude (systems / UI) to Codex (art), at the Owner's direction: story and challenge battles become a run of
waves. Beaten foes drop coins and items on the battle field; the player taps them up (or a magnet talent pulls
them in). In the challenge, after every won wave a rest panel offers two keys: leave with the loot, or fight on.
The Owner wants this to read as a game with pictures, not words.

## Style (must match the set you already drew)

Look at `reference/*.png` first: `trader.bounty`, `line-trader`, `exp-crystal`, `evolve-ready`, `lock-level` are
your own stickers, `hud.png` is the live arcade HUD and `bits-coin-hud.png` is the game's official Bits coin.

- Chunky arcade sticker: thick dark ink outline (#0e101a), flat saturated fills with ONE lit facet and one small
  white glint, a short hard drop shadow straight down. No soft airbrush, no photo texture, no 3D render.
- ONE clear object per picture, centred, even padding, readable at 32 px and at 96 px. No text, letters or numbers.
- Every coin you draw is the game's Bits coin from `bits-coin-hud.png` (same gold, same rim, same face mark).
- Original designs only. No logos, characters or symbols from any existing game or brand.

## Deliverables

Transparent RGBA PNG, 256 x 256 each, written to `out/` with exactly these file names:

- `trader.magnet.png` : talent icon, Trader line (amber #ffb020 / #ffe08a accent): a horseshoe magnet pulling two
  small Bits coins toward it with short pull lines.
- `drop-coins.png` : a small pile of three or four Bits coins lying on the ground, one tilted up catching light.
- `drop-coin-heap.png` : a bigger heap of Bits coins (used when many piles merge), still one object.
- `loot-bag.png` : a bulging loot sack tied with a cord, a Bits coin peeking from the top (the run's loot so far).
- `threat.png` : the next wave's danger mark: a red horned fang-mask badge (an original monster face, simple).
- `key-leave.png` : the leave key's picture: the loot sack with a short arrow curving out to the side (exit with loot).
- `key-continue.png` : the continue key's picture: two crossed short swords with a forward chevron (fight on).
- `wave-flag.png` : a pennant flag on a short pole, cyan #39d7ff with a white stripe (the wave banner's mark).

Also write `out/NOTES.md`: one line per file on what was drawn.

## Rules

- Everything is original and made for this game.
- Work only inside this folder. Do not touch any repository.
