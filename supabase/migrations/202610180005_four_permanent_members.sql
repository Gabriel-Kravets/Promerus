-- Applied manually by the user to staging via Query 26 on 2026-10-18.
-- Verified against hosted catalogs; migration history reconciled without re-execution.
-- Supabase SQL Editor query: 26_Sproutbound_Four_Permanent_Members
begin;

-- Stop without changing data if existing rooms exceed the proposed limit.
do $$
begin
 if exists (select 1 from public.greenhouse_memberships group by greenhouse_id having count(*) > 4) then
  raise exception 'Existing greenhouse exceeds four permanent members; review memberships before applying';
 end if;
end $$;

create function private.enforce_permanent_member_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' and NEW.greenhouse_id = OLD.greenhouse_id then return NEW; end if;
 -- Serialize admission for every invite to this room. Count owners and offline
 -- members as permanent members; visits remain governed by existing leases.
 perform 1 from public.greenhouses where id = NEW.greenhouse_id for update;
 if (select count(*) from public.greenhouse_memberships where greenhouse_id = NEW.greenhouse_id) >= 4 then
  raise exception 'Greenhouse already has four permanent members' using errcode = '23514';
 end if;
 return NEW;
end $$;
revoke all on function private.enforce_permanent_member_limit() from public, anon, authenticated;
create trigger greenhouse_permanent_member_limit
before insert or update of greenhouse_id on public.greenhouse_memberships
for each row execute function private.enforce_permanent_member_limit();

commit;
select 'Four-permanent-member admission guard installed; existing memberships preserved' as result;
