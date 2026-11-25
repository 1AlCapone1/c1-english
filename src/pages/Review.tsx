import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { logSession, recordMistake, reportAcceptedAnswer, reviewCard, reviewExercise, srsCard, srsExercise, srsOverview, srsQueue, unhideWord, updateProfile } from "../lib/api";
import { canon, levenshtein, mistakeCategory } from "../lib/answer";
import { formatInterval, type Grade, type SrsCard } from "../lib/srs";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../lib/auth";
import { useEnter } from "../lib/keys";
import type { Exercise, Vocab } from "../lib/types";
import { KIND_LABEL } from "../lib/types";
import { TypedTask, withGap, type Outcome } from "../components/Correction";
import { RemovedNotice, SkipBar } from "../components/SkipBar";
import { WordPreview } from "../components/WordPreview";
import { BarChart, Button, Card, ErrorBox, Feedback, Loading, PageHeader, Pill, Progress, Stat, inputCls } from "../components/ui";
import { RatingBar } from "./Flashcards";
import { VocabDetail } from "./Vocabulary";

/**
 * Powtórki (SRS) – active recall + spaced repetition.
 * Every item (a word/phrase or a grammar exercise) has ONE schedule. Each review asks you to WRITE the answer
 * from memory, checks it, shows the correct answer, then you rate Again / Hard / Good / Easy and the next review is set.
 * Exercise types for words grow with how well you know them: Polish → English, gap in a sentence,
 * recall from a context hint, whole-sentence translation. Grammar items: one correct form in a sentence.
 */
type WriteType = "translate" | "gap" | "sentence" | "recall" | "grammar";
const TYPE_LABEL: Record<WriteType, string> = { translate: "Tłumaczenie na angielski", gap: "Uzupełnij zdanie", sentence: "Napisz całe zdanie po angielsku", recall: "Napisz z pamięci", grammar: "Gramatyka – wpisz poprawną formę" };
type Item = { key: string; kind: "vocab"; v: Vocab; type: WriteType; repeat?: boolean } | { key: string; kind: "grammar"; ex: Exercise; type: "grammar"; repeat?: boolean };

const target = (v: Vocab) => (v.example.match(/\*([^*]+)\*/) || [])[1] ?? v.term;
const hasGap = (v: Vocab) => (v.example.match(/\*/g) || []).length === 2;
/** Harder writing tasks as the interval grows: new → translate; young → gap / recall; known (≥ 4 days) → whole sentence. */
export function chooseType(v: Vocab, c: Pick<SrsCard, "interval_days" | "reps"> | null, avoid?: WriteType): WriteType {
  const ivl = Number(c?.interval_days ?? 0);
  const options: WriteType[] = ivl === 0 ? ["translate"] : ivl < 4 ? [...(hasGap(v) ? ["gap" as const] : []), ...(v.definition ? ["recall" as const] : []), "translate"] : [...(v.example_pl ? ["sentence" as const] : []), ...(hasGap(v) ? ["gap" as const] : []), "translate"];
  const pool = options.filter((t) => t !== avoid);
  const list = pool.length ? pool : options;
  return list[Math.floor(Math.random() * list.length)];
}
function spec(it: Item) {
  if (it.kind === "grammar") return { prompt: <>{withGap(it.ex.prompt.question)}</>, answers: it.ex.answers.map(String), explanation: it.ex.explanation, placeholder: "poprawna forma", multiline: false, check: undefined as ((s: string) => boolean) | undefined, text: it.ex.prompt.question };
  const v = it.v, pl = v.translation_pl.split(";")[0].trim();
  const why = `${v.term} – ${v.translation_pl}${v.definition ? `. ${v.definition}` : ""}`;
  const alts = v.alternatives ?? [];
  switch (it.type) {
    case "gap": return { prompt: <>{withGap(v.example.replace(/\*[^*]+\*/, "___"))} <span className="text-ink-soft">({pl.split(",")[0]})</span></>, answers: [target(v)], explanation: why, placeholder: "brakujące słowo", multiline: false, check: undefined, text: v.example.replace(/\*[^*]+\*/, "___") };
    case "recall": {
      const first = v.term.trim()[0];
      return { prompt: <><span>{v.definition}</span><span className="mt-2 block text-base text-ink-soft">Podpowiedź: {KIND_LABEL[v.kind].toLowerCase()}, zaczyna się na „{first}…”, {v.term.split(/\s+/).length > 1 ? `${v.term.split(/\s+/).length} słowa` : `${v.term.length} liter`}{v.collocations[0] ? ` · np. ${v.collocations[0].replace(new RegExp(v.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "___")}` : ""}</span></>, answers: [v.term, ...alts], explanation: why, placeholder: "wyrażenie po angielsku", multiline: false, check: undefined, text: v.definition ?? "" };
    }
    case "sentence": {
      const model = v.example.replace(/\*/g, ""), all = [model, ...(v.sentence_alternatives ?? [])];
      // a natural sentence counts if it uses the key word/phrase and is close to the model (or an accepted alternative)
      const check = (s: string) => { const u = canon(s); if (!u.includes(canon(target(v)))) return false; return all.some((a) => { const c = canon(a); return levenshtein(u, c) <= Math.max(3, Math.round(c.length * 0.15)); }); };
      return { prompt: <>{v.example_pl}</>, answers: all, explanation: <>Kluczowe wyrażenie: <b>{target(v)}</b> ({v.translation_pl}). {why}</>, placeholder: "całe zdanie po angielsku", multiline: true, check, text: v.example_pl ?? "" };
    }
    default: return { prompt: <>{pl}</>, answers: [v.term, ...alts], explanation: why, placeholder: "po angielsku", multiline: false, check: undefined, text: pl };
  }
}

