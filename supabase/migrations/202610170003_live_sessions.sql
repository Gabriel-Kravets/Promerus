begin;
alter table public.room_sessions add column seat integer not null default -1 check(seat between -1 and 3);
alter table public.room_sessions add column moved_at timestamptz not null default now();
-- Only the Edge handler can apply a geometry-checked movement sample.
create function public.apply_movement(p_player uuid,p_session uuid,p_x double precision,p_y double precision,p_facing integer,p_sequence bigint,p_activity text,p_seat integer,p_previous_sequence bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.room_sessions;pixels double precision;elapsed double precision;begin
 select * into s from public.room_sessions where id=p_session and player_id=p_player for update;
 if s.id is null or s.lease_until<=now() or not private.access(s.greenhouse_id,p_player) then raise exception 'Session expired' using errcode='42501';end if;
 if p_sequence<=s.sequence then return to_jsonb(s);end if;
 if s.sequence<>p_previous_sequence then raise exception 'Movement state changed' using errcode='40001';end if;
 if p_x not between -2 and 16 or p_y not between -2 and 16 or p_x in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) or p_y in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) then raise exception 'Invalid movement';end if;
 elapsed:=least(2,greatest(0,extract(epoch from clock_timestamp()-s.moved_at)));
 pixels:=sqrt(power(((p_x-p_y)-(s.x-s.y))*36,2)+power(((p_x+p_y)-(s.x+s.y))*18,2));
 if pixels>112*elapsed+12 then raise exception 'Movement is too fast';end if;
 update public.room_sessions set x=p_x,y=p_y,facing=p_facing,sequence=p_sequence,activity=p_activity,seat=p_seat,moved_at=clock_timestamp(),last_seen=clock_timestamp(),lease_until=clock_timestamp()+interval '60 seconds' where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
revoke execute on function public.apply_movement(uuid,uuid,double precision,double precision,integer,bigint,text,integer,bigint) from public,anon,authenticated;
grant execute on function public.apply_movement(uuid,uuid,double precision,double precision,integer,bigint,text,integer,bigint) to service_role;
alter table private.generation_jobs add column claimed boolean not null default false;
create function public.claim_generation(p_job uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin update private.generation_jobs set claimed=true,updated_at=now() where id=p_job and not claimed and state='pending';return found;end $$;
revoke execute on function public.claim_generation(uuid) from public,anon,authenticated;
grant execute on function public.claim_generation(uuid) to service_role;
create or replace function public.world_snapshot(p_world uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 if not private.access(p_world,a) then raise exception 'Greenhouse access denied' using errcode='42501';end if;
 return jsonb_build_object('server_time',clock_timestamp(),'world',(select to_jsonb(w) from public.greenhouses w where w.id=p_world),
 'members',coalesce((select jsonb_agg(to_jsonb(r)) from (
 select a.player_id,a.name,a.avatar,a.version as appearance_version,s.lease_until>now() as online,
 case when s.lease_until>now() then s.activity else 'Offline' end as activity,coalesce(s.x,8.5) as x,coalesce(s.y,8.5) as y,coalesce(s.facing,1) as facing,s.slot,s.seat,coalesce(s.sequence,0) as sequence
 from public.player_appearances a left join public.room_sessions s on s.player_id=a.player_id and s.greenhouse_id=p_world
 where exists(select 1 from public.greenhouse_memberships m where m.greenhouse_id=p_world and m.player_id=a.player_id) or (s.lease_until>now())
 order by s.slot nulls last,a.player_id) r),'[]'),
 'contributions',coalesce((select jsonb_agg(to_jsonb(r)) from(select l.player_id,a.name,sum(l.amount)::integer as energy from public.energy_ledger l join public.player_appearances a on a.player_id=l.player_id where l.greenhouse_id=p_world group by l.player_id,a.name) r),'[]'));
end $$;

-- Supabase's existing publication is extended only for this application's tables.
do $realtime$ declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['profiles','player_appearances','greenhouses','greenhouse_memberships','greenhouse_visits','room_sessions','energy_ledger','greenhouse_quests','world_events','lesson_completions'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
 execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;end if;
end $realtime$;
do $policies$ begin
 if to_regclass('realtime.messages') is not null then
 execute $policy$create policy sproutbound_room_receive on realtime.messages for select to authenticated using (
 extension='broadcast' and exists(select 1 from public.greenhouses g where
 realtime.topic()='world:'||g.id::text||':'||g.access_epoch::text and private.viewer_access(g.id)))$policy$;
 end if;
end $policies$;
-- Private Broadcast/Presence are optional hints only. Authority is always the
-- current RLS-checked database snapshot, including for revocation/reconnection.
-- Do not ALTER realtime.messages: Supabase already owns/enables its RLS.

-- Atomic publish prevents duplicate persisted courses when a generation job is retried.
create function public.publish_generation(p_job uuid,p_title text,p_topic text,p_difficulty text,p_source text,p_lessons jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare j private.generation_jobs;p uuid;begin
 select * into j from private.generation_jobs where id=p_job for update;
 if j.id is null then raise exception 'Job unavailable';end if;
 if j.state='succeeded' then return j.path_id;end if;
 if j.state<>'pending' or not j.claimed then raise exception 'Job is not active';end if;
 p:=public.publish_learning_path(j.player_id,p_title,p_topic,p_difficulty,p_source,p_lessons);
 perform public.finish_generation(j.id,p,null);return p;
end $$;
revoke execute on function public.publish_generation(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.publish_generation(uuid,text,text,text,text,jsonb) to service_role;
create function public.prune_expired_game_data() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.room_sessions where lease_until<now()-interval '1 hour';
 delete from public.greenhouse_visits where expires_at<now()-interval '1 day';
 delete from private.greenhouse_invites where expires_at<now()-interval '7 days';
 delete from private.rate_limits where bucket<now()-interval '2 days';
 update private.generation_jobs set state='failed',error_code='job_timeout',updated_at=now() where state='pending' and updated_at<now()-interval '5 minutes';
 delete from public.world_events where created_at<now()-interval '7 days';
end $$;
revoke execute on function public.prune_expired_game_data() from public,anon,authenticated;
grant execute on function public.prune_expired_game_data() to service_role;

create function public.react_sproutling(p_session uuid,p_reaction text) returns void language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();s public.room_sessions;v bigint;begin
 select * into s from public.room_sessions where id=p_session and player_id=a and lease_until>now();
 if s.id is null or not private.access(s.greenhouse_id,a) then raise exception 'Session expired' using errcode='42501';end if;
 if p_reaction not in ('happy','watering','sleeping') then raise exception 'Invalid reaction';end if;
 perform private.limit_action(a,'sproutling',5,60);
 update public.greenhouses set pet_pause_total=pet_pause_total+greatest(0,extract(epoch from now()+interval '4 seconds'-greatest(coalesce(pet_pause_until,now()),now()))),pet_pause_until=now()+interval '4 seconds',version=version+1 where id=s.greenhouse_id returning version into v;
 insert into public.world_events(greenhouse_id,version,kind,reaction,player_id) values(s.greenhouse_id,v,'sproutling',p_reaction,a);
end $$;
revoke execute on function public.react_sproutling(uuid,text) from public,anon,authenticated;
grant execute on function public.react_sproutling(uuid,text) to authenticated;

commit;
