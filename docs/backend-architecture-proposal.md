# Phase 1 — Supabase multiplayer architecture proposal

Status: **database/security architecture approved by the user on 2026-10-17 for development/staging implementation only**. Hosted project/access configuration is pending. No production database changes are authorized.
Repository: Sproutbound/Promerus. Backend branch: `feat/supabase-multiplayer`.
Approved frontend base: `3a18fd8998b197354230e811df094da7684f8cbf` (PR #2 merge).

## Two-phase roadmap and branch order

**Phase 1: frontend integration and complete multiplayer backend.** PR #2 was reviewed in Gate B and merged into dev after explicit user approval. Local dev and Jojo_dev_update were fast-forwarded; origin/Jojo_dev_update was synchronized by a normal push. Jojo_test_frontend and main were untouched. The backend branch starts at the approved dev merge. Approve this consolidated architecture once, then implement the subsystems below without additional routine approval stops. Database changes begin in a dedicated development/staging Supabase project, never an unidentified production project.

PR #1 remains open from dev into main. Its head now includes Gate B. Its description flags that earlier validation was for an older head and that a new review is required. Do not merge an earlier approval against a changed head. Re-read reviews/checks and pin the approved head hash for every shared-branch merge. Any teammate commits arriving on dev will be integrated normally on the backend branch, with conflicts reviewed and checks rerun; no force-push, destructive reset or blanket file replacement.

**Phase 2: end-to-end testing and release.** Use two real Auth0 accounts in separate browser sessions/devices, fix defects, push verified backend changes and open/review the backend PR into dev. Merge only after team approval. Validate the combined dev again. Update the existing dev→main PR if it remains open; otherwise create the final release PR. Main always requires team approval against its actual final head. No automatic main merge.

## Existing implementation audit

This audit describes the approved `3a18fd8` baseline before backend implementation. See `backend-staging-setup.md` for the implemented staging setup and remaining live verification gates.

| Area | Current evidence and implication |
| --- | --- |
| Auth0 | `public/auth/auth.js` and `AuthGate.tsx` implement popup login/signup/logout and session restoration. The adapter exposes a user but no authenticated backend token method. Preserve the login UI and SDK; extend the adapter, not a second login. |
| Profiles/avatar | `AvatarCreator.tsx` updates Zustand; portrait/world sprites share the avatar palette. Names and avatar choices are not tied to an account. Preserve the renderer and validation, replace its data source. |
| Local saves | `sproutbound-v1`, `sproutbound-study-room`, and `sproutbound-friends` are browser-wide, including across Auth0 accounts. Energy, completion IDs and demo contributors are client-writable. Never use those values as proof of rewards or ownership. |
| Learning | `Learning.tsx` calls `getCourse()` and simulates generation with a timeout. `courses.ts` contains 15 authored lessons and 45 MC questions. Correct answers and grading run in the browser. No generator HTTP integration exists. |
| Gemini CLI | `Promerus/study_quiz_gemini_saved_key.py` contains structured generation of four MC questions plus one short answer, explanations, answer validation and model-assisted short-answer grading. Syntax parses. Requirements list openai/pydantic instead of google-genai/python-dotenv; this Python runtime lacks the needed modules, and no adjacent .env exists. No live provider request was made, so provider access/quality/grades are not certified. |
| Teammate branch | `origin/Questionnaire` adds `Promerus/study_quiz_gemini_saved_key Score_Operational.py`, a CLI scoring extension with nutrients/coins calculated by difficulty. It is not merged into dev or connected to frontend/server storage. Preserve it and compare its grading behavior during integration; do not silently import its different economy into the established +20 lesson reward. |
| World/social | GameCanvas uses four indexed local/demo characters; PartyRoster/FriendsMenu use simulated names and activities. Room code does not connect clients. Geometry, art, cursor, motion and interactions already work. Convert identity slots to stable server player IDs; reserve slot 0 for the local player and map up to three other active occupants to existing desk slots. |
| Hosting | Next.js is a static export with no API routes. Keep that deployment model and host trusted endpoints in Supabase Edge Functions. No Supabase package, migrations or backend service is currently configured. |

The model name `gemini-3.8-flash` exists in Google's current documentation; this does not establish that this team's key has model access or quota. The CLI generates a quiz, not a complete personalized five-lesson course service. Course orchestration, HTTP authorization, persistence and browser integration are missing.

## Identity and trust boundary

Use Supabase's supported Auth0 third-party integration. Keep existing Auth0 accounts and Universal Login. Configure the existing tenant and its signing algorithm; publish the documented Auth0 Action assigning the literal `role=authenticated` claim to ID tokens. The Supabase client token callback obtains a fresh SDK-managed ID token. Do not hand-sign Supabase user tokens or put a client secret in the SPA. Refresh tokens through the SDK and explicitly refresh Realtime authentication; expired/invalid tokens fail closed and prompt existing Auth0 sign-in.

Reference: [Supabase Auth0 integration](https://supabase.com/docs/guides/auth/third-party/auth0).

Application player IDs are UUIDs generated by the server, mapped uniquely to **(issuer, Auth0 subject)**. Auth0 subjects are text, not UUIDs; RLS maps verified `auth.jwt()->>'iss'` and `auth.jwt()->>'sub'` to the player. Do not cast subjects through auth.uid(), identify users by email, or accept a client-supplied player ID as authority. Restrict accepted issuer and audience to the configured tenant/application. Only provision the authenticated role, never privileged roles from user metadata.

Reference: [Third-party identity claims and RLS](https://supabase.com/docs/guides/auth/third-party/custom-oidc).

Edge handlers must independently establish verified identity, expiry, audience and issuer using the provider's trusted JWKS (including key rotation). Check the deployed gateway's third-party support in staging. A gateway compatibility change must retain explicit cryptographic verification before parsing actions or using an admin client; a decoded token or a publishable key is not authentication. Never disable validation merely to resolve a 401. Invalid-signature, wrong-audience/issuer, expired-token and missing-role cases require tests.

Browser configuration contains only Supabase URL/publishable key and public Auth0 identifiers. Gemini credentials and Supabase privileged credentials live only in server secret storage. Deny-by-default RLS and narrow grants remain mandatory; privileged handlers recheck caller ownership, membership and roles. Security-definer functions use a fixed search_path, qualified objects and restricted EXECUTE grants. No user input reaches dynamic SQL.

Reference: [Supabase function authentication](https://supabase.com/docs/guides/functions/auth).

## Proposed data model

Names are implementation targets, not applied SQL. All foreign keys, bounds, indexes, grants and policies ship together in reviewed, versioned migrations.

| Table / schema | Purpose and key invariants |
| --- | --- |
| `private.player_identities` | UUID player_id, issuer, subject; unique issuer+subject; no browser listing or identity reassignment. |
| `profiles` | Own display name, onboarding state/version, intro skipped/seen timestamps, interests, level, goal, daily time, settings, last greenhouse; no public email directory. Own read/update of allowed fields only. |
| `player_appearances` | Sanitized display name/avatar palette, style, version, timestamp; own validated update, readable only by permitted room peers. No email/auth claims. Version supports immediate portrait/world refresh and stale-write detection. |
| `greenhouses` | UUID, owner, name, private/public visibility, visits allowed, seed energy 60, derived energy/stage/version and archived state. Owner edits presentation through guarded operations; cannot edit totals. |
| `greenhouse_memberships` | Unique greenhouse+player, role owner/member, joined/left state. Membership and role changes only through server operations; cannot self-promote. Owner transfer/leave serialized; no accidental orphan room. |
| `greenhouse_invites` | Hashed high-entropy code, creator, expiry, uses/limit and revoked flag; server-only. Redeem with rate limits; raw code returned only at creation. |
| `greenhouse_visits` | Time-limited visitor grants for permitted public rooms; revoked/expired grants deny access. Visits never confer membership, ownership or reward rights. |
| `room_sessions` | Session UUID, player, world, lease, controller session, desk slot, validated position/facing/activity, monotonic sequence and server last_seen. At most four active occupants per world, including visitors; atomic slot/lease reservation. One controlling room session per player; other tabs may view and explicitly take over. |
| `learning_paths`, `lessons`, `lesson_questions` | Stable versioned course/lesson IDs, owner, personalized input, ordered lessons, published public question payloads. Users read their own paths/questions. No correct-answer fields in readable rows. |
| `private.lesson_solutions` | Canonical MC keys, short-answer reference/rubric, prompt/model version and content provenance; never selectable by browser. |
| `lesson_attempts`, `attempt_answers` | Actor-bound server attempt, fixed course/lesson version, bound reward greenhouse and membership, question order, idempotency key, status, sanitized graded responses, final verdict. Client submits answers, not grades. |
| `lesson_completions` | Server-only insert, unique player+canonical lesson version; individual progress persists across worlds. An already completed lesson cannot mint energy in another greenhouse. |
| `energy_ledger` | Immutable +20 reward per verified first completion; unique completion_id, player, greenhouse, timestamp. Greenhouse total and per-player contributions derive from this ledger plus seed 60. |
| `greenhouse_quests` | Unique greenhouse+Moonlight Bloom version, completed_at. Unlock exactly once after two distinct eligible contributors; contributes a cosmetic reward, no new currency. |
| `world_events` | Monotonic event/version, server-generated completion/growth/quest/Sproutling event. Events carry no answers or personal learning content. Replay-safe delivery; short retention with a snapshot fallback. |
| `private.generation_jobs` | Durable generation/grading job ownership, request idempotency, quota accounting, pending/succeeded/failed state and bounded retry metadata. No provider credentials or full sensitive answers in logs. |

A sanitized directory operation returns only public room name/id, stage, availability and visits permission. It never exposes invitation hashes, private roster, exact activity, learning answers or private rooms. Existing demo friends remain in an explicitly isolated demo mode until real friendship semantics are implemented; demo identities cannot contribute to online energy.

## Access matrix and guarded operations

| Caller | Allowed | Denied |
| --- | --- | --- |
| Signed out | Existing sign-in screen and local assets | Profiles, directories, worlds, channels, lessons, all writes |
| Authenticated nonmember | Own profile/path; sanitized public listings; request permitted visit or valid invite redemption | Private room snapshots/subscriptions; another player's learning data; arbitrary membership changes |
| Authorized visitor | Limited current room snapshot, permitted appearances, own movement/activity while lease valid | Energy awards to visited room, invites, ownership/settings, private lesson data |
| Member | Current world snapshot/roster/contributions/events; own verified study rewards and own session actions | Editing another avatar/session; assigning score/energy/stage; changing other members' roles |
| Owner | Member actions plus room presentation, invitations, visit policy and membership management | Editing learning verdicts, assigning arbitrary energy, altering another player's private profile |
| Trusted grader | Finalize only the actor-bound validated attempt through a private transaction | Generic client-callable completion/ledger insert or unchecked player/world parameters |

RPC/endpoint boundaries: bootstrap profile, complete/skip onboarding, save avatar, list/create/join/switch/leave greenhouse, issue/redeem/revoke invite, authorize visit, lease/heartbeat/move/activity, request/poll generation, begin attempt, submit answer and finalize attempt. Each receives small validated payloads and returns typed errors. A world switch obtains a valid new lease before releasing the old one; failure keeps the previous world available.

Reward finalization locks the attempt and affected greenhouse, verifies all required answers and current membership, inserts completion with a unique constraint, then inserts the ledger entry, updates world version/energy, checks distinct contributors and emits events **in one transaction**. Concurrent duplicate calls return the existing result, never a second reward. A lesson is bound to its target world at attempt start; switching worlds cannot move or duplicate the award. If membership was revoked, the attempt may preserve private study results but cannot grant shared energy. Contribution history remains auditable when someone leaves.

Stage thresholds remain Seed <100, Sprout >=100, Bloom >=180, Sanctuary >=300. New rooms retain the established 60 seed energy. Currency multipliers, nutrients/coins, stealing, powerups and ESP32 are excluded.

## Realtime, movement and reconnection

Use authenticated, private, access-scoped subscriptions. Postgres Changes distributes authorized session/appearance/world rows; transient broadcasts are hints, never authoritative grades, identities or energy. Do not assume channel membership validates arbitrary message payloads. Use private server-origin room events for celebrations; client broadcast permissions do not permit authoritative event types.

Movement is sent to an actor-bound session RPC at a bounded target of 5 updates/second while moving; remote clients interpolate. Validate coordinates, bounds/geometry version, monotonic sequence, speed/elapsed time and legal activity; never trust a supplied owner ID. Idle heartbeats every 20 seconds extend a 60-second lease. Occupancy counts unexpired leases, not delayed cleanup. Reconnect reauthenticates, reads the current snapshot/version, reacquires a slot and resubscribes; retry with bounded exponential backoff and jitter. A later sequence supersedes an earlier one. Clean up old channels and ignore responses from a previously selected room.

Online status comes from authenticated server-owned leases; optional Presence join/leave hints only accelerate refresh. Never accept another user's display name, avatar or activity from an unverified Presence payload. The last live controller disappearing marks the player offline after lease timeout. Two tabs do not render duplicate players. Fast local motion remains responsive; a server correction returns the avatar to a legal position without awarding anything.

Private Realtime authorization is connection-scoped and cached, so policy changes alone cannot promise immediate removal of an already connected listener. Room channel topics include a server-managed access epoch. Membership/visit revocation and privacy changes rotate that epoch; new events use the new topic. Reconnects reauthorize. Postgres row subscriptions must also pass current RLS. Old topics receive no new protected events. Explicitly test revocation while the removed user remains connected.

Reference: [Realtime authorization and policy refresh](https://supabase.com/docs/guides/realtime/authorization).

Sproutling uses shared world stage and server completion/quest events for synchronized reactions. Autonomous wandering uses a world seed/server time anchor or elected server lease controller with validated state so every client sees one creature; it never drives rewards. Replayed event IDs do not celebrate twice. Seed/Sprout/Bloom/Sanctuary are derived from server totals, never browser counters.

Capacity four preserves the existing desk/portrait composition; full rooms remain browseable and explain that a visit is unavailable until a slot is free. Scale and write-rate costs must be measured in staging before wider public browsing rollout.

## Learning generation, grading and preservation

Keep existing authored lessons and explanations as a labeled, always-available fallback. Serve their trusted solution keys on the server for online grading; browser copies cannot determine reward eligibility. Preserve Python CLI files and teammate branch history. Extract/adapt its prompts, four-MC/one-short-answer schema, distinct-choice checks, rubric grading and explanations into server handlers with equivalence fixtures. Supabase Edge Functions use TypeScript/Deno, so do not pretend to execute the CLI there or import Python dependencies into the browser.

Add the missing personalized course orchestrator: validate topic, difficulty, goal/time; generate a bounded five-lesson outline and immutable question sets with stable versions; persist successful output before publishing it. Preserve current three-question authored quizzes and support variable question counts/types for generated material. Do not relabel fixed authored content as AI-generated.

Structured AI output still requires factual/schema checks, nonempty/distinct choices, bounded strings and safe display; it is not inherently reliable grading. Short-answer grading uses the saved rubric/reference and rejects prompt-injection instructions in submitted text. Provider failures leave the answer pending, expose a retryable status and award nothing; do not silently mark it correct. MC evaluation is deterministic. The student receives the established explanation/feedback after a submission, not a pre-submission solution object.

Default resource bounds for review: five AI course requests/player/day (authored courses are cached separately and remain available) and thirty model-graded submissions/player/hour, configurable server-side; fixed maximum output, request timeouts, bounded retries and cached idempotent jobs. Credentials and quota are required before a live generation claim can be made. The app can still study authored material when the provider is unavailable. Model-assisted grading cannot prove unaided human learning; server verification means trusted content, actor-bound evaluated answers and an idempotent reward transaction.

References: [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [configured model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).

## Frontend preservation and migration

Retain sprites, greenhouse geometry, custom cursor, lighting/motion preferences, Auth0 branding, learning room and existing garden art. Replace only the top-right Garden destination with a Greenhouses screen for current/create/join/switch/public browse. The central tree continues opening existing progression; its menu remains keyboard accessible through a labeled Garden progression action within Greenhouses. Reuse profile/party components and stable UUID keys; avatar changes invalidate both head and world textures by version.

Bootstrap creates a minimal profile once. First-time onboarding saves name/avatar/interests/level/goal/time, with a skippable introduction and resumable server state. Skipping the introduction does not skip required identity or overwrite defaults. Returning accounts load their own data before rendering the live world.

Leave old localStorage saves untouched and offer a clearly identified legacy preview/export. Optional import may copy a validated display name/avatar/preferences only after explicit user selection because the old save is browser-wide and cannot establish its owner. Do not import demo completions, energy, friends or contributors as real records. Cloud caches are keyed by issuer+subject and cleared from memory/subscriptions on logout/account switch. Local accessibility settings can remain device-specific. Online failures preserve the UI and show reconnecting; queued local completions never become trusted offline rewards automatically.

## Implementation sequence after this single approval

1. Auth0 token adapter, provider configuration instructions, migrations/grants/RLS/identity mapping, profile bootstrap, typed repositories and account-isolated hydration. Negative authentication/RLS tests.
2. Onboarding/avatar persistence and versioned appearance updates. Account switching and concurrent save tests.
3. Greenhouse directory, membership/invites/visits, four-slot session leasing and Greenhouses navigation; keep tree progression. Capacity, privilege and cross-world access tests.
4. Presence, movement/activity sync, shared Sproutling, reconnection and revocation. Sequence, stale lease and duplicate-tab tests.
5. Trusted authored lessons, AI adapter/jobs, personal progress and grading feedback. Provider failure, rubric/schema and answer privacy tests.
6. Atomic reward ledger, contributions, stage/quest/event sync. Concurrent duplicate/replay, world-switch and revoked-membership tests.
7. Full Phase 1 regression, typecheck/build, database tests and feature-branch commits/push. Report completed vs blocked explicitly. Never describe local mocks as completed multiplayer.

After each subsystem run meaningful unit/integration/security checks and fix introduced errors without another routine approval question. No production schema change is implied by approval of staging work. Production promotion requires an identified destination, reviewed migration impact/backups and the release approval gate.

## Phase 2 acceptance evidence

Two distinct real Auth0 accounts, isolated browser profiles or devices, same configured staging Supabase project. Record tested commit, browser sessions, world ID, timestamps, results and any redacted screenshots/logs. Never commit tokens or account credentials.

Verify both create/join/switch into the same room, see each other's chosen avatars/portraits and interpolated movement, observe studying/idle/offline transitions, complete different lessons, receive exactly one legitimate reward each, see matching shared totals/stages/Sproutling/quest results, refresh and reconnect without data loss. Race the same completion twice and across worlds; test expired tokens, forged identity/grade/energy payloads, guessed private world IDs, unauthorized subscription, a third nonmember, visitor privilege, revoked access during a live connection and multi-tab controller takeover. Confirm keyboard/tree navigation, lessons, customization, art, cursor and reduced motion still work.

Screens showing mock accounts do not satisfy the two-real-account release requirement. If real sessions or credentials are unavailable, report that gate as incomplete; do not claim release readiness.

## Approval and required configuration

Approve this data model, Auth0 trust path, RLS/access matrix, reward transaction, private realtime/revocation strategy, four-slot/public-visit limits, safe legacy migration and staged rollout as one architecture. This authorizes implementation on the backend feature branch and development/staging migrations, not automatic shared-branch merges or production database modification.

Needed to run integration: identified development Supabase project/URL/publishable key; secure CLI/dashboard access or a maintainer to apply migrations/provider settings and deploy functions; Auth0 tenant admin ability for the Action, supported signing algorithm and exact callback/audience settings; Gemini secret installed in server secret storage with billing/quota; two real Auth0 test accounts/sessions for Phase 2. Do not paste service-role, Auth0 client secret or Gemini keys into chat or commit them. No Auth0 client secret is needed by the SPA.

Current preflight: approved merged frontend passes TypeScript, 43 tests and production build. No provider-backed generator, database/RLS or two-real-account multiplayer tests have run yet. This document proposes implementation; Phase 1 backend is not complete.
