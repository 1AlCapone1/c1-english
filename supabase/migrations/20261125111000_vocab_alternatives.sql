-- Accepted alternative answers (added by the admin from learners' reports), so a correct answer
-- that differs from the single stored version is not marked wrong.
alter table public.vocabulary
  add column alternatives text[] not null default '{}',          -- other correct English renderings of the term
  add column sentence_alternatives text[] not null default '{}'; -- other correct translations of example_pl
