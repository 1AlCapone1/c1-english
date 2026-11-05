-- Enable RLS everywhere
do $$ declare t text; begin
  foreach t in array array['profiles','vocabulary','grammar_lessons','reading_materials','listening_materials','exercises','writing_guides','speaking_tasks','tests','test_questions','achievements','flashcards','flashcard_progress','mistakes','test_attempts','learning_sessions','lesson_progress','writing_submissions','user_achievements']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Profiles: own row read/update (limited columns); admin reads all
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_update on public.profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke update on public.profiles from authenticated, anon;
grant update (display_name, level, daily_goal_min, theme) on public.profiles to authenticated;

-- Content: read for signed-in users (published only for non-admins), write admin only
do $$ declare t text; begin
  foreach t in array array['vocabulary','exercises','writing_guides','speaking_tasks','test_questions','achievements']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', t||'_del', t);
  end loop;
  foreach t in array array['grammar_lessons','reading_materials','listening_materials','tests']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (published or (select public.is_admin()))', t||'_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', t||'_del', t);
  end loop;
end $$;

-- Private user data: owner only (CRUD)
do $$ declare t text; begin
  foreach t in array array['flashcards','flashcard_progress','mistakes','test_attempts','learning_sessions','lesson_progress','writing_submissions']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t||'_own', t);
  end loop;
end $$;
-- Achievements earned: read own; inserted only by security-definer function
create policy user_achievements_read on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));

-- No anonymous access at all
revoke all on all tables in schema public from anon;

-- ========== RPC: stats ==========
create or replace function public.current_streak(p_user uuid default auth.uid()) returns int
language plpgsql stable security invoker set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; n int := 0;
begin
  if not exists (select 1 from public.learning_sessions where user_id = p_user and day = d) then d := d - 1; end if;
  while exists (select 1 from public.learning_sessions where user_id = p_user and day = d) loop n := n + 1; d := d - 1; end loop;
  return n;
end $$;

create or replace function public.my_dashboard() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); res jsonb; today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select jsonb_build_object(
    'streak', public.current_streak(uid),
    'words_learned', (select count(*) from public.flashcard_progress where user_id = uid and correct > 0),
    'words_mastered', (select count(*) from public.flashcard_progress where user_id = uid and box >= 4),
    'words_due', (select count(*) from public.flashcard_progress where user_id = uid and due_at <= now()),
    'vocab_total', (select count(*) from public.vocabulary),
    'lessons_done', (select count(*) from public.lesson_progress where user_id = uid and completed_at is not null),
    'lessons_mastered', (select count(*) from public.lesson_progress where user_id = uid and test_max > 0 and test_score / test_max >= 0.8),
    'lessons_total', (select count(*) from public.grammar_lessons where published),
    'mistakes_open', (select count(*) from public.mistakes where user_id = uid and not mastered),
    'today_minutes', (select coalesce(sum(minutes),0) from public.learning_sessions where user_id = uid and day = today),
    'today_items', (select coalesce(sum(items),0) from public.learning_sessions where user_id = uid and day = today),
    'recent_tests', (select coalesce(jsonb_agg(t order by t.created_at desc),'[]') from (select id, title, kind, score, max_score, created_at from public.test_attempts where user_id = uid order by created_at desc limit 5) t),
    'week', (select coalesce(jsonb_agg(w order by w.day),'[]') from (select day, sum(minutes) as minutes, sum(items) as items, sum(correct) as correct from public.learning_sessions where user_id = uid and day > today - 14 group by day) w)
  ) into res;
  return res;
end $$;

