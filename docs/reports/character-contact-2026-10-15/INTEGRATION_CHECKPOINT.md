# Isolated shadow integration checkpoint

Integration base: deployed main `b8e50049a02d17d56a04249d412ccc7022632d4e`. Only source commits `ffa5c9e7ac81ca812fd450a577eb90325dcb1ffc` and `fcbc0f1ef92426cec28041a297c637e0240d4dcc` were cherry-picked, as local commits `b54bb942` and `6234604a`. Patch02's silhouette module and CI classification were not applied. All seven deployed globe/tool/label product files remain byte-identical to the base.

The source was first inaccessible in the default sandbox. The explicitly authorized formal `require_escalated` read-only approval succeeded for the same path and four Git checks; no ACL or security setting changed. The source repository remained read-only.

Fresh execution in this existing integration workspace, without a skip/name exclusion:

```
node --test --test-reporter=tap tests/championship-hunt-contact-shadow-cases.mjs tests/championship-hunt-shadow-render-cases.mjs tests/championship-native-character-animation-cases.mjs tests/championship-raising-native-sizing-cases.mjs tests/championship-licensed-character-roster-cases.mjs tests/championship-feedback-art-cases.mjs
```

Result: **51 tests passed,0 failed,0 skipped**. This includes the complete224-art/228-species material audit (17,235 cells,11,480 sequences,503 atlas pages). These are new integration results; the source's earlier50-test receipt with an excluded pixel audit remains historical evidence. Passing material integrity does not establish visual acceptance of every character.

The existing bounded pixel-audit script was executed with its output redirected into internal QA rather than replacing historical source receipts: **12 reviewed support cells and the three exact selected atlas hashes passed**. No art bytes changed. Only m104 cell0, m006 cell23 and mirrored m203 cell1 plus their explicitly measured support cells are in the accepted contact scope; no all216-character visual claim is made.

Integration refreshes only the three changed product source hashes in the existing build contract. The controlled fixture now imports the already installed pinned Pixi package instead of a CDN; no dependency was installed. Body origin, worldZ, native animation, egg contact, gameplay and saves are preserved.

At the parent's new urgent mobile-globe feedback, this branch is saved at a safe checkpoint. Normal Hunt browser re-entry, new controlled-render replay, final build/validator and full exact-head hosted CI are **not yet executed for this branch**. No shadow PR, push, merge or deployment has occurred. Resume these gates later; do not promote this checkpoint to release-ready. The urgent UI correction is isolated on another branch.
