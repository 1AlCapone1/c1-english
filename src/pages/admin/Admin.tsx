import { useState } from "react";
import { supabase, unwrap } from "../../lib/supabase";
import { useAsync } from "../../lib/useAsync";
import { Button, Card, Confirm, ErrorBox, Feedback, Loading, PageHeader, Stat, cx, inputCls } from "../../components/ui";
import { validateRecord, type TableName } from "./validate";

type Tab = "stats" | TableName;
const TABS: [Tab, string][] = [["stats", "Statystyki"], ["vocabulary", "Słownictwo"], ["grammar_lessons", "Lekcje"], ["exercises", "Ćwiczenia"], ["reading_materials", "Teksty Reading"], ["listening_materials", "Listening"], ["writing_guides", "Writing"], ["speaking_tasks", "Speaking"], ["tests", "Testy"]];
const LIST_COLS: Record<TableName, string[]> = {
  vocabulary: ["term", "kind", "category", "level"], grammar_lessons: ["position", "title", "area", "published"], exercises: ["module", "task_type", "topic", "instruction"],
  reading_materials: ["title", "topic", "word_count"], listening_materials: ["title", "published", "audio_path"], writing_guides: ["type", "title"], speaking_tasks: ["type", "title"], tests: ["title", "kind", "published"],
};
const SEARCH_COL: Record<TableName, string> = { vocabulary: "term", grammar_lessons: "title", exercises: "instruction", reading_materials: "title", listening_materials: "title", writing_guides: "title", speaking_tasks: "title", tests: "title" };
const TEMPLATES: Record<TableName, object> = {
  vocabulary: { term: "", kind: "word", category: "academic", pos: "adjective", ipa: "", level: "C1", translation_pl: "", definition: "", example: "Sentence with the *term* marked.", example_pl: "", collocations: [], synonyms: [], antonyms: [], register: "neutral", usage_note: "" },
  grammar_lessons: { slug: "new-lesson", area: "Advanced tenses", title: "", position: 100, published: false, content: { explanation: "", usage: "", structure: { scheme: "", word_order: "", affirmative: [], negative: [], questions: [] }, examples: [{ en: "", pl: "", why: "" }], comparison: [{ vs: "", difference: "", when: "" }], mistakes: [{ wrong: "", right: "", why: "" }], exceptions: [], advanced: [] } },
  exercises: { module: "use_of_english", task_type: "open_cloze", grammar_lesson_id: null, reading_id: null, listening_id: null, topic: "", level: "C1", instruction: "Write ONE word in the gap.", prompt: { question: "She is good ___ maths." }, answers: ["at"], explanation: "", distractor_notes: null, position: 0 },
  reading_materials: { title: "", topic: "science", level: "C1", body: "", glossary: [{ term: "", pl: "" }], word_count: 0, published: true },
  listening_materials: { title: "", topic: "", transcript: "", audio_path: null, glossary: [], published: false },
  writing_guides: { type: "essay", title: "", content: { requirements: "", structure: [], phrases: [], sample: { task: "", text: "" }, criteria: [], tasks: [] } },
  speaking_tasks: { type: "opinion", title: "", prompt: "", model_answer: "", phrases: [] },
  tests: { title: "", kind: "mixed", description: "", time_limit_sec: null, published: true },
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>("stats");
  return <div>
    <PageHeader eyebrow="Administrator" title="Panel administratora" lead="Zmiany zapisują się w bazie. Uprawnienia sprawdza baza danych – zwykły użytkownik nie może zapisać zmian, nawet znając adres tej strony." />
    <div className="mb-4 flex flex-wrap gap-1.5">{TABS.map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={cx("rounded-full border px-3 py-1.5 text-sm", tab === k ? "bg-ink font-bold text-white dark:bg-white dark:text-ink" : "border-black/15 dark:border-white/15")}>{n}</button>)}</div>
    {tab === "stats" ? <Stats /> : <TableEditor key={tab} table={tab} />}
  </div>;
}

function Stats() {
  const { data, error, loading, reload } = useAsync(async () => unwrap(await supabase.rpc("admin_stats")) as { users: number; active_7d: number; sessions_7d: number; tests_total: number; avg_test_pct: number | null; content: Record<string, number> });
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  return <div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Użytkownicy" value={data.users} /><Stat label="Aktywni (7 dni)" value={data.active_7d} sub={`${data.sessions_7d} sesji`} /><Stat label="Testy rozwiązane" value={data.tests_total} sub={data.avg_test_pct !== null ? `średnio ${data.avg_test_pct}%` : ""} /><Stat label="Ćwiczenia w bazie" value={data.content.exercises} /></div>
    <Card className="mt-4"><h2 className="font-display text-lg font-bold">Zawartość bazy</h2><ul className="mt-2 grid gap-1 sm:grid-cols-3">{Object.entries(data.content).map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><b>{v}</b></li>)}</ul></Card></div>;
}

