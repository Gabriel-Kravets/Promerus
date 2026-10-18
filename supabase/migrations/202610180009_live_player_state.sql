-- Local migration only. Do not apply to a hosted database without approval.
-- UTC day boundary: private.utc_day() is the calendar date in UTC. Daily login
-- and daily quests reset at 00:00 UTC. A login streak increments only when the
-- previous UTC date has a login row; a missed UTC day resets the streak to 1.
-- The login reward and each quest reward are inserted once per account per UTC
-- day through stable idempotency keys. Shared greenhouse energy, stage, and
-- membership rules are unchanged.
begin;

alter table public.profiles add column friend_code text;
alter table public.profiles add column last_x double precision;
alter table public.profiles add column last_y double precision;
alter table public.profiles add column last_facing integer;
alter table public.profiles add constraint profiles_last_position check (
 (last_x is null and last_y is null and last_facing is null)
 or (last_x between -2 and 16 and last_y between -2 and 16 and last_facing in (-1,1))
);
alter table public.greenhouses add column last_growth_at timestamptz;

create table public.player_wallets (
 player_id uuid primary key references public.profiles on delete cascade,
 gold integer not null default 0 check (gold >= 0),
 nutrients integer not null default 0 check (nutrients >= 0),
 version bigint not null default 0
);
create table public.currency_ledger (
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.profiles on delete cascade,
 kind text not null check (kind in ('gold','nutrients')),
 amount integer not null check (amount <> 0),
 balance_after integer not null check (balance_after >= 0),
 idempotency_key uuid not null,
 reason text not null check (length(reason) between 1 and 80),
 created_at timestamptz not null default now(),
 unique (player_id, idempotency_key)
);
create index currency_ledger_player on public.currency_ledger(player_id, created_at);

create table public.login_days (
 player_id uuid references public.profiles on delete cascade,
 day date not null,
 streak integer not null check (streak >= 1),
 primary key (player_id, day)
);
create table public.quest_progress (
 player_id uuid references public.profiles on delete cascade,
 day date not null,
 quest_key text not null check (quest_key in ('science-cards','focus-minutes','complete-lesson')),
 progress integer not null default 0 check (progress >= 0),
 target integer not null check (target > 0),
 claimed boolean not null default false,
 primary key (player_id, day, quest_key)
);
create table public.quest_events (
 player_id uuid references public.profiles on delete cascade,
 event_id uuid not null,
 quest_key text not null,
 day date not null,
 primary key (player_id, event_id)
);
create table private.quest_ticks (
 player_id uuid primary key references public.profiles on delete cascade,
 focus_at timestamptz,
 science_at timestamptz
);
create table public.friend_links (
 id uuid primary key default gen_random_uuid(),
 player_low uuid not null references public.profiles on delete cascade,
 player_high uuid not null references public.profiles on delete cascade,
 requester_id uuid not null references public.profiles,
 status text not null check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (player_low < player_high),
 check (requester_id = player_low or requester_id = player_high),
 unique (player_low, player_high)
);

create or replace function private.valid_avatar(a jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(a)='object' and (select count(*) from jsonb_object_keys(a))=6
 and lower(a->>'skin') in ('#f4d4af','#e5b78d','#d29c73','#ba8261','#9c664d','#684737')
 and lower(a->>'hair') in ('#282126','#53372e','#8d6044','#d8b166','#e0d8bf','#86758d','#ac737d','#678f8d')
 and lower(a->>'outfit') in ('#678f8d','#b17d83','#8a85b7','#af955c','#577b60','#af7352')
 and jsonb_typeof(a->'style')='number' and jsonb_typeof(a->'cut')='number'
 and a->>'style' in ('0','1','2','4') and a->>'cut' in ('0','1','2','3')
 and a->>'accessory' in ('None','Hat','Glasses','Ribbon'), false);
$$;

create function private.utc_day() returns date language sql stable set search_path='' as $$
 select (timezone('utc', clock_timestamp()))::date;
$$;
create function private.key_for(p_player uuid, p_label text) returns uuid language sql immutable set search_path='' as $$
 select (substr(md5(p_player::text||':'||p_label),1,8)||'-'||substr(md5(p_player::text||':'||p_label),9,4)||'-'||substr(md5(p_player::text||':'||p_label),13,4)||'-'||substr(md5(p_player::text||':'||p_label),17,4)||'-'||substr(md5(p_player::text||':'||p_label),21,12))::uuid;
$$;
create function private.assign_friend_code() returns trigger language plpgsql set search_path='' as $$
begin
 if new.friend_code is null then new.friend_code:=substr(replace(gen_random_uuid()::text,'-',''),1,12); end if;
 return new;
