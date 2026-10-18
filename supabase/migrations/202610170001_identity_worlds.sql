-- Development/staging only. Apply after inspecting the destination schema.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table private.identity_settings (
 singleton boolean primary key default true check(singleton), issuer text not null, audience text not null
);
insert into private.identity_settings values(true,'https://dev-phu3idfk55gl1dkn.us.auth0.com/','uiuwR5J2A8HJpHRTLyaoKsyDURhC2tMK');
create table private.player_identities (
 player_id uuid primary key default gen_random_uuid(), issuer text not null, subject text not null, unique(issuer,subject)
);
create function private.valid_claims() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.identity_settings s where auth.jwt()->>'iss'=s.issuer
 and auth.jwt()->>'role'='authenticated' and length(auth.jwt()->>'sub') between 1 and 256
 and (auth.jwt()->>'aud'=s.audience or (jsonb_typeof(auth.jwt()->'aud')='array' and (auth.jwt()->'aud') ? s.audience)));
$$;
create function private.actor() returns uuid language sql stable security definer set search_path='' as $$
 select i.player_id from private.player_identities i where private.valid_claims() and i.issuer=auth.jwt()->>'iss' and i.subject=auth.jwt()->>'sub';
$$;
create function private.require_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.actor(); begin if a is null then raise exception 'Authentication required' using errcode='28000'; end if; return a; end $$;

create table public.profiles (
 player_id uuid primary key references private.player_identities on delete cascade,
 name text not null default 'Gardener' check(length(btrim(name)) between 1 and 20),
 level text not null default 'Beginner' check(level in ('Beginner','Intermediate','Advanced')),
 goal text not null default '' check(length(goal)<=500), minutes text not null default '15' check(minutes in ('5','15','30')),
 interests text[] not null default '{}' check(cardinality(interests)<=8), onboarding_complete boolean not null default false,
 intro_state text not null default 'pending' check(intro_state in ('pending','seen','skipped')),
 last_greenhouse_id uuid, updated_at timestamptz not null default now()
);
create function private.valid_avatar(a jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(a)='object' and (select count(*) from jsonb_object_keys(a))=6
 and a->>'skin'~'^#[0-9a-fA-F]{6}$' and a->>'hair'~'^#[0-9a-fA-F]{6}$' and a->>'outfit'~'^#[0-9a-fA-F]{6}$'
 and jsonb_typeof(a->'style')='number' and jsonb_typeof(a->'cut')='number' and a->>'style' in ('0','1','2','4') and a->>'cut' in ('0','1','2','3') and a->>'accessory' in ('None','Hat','Glasses','Ribbon'),false);
$$;
create table public.player_appearances (
 player_id uuid primary key references public.profiles on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 20), avatar jsonb not null check(private.valid_avatar(avatar)),
 version bigint not null default 1, updated_at timestamptz not null default now()
);
create table public.greenhouses (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles,
 name text not null check(length(btrim(name)) between 1 and 60),visibility text not null default 'private' check(visibility in ('private','public')),
 allow_visits boolean not null default false,energy integer not null default 60 check(energy>=60),version bigint not null default 1,
 access_epoch bigint not null default 1,stage integer generated always as (case when energy>=300 then 3 when energy>=180 then 2 when energy>=100 then 1 else 0 end) stored,
 moonlight_bloom boolean not null default false,archived boolean not null default false,created_at timestamptz not null default now()
);
alter table public.profiles add foreign key(last_greenhouse_id) references public.greenhouses on delete set null;
create table public.greenhouse_memberships (
 greenhouse_id uuid references public.greenhouses on delete cascade,player_id uuid references public.profiles,
 role text not null check(role in ('owner','member')),joined_at timestamptz not null default now(),primary key(greenhouse_id,player_id)
);
create index memberships_player on public.greenhouse_memberships(player_id);
create table private.greenhouse_invites (
 id uuid primary key default gen_random_uuid(),greenhouse_id uuid not null references public.greenhouses on delete cascade,
 code_hash bytea unique not null,expires_at timestamptz not null,uses integer not null default 0,max_uses integer not null default 10 check(max_uses between 1 and 100),revoked boolean not null default false
);
create table public.greenhouse_visits (
 greenhouse_id uuid references public.greenhouses on delete cascade,player_id uuid references public.profiles,expires_at timestamptz not null,
 primary key(greenhouse_id,player_id)
);
create table public.room_sessions (
 id uuid primary key default gen_random_uuid(),greenhouse_id uuid not null references public.greenhouses on delete cascade,
 player_id uuid not null unique references public.profiles,slot integer not null check(slot between 0 and 3),
 lease_until timestamptz not null default now()+interval '60 seconds',last_seen timestamptz not null default now(),
 x double precision not null default 8.5,y double precision not null default 8.5,facing integer not null default 1 check(facing in (-1,1)),
 activity text not null default 'Idle' check(activity in ('Online','Studying','Exploring','Idle','Taking a break')),
 sequence bigint not null default 0 check(sequence>=0),unique(greenhouse_id,slot)
);
create index sessions_world on public.room_sessions(greenhouse_id,lease_until);
create function private.member(w uuid,a uuid default private.actor()) returns boolean language sql stable security definer set search_path='' as $$
 select a is not null and exists(select 1 from public.greenhouse_memberships m join public.greenhouses g on g.id=m.greenhouse_id where m.greenhouse_id=w and m.player_id=a and not g.archived);
