# BATTLE lane handoff — 2026-09-02

Written by the Claude lane at the end of a long session, for whoever picks it up
next. `CLAUDE_REBUILD_STATUS.json` is the machine-readable version of everything
here; this file is the part a person needs to read first.

## Where the work stands

A match runs end to end on cartridge data and produces a real verdict.

```
seed 0x14  VERIFIED_BINARY  181 frames  TEAM_DOWN  TEAM_ZERO_AHEAD
           hp [1080,1080,-,520] -> [929,992,-,0]   down [F,F,-,T]
seed 0x20  VERIFIED_BINARY  271 frames  TEAM_DOWN  TEAM_ZERO_AHEAD
           hp [1080,1080,-,520] -> [874,961,-,0]   down [F,F,-,T]
```

`node --test tests/*.mjs` → **704 passing, 0 failing**. Nothing is committed.

The chain that now works:

```
AI selection (buckets from the creature's own move list, reserve from the clock tier)
  -> a committed action carrying its move record
  -> that move's +0x28 script, running the cartridge's own bytecode on the traced VM
  -> the attack native 0x0211D71C -> 0x0211D740
  -> the damage resolver 0x021149A8
  -> applyBattleHp, the death clamp, the downed tally
  -> checkBattleEnd -> judgeBattle -> a verdict
```

## The one lesson worth carrying

**Eight defects surfaced in this session and not one was a misread of the ROM.
All eight were wiring, and none was visible by reading the code.** They only
appeared when a real match was run with real data.

Two of them had confident, well-cited comments explaining the wrong behaviour.
The death test is the sharp example: `battleFrameLoop` had it inside the status
tick with a note reasoning about "the `hp < 0` path", which sounded grounded and
was wrong — the ROM runs that test unconditionally at 0x0210D790, before the
status check. The consequence was that a combatant with no status could never be
reported dead, so a match could only ever end on the clock. Reading the module
would not have caught it. Running a battle did, in about a minute.

So: **when a stretch of this lane is "done", run a match and look at the numbers
before believing it.** The list of all eight is in
`CLAUDE_REBUILD_STATUS.json → completedDamageChain.bugsFoundByRunningIt`.

## What is deliberately not finished

**The product creatures are out of the battle path**, at the Owner's direction on
2026-09-02. Greyshade Cat and the other two have no ROM species id, so
`buildMoveBucketsForSpecies` gave them species 0 and they could never attack —
the opponent took no damage at all for a whole match. Both sides now field ROM
teams, which is why `rosterEvidence()` reads `VERIFIED_BINARY`.
`battle-player-roster.v1.json` is kept and `residentIds` still works; putting
them back needs declared move lists, which is an Owner decision and not a trace.

**The sprite cell box, ARM9 0x02047E58.** This is the single dependency the rest
of the stage waits on, and it is one routine. It supplies the launch position
(OVL19 0x0211C098 centres a new in-flight object on the box) and the three unread
animation natives 0x0211D238, 0x0211D298 and 0x0211D33C. It walks the object's
+0xC8 and +0x70 into the animation runtime and returns the current cell as four
signed halfwords. That is the creature's loaded sprite — art-lane and OVL9
resource-manager territory — so it is modelled as an INPUT
(`battleLaunchPool.launchPosition` takes the box) and nothing derives it.

**State 0x17 has no translated body.** It is the one seam a finished match still
reports, and it is honest.

**One script entry has not been found.** The blob reads a local implying fifteen
arguments; the widest traced frame is fourteen (+0x28). There is a start site
somewhere this lane has not located. A test pins the gap so it is not forgotten.

## Rules that bit hardest, and why

- **Rule 1, don't invent.** Where the ROM does not decide, the code says so:
  stand positions are `PRODUCT_AUTHORED`, the `+0x54` side values are not traced
  (only their inequality is, and the walk only tests equality), the schedule pair
  a fresh save starts at is untraced.
- **Rule 2, dump it yourself.** The Owner supplied a Bahamut write-up mid-session.
  It was read and used only for naming and legibility — it corroborated the
  schedule pair as season and day against the already-dumped moduli 4 and 8, and
  it calls the resource "TP". No number came from it, nothing was renamed, and it
  did not answer whether a fight is player-controlled. That reading still rests on
  the trace alone.
- **Rule 3, decode properly.** Two magic numbers were verified numerically rather
  than read: the 900-frame clock divisor across 0..99,999, and the mod-8 pacing of
  the first pool walk. The sin/cos table at 0x02099D6C was checked against a
  closed form across all 4,096 rows and both columns, zero mismatches, so the
  16 KB table did not need carrying.
- **Rule 8, Codex shares the tree.** `git status --short` before anything, stage
  by path, never `git add -A`. `styles.css` is claimed by BOTH manifests, so this
  lane added `vs5Styles.css` rather than editing it.

## One thing that crosses a stated line

`src/data/championship/catalogs/battle-scripts.r1.json` carries the OVL19 script
segment — 63,748 bytes of the cartridge's own bytecode, in `blob.base64`. It has
been there since the B2 pass. The Owner was asked about it on 2026-09-02 and
authorized it; it then turned out to already be present, so the decision ratified
rather than authorized. The migration firewall's payload test matches on file
extensions and never saw it, so a case was added that names this one file and
fails if a second appears.

Without it the move scripts would have to be hand-written across 22,032 reachable
instructions, which is what rule 1 exists to prevent.

## Suggested next steps, in order

1. **The sprite cell box** — decide with the Owner and the art lane how it
   reaches the battle. It is the only structural dependency left.
2. **State 0x17's body** — small, and it closes the last seam a finished match
   reports.
3. **The missing fifteen-argument script entry.**
4. **Move lists for the product creatures**, when they come back.
5. The remaining unread natives, ranked by how many scripts want them in
   `CLAUDE_REBUILD_STATUS.json`.

## Files this lane owns and touched

New modules under `src/championship/battle/` this session: `battleOutcome`,
`battleCreatureBuild`, `battleDamageInputs`, `battleMoveBuckets`,
`battleMoveScriptRun`. Also `src/championship/app/battlePresentationSource`,
`battleRosterSource`, `battleRuntime`, `vs5Screens`, `vs5Styles.css`, and
`src/championship/presentation/vs5/createBattleFieldPixiPresentation.js`.
Contracts: `battle-field-presentation.v1.json`, `battle-player-roster.v1.json`.
Builders: `build-creature-catalogs.py`, `build-battle-script-blob.py`.

Do not edit `styles.css`, `raisingHomeP1RView.js`, `intRh2Styles.css`, or
anything under `assets/production` / `docs/art` — those are the Codex art lane's.
