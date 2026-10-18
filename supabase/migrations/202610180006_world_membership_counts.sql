-- Applied manually by the user to staging; verified and history-reconciled without re-execution.
-- SQL Editor: 27_Sproutbound_World_Membership_Counts
begin;
create or replace function public.list_greenhouses() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 return coalesce((select jsonb_agg(row_to_json(r)) from(select g.id,g.name,g.visibility,g.allow_visits,g.stage,g.energy,g.owner_id=a as owned,
 private.member(g.id,a) as member,(select count(*) from public.greenhouse_memberships membership where membership.greenhouse_id=g.id) as member_count,exists(select 1 from public.room_sessions own_session where own_session.greenhouse_id=g.id and own_session.player_id=a and own_session.lease_until>now()) as active_here,(select count(*) from public.room_sessions s where s.greenhouse_id=g.id and s.lease_until>now()) as occupants
 from public.greenhouses g where not archived and (private.member(g.id,a) or g.visibility='public') order by g.created_at desc limit 100) r),'[]');
end $$;
commit;
select 'World listings include permanent member_count; admission guard unchanged' as result;