end $$;
create trigger profiles_friend_code before insert on public.profiles for each row execute function private.assign_friend_code();
update public.profiles set friend_code=substr(replace(gen_random_uuid()::text,'-',''),1,12) where friend_code is null;
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_friend_code_unique unique (friend_code);

create function private.post_currency(p_player uuid, p_kind text, p_amount integer, p_key uuid, p_reason text) returns integer language plpgsql security definer set search_path='' as $$
declare bal integer;
begin
 if p_amount=0 or p_kind not in ('gold','nutrients') or p_key is null then raise exception 'Invalid currency'; end if;
 insert into public.player_wallets(player_id) values(p_player) on conflict do nothing;
 perform 1 from public.player_wallets where player_id=p_player for update;
 select balance_after into bal from public.currency_ledger where player_id=p_player and idempotency_key=p_key;
 if found then return bal; end if;
 begin
  update public.player_wallets set
   gold=gold+case when p_kind='gold' then p_amount else 0 end,
   nutrients=nutrients+case when p_kind='nutrients' then p_amount else 0 end,
   version=version+1
  where player_id=p_player
  returning case when p_kind='gold' then gold else nutrients end into bal;
  insert into public.currency_ledger(player_id,kind,amount,balance_after,idempotency_key,reason) values(p_player,p_kind,p_amount,bal,p_key,p_reason);
 exception when check_violation then
  raise exception 'Insufficient balance' using errcode='23514';
 end;
 return bal;
end $$;

-- Prices match src/lib/shop.ts. Clients never submit an amount.
create function private.item_price(p_item text) returns integer language sql immutable set search_path='' as $$
 select case p_item when 'lantern' then 60 when 'armchair' then 140 when 'stove' then 160 when 'botanical-desk' then 180 when 'telescope' then 200 else null end;
$$;
create function private.spend_gold(p_player uuid, p_item text, p_key uuid) returns integer language plpgsql security definer set search_path='' as $$
declare price integer:=private.item_price(p_item);
begin
 if price is null then raise exception 'Room item unavailable'; end if;
 return private.post_currency(p_player,'gold',-price,p_key,'shop:'||p_item);
end $$;

