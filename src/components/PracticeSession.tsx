import { useRef, useState } from "react";
import { ExerciseTask, type Outcome } from "./Correction";
import { Button, Card, Feedback, Progress } from "./ui";
import type { Exercise } from "../lib/types";
import { logSession, recordMistake } from "../lib/api";
import { mistakeCategory, type MistakeCategory } from "../lib/answer";

export function categoryFor(ex: Exercise): MistakeCategory {
  if (ex.task_type === "word_formation") return "word_formation";
  if (ex.module === "grammar" || ex.task_type === "kwt" || ex.task_type === "error") return "grammar";
  if (ex.topic === "phrasal") return "phrasal_verbs";
  if (ex.topic === "collocations") return "collocations";
  return ex.module === "use_of_english" ? "grammar" : "vocabulary";
}
export function promptText(ex: Exercise) { const p = ex.prompt; return ex.task_type === "kwt" ? `${p.question} → (${p.keyword}) ${p.sentence2}` : p.question; }

/** Runs exercises one by one with the mandatory correction loop; adds a similar follow-up task after each mistake. */
export function PracticeSession({ title, items, pool = [], source, onFinish, onClose }: {
  title: string; items: Exercise[]; pool?: Exercise[]; source: string; onFinish?: (firstTryCorrect: number, total: number) => void; onClose?: () => void;
}) {
  const [queue, setQueue] = useState<(Exercise & { followUp?: boolean })[]>(items);
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ first: 0, fixed: 0, total: 0 });
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const started = useRef(Date.now());
  const used = useRef(new Set(items.map((x) => x.id)));
  const finished = i >= queue.length;
  const logged = useRef(false);

  async function handleDone(o: Outcome) {
    const ex = queue[i];
    setDone(o);
    setStats((s) => ({ first: s.first + (o.firstTry ? 1 : 0), fixed: s.fixed + (o.firstTry ? 0 : 1), total: s.total + 1 }));
    if (!o.firstTry) {
      const similar = pool.find((p) => !used.current.has(p.id) && p.task_type === ex.task_type && (p.topic === ex.topic || p.grammar_lesson_id === ex.grammar_lesson_id))
        ?? pool.find((p) => !used.current.has(p.id) && (p.topic === ex.topic || p.grammar_lesson_id === ex.grammar_lesson_id));
      if (similar && !ex.followUp) { used.current.add(similar.id); setQueue((q) => [...q, { ...similar, followUp: true }]); }
      try {
        await recordMistake({ category: o.diagnosis ? mistakeCategory(o.diagnosis, categoryFor(ex), ex.answers[0]) : categoryFor(ex), source, prompt: promptText(ex), user_answer: o.firstAnswer, correct: ex.answers[0], explanation: ex.explanation, exercise_id: ex.id });
      } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
    }
  }
  async function next() {
    setDone(null);
    const ni = i + 1; setI(ni);
    if (ni >= queue.length && !logged.current) {
      logged.current = true;
      const s = stats;
      try { await logSession(source, s.total, s.first, (Date.now() - started.current) / 60000); } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
      onFinish?.(s.first, s.total);
    }
  }
  if (!queue.length) return <Feedback tone="info" title="Brak zadań">W tej kategorii nie ma jeszcze ćwiczeń.</Feedback>;
  if (finished) return <Card><div className="flex flex-col gap-3">
    <div className="text-xs font-bold uppercase tracking-widest text-ink-soft">{title} · wynik</div>
    <div className="font-display text-3xl font-extrabold">{stats.first} / {stats.total} za pierwszym razem</div>
    <Progress value={(stats.first / Math.max(1, stats.total)) * 100} tone={stats.first / Math.max(1, stats.total) >= 0.75 ? "ok" : "warn"} />
    {stats.fixed > 0 && <p className="text-ink-soft">{stats.fixed} zadań poprawionych samodzielnie po błędzie – trafiły do Mistake Notebook.</p>}
    {saveErr && <Feedback tone="warn" title="Nie wszystko zapisało się w bazie">{saveErr}</Feedback>}
    {onClose && <div><Button variant="quiet" onClick={onClose}>Wróć</Button></div>}
  </div></Card>;
  const ex = queue[i];
  return <div className="flex max-w-3xl flex-col gap-4">
    <div className="flex items-center justify-between gap-3 text-sm text-ink-soft"><span className="font-bold uppercase tracking-widest">{title} · {i + 1} / {queue.length}{ex.followUp ? " · zadanie sprawdzające" : ""}</span>{onClose && <Button size="sm" variant="ghost" onClick={onClose}>Zamknij</Button>}</div>
    <Progress value={(i / queue.length) * 100} />
    <Card><ExerciseTask key={ex.id + ":" + i} ex={ex} onDone={handleDone} /></Card>
    {saveErr && <Feedback tone="warn" title="Problem z zapisem">{saveErr}</Feedback>}
    {done && <div><Button onClick={next} autoFocus data-testid="next">Dalej →</Button></div>}
  </div>;
}