$$;
create function private.owner(w uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.greenhouses where id=w and owner_id=private.actor() and not archived);
$$;
create function private.access(w uuid,a uuid default private.actor()) returns boolean language sql stable security definer set search_path='' as $$
 select private.member(w,a) or (a is not null and exists(select 1 from public.greenhouse_visits v join public.greenhouses g on g.id=v.greenhouse_id
 where v.greenhouse_id=w and v.player_id=a and v.expires_at>now() and g.visibility='public' and g.allow_visits and not g.archived));
$$;
create function private.viewer_access(w uuid) returns boolean language sql stable security definer set search_path='' as $$select private.access(w,private.actor())$$;
create function private.peer(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select a=private.actor() or exists(select 1 from public.greenhouse_memberships m where m.player_id=a and private.access(m.greenhouse_id))
 or exists(select 1 from public.room_sessions s where s.player_id=a and s.lease_until>now() and private.access(s.greenhouse_id));
$$;

create function public.bootstrap_player() returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; begin
 if not private.valid_claims() then raise exception 'Invalid identity' using errcode='28000'; end if;
 insert into private.player_identities(issuer,subject) values(auth.jwt()->>'iss',auth.jwt()->>'sub') on conflict(issuer,subject) do nothing;
 a:=private.require_actor();
 insert into public.profiles(player_id) values(a) on conflict do nothing;
 insert into public.player_appearances(player_id,name,avatar) values(a,'Gardener','{"skin":"#e5b78d","hair":"#53372e","style":0,"outfit":"#678f8d","cut":0,"accessory":"None"}') on conflict do nothing;
 return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where p.player_id=a),'appearance',(select to_jsonb(p) from public.player_appearances p where p.player_id=a));
end $$;
create function public.save_profile(p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();v_name text;current_version bigint;begin
 perform 1 from public.profiles where player_id=a for update;
 select version into current_version from public.player_appearances where player_id=a for update;
 if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('name','avatar','level','goal','minutes','interests','intro','onboardingComplete','appearanceVersion')) then raise exception 'Invalid profile fields'; end if;
 if (p_patch ? 'name' or p_patch ? 'avatar') and p_patch ? 'appearanceVersion' and (p_patch->>'appearanceVersion')::bigint<>current_version then raise exception 'Your appearance changed in another session. Reload before saving.';end if;
 if p_patch ? 'avatar' and not private.valid_avatar(p_patch->'avatar') then raise exception 'Invalid avatar'; end if;
 if p_patch ? 'interests' and (jsonb_typeof(p_patch->'interests')<>'array' or jsonb_array_length(p_patch->'interests')>8 or exists(select 1 from jsonb_array_elements(p_patch->'interests') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 80)) then raise exception 'Invalid interests'; end if;
 if p_patch ? 'intro' and p_patch->>'intro' not in ('seen','skipped') then raise exception 'Invalid introduction'; end if;
 update public.profiles set name=coalesce(btrim(p_patch->>'name'),name),level=coalesce(p_patch->>'level',level),goal=coalesce(p_patch->>'goal',goal),minutes=coalesce(p_patch->>'minutes',minutes),
 interests=case when p_patch ? 'interests' then array(select jsonb_array_elements_text(p_patch->'interests')) else interests end,
 intro_state=coalesce(p_patch->>'intro',intro_state),onboarding_complete=coalesce((p_patch->>'onboardingComplete')::boolean,onboarding_complete),updated_at=now() where player_id=a returning name into v_name;
 update public.player_appearances set name=v_name,avatar=coalesce(p_patch->'avatar',avatar),version=version+case when p_patch ? 'name' or p_patch ? 'avatar' then 1 else 0 end,updated_at=now() where player_id=a;
 return public.bootstrap_player();
