# Staging setup and remaining release gates

## Current staging setup checklist

This is configuration and verification of existing code, not a new feature phase. Keep PR #3 open for team review; do not merge dev or main. The user confirmed this project is staging/testing and localhost:3000 is the test frontend.

- [x] **Confirm destination and secure access.** Project `sproutbound-backend`, ref `llrrlwuwygkxftgnvvsa`, URL `https://llrrlwuwygkxftgnvvsa.supabase.co`, region `us-west-2`, healthy PostgreSQL 17.11. CLI 2.121.0 authenticated and this directory linked. CLI-generated `supabase/.temp/` is local-only.
- [x] **Inspect before migrations.** Read-only catalog inspection found no public/private application tables, columns, functions, policies or grants; no private schema or recorded migration table; the standard supabase_realtime publication has no tables. pgcrypto is already installed. No deployed Edge Functions or user-defined function secrets were listed. All four local migration versions have no remote counterpart. This is an empty application schema, not a claim that Supabase's platform schemas contain no data.
- [x] **Database approval and application.** The user approved and all four migrations applied successfully to the confirmed staging target. Applied only `202610170001_identity_worlds.sql`, `202610170002_learning_rewards.sql`, `202610170003_live_sessions.sql`, and `202610170004_membership_lifecycle.sql` to this staging project. Together they create 21 application tables (15 public, 6 private), secured RPC/helper functions, 15 application read policies plus one private Realtime receive policy, and publication entries for 10 application tables. They implement identity/profile, memberships/visits, leases, learning/grading, immutable rewards, cooperative progression and lifecycle controls. No reset, drop, seed/demo import or existing-data deletion is part of application. Review migration plan again before execution; record versions and verify hosted grants/RLS after applying. Hosted verification confirmed 21 tables, 40 unique functions, 16 policies and 10 publication entries; all 15 public tables have RLS. Browser/anonymous roles cannot read private solutions, finalize rewards, run cleanup, bootstrap anonymously or select worlds anonymously. The existing prune function was created but not invoked or scheduled.
- [x] **Configure Supabase trust and API/Realtime.** In Authentication → Third-Party Auth add the existing Auth0 tenant `dev-phu3idfk55gl1dkn` in region `us`. Keep public as the application Data API schema; never expose private. Enable Realtime, verify the migration's publication entries and table RLS, and restrict channels to private access. Verify the current private channel epoch policy with actual Auth0 tokens. Do not enable a competing login system.
- [x] **Configure Auth0.** Keep the existing SPA Client ID `uiuwR5J2A8HJpHRTLyaoKsyDURhC2tMK`, issuer `https://dev-phu3idfk55gl1dkn.us.auth0.com/`, RS256 signing and current identities. Allow callback/logout `http://localhost:3000/` and Web Origin `http://localhost:3000` without removing valid team URLs. Deploy and attach the Post Login Action adding literal ID-token role authenticated; scope it to this SPA if the tenant has other applications. Sign out/in afterward. Verify issuer, audience, signature, role and subject end-to-end; do not print tokens or add a browser client secret.
- [x] **Configure Gemini securely.** Use the team's Google AI project/API key with Generative Language API access and an approved quota/billing arrangement. Store `GEMINI_API_KEY` only in Supabase Edge Function secret storage. Set `GEMINI_MODEL=gemini-3.8-flash` explicitly and verify the key/project can use it for structured course generation and rubric grading. Do not put the key in frontend variables, Git, chat or request URLs. A provider failure must not award energy.
- [x] **Complete game-api authentication verification.** Deployed game-api version 4 to staging. Real Auth0 tokens were initially rejected by the gateway with `UNAUTHORIZED_ASYMMETRIC_JWT`. The per-function gateway verifier is now off; mandatory handler authentication remains on: Auth0 JWKS RS256 signature, exact issuer/audience, subject/issued-at/expiry and authenticated role are checked before any action or privileged access. Missing, malformed and forged tokens return handler 401 responses. Real movement, authored generation, completion and Gemini grading work. Server configuration uses the exact issuer/SPA above, `APP_ORIGINS=http://localhost:3000`, `GEMINI_MODEL=gemini-3.8-flash`, securely stored replacement Gemini key and platform-injected Supabase keys. No secret values were retrieved.
- [x] **Connect the existing frontend configuration.** Created ignored mode-0600 `.env.local` with only `NEXT_PUBLIC_SUPABASE_URL=https://llrrlwuwygkxftgnvvsa.supabase.co` and the project's public publishable key. Rebuild and real two-account online sign-in were verified. No privileged key belongs in NEXT_PUBLIC. Use existing Auth0 login and real profiles, not simulated classmates.
- [ ] **Verify with two real accounts.** Sign into independent browser profiles/sessions, never share passwords/tokens in chat. Both users join the same greenhouse; check customized portraits/world sprites, live movement, studying status and lease-based offline detection. Complete actual verified lessons for +20 contributions, confirm replay cannot pay twice, exercise Seed/Sprout/Bloom/Sanctuary at 60/100/180/300 using legitimate completions, and check cooperative Moonlight Bloom plus shared Sproutling reactions. Refresh and interrupt/reconnect both sessions, then verify persistent profiles/progress and access revocation/unauthorized edits. Log redacted commit/environment/results. Gemini generation and short-answer grading must be exercised against the real provider. Mocked tests are not hosted signoff.
- [ ] **Operational/release gates.** Review the existing prune function's retention rules before scheduling it; no cleanup deletion is authorized by the initial setup approval. Resolve Next/PostCSS advisories with a supported dependency upgrade and regression checks before production release. Keep PR #3 and any future main promotion subject to team review; do not merge automatically.