function TableEditor({ table }: { table: TableName }) {
  const [q, setQ] = useState(""); const [applied, setApplied] = useState(""); const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<{ id?: string; json: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; t: string } | null>(null);
  const cols = LIST_COLS[table];
  const list = useAsync(async () => {
    let query = supabase.from(table).select("*", { count: "exact" }).order("created_at", { ascending: false }).range(page * 25, page * 25 + 24);
    if (applied) query = query.ilike(SEARCH_COL[table], `%${applied}%`);
    const r = await query; if (r.error) throw new Error(r.error.message);
    return { rows: (r.data ?? []) as Record<string, unknown>[], count: r.count ?? 0 };
  }, [table, applied, page]);
  async function save() {
    setMsg(null);
    let rec: Record<string, unknown>;
    try { rec = JSON.parse(edit!.json); } catch { return setMsg({ tone: "bad", t: "Niepoprawny JSON." }); }
    const problems = validateRecord(table, rec);
    if (problems.length) return setMsg({ tone: "bad", t: problems.join(" ") });
    delete rec.id; delete rec.created_at;
    if (table === "reading_materials") rec.word_count = String(rec.body ?? "").trim().split(/\s+/).length;
    if (table === "grammar_lessons") rec.updated_at = new Date().toISOString();
    const res = edit!.id ? await supabase.from(table).update(rec).eq("id", edit!.id).select() : await supabase.from(table).insert(rec).select();
    if (res.error) return setMsg({ tone: "bad", t: res.error.message });
    if (!res.data?.length) return setMsg({ tone: "bad", t: "Zapis odrzucony – brak uprawnień administratora." });
    setMsg({ tone: "ok", t: "Zapisano." }); setEdit(null); list.reload();
  }
  async function remove(id: string) {
    const res = await supabase.from(table).delete().eq("id", id).select();
    if (res.error) setMsg({ tone: "bad", t: res.error.message }); else { setMsg({ tone: "ok", t: "Usunięto." }); list.reload(); }
  }
  return <div className="flex flex-col gap-4">
    {msg && <Feedback tone={msg.tone}>{msg.t}</Feedback>}
    {edit ? <Card><h2 className="font-display text-lg font-bold">{edit.id ? "Edycja rekordu" : "Nowy rekord"}</h2>
      <p className="mt-1 text-sm text-ink-soft">Edytuj dane w formacie JSON. Przed zapisem sprawdzam wymagane pola, odpowiedzi i duplikaty; baza dodatkowo pilnuje ograniczeń.</p>
      <textarea className={inputCls + " mt-3 min-h-[420px] font-mono text-sm"} value={edit.json} onChange={(e) => setEdit({ ...edit, json: e.target.value })} spellCheck={false} aria-label="JSON" />
      <div className="mt-3 flex gap-2"><Button onClick={save}>Zapisz</Button><Button variant="quiet" onClick={() => setEdit(null)}>Anuluj</Button></div></Card>
      : <div className="flex flex-wrap gap-2"><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(q.trim()); }}><input className={inputCls + " max-w-xs"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj…" aria-label="Szukaj" /><Button type="submit" variant="quiet">Szukaj</Button></form><Button onClick={() => setEdit({ json: JSON.stringify(TEMPLATES[table], null, 2) })}>+ Dodaj</Button></div>}
    {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> :
      <Card className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-ink-soft">{cols.map((c) => <th key={c} className="p-3">{c}</th>)}<th className="p-3" /></tr></thead>
        <tbody>{list.data!.rows.map((r) => <tr key={String(r.id)} className="border-t border-black/5 dark:border-white/5">{cols.map((c) => <td key={c} className="max-w-xs truncate p-3">{String(r[c] ?? "")}</td>)}
          <td className="whitespace-nowrap p-3"><Button size="sm" variant="quiet" onClick={() => { const { id, created_at, ...rest } = r; void created_at; setEdit({ id: String(id), json: JSON.stringify(rest, null, 2) }); window.scrollTo(0, 0); }}>Edytuj</Button> <Confirm label="Usunąć?" onConfirm={() => remove(String(r.id))}><Button size="sm" variant="ghost">Usuń</Button></Confirm></td></tr>)}</tbody></table>
        <div className="flex items-center gap-3 p-3 text-sm"><Button size="sm" variant="quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>←</Button><span>{page * 25 + 1}–{Math.min((page + 1) * 25, list.data!.count)} z {list.data!.count}</span><Button size="sm" variant="quiet" disabled={(page + 1) * 25 >= list.data!.count} onClick={() => setPage(page + 1)}>→</Button></div></Card>}
  </div>;
}
