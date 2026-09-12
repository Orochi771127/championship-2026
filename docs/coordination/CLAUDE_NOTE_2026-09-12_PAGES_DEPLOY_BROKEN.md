# The public playtest has not deployed since `24754a4`

Date: 2026-09-12
From: Claude Code
Severity: blocks Owner QA entirely — **read this before committing CSS work**

## What is wrong

The live site is stale. It does not contain the interface rebuild, the QA
unlock, or the battle-entry fix. Measured against
`https://orochi771127.github.io/championship-2026/championship.html`:

| probe | live | expected |
|---|---|---|
| `<link rel=stylesheet>` count | 9 | 10 |
| mentions `nativeUiSkin` | no | yes |
| `src/championship/app/nativeUiSkin.css` | **404** | 200 |
| `src/championship/app/qaUnlock.js` | **404** | 200 |
| `main.js` contains `enterPreparedBattle` | no | yes |

Pages runs, from the Actions history:

| commit | CI | Pages |
|---|---|---|
| `24754a4` | pass | **pass — this is what is live** |
| `a1027c5` QA grant | fail | fail |
| `96424e3` review request | fail | fail |
| `f48e7bd` review fixes | pass | **fail** |
| `b42ead6` this handoff | pass | **fail** |

Codex's CI-scope fix did repair `test:ci` — CI is green again from `f48e7bd`.
The Pages job still fails, one step later.

## Why

Job `build`, step 6 `npm run build:playtest`. Steps 1-5 including `Test` pass;
7-9 are skipped.

`docs/contracts/championship/WEB_BUILD_INPUTS.v1.json` stores a sha256 per
published file, and `scripts/lib/web-build-plan.mjs:109` raises
`PLAYTEST_APPROVED_BYTES_CHANGED` when a file does not hash to its stored value.

`.gitattributes` mandates LF (`*.css text eol=lf`, and the same for js/html), so
the repository and the Linux runner hold **LF**. This Windows working copy holds
**CRLF** — the files were written with CRLF, and git's filter hides that because
the blob is normalised on the way in. `scripts/refresh-playtest-approval.mjs`
hashes `readFileSync(path)` raw, so it recorded the **CRLF** hashes.

So the record can never match on the runner. Locally it passes, which is why
`build:playtest` and `validate:playtest` both report PASS here.

Verified on `nativeUiSkin.css`: working copy 95,435 bytes with 1,744 CRLF pairs
hashing `fe373e39…`, committed blob 93,691 bytes with 0 CRLF hashing
`5626c050…`. The record stores `fe373e39…`.

**Exactly 11 rows are affected** — every file touched by this UI work:

```
championship.html
src/championship/app/championshipStandaloneApp.js
src/championship/app/championshipToolbar.js
src/championship/app/main.js
src/championship/app/nativeUiSkin.css
src/championship/app/openingPresentation.js
src/championship/app/vs2Screens.js
src/championship/app/vs4Screens.js
src/championship/app/vs5Screens.js
src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js
src/championship/presentation/shopGoodsUiArt.js
```

The other 6,265 rows match. Six further rows are `node_modules` vendor files
absent from HEAD; `npm ci` restores them identically, and they are not at issue.

## The fix

Make the working copy match what `.gitattributes` already mandates, then
re-record. No product code changes, and the approval contract keeps meaning
"these exact reviewed bytes".

With a clean tree:

```bash
node -e "const{execFileSync}=require('child_process'),fs=require('fs');for(const p of process.argv.slice(1)){const b=execFileSync('git',['show','HEAD:'+p],{maxBuffer:1e9});const w=fs.readFileSync(p);if(w.equals(b))continue;if(!w.toString('binary').split('\r\n').join('\n')===b.toString('binary'))throw new Error('content differs: '+p);fs.writeFileSync(p,b);console.log('normalised',p)}" championship.html src/championship/app/championshipStandaloneApp.js src/championship/app/championshipToolbar.js src/championship/app/main.js src/championship/app/nativeUiSkin.css src/championship/app/openingPresentation.js src/championship/app/vs2Screens.js src/championship/app/vs4Screens.js src/championship/app/vs5Screens.js src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js src/championship/presentation/shopGoodsUiArt.js
```

Then `node scripts/refresh-playtest-approval.mjs`, then `npm run build:playtest`
and `npm run validate:playtest`. `git status` should show **only**
`WEB_BUILD_INPUTS.v1.json` changed — the eleven sources are already LF in git,
so normalising the working copy produces no diff.

**I did not run this.** The guard aborted because the tree was dirty: nine
stylesheets were open, `nativeUiSkin.css` among them. Rewriting files under an
agent mid-edit loses work. Whoever holds those files should land this with them.

## It will recur

Any Windows session that writes a CRLF file and runs the refresh script records
a hash the runner cannot reproduce, and the only symptom is a red Pages run long
after the fact — local `build:playtest` and `validate:playtest` both say PASS.

Two candidate hardenings, neither done here:

1. Have `refresh-playtest-approval.mjs` hash the bytes git stores (normalise
   CRLF to LF for paths `.gitattributes` marks `text`, leave `-text` alone). The
   check in `web-build-plan.mjs:109` has to normalise identically or the two
   sides disagree in the opposite direction.
2. Leave hashing alone and make the working copy authoritative by normalising on
   checkout, then have the refresh script refuse to run on a file whose bytes
   differ from its blob.

(1) is less fragile; it slightly re-reads the contract as "approved normalised
bytes". Owner's call — it changes what the release gate promises.

## Not the cause

`npm ci` and `test:ci` both pass on the runner. Pages is enabled, permissions and
the `push:` trigger are correct, and deploy is only skipped because build failed.
The Node 20 deprecation line on `actions/setup-node@v4` is a warning, not this.
