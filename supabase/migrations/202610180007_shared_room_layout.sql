-- Applied manually by the user to staging; verified and history-reconciled without re-execution.
-- SQL Editor: 28_Sproutbound_Shared_Room_Layout
-- Stores existing gameplay state; does not change artwork, currencies or rewards.
begin;
alter table public.greenhouses add column room_layout jsonb;
alter table public.greenhouses add column room_layout_version bigint not null default 0;
alter table public.greenhouses add constraint valid_room_layout
 check(room_layout is null or (jsonb_typeof(room_layout)='object' and octet_length(room_layout::text)<=65536));

-- Edge Function only: the existing client must not submit arbitrary authoritative
-- geometry. Before calling, game-api must validate the actor, item definitions,
-- inventory/fixture changes, legal placement and version using shared main logic.
create function public.commit_room_layout(p_player uuid,p_world uuid,p_expected_version bigint,p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.greenhouses;
begin
 select * into w from public.greenhouses where id=p_world for update;
 if w.id is null or w.archived or not private.member(p_world,p_player) then
  raise exception 'Membership required' using errcode='42501';
 end if;
 if p_expected_version is null or p_expected_version<>w.room_layout_version then
  raise exception 'Room layout changed; reload before editing' using errcode='40001';
 end if;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>65536
  or jsonb_typeof(p_layout->'items') is distinct from 'array'
  or jsonb_typeof(p_layout->'placements') is distinct from 'array'
  or jsonb_typeof(p_layout->'fixturePositions') is distinct from 'object'
  or jsonb_typeof(p_layout->'storedFixtures') is distinct from 'array'
  or exists(select 1 from jsonb_object_keys(p_layout) k where k not in ('items','placements','fixturePositions','storedFixtures')) then
  raise exception 'Invalid room layout';
 end if;
 update public.greenhouses set room_layout=p_layout,room_layout_version=room_layout_version+1,version=version+1
 where id=p_world returning * into w;
 return jsonb_build_object('layout',w.room_layout,'layout_version',w.room_layout_version);
end $$;
revoke all on function public.commit_room_layout(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.commit_room_layout(uuid,uuid,bigint,jsonb) to service_role;
commit;
select 'Shared layout storage and service-only commit RPC installed; Edge validation still required' as result;