create function private.advance_quest(p_player uuid, p_quest text, p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare d date:=private.utc_day(); v_target integer; v_progress integer; v_claimed boolean;
begin
 if p_quest not in ('science-cards','focus-minutes','complete-lesson') or p_event is null then raise exception 'Invalid quest event'; end if;
 v_target:=case p_quest when 'science-cards' then 3 when 'focus-minutes' then 20 else 1 end;
 if exists(select 1 from public.quest_progress q where q.player_id=p_player and q.day=d and q.quest_key=p_quest and q.progress>=q.target) then return; end if;
 insert into public.quest_events(player_id,event_id,quest_key,day) values(p_player,p_event,p_quest,d) on conflict do nothing;
 if not found then return; end if;
 insert into public.quest_progress(player_id,day,quest_key,progress,target,claimed) values(p_player,d,p_quest,1,v_target,false)
 on conflict (player_id,day,quest_key) do update set progress=least(public.quest_progress.target, public.quest_progress.progress+1)
 returning progress, claimed, target into v_progress, v_claimed, v_target;
 if v_progress>=v_target and not v_claimed then
  update public.quest_progress set claimed=true where player_id=p_player and day=d and quest_key=p_quest and not claimed;
  if found then
   perform private.post_currency(p_player,'nutrients', case p_quest when 'science-cards' then 15 when 'focus-minutes' then 20 else 15 end, private.key_for(p_player,'quest:nutrients:'||d::text||':'||p_quest), 'daily-quest');
   perform private.post_currency(p_player,'gold', case p_quest when 'science-cards' then 3 when 'focus-minutes' then 4 else 5 end, private.key_for(p_player,'quest:gold:'||d::text||':'||p_quest), 'daily-quest');
  end if;
 end if;
end $$;

create function private.reward_verified_lesson() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.post_currency(new.player_id,'nutrients',20,new.completion_id,'verified-lesson');
 perform private.post_currency(new.player_id,'gold',4,new.id,'verified-lesson');
 perform private.advance_quest(new.player_id,'complete-lesson',new.completion_id);
 return new;
end $$;
create trigger energy_rewards_currency after insert on public.energy_ledger for each row execute function private.reward_verified_lesson();

create function private.note_growth() returns trigger language plpgsql set search_path='' as $$
begin
 if new.energy is distinct from old.energy and new.energy>old.energy then new.last_growth_at:=clock_timestamp(); end if;
 return new;
end $$;
create trigger greenhouses_note_growth before update of energy on public.greenhouses for each row execute function private.note_growth();

create function private.restore_position() returns trigger language plpgsql set search_path='' as $$
declare lx double precision; ly double precision; lf integer;
begin
 select last_x,last_y,last_facing into lx,ly,lf from public.profiles where player_id=new.player_id;
 if lx between -2 and 16 and ly between -2 and 16 and lf in (-1,1) then new.x:=lx; new.y:=ly; new.facing:=lf; end if;
 return new;
end $$;
create trigger sessions_restore_position before insert on public.room_sessions for each row execute function private.restore_position();
create function private.remember_position() returns trigger language plpgsql set search_path='' as $$
begin
 update public.profiles set last_x=new.x, last_y=new.y, last_facing=new.facing where player_id=new.player_id;
 return new;
end $$;
create trigger sessions_remember_position after insert or update of x, y, facing on public.room_sessions for each row execute function private.remember_position();

create function public.commit_purchased_layout(p_player uuid, p_world uuid, p_expected_version bigint, p_layout jsonb, p_item text, p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.spend_gold(p_player,p_item,p_key);
 return public.commit_room_layout(p_player,p_world,p_expected_version,p_layout);
end $$;

create function private.friend_state(a uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(jsonb_build_object(
  'id', f.id,
  'player_id', other.player_id,
  'name', other.name,
  'avatar', appearance.avatar,
  'status', f.status,
  'incoming', f.status='pending' and f.requester_id<>a,
  'online', f.status='accepted' and exists(select 1 from public.room_sessions s where s.player_id=other.player_id and s.lease_until>now())
 ) order by other.name) from public.friend_links f
 join public.profiles other on other.player_id=case when f.player_low=a then f.player_high else f.player_low end
 join public.player_appearances appearance on appearance.player_id=other.player_id
 where a in (f.player_low, f.player_high) and f.status in ('pending','accepted')), '[]'::jsonb);
$$;

create function public.player_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor(); d date:=private.utc_day(); previous integer; v_streak integer; code text;
begin
 insert into public.player_wallets(player_id) values(a) on conflict do nothing;
 if not exists(select 1 from public.login_days where player_id=a and day=d) then
  select l.streak into previous from public.login_days l where l.player_id=a and l.day=d-1;
  v_streak:=coalesce(previous,0)+1;
  insert into public.login_days(player_id,day,streak) values(a,d,v_streak);
  perform private.post_currency(a,'nutrients',10,private.key_for(a,'login:nutrients:'||d::text),'daily-login');
  perform private.post_currency(a,'gold',5,private.key_for(a,'login:gold:'||d::text),'daily-login');
 end if;
 select friend_code into code from public.profiles where player_id=a;
 return jsonb_build_object(
  'gold',(select gold from public.player_wallets where player_id=a),
  'nutrients',(select nutrients from public.player_wallets where player_id=a),
  'version',(select version from public.player_wallets where player_id=a),
  'friend_code',code,
  'login',(select jsonb_build_object('day',l.day,'streak',l.streak) from public.login_days l where l.player_id=a and l.day=d),
  'resets_in_seconds', floor(extract(epoch from ((d+1)::timestamp - timezone('utc', clock_timestamp()))))::integer,
  'quests', coalesce((select jsonb_agg(jsonb_build_object('text',q.text,'value',coalesce(p.progress,0),'max',q.target,'unit',q.unit,'claimed',coalesce(p.claimed,false)) order by q.ordinal)
   from (values (1,'science-cards','Review 3 Science cards',3,'cards'),(2,'focus-minutes','Focus for 20 minutes',20,'min'),(3,'complete-lesson','Complete a lesson',1,'lesson')) as q(ordinal,key,text,target,unit)
   left join public.quest_progress p on p.player_id=a and p.day=d and p.quest_key=q.key), '[]'::jsonb),
  'friends', private.friend_state(a)
 );
end $$;

create function public.record_science_card(p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor(); tick timestamptz;
begin
 select science_at into tick from private.quest_ticks where player_id=a for update;
 if tick is not null and tick>clock_timestamp()-interval '2 seconds' then return public.player_state(); end if;
 insert into private.quest_ticks(player_id,science_at) values(a,clock_timestamp()) on conflict(player_id) do update set science_at=clock_timestamp();
 perform private.advance_quest(a,'science-cards',p_key);
 return public.player_state();
end $$;
create function public.record_focus_minute() returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor(); tick timestamptz; d date:=private.utc_day(); n integer;
begin
 select focus_at into tick from private.quest_ticks where player_id=a for update;
 if tick is not null and tick>clock_timestamp()-interval '55 seconds' then return public.player_state(); end if;
 insert into private.quest_ticks(player_id,focus_at) values(a,clock_timestamp()) on conflict(player_id) do update set focus_at=clock_timestamp();
 select coalesce(progress,0)+1 into n from public.quest_progress where player_id=a and day=d and quest_key='focus-minutes';
 n:=coalesce(n,1);
 perform private.advance_quest(a,'focus-minutes',private.key_for(a,'focus:'||d::text||':'||n::text));
 return public.player_state();
end $$;

create function public.request_friend(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor(); other uuid; low uuid; high uuid; existing public.friend_links;
begin
 perform private.limit_action(a,'friend-request',30,3600);
 if p_code is null or length(btrim(p_code))<>12 then raise exception 'Gardener not found'; end if;
 select player_id into other from public.profiles where lower(friend_code)=lower(btrim(p_code));
 if other is null or other=a then raise exception 'Gardener not found'; end if;
 low:=least(a,other); high:=greatest(a,other);
 select * into existing from public.friend_links where player_low=low and player_high=high for update;
 if existing.id is null then
  insert into public.friend_links(player_low,player_high,requester_id,status) values(low,high,a,'pending');
 elsif existing.status='accepted' then
  null;
 elsif existing.status='pending' and existing.requester_id=other then
  update public.friend_links set status='accepted', updated_at=now() where id=existing.id;
 elsif existing.status='declined' then
  update public.friend_links set status='pending', requester_id=a, updated_at=now() where id=existing.id;
 end if;
 return public.player_state();
end $$;
create function public.respond_friend(p_link uuid, p_accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor(); link public.friend_links;
begin
 select * into link from public.friend_links where id=p_link for update;
 if link.id is null or a not in (link.player_low, link.player_high) or link.requester_id=a or link.status<>'pending' then raise exception 'Friend request unavailable' using errcode='42501'; end if;
 update public.friend_links set status=case when p_accept then 'accepted' else 'declined' end, updated_at=now() where id=link.id;
 return public.player_state();
end $$;
create function public.remove_friend(p_link uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();
begin
 delete from public.friend_links where id=p_link and status='accepted' and a in (player_low, player_high);
 if not found then raise exception 'Friend request unavailable' using errcode='42501'; end if;
 return public.player_state();
end $$;

alter table public.player_wallets enable row level security;
alter table public.currency_ledger enable row level security;
alter table public.login_days enable row level security;
alter table public.quest_progress enable row level security;
alter table public.quest_events enable row level security;
alter table public.friend_links enable row level security;
create policy own_wallet on public.player_wallets for select to authenticated using (player_id=private.actor());
create policy own_ledger on public.currency_ledger for select to authenticated using (player_id=private.actor());
create policy own_login on public.login_days for select to authenticated using (player_id=private.actor());
create policy own_quests on public.quest_progress for select to authenticated using (player_id=private.actor());
create policy own_quest_events on public.quest_events for select to authenticated using (player_id=private.actor());
create policy own_friends on public.friend_links for select to authenticated using (private.actor() in (player_low, player_high));
revoke all on public.player_wallets, public.currency_ledger, public.login_days, public.quest_progress, public.quest_events, public.friend_links from anon, authenticated;
grant select on public.player_wallets, public.currency_ledger, public.login_days, public.quest_progress, public.quest_events, public.friend_links to authenticated, service_role;

do $grant$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('commit_purchased_layout','player_state','record_science_card','record_focus_minute','request_friend','respond_friend','remove_friend') loop
  execute format('revoke execute on function %s from public,anon,authenticated', f.signature);
 end loop;
end $grant$;
grant execute on function public.player_state(), public.record_science_card(uuid), public.record_focus_minute(), public.request_friend(text), public.respond_friend(uuid, boolean), public.remove_friend(uuid) to authenticated;
revoke all on function public.commit_purchased_layout(uuid,uuid,bigint,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.commit_purchased_layout(uuid,uuid,bigint,jsonb,text,uuid) to service_role;
revoke all on function private.post_currency(uuid,text,integer,uuid,text), private.item_price(text), private.spend_gold(uuid,text,uuid), private.advance_quest(uuid,text,uuid), private.friend_state(uuid), private.key_for(uuid,text), private.utc_day() from public, anon, authenticated;

do $realtime$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['player_wallets','currency_ledger','quest_progress','login_days','friend_links','player_appearances'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I', t);
   end if;
  end loop;
 end if;
end $realtime$;
commit;
