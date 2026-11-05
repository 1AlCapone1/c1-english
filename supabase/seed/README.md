# Loading content

Content lives in `content/seed/*.json` and is validated in CI (`scripts/validate-content.ts`).
The database function `private.seed_load(kind, jsonb)` (migration `seed_loader`) upserts it. It can't be called from the API.

From the Supabase SQL editor (the repository is public):

```sql
select net.http_get('https://raw.githubusercontent.com/<owner>/<repo>/main/content/seed/vocabulary.json');
-- wait a second, then:
select private.seed_load('vocabulary', (select content::jsonb from net._http_response order by id desc limit 1));
```

Load order: `vocabulary`, `grammar_lessons`, `reading_materials`, then `exercises` (exercise files link to lessons with `lesson_slug` and to texts with `reading_title`), `writing_guides`, `speaking_tasks`.
