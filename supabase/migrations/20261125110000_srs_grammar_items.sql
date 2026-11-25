-- Grammar exercises join the same spaced-repetition schedule as vocabulary.
create table public.exercise_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  box int not null default 0 check (box between 0 and 8),
  correct int not null default 0 check (correct >= 0),
  wrong int not null default 0 check (wrong >= 0),
  ease numeric(4,2) not null default 2.5 check (ease between 1.3 and 3.5),
  interval_days numeric(7,2) not null default 0 check (interval_days between 0 and 400),
  reps int not null default 0 check (reps >= 0),
  lapses int not null default 0 check (lapses >= 0),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index exercise_progress_due_idx on public.exercise_progress (user_id, due_at);
alter table public.exercise_progress enable row level security;
create policy exercise_progress_own on public.exercise_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.exercise_progress from anon;

-- the review log covers both kinds of items
alter table public.srs_reviews alter column vocab_id drop not null;
alter table public.srs_reviews add column exercise_id uuid references public.exercises(id) on delete cascade;
alter table public.srs_reviews add constraint srs_reviews_item check ((vocab_id is null) <> (exercise_id is null));
alter table public.srs_reviews add column correct boolean;
