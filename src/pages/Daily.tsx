import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, unwrap } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { exercisesByIds, getLesson, lessonProgress, listExercises, listLessons, listMistakes, pickFlashcards, saveFlashcardResult, shuffle } from "../lib/api";
import { vocabToExercise } from "../lib/vocabTest";
import type { Exercise, Vocab } from "../lib/types";
import { PracticeSession } from "../components/PracticeSession";
import { TestRunner } from "../components/TestRunner";
import { Button, Card, ErrorBox, Feedback, Loading, PageHeader, Pill, Progress } from "../components/ui";

/**
 * Daily lesson: about 20 minutes, no timer. Four blocks (vocabulary, grammar, Use of English, mistake review),
 * then a review test of everything practised today. Completion is stored in the database (learning_sessions with
 * kind "daily:*", test_attempts with kind "daily"), so the plan continues on any device.
 */
type BlockKey = "vocab" | "grammar" | "uoe" | "review";
const BLOCKS: { key: BlockKey; title: string; what: string; minutes: number }[] = [
  { key: "vocab", title: "Słownictwo", what: "10 haseł: najpierw powtórki z systemu powtórek, potem nowe słowa", minutes: 5 },
  { key: "grammar", title: "Gramatyka", what: "6 ćwiczeń z bieżącej lekcji", minutes: 5 },
  { key: "uoe", title: "Use of English", what: "6 zadań w formacie egzaminu (Part 1–4)", minutes: 5 },
  { key: "review", title: "Powtórka błędów", what: "Twoje nieopanowane błędy (albo trudne słowa, jeśli nie masz błędów)", minutes: 5 },
];
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const isVocabId = (id: string) => id.startsWith("v:");
const vocabIdOf = (id: string) => id.split(":")[1];

async function todayStatus() {
  const day = today();
  const sessions = unwrap(await supabase.from("learning_sessions").select("kind").eq("day", day).like("kind", "daily:%")) as { kind: string }[];
  const start = new Date(`${day}T00:00:00`); // local midnight is close enough for "today" in Poland; day column is authoritative for blocks
  const tests = unwrap(await supabase.from("test_attempts").select("id,score,max_score,created_at").eq("kind", "daily").gte("created_at", new Date(start.getTime() - 2 * 3600e3).toISOString())) as { id: string; score: number; max_score: number; created_at: string }[];
  const todaysTest = tests.find((t) => new Date(t.created_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }) === day) ?? null;
  return { done: new Set(sessions.map((s) => s.kind.replace("daily:", "") as BlockKey)), test: todaysTest };
}

async function buildBlock(key: BlockKey): Promise<{ items: Exercise[]; pool: Exercise[]; note?: string; vocab?: Vocab[] }> {
  if (key === "vocab") {
    const words = await pickFlashcards({ n: 10, mode: "smart" });
    return { items: words.map((v, i) => vocabToExercise(v, i % 2 ? "gap" : "plen")), pool: [], vocab: words };
  }
  if (key === "grammar") {
    const [lessons, lp] = await Promise.all([listLessons(), lessonProgress()]);
    if (!lessons.length) return { items: [], pool: [] };
    const prog = new Map(lp.map((p) => [p.lesson_id, p]));
    const next = lessons.find((l) => !prog.get(l.id)?.completed_at)
      ?? [...lessons].sort((a, b) => ratio(prog.get(a.id)) - ratio(prog.get(b.id)))[0];
    const { exercises } = await getLesson(next.slug);
    const practice = shuffle(exercises.filter((e: Exercise) => e.position < 100));
    return { items: practice.slice(0, 6), pool: practice.slice(6), note: next.title };
  }
  if (key === "uoe") {
    const all = await listExercises({ module: "use_of_english", limit: 1000 });
    const by = (t: string) => shuffle(all.filter((e) => e.task_type === t));
    const items = shuffle([...by("mc_cloze").slice(0, 2), ...by("open_cloze").slice(0, 2), ...by("word_formation").slice(0, 1), ...by("kwt").slice(0, 1)]);
    const used = new Set(items.map((x) => x.id));
    return { items, pool: all.filter((e) => !used.has(e.id)) };
  }
  const open = (await listMistakes()).filter((m) => !m.mastered).sort((a, b) => b.times - a.times);
  const exIds = [...new Set(open.map((m) => m.exercise_id).filter((x): x is string => !!x))].slice(0, 6);
  let items = exIds.length ? await exercisesByIds(exIds) : [];
  if (items.length < 6) {
    let hard = await pickFlashcards({ n: 6 - items.length, mode: "hard" });
    if (!hard.length) hard = await pickFlashcards({ n: 6 - items.length, mode: "smart" });
    items = [...items, ...hard.map((v) => vocabToExercise(v, "sentence"))];
  }
  return { items: shuffle(items).slice(0, 6), pool: [], note: open.length ? `${open.length} nieopanowanych błędów w notatniku` : "brak błędów – trudne słowa" };
}
const ratio = (p?: { test_score: number | null; test_max: number | null }) => (p?.test_max ? Number(p.test_score) / Number(p.test_max) : 0);

