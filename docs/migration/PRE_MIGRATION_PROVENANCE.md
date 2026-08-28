# Pre-migration provenance

The clean repository deliberately does not import earlier Git history. These immutable local checkpoint IDs are the audit trail:

| Checkpoint | Role |
|---|---|
| `d7a66b102e95ae6c19b0820cfa93092651c060d8` | recovered research/runtime root; excluded forensic staging is reproducible here |
| `2632ddffac6da82525ed2e9089799e42fbffc25c` | Raising toolbar evidence contract |
| `2671db12bc8c604a33d7f72a946256924983908b` | INT-RH2 runtime contract, producer, runtime tests, Pixi field presentation |
| `bb61d18d014db92f878862b1fe2b69092f02d0ad` | accepted INT-RH2 presentation checkpoint |
| `cb0dc0221f04ec1898c052d7713ba72dae2d6ef7` | prior coordination repository HEAD before standalone migration |

The source repositories and their worktrees remain unchanged and recoverable. The discarded first migration draft is independently recoverable from `../_archive/migration-draft-preclean-20260828.bundle`; that bundle is outside this repository and is not product history.

No ROM payload, decoded art, 35 MB forensic staging artifact, or unrelated product subsystem is admitted by these checkpoint references.
