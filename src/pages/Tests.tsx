import { useState } from "react";
import { exercisesByIds, listAttempts, listExercises, listMistakes, listReading, listVocab, myProgress, shuffle } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { vocabToExercise } from "../lib/vocabTest";
import { TestRunner } from "../components/TestRunner";
import { Button, Card, ErrorBox, Feedback, Loading, PageHeader, Pill, inputCls } from "../components/ui";
import type { Exercise } from "../lib/types";

const KINDS = [["vocabulary", "Słownictwo"], ["grammar", "Gramatyka"], ["use_of_english", "Use of English"], ["reading", "Reading"], ["translation", "Tłumaczenia"], ["mixed", "Test mieszany"], ["review", "Test powtórkowy (Twoje błędy i powtórki)"]] as const;
type K = (typeof KINDS)[number][0];

async function buildTest(kind: K, n: number | "full"): Promise<{ items: Exercise[]; title: string; intro?: string }> {
  const cap = n === "full" ? 60 : n;
  if (kind === "vocabulary") { const v = shuffle((await listVocab({ limit: 400, offset: Math.floor(Math.random() * 3) * 100 })).rows); return { items: v.slice(0, cap).map((x, i) => vocabToExercise(x, i % 2 ? "plen" : "gap")), title: "Test słownictwa" }; }
  if (kind === "translation") { const ex = await listExercises({ task_type: "translation" }); const v = (await listVocab({ limit: 300 })).rows.filter((x) => x.example_pl); const items = shuffle([...ex, ...v.map((x) => vocabToExercise(x, "sentence"))]); return { items: items.slice(0, cap), title: "Test tłumaczeń" }; }
  if (kind === "grammar") return { items: shuffle(await listExercises({ module: "grammar" })).slice(0, cap), title: "Test gramatyczny" };
  if (kind === "use_of_english") return { items: shuffle(await listExercises({ module: "use_of_english" })).slice(0, cap), title: "Test Use of English" };
  if (kind === "reading") { const texts = await listReading(); if (!texts.length) throw new Error("Brak tekstów."); const t = texts[Math.floor(Math.random() * texts.length)]; const ex = await listExercises({ reading_id: t.id }); return { items: n === "full" ? ex : ex.slice(0, cap), title: `Reading: ${t.title}`, intro: t.body }; }
  if (kind === "review") {
    const m = (await listMistakes()).filter((x) => !x.mastered);
    const exIds = Array.from(new Set(m.map((x) => x.exercise_id).filter(Boolean) as string[]));
    const ex = await exercisesByIds(exIds.slice(0, 200));
    const due = (await myProgress()).filter((p) => new Date(p.due_at).getTime() <= Date.now()).map((p) => p.vocab_id);
    const v = due.length ? (await listVocab({ ids: due.slice(0, 100), limit: 100 })).rows : [];
    const items = shuffle([...ex, ...v.map((x) => vocabToExercise(x, "gap"))]);
    if (!items.length) throw new Error("Nie masz teraz materiału do powtórki – świetnie! Wybierz inny test.");
    return { items: items.slice(0, cap), title: "Test powtórkowy" };
  }
  const [g, u, v] = await Promise.all([listExercises({ module: "grammar" }), listExercises({ module: "use_of_english" }), listVocab({ limit: 300 })]);
  return { items: shuffle([...shuffle(g).slice(0, cap), ...shuffle(u).slice(0, cap), ...shuffle(v.rows).slice(0, cap).map((x) => vocabToExercise(x, "gap"))]).slice(0, cap), title: "Test mieszany" };
}

export default function Tests() {
  const [kind, setKind] = useState<K>("mixed"); const [n, setN] = useState<number | "full">(20); const [timed, setTimed] = useState(false);
  const [run, setRun] = useState<{ items: Exercise[]; title: string; intro?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const hist = useAsync(() => listAttempts(30));
  async function start() { setErr(null); setBusy(true); try { const t = await buildTest(kind, n); if (!t.items.length) throw new Error("Brak pytań dla tego testu."); setRun(t); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  if (run) return <div><Button variant="ghost" size="sm" onClick={() => { setRun(null); hist.reload(); }}>← Wróć do testów</Button><PageHeader title={run.title} />
    <TestRunner title={run.title} kind={kind} items={run.items} timeLimitSec={timed ? run.items.length * 60 : null} intro={run.intro ? <Card><article className="prose-c1 max-w-[70ch] leading-relaxed">{run.intro.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</article></Card> : undefined} onContinue={() => { setRun(null); hist.reload(); }} continueLabel="Wróć do testów" /></div>;
  return <div className="max-w-4xl">
    <PageHeader eyebrow="System testów" title="Testy" lead="Automatyczne sprawdzanie, wynik procentowy, lista błędów z wyjaśnieniami i zapis w historii. Błędy trafiają do Mistake Notebook." />
    <Card><div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-bold">Rodzaj testu<select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as K)}>{KINDS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Długość<select className={inputCls} value={String(n)} onChange={(e) => setN(e.target.value === "full" ? "full" : Number(e.target.value))}><option value="10">10 pytań</option><option value="20">20 pytań</option><option value="30">30 pytań</option><option value="full">Pełny test</option></select></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Limit czasu (1 min / pytanie)</label>
    </div>{err && <div className="mt-3"><Feedback tone="warn">{err}</Feedback></div>}<div className="mt-4"><Button onClick={start} disabled={busy} data-testid="start-test">{busy ? "Przygotowuję…" : "Rozpocznij test"}</Button></div></Card>
    <h2 className="mt-8 font-display text-xl font-bold">Historia testów</h2>
    {hist.loading ? <Loading /> : hist.error ? <ErrorBox error={hist.error} /> : !hist.data?.length ? <p className="mt-2 text-ink-soft">Brak wyników – rozwiąż pierwszy test.</p> :
      <Card className="mt-3 overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-ink-soft"><th className="p-3">Data</th><th className="p-3">Test</th><th className="p-3">Wynik</th></tr></thead><tbody>{hist.data.map((a) => <tr key={a.id} className="border-t border-black/5 dark:border-white/5"><td className="p-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}</td><td className="p-3">{a.title}</td><td className="p-3"><Pill tone={a.score / a.max_score >= 0.7 ? "ok" : "warn"}>{a.score}/{a.max_score} · {Math.round((a.score / a.max_score) * 100)}%</Pill></td></tr>)}</tbody></table></Card>}
  </div>;
}