export default function Daily() {
  const status = useAsync(todayStatus);
  const [active, setActive] = useState<{ key: BlockKey; items: Exercise[]; pool: Exercise[]; note?: string } | "test" | null>(null);
  const [building, setBuilding] = useState<BlockKey | "test" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const seen = useRef<{ items: Exercise[]; wrong: Set<string>; vocab: Vocab[] }>({ items: [], wrong: new Set(), vocab: [] });
  const [testItems, setTestItems] = useState<Exercise[]>([]);

  if (status.loading) return <Loading />;
  if (status.error || !status.data) return <ErrorBox error={status.error ?? "Brak danych"} onRetry={status.reload} />;
  const { done, test } = status.data;
  const doneCount = BLOCKS.filter((b) => done.has(b.key)).length;
  const allBlocks = doneCount === BLOCKS.length;

  async function start(key: BlockKey) {
    setErr(null); setBuilding(key);
    try {
      const b = await buildBlock(key);
      if (!b.items.length) { setErr("W bazie nie ma jeszcze materiałów do tego bloku."); return; }
      if (b.vocab) seen.current.vocab.push(...b.vocab);
      setActive({ key, ...b });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBuilding(null); }
  }
  async function startTest() {
    setErr(null); setBuilding("test");
    try {
      const s = seen.current;
      // review test: today's words in a new form, today's wrong answers, plus fresh items of the same types
      const vocab = s.vocab.length ? s.vocab : await pickFlashcards({ n: 4, mode: "due" });
      const vocabItems = shuffle(vocab).slice(0, 5).map((v, i) => vocabToExercise(v, i % 2 ? "sentence" : "gap"));
      const wrong = s.items.filter((x) => s.wrong.has(x.id) && !isVocabId(x.id)).slice(0, 5);
      const nonVocab = s.items.filter((x) => !isVocabId(x.id) && !s.wrong.has(x.id));
      let rest = shuffle(nonVocab).slice(0, Math.max(0, 15 - vocabItems.length - wrong.length));
      if (!s.items.length) { // blocks were done earlier / on another device – build a fresh mixed review
        const [g, u] = await Promise.all([buildBlock("grammar"), buildBlock("uoe")]);
        rest = [...g.items.slice(0, 4), ...u.items.slice(0, 4)];
      }
      const uniq = new Map<string, Exercise>(); [...wrong, ...vocabItems, ...rest].forEach((x) => uniq.set(x.id, x));
      const items = shuffle([...uniq.values()]).slice(0, 15);
      if (!items.length) { setErr("Brak materiałów do testu."); return; }
      setTestItems(items); setActive("test");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBuilding(null); }
  }
  async function onItemDone(ex: Exercise, o: { firstTry: boolean; hinted: boolean; attempts: number }) {
    seen.current.items.push(ex);
    if (!o.firstTry) seen.current.wrong.add(ex.id);
    if (isVocabId(ex.id)) await saveFlashcardResult(vocabIdOf(ex.id), o.firstTry, o.hinted, o.attempts, "daily");
  }

  if (active === "test") return <div>
    <Button variant="ghost" size="sm" onClick={() => { setActive(null); status.reload(); }}>← Wróć do planu dnia</Button>
    <PageHeader eyebrow="Codzienna lekcja · krok 5" title="Test powtórkowy" lead="Sprawdzenie wszystkiego z dzisiejszej lekcji. Odpowiedzi poznasz na końcu, a błędy poprawisz od razu po teście." />
    <TestRunner title="Test powtórkowy – codzienna lekcja" kind="daily" items={testItems} />
  </div>;
  if (active) {
    const meta = BLOCKS.find((b) => b.key === active.key)!;
    return <div>
      <PageHeader eyebrow={`Codzienna lekcja · krok ${BLOCKS.indexOf(meta) + 1} z 5`} title={meta.title} lead={active.note} />
      <PracticeSession title={meta.title} items={active.items} pool={active.pool} source={`daily:${active.key}`} onItemDone={onItemDone}
        finishLabel="Wróć do planu dnia →" onClose={() => { setActive(null); status.reload(); }} />
    </div>;
  }

  return <div className="max-w-3xl">
    <PageHeader eyebrow={new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" })} title="Codzienna lekcja"
      lead="Około 20 minut bez stopera: cztery krótkie bloki i test powtórkowy na koniec. Błędy poprawiasz od razu, a postęp zapisuje się na Twoim koncie." />
    <Card className="mb-4"><div className="flex items-center justify-between gap-3"><b>{test ? "Lekcja ukończona" : `Ukończone bloki: ${doneCount} / ${BLOCKS.length}`}</b>{test && <Pill tone="ok">test: {test.score}/{test.max_score}</Pill>}</div>
      <div className="mt-3"><Progress value={((doneCount + (test ? 1 : 0)) / 5) * 100} tone={test ? "ok" : "accent"} /></div></Card>
    {err && <div className="mb-4"><Feedback tone="warn">{err}</Feedback></div>}
    <ol className="flex flex-col gap-3">
      {BLOCKS.map((b, i) => {
        const isDone = done.has(b.key);
        const isNext = !isDone && BLOCKS.slice(0, i).every((x) => done.has(x.key));
        return <li key={b.key}><Card className={isNext ? "ring-2 ring-accent dark:ring-accent-dark" : ""}><div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-ink-soft">{i + 1}</span>
          <div className="min-w-0 flex-1"><div className="font-display text-lg font-bold">{b.title} <span className="text-sm font-normal text-ink-soft">· ok. {b.minutes} min</span></div><div className="text-sm text-ink-soft">{b.what}</div></div>
          {isDone ? <Pill tone="ok">zrobione</Pill> : null}
          <Button variant={isNext ? "primary" : "quiet"} disabled={!!building} onClick={() => start(b.key)} data-testid={`daily-${b.key}`}>{building === b.key ? "Przygotowuję…" : isDone ? "Powtórz" : "Zacznij"}</Button>
        </div></Card></li>;
      })}
      <li><Card className={allBlocks && !test ? "ring-2 ring-accent dark:ring-accent-dark" : ""}><div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm font-bold text-ink-soft">5</span>
        <div className="min-w-0 flex-1"><div className="font-display text-lg font-bold">Test powtórkowy</div><div className="text-sm text-ink-soft">Wszystko z dzisiejszej lekcji w nowej kolejności i formie, z wynikiem zapisanym w historii testów</div></div>
        {test && <Pill tone="ok">zrobione</Pill>}
        <Button variant={allBlocks && !test ? "primary" : "quiet"} disabled={!!building || (!allBlocks && !test)} onClick={startTest} data-testid="daily-test">{building === "test" ? "Przygotowuję…" : test ? "Powtórz test" : "Rozpocznij test"}</Button>
      </div>{!allBlocks && !test && <p className="mt-2 text-sm text-ink-soft">Test odblokuje się po czterech blokach.</p>}</Card></li>
    </ol>
    {test && <div className="mt-4"><Feedback tone="ok" title="Dzisiejsza lekcja jest ukończona">Wróć jutro po nowy plan. Możesz też ćwiczyć dalej w <Link className="font-bold underline" to="/flashcards">fiszkach</Link> lub <Link className="font-bold underline" to="/mistakes">Mistake Notebook</Link>.</Feedback></div>}
  </div>;
}

