begin;
alter table public.greenhouses add column pet_pause_total double precision not null default 0;
alter table public.greenhouses add column pet_pause_until timestamptz;
create table public.learning_paths (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.profiles,title text not null check(length(title) between 1 and 120),
 topic text not null check(length(topic) between 1 and 200),difficulty text not null check(difficulty in ('Beginner','Intermediate','Advanced')),
 source text not null check(source in ('authored','gemini')),version integer not null default 1,created_at timestamptz not null default now()
);
create unique index one_authored_path on public.learning_paths(player_id,topic,version) where source='authored';
create table public.lessons (
 id uuid primary key default gen_random_uuid(),path_id uuid not null references public.learning_paths on delete cascade,
 canonical_key text not null,title text not null,text text not null,ordinal integer not null check(ordinal between 0 and 4),unique(path_id,ordinal)
);
create table public.lesson_questions (
 id uuid primary key default gen_random_uuid(),lesson_id uuid not null references public.lessons on delete cascade,
 ordinal integer not null check(ordinal between 0 and 9),kind text not null check(kind in ('multiple_choice','short_answer')),
 prompt text not null check(length(prompt) between 1 and 2000),options jsonb,unique(lesson_id,ordinal),
 check((kind='multiple_choice' and jsonb_typeof(options)='array' and jsonb_array_length(options)=4) or (kind='short_answer' and options is null))
);
create table private.lesson_solutions (
 question_id uuid primary key references public.lesson_questions on delete cascade,answer text not null,explanation text not null,rubric text
);
create table public.lesson_attempts (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.profiles,lesson_id uuid not null references public.lessons,
 greenhouse_id uuid not null references public.greenhouses,idempotency_key uuid not null,
 status text not null default 'open' check(status in ('open','completed','practice')),created_at timestamptz not null default now(),unique(player_id,idempotency_key)
);
create table public.attempt_answers (
 attempt_id uuid references public.lesson_attempts on delete cascade,question_id uuid references public.lesson_questions,
 submitted text not null check(length(submitted)<=4000),correct boolean not null,explanation text not null,graded_at timestamptz not null default now(),primary key(attempt_id,question_id)
);
create table public.lesson_completions (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.profiles,canonical_key text not null,
 lesson_id uuid not null references public.lessons,attempt_id uuid not null unique references public.lesson_attempts,completed_at timestamptz not null default now(),unique(player_id,canonical_key)
);
create table public.energy_ledger (
 id uuid primary key default gen_random_uuid(),completion_id uuid not null unique references public.lesson_completions,
 player_id uuid not null references public.profiles,greenhouse_id uuid not null references public.greenhouses,amount integer not null default 20 check(amount=20),created_at timestamptz not null default now()
);
create index ledger_world_player on public.energy_ledger(greenhouse_id,player_id);
create table public.greenhouse_quests (
 greenhouse_id uuid references public.greenhouses,quest_key text not null check(quest_key='moonlight-bloom-v1'),completed_at timestamptz not null default now(),primary key(greenhouse_id,quest_key)
);
create table public.world_events (
 id bigint generated always as identity primary key,greenhouse_id uuid not null references public.greenhouses,version bigint not null,
 kind text not null check(kind in ('lesson','growth','moonlight-bloom','sproutling')),reaction text check(reaction in ('happy','watering','sleeping')),player_id uuid references public.profiles,created_at timestamptz not null default now()
);
create index events_world_id on public.world_events(greenhouse_id,id);
create table private.generation_jobs (
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.profiles,idempotency_key uuid not null,
 state text not null check(state in ('pending','succeeded','failed')),path_id uuid references public.learning_paths,error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(player_id,idempotency_key)
);

