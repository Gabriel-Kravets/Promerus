# Daily quest penalties

Each permanent member must complete at least one daily quest. If they miss all three, every greenhouse they belonged to for that full day loses 10 nutrients. Four inactive members therefore cost a shared tree 40 nutrients. A member's completion is personal and protects all their memberships for the day; another member's work does not protect them. Visitors never cause a deduction.

Days end at **midnight America/New_York**, including daylight-saving changes. New members start on the first full day after joining. Existing memberships start on the first full day after this migration is installed; nothing is charged retroactively for days before rollout. Membership history survives leaving or being removed, so yesterday's obligation cannot be erased by switching rooms. The partial departure day is exempt. Archived rooms are exempt.

Nutrients stop at zero. A deduction records the amount actually available, creates no debt, and is never reapplied after future rewards. Balances and cosmetic tree stages can decrease; previously unlocked Moonlight Bloom is retained. Deductions do not remove earned lesson credits, coins, or saved content. A later lesson adds its usual 20 nutrients without resetting past deductions.

## What counts

- Review all three distinct built-in Science cards. Repeated reveals of one card count once.
- Accumulate 20 minutes with the focus timer running while the study room is visible, focused, and online. The server measures elapsed time, rejects long offline gaps, splits intervals at New York midnight, and does not multiply time from concurrent tabs. Unsynced local time is not authoritative.
- Finish a server-verified lesson. A freshly answered practice attempt counts toward the quest even when its nutrient reward has already been claimed; resubmitting an old finalized attempt on a later day does not count.

The quest widget uses server-confirmed progress online and reports synchronization errors rather than marking local progress as protected. Recent personal deductions are shown there. The local demo retains its existing browser-only progress and does not simulate authoritative shared-room penalties.

## Backend integration

Migration `supabase/migrations/202610180008_daily_quest_penalties.sql` adds private progress and membership-period tables, a room-readable immutable penalty ledger, authenticated progress/status RPCs, and a service-only settlement job. Neither dates, completed flags, elapsed seconds, nor nutrient amounts are accepted from clients. Existing historical migrations remain unchanged. The new lesson-finalization definition preserves current verification, membership, idempotency, rewards, and Bloom behavior while retaining deductions.

Settlement locks each affected room and has a unique key for `(greenhouse_id, player_id, day)`. It processes up to 31 pending days per membership per invocation; subsequent scheduled runs catch up after outages. It waits two minutes after midnight for the final focus pulse. Shared room state propagates through the existing greenhouse Realtime subscriptions. Penalty events refresh balances without playing reward celebrations.

## Activation on Supabase

This change is prepared locally. It does **not** apply database changes or deploy anything automatically.

1. Review and apply **only migration 202610180008** to the intended Supabase project after its existing seven migrations. Do not replay historical migrations against the hosted database. Back up and test on staging first.
2. Deploy the matching frontend so quest actions reach the new RPCs before the first full enforcement day. Existing `game-api` does not need an Edge Function redeploy for these SQL triggers/RPCs.
3. Enable Supabase Cron (`pg_cron`), then run `supabase/schedules/daily-quest-penalties.sql` once. It creates/replaces the named `sproutbound-daily-quest-penalties` job, running every five minutes starting at minute 2. No API key, HTTP endpoint, or Vercel Cron is required. See [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart).
4. Confirm the job exists in `cron.job`, inspect `cron.job_run_details` after a run, and verify the read-only `public.daily_quest_penalties` ledger. The penalty function is executable by `service_role`/database administration only.

Without the migration, the app remains available and the quest widget reports that progress cannot sync. Without the scheduled job, no automatic deductions run, including while browsers are closed. Installing the migration starts eligibility the following New York day, so complete the frontend/scheduler rollout together. If delaying enforcement, set `private.daily_quest_policy.starts_on` and existing `private.daily_quest_memberships.eligible_from/settled_through` together before enforcement begins; changing only the policy after rollout does not rewrite recorded eligibility.

Validation commands: `npm test`, `npm run test:backend`, `npm run typecheck`, `npm run build`. SQL tests use disposable embedded PostgreSQL with a test-only controllable private clock; hosted clocks and real balances are never modified.
