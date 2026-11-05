create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Loads validated seed JSON (content/seed/*.json in the repo) into content tables. Idempotent.
create or replace function private.seed_load(p_kind text, p_data jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; r jsonb; lid uuid; rid uuid;
begin
  if p_kind = 'vocabulary' then
    insert into public.vocabulary (term, kind, category, pos, ipa, level, translation_pl, definition, example, example_pl, collocations, synonyms, antonyms, register, usage_note)
    select x.term, x.kind, x.category, x.pos, x.ipa, x.level, x.translation_pl, x.definition, x.example, x.example_pl,
           coalesce(array(select jsonb_array_elements_text(e->'collocations')), '{}'), coalesce(array(select jsonb_array_elements_text(e->'synonyms')), '{}'),
           coalesce(array(select jsonb_array_elements_text(e->'antonyms')), '{}'), x.register, x.usage_note
    from jsonb_array_elements(p_data) e, jsonb_to_record(e) as x(term text, kind text, category text, pos text, ipa text, level text, translation_pl text, definition text, example text, example_pl text, register text, usage_note text)
    on conflict (lower(term), kind) do update set category = excluded.category, pos = excluded.pos, ipa = excluded.ipa, level = excluded.level, translation_pl = excluded.translation_pl,
      definition = excluded.definition, example = excluded.example, example_pl = excluded.example_pl, collocations = excluded.collocations, synonyms = excluded.synonyms,
      antonyms = excluded.antonyms, register = excluded.register, usage_note = excluded.usage_note;
    get diagnostics n = row_count;
  elsif p_kind = 'grammar_lessons' then
    insert into public.grammar_lessons (slug, area, title, position, content, published)
    select e->>'slug', e->>'area', e->>'title', (e->>'position')::int, e->'content', coalesce((e->>'published')::boolean, true) from jsonb_array_elements(p_data) e
    on conflict (slug) do update set area = excluded.area, title = excluded.title, position = excluded.position, content = excluded.content, published = excluded.published, updated_at = now();
    get diagnostics n = row_count;
  elsif p_kind = 'reading_materials' then
    for r in select * from jsonb_array_elements(p_data) loop
      update public.reading_materials set topic = r->>'topic', level = r->>'level', body = r->>'body', glossary = r->'glossary', word_count = array_length(regexp_split_to_array(trim(r->>'body'), '\s+'), 1), published = true
        where title = r->>'title' returning id into rid;
      if rid is null then
        insert into public.reading_materials (title, topic, level, body, glossary, word_count) values (r->>'title', r->>'topic', r->>'level', r->>'body', r->'glossary', array_length(regexp_split_to_array(trim(r->>'body'), '\s+'), 1));
      end if;
      rid := null; n := n + 1;
    end loop;
  elsif p_kind = 'writing_guides' then
    insert into public.writing_guides (type, title, content) select e->>'type', e->>'title', e->'content' from jsonb_array_elements(p_data) e
    on conflict (type) do update set title = excluded.title, content = excluded.content;
    get diagnostics n = row_count;
  elsif p_kind = 'speaking_tasks' then
    delete from public.speaking_tasks s where s.title in (select e->>'title' from jsonb_array_elements(p_data) e);
    insert into public.speaking_tasks (type, title, prompt, model_answer, phrases) select e->>'type', e->>'title', e->>'prompt', e->>'model_answer', coalesce(e->'phrases','[]') from jsonb_array_elements(p_data) e;
    get diagnostics n = row_count;
  elsif p_kind = 'exercises' then
    -- replace all exercises belonging to the lessons / texts / topics present in this file
    delete from public.exercises x using public.grammar_lessons g where x.grammar_lesson_id = g.id and g.slug in (select e->>'lesson_slug' from jsonb_array_elements(p_data) e where e ? 'lesson_slug');
    delete from public.exercises x using public.reading_materials m where x.reading_id = m.id and m.title in (select e->>'reading_title' from jsonb_array_elements(p_data) e where e ? 'reading_title');
    delete from public.exercises x where x.grammar_lesson_id is null and x.reading_id is null and x.listening_id is null
      and (x.module, coalesce(x.topic,'')) in (select e->>'module', coalesce(e->>'topic','') from jsonb_array_elements(p_data) e where not (e ? 'lesson_slug') and not (e ? 'reading_title'));
    insert into public.exercises (module, task_type, grammar_lesson_id, reading_id, topic, level, instruction, prompt, answers, explanation, distractor_notes, position)
    select e->>'module', e->>'task_type', (select id from public.grammar_lessons where slug = e->>'lesson_slug'), (select id from public.reading_materials where title = e->>'reading_title' limit 1),
           e->>'topic', coalesce(e->>'level','C1'), e->>'instruction', e->'prompt', e->'answers', e->>'explanation', nullif(e->'distractor_notes', 'null'::jsonb), coalesce((e->>'position')::int, 0)
    from jsonb_array_elements(p_data) e;
    get diagnostics n = row_count;
  else
    raise exception 'unknown seed kind %', p_kind;
  end if;
  return n;
end $$;
revoke execute on function private.seed_load(text, jsonb) from public, anon, authenticated;
