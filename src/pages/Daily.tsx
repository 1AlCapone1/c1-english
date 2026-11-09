import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, unwrap } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { exercisesByIds, hideWord, lessonProgress, listExercises, listLessons, listMistakes, listVocab, logSession, pickFlashcards, saveAttempt, saveFlashcardResult, shuffle } from "../lib/api";
import { isShortTask, vocabShortExercise } from "../lib/vocabTest";
import { useEnter } from "../lib/keys";
import type { Exercise, GrammarLesson, Vocab } from "../lib/types";
import { PracticeSession } from "../components/PracticeSession";
import { WordPreview } from "../components/WordPreview";
import { VocabDetail } from "./Vocabulary";
import { Button, Card, ErrorBox, Feedback, Loading, PageHeader, Pill, Progress, cx } from "../components/ui";

/**
 * Daily lesson – about 20 minutes, no timer, always in this order:
 *   1. Słownictwo  – read the words of the day (translation, example, pronunciation, notes)
 *   2. Gramatyka   – read the grammar topic of the day (explanation in Polish, structure, examples)
 *   3. Ćwiczenia   – short typed answers only (as in the original prototype): Polish word → English word,
 *                    single gaps, one word form, choosing the right construction, word formation
 *   4. Powtórka    – the same words as flashcards in another form + due words and short mistakes from previous days
 * No whole-sentence translation or sentence writing in the daily lesson (those stay in the other modules).
 * then a summary. The plan (words, lesson) and stage progress live in the database (daily_plans),
 * so the same plan continues after a reload or on another device. A stage opens only after the previous one.
 */
type StageKey = "vocab" | "grammar" | "exercises" | "revision";
type StageState = { done_at: string; items?: number; correct?: number; minutes?: number };
type ExtraRound = { done_at: string; vocab_ids: string[]; items: number; correct: number; minutes: number };
type Plan = { day: string; vocab_ids: string[]; lesson_id: string | null; stages: Partial<Record<StageKey, StageState>> & { extra?: ExtraRound[] } };
const STAGES: { key: StageKey; title: string; minutes: number; what: string }[] = [
  { key: "vocab", title: "Słownictwo", minutes: 4, what: "Poznaj słowa dnia: tłumaczenie, wymowa, przykłady" },
  { key: "grammar", title: "Gramatyka", minutes: 5, what: "Przeczytaj zagadnienie dnia z wyjaśnieniem po polsku" },
  { key: "exercises", title: "Ćwiczenia", minutes: 7, what: "Krótkie odpowiedzi: polskie słowo → angielskie, luki i formy gramatyczne" },
  { key: "revision", title: "Powtórka", minutes: 4, what: "Fiszki ze słowami dnia, zaległe powtórki i błędy z poprzednich dni" },
];
const WORDS_PER_DAY = 8;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const isVocabId = (id: string) => id.startsWith("v:");
const vocabIdOf = (id: string) => id.split(":")[1];

async function chooseLesson(): Promise<GrammarLesson | null> {
  const [lessons, lp] = await Promise.all([listLessons(), lessonProgress()]);
  if (!lessons.length) return null;
  const prog = new Map(lp.map((p) => [p.lesson_id, p]));
  const ratio = (id: string) => { const p = prog.get(id); return p?.test_max ? Number(p.test_score) / Number(p.test_max) : 0; };
  return lessons.find((l) => !prog.get(l.id)?.completed_at) ?? [...lessons].sort((a, b) => ratio(a.id) - ratio(b.id))[0];
}

async function loadOrCreatePlan(): Promise<Plan> {
  const day = today();
  const existing = unwrap(await supabase.from("daily_plans").select("day,vocab_ids,lesson_id,stages").eq("day", day).maybeSingle()) as Plan | null;
  if (existing) return existing;
  let words = await pickFlashcards({ n: WORDS_PER_DAY, mode: "new" });
  if (words.length < WORDS_PER_DAY) words = [...words, ...(await pickFlashcards({ n: WORDS_PER_DAY, mode: "smart" })).filter((w) => !words.some((x) => x.id === w.id))].slice(0, WORDS_PER_DAY);
  const lesson = await chooseLesson();
  const row = { day, vocab_ids: words.map((w) => w.id), lesson_id: lesson?.id ?? null, stages: {} };
  const ins = await supabase.from("daily_plans").upsert(row, { onConflict: "user_id,day", ignoreDuplicates: true }).select("day,vocab_ids,lesson_id,stages");
  if (ins.error) throw new Error(ins.error.message);
  return (ins.data?.[0] as Plan | undefined) ?? (unwrap(await supabase.from("daily_plans").select("day,vocab_ids,lesson_id,stages").eq("day", day).single()) as Plan);
}

