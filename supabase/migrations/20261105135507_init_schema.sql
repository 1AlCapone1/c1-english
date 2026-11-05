-- ========== PROFILES & ROLES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  role text not null default 'user' check (role in ('user','admin')),
  level text not null default 'B2' check (level in ('B2','C1','C2')),
  daily_goal_min int not null default 20 check (daily_goal_min between 5 and 120),
  theme text not null default 'system' check (theme in ('system','light','dark')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data->>'display_name', 60), split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== CONTENT (shared, admin-managed) ==========
create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(term) between 1 and 120),
  kind text not null check (kind in ('word','phrasal_verb','idiom','collocation','fixed_expression','linking','word_formation','confused')),
  category text not null,
  pos text,
  ipa text,
  level text not null default 'C1' check (level in ('B2','C1','C2')),
  translation_pl text not null check (char_length(translation_pl) > 0),
  definition text,
  example text not null check (position('*' in example) > 0),
  example_pl text,
  collocations text[] not null default '{}',
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  register text not null default 'neutral' check (register in ('neutral','formal','informal','academic')),
  usage_note text,
  created_at timestamptz not null default now()
);
create unique index vocabulary_term_kind_uq on public.vocabulary (lower(term), kind);
create index vocabulary_category_idx on public.vocabulary (kind, category, level);

create table public.grammar_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  area text not null,
  title text not null,
  position int not null default 0,
  content jsonb not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grammar_content_complete check (
    content ? 'explanation' and content ? 'usage' and content ? 'structure' and content ? 'examples'
    and content ? 'comparison' and content ? 'mistakes' and content ? 'exceptions')
);
create index grammar_lessons_pos_idx on public.grammar_lessons (area, position);

create table public.reading_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null,
  level text not null default 'C1' check (level in ('B2','C1','C2')),
  body text not null check (char_length(body) > 400),
  glossary jsonb not null default '[]',
  word_count int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.listening_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null,
  transcript text not null,
  audio_path text,
  glossary jsonb not null default '[]',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint listening_needs_audio check (published = false or audio_path is not null)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('grammar','use_of_english','vocabulary','reading','listening','translation')),
  task_type text not null check (task_type in ('mc','gap','open_cloze','mc_cloze','word_formation','kwt','error','translation','matching','tfng')),
  grammar_lesson_id uuid references public.grammar_lessons(id) on delete cascade,
  reading_id uuid references public.reading_materials(id) on delete cascade,
  listening_id uuid references public.listening_materials(id) on delete cascade,
  topic text,
  level text not null default 'C1' check (level in ('B2','C1','C2')),
  instruction text not null,
  prompt jsonb not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) > 0),
  explanation text not null check (char_length(explanation) > 0),
  distractor_notes jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index exercises_module_idx on public.exercises (module, task_type, level);
create index exercises_lesson_idx on public.exercises (grammar_lesson_id);
create index exercises_reading_idx on public.exercises (reading_id);
create index exercises_listening_idx on public.exercises (listening_id);

create table public.writing_guides (
  id uuid primary key default gen_random_uuid(),
  type text not null unique check (type in ('essay','report','proposal','review','letter')),
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table public.speaking_tasks (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('questions','photo','compare','opinion','argue','speculate','discussion','respond')),
  title text not null,
  prompt text not null,
  model_answer text not null,
  phrases jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('vocabulary','grammar','use_of_english','reading','listening','translation','mixed','review','exam')),
  description text,
  time_limit_sec int check (time_limit_sec is null or time_limit_sec > 0),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.test_questions (
  test_id uuid not null references public.tests(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position int not null default 0,
  primary key (test_id, exercise_id)
);

create table public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default 'star',
  sort int not null default 0
);

-- ========== USER DATA (private) ==========
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vocab_id uuid references public.vocabulary(id) on delete cascade,
  front text,
  back text,
  created_at timestamptz not null default now(),
  constraint flashcard_has_content check (vocab_id is not null or (front is not null and back is not null))
);
create unique index flashcards_user_vocab_uq on public.flashcards (user_id, vocab_id) where vocab_id is not null;

create table public.flashcard_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vocab_id uuid not null references public.vocabulary(id) on delete cascade,
  box int not null default 0 check (box between 0 and 8),
  due_at timestamptz not null default now(),
  correct int not null default 0,
  wrong int not null default 0,
  last_attempts int not null default 1,
  last_mode text,
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, vocab_id)
);
create index flashcard_progress_due_idx on public.flashcard_progress (user_id, due_at);

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('vocabulary','grammar','spelling','articles','prepositions','word_order','collocations','phrasal_verbs','word_formation')),
  source text not null check (char_length(source) <= 40),
  prompt text not null,
  user_answer text,
  correct_answer text not null,
  explanation text,
  vocab_id uuid references public.vocabulary(id) on delete set null,
  exercise_id uuid references public.exercises(id) on delete set null,
  times int not null default 1 check (times > 0),
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index mistakes_user_idx on public.mistakes (user_id, mastered, category);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  test_id uuid references public.tests(id) on delete set null,
  kind text not null,
  title text not null,
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0 and score <= max_score),
  duration_sec int,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index test_attempts_user_idx on public.test_attempts (user_id, created_at desc);

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  items int not null default 0 check (items >= 0),
  correct int not null default 0 check (correct >= 0 and correct <= items),
  minutes numeric not null default 0 check (minutes >= 0 and minutes <= 240),
  created_at timestamptz not null default now(),
  day date not null default (now() at time zone 'Europe/Warsaw')::date
);
create index learning_sessions_user_day_idx on public.learning_sessions (user_id, day);

create table public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.grammar_lessons(id) on delete cascade,
  completed_at timestamptz,
  test_score numeric,
  test_max numeric,
  primary key (user_id, lesson_id)
);

create table public.writing_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('essay','report','proposal','review','letter')),
  task text not null,
  body text not null default '' check (char_length(body) <= 20000),
  word_count int not null default 0,
  self_assessment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
