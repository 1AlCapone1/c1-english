-- Spaced repetition (SM-2 style): ease factor, interval, repetitions, lapses + a review log.
alter table public.flashcard_progress
  add column ease numeric(4,2) not null default 2.5 check (ease between 1.3 and 3.5),
  add column interval_days numeric(7,2) not null default 0 check (interval_days between 0 and 400),
  add column reps int not null default 0 check (reps >= 0),
  add column lapses int not null default 0 check (lapses >= 0);

-- carry over existing Leitner progress
update public.flashcard_progress set
  interval_days = (array[0,1,2,4,8,16,32,64,120])[box + 1],
  reps = least(correct, box),
  lapses = wrong;

create table public.srs_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vocab_id uuid not null references public.vocabulary(id) on delete cascade,
  grade text not null check (grade in ('again', 'hard', 'good', 'easy')),
  interval_before numeric(7,2) not null default 0,
  interval_after numeric(7,2) not null default 0,
  source text check (char_length(source) <= 40),
  reviewed_at timestamptz not null default now()
);
create index srs_reviews_user_idx on public.srs_reviews (user_id, reviewed_at desc);
alter table public.srs_reviews enable row level security;
create policy srs_reviews_own on public.srs_reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.srs_reviews from anon;

-- daily limit of new cards (user setting)
alter table public.profiles add column srs_new_per_day int not null default 10 check (srs_new_per_day between 0 and 100);
grant update (srs_new_per_day) on public.profiles to authenticated;