type Result = { item: Item; firstTry: boolean; grade: Grade };

export function SrsSession({ items: initial, onExit }: { items: Item[]; onExit: () => void }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [i, setI] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [cur, setCur] = useState<SrsCard | null>(null);
  const [rating, setRating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [lastNext, setLastNext] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ id: string; term: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(Date.now()); const logged = useRef(false);
  const done = i >= items.length;
  const it = items[i];
  const sp = useMemo(() => (it ? spec(it) : null), [it]);
  useEffect(() => {
    let on = true; setCur(null);
    if (it) (it.kind === "vocab" ? srsCard(it.v.id) : srsExercise(it.ex.id)).then((x) => on && setCur(x)).catch(() => {});
    return () => { on = false; };
  }, [it?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish(list: Result[]) {
    if (logged.current) return; logged.current = true;
    try { await logSession("srs", list.length, list.filter((r) => r.firstTry).length, (Date.now() - started.current) / 60000); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  function advance(list = results, len = items.length) {
    setOutcome(null); setRating(false); setAnswered(false);
    const ni = i + 1; setI(ni);
    if (ni >= len) void finish(list);
  }
  async function onDone(o: Outcome) {
    setOutcome(o);
    if (o.overridden) void reportAcceptedAnswer({ exerciseId: it.kind === "vocab" ? `v:${it.v.id}:${it.type}` : it.ex.id, source: `srs:${it.type}`, prompt: sp!.text, userAnswer: o.acceptedAnswer ?? "", expected: o.expected ?? sp!.answers[0] });
    if (it.repeat) return; // second pass in this session: already rated
    setRating(true);
    if (!o.firstTry) {
      try {
        if (it.kind === "vocab") {
          const cat = it.v.kind === "phrasal_verb" ? "phrasal_verbs" : it.v.kind === "collocation" ? "collocations" : "vocabulary";
          await recordMistake({ category: o.diagnosis ? mistakeCategory(o.diagnosis, cat, sp!.answers[0]) : cat, source: "srs", prompt: `${TYPE_LABEL[it.type]}: ${sp!.text}`, user_answer: o.firstAnswer, correct: sp!.answers[0], explanation: it.v.definition ?? undefined, vocab_id: it.v.id });
          // one more try later in this session, in another form
          setItems((xs) => [...xs, { ...it, key: it.key + ":again", type: chooseType(it.v, cur, it.type), repeat: true }]);
        } else {
          await recordMistake({ category: "grammar", source: "srs", prompt: sp!.text, user_answer: o.firstAnswer, correct: sp!.answers[0], explanation: it.ex.explanation, exercise_id: it.ex.id });
          setItems((xs) => [...xs, { ...it, key: it.key + ":again", repeat: true }]);
        }
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    }
  }
  async function rate(g: Grade) {
    if (!outcome || busy) return;
    setBusy(true);
    try {
      const s = it.kind === "vocab" ? await reviewCard(it.v.id, g, outcome.attempts, `srs:${it.type}`, cur, outcome.firstTry) : await reviewExercise(it.ex.id, g, "srs:grammar", cur, outcome.firstTry);
      setLastNext(`${it.kind === "vocab" ? `„${it.v.term}”` : "To zadanie"} wróci za ${formatInterval(s)}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    const list = [...results, { item: it, firstTry: outcome.firstTry, grade: g }];
    setResults(list); setBusy(false); advance(list);
  }
  function skip() { setRemoved(null); setLastNext(null); advance(); }
  function removeWord(id: string) {
    const term = it.kind === "vocab" ? it.v.term : "";
    const nl = [...items.slice(0, i + 1), ...items.slice(i + 1).filter((x) => !(x.kind === "vocab" && x.v.id === id))];
    setItems(nl); setRemoved({ id, term }); advance(results, nl.length);
  }
  useEnter(() => advance(), !!outcome && !rating && !done);   // second-pass items: Enter → next
  useEnter(onExit, done);

  if (done) {
    const n = results.length, ok = results.filter((r) => r.firstTry).length, bad = n - ok;
    const weak = results.filter((r) => r.grade === "again" || r.grade === "hard" || !r.firstTry);
    return <div className="max-w-2xl" data-testid="srs-summary">
      <PageHeader eyebrow="Koniec powtórki" title={n ? `Skuteczność ${Math.round((ok / n) * 100)}%` : "Koniec sesji"} />
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Wykonane ćwiczenia" value={n} /><Stat label="Poprawne za 1. razem" value={<span data-testid="srs-sum-ok">{ok}</span>} /><Stat label="Błędy" value={<span data-testid="srs-sum-bad">{bad}</span>} /></div>
      <div className="mt-3"><Progress value={n ? (ok / n) * 100 : 0} tone={n && ok / n >= 0.8 ? "ok" : "warn"} /></div>
      <Card className="mt-4"><h2 className="font-display text-lg font-bold">Wymaga dodatkowej nauki</h2>
        {weak.length ? <ul className="mt-2">{weak.map((r, k) => <li key={k} className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 py-2 first:border-0 dark:border-white/5">
          <span>{r.item.kind === "vocab" ? <><b>{r.item.v.term}</b> <span className="text-ink-soft">– {r.item.v.translation_pl}</span></> : <span className="text-sm">{r.item.ex.prompt.question} → <b>{String(r.item.ex.answers[0])}</b></span>}</span>
          <Pill tone={r.grade === "again" ? "bad" : "warn"}>{r.grade === "again" ? "nie pamiętałeś" : r.grade === "hard" ? "z trudem" : "błąd, poprawione"}</Pill></li>)}</ul>
          : <p className="mt-2">Wszystko poszło dobrze – te elementy wrócą później, zgodnie z harmonogramem.</p>}
        {weak.length > 0 && <p className="mt-2 text-sm text-ink-soft">Wrócą szybciej w kolejnych powtórkach. Błędy są też w <Link className="underline" to="/mistakes">Mistake Notebook</Link>.</p>}</Card>
      {err && <div className="mt-3"><Feedback tone="warn" title="Problem z zapisem">{err}</Feedback></div>}
      <div className="mt-4"><Button onClick={onExit} data-testid="srs-finish">Zakończ</Button> <span className="hidden text-xs text-ink-soft sm:inline">lub Enter</span></div>
    </div>;
  }
  if (!it || !sp) return null;
  return <div className="max-w-2xl" data-testid="srs-session">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-bold uppercase tracking-widest text-ink-soft" data-testid="srs-counter">Element {i + 1} / {items.length}{it.repeat ? " · jeszcze raz" : ""}</span>
      <span className="flex gap-1"><Pill>{TYPE_LABEL[it.type]}</Pill>{it.kind === "vocab" && <Pill>{KIND_LABEL[it.v.kind]}</Pill>}</span></div>
    <Progress value={(i / items.length) * 100} />
    {removed && <div className="mt-3"><RemovedNotice term={removed.term} onUndo={async () => { const r = removed; setRemoved(null); try { await unhideWord(r.id); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } }} /></div>}
    {!outcome && lastNext && <p className="mt-3 text-sm text-ink-soft" role="status" data-testid="srs-next-info">{lastNext}</p>}
    <Card className="mt-4">
      <div className="text-xs font-bold uppercase tracking-widest text-ink-soft">{TYPE_LABEL[it.type]}</div>
      <TypedTask key={it.key + i} prompt={<div className="mt-2 font-display text-2xl font-bold leading-snug" data-testid="srs-prompt">{sp.prompt}</div>} answers={sp.answers}
        explanation={sp.explanation} placeholder={sp.placeholder} multiline={sp.multiline} extraCheck={sp.check} acceptTypos allowHint
        onDone={onDone} onAnswered={() => setAnswered(true)} />
      {outcome && it.kind === "vocab" && <details className="mt-4 rounded-lg bg-black/[.03] p-3 dark:bg-white/[.04]" open={!outcome.firstTry}><summary className="cursor-pointer font-bold">{it.v.term}</summary><div className="mt-2"><VocabDetail v={it.v} /></div></details>}
    </Card>
    {outcome && rating && <RatingBar cur={cur} onRate={rate} busy={busy} wasCorrect={outcome.firstTry} />}
    {outcome && !rating && <div className="mt-4"><Button onClick={() => advance()} data-testid="next">Dalej →</Button></div>}
    {err && <div className="mt-3"><Feedback tone="warn" title="Problem z zapisem">{err}</Feedback></div>}
    {!outcome && <div className="mt-3"><SkipBar canSkip={!answered} vocabId={it.kind === "vocab" ? it.v.id : undefined} onSkip={skip} onRemoved={removeWord} /></div>}
    <div className="mt-4"><Button variant="ghost" onClick={() => { setI(items.length); void finish(results); }}>Zakończ sesję</Button></div>
  </div>;
}

export default function Review() {
  const { refreshProfile } = useAuth();
  const ov = useAsync(srsOverview);
  const [session, setSession] = useState<{ items: Item[]; started: boolean; fresh: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  async function start() {
    if (!ov.data) return;
    setBusy(true); setErr(null);
    try {
      const q = await srsQueue(limit, ov.data.newAllowed, ov.data.newAllowed > 0 ? 3 : 0);
      const progOf = async (v: Vocab) => srsCard(v.id).catch(() => null);
      const dueItems: Item[] = await Promise.all(q.due.map(async (d, k) => d.kind === "vocab"
        ? { key: `v${k}:${d.v.id}`, kind: "vocab" as const, v: d.v, type: chooseType(d.v, await progOf(d.v)) }
        : { key: `e${k}:${d.ex.id}`, kind: "grammar" as const, ex: d.ex, type: "grammar" as const }));
      const fresh: Item[] = [...q.freshWords.map((v) => ({ key: `n:${v.id}`, kind: "vocab" as const, v, type: "translate" as const })), ...q.freshGrammar.map((ex) => ({ key: `g:${ex.id}`, kind: "grammar" as const, ex, type: "grammar" as const }))];
      const items = [...dueItems, ...fresh];
      if (!items.length) { setErr("Na teraz nie ma nic do powtórki, a limit nowych słów na dziś jest wykorzystany."); return; }
      setSession({ items, started: false, fresh: fresh.length });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const ready = !!ov.data && (ov.data.dueToday > 0 || ov.data.newAllowed > 0);
  useEnter(() => { void start(); }, !session && ready && !busy);

  if (session && !session.started && session.items.some((x) => x.kind === "vocab")) {
    const words = session.items.flatMap((x) => (x.kind === "vocab" ? [x.v] : []));
    const grammar = session.items.length - words.length;
    return <WordPreview words={words} title="Powtórka SRS – hasła"
      lead={`${session.items.length - session.fresh} do powtórki${session.fresh ? `, ${session.fresh} nowych` : ""}${grammar ? ` (w tym ${grammar} zadań z gramatyki)` : ""}. Przejrzyj słowa – w sesji wpiszesz je z pamięci, a potem ocenisz, jak dobrze je pamiętałeś.`}
      startLabel="Zaczynamy powtórkę →" onStart={() => setSession({ ...session, started: true })} onBack={() => setSession(null)}
      onRemove={(v) => setSession((s) => s && { ...s, items: s.items.filter((x) => !(x.kind === "vocab" && x.v.id === v.id)) })}
      onRestore={(v) => setSession((s) => s && { ...s, items: [...s.items, { key: `r:${v.id}`, kind: "vocab", v, type: "translate" }] })} />;
  }
  if (session) return <SrsSession items={session.items} onExit={() => { setSession(null); ov.reload(); }} />;
  if (ov.loading) return <Loading />;
  if (ov.error || !ov.data) return <ErrorBox error={ov.error ?? ""} onRetry={ov.reload} />;
  const d = ov.data;
  const fc = d.forecast.map((f, i) => ({ label: i === 0 ? "dziś" : new Date(f.day).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric" }), value: f.count }));

  return <div className="max-w-3xl" data-testid="srs-page">
    <PageHeader eyebrow="Spaced repetition · active recall" title="Powtórki (SRS)"
      lead="Wpisujesz odpowiedź z pamięci – dopiero potem widzisz poprawną. Oceniasz, jak dobrze pamiętałeś (Nie pamiętam / Trudne / Dobre / Łatwe), a system ustala następną powtórkę: błąd = wcześniej, łatwo = później. Słowa i gramatyka mają wspólny harmonogram." />
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Do powtórki dziś" value={<span data-testid="srs-due">{d.dueToday}</span>} sub={`zaległe: ${d.dueNow}`} />
      <Stat label="Nowe dziś" value={d.newAllowed} sub={d.newAllowed < d.newLeft ? `limit ${d.newPerDay} – mniej przez zaległości` : `limit ${d.newPerDay} dziennie`} />
      <Stat label="Skuteczność (30 dni)" value={d.retention === null ? "–" : `${d.retention}%`} sub={`${d.reviews30} powtórek`} />
    </div>
    <Card className="mt-4">
      {ready ? <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy} data-testid="srs-start">{busy ? "Przygotowuję…" : `Rozpocznij powtórkę (${Math.min(limit, d.dueToday) + d.newAllowed})`}</Button>
        <label className="flex items-center gap-2 text-sm">maks. powtórek w sesji
          <select className={inputCls + " w-auto"} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <span className="hidden text-xs text-ink-soft sm:inline">lub Enter</span>
      </div> : <Feedback tone="ok" title="Wszystko powtórzone!">Na dziś nie ma więcej powtórek, a limit nowych słów jest wykorzystany. Wróć jutro – albo zwiększ limit nowych słów poniżej.</Feedback>}
      <p className="mt-3 text-sm text-ink-soft">Kolejność: najpierw zaległe, potem zaplanowane na dziś, na końcu nowe. Rodzaj ćwiczenia zmienia się z czasem: tłumaczenie słowa → luka w zdaniu lub przypomnienie z kontekstu → całe zdanie po angielsku.</p>
      {err && <div className="mt-3"><Feedback tone="warn">{err}</Feedback></div>}
    </Card>
    <Card className="mt-4"><h2 className="font-display text-lg font-bold">Prognoza powtórek – 14 dni</h2>
      <p className="mt-1 text-sm text-ink-soft">Ile elementów będzie do powtórzenia każdego dnia (dziś = także zaległe).</p>
      <div className="mt-3"><BarChart data={fc} /></div></Card>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Stat label="W nauce" value={d.learning} sub="wracają w ciągu minut" />
      <Stat label="Młode" value={d.young} sub="odstęp < 21 dni" />
      <Stat label="Dojrzałe" value={d.matureCount} sub="odstęp ≥ 21 dni" />
    </div>
    <Card className="mt-4"><h2 className="font-display text-lg font-bold">Ustawienia</h2>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">Nowe słowa dziennie
        <select className={inputCls + " w-auto"} value={d.newPerDay} data-testid="srs-new-limit" onChange={async (e) => { try { await updateProfile({ srs_new_per_day: Number(e.target.value) }); await refreshProfile(); ov.reload(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } }}>
          {[0, 5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <p className="mt-2 text-sm text-ink-soft">Gdy zaległości przekraczają 30 powtórek, system sam daje mniej nowych słów (od 100 zaległych – żadnych), żeby nie przeciążać nauki. Słowa z codziennej lekcji i fiszek też trafiają do tego harmonogramu.</p>
    </Card>
  </div>;
}
