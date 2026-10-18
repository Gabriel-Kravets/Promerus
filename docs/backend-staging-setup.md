# Staging setup and remaining release gates

Architecture approved by the user on 2026-10-17. Implementation is isolated on `feat/supabase-multiplayer`; the branch must not be merged without review. PR #2 is merged; PR #1 was subsequently merged by Gabriel-Kravets; this agent did not merge it. Any future release PR still requires team approval. No hosted database changes have been applied by this work.

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

After publishing the Action, sign out and sign back in to replace old cached tokens lacking the role. Configure local and deployed callback/logout/web-origin URLs as already documented in README. Real Supabase gateway compatibility with these third-party tokens must be verified before marking auth complete. `verify_jwt=true` stays on initially. A gateway compatibility adjustment may only be made with explicit cryptographic validation still enforced by the handler; an unauthenticated workaround is prohibited.

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

The backend adds personalized five-lesson orchestration, server-side MC keys, typed generated questions, server-only Gemini calls, rubric grading, bounded quotas, idempotent generation jobs and atomic rewards. Authored content remains an explicitly labeled, cached fallback and does not consume the Gemini generation quota. An API/model/quota failure awards nothing. No live Gemini generation or grading has been certified without the team's server key. Offline Python tests use mocked model responses, not paid requests.

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

Phase 1 remains pending hosted Auth0/Supabase/Gemini configuration and verification. Phase 2 requires two real authenticated accounts on separate browser sessions/devices, including synchronized avatars, movement/status, server-verified rewards, growth/Sproutling, contributions, refresh/reconnection, concurrent duplicate prevention and unauthorized access/revocation tests. Local or fictional-account fixtures do not satisfy that release gate. Capture commit/environment and redacted evidence, fix defects, then prepare the backend PR into dev. Main remains gated on team approval of the final reviewed head.
