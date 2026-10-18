# Main-based priority integration — 2026-10-18

## Baseline and scope

Branch `feat/main-worlds-integration` starts at latest fetched main `e23b35f865946dd96ef9e7b00253e8f24901705d`. Gabriel-Kravets (Git author Zioxz) added room-item editing, shared-collection previews, shop, current tree bed geometry and gameplay controls in `d26c0d68ccf4f804a2f9f56fcddfe24cf44aa067`, merged by e23b35f. Rudy's latest login artwork/UI through `74c7f66` and Auth0 integration merge `aafdef9` are preserved. Current dev is older (`0756b5f`); no old dev UI was used to replace main.

Existing backend source comes selectively from `af3d505a22d8e687588fc9a31ebc23962a684ba2`. Root Auth0/HTML prototypes and Questionnaire's nutrients/coins scoring were not imported. No shared branch was changed. The requested review destination is now main; this branch is a PR candidate, not an approved release.

## Connected flow

- Main's Auth0 popup, signup, callback cleanup, environment-based identifiers and new login design remain. The existing account-bound ID-token renewal method connects the Supabase client.
- Character/avatar/preferences save through the existing save_profile RPC. Completing character creation leads to a separate Sproutling introduction. Continue and Skip persist seen/skipped; completed returning players bypass the introduction.
- Greenhouse Worlds reuses list_greenhouses, create_greenhouse, join_greenhouse, request_visit and enter_greenhouse. My Worlds shows actual memberships; Explore Worlds retains owner-permitted browsing/visits. Continue saved greenhouse uses the stored last_greenhouse_id and existing entry/takeover checks.
- Existing profile, avatar, presence, movement, lessons, verified energy, contribution, garden, quest and Sproutling code is reused. Main's roster progress and minimizable board are retained with real data. Central-tree progression remains available.
- No new tables, login system, AI features, production changes or hosted deployments were introduced.

## Compatibility limits

Main's shop and editable furniture are device-local prototypes; the existing 21-table backend has no shared furniture-layout storage. Online purchases/placement are explicitly read-only, while main's original local-demo editing remains intact. This prevents one player's local furniture from moving a shared study desk or changing server-authoritative collision geometry. Online navigation also conservatively reserves the deployed moonlit-v2 validator's previous bed bounds alongside main's newer bed, preserving artwork without routing into positions staging rejects. A later shared-layout integration/protocol deployment needs separate work.

The new introduction/returning-player routing and token renewal have automated coverage. A returning real account was refreshed at localhost:3000, loaded actual memberships and the four requested world sections, then continued its saved greenhouse. The live room showed two real customized avatars, 100 shared energy through the Sprout/Bloom progress display, saved +20 contribution rows, Sprout tree and active Sproutling. No fresh real account onboarding or new invite/create workflow was repeated during this timebox; previous hosted verification is recorded separately in backend-staging-setup.md. Full two-account movement/replay/reconnection/adversarial/celebration acceptance remains incomplete. Gemini reliability/content-quality issues from the previous pass remain outstanding.

## Four permanent members — approval required

Current join_greenhouse admits permanent members without a four-member count; enter_greenhouse limits only active leases. The owner is already a permanent member. Prepared exact SQL: `supabase/proposed-migrations/202610180005_four_permanent_members.sql`.

Supabase SQL Editor query name: **26_Sproutbound_Four_Permanent_Members**.

Expected result after approved execution: **Four-permanent-member admission guard installed; existing memberships preserved**. The guard serializes admission on the greenhouse row, counts owner and offline memberships, rejects a fifth member, and leaves visit/lease rules unchanged. A preflight aborts without changes if any existing room exceeds four members. Local PostgreSQL testing verified the rejection, unchanged invitation-use count and idempotent rejoin by an existing member.

**Not deployed.** The proposal deliberately lives outside supabase/migrations so normal db push will not silently apply it. Obtain approval, inspect current staging migration history, and then move it into the versioned migrations directory/apply the exact reviewed SQL. No SQL audit queries were repeated here.

## Checks and deployment gates

- TypeScript passed.
- Frontend/gameplay/Auth0 tests: 149 passed, including Gabriel's furniture/gameplay regression tests and account-bound token renewal.
- Backend/PostgreSQL tests: 32 passed, including onboarding routing and the proposal tested only in embedded PostgreSQL.
- Production static build passed; /, /game and /learn exported.
- Edge Function Deno type check passed. No hosted deployment was performed.
- No standalone lint target exists. Python tests were not rerun in this timebox.

Known npm findings remain: one high and one moderate affected package through Next/PostCSS. No forced dependency remediation or unrelated framework upgrade was attempted.

Before a hosted frontend deployment, set both public Supabase variables plus existing public Auth0 identifiers in that hosting environment and rebuild. Add its exact frontend origin to the existing game-api APP_ORIGINS configuration and Auth0 allowed callback/logout/web origins through the approved configuration workflow. localhost staging success does not verify a Vercel/production origin. Keep privileged Supabase and Gemini keys server-only.

Review this PR against main. PR #3 remains the prior backend candidate; do not merge both blindly, since this branch selectively carries its backend into the newer UI. No merges or force-pushes are authorized by this report.