The public Auth0 settings already match the issuer/application seeded by the migrations and expected by game-api. `supabase/config.toml` project_id is a local stack identifier; the actual hosted destination is the linked ref above, and deployment commands must still specify it explicitly. The user reports the Auth0 Action deployed/attached and a replacement Gemini key saved directly to provider secret storage after a credential was exposed in chat. Only secret presence was checked; no secret value was retrieved. After explicit action-time approval, the Supabase Auth0 connection was created and the dashboard showed ENABLED for the exact tenant. Realtime service is enabled and public channel access is disabled. Two real Auth0 identities completed onboarding and joined the same greenhouse. Hosted movement, avatar updates, authored lessons, shared rewards, Sprout growth and Gemini generation/grading were exercised. Full release acceptance remains incomplete; see the recorded results below.

Architecture approved by the user on 2026-10-17. Implementation is isolated on `feat/supabase-multiplayer`; the branch must not be merged without review. PR #2 is merged; PR #1 was subsequently merged by Gabriel-Kravets; this agent did not merge it. Any future release PR still requires team approval. The four approved staging migrations have now been applied; production was not changed.

## Identify the destination before applying migrations

Provide the development Supabase project's name/URL and configure deployment access securely through the Supabase CLI/dashboard. Never paste a database password, privileged Supabase key, Auth0 client secret, Gemini secret or user token into chat or Git.

Inspect the destination's existing schema, migrations, roles, policies, publications and functions first. These initial migrations expect a fresh application schema. They intentionally fail on conflicting existing tables/functions rather than overwrite them. Back up any nonempty target and reconcile its history before proceeding. Do not use reset, destructive schema replacement or an unidentified production project.

The checked-in files define application tables, default-deny policies, guarded RPCs, identity mapping, ledger/quest transactions, actor-bound session movement, publication entries, private channel receive policies and lifecycle cleanup. Tests exercise them in embedded PostgreSQL with mocked Supabase auth/Realtime primitives. That is not hosted-Supabase or real-Auth0 certification.

## Auth0 configuration

Keep the existing SPA and popup login. Confirm its exact issuer, application/client ID and RS256 signing configuration. Connect that tenant using Supabase Third-Party Auth, not a new Supabase email/password login. Publish this Post Login Action:

```js
exports.onExecutePostLogin = async (_event, api) => {
  api.idToken.setCustomClaim('role', 'authenticated');
};
```