async function loadDaily() {
  const plan = await loadOrCreatePlan();
  const [vocabRes, lessonRes] = await Promise.all([
    plan.vocab_ids.length ? listVocab({ ids: plan.vocab_ids, limit: plan.vocab_ids.length }) : Promise.resolve({ rows: [] as Vocab[] }),
    plan.lesson_id ? supabase.from("grammar_lessons").select("*").eq("id", plan.lesson_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const order = new Map(plan.vocab_ids.map((id, i) => [id, i]));
  const words = [...vocabRes.rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const lesson = (lessonRes.data as GrammarLesson | null) ?? null;
  const lessonAll = lesson ? unwrap(await supabase.from("exercises").select("*").eq("grammar_lesson_id", lesson.id).order("position")) as Exercise[] : [];
  const lessonExercises = lessonAll.filter(isShortTask); // gaps, one word form, choice of construction – no sentence writing
  const uoe = (await listExercises({ module: "use_of_english", limit: 400 })).filter((e) => e.task_type !== "kwt" && isShortTask(e));
  return { plan, words, lesson, lessonExercises, uoe };
}

async function saveStage(plan: Plan, key: StageKey, s: Omit<StageState, "done_at">): Promise<Plan> {
  const stages = { ...plan.stages, [key]: { ...s, done_at: new Date().toISOString() } };
  unwrap(await supabase.from("daily_plans").update({ stages, updated_at: new Date().toISOString() }).eq("day", plan.day));
  return { ...plan, stages };
}

export default function Daily() {
  const nav = useNavigate();
  const data = useAsync(loadDaily);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [view, setView] = useState<StageKey | "summary" | "extra" | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const p = plan ?? data.data?.plan ?? null;
  const firstOpen = p ? STAGES.find((s) => !p.stages[s.key])?.key ?? "summary" : null;
  const current = view ?? firstOpen;
  const doneCount = p ? STAGES.filter((s) => p.stages[s.key]).length : 0;

  async function complete(key: StageKey, s: Omit<StageState, "done_at" | "minutes">, logReading: boolean) {
    if (!p) return;
    setSaving(true); setErr(null);
    try {
      const minutes = Math.min(60, (Date.now() - startedAt) / 60000);
      if (logReading) await logSession(`daily:${key}`, s.items ?? 0, 0, minutes); // reading stages count towards today's minutes and the streak
      const np = await saveStage(p, key, { ...s, minutes });
      setPlan(np);
      setView(STAGES.find((x) => !np.stages[x.key])?.key ?? "summary");
      setStartedAt(Date.now()); window.scrollTo(0, 0);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }

  if (data.loading) return <Loading />;
  if (data.error || !data.data || !p || !current) return <ErrorBox error={data.error ?? "Nie udało się przygotować lekcji."} onRetry={data.reload} />;
  const { words, lesson, lessonExercises, uoe } = data.data;
  const stageIdx = current === "summary" || current === "extra" ? 4 : STAGES.findIndex((s) => s.key === current);
  const openStage = (k: StageKey) => { const i = STAGES.findIndex((s) => s.key === k); if (STAGES.slice(0, i).every((s) => p.stages[s.key])) { setView(k); setStartedAt(Date.now()); window.scrollTo(0, 0); } };

  const stepper = <div className="mb-5">
    <ol className="flex gap-1.5 overflow-x-auto" aria-label="Etapy lekcji">
      {STAGES.map((s, i) => {
        const done = !!p.stages[s.key], active = current === s.key, unlocked = STAGES.slice(0, i).every((x) => p.stages[x.key]);
        return <li key={s.key} className="shrink-0"><button type="button" disabled={!unlocked} onClick={() => openStage(s.key)} data-testid={`stage-${s.key}`} data-done={done}
          className={cx("rounded-full border px-3 py-1 text-sm", active ? "border-ink bg-ink font-bold text-white dark:bg-white dark:text-ink" : done ? "border-emerald-600 text-emerald-700 dark:text-emerald-300" : "border-black/15 opacity-70 dark:border-white/15")}>
          {done ? "✓ " : `${i + 1}. `}{s.title}</button></li>;
      })}
      <li className="shrink-0"><button type="button" disabled={doneCount < 4} onClick={() => setView("summary")} className={cx("rounded-full border px-3 py-1 text-sm", current === "summary" ? "border-ink bg-ink font-bold text-white dark:bg-white dark:text-ink" : "border-black/15 opacity-70 dark:border-white/15")}>Podsumowanie</button></li>
    </ol>
    <div className="mt-3"><Progress value={(doneCount / 4) * 100} tone={doneCount === 4 ? "ok" : "accent"} /></div>
  </div>;
  const header = (title: string, lead: ReactNode) => <PageHeader eyebrow={`Codzienna lekcja · ${current === "extra" ? "nauka dodatkowa" : current === "summary" ? "koniec" : `etap ${stageIdx + 1} z 4 · ok. ${STAGES[stageIdx].minutes} min`}`} title={title} lead={lead} />;
  const errBox = err && <div className="my-3"><Feedback tone="warn" title="Nie udało się zapisać postępu">{err}</Feedback></div>;

  return <div className="max-w-3xl" data-testid="daily" data-stage={current}>
    {stepper}
    {current === "vocab" && <VocabStage words={words} header={header} saving={saving} errBox={errBox} onDone={() => complete("vocab", { items: words.length }, true)}
      onReplace={async (v) => {
        setErr(null);
        try {
          await hideWord(v.id, "known");
          const [fresh] = await pickFlashcards({ n: 1, mode: "new", exclude: p.vocab_ids });
          const vocab_ids = p.vocab_ids.flatMap((id) => (id === v.id ? (fresh ? [fresh.id] : []) : [id]));
          unwrap(await supabase.from("daily_plans").update({ vocab_ids, updated_at: new Date().toISOString() }).eq("day", p.day));
          setPlan({ ...p, vocab_ids }); data.reload();
        } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
      }} />}
    {current === "grammar" && <GrammarStage lesson={lesson} header={header} saving={saving} errBox={errBox} onDone={() => complete("grammar", { items: 1 }, true)} />}
    {current === "exercises" && <ExercisesStage key={"ex" + p.day} words={words} lessonExercises={lessonExercises} uoe={uoe} lesson={lesson} header={header} errBox={errBox}
      onDone={(correct, items) => complete("exercises", { items, correct }, false)} />}
    {current === "revision" && <RevisionStage key={"rev" + p.day} words={words} header={header} errBox={errBox}
      onDone={async (correct, items) => { try { if (items) await saveAttempt({ kind: "daily", title: "Codzienna lekcja – powtórka", score: correct, max_score: items }); } catch { /* history entry is optional */ } await complete("revision", { items, correct }, false); }} />}
    {current === "summary" && <Summary plan={p} words={words} lesson={lesson} header={header} onClose={() => nav("/dashboard")} onRepeat={(k) => openStage(k)} onMore={() => { setView("extra"); setStartedAt(Date.now()); window.scrollTo(0, 0); }} />}
    {current === "extra" && <ExtraRoundView key={"extra" + (p.stages.extra?.length ?? 0)} plan={p} lessonExercises={lessonExercises} uoe={uoe} header={header}
      onCancel={() => setView("summary")}
      onDone={async (r) => {
        try {
          const extra = [...(p.stages.extra ?? []), { ...r, done_at: new Date().toISOString(), minutes: Math.min(60, (Date.now() - startedAt) / 60000) }];
          const stages = { ...p.stages, extra };
          unwrap(await supabase.from("daily_plans").update({ stages, updated_at: new Date().toISOString() }).eq("day", p.day));
          setPlan({ ...p, stages });
        } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
        setView("summary"); window.scrollTo(0, 0);
      }} />}
  </div>;
}

type HeaderFn = (title: string, lead: ReactNode) => ReactNode;

function NextBar({ label, onClick, disabled, hint = true }: { label: string; onClick: () => void; disabled?: boolean; hint?: boolean }) {
  useEnter(onClick, !disabled);
  return <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center gap-3 bg-paper/95 px-1 py-3 backdrop-blur dark:bg-[#0E1320]/95">
    <Button onClick={onClick} disabled={disabled} data-testid="stage-next">{label}</Button>
    {hint && <span className="hidden text-xs text-ink-soft sm:inline">lub Enter</span>}
  </div>;
}

function VocabStage({ words, header, onDone, saving, errBox, onReplace }: { words: Vocab[]; header: HeaderFn; onDone: () => void; saving: boolean; errBox: ReactNode; onReplace: (v: Vocab) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  return <div>
    {header("Słownictwo dnia", `Zapoznaj się ze wszystkimi ${words.length} hasłami. Ćwiczenia w etapie 3 będą dotyczyć właśnie tych słów.`)}
    {words.length ? <ol className="flex flex-col gap-3">{words.map((v, i) => <li key={v.id}><Card>
      <div className="mb-3 flex flex-wrap items-baseline gap-2"><span className="font-mono text-sm text-ink-soft">{i + 1}</span><h2 className="font-display text-xl font-bold">{v.term}</h2>{v.pos && <Pill>{v.pos}</Pill>}<Pill>{v.level}</Pill>
        <Button size="sm" variant="ghost" className="ml-auto" disabled={!!busy} data-testid="vocab-remove" title="Znam to / nie chcę się tego uczyć. Słowo zostanie zastąpione nowym; przywrócisz je w Ustawieniach."
          onClick={async () => { setBusy(v.id); try { await onReplace(v); } finally { setBusy(null); } }}>{busy === v.id ? "Zamieniam…" : "Wyrzuć – daj inne słowo"}</Button></div>
      <VocabDetail v={v} /></Card></li>)}</ol>
      : <Feedback tone="info" title="Brak nowych słów">W bazie nie ma na dziś nowych haseł – przejdź dalej.</Feedback>}
    {errBox}
    <NextBar label={saving ? "Zapisywanie…" : "Znam już te słowa – dalej"} onClick={onDone} disabled={saving} />
  </div>;
}

function GrammarStage({ lesson, header, onDone, saving, errBox }: { lesson: GrammarLesson | null; header: HeaderFn; onDone: () => void; saving: boolean; errBox: ReactNode }) {
  if (!lesson) return <div>{header("Gramatyka", "")}<Feedback tone="info" title="Brak lekcji">W bazie nie ma jeszcze lekcji gramatyki.</Feedback><NextBar label="Dalej" onClick={onDone} disabled={saving} /></div>;
  const c = lesson.content;
  const paras = (t: string) => t.split(/\n\n+/).map((x, i) => <p key={i} className="mb-3">{x}</p>);
  const section = (title: string, body: ReactNode) => <Card className="mb-3"><h2 className="mb-2 font-display text-lg font-bold">{title}</h2>{body}</Card>;
  return <div>
    {header(lesson.title, <>Zagadnienie dnia ({lesson.area}). Przeczytaj spokojnie całość – w ćwiczeniach użyjesz tej konstrukcji. <Link className="underline" to={`/grammar/${lesson.slug}`}>Pełna lekcja z testem</Link></>)}
    {section("Wyjaśnienie", <div className="leading-relaxed">{paras(c.explanation)}</div>)}
    {section("Kiedy używamy", <div className="leading-relaxed">{paras(c.usage)}</div>)}
    {section("Budowa", <div className="flex flex-col gap-3">
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/5 p-3 font-mono text-sm dark:bg-white/5">{c.structure.scheme}</pre>
      {c.structure.word_order && <p>{c.structure.word_order}</p>}
      <div className="grid gap-3 sm:grid-cols-3">{([["Twierdzenia", c.structure.affirmative], ["Przeczenia", c.structure.negative], ["Pytania", c.structure.questions]] as const).map(([h, l]) => <div key={h}><div className="text-xs font-bold uppercase tracking-wider text-ink-soft">{h}</div><ul className="mt-1 list-disc pl-5 text-sm">{l.map((x, i) => <li key={i}>{x}</li>)}</ul></div>)}</div></div>)}
    {section("Przykłady z tłumaczeniem", <ol className="flex flex-col gap-2">{c.examples.map((x, i) => <li key={i} className="border-t border-black/5 pt-2 first:border-0 first:pt-0 dark:border-white/5"><div className="font-medium">{i + 1}. {x.en}</div><div className="text-sm text-ink-soft">{x.pl}</div><div className="text-sm"><b>Dlaczego:</b> {x.why}</div></li>)}</ol>)}
    {(c.comparison ?? []).length > 0 && section("Porównanie z podobnymi konstrukcjami", <div className="flex flex-col gap-2">{c.comparison.map((x, i) => <div key={i}><b>{x.vs}</b><div>{x.difference}</div><div className="text-sm text-ink-soft">{x.when}</div></div>)}</div>)}
    {(c.mistakes ?? []).length > 0 && section("Typowe błędy Polaków", <ul className="flex flex-col gap-2">{c.mistakes.map((m, i) => <li key={i}><span className="text-red-700 line-through dark:text-red-300">{m.wrong}</span> → <b className="text-emerald-700 dark:text-emerald-300">{m.right}</b><div className="text-sm text-ink-soft">{m.why}</div></li>)}</ul>)}
    {(c.exceptions ?? []).length > 0 && section("Wyjątki", <ul className="list-disc pl-5">{c.exceptions.map((x, i) => <li key={i}>{x}</li>)}</ul>)}
    {errBox}
    <NextBar label={saving ? "Zapisywanie…" : "Rozumiem – dalej"} onClick={onDone} disabled={saving} />
  </div>;
}

/** Short tasks built only from today's words and today's grammar topic (+ a few one-word Use of English items). */
function ExercisesStage({ words, lessonExercises, uoe, lesson, header, onDone, errBox }: { words: Vocab[]; lessonExercises: Exercise[]; uoe: Exercise[]; lesson: GrammarLesson | null; header: HeaderFn; onDone: (correct: number, items: number) => void; errBox: ReactNode }) {
  const [result, setResult] = useState<{ correct: number; items: number } | null>(null);
  const [closeAsked, setCloseAsked] = useState(false);
  useEffect(() => { if (closeAsked && result) onDone(result.correct, result.items); }, [closeAsked, result]); // eslint-disable-line react-hooks/exhaustive-deps
  const { items, pool } = useMemo(() => {
    const vocabItems = words.map((v) => vocabShortExercise(v, "plen"));        // Polish word → type the English word
    const gaps = shuffle(lessonExercises.filter((e) => e.task_type === "gap"));
    const choice = shuffle(lessonExercises.filter((e) => e.task_type !== "gap"));
    const grammar = [...gaps.slice(0, 4), ...choice.slice(0, 1)];
    const extra = [...shuffle(uoe.filter((e) => e.task_type === "word_formation")).slice(0, 1), ...shuffle(uoe.filter((e) => e.task_type === "mc_cloze")).slice(0, 1), ...shuffle(uoe.filter((e) => e.task_type === "open_cloze")).slice(0, 1)];
    const mixed: Exercise[] = []; // word, word, grammar, … then the Use of English items
    let g = 0; vocabItems.forEach((v, i) => { mixed.push(v); if (i % 2 === 1 && g < grammar.length) mixed.push(grammar[g++]); });
    while (g < grammar.length) mixed.push(grammar[g++]);
    mixed.push(...extra);
    const used = new Set(mixed.map((x) => x.id));
    return { items: mixed, pool: lessonExercises.filter((e) => !used.has(e.id)) };
  }, [words, lessonExercises, uoe]);
  async function onItemDone(ex: Exercise, o: { firstTry: boolean; hinted: boolean; attempts: number }) {
    if (isVocabId(ex.id)) await saveFlashcardResult(vocabIdOf(ex.id), o.firstTry, o.hinted, o.attempts, "daily");
  }
  return <div>
    {header("Ćwiczenia", `Krótkie odpowiedzi: polskie słowo → angielskie, pojedyncze luki i formy z tematu „${lesson?.title ?? "gramatyka"}”. Enter sprawdza; po błędzie wpisujesz poprawną odpowiedź jeszcze raz.`)}
    {errBox}
    <PracticeSession title="Ćwiczenia" items={items} pool={pool} source="daily:exercises" onItemDone={onItemDone} afterAnswer={wordCard(words)}
      onFinish={(correct, total) => setResult({ correct, items: total })} finishLabel="Dalej: Powtórka →" onClose={() => setCloseAsked(true)} />
  </div>;
}

/** Flashcards of today's words in a new form + due words and open mistakes from previous days. */
function RevisionStage({ words, header, onDone, errBox }: { words: Vocab[]; header: HeaderFn; onDone: (correct: number, items: number) => void; errBox: ReactNode }) {
  const [result, setResult] = useState<{ correct: number; items: number } | null>(null);
  const [closeAsked, setCloseAsked] = useState(false);
  useEffect(() => { if (closeAsked && result) onDone(result.correct, result.items); }, [closeAsked, result]); // eslint-disable-line react-hooks/exhaustive-deps
  const [started, setStarted] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const built = useAsync(async () => {
    const todayIds = new Set(words.map((w) => w.id));
    const todays = shuffle(words).slice(0, 6).map((v, i) => vocabShortExercise(v, i % 2 ? "gap" : "def")); // same words, another form
    const dueWords = (await pickFlashcards({ n: 10, mode: "due" })).filter((v) => !todayIds.has(v.id)).slice(0, 3);
    const due = dueWords.map((v) => vocabShortExercise(v, "plen"));
    const midnight = new Date(`${today()}T00:00:00`).getTime() - 2 * 3600e3; // conservative: anything clearly before today
    const old = (await listMistakes()).filter((m) => !m.mastered && new Date(m.created_at).getTime() < midnight).sort((a, b) => b.times - a.times);
    const exIds = [...new Set(old.map((m) => m.exercise_id).filter((x): x is string => !!x))].slice(0, 3);
    const fromExercises = exIds.length ? (await exercisesByIds(exIds)).filter(isShortTask) : [];
    const vocabMistakeIds = old.map((m) => m.vocab_id).filter((x): x is string => !!x && !todayIds.has(x)).slice(0, 3 - fromExercises.length);
    const vocabMistakeWords = vocabMistakeIds.length ? (await listVocab({ ids: vocabMistakeIds, limit: vocabMistakeIds.length })).rows : [];
    const fromVocab = vocabMistakeWords.map((v) => vocabShortExercise(v, "plen"));
    const uniq = new Map<string, Exercise>(); [...todays, ...due, ...fromExercises, ...fromVocab].forEach((x) => uniq.set(x.id, x));
    return { items: [...uniq.values()], fromPast: due.length + fromExercises.length + fromVocab.length, vocab: [...words, ...dueWords, ...vocabMistakeWords] };
  }, [words]);
  async function onItemDone(ex: Exercise, o: { firstTry: boolean; hinted: boolean; attempts: number }) {
    if (isVocabId(ex.id)) await saveFlashcardResult(vocabIdOf(ex.id), o.firstTry, o.hinted, o.attempts, "daily-revision");
  }
  if (built.loading) return <Loading />;
  if (built.error || !built.data) return <ErrorBox error={built.error ?? ""} onRetry={built.reload} />;
  const visibleVocab = [...new Map(built.data.vocab.map((w) => [w.id, w])).values()].filter((w) => !removedIds.has(w.id));
  const revItems = built.data.items.filter((x) => !(isVocabId(x.id) && removedIds.has(vocabIdOf(x.id))));
  if (!started) return <WordPreview words={visibleVocab} title="Powtórka – hasła"
    onRemove={(v) => setRemovedIds((s) => new Set([...s, v.id]))} onRestore={(v) => setRemovedIds((s) => { const n = new Set(s); n.delete(v.id); return n; })}
    lead="Te słowa i wyrażenia pojawią się teraz w fiszkach: słowa dnia oraz zaległe powtórki i błędy z poprzednich dni. Kliknij hasło, żeby zobaczyć pełną kartę."
    startLabel="Zaczynamy powtórkę →" onStart={() => { setStarted(true); window.scrollTo(0, 0); }} />;
  return <div>
    {header("Powtórka", built.data.fromPast ? `Fiszki ze słowami dnia oraz ${built.data.fromPast} pytań z poprzednich dni (powtórki i Twoje błędy).` : "Fiszki ze słowami dnia. Nie masz zaległych powtórek ani błędów z poprzednich dni.")}
    {errBox}
    <PracticeSession title="Powtórka" items={revItems} source="daily:revision" onItemDone={onItemDone} afterAnswer={wordCard(built.data.vocab)}
      onFinish={(correct, total) => setResult({ correct, items: total })} finishLabel="Zobacz podsumowanie →" onClose={() => setCloseAsked(true)} />
  </div>;
}

function Summary({ plan, words, lesson, header, onClose, onRepeat, onMore }: { plan: Plan; words: Vocab[]; lesson: GrammarLesson | null; header: HeaderFn; onClose: () => void; onRepeat: (k: StageKey) => void; onMore: () => void }) {
  const extra = plan.stages.extra ?? [];
  const ex = plan.stages.exercises, rev = plan.stages.revision;
  const minutes = Math.round(STAGES.reduce((s, x) => s + (plan.stages[x.key]?.minutes ?? 0), 0));
  const extraMinutes = Math.round(extra.reduce((s, r) => s + r.minutes, 0));
  const pct = (s?: StageState) => (s?.items ? Math.round(((s.correct ?? 0) / s.items) * 100) : null);
  return <div>
    {header("Lekcja ukończona", "Wszystkie cztery etapy na dziś są zrobione. Wynik zapisano na Twoim koncie.")}
    <div className="grid gap-3 sm:grid-cols-2">
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Słownictwo</div><div className="mt-1 font-display text-2xl font-extrabold">{words.length} słów</div><div className="mt-1 text-sm text-ink-soft">{words.map((w) => w.term).join(", ")}</div></Card>
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Gramatyka</div><div className="mt-1 font-display text-lg font-bold">{lesson?.title ?? "–"}</div>{lesson && <Link className="mt-1 inline-block text-sm text-accent underline dark:text-accent-dark" to={`/grammar/${lesson.slug}`}>Test z tej lekcji</Link>}</Card>
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Ćwiczenia</div><div className="mt-1 font-display text-2xl font-extrabold">{ex?.correct ?? 0} / {ex?.items ?? 0}</div><div className="text-sm text-ink-soft">za pierwszym razem{pct(ex) !== null ? ` · ${pct(ex)}%` : ""}</div></Card>
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Powtórka</div><div className="mt-1 font-display text-2xl font-extrabold">{rev?.correct ?? 0} / {rev?.items ?? 0}</div><div className="text-sm text-ink-soft">za pierwszym razem{pct(rev) !== null ? ` · ${pct(rev)}%` : ""}</div></Card>
    </div>
    <Card className="mt-3"><div className="flex flex-wrap items-center justify-between gap-2"><span>Czas nauki dziś (lekcja): <b>{minutes} min</b></span><Pill tone="ok">plan dnia: ok. 20 min</Pill></div>
      <p className="mt-2 text-sm text-ink-soft">Błędy z dzisiejszej lekcji trafiły do <Link className="underline" to="/mistakes">Mistake Notebook</Link> i wrócą w jutrzejszej powtórce. Jutro czekają nowe słowa i kolejne zagadnienie.</p>
      {extra.length > 0 && <p className="mt-2 text-sm" data-testid="extra-summary">Nauka dodatkowa: <b>{extra.length} {extra.length === 1 ? "runda" : "rundy"}</b>, {extra.reduce((s, r) => s + r.vocab_ids.length, 0)} nowych słów, {extra.reduce((s, r) => s + r.correct, 0)}/{extra.reduce((s, r) => s + r.items, 0)} za pierwszym razem · {extraMinutes} min</p>}
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="quiet" size="sm" onClick={() => onRepeat("exercises")}>Powtórz ćwiczenia</Button><Button variant="quiet" size="sm" onClick={() => onRepeat("revision")}>Powtórz powtórkę</Button></div></Card>
    <Card className="mt-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-display text-lg font-bold">Masz jeszcze czas?</div><div className="text-sm text-ink-soft">Ucz się dalej: 8 kolejnych słów i krótkie ćwiczenia (ok. 10 min). Dzienny plan jest już zaliczony – to nauka dodatkowa.</div></div>
      <Button variant="quiet" onClick={onMore} data-testid="learn-more">Ucz się dalej →</Button></div></Card>
    <NextBar label="Zakończ i wróć do pulpitu" onClick={onClose} />
  </div>;
}

/** Full word card shown after a word has been answered (translation, pronunciation, example, synonyms, collocations, notes). */
function wordCard(words: Vocab[]) {
  const byId = new Map(words.map((w) => [w.id, w]));
  return (ex: Exercise) => {
    const v = isVocabId(ex.id) ? byId.get(vocabIdOf(ex.id)) : undefined;
    if (!v) return null;
    return <div data-testid="word-card"><Card className="mt-1"><div className="mb-3 flex flex-wrap items-baseline gap-2"><h3 className="font-display text-xl font-bold">{v.term}</h3>{v.pos && <Pill>{v.pos}</Pill>}<Pill>{v.level}</Pill></div><VocabDetail v={v} /></Card></div>;
  };
}

/** "Ucz się dalej": optional extra round after the daily plan – new words, read them, then short typed answers. */
function ExtraRoundView({ plan, lessonExercises, uoe, header, onDone, onCancel }: { plan: Plan; lessonExercises: Exercise[]; uoe: Exercise[]; header: HeaderFn; onDone: (r: { vocab_ids: string[]; items: number; correct: number }) => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<"read" | "practice">("read");
  const [result, setResult] = useState<{ correct: number; items: number } | null>(null);
  const [closeAsked, setCloseAsked] = useState(false);
  const built = useAsync(async () => {
    const seen = new Set([...plan.vocab_ids, ...(plan.stages.extra ?? []).flatMap((r) => r.vocab_ids)]);
    let words = (await pickFlashcards({ n: 20, mode: "new" })).filter((w) => !seen.has(w.id)).slice(0, 8);
    if (words.length < 4) words = [...words, ...(await pickFlashcards({ n: 20, mode: "smart" })).filter((w) => !seen.has(w.id) && !words.some((x) => x.id === w.id))].slice(0, 8);
    return words;
  }, []);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const words = useMemo(() => (built.data ?? []).filter((w) => !removedIds.has(w.id)), [built.data, removedIds]);
  useEffect(() => { if (closeAsked && result) onDone({ vocab_ids: words.map((w) => w.id), ...result }); }, [closeAsked, result]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => {
    const vocab = words.flatMap((v, i) => [vocabShortExercise(v, "plen"), ...(i % 2 ? [vocabShortExercise(v, "gap")] : [])]);
    const gram = shuffle(lessonExercises).slice(0, 2), wf = shuffle(uoe.filter((e) => e.task_type === "word_formation")).slice(0, 1);
    return shuffle([...vocab, ...gram, ...wf]);
  }, [words, lessonExercises, uoe]);
  async function onItemDone(ex: Exercise, o: { firstTry: boolean; hinted: boolean; attempts: number }) {
    if (isVocabId(ex.id)) await saveFlashcardResult(vocabIdOf(ex.id), o.firstTry, o.hinted, o.attempts, "daily-extra");
  }
  if (built.loading) return <Loading />;
  if (built.error) return <ErrorBox error={built.error} onRetry={built.reload} />;
  if (!words.length) return <div>{header("Ucz się dalej", "")}<Feedback tone="info" title="Wszystkie słowa z bazy są już w nauce">Nie ma więcej nowych haseł – powtarzaj je w fiszkach.</Feedback><NextBar label="Wróć do podsumowania" onClick={onCancel} /></div>;
  if (phase === "read") return <div data-testid="extra-read">
    {header("Ucz się dalej – nowe słowa", `Kolejne ${words.length} haseł. Przeczytaj je, a potem przećwicz krótkimi odpowiedziami.`)}
    <ol className="flex flex-col gap-3">{words.map((v, i) => <li key={v.id}><Card><div className="mb-3 flex flex-wrap items-baseline gap-2"><span className="font-mono text-sm text-ink-soft">{i + 1}</span><h2 className="font-display text-xl font-bold">{v.term}</h2>{v.pos && <Pill>{v.pos}</Pill>}<Pill>{v.level}</Pill>
      <Button size="sm" variant="ghost" className="ml-auto" data-testid="vocab-remove" onClick={async () => { await hideWord(v.id, "known"); setRemovedIds((s) => new Set([...s, v.id])); }}>Wyrzuć</Button></div><VocabDetail v={v} /></Card></li>)}</ol>
    <div className="mt-3"><Button variant="ghost" size="sm" onClick={onCancel}>Anuluj</Button></div>
    <NextBar label="Znam już te słowa – ćwicz" onClick={() => { setPhase("practice"); window.scrollTo(0, 0); }} />
  </div>;
  return <div data-testid="extra-practice">
    {header("Ucz się dalej – ćwiczenia", "Krótkie odpowiedzi: polskie słowo → angielskie i pojedyncze luki. Po każdym słowie zobaczysz jego pełną kartę.")}
    <PracticeSession title="Nauka dodatkowa" items={items} source="daily:extra" onItemDone={onItemDone} afterAnswer={wordCard(words)}
      onFinish={(correct, total) => setResult({ correct, items: total })} finishLabel="Wróć do podsumowania →" onClose={() => setCloseAsked(true)} />
  </div>;
}
