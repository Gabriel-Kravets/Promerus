# Main-based priority integration — 2026-10-18

## Baseline and scope

Branch `feat/main-worlds-integration` starts at latest fetched main `e23b35f865946dd96ef9e7b00253e8f24901705d`. Gabriel-Kravets (Git author Zioxz) added room-item editing, shared-collection previews, shop, current tree bed geometry and gameplay controls in `d26c0d68ccf4f804a2f9f56fcddfe24cf44aa067`, merged by e23b35f. Rudy's latest login artwork/UI through `74c7f66` and Auth0 integration merge `aafdef9` are preserved. Current dev is older (`0756b5f`); no old dev UI was used to replace main.

Existing backend source comes selectively from `af3d505a22d8e687588fc9a31ebc23962a684ba2`. Root Auth0/HTML prototypes and Questionnaire's nutrients/coins scoring were not imported. No shared branch was changed. The requested review destination is now main; this branch is a PR candidate, not an approved release.

## Connected flow

- Main's Auth0 popup, signup, callback cleanup, environment-based identifiers and new login design remain. The existing account-bound ID-token renewal method connects the Supabase client.
- Character/avatar/preferences save through the existing save_profile RPC. Completing character creation leads to a separate Sproutling introduction. Continue and Skip persist seen/skipped; completed returning players bypass the introduction.
- Greenhouse Worlds reuses list_greenhouses, create_greenhouse, join_greenhouse, request_visit and enter_greenhouse. My Worlds shows actual memberships; Explore Worlds retains owner-permitted browsing/visits. Continue saved greenhouse uses the stored last_greenhouse_id and existing entry/takeover checks.
- Existing profile, avatar, presence, movement, lessons, verified energy, contribution, garden, quest and Sproutling code is reused. Main's roster progress and minimizable board are retained with real data. Central-tree progression remains available.
- No new tables, login system, AI features or production changes were introduced. The existing game-api was updated on staging after the user installed Queries 27 and 28.

## Compatibility limits

Main's collection, shop, furniture controls, party panels and weekly leaderboard retain their original renderers. Backend adapters supply real membership, avatar, contribution and weekly energy data. A separate Worlds control preserves Garden navigation. Shared furniture commands now reuse main's inventory and placement logic, with authenticated active-session checks, permanent membership checks, strict command schemas, server-generated item identifiers, geometry validation and version-checked service-only commits. Movement checks use the saved room layout. Local demo behavior remains available.

Live two-account furniture editing, concurrent edits/movement, rollback and reconnect acceptance have not been completed. Server placement rejects an occupied location rather than reproducing the local automatic gardener nudge; movement/layout writes are not one atomic database transaction. These remain integration limitations, not production-verified behavior. Static same-state browser fixtures were captured for main and the integrated UI; no pixel-identical or full hosted parity claim is made.

The new introduction/returning-player routing and token renewal have automated coverage. A returning real account was refreshed at localhost:3000, loaded actual memberships and the four requested world sections, then continued its saved greenhouse. The live room showed two real customized avatars, 100 shared energy through the Sprout/Bloom progress display, saved +20 contribution rows, Sprout tree and active Sproutling. No fresh real account onboarding or new invite/create workflow was repeated during this timebox; previous hosted verification is recorded separately in backend-staging-setup.md. Full two-account movement/replay/reconnection/adversarial/celebration acceptance remains incomplete. Gemini reliability/content-quality issues from the previous pass remain outstanding.

## Four permanent members — installed and history reconciled

The user applied **26_Sproutbound_Four_Permanent_Members** to staging after the original report. On 2026-10-18, read-only catalog verification confirmed the installed function body matches Query 26, the BEFORE INSERT / UPDATE OF greenhouse_id trigger is enabled on greenhouse_memberships, SECURITY DEFINER and empty search_path are set, and neither anon nor authenticated has direct execute permission. No greenhouse currently has more than four permanent members.

The guard serializes admission on the greenhouse row, counts the owner and offline memberships, rejects a fifth member, and leaves visit/lease rules unchanged. Existing members can rejoin without consuming an invitation use. The preflight rejects an installation over preexisting oversized rooms without deleting memberships.

Canonical file: `supabase/migrations/202610180005_four_permanent_members.sql`, moved from proposed-migrations with executable SQL unchanged. Query 26 returned **Four-permanent-member admission guard installed; existing memberships preserved** according to the user; installation was then independently verified through the database catalogs.

Remote history initially contained only the four original versions. Reconciled only its bookkeeping with:

```sh
npx --yes supabase@2.121.0 migration repair 202610180005 --status applied --linked --project-ref llrrlwuwygkxftgnvvsa
```

**The migration SQL was not reapplied.** No application rows, trigger definitions, policies or production data were changed during reconciliation. Backend tests now apply all five canonical migrations to embedded PostgreSQL and all 32 pass, including the offline-member capacity and unchanged invitation-use assertions.

## Checks and deployment gates

- TypeScript passed.
- Frontend/gameplay/Auth0 tests: 149 passed, including Gabriel's furniture/gameplay regression tests and account-bound token renewal.
- Backend/PostgreSQL tests: 38 passed, including all seven canonical migrations, permanent member counts, service-only layout RPC permissions, version conflicts, membership checks, command validation and placement geometry.
- Production static build passed; /, /game and /learn exported.
- Edge Function Deno type check passed. Updated game-api deployed successfully to staging llrrlwuwygkxftgnvvsa; deployment alone does not verify authenticated live editing.
- No standalone lint target exists. Python tests were not rerun in this timebox.

Known npm findings remain: one high and one moderate affected package through Next/PostCSS. No forced dependency remediation or unrelated framework upgrade was attempted.

Before a hosted frontend deployment, set both public Supabase variables plus existing public Auth0 identifiers in that hosting environment and rebuild. Add its exact frontend origin to the existing game-api APP_ORIGINS configuration and Auth0 allowed callback/logout/web origins through the approved configuration workflow. localhost staging success does not verify a Vercel/production origin. Keep privileged Supabase and Gemini keys server-only.

Review this PR against main. PR #3 remains the prior backend candidate; do not merge both blindly, since this branch selectively carries its backend into the newer UI. No merges or force-pushes are authorized by this report.

Post-repair verification: migration list shows all five local/remote versions matched. `db push --dry-run` returned `upToDate: true`, with no migrations, seeds or roles pending. No migration SQL ran during that verification.


## Queries 27 and 28 — user installed, independently verified

The user ran 27_Sproutbound_World_Membership_Counts and 28_Sproutbound_Shared_Room_Layout in staging. Catalog inspection confirmed list_greenhouses includes permanent member_count, room_layout and room_layout_version exist, and commit_room_layout is SECURITY DEFINER with an empty search_path and executable only by service_role (not anon/authenticated). The commit function checks permanent membership and expected revision while locking the greenhouse row. The four-member admission guard is unchanged.

Canonical files are 202610180006_world_membership_counts.sql and 202610180007_shared_room_layout.sql. Only provenance comments changed when promoting the approved proposals. Reconciled bookkeeping using migration repair for these two versions with --status applied. No migration SQL was reapplied. Subsequent migration list matched all seven local/remote versions; db push --dry-run returned upToDate:true with no migrations, seeds or roles pending.

No production database changes or merges occurred. Remaining hosted acceptance includes fresh onboarding/create/join, two-session shared furniture/movement and reconnection regression. Previously observed intermittent Gemini failures and lesson content quality issues remain unresolved. Existing Next/PostCSS advisories were not changed by this scoped work.
