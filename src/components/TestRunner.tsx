import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Exercise } from "../lib/types";
import { gradeExercise, withGap } from "./Correction";
import { PracticeSession, categoryFor, promptText } from "./PracticeSession";
import { Button, Card, Feedback, Pill, Progress, answerCls, cx } from "./ui";
import { logSession, recordMistake, saveAttempt, shuffle } from "../lib/api";
import { diagnose, mistakeCategory } from "../lib/answer";

export type TestResult = { score: number; max: number; items: { ex: Exercise; answer: string; ok: boolean }[]; durationSec: number };

function fmt(sec: number) { const s = Math.max(0, Math.floor(sec)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }

/** Question input in test mode – no feedback until the end. */
export function TestQuestion({ ex, value, onChange, n }: { ex: Exercise; value: string; onChange: (v: string) => void; n: number }) {
  const p = ex.prompt;
  const options = useMemo(() => (ex.task_type === "tfng" ? p.options ?? [] : shuffle(p.options ?? [])), [ex.id]); // eslint-disable-line
  const choice = ["mc", "mc_cloze", "tfng", "matching"].includes(ex.task_type);
  return <div className="flex gap-3 border-t border-black/5 py-4 first:border-0 dark:border-white/5">
    <span className="pt-0.5 font-mono text-sm font-bold text-ink-soft">{n}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="text-sm text-ink-soft">{ex.instruction}</div>
      <div>{ex.task_type === "kwt" ? <>{p.question}<div className="my-2"><span className="rounded border-2 border-current px-2 py-0.5 font-mono text-sm font-bold">{p.keyword}</span></div>{withGap(p.sentence2 ?? "")}</> : <>{withGap(p.question)}{p.base && <b className="ml-1 font-mono">({p.base})</b>}</>}</div>
      {choice ? <div className="flex flex-col gap-1.5">{options.map((o, k) => <label key={o} className={cx("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2", value === o ? "border-accent bg-accent-soft dark:border-accent-dark dark:bg-[#232E55]" : "border-black/15 dark:border-white/15")}>
        <input type="radio" className="mt-1" name={ex.id} checked={value === o} onChange={() => onChange(o)} /><span><b className="mr-1 font-mono text-xs">{"ABCDEF"[k]}</b>{o}</span></label>)}</div>
        : <input className={answerCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ex.task_type === "kwt" ? "2–5 słów" : ex.task_type === "translation" ? "English translation" : "odpowiedź"} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label={`Odpowiedź ${n}`} />}
    </div>
  </div>;
}

export function TestRunner({ title, kind, items, timeLimitSec, intro, onFinished, save = true, header }: {
  title: string; kind: string; items: Exercise[]; timeLimitSec?: number | null; intro?: ReactNode; save?: boolean; header?: ReactNode;
  onFinished?: (r: TestResult) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!timeLimitSec || result) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [timeLimitSec, result]);
  const left = timeLimitSec ? timeLimitSec - (now - started.current) / 1000 : null;
  useEffect(() => { if (left !== null && left <= 0 && !result) finish(); }); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish() {
    if (result) return;
    const graded = items.map((ex) => ({ ex, answer: answers[ex.id] ?? "", ok: gradeExercise(ex, answers[ex.id]) }));
    const r: TestResult = { score: graded.filter((g) => g.ok).length, max: items.length, items: graded, durationSec: Math.round((Date.now() - started.current) / 1000) };
    setResult(r); setConfirm(false); window.scrollTo(0, 0);
    onFinished?.(r);
    if (!save) return;
    try {
      await saveAttempt({ kind, title, score: r.score, max_score: r.max, duration_sec: r.durationSec, details: { wrong: graded.filter((g) => !g.ok).map((g) => ({ id: g.ex.id, answer: g.answer })) } });
      for (const g of graded.filter((x) => !x.ok)) {
        const d = ["mc", "mc_cloze", "tfng", "matching"].includes(g.ex.task_type) ? null : diagnose(g.answer, g.ex.answers);
        await recordMistake({ category: d ? mistakeCategory(d, categoryFor(g.ex), g.ex.answers[0]) : categoryFor(g.ex), source: `test:${kind}`, prompt: promptText(g.ex), user_answer: g.answer, correct: g.ex.answers[0], explanation: g.ex.explanation, exercise_id: g.ex.id });
      }
      await logSession(`test:${kind}`, r.max, r.score, r.durationSec / 60);
      setSaved(true);
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
  }
  if (fixing && result) return <PracticeSession title="Poprawa błędów" items={result.items.filter((g) => !g.ok).map((g) => g.ex)} source={`fix:${kind}`} onClose={() => setFixing(false)} />;
  if (result) {
    const pct = Math.round((result.score / result.max) * 100);
    return <div className="flex max-w-3xl flex-col gap-4">
      {header}
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">{title} · wynik</div>
        <div className="mt-1 font-display text-4xl font-extrabold">{pct}%</div>
        <div className="mt-1 text-ink-soft">{result.score} poprawnych, {result.max - result.score} błędnych · czas {fmt(result.durationSec)}</div>
        <div className="mt-3"><Progress value={pct} tone={pct >= 70 ? "ok" : pct >= 50 ? "warn" : "bad"} /></div>
        {saveErr ? <div className="mt-3"><Feedback tone="warn" title="Wynik nie zapisał się w historii">{saveErr}</Feedback></div> : save && <p className="mt-2 text-sm text-ink-soft" aria-live="polite">{saved ? "Wynik zapisano w historii, a błędy w Mistake Notebook." : "Zapisywanie wyniku…"}</p>}
        {result.score < result.max && <div className="mt-3"><Button onClick={() => setFixing(true)}>Popraw błędne odpowiedzi ({result.max - result.score})</Button></div>}
      </Card>
      <Card><h2 className="font-display text-lg font-bold">Odpowiedzi i wyjaśnienia</h2>
        <ol className="mt-2">{result.items.map((g, k) => <li key={g.ex.id} className="border-t border-black/5 py-3 first:border-0 dark:border-white/5">
          <div className="flex items-start gap-2"><span className="font-mono text-sm text-ink-soft">{k + 1}</span><div className="min-w-0 flex-1"><div className="text-sm">{promptText(g.ex)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm"><Pill tone={g.ok ? "ok" : "bad"}>{g.ok ? "dobrze" : "błąd"}</Pill>{!g.ok && <span>Twoja odpowiedź: <s>{g.answer || "–"}</s></span>}<span>Poprawnie: <b>{g.ex.answers[0]}</b></span></div>
            <div className="mt-1 text-sm text-ink-soft">{g.ex.explanation}</div>
            {!g.ok && g.ex.distractor_notes?.[g.answer] && <div className="text-sm text-ink-soft">Dlaczego nie „{g.answer}”: {g.ex.distractor_notes[g.answer]}</div>}
          </div></div></li>)}</ol></Card>
    </div>;
  }
  const answered = items.filter((x) => (answers[x.id] ?? "").trim()).length;
  return <div className="flex max-w-3xl flex-col gap-4">
    {header}
    <div className="sticky top-[57px] z-10 -mx-1 flex items-center justify-between gap-3 rounded-lg bg-paper/95 px-1 py-2 backdrop-blur dark:bg-[#0E1320]/95">
      <span className="text-sm font-bold">{answered} / {items.length} odpowiedzi</span>
      {left !== null && <span className={cx("rounded-md px-2.5 py-1 font-mono font-bold", left < 120 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-black/5 dark:bg-white/10")} aria-live="polite">{fmt(left)}</span>}
    </div>
    {intro}
    <Card>{items.map((ex, k) => <TestQuestion key={ex.id} ex={ex} n={k + 1} value={answers[ex.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [ex.id]: v }))} />)}</Card>
    <div className="flex flex-wrap items-center gap-2">{confirm ? <><span>{items.length - answered ? `Bez odpowiedzi: ${items.length - answered}. ` : ""}Zakończyć test?</span><Button onClick={finish} data-testid="finish-confirm">Tak, sprawdź</Button><Button variant="quiet" onClick={() => setConfirm(false)}>Wróć</Button></> : <Button onClick={() => setConfirm(true)} data-testid="finish">Zakończ i sprawdź</Button>}</div>
  </div>;
}
