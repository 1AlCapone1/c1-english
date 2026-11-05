# C1 English Academy

A web app for preparing for the Cambridge **C1 Advanced** exam (CAE), for Polish speakers. Every user has their own account, progress, flashcards, mistake notebook and test history, all stored in a database (Supabase/Postgres) and protected by Row Level Security.

> The materials are original. They do not reproduce Cambridge tasks. The exam simulator follows the format of the exam, but the results are estimates, not official scores.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS, HashRouter (works on GitHub Pages) |
| Backend | Supabase: Auth (email + password, password reset), Postgres with RLS, RPC functions |
| Hosting | GitHub Pages, built and deployed by GitHub Actions |
| Tests | Vitest (unit), Playwright (e2e: login, correction loop, tests, RLS, mobile layout), content validation |

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                   # http://localhost:5173
npm test                      # unit tests
npm run validate:content      # validate content/seed/*.json
npm run build && npm run preview
npx playwright test           # e2e (requires E2E_* variables, see .env.example)
```

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` / GitHub → Variables | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | as above | publishable key (`sb_publishable_…`). It is meant for the browser; data is protected by RLS |
| `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_USER2_*` | GitHub → Secrets | two test accounts for the e2e tests |

No other secrets are needed and **none are kept in the code**. Never put the `service_role` key in the frontend.

## Database

The migrations live in `supabase/migrations/` (in order):

1. `init_schema` – tables for content and user data
2. `rls_and_functions` – RLS on every table, the RPC functions `my_dashboard`, `current_streak`, `check_achievements`, `record_mistake`, `admin_stats`, and the achievements
3. `enable_pg_net_for_seeding`, `seed_loader` – the `private.seed_load()` function used to load content

On a new Supabase project, run them in order in the SQL Editor (or use `supabase db push`).

Security in short:
- users can read and write **only their own rows** (`user_id = auth.uid()`);
- content can be changed only by an admin (`is_admin()` checked in the RLS policies);
- the `role` column in `profiles` is not editable by the user (column-level grants);
- the anonymous role has no access to any table.

## Creating an administrator

1. Register normally in the app.
2. In the Supabase SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'twoj@email.pl');
   ```
3. Log in again. The **Panel administratora** appears in the menu.

## Content: adding and editing

- **From the app:** Panel administratora → pick a table → *Dodaj* / *Edytuj*. Records are validated before saving (required fields, answer key among the options, gaps marked `___`, the keyword present in transformations, and so on).
- **In bulk:** edit the source files in `content/` (vocabulary: `content/vocab_*.txt`; lessons: `content/grammar/l*.py`; exercises: `content/uoe/*.py`; texts: `content/reading/`). Then:
  ```bash
  ./scripts/build-content.sh          # generates content/seed/*.json
  npm run validate:content            # same rules as the admin panel
  ```
  After pushing to GitHub, load the data as described in `supabase/seed/README.md`.

Current content counts are always visible in the admin panel (Statystyki), and the dashboard shows them to users. The app does not show invented numbers.

## Listening

The Listening module **shows only recordings that have an audio file** (the database blocks publishing material without `audio_path`). To add audio, upload the file to Supabase Storage (bucket `audio`, public for reading; only an admin can upload). Then add a `listening_materials` record with `audio_path` and a transcript in the admin panel, plus questions in `exercises` (`module = listening`, `listening_id`).

## Deployment (GitHub Pages)

The `.github/workflows/deploy.yml` workflow runs on every push to `main`:
typecheck → unit tests → content validation → build → e2e (when the secrets are set) → deploy to Pages → check that the public address responds.

One-time setup in the repository:
1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions**: the variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, plus optional E2E secrets.
3. In Supabase: **Authentication → URL Configuration** → Site URL = `https://<login>.github.io/<repo>/`, and add the same address to Redirect URLs (needed for confirmation and password-reset links).

## Email (registration confirmation, password reset)

Supabase's built-in email server sends only a few messages per hour and is intended for testing. Before making the app available to other people, set up your own SMTP in **Authentication → Emails → SMTP Settings**. For example, Resend has a free tier of 3,000 emails per month and needs a verified domain. Alternatively, you can turn off email confirmation (Authentication → Providers → Email → *Confirm email*). Users can then log in right after registering, but password reset still needs email.

## Costs and limits

| Service | Plan | Limits worth knowing |
|---|---|---|
| GitHub Pages | free (public repository) | 1 GB per site, 100 GB transfer per month |
| GitHub Actions | free for public repositories | — |
| Supabase | Free | 500 MB database, 1 GB storage, 50,000 monthly active users; **the project is paused after 7 days without activity** (resumed from the dashboard). For continuous production use: the Pro plan (about $25/month) |
| SMTP (e.g. Resend) | free tier | about 3,000 emails per month |

## Project structure

```
src/
  lib/          answer checking (answer.ts), SRS (srs.ts), API, content validation, auth
  components/   correction loop (Correction.tsx), practice sessions, test runner, UI
  pages/        modules: Dashboard, Vocabulary, Flashcards, Grammar, Use of English, Reading,
                Listening, Writing, Speaking, Tests, Exam, Mistakes, Progress, Settings, Admin
content/        content sources + seed/*.json (generated)
supabase/       migrations and content loading instructions
e2e/            Playwright tests
scripts/        content validation and build
```
