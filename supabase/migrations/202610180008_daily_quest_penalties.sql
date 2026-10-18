-- New migration only. Do not reapply the seven historical migrations to hosted databases.
begin;
create function private.quest_now() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
create function private.quest_day(t timestamptz) returns date language sql immutable set search_path='' as $$select (t at time zone 'America/New_York')::date$$;
create table private.daily_quest_policy(singleton boolean primary key default true check(singleton),starts_on date not null);
insert into private.daily_quest_policy values(true,private.quest_day(private.quest_now())+1);
create table private.daily_quest_progress(
 player_id uuid references public.profiles on delete cascade,day date not null,
 science_cards integer[] not null default '{}',focus_seconds numeric not null default 0 check(focus_seconds>=0),
 lesson_completed boolean not null default false,primary key(player_id,day)
);
create table private.daily_focus_state(
 player_id uuid primary key references public.profiles on delete cascade,token uuid not null,last_at timestamptz not null,running boolean not null
);
-- Membership periods survive removal/rejoining so leaving cannot erase yesterday's obligation.
create table private.daily_quest_memberships(
 id uuid primary key default gen_random_uuid(),greenhouse_id uuid not null references public.greenhouses on delete cascade,
 player_id uuid not null references public.profiles,eligible_from date not null,ends_before date,settled_through date not null
);
create unique index daily_quest_open_membership on private.daily_quest_memberships(greenhouse_id,player_id) where ends_before is null;
insert into private.daily_quest_memberships(greenhouse_id,player_id,eligible_from,settled_through)
 select m.greenhouse_id,m.player_id,p.starts_on,p.starts_on-1 from public.greenhouse_memberships m cross join private.daily_quest_policy p;
create function private.track_daily_membership() returns trigger language plpgsql security definer set search_path='' as $$
declare first_day date;begin
 if TG_OP='UPDATE' and new.greenhouse_id=old.greenhouse_id and new.player_id=old.player_id then return new;end if;
 if TG_OP in ('DELETE','UPDATE') then
  perform 1 from public.greenhouses where id=old.greenhouse_id for update;
  update private.daily_quest_memberships set ends_before=private.quest_day(private.quest_now()) where greenhouse_id=old.greenhouse_id and player_id=old.player_id and ends_before is null;
 end if;
 if TG_OP in ('INSERT','UPDATE') then
  select greatest(starts_on,private.quest_day(private.quest_now())+1) into first_day from private.daily_quest_policy;
  insert into private.daily_quest_memberships(greenhouse_id,player_id,eligible_from,settled_through) values(new.greenhouse_id,new.player_id,first_day,first_day-1);
  return new;
 end if;return old;
end $$;
create trigger daily_quest_membership_history after insert or delete or update of greenhouse_id,player_id on public.greenhouse_memberships for each row execute function private.track_daily_membership();
create table public.daily_quest_penalties(
 id uuid primary key default gen_random_uuid(),greenhouse_id uuid not null references public.greenhouses,player_id uuid not null references public.profiles,
 day date not null,amount integer not null check(amount between 0 and 10),created_at timestamptz not null default now(),
 unique(greenhouse_id,player_id,day)
);
alter table public.daily_quest_penalties enable row level security;
create policy room_daily_penalties on public.daily_quest_penalties for select to authenticated using(private.viewer_access(greenhouse_id));
revoke all on public.daily_quest_penalties from public,anon,authenticated;
grant select on public.daily_quest_penalties to authenticated,service_role;
alter table public.greenhouses drop constraint greenhouses_energy_check;
alter table public.greenhouses add constraint greenhouses_energy_check check(energy>=0);
alter table public.world_events drop constraint world_events_kind_check;
alter table public.world_events add constraint world_events_kind_check check(kind in ('lesson','growth','moonlight-bloom','sproutling','daily-penalty'));

create function public.daily_quest_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();d date:=private.quest_day(private.quest_now());p private.daily_quest_progress;begin
 select * into p from private.daily_quest_progress where player_id=a and day=d;
 return jsonb_build_object('day',d,'time_zone','America/New_York','resets_at',(d+1)::timestamp at time zone 'America/New_York',
 'science_cards',coalesce(cardinality(p.science_cards),0),'focus_seconds',floor(coalesce(p.focus_seconds,0)),
 'lesson_completed',coalesce(p.lesson_completed,false),'penalties_start_on',(select starts_on from private.daily_quest_policy),
 'eligible_from',(select min(m.eligible_from) from private.daily_quest_memberships m join public.greenhouses g on g.id=m.greenhouse_id where m.player_id=a and m.ends_before is null and not g.archived),
 'last_penalty',(select jsonb_build_object('day',q.day,'amount',q.amount,'greenhouse_name',g.name) from public.daily_quest_penalties q join public.greenhouses g on g.id=q.greenhouse_id where q.player_id=a and private.member(g.id,a) order by q.day desc,q.created_at desc,q.id limit 1));
