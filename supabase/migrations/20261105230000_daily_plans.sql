-- One plan per user per day: the words and grammar lesson of the day and the progress of the four stages.
create table public.daily_plans (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'Europe/Warsaw')::date,
  vocab_ids uuid[] not null default '{}',
  lesson_id uuid references public.grammar_lessons(id) on delete set null,
  stages jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint daily_plans_vocab_limit check (cardinality(vocab_ids) <= 30)
);
alter table public.daily_plans enable row level security;
create policy daily_plans_own on public.daily_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.daily_plans from anon;
