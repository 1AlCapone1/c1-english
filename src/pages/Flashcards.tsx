import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listExercises, logSession, pickFlashcards, recordMistake, saveFlashcardResult, shuffle, unhideWord } from "../lib/api";
import { canon, levenshtein, mistakeCategory, type MistakeCategory } from "../lib/answer";
import { CATEGORIES, KIND_LABEL, type Kind, type Vocab } from "../lib/types";
import { TypedTask, type Outcome } from "../components/Correction";
import { useEnter } from "../lib/keys";
import { WordPreview } from "../components/WordPreview";
import { RemovedNotice, SkipBar } from "../components/SkipBar";
import { PracticeSession } from "../components/PracticeSession";
import { Button, Card, Empty, Feedback, PageHeader, Pill, Progress, inputCls } from "../components/ui";
import { VocabDetail, exampleHtml } from "./Vocabulary";

type Mode = "plen" | "enpl" | "gap" | "sentence" | "def";
const MODE_LABEL: Record<Mode, string> = { plen: "Polski → angielski", enpl: "Angielski → polski", gap: "Uzupełnij lukę w zdaniu", sentence: "Przetłumacz całe zdanie", def: "Definicja → wyrażenie" };
type FlashCard = { v: Vocab; mode: Mode; again?: boolean };

const target = (v: Vocab) => (v.example.match(/\*([^*]+)\*/) || [])[1] ?? v.term;
const plVariants = (pl: string) => Array.from(new Set([pl, ...pl.split(/[,;/]/).map((p) => p.replace(/\([^)]*\)/g, "").trim()).filter(Boolean)]));
function availableModes(v: Vocab): Mode[] {
  const m: Mode[] = ["plen", "enpl"];
  if ((v.example.match(/\*/g) || []).length === 2) m.push("gap");
  if (v.example_pl) m.push("sentence");
  if (v.definition) m.push("def");
  return m;
}
function pickMode(v: Vocab, wanted: Mode | "mix", avoid?: string | null): Mode {
  const av = availableModes(v);
  if (wanted !== "mix" && av.includes(wanted)) return wanted;
  const weighted = av.flatMap((m) => (m === "gap" ? [m, m] : m === "sentence" ? [] : [m])).filter((m) => m !== avoid);
  const pool = weighted.length ? weighted : av;
  return pool[Math.floor(Math.random() * pool.length)];
}
function cardSpec(c: FlashCard) {
  const v = c.v;
  switch (c.mode) {
    case "plen": return { label: "Podaj po angielsku", prompt: v.translation_pl, answers: [v.term] };
    case "enpl": return { label: "Podaj po polsku", prompt: v.term, answers: plVariants(v.translation_pl) };
    case "gap": return { label: "Uzupełnij zdanie", prompt: v.example.replace(/\*[^*]+\*/, "___") + `  (${v.translation_pl.split(/[,;]/)[0]})`, answers: [target(v)] };
    case "sentence": return { label: "Przetłumacz zdanie na angielski", prompt: v.example_pl ?? "", answers: [v.example.replace(/\*/g, "")] };
    case "def": return { label: "Jakie to wyrażenie?", prompt: v.definition ?? "", answers: [v.term] };
  }
}
function catFor(v: Vocab): MistakeCategory {
  return v.kind === "phrasal_verb" ? "phrasal_verbs" : v.kind === "collocation" ? "collocations" : v.kind === "word_formation" ? "word_formation" : "vocabulary";
}

