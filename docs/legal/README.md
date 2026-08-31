# Rights evidence registration

This directory contains the non-sensitive rights ledger used by the build and
release process. It does not contain contracts, signatures, identity documents,
ROM files, or decoded proprietary source payloads.

## Where the actual document goes

Store the signed authorization or licence in the Owner/legal team's private
document vault. A local working copy may be placed in `docs/legal/private/`,
which is git-ignored, but the preferred source of truth is a backed-up private
vault with access control and an audit history.

Register only these facts in `RIGHTS_EVIDENCE_REGISTRY.json`:

- a stable evidence ID;
- the covered game, asset families, territories, platforms, and uses;
- the authorization date and expiry date, if any;
- a private-vault reference and SHA-256 of the signed document;
- who verified it and when;
- whether conversion, runtime integration, and release are permitted.

Never put a private vault URL with an access token, personal identity details,
signatures, payment terms, or the signed file itself in this repository.

## Who can see each layer

- Repository collaborators can see this metadata registry and its evidence IDs.
- Only the Owner and authorized legal/administrative staff should see the signed
  document in the private vault.
- Builds and players see only an evidence ID embedded in a production manifest;
  they do not receive the registry or the signed document.

An Owner instruction recorded in a project task can authorize conversion work,
but it is not represented as a signed licence. Shipping remains blocked until a
reviewer links and verifies the actual document in the private vault.
