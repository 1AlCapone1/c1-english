-- Words a user removed from their learning ("Wyrzuć słowo"). They are not offered in flashcards or daily lessons until restored.
create table public.vocab_hidden (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vocab_id uuid not null references public.vocabulary(id) on delete cascade,
  reason text not null default 'known' check (reason in ('known', 'not_useful')),
  created_at timestamptz not null default now(),
  primary key (user_id, vocab_id)
);
alter table public.vocab_hidden enable row level security;
create policy vocab_hidden_own on public.vocab_hidden for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.vocab_hidden from anon;

-- dashboard: removed words are not "due"
create or replace function public.my_dashboard() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); res jsonb; today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select jsonb_build_object(
    'streak', public.current_streak(uid),
    'words_learned', (select count(*) from public.flashcard_progress where user_id = uid and correct > 0),
    'words_mastered', (select count(*) from public.flashcard_progress where user_id = uid and box >= 4),
    'words_due', (select count(*) from public.flashcard_progress fp where fp.user_id = uid and fp.due_at <= now()
                    and not exists (select 1 from public.vocab_hidden h where h.user_id = uid and h.vocab_id = fp.vocab_id)),
    'words_hidden', (select count(*) from public.vocab_hidden where user_id = uid),
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
