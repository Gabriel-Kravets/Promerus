-- Run once after migration 202610180008, with Supabase Cron enabled.
-- One named job; rerunning replaces its schedule instead of creating duplicates.
select cron.schedule('sproutbound-daily-quest-penalties','2-59/5 * * * *',
 'select public.settle_daily_quest_penalties();');
