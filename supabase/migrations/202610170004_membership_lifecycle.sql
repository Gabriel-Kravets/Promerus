begin;
create function public.leave_greenhouse(p_world uuid,p_successor uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();w public.greenhouses;begin
 select * into w from public.greenhouses where id=p_world for update;
 if w.id is null or not private.access(p_world,a) then raise exception 'Greenhouse access denied' using errcode='42501';end if;
 if w.owner_id=a then
  if exists(select 1 from public.greenhouse_memberships where greenhouse_id=p_world and player_id<>a) then
   if p_successor is null or p_successor=a or not private.member(p_world,p_successor) then raise exception 'Choose a current member to take ownership';end if;
   update public.greenhouses set owner_id=p_successor where id=p_world;
   update public.greenhouse_memberships set role='owner' where greenhouse_id=p_world and player_id=p_successor;
  else
   update public.greenhouses set archived=true where id=p_world;
   update private.greenhouse_invites set revoked=true where greenhouse_id=p_world;
   delete from public.greenhouse_visits where greenhouse_id=p_world;
   delete from public.room_sessions where greenhouse_id=p_world;
  end if;
 end if;
 delete from public.greenhouse_memberships where greenhouse_id=p_world and player_id=a;
 delete from public.greenhouse_visits where greenhouse_id=p_world and player_id=a;
 delete from public.room_sessions where greenhouse_id=p_world and player_id=a;
 update public.profiles set last_greenhouse_id=null where player_id=a and last_greenhouse_id=p_world;
 update public.greenhouses set access_epoch=access_epoch+1,version=version+1 where id=p_world;
end $$;
revoke execute on function public.leave_greenhouse(uuid,uuid) from public,anon,authenticated;
grant execute on function public.leave_greenhouse(uuid,uuid) to authenticated;
commit;