The browser refreshes through the existing SDK and supplies its signed ID token. The Edge handler verifies signature, exact issuer/audience, expiry, required subject/issued-at and authenticated role. The database independently restricts claims to `private.identity_settings` and maps issuer+subject to a UUID. Update that settings row if staging intentionally uses a different approved tenant/application. Do not insert Auth0 subjects into auth.uid() or match accounts by email.

After publishing the Action, sign out and sign back in to replace old cached tokens lacking the role. Configure local and deployed callback/logout/web-origin URLs as already documented in README. Real Supabase gateway compatibility with these third-party tokens must be verified before marking auth complete. The hosted gateway rejected these external RS256 tokens before the handler, so `verify_jwt=false` is now configured only for game-api. The handler independently enforces cryptographic Auth0 verification before any action; an unauthenticated workaround is prohibited.

## Public frontend configuration

Set these in ignored local environment configuration or the hosting dashboard, then rebuild the static app:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-STAGING-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Both are required together. With neither configured, the existing authenticated local demo remains available; it is not presented as multiplayer. A partially configured backend fails visibly rather than silently importing demo state. No privileged value belongs in NEXT_PUBLIC variables or `public/auth/config.js`.

Online accounts have isolated cache keys. The original browser-wide demo save remains untouched. Avatar customization offers an explicit review/import of only that device's old appearance; simulated energy, contributors, completions and friends are never imported as trusted online records.

## Edge Function deployment

Install/link the official Supabase CLI only against the identified staging project. Review migration status and the four files under `supabase/migrations/` before pushing them. Deploy `game-api` and configure server-only secrets in secure provider storage:

