# Two-phase development status

## Phase 1 — frontend integration and multiplayer backend

**Local implementation is prepared; hosted integration is not yet verified.** The user approved the staging architecture and is arranging the staging project/access. No production database structures were changed.

### Integration completed

- PR #2 was merged into dev after explicit user approval, at `3a18fd8998b197354230e811df094da7684f8cbf`.
- Local dev and Jojo_dev_update were fast-forwarded; origin/Jojo_dev_update was synchronized without force-pushing.
- PR #1 was subsequently merged by Gabriel-Kravets on 2026-10-18 at 00:20:31 UTC, at `7bd0d23b2a36591b24e1376a2c4d6f25e485a994`. This agent did not merge it or modify main.
- `feat/supabase-multiplayer` was created from the approved dev merge. All backend work stays on this branch. Latest teammate dev through `5bab818ee1fe32aff43001f7cbc4371e437bdc8e` was then integrated here without changing dev/main, preserving themes, leaderboard/demo behavior, outlines, railing boundaries and locomotion updates.

### Source implementation

| Subsystem | Implemented behavior |
| --- | --- |
| Identity and profiles | Reuse Auth0; SDK ID-token renewal, exact issuer/audience/signature/role checks, UUID mapping from issuer+subject, actor-scoped profile APIs and RLS. |
| Onboarding and customization | Resumable first-time profile, optional intro skip, interests/level/goal/time, persistent avatar/name, versioned appearance updates and existing portrait/sprite rendering. |
| Greenhouses | Online top-right Greenhouses navigation, create/join/switch, private invitations, public listing/permitted visits, four-slot leases, explicit controller takeover, owner room/invite controls; tree and keyboard-accessible action retain garden progression. |
| Presence and movement | Actor-bound online leases, heartbeats, statuses, validated speed/geometry/sequence, remote interpolation/walking poses, session recovery and stale-account/world response guards. |
| Shared progression | Server-only evaluated completion, global per-player canonical lesson uniqueness, immutable +20 ledger, shared totals/contributions, stage thresholds and distinct-contributor Moonlight Bloom unlock. |
| Sproutling | Shared server-time route, deterministic phase per world, shared celebration pauses and authenticated bounded reactions; teammate locomotion behavior retained; ambient effects still honor motion preferences. |
| Learning | Persistent personal paths/lessons/answers, trusted authored fallback, personalized five-lesson Gemini jobs, four-MC/one-short-answer generated format, hidden server solutions/rubrics, quota/failure handling and atomic job publishing. |
| Preservation | Existing greenhouse/art/assets/cursor and the latest teammate geometry remain; old browser demo is retained when online configuration is absent. Account caches are isolated; demo rewards are never trusted/imported. |

Daily flashcard/focus counters and timer state remain account-scoped device-local practice data. Verified lesson/path progress, completion rewards and the cooperative world quest use the backend. Focus/cards do not mint shared energy.

### Verification performed

- TypeScript and production build passed; static `/`, `/game`, `/learn` remain available.
- Frontend/auth suite: **50 tests** passed.
- Backend suite: **28 tests** passed using cryptographic JWT fixtures and embedded PostgreSQL. This covers migrations, actor isolation, private solutions, membership/visit/owner policies, anonymous denial, channel access/epoch, capacity, takeover, movement concurrency, shared reactions, generation idempotency and reward replay/quest invariants.
- Existing Python CLI dependencies install in an isolated temporary environment; **4 offline tests** passed and `pip check` found no broken requirements. No paid/live provider call was made.
- Supabase Edge Function passed Deno type checking against pinned dependencies.
- Browser regression used a separate loopback production-export fixture with fictional authentication and backend configuration absent. The existing saved greenhouse/study path/portraits rendered, a complete lesson replay returned Practice complete without duplicating energy, and no browser console errors were captured. This fixture is outside the repository and is not evidence of live multiplayer.
- No standalone ESLint configuration/script exists. Do not report a separate lint pass.

PostgreSQL tests emulate Supabase auth/Realtime primitives and execute real PostgreSQL policies/functions; they do not emulate the hosted gateway, WebSocket service, Auth0 tenant configuration or external Gemini availability. Concurrent multi-connection races and full configured-online browser flows still require staging tests.

### Generator audit and teammate work

The original frontend had authored lessons plus a simulated generation delay; it did not call the Gemini CLI. The CLI's missing google-genai/python-dotenv requirements were corrected and generation/choice validation/short-answer/missing-key behavior was tested offline. Its original source is preserved.

`origin/Questionnaire` contains a separate nutrients/coins scoring extension. It was inspected but not merged or used to replace the existing +20 economy. During this work, `origin/feature/sproutbound-auth` advanced to `16cc01b62ad1e6311e214edcc23e5abf7eaa57a2` with standalone login UX/tests. That unmerged branch was inspected and preserved. Its root auth adapter changes must be reconciled separately when approved; keep the backend's integrated `public/auth/auth.js` getToken extension when incorporating the teammate's loginInTab/errorMessage work. A later fetch found four new dev commits through `5bab818`, which were integrated into the backend branch and rechecked. Online mode uses the teammate’s board styling for real, all-time greenhouse contributions; the demo weekly board remains unchanged. It does not present simulated weekly totals as live data.

### Required before Phase 1 can be signed off

1. Identify and inspect the dedicated staging Supabase project and existing schema/history.
2. Configure the approved Auth0 integration/Action, exact app audience and RS256 settings.
3. Apply the reviewed migrations and deploy the Edge Function with secure server configuration; enable/policy-check Realtime and scheduled cleanup.
4. Verify real Auth0-to-Supabase requests, configured online screens, WebSocket updates, reconnection and live Gemini generation/grading with the team's quota.
5. Assess the two existing npm advisories through PostCSS bundled with Next 15.5.28 before release. No force-fix/major framework upgrade was applied. New Supabase/JWT dependencies were not listed in that report.

Client/server movement now share the teammate’s updated geometry under protocol `moonlit-v2`; old geometry payloads are rejected. Avatar palettes and tooltip/tree outlines from dev are retained.

Setup details: [backend-staging-setup.md](backend-staging-setup.md). Architecture approval: [backend-architecture-proposal.md](backend-architecture-proposal.md).

## Phase 2 — end-to-end testing and release

Not signed off. It requires two real Auth0 accounts in independent sessions/devices, shared-room avatar/movement/status checks, verified lessons and shared energy/growth/Sproutling, refresh/reconnection, duplicate/race prevention, and unauthorized/revoked access tests. Fix defects and validate the actual combined dev before release review. The backend PR into dev and final main promotion remain review/approval gates; no automatic main merge and no force-push.

Powerups, competitive stealing and ESP32 integration remain excluded.
