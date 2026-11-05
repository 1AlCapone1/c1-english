import { useMemo, useState } from "react";
import { deleteMistake, listMistakes, logSession, updateMistake } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { TypedTask, type Outcome } from "../components/Correction";
import { useEnter } from "../lib/keys";
import { Button, Card, Confirm, Empty, ErrorBox, Feedback, Loading, PageHeader, Pill, Progress, inputCls } from "../components/ui";
import type { Mistake } from "../lib/types";

export const MISTAKE_CATS: Record<string, string> = { vocabulary: "Słownictwo", grammar: "Gramatyka", spelling: "Pisownia", articles: "Przedimki", prepositions: "Przyimki", word_order: "Szyk wyrazów", collocations: "Kolokacje", phrasal_verbs: "Phrasal verbs", word_formation: "Word formation" };

export default function Mistakes() {
  const { data, error, loading, reload, setData } = useAsync(listMistakes);
  const [cat, setCat] = useState(""); const [status, setStatus] = useState<"open" | "mastered" | "all">("open"); const [q, setQ] = useState("");
  const [review, setReview] = useState<Mistake[] | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);
  const list = useMemo(() => (data ?? []).filter((m) => (!cat || m.category === cat) && (status === "all" || (status === "open" ? !m.mastered : m.mastered)) && (!q || (m.prompt + " " + m.correct_answer).toLowerCase().includes(q.toLowerCase()))), [data, cat, status, q]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  async function op(fn: () => Promise<void>, patch: (d: Mistake[]) => Mistake[]) { setOpErr(null); try { await fn(); setData(patch(data!)); } catch (e) { setOpErr(e instanceof Error ? e.message : String(e)); } }
  if (review) return <Review items={review} onClose={() => { setReview(null); reload(); }} />;
  const counts: Record<string, number> = {}; data.filter((m) => !m.mastered).forEach((m) => (counts[m.category] = (counts[m.category] ?? 0) + 1));
  return <div className="max-w-4xl">
    <PageHeader eyebrow="Mistake Notebook" title="Twoje błędy" lead="Każdy błąd z fiszek, ćwiczeń, testów i egzaminu trafia tutaj. Powtarzaj je aż do skutku i oznaczaj jako opanowane." actions={<Button disabled={!list.filter((m) => !m.mastered).length} onClick={() => setReview(list.filter((m) => !m.mastered).slice(0, 20))}>Powtórz ({Math.min(20, list.filter((m) => !m.mastered).length)})</Button>} />
    <div className="mb-3 flex flex-wrap gap-2">{Object.entries(MISTAKE_CATS).map(([k, v]) => <button key={k} onClick={() => setCat(cat === k ? "" : k)} className={`rounded-full border px-3 py-1 text-sm ${cat === k ? "bg-ink text-white dark:bg-white dark:text-ink" : "border-black/15 dark:border-white/15"}`}>{v} <span className="opacity-60">{counts[k] ?? 0}</span></button>)}</div>
    <div className="mb-4 flex flex-wrap gap-2"><select className={inputCls + " w-auto"} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status"><option value="open">Do opanowania</option><option value="mastered">Opanowane</option><option value="all">Wszystkie</option></select><input className={inputCls + " max-w-xs"} placeholder="Szukaj…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj" /></div>
    {opErr && <div className="mb-3"><Feedback tone="bad">{opErr}</Feedback></div>}
    {!list.length ? <Empty title={data.length ? "Brak błędów dla tych filtrów" : "Notatnik jest pusty"}>{data.length ? "Zmień filtry." : "Błędy pojawią się tu automatycznie, gdy pomylisz się w fiszkach, ćwiczeniach lub testach."}</Empty> :
      <Card className="p-0"><ul>{list.map((m) => <li key={m.id} className="border-b border-black/5 px-4 py-3 last:border-0 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-2"><Pill tone="accent">{MISTAKE_CATS[m.category]}</Pill><Pill>{m.source}</Pill>{m.times > 1 && <Pill tone="warn">×{m.times}</Pill>}{m.mastered && <Pill tone="ok">opanowany</Pill>}<span className="ml-auto text-xs text-ink-soft">{new Date(m.last_seen_at).toLocaleDateString("pl-PL")}</span></div>
        <div className="mt-1.5 text-sm">{m.prompt}</div>
        <div className="mt-1 text-sm">{m.user_answer ? <><s className="text-red-700 dark:text-red-300">{m.user_answer}</s> → </> : null}<b className="text-emerald-700 dark:text-emerald-300">{m.correct_answer}</b></div>
        {m.explanation && <div className="mt-1 text-sm text-ink-soft">{m.explanation}</div>}
        <div className="mt-2 flex gap-2"><Button size="sm" variant="quiet" onClick={() => setReview([m])}>Powtórz</Button>
          <Button size="sm" variant="ghost" onClick={() => op(() => updateMistake(m.id, { mastered: !m.mastered }), (d) => d.map((x) => (x.id === m.id ? { ...x, mastered: !m.mastered } : x)))}>{m.mastered ? "Oznacz jako nieopanowany" : "Oznacz jako opanowany"}</Button>
          <Confirm label="Usunąć?" onConfirm={() => op(() => deleteMistake(m.id), (d) => d.filter((x) => x.id !== m.id))}><Button size="sm" variant="ghost">Usuń</Button></Confirm></div>
      </li>)}</ul></Card>}
  </div>;
}

function Review({ items, onClose }: { items: Mistake[]; onClose: () => void }) {
  const [i, setI] = useState(0); const [done, setDone] = useState<Outcome | null>(null); const [ok, setOk] = useState(0);
  useEnter(() => { setDone(null); setI((x) => x + 1); }, !!done && i < items.length);
  useEnter(onClose, i >= items.length);
  const [err, setErr] = useState<string | null>(null); const started = useState(Date.now())[0];
  if (i >= items.length) return <Card><h2 className="font-display text-2xl font-bold">{ok} / {items.length} opanowanych za pierwszym razem</h2><div className="mt-3"><Progress value={(ok / items.length) * 100} tone="ok" /></div><p className="mt-2 text-ink-soft">Błędy rozwiązane bez pomyłki oznaczyłem jako opanowane.</p><Button className="mt-4" onClick={onClose}>Wróć do notatnika</Button></Card>;
  const m = items[i];
  return <div className="max-w-2xl"><div className="mb-2 text-sm font-bold uppercase tracking-widest text-ink-soft">Powtórka błędów · {i + 1}/{items.length}</div>
    <Card><TypedTask key={m.id} prompt={m.prompt} answers={[m.correct_answer]} explanation={m.explanation ?? undefined} allowHint onDone={async (o) => {
      setDone(o);
      try { if (o.firstTry) { setOk((x) => x + 1); await updateMistake(m.id, { mastered: true }); } if (i === items.length - 1) await logSession("mistakes", items.length, ok + (o.firstTry ? 1 : 0), (Date.now() - started) / 60000); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    }} /></Card>
    {err && <div className="mt-3"><Feedback tone="warn">{err}</Feedback></div>}
    <div className="mt-3 flex gap-2">{done && <Button onClick={() => { setDone(null); setI(i + 1); }} data-testid="next">Dalej →</Button>}<Button variant="ghost" onClick={onClose}>Zakończ</Button></div></div>;
}