export default function Flashcards() {
  const [params] = useSearchParams();
  type PickMode = "smart" | "new" | "due" | "hard" | "saved";
  const [cfg, setCfg] = useState<{ kind: string; category: string; level: string; n: number; mode: PickMode; type: Mode | "mix" }>({ kind: "", category: "", level: "", n: 20, mode: (params.get("mode") as PickMode) || "smart", type: "mix" });
  const [session, setSession] = useState<{ cards: FlashCard[]; i: number; started: boolean } | null>(null);
  const [grammar, setGrammar] = useState<Awaited<ReturnType<typeof listExercises>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setErr(null); setLoading(true);
    try {
      if (cfg.kind === "grammar") {
        const ex = await listExercises({ module: "grammar", types: ["gap", "kwt", "error"] });
        if (!ex.length) throw new Error("Brak ćwiczeń gramatycznych w bazie.");
        setGrammar(shuffle(ex).slice(0, cfg.n));
      } else {
        const vs = await pickFlashcards({ kind: cfg.kind || undefined, category: cfg.category || undefined, level: cfg.level || undefined, n: cfg.n, mode: cfg.mode });
        if (!vs.length) throw new Error(cfg.mode === "due" ? "Nie masz teraz haseł do powtórki – świetnie! Wybierz „Nowe i powtórki”." : "Brak haseł dla tych ustawień.");
        setSession({ cards: vs.map((v) => ({ v, mode: pickMode(v, cfg.type) })), i: 0, started: false });
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  if (grammar) return <PracticeSession title="Fiszki · gramatyka" items={grammar} pool={[]} source="flashcards-grammar" onClose={() => setGrammar(null)} />;
  if (session && !session.started) return <WordPreview words={session.cards.map((c) => c.v)} onStart={() => { setSession({ ...session, started: true }); window.scrollTo(0, 0); }} onBack={() => setSession(null)}
    onRemove={(v) => setSession((s) => s && { ...s, cards: s.cards.filter((c) => c.v.id !== v.id) })}
    onRestore={(v) => setSession((s) => s && { ...s, cards: [...s.cards, { v, mode: pickMode(v, cfg.type) }] })} />;
  if (session) return <Session cards={session.cards} onExit={() => setSession(null)} />;
  return <div>
    <PageHeader eyebrow="Inteligentne fiszki" title="Wpisz, popraw, zapamiętaj" lead="Każdą odpowiedź wpisujesz ręcznie. Po błędzie zobaczysz, co jest nie tak, a potem wpiszesz odpowiedź z pamięci – dopiero wtedy przejdziesz dalej. Powtórki planują się automatycznie (1, 2, 4, 8… dni)." />
    <Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-bold">Rodzaj<select className={inputCls} value={cfg.kind} onChange={(e) => setCfg({ ...cfg, kind: e.target.value })}><option value="">Wszystkie</option>{(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}<option value="grammar">Gramatyka (zdania z lukami)</option></select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Kategoria<select className={inputCls} value={cfg.category} disabled={cfg.kind === "grammar"} onChange={(e) => setCfg({ ...cfg, category: e.target.value })}><option value="">Wszystkie</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Poziom<select className={inputCls} value={cfg.level} disabled={cfg.kind === "grammar"} onChange={(e) => setCfg({ ...cfg, level: e.target.value })}><option value="">Wszystkie</option>{["B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Liczba fiszek<select className={inputCls} value={cfg.n} onChange={(e) => setCfg({ ...cfg, n: Number(e.target.value) })}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Tryb nauki<select className={inputCls} value={cfg.mode} disabled={cfg.kind === "grammar"} onChange={(e) => setCfg({ ...cfg, mode: e.target.value as PickMode })}><option value="smart">Nowe i powtórki</option><option value="due">Tylko do powtórki</option><option value="new">Tylko nowe</option><option value="hard">Trudne i błędne</option><option value="saved">Moje zapisane (★)</option></select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Rodzaj fiszki<select className={inputCls} value={cfg.type} disabled={cfg.kind === "grammar"} onChange={(e) => setCfg({ ...cfg, type: e.target.value as Mode | "mix" })}><option value="mix">Mieszany (zalecany)</option>{(Object.keys(MODE_LABEL) as Mode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select></label>
    </div>
    {err && <div className="mt-3"><Feedback tone="warn">{err}</Feedback></div>}
    <div className="mt-4"><Button onClick={start} disabled={loading} data-testid="start-flashcards">{loading ? "Przygotowuję…" : "Rozpocznij sesję"}</Button></div></Card>
  </div>;
}

function Session({ cards: initial, onExit }: { cards: FlashCard[]; onExit: () => void }) {
  const [cards, setCards] = useState<FlashCard[]>(initial);
  const [i, setI] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [first, setFirst] = useState<Record<string, Outcome>>({});
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [removed, setRemoved] = useState<{ id: string; term: string } | null>(null);
  const started = useRef(Date.now());
  const logged = useRef(false);
  const done = i >= cards.length;
  const c = cards[i];
  const spec = useMemo(() => (c ? cardSpec(c) : null), [c]);

  async function handleDone(o: Outcome) {
    setOutcome(o);
    const v = c.v;
    if (first[v.id]) return; // follow-up repetition in this session – already recorded
    setFirst((f) => ({ ...f, [v.id]: o }));
    try {
      await saveFlashcardResult(v.id, o.firstTry, o.hinted, o.attempts, c.mode);
      if (!o.firstTry) {
        await recordMistake({ category: o.diagnosis ? mistakeCategory(o.diagnosis, catFor(v), spec!.answers[0]) : catFor(v), source: "flashcards", prompt: `${spec!.label}: ${spec!.prompt}`, user_answer: o.firstAnswer, correct: spec!.answers[0], explanation: v.definition ?? undefined, vocab_id: v.id });
        // come back at the end of the session in a different context
        const other = availableModes(v).find((m) => m !== c.mode) ?? c.mode;
        setCards((cs) => [...cs, { v, mode: other, again: true }]);
      }
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
  }
  async function next(len = cards.length) {
    setOutcome(null); setAnswered(false); const ni = i + 1; setI(ni);
    if (outcome) setRemoved(null);
    if (ni >= len && !logged.current) {
      logged.current = true;
      const vals = Object.values(first);
      try { await logSession("flashcards", vals.length, vals.filter((x) => x.firstTry).length, (Date.now() - started.current) / 60000); } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
    }
  }
  function removeWord(id: string) {
    const nc = [...cards.slice(0, i + 1), ...cards.slice(i + 1).filter((x) => x.v.id !== id)];
    setCards(nc); setRemoved({ id, term: c.v.term }); void next(nc.length);
  }
  useEnter(() => { void next(); }, !!outcome && !done);
  useEnter(onExit, done);
  if (done) {
    const vals = Object.entries(first); const ok = vals.filter(([, o]) => o.firstTry).length; const wrong = vals.filter(([, o]) => !o.firstTry);
    return <div className="max-w-2xl"><PageHeader eyebrow="Koniec sesji" title={`${ok} / ${vals.length} za pierwszym razem`} />
      <Progress value={(ok / Math.max(1, vals.length)) * 100} tone={ok / Math.max(1, vals.length) >= 0.75 ? "ok" : "warn"} />
      {wrong.length ? <Card className="mt-4"><h2 className="font-display text-lg font-bold">Poprawione błędy</h2><ul className="mt-2">{wrong.map(([id, o]) => { const v = initial.find((x) => x.v.id === id)?.v; return v ? <li key={id} className="flex justify-between gap-2 border-t border-black/5 py-2 dark:border-white/5"><span><b>{v.term}</b> <span className="text-ink-soft">{v.translation_pl}</span></span><Pill tone="ok">poprawiona · prób: {o.attempts}</Pill></li> : null; })}</ul><p className="mt-2 text-sm text-ink-soft">Wrócą w kolejnych sesjach częściej i w innym kontekście. Znajdziesz je też w Mistake Notebook.</p></Card>
        : <div className="mt-4"><Feedback tone="ok" title="Bezbłędnie!">Te hasła wrócą za kilka dni, żeby utrwalić je w pamięci długotrwałej.</Feedback></div>}
      {saveErr && <div className="mt-3"><Feedback tone="warn" title="Problem z zapisem">{saveErr}</Feedback></div>}
      <div className="mt-4 flex gap-2"><Button onClick={onExit}>Nowa sesja</Button><Link to="/mistakes"><Button variant="quiet">Mistake Notebook</Button></Link></div></div>;
  }
  if (!c || !spec) return <Empty title="Brak fiszek" />;
  const translationCheck = c.mode === "sentence" ? (val: string) => { const u = canon(val), a = canon(spec.answers[0]); return u.includes(canon(target(c.v))) && levenshtein(u, a) <= Math.max(3, Math.round(a.length * 0.12)); } : undefined;
  return <div className="max-w-2xl">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-bold uppercase tracking-widest text-ink-soft">Fiszka {i + 1} / {cards.length}{c.again ? " · powtórka w innym kontekście" : ""}</span><span className="flex gap-1"><Pill>{KIND_LABEL[c.v.kind]}</Pill><Pill>{c.v.level}</Pill></span></div>
    <Progress value={(i / cards.length) * 100} />
    {removed && <div className="mt-3"><RemovedNotice term={removed.term} onUndo={async () => { const r = removed; setRemoved(null); try { await unhideWord(r.id); } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); } }} /></div>}
    <Card className="mt-4">
      <div className="text-xs font-bold uppercase tracking-widest text-ink-soft">{spec.label}</div>
      <TypedTask key={c.v.id + c.mode + i} prompt={<div className="mt-2 font-display text-2xl font-bold leading-snug">{spec.prompt}</div>} answers={spec.answers} allowHint multiline={c.mode === "sentence"}
        placeholder={c.mode === "enpl" ? "odpowiedź po polsku" : "answer in English"} extraCheck={translationCheck}
        explanation={<span>{c.v.term} – {c.v.translation_pl}{c.v.ipa ? ` /${c.v.ipa.replace(/^\/|\/$/g, "")}/` : ""}</span>} onDone={handleDone} onAnswered={() => setAnswered(true)} />
      {outcome && <details className="mt-4 rounded-lg bg-black/[.03] p-3 dark:bg-white/[.04]" open={!outcome.firstTry}><summary className="cursor-pointer font-bold">{c.v.term}</summary><div className="mt-2"><VocabDetail v={c.v} /></div><p className="mt-2 text-sm italic">{exampleHtml(c.v.example)}</p></details>}
    </Card>
    {saveErr && <div className="mt-3"><Feedback tone="warn" title="Problem z zapisem">{saveErr}</Feedback></div>}
    {!outcome && <div className="mt-3"><SkipBar canSkip={!answered} vocabId={c.v.id} onSkip={() => { setRemoved(null); void next(); }} onRemoved={removeWord} /></div>}
    <div className="mt-4 flex gap-2">{outcome && <Button onClick={() => void next()} data-testid="next">Dalej →</Button>}<Button variant="ghost" onClick={() => setI(cards.length)}>Zakończ sesję</Button></div>
  </div>;
}