- `AUTH0_ISSUER`: exact HTTPS issuer ending in `/`.
- `AUTH0_CLIENT_ID`: the same approved SPA audience used in database identity settings.
- `APP_ORIGINS`: comma-separated exact local/deployed HTTPS frontend origins; no wildcard.
- `GEMINI_API_KEY`: provider secret with the team's approved quota/billing.
- `GEMINI_MODEL`: optional; defaults to the existing `gemini-3.8-flash` selection.
- Confirm `SUPABASE_URL` plus the platform’s public and privileged keys. The handler supports the named `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` JSON maps, singular `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`, or legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` fallback. Privileged values never enter the frontend.

The handler uses background generation jobs and atomic publish. Local CLI workers use `edge_runtime.policy = "per_worker"` so jobs survive the HTTP response, following [Supabase background-task guidance](https://supabase.com/docs/guides/functions/background-tasks). Set runtime limits compatible with a bounded 60-second provider request. Do not change failed/pending jobs into rewarded success. Configure a trusted scheduled call to the service-role-only `prune_expired_game_data()` (for example hourly) to expire abandoned jobs and clean leases/events/quotas; never expose that operation to the browser. Persistent contributions and completions are not pruned.

Realtime publication contains only the application's required tables. Private `world:<uuid>:<epoch>` channels have a receive policy limited to current access and epoch; clients cannot publish authoritative broadcasts. Disable public Broadcast/Presence channel access in Realtime settings. Changes remain subject to table RLS. Verify websocket delivery, token renewal, stale sessions, network recovery and already-connected revocation in the hosted project.

## Learning generator audit

The frontend previously used authored courses and a simulated loading delay. The original Python CLI has generation, four MC questions, one rubric-based short answer and feedback, but no frontend HTTP integration. Its requirements have been corrected to google-genai/python-dotenv/pydantic. The original script and teammate's separate `Questionnaire` branch are preserved; their nutrients/coins scoring is not imported into the +20 lesson economy.

The backend adds personalized five-lesson orchestration, server-side MC keys, typed generated questions, server-only Gemini calls, rubric grading, bounded quotas, idempotent generation jobs and atomic rewards. Authored content remains an explicitly labeled, cached fallback and does not consume the Gemini generation quota. An API/model/quota failure awards nothing. A real generated course and rubric-based short-answer grade succeeded in staging; two earlier generation requests failed safely, so provider reliability is not signed off. Offline Python tests use mocked model responses, not paid requests.

## Commands and acceptance

```sh
npm ci
npm run typecheck
npm test
npm run test:backend
npm run build
npx --yes deno check --config supabase/functions/game-api/deno.json supabase/functions/game-api/index.ts
python3 -m venv /private/tmp/promerus-generator-check
/private/tmp/promerus-generator-check/bin/pip install -r Promerus/requirements.txt
/private/tmp/promerus-generator-check/bin/python -m unittest discover -s Promerus -p 'test_*.py'
```

No standalone ESLint configuration exists. Do not describe the build validation stage as a separate lint pass.

Known dependency finding: npm audit reports two existing advisories through PostCSS bundled in Next 15.5.28. The registry suggests a major Next upgrade; no force-fix or unreviewed framework upgrade was applied. Assess and resolve this before release, including confirming whether untrusted CSS/source maps reach any build path. Supabase/JWT packages introduced here were not listed in that report.

## Hosted acceptance evidence — 2026-10-18

Staging only, localhost:3000, two different real Auth0 accounts in regular Edge and InPrivate. No production changes, destructive cleanup, branch merges or fabricated rewards.

- Both accounts onboarded and joined the same private greenhouse; 2/2 roster verified.
- Gateway incompatibility fixed; accepted movement sequence advanced from 0 to over 3300. A changed avatar/portrait appeared on the other account. Studying, Idle and lease-expired Offline states were visible.
- Both users completed the introductory authored Python lesson through the UI. Database ledger: exactly two rewards, +40 total; both contribution rows show +20. Remote UI received 60 → 80 without refresh, then displayed 100 and a Sprout tree. Database confirms one growth event and one cooperative Moonlight Bloom completion.
- Refresh retained membership, avatar, course/completion and 100 energy. After lease expiry the first account refreshed and used Enter to rejoin; both users appeared online again. Automatic lease-expiry recovery is not certified.
- Gemini: two initial generation requests failed; a subsequent request generated and atomically published Python Fundamentals for Beginners. Four MC questions and one short answer were answered through UI. Real Gemini grading accepted `greeting = 'Hello'` and returned explanatory feedback. One option contained stray text; content quality and intermittent failures remain release concerns. Generated-lesson final reward, repeat reward replay and full network-disruption recovery still need a controlled browser pass.
- Missing/malformed/forged tokens receive 401. Hosted grants/RLS were inspected; cryptographic wrong-issuer/audience/expiry/role, unauthorized edits/revocation, concurrent duplicate prevention and other world isolation have automated coverage. These are not substitutes for remaining live adversarial tests.
- Bloom/Sanctuary thresholds, synchronized celebration timing and live reaction interactions still require full two-session acceptance. Do not claim production certification.
- Fixed the observed Return to greenhouse navigation bug; added allowlisted diagnostic categories only, without provider bodies, keys or student text. No schema changes beyond the four approved migrations.
- Checks: TypeScript, production build, Edge Deno type-check, 50 frontend + 52 auth + 29 backend + 4 Python tests passed (135 total). No separate lint target exists.

Keep PR #3 open. Before release, repeat the remaining live checks with uninterrupted browser access, resolve generated-content/reliability concerns and remediate the dependency advisories. The safest dependency path is a separately reviewed upgrade to supported Next 16.4.2 (bundled PostCSS 8.5.23), respecting Node >=20.9 and rerunning the complete regression/audit suite. Do not force npm audit fixes or override framework internals. No framework upgrade was performed during staging setup.

## Query 26 reconciliation — 2026-10-18

The user subsequently installed the four-permanent-member guard manually in staging. Its function body, enabled membership trigger, SECURITY DEFINER/empty search_path and restricted execute ACL were verified read-only; no room exceeded four permanent memberships. The approved SQL now resides in `supabase/migrations/202610180005_four_permanent_members.sql`. Migration history was marked applied using `migration repair`, without re-executing SQL or changing application data. See main-worlds-integration.md for the command and evidence. Do not run Query 26 again on this project.

Post-repair verification: migration list shows all five local/remote versions matched. `db push --dry-run` returned `upToDate: true`, with no migrations, seeds or roles pending. No migration SQL ran during that verification.