create function public.begin_attempt(p_lesson uuid,p_world uuid,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();attempt public.lesson_attempts;idx integer;path uuid;begin
 if not private.member(p_world,a) then raise exception 'Study rewards require membership' using errcode='42501';end if;
 select l.ordinal,l.path_id into idx,path from public.lessons l join public.learning_paths p on p.id=l.path_id where l.id=p_lesson and p.player_id=a;
 if path is null then raise exception 'Lesson unavailable' using errcode='42501';end if;
 if idx>0 and not exists(select 1 from public.lessons l join public.lesson_completions c on c.player_id=a and c.canonical_key=l.canonical_key where l.path_id=path and l.ordinal=idx-1) then raise exception 'Previous lesson is incomplete';end if;
 insert into public.lesson_attempts(player_id,lesson_id,greenhouse_id,idempotency_key) values(a,p_lesson,p_world,p_key) on conflict(player_id,idempotency_key) do nothing;
 select * into attempt from public.lesson_attempts where player_id=a and idempotency_key=p_key;
 if attempt.lesson_id<>p_lesson or attempt.greenhouse_id<>p_world then raise exception 'Idempotency key belongs to another attempt';end if;
 return attempt.id;
end $$;
create function public.submit_multiple_choice(p_attempt uuid,p_question uuid,p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();attempt public.lesson_attempts;q public.lesson_questions;s private.lesson_solutions;ok boolean;begin
 select * into attempt from public.lesson_attempts where id=p_attempt and player_id=a for update;
 select * into q from public.lesson_questions where id=p_question and lesson_id=attempt.lesson_id;
 if attempt.id is null or q.id is null or q.kind<>'multiple_choice' or attempt.status<>'open' then raise exception 'Attempt unavailable' using errcode='42501';end if;
 if p_answer not in ('0','1','2','3') then raise exception 'Invalid answer';end if;
 select * into s from private.lesson_solutions where question_id=q.id;ok:=p_answer=s.answer;
 if s.question_id is null then raise exception 'Lesson grading is unavailable';end if;
 insert into public.attempt_answers values(attempt.id,q.id,p_answer,ok,s.explanation,now()) on conflict(attempt_id,question_id) do update set submitted=excluded.submitted,correct=excluded.correct,explanation=excluded.explanation,graded_at=now();
 return jsonb_build_object('correct',ok,'explanation',s.explanation);
end $$;
-- Only the trusted authenticated Edge handler can access short-answer references.
create function public.grading_context(p_attempt uuid,p_question uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('player_id',a.player_id,'status',a.status,'kind',q.kind,'prompt',q.prompt,'answer',s.answer,'rubric',s.rubric,'explanation',s.explanation)
 from public.lesson_attempts a join public.lesson_questions q on q.lesson_id=a.lesson_id join private.lesson_solutions s on s.question_id=q.id
 where a.id=p_attempt and q.id=p_question;
$$;
create function public.record_short_grade(p_attempt uuid,p_question uuid,p_answer text,p_correct boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.lesson_attempts;ex text;begin
 select * into a from public.lesson_attempts where id=p_attempt for update;
 select s.explanation into ex from private.lesson_solutions s join public.lesson_questions q on q.id=s.question_id where q.id=p_question and q.lesson_id=a.lesson_id and q.kind='short_answer';
 if a.id is null or a.status<>'open' or ex is null then raise exception 'Attempt unavailable';end if;
 insert into public.attempt_answers values(a.id,p_question,p_answer,p_correct,ex,now()) on conflict(attempt_id,question_id) do update set submitted=excluded.submitted,correct=excluded.correct,explanation=excluded.explanation,graded_at=now();
 return jsonb_build_object('correct',p_correct,'explanation',ex);
end $$;
create function public.finalize_attempt(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 update public.greenhouses set pet_pause_total=pet_pause_total+greatest(0,extract(epoch from now()+interval '4 seconds'-greatest(coalesce(pet_pause_until,now()),now()))),pet_pause_until=now()+interval '4 seconds',energy=60+(select coalesce(sum(amount),0) from public.energy_ledger where greenhouse_id=attempt.greenhouse_id),version=version+1 where id=attempt.greenhouse_id returning energy,version,stage into new_energy,new_version,new_stage;
 insert into public.world_events(greenhouse_id,version,kind,player_id) values(attempt.greenhouse_id,new_version,case when new_stage>old_stage then 'growth' else 'lesson' end,attempt.player_id);
 if (select count(distinct player_id) from public.energy_ledger where greenhouse_id=attempt.greenhouse_id)>=2 then
 insert into public.greenhouse_quests values(attempt.greenhouse_id,'moonlight-bloom-v1',now()) on conflict do nothing;
 if found then update public.greenhouses set moonlight_bloom=true where id=attempt.greenhouse_id;insert into public.world_events(greenhouse_id,version,kind,player_id) values(attempt.greenhouse_id,new_version,'moonlight-bloom',attempt.player_id);end if;
 end if;rewarded:=true;
 end if;
 update public.lesson_attempts set status=case when rewarded then 'completed' else 'practice' end where id=attempt.id;
 return jsonb_build_object('rewarded',rewarded,'energy',(select energy from public.greenhouses where id=attempt.greenhouse_id),'greenhouse_id',attempt.greenhouse_id);
end $$;
create function public.world_snapshot(p_world uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 if not private.access(p_world,a) then raise exception 'Greenhouse access denied' using errcode='42501';end if;
 return jsonb_build_object('world',(select to_jsonb(w) from public.greenhouses w where w.id=p_world),
 'members',coalesce((select jsonb_agg(to_jsonb(r)) from (
 select a.player_id,a.name,a.avatar,a.version as appearance_version,s.lease_until>now() as online,
 case when s.lease_until>now() then s.activity else 'Offline' end as activity,coalesce(s.x,8.5) as x,coalesce(s.y,8.5) as y,coalesce(s.facing,1) as facing,s.slot,coalesce(s.sequence,0) as sequence
 from public.player_appearances a left join public.room_sessions s on s.player_id=a.player_id and s.greenhouse_id=p_world
 where exists(select 1 from public.greenhouse_memberships m where m.greenhouse_id=p_world and m.player_id=a.player_id) or (s.lease_until>now())
 order by s.slot nulls last,a.player_id) r),'[]'),
 'contributions',coalesce((select jsonb_agg(to_jsonb(r)) from(select l.player_id,a.name,sum(l.amount)::integer as energy from public.energy_ledger l join public.player_appearances a on a.player_id=l.player_id where l.greenhouse_id=p_world group by l.player_id,a.name) r),'[]'));
end $$;
create function public.learning_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 return coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('completed',exists(select 1 from public.lesson_completions c where c.player_id=a and c.canonical_key=l.canonical_key),'questions',(select jsonb_agg(to_jsonb(q) order by q.ordinal) from public.lesson_questions q where q.lesson_id=l.id)) order by l.ordinal) from public.lessons l where l.path_id=p.id),'[]'))) from public.learning_paths p where p.player_id=a),'[]');
end $$;
-- Service-only import of server-validated authored/generated content.
create function public.publish_learning_path(p_player uuid,p_title text,p_topic text,p_difficulty text,p_source text,p_lessons jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare path uuid;lesson uuid;question uuid;l jsonb;q jsonb;li integer:=0;qi integer;begin
 if jsonb_typeof(p_lessons)<>'array' or jsonb_array_length(p_lessons)<>5 then raise exception 'Five lessons are required';end if;
 insert into public.learning_paths(player_id,title,topic,difficulty,source) values(p_player,p_title,p_topic,p_difficulty,p_source) on conflict do nothing returning id into path;
 if path is null then select id into path from public.learning_paths where player_id=p_player and source='authored' and topic=p_topic and version=1;return path;end if;
 for l in select value from jsonb_array_elements(p_lessons) loop
 insert into public.lessons(path_id,canonical_key,title,text,ordinal) values(path,case when p_source='authored' then 'authored-v1:'||p_topic||':'||li else 'generated:'||path::text||':'||li end,l->>'title',l->>'text',li) returning id into lesson;
 if jsonb_array_length(l->'questions') not between 1 and 10 then raise exception 'Invalid question count';end if;qi:=0;
 for q in select value from jsonb_array_elements(l->'questions') loop
 insert into public.lesson_questions(lesson_id,ordinal,kind,prompt,options) values(lesson,qi,q->>'kind',q->>'prompt',case when q->>'kind'='multiple_choice' then q->'options' else null end) returning id into question;
 insert into private.lesson_solutions values(question,q->>'answer',q->>'explanation',q->>'rubric');qi:=qi+1;
 end loop;li:=li+1;end loop;return path;
end $$;
create function public.consume_api_quota(p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();begin
 if p_kind='generation' then perform private.limit_action(a,p_kind,5,86400);
 elsif p_kind='grading' then perform private.limit_action(a,p_kind,30,3600);
 elsif p_kind='request' then perform private.limit_action(a,p_kind,600,60);
 else raise exception 'Unknown quota';end if;
end $$;
create function public.generation_job(p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=private.require_actor();j private.generation_jobs;begin
 if not exists(select 1 from private.generation_jobs where player_id=a and idempotency_key=p_key) then perform private.limit_action(a,'job-create',10,86400);end if;
 insert into private.generation_jobs(player_id,idempotency_key,state) values(a,p_key,'pending') on conflict do nothing;
 select * into j from private.generation_jobs where player_id=a and idempotency_key=p_key;return to_jsonb(j);
end $$;
create function public.finish_generation(p_job uuid,p_path uuid,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin update private.generation_jobs set path_id=p_path,state=case when p_error is null then 'succeeded' else 'failed' end,error_code=p_error,updated_at=now() where id=p_job and state='pending';end $$;

alter table public.learning_paths enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_questions enable row level security;
alter table public.lesson_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.energy_ledger enable row level security;
alter table public.greenhouse_quests enable row level security;
alter table public.world_events enable row level security;
create policy own_paths on public.learning_paths for select to authenticated using(player_id=private.actor());
create policy own_lessons on public.lessons for select to authenticated using(exists(select 1 from public.learning_paths p where p.id=path_id and p.player_id=private.actor()));
create policy own_questions on public.lesson_questions for select to authenticated using(exists(select 1 from public.lessons l join public.learning_paths p on p.id=l.path_id where l.id=lesson_id and p.player_id=private.actor()));
create policy own_attempts on public.lesson_attempts for select to authenticated using(player_id=private.actor());
create policy own_answers on public.attempt_answers for select to authenticated using(exists(select 1 from public.lesson_attempts a where a.id=attempt_id and a.player_id=private.actor()));
create policy own_completions on public.lesson_completions for select to authenticated using(player_id=private.actor());
create policy room_ledger on public.energy_ledger for select to authenticated using(private.viewer_access(greenhouse_id));
create policy room_quests on public.greenhouse_quests for select to authenticated using(private.viewer_access(greenhouse_id));
create policy room_events on public.world_events for select to authenticated using(private.viewer_access(greenhouse_id));
revoke all on public.learning_paths,public.lessons,public.lesson_questions,public.lesson_attempts,public.attempt_answers,public.lesson_completions,public.energy_ledger,public.greenhouse_quests,public.world_events from anon,authenticated;
grant select on public.learning_paths,public.lessons,public.lesson_questions,public.lesson_attempts,public.attempt_answers,public.lesson_completions,public.energy_ledger,public.greenhouse_quests,public.world_events to authenticated;
revoke all on private.lesson_solutions,private.generation_jobs from public,anon,authenticated;
do $grant$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('begin_attempt','submit_multiple_choice','grading_context','record_short_grade','finalize_attempt','world_snapshot','learning_snapshot','publish_learning_path','consume_api_quota','generation_job','finish_generation') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);end loop;
end $grant$;
grant execute on function public.begin_attempt(uuid,uuid,uuid),public.submit_multiple_choice(uuid,uuid,text),public.world_snapshot(uuid),public.learning_snapshot(),public.consume_api_quota(text),public.generation_job(uuid) to authenticated;
grant execute on function public.grading_context(uuid,uuid),public.record_short_grade(uuid,uuid,text,boolean),public.finalize_attempt(uuid),public.publish_learning_path(uuid,text,text,text,text,jsonb),public.finish_generation(uuid,uuid,text) to service_role;
grant select on public.profiles,public.player_appearances,public.greenhouses,public.greenhouse_memberships,public.greenhouse_visits,public.room_sessions,public.learning_paths,public.lessons,public.lesson_questions,public.lesson_attempts,public.attempt_answers,public.lesson_completions,public.energy_ledger,public.greenhouse_quests,public.world_events to service_role;
commit;