-- ========== RPC: achievements ==========
create or replace function public.check_achievements() returns setof text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s int; w int; l int; t int; m int;
begin
  if uid is null then return; end if;
  s := public.current_streak(uid);
  select count(*) into w from public.flashcard_progress where user_id = uid and correct > 0;
  select count(*) into l from public.lesson_progress where user_id = uid and completed_at is not null;
  select count(*) into t from public.test_attempts where user_id = uid;
  select count(*) into m from public.mistakes where user_id = uid and mastered;
  return query
  insert into public.user_achievements (user_id, achievement_id)
  select uid, a.id from public.achievements a
  where (a.id = 'first_session' and exists (select 1 from public.learning_sessions where user_id = uid))
     or (a.id = 'streak_3' and s >= 3) or (a.id = 'streak_7' and s >= 7) or (a.id = 'streak_30' and s >= 30)
     or (a.id = 'words_50' and w >= 50) or (a.id = 'words_250' and w >= 250) or (a.id = 'words_1000' and w >= 1000)
     or (a.id = 'lesson_1' and l >= 1) or (a.id = 'lessons_10' and l >= 10)
     or (a.id = 'test_1' and t >= 1) or (a.id = 'tests_20' and t >= 20)
     or (a.id = 'perfect_test' and exists (select 1 from public.test_attempts where user_id = uid and score = max_score and max_score >= 10))
     or (a.id = 'mistakes_25' and m >= 25)
     or (a.id = 'exam_done' and exists (select 1 from public.test_attempts where user_id = uid and kind = 'exam'))
  on conflict do nothing
  returning achievement_id;
end $$;

-- ========== RPC: record mistake (upsert by prompt) ==========
create or replace function public.record_mistake(p_category text, p_source text, p_prompt text, p_user_answer text, p_correct text, p_explanation text, p_vocab uuid default null, p_exercise uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare existing uuid;
begin
  select id into existing from public.mistakes where user_id = auth.uid() and prompt = p_prompt and correct_answer = p_correct limit 1;
  if existing is not null then
    update public.mistakes set times = times + 1, mastered = false, user_answer = p_user_answer, last_seen_at = now() where id = existing;
  else
    insert into public.mistakes (category, source, prompt, user_answer, correct_answer, explanation, vocab_id, exercise_id)
    values (p_category, left(p_source,40), p_prompt, p_user_answer, p_correct, p_explanation, p_vocab, p_exercise);
  end if;
end $$;

-- ========== RPC: admin stats ==========
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'active_7d', (select count(distinct user_id) from public.learning_sessions where created_at > now() - interval '7 days'),
    'sessions_7d', (select count(*) from public.learning_sessions where created_at > now() - interval '7 days'),
    'tests_total', (select count(*) from public.test_attempts),
    'avg_test_pct', (select round(avg(score/max_score)*100) from public.test_attempts),
    'content', jsonb_build_object(
      'vocabulary', (select count(*) from public.vocabulary),
      'grammar_lessons', (select count(*) from public.grammar_lessons),
      'exercises', (select count(*) from public.exercises),
      'reading', (select count(*) from public.reading_materials),
      'listening', (select count(*) from public.listening_materials where published),
      'tests', (select count(*) from public.tests)));
end $$;

revoke execute on function public.admin_stats() from anon, public;
revoke execute on function public.check_achievements() from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.admin_stats(), public.check_achievements(), public.my_dashboard(), public.current_streak(uuid), public.record_mistake(text,text,text,text,text,text,uuid,uuid), public.is_admin() to authenticated;

insert into public.achievements (id, name, description, icon, sort) values
 ('first_session','Pierwszy krok','Ukończona pierwsza sesja nauki','flag',1),
 ('streak_3','3 dni z rzędu','Nauka przez 3 kolejne dni','flame',2),
 ('streak_7','Tydzień bez przerwy','Nauka przez 7 kolejnych dni','flame',3),
 ('streak_30','Miesiąc nawyku','Nauka przez 30 kolejnych dni','trophy',4),
 ('words_50','50 słów','50 haseł poprawnie powtórzonych','book',5),
 ('words_250','250 słów','250 haseł poprawnie powtórzonych','book',6),
 ('words_1000','1000 słów','1000 haseł poprawnie powtórzonych','crown',7),
 ('lesson_1','Pierwsza lekcja','Ukończona pierwsza lekcja gramatyki','pen',8),
 ('lessons_10','10 lekcji','Ukończonych 10 lekcji gramatyki','pen',9),
 ('test_1','Pierwszy test','Rozwiązany pierwszy test','check',10),
 ('tests_20','20 testów','Rozwiązanych 20 testów','check',11),
 ('perfect_test','Bezbłędnie','Test z co najmniej 10 pytań bez błędu','star',12),
 ('mistakes_25','Lekcja z błędów','25 błędów oznaczonych jako opanowane','repeat',13),
 ('exam_done','Próba generalna','Ukończony egzamin próbny','medal',14);

-- applied separately after the advisor check
revoke execute on function public.is_admin() from anon, public;