end $$;
create function public.create_greenhouse(p_name text,p_public boolean default false,p_visits boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();w uuid;begin
 perform 1 from public.profiles where player_id=a for update;
 if (select count(*) from public.greenhouses where owner_id=a and not archived)>=10 then raise exception 'Greenhouse limit reached'; end if;
 insert into public.greenhouses(owner_id,name,visibility,allow_visits) values(a,btrim(p_name),case when p_public then 'public' else 'private' end,p_visits) returning id into w;
 insert into public.greenhouse_memberships values(w,a,'owner',now());return w;
end $$;
create function public.list_greenhouses() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 return coalesce((select jsonb_agg(row_to_json(r)) from(select g.id,g.name,g.visibility,g.allow_visits,g.stage,g.energy,g.owner_id=a as owned,
 private.member(g.id,a) as member,exists(select 1 from public.room_sessions own_session where own_session.greenhouse_id=g.id and own_session.player_id=a and own_session.lease_until>now()) as active_here,(select count(*) from public.room_sessions s where s.greenhouse_id=g.id and s.lease_until>now()) as occupants
 from public.greenhouses g where not archived and (private.member(g.id,a) or g.visibility='public') order by g.created_at desc limit 100) r),'[]');
end $$;
create function public.issue_invite(p_world uuid) returns text language plpgsql security definer set search_path='' as $$
declare code text:=gen_random_uuid()::text||gen_random_uuid()::text;begin
 if not private.owner(p_world) then raise exception 'Owner permission required' using errcode='42501'; end if;
 insert into private.greenhouse_invites(greenhouse_id,code_hash,expires_at) values(p_world,sha256(convert_to(code,'UTF8')),now()+interval '24 hours');return code;
end $$;
create table private.rate_limits(player_id uuid,kind text,bucket timestamptz,count integer not null,primary key(player_id,kind,bucket));
create function private.limit_action(a uuid,k text,n integer,window_seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare b timestamptz:=to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);c integer;begin
 insert into private.rate_limits values(a,k,b,1) on conflict(player_id,kind,bucket) do update set count=private.rate_limits.count+1 returning count into c;
 if c>n then raise exception 'Request limit reached' using errcode='54000'; end if;
end $$;
create function public.join_greenhouse(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();i private.greenhouse_invites;begin
 perform private.limit_action(a,'invite',20,3600);
 if length(p_code)>100 then return null; end if;
 select * into i from private.greenhouse_invites where code_hash=sha256(convert_to(p_code,'UTF8')) for update;
 if i.id is null or i.revoked or i.expires_at<=now() or i.uses>=i.max_uses then return null; end if;
 if not exists(select 1 from public.greenhouses where id=i.greenhouse_id and not archived) then return null; end if;
 if not private.member(i.greenhouse_id,a) then
 insert into public.greenhouse_memberships values(i.greenhouse_id,a,'member',now());update private.greenhouse_invites set uses=uses+1 where id=i.id;
 end if;return i.greenhouse_id;
end $$;
create function public.request_visit(p_world uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 if not exists(select 1 from public.greenhouses where id=p_world and visibility='public' and allow_visits and not archived) then raise exception 'Visit unavailable' using errcode='42501';end if;
 insert into public.greenhouse_visits values(p_world,a,now()+interval '1 hour') on conflict(greenhouse_id,player_id) do update set expires_at=excluded.expires_at;
 return p_world;
end $$;
create function public.enter_greenhouse(p_world uuid,p_takeover boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();s public.room_sessions;slot_number integer;begin
 perform 1 from public.profiles where player_id=a for update;
 perform 1 from public.greenhouses where id=p_world for update;
 if not private.access(p_world,a) then raise exception 'Greenhouse access denied' using errcode='42501';end if;
 select * into s from public.room_sessions where player_id=a;
 if s.id is not null and s.lease_until>now() and s.greenhouse_id=p_world and not p_takeover then raise exception 'Already controlled in another session; choose Take over';end if;
 delete from public.room_sessions where greenhouse_id=p_world and lease_until<=now();
 select n into slot_number from generate_series(0,3) n where not exists(select 1 from public.room_sessions r where r.greenhouse_id=p_world and r.slot=n and r.player_id<>a) order by n limit 1;
 if slot_number is null then raise exception 'Greenhouse is full';end if;
 delete from public.room_sessions where player_id=a;
 insert into public.room_sessions(greenhouse_id,player_id,slot,x,y) values(p_world,a,slot_number,case slot_number when 0 then 8.5 when 1 then 9 when 2 then 8 else 9.5 end,case slot_number when 0 then 8.5 when 1 then 8 when 2 then 9 else 7.5 end) returning * into s;
 update public.profiles set last_greenhouse_id=p_world where player_id=a;return to_jsonb(s);
end $$;
create function public.heartbeat(p_session uuid,p_activity text default 'Idle') returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();s public.room_sessions;begin
 select * into s from public.room_sessions where id=p_session and player_id=a for update;
 if s.id is null or s.lease_until<=now() or not private.access(s.greenhouse_id,a) then raise exception 'Session expired' using errcode='42501';end if;
 update public.room_sessions set lease_until=now()+interval '60 seconds',last_seen=now(),activity=p_activity where id=s.id returning * into s;return to_jsonb(s);
end $$;
create function public.leave_session(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
begin delete from public.room_sessions where id=p_session and player_id=private.require_actor();end $$;
create function public.manage_greenhouse(p_world uuid,p_name text,p_public boolean,p_visits boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.owner(p_world) then raise exception 'Owner permission required' using errcode='42501';end if;
 update public.greenhouses set name=btrim(p_name),visibility=case when p_public then 'public' else 'private' end,allow_visits=p_visits,access_epoch=access_epoch+1,version=version+1 where id=p_world;
 if not p_public or not p_visits then delete from public.greenhouse_visits where greenhouse_id=p_world;end if;
 delete from public.room_sessions s where s.greenhouse_id=p_world and not private.access(p_world,s.player_id);
end $$;
create function public.remove_member(p_world uuid,p_player uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.owner(p_world) or p_player=private.actor() then raise exception 'Owner permission required; owner cannot be removed' using errcode='42501';end if;
 delete from public.greenhouse_memberships where greenhouse_id=p_world and player_id=p_player;
 delete from public.greenhouse_visits where greenhouse_id=p_world and player_id=p_player;
 delete from public.room_sessions where greenhouse_id=p_world and player_id=p_player;
 update public.greenhouses set access_epoch=access_epoch+1,version=version+1 where id=p_world;
end $$;
create function public.revoke_invites(p_world uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not private.owner(p_world) then raise exception 'Owner permission required' using errcode='42501';end if;
 update private.greenhouse_invites set revoked=true where greenhouse_id=p_world;end $$;

alter table public.profiles enable row level security;
alter table public.player_appearances enable row level security;
alter table public.greenhouses enable row level security;
alter table public.greenhouse_memberships enable row level security;
alter table public.greenhouse_visits enable row level security;
alter table public.room_sessions enable row level security;
create policy own_profile on public.profiles for select to authenticated using(player_id=private.actor());
create policy peer_appearance on public.player_appearances for select to authenticated using(private.peer(player_id));
create policy permitted_world on public.greenhouses for select to authenticated using(private.viewer_access(id));
create policy permitted_membership on public.greenhouse_memberships for select to authenticated using(private.viewer_access(greenhouse_id));
create policy own_visit on public.greenhouse_visits for select to authenticated using(player_id=private.actor());
create policy permitted_session on public.room_sessions for select to authenticated using(private.viewer_access(greenhouse_id));
revoke all on public.profiles,public.player_appearances,public.greenhouses,public.greenhouse_memberships,public.greenhouse_visits,public.room_sessions from anon,authenticated;
grant select on public.profiles,public.player_appearances,public.greenhouses,public.greenhouse_memberships,public.greenhouse_visits,public.room_sessions to authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
do $grant$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('bootstrap_player','save_profile','create_greenhouse','list_greenhouses','issue_invite','join_greenhouse','request_visit','enter_greenhouse','heartbeat','leave_session','manage_greenhouse','remove_member','revoke_invites') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 end loop;
end $grant$;
grant execute on function private.actor(),private.viewer_access(uuid),private.peer(uuid) to authenticated;
grant execute on function public.bootstrap_player(),public.save_profile(jsonb),public.create_greenhouse(text,boolean,boolean),public.list_greenhouses(),public.issue_invite(uuid),public.join_greenhouse(text),public.request_visit(uuid),public.enter_greenhouse(uuid,boolean),public.heartbeat(uuid,text),public.leave_session(uuid),public.manage_greenhouse(uuid,text,boolean,boolean),public.remove_member(uuid,uuid),public.revoke_invites(uuid) to authenticated;
commit;
