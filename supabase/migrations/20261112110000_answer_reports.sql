-- "Dobrze jest napisane – zalicz": answers a user accepted as correct although the checker did not.
-- Users can add and read their own; admins see all to add missing variants to the content.
create table public.answer_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  vocab_id uuid references public.vocabulary(id) on delete set null,
  source text not null check (char_length(source) <= 40),
  prompt text not null check (char_length(prompt) <= 2000),
  user_answer text not null check (char_length(user_answer) between 1 and 500),
  expected text not null check (char_length(expected) <= 500),
  status text not null default 'new' check (status in ('new', 'added', 'rejected')),
  created_at timestamptz not null default now()
);
create index answer_reports_status_idx on public.answer_reports (status, created_at desc);
alter table public.answer_reports enable row level security;
create policy answer_reports_insert on public.answer_reports for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new');
create policy answer_reports_select on public.answer_reports for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy answer_reports_admin_update on public.answer_reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy answer_reports_admin_delete on public.answer_reports for delete to authenticated using ((select public.is_admin()));
revoke all on public.answer_reports from anon;

-- a learner can withdraw their own report while it is still new
create policy answer_reports_delete_own on public.answer_reports for delete to authenticated using (user_id = (select auth.uid()) and status = 'new');