end $$;
-- The client supplies actions, never dates, elapsed seconds, completed flags, or nutrient amounts.
create function public.record_daily_study(p_action text,p_card integer default null,p_token uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();t timestamptz:=private.quest_now();d date:=private.quest_day(t);f private.daily_focus_state;part record;begin
 if p_action not in ('science_card','focus_start','focus_tick','focus_stop') or p_action is null then raise exception 'Invalid quest action';end if;
 -- Serialize all progress actions for this player, including concurrent tabs.
 perform 1 from public.profiles where player_id=a for update;
 if p_action='science_card' then
  if p_card is null or p_card not between 0 and 2 then raise exception 'Invalid Science card';end if;
  insert into private.daily_quest_progress(player_id,day,science_cards) values(a,d,array[p_card])
   on conflict(player_id,day) do update set science_cards=case when p_card=any(private.daily_quest_progress.science_cards) then private.daily_quest_progress.science_cards else array_append(private.daily_quest_progress.science_cards,p_card) end;
 else
  if p_token is null then raise exception 'Focus token required';end if;
  select * into f from private.daily_focus_state where player_id=a;
  if f.running and f.token=p_token and t>=f.last_at and t-f.last_at<=interval '45 seconds' then
   -- Split at New York midnight, including 23/25-hour daylight-saving days.
   for part in select v::date as day from generate_series(private.quest_day(f.last_at)::timestamp,d::timestamp,interval '1 day') v loop
    insert into private.daily_quest_progress(player_id,day,focus_seconds)
     values(a,part.day,greatest(0,extract(epoch from least(t,(part.day+1)::timestamp at time zone 'America/New_York')-greatest(f.last_at,part.day::timestamp at time zone 'America/New_York'))))
     on conflict(player_id,day) do update set focus_seconds=least(1200,private.daily_quest_progress.focus_seconds+excluded.focus_seconds);
   end loop;
  end if;
  if f.player_id is null or f.token=p_token or not f.running or t-f.last_at>interval '45 seconds' then
   insert into private.daily_focus_state values(a,p_token,t,p_action<>'focus_stop') on conflict(player_id) do update set token=excluded.token,last_at=excluded.last_at,running=excluded.running;
  end if;
 end if;
 return public.daily_quest_status();
end $$;
create function private.record_daily_lesson() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.status='open' and new.status in ('completed','practice') then
  insert into private.daily_quest_progress(player_id,day,lesson_completed) values(new.player_id,private.quest_day(private.quest_now()),true)
   on conflict(player_id,day) do update set lesson_completed=true;
 end if;return new;
end $$;
create trigger daily_quest_verified_lesson after update of status on public.lesson_attempts for each row execute function private.record_daily_lesson();

-- No caller-controlled date or amount. Unique ledger keys and room locks make retries safe.
create function public.settle_daily_quest_penalties() returns integer language plpgsql security definer set search_path='' as $$
declare t timestamptz:=private.quest_now();last_day date:=private.quest_day(t)-1;w record;m record;d date;balance integer;charged integer;entry uuid;v bigint;total integer:=0;begin
 -- Wait two minutes after midnight so the final focus pulse can be confirmed.
 if t<((last_day+1)::timestamp at time zone 'America/New_York')+interval '2 minutes' then return 0;end if;
 for w in select g.id from public.greenhouses g where not g.archived and exists(select 1 from private.daily_quest_memberships pending where pending.greenhouse_id=g.id and pending.settled_through<least(last_day,coalesce(pending.ends_before-1,last_day))) order by g.id loop
  select energy into balance from public.greenhouses where id=w.id and not archived for update;
  if not found then continue;end if;
  for m in select * from private.daily_quest_memberships where greenhouse_id=w.id and settled_through<least(last_day,coalesce(ends_before-1,last_day)) order by player_id,eligible_from loop
   for d in select quest_date::date from generate_series(greatest(m.eligible_from,m.settled_through+1)::timestamp,least(last_day,coalesce(m.ends_before-1,last_day),m.settled_through+31)::timestamp,interval '1 day') quest_date loop
    if not exists(select 1 from private.daily_quest_progress p where p.player_id=m.player_id and p.day=d and (cardinality(p.science_cards)>=3 or p.focus_seconds>=1200 or p.lesson_completed)) then
     charged:=least(10,balance);entry:=null;
     insert into public.daily_quest_penalties(greenhouse_id,player_id,day,amount) values(w.id,m.player_id,d,charged) on conflict(greenhouse_id,player_id,day) do nothing returning id into entry;
     if entry is not null then
      update public.greenhouses set energy=energy-charged,version=version+1 where id=w.id returning energy,version into balance,v;
      insert into public.world_events(greenhouse_id,version,kind,player_id) values(w.id,v,'daily-penalty',m.player_id);total:=total+1;
     end if;
    end if;
    update private.daily_quest_memberships set settled_through=d where id=m.id;
   end loop;
  end loop;
 end loop;return total;
end $$;
-- Preserve deductions when later lessons grant nutrients. Old migrations remain unchanged.
create or replace function public.finalize_attempt(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt public.lesson_attempts;c uuid;canonical text;total integer;correct_count integer;new_energy integer;new_version bigint;old_stage integer;new_stage integer;rewarded boolean:=false;begin
 select * into attempt from public.lesson_attempts where id=p_attempt for update;
 if attempt.id is null then raise exception 'Attempt unavailable';end if;
 select count(*) into total from public.lesson_questions where lesson_id=attempt.lesson_id;
 select count(*) into correct_count from public.attempt_answers a join public.lesson_questions q on q.id=a.question_id where a.attempt_id=p_attempt and q.lesson_id=attempt.lesson_id and a.correct;
 if total=0 or correct_count<>total then raise exception 'All answers must be verified correct';end if;
 select canonical_key into canonical from public.lessons where id=attempt.lesson_id;
 perform 1 from public.greenhouses where id=attempt.greenhouse_id for update;
 select stage into old_stage from public.greenhouses where id=attempt.greenhouse_id;
 if not private.member(attempt.greenhouse_id,attempt.player_id) then raise exception 'Membership revoked; study answers remain saved' using errcode='42501';end if;
 insert into public.lesson_completions(player_id,canonical_key,lesson_id,attempt_id) values(attempt.player_id,canonical,attempt.lesson_id,attempt.id) on conflict(player_id,canonical_key) do nothing returning id into c;
 if c is not null then
 insert into public.energy_ledger(completion_id,player_id,greenhouse_id) values(c,attempt.player_id,attempt.greenhouse_id);
 update public.greenhouses set pet_pause_total=pet_pause_total+greatest(0,extract(epoch from now()+interval '4 seconds'-greatest(coalesce(pet_pause_until,now()),now()))),pet_pause_until=now()+interval '4 seconds',energy=energy+20,version=version+1 where id=attempt.greenhouse_id returning energy,version,stage into new_energy,new_version,new_stage;
 insert into public.world_events(greenhouse_id,version,kind,player_id) values(attempt.greenhouse_id,new_version,case when new_stage>old_stage then 'growth' else 'lesson' end,attempt.player_id);
 if (select count(distinct player_id) from public.energy_ledger where greenhouse_id=attempt.greenhouse_id)>=2 then
 insert into public.greenhouse_quests values(attempt.greenhouse_id,'moonlight-bloom-v1',now()) on conflict do nothing;
 if found then update public.greenhouses set moonlight_bloom=true where id=attempt.greenhouse_id;insert into public.world_events(greenhouse_id,version,kind,player_id) values(attempt.greenhouse_id,new_version,'moonlight-bloom',attempt.player_id);end if;
 end if;rewarded:=true;
 end if;
 update public.lesson_attempts set status=case when rewarded then 'completed' else 'practice' end where id=attempt.id;
 return jsonb_build_object('rewarded',rewarded,'energy',(select energy from public.greenhouses where id=attempt.greenhouse_id),'greenhouse_id',attempt.greenhouse_id);
end $$;

revoke all on private.daily_quest_policy,private.daily_quest_progress,private.daily_focus_state,private.daily_quest_memberships from public,anon,authenticated;
revoke all on function private.quest_now(),private.quest_day(timestamptz),private.track_daily_membership(),private.record_daily_lesson() from public,anon,authenticated;
revoke all on function public.daily_quest_status(),public.record_daily_study(text,integer,uuid),public.settle_daily_quest_penalties() from public,anon,authenticated;
grant execute on function public.daily_quest_status(),public.record_daily_study(text,integer,uuid) to authenticated;
grant execute on function public.settle_daily_quest_penalties() to service_role;
commit;
