# Release candidate branch audit

Checked on October 17, 2026 (America/New_York). Candidate: `feat/supabase-multiplayer` in `Sproutbound/Promerus`. No hosted database, Auth0 tenant, Gemini service or production data was changed.

## Branch comparison

| Remote branch | Fetched head | Finding and action |
| --- | --- | --- |
| main | f6fc248 | Four commits were unique in history, including uploads/deletions and release merges. Its tree matched dev. Preserved the full main ancestry with history-only merge `6854939`; no main changes were pushed. |
| dev | 5bab818 | Already included in the candidate. Contains themes, demo weekly leaderboard, world boundaries/outlines, avatar palettes and locomotion updates. Preserved. |
| feat/supabase-multiplayer | 63b7bae before consolidation | Contains the approved staging backend and prior dev integration. Used as the release candidate. |
| Jojo_dev_update | 3a18fd8 | Ancestor of the candidate. No missing commits; historical branch left unchanged. |
| Jojo_test_frontend | 4f02f48 | Ancestor of the candidate. No missing commits; historical branch left unchanged. |
| feature/sproutbound-auth | 16cc01b | One missing teammate commit. Integrated the branch and its standalone UI/docs/tests, and ported compatible adapter improvements to the served Next.js app. |
| Questionnaire | 4ee4d41 | Separate Python scoring prototype adds global score tracking, nutrients and coins. Left on its branch: this is a different economy, runs reward output at module scope, and cannot replace verified server rewards. Its generation/grading foundation is already retained in the original CLI and backend. |

No additional remote feature branches were present at this fetch. No teammate branch was deleted or rewritten.

## Integration details

- Auth0: safe provider error messages, cleanup of callback parameters even on failures, bounded SDK background timeouts, explicit full-tab fallback retaining signup intent, and the original popup login flow. No provider, identity, tenant, login system or claim policy was replaced.
- The served adapter retains `getToken(expectedSubject)` and its account-change check for the approved Auth0/Supabase boundary. Both standalone and served adapters run the teammate's regression cases.
- Existing greenhouse art, navigation, sprites, customization, cursor, movement geometry, Sproutling, lessons, Gemini source integration, greenhouses, presence, shared energy/progression and cooperative quest implementation remain.
- Removed previously tracked Python bytecode from the index; local ignored bytecode is not source and is not needed in a release.

## Validation

| Check | Result |
| --- | --- |
| npm run typecheck | Pass |
| npm test | 50 pass |
| npm run test:auth | 52 pass |
| npm run test:backend | 28 pass |
| Python unittest discovery in Promerus | 4 pass, offline provider mocks |
| Python pip check in isolated environment | No broken requirements |
| npm run build | Pass, static /, /game and /learn |
| Deno check of game-api with pinned dependencies | Pass |
| node --check of first-party auth scripts | Pass |
| Git whitespace/conflict-marker/secret/generated-file review | Pass; no environment files or secret values added |

Total: **134 passing tests**. These are source and local build checks, not production certification. No standalone ESLint target exists.

## Dependency advisory impact

The refreshed npm audit reports two affected packages: high-severity PostCSS and moderate-severity Next via its bundled PostCSS. The installed Next 15.5.28 pulls vulnerable PostCSS under `node_modules/next/node_modules/postcss`. The reported fixes include CSS stringification XSS and source-map file disclosure/path traversal risks when processing attacker-controlled CSS. The current application does not provide a user CSS upload/compiler, but this does not constitute a complete exploitability assessment or remove the advisory.

npm proposes Next 16.4.2 as a major-version remediation. No force-fix, untested framework migration or security override was applied. Resolve and revalidate the affected dependency chain before production release. Advisory references: [CSS output XSS](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [source-map disclosure](https://github.com/advisories/GHSA-6g55-p6wh-862q), [incomplete source-map fix](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [path traversal](https://github.com/advisories/GHSA-r28c-9q8g-f849).

## Review and promotion gates

The GitHub account can push but has no admin permission. No repository rulesets were returned. This does not substitute for the user's required team review: open the backend candidate PR into dev and stop before merging while approval is absent. Do not self-approve or bypass reviews.

After approval, re-fetch and pin the reviewed PR head, merge into dev, and validate the actual merged dev. Compare against then-current main, preserve both histories, and open dev into main for its own team approval and checks. The present candidate already includes fetched main and dev ancestry; current dev and main have identical trees, so opening their promotion PR before backend integration would not promote the backend.

Do not sync historical feature branches just to make their heads match. Reassess active branches only after an approved main baseline exists, preserving unique commits.

## Required for a real multiplayer demonstration

Provide the dedicated staging project and secure deployment access, configure the approved Auth0 trust/Action and server-stored Gemini key, inspect staging schema history, apply reviewed staging migrations, deploy the Edge Function, and verify Realtime/security setup. Then test two real authenticated accounts in independent sessions for avatars, presence/movement, studying, verified lessons, shared energy/growth/Sproutling, refresh/reconnection, reward replay and unauthorized/revoked access. Hosted Supabase/Auth0/Gemini integration remains unverified. See [staging setup](backend-staging-setup.md).
