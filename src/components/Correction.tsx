import { useEffect, useRef, useState, type ReactNode } from "react";
import { checkText, diagnose, hint, type Diagnosis } from "../lib/answer";
import type { Exercise } from "../lib/types";
import { Button, Diff, Feedback, answerCls, cx } from "./ui";

export type Outcome = { firstTry: boolean; attempts: number; firstAnswer: string; diagnosis: Diagnosis | null; hinted: boolean };

/**
 * Mandatory correction loop for typed answers:
 * ask → (wrong) explain + show answer → hide answer, retype from memory →
 * wrong again: hint (no answer) → wrong again: explain again → … until correct.
 */
export function TypedTask(props: {
  prompt: ReactNode; answers: string[]; explanation?: ReactNode; placeholder?: string; multiline?: boolean;
  onDone: (o: Outcome) => void; allowHint?: boolean; extraCheck?: (v: string) => boolean;
}) {
  const { answers } = props;
  const [phase, setPhase] = useState<"ask" | "fix" | "retype" | "done">("ask");
  const [val, setVal] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [first, setFirst] = useState<{ answer: string; diag: Diagnosis | null } | null>(null);
  const [lastWrong, setLastWrong] = useState("");
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [fails, setFails] = useState(0);
  const [hintLvl, setHintLvl] = useState(0);
  const [hinted, setHinted] = useState(false);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, [phase]);

  const isCorrect = (v: string) => checkText(v, answers).ok || (props.extraCheck ? props.extraCheck(v) : false);
  function submit() {
    const v = val;
    if (!v.trim() && phase !== "ask") return;
    const n = attempts + 1; setAttempts(n);
    if (isCorrect(v)) {
      setPhase("done");
      props.onDone({ firstTry: n === 1, attempts: n, firstAnswer: first?.answer ?? v, diagnosis: first?.diag ?? null, hinted });
      return;
    }
    const d = diagnose(v, answers);
    setDiag(d); setLastWrong(v);
    if (!first) setFirst({ answer: v, diag: d });
    if (phase === "retype") {
      const f = fails + 1; setFails(f);
      if (f === 1) { setHintLvl((h) => h + 1); setVal(""); return; } // hint, stay in retype
    }
    setFails(0); setPhase("fix");
  }
  const best = diag?.best ?? answers[0];
  return <div className="flex flex-col gap-4">
    <div className="text-lg">{props.prompt}</div>
    {props.multiline
      ? <textarea ref={ref} className={cx(answerCls, "min-h-[90px] max-w-none font-sans")} value={phase === "fix" ? lastWrong : val} readOnly={phase === "fix" || phase === "done"} onChange={(e) => setVal(e.target.value)} placeholder={props.placeholder} aria-label="Twoja odpowiedź" spellCheck={false} />
      : <input ref={ref} className={cx(answerCls, phase === "fix" && "border-red-600 text-red-700 dark:text-red-300", phase === "done" && "border-emerald-600 text-emerald-700 dark:text-emerald-300")}
          value={phase === "fix" ? lastWrong : val} readOnly={phase === "fix" || phase === "done"} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (phase === "ask" || phase === "retype") submit(); else if (phase === "fix") { setVal(""); setPhase("retype"); } } }}
          placeholder={props.placeholder ?? "Wpisz odpowiedź…"} aria-label="Twoja odpowiedź" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-testid="answer-input" />}
    {hinted && phase === "ask" && <div className="text-sm text-ink-soft">Podpowiedź: <b className="font-mono">{hint(answers[0], 1)}</b></div>}
    {phase === "fix" && diag && <Feedback tone="bad" title={`Błąd: ${diag.label}`}>
      {lastWrong.trim() ? <Diff user={lastWrong} right={best} /> : <span>Poprawna odpowiedź: <b className="font-mono">{best}</b></span>}
      <span>{diag.note}</span>{props.explanation && <span className="text-sm">{props.explanation}</span>}
    </Feedback>}
    {phase === "retype" && <Feedback tone="warn" title={fails ? "Jeszcze nie." : "Teraz wpisz poprawną odpowiedź z pamięci."}>
      <span>{fails && diag ? `${diag.label}. ` : ""}{hintLvl ? <>Wskazówka: <b className="font-mono">{hint(answers[0], hintLvl)}</b></> : "Odpowiedź jest ukryta. Przejdziesz dalej dopiero po poprawnym wpisaniu."}</span>
    </Feedback>}
    {phase === "done" && <Feedback tone="ok" title={attempts > 1 ? `Poprawione po ${attempts} próbach.` : "Dobrze!"}>{props.explanation && <span className="text-sm">{props.explanation}</span>}{answers.length > 1 && attempts === 1 && <span className="text-sm">Inne poprawne: {answers.slice(0, 4).join(" / ")}</span>}</Feedback>}
    <div className="flex flex-wrap gap-2">
      {(phase === "ask" || phase === "retype") && <Button onClick={submit} data-testid="check">Sprawdź</Button>}
      {phase === "ask" && props.allowHint && !hinted && <Button variant="quiet" onClick={() => setHinted(true)}>Podpowiedź</Button>}
      {phase === "ask" && <Button variant="ghost" onClick={() => { setVal(""); const n = attempts + 1; setAttempts(n); const d = diagnose("", answers); setDiag(d); setLastWrong(""); if (!first) setFirst({ answer: "", diag: d }); setPhase("fix"); }}>Nie wiem</Button>}
      {phase === "fix" && <Button onClick={() => { setVal(""); setPhase("retype"); }} data-testid="retype">Ukryj odpowiedź i wpisz z pamięci</Button>}
      {phase === "retype" && <Button variant="ghost" onClick={() => { setFails(0); setPhase("fix"); }}>Pokaż wyjaśnienie jeszcze raz</Button>}
    </div>
  </div>;
}

/** Multiple choice with the same rule: after a mistake you must choose again (options reshuffled, hints remove wrong options). */
export function ChoiceTask(props: { prompt: ReactNode; options: string[]; correct: string; explanation?: ReactNode; notes?: Record<string, string> | null; onDone: (o: Outcome) => void }) {
  const [order, setOrder] = useState(() => shuffleIdx(props.options.length));
  const [phase, setPhase] = useState<"ask" | "fix" | "retype" | "done">("ask");
  const [picked, setPicked] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [firstWrong, setFirstWrong] = useState<string | null>(null);
  const correctIdx = props.options.findIndex((o) => o === props.correct);
  function pick(i: number) {
    if (phase === "fix" || phase === "done") return;
    setPicked(i);
    const n = attempts + 1; setAttempts(n);
    if (i === correctIdx) { setPhase("done"); props.onDone({ firstTry: n === 1, attempts: n, firstAnswer: firstWrong ?? props.options[i], diagnosis: null, hinted: hidden.length > 0 }); return; }
    if (firstWrong === null) setFirstWrong(props.options[i]);
    if (phase === "retype") { const w = order.filter((k) => k !== correctIdx && k !== i && !hidden.includes(k)); if (w.length > 1) setHidden([...hidden, w[0]]); }
    setPhase("fix");
  }
  return <div className="flex flex-col gap-4">
    <div className="text-lg">{props.prompt}</div>
    <div className="flex flex-col gap-2" role="radiogroup">
      {order.filter((i) => !hidden.includes(i)).map((i, k) => {
        const showRight = (phase === "fix" || phase === "done") && i === correctIdx;
        const showWrong = phase === "fix" && i === picked;
        return <button key={i} role="radio" aria-checked={picked === i} disabled={phase === "fix" || phase === "done"} onClick={() => pick(i)}
          className={cx("flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition",
            showRight ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60" : showWrong ? "border-red-600 bg-red-50 dark:bg-red-950/60" : "border-black/15 bg-white hover:border-accent dark:border-white/15 dark:bg-[#0E1320]")}>
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-current font-mono text-[10px]">{"ABCDEF"[k]}</span><span>{props.options[i]}</span></button>;
      })}
    </div>
    {phase === "fix" && <Feedback tone="bad" title="Błąd: zła odpowiedź">
      <span>Wybrałeś: <b>{picked !== null ? props.options[picked] : "–"}</b>. Poprawnie: <b>{props.correct}</b>.</span>
      {props.explanation && <span>{props.explanation}</span>}
      {picked !== null && props.notes?.[props.options[picked]] && <span className="text-sm">Dlaczego nie „{props.options[picked]}”: {props.notes[props.options[picked]]}</span>}
    </Feedback>}
    {phase === "retype" && <Feedback tone="warn" title="Wybierz ponownie – samodzielnie.">{hidden.length ? "Wskazówka: usunąłem jedną błędną odpowiedź." : "Odpowiedzi zostały przetasowane."}</Feedback>}
    {phase === "done" && <Feedback tone="ok" title={attempts > 1 ? `Poprawione po ${attempts} próbach.` : "Dobrze!"}>{props.explanation && <span className="text-sm">{props.explanation}</span>}</Feedback>}
    {phase === "fix" && <div><Button onClick={() => { setOrder(shuffleIdx(props.options.length)); setPicked(null); setPhase("retype"); }} data-testid="retype">Rozwiąż ponownie samodzielnie</Button></div>}
  </div>;
}
function shuffleIdx(n: number) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Render one exercise in practice mode (with correction loop). */
export function ExerciseTask({ ex, onDone }: { ex: Exercise; onDone: (o: Outcome) => void }) {
  const p = ex.prompt;
  const instruction = <div className="text-sm text-ink-soft dark:text-[#9AA3B8]">{ex.instruction}</div>;
  if (ex.task_type === "mc" || ex.task_type === "mc_cloze" || ex.task_type === "tfng" || ex.task_type === "matching")
    return <ChoiceTask key={ex.id} prompt={<>{instruction}<div className="mt-1">{withGap(p.question)}</div></>} options={p.options ?? []} correct={ex.answers[0]} explanation={ex.explanation} notes={ex.distractor_notes} onDone={onDone} />;
  if (ex.task_type === "kwt")
    return <TypedTask key={ex.id} prompt={<>{instruction}<div className="mt-1">{p.question}</div><div className="my-2"><span className="rounded border-2 border-current px-2 py-0.5 font-mono text-sm font-bold tracking-wider">{p.keyword}</span></div><div>{withGap(p.sentence2 ?? "")}</div></>} answers={ex.answers} explanation={ex.explanation} placeholder="2–5 słów, w tym słowo kluczowe" allowHint onDone={onDone}
      extraCheck={(v) => !!p.sentence2 && ex.answers.some((a) => checkText(v, [p.sentence2!.replace("___", a)]).ok)} />;
  return <TypedTask key={ex.id} prompt={<>{instruction}<div className="mt-1">{withGap(p.question)}{p.base ? <b className="ml-1 font-mono">({p.base})</b> : null}</div></>} answers={ex.answers} explanation={ex.explanation}
    placeholder={ex.task_type === "translation" ? "English translation…" : ex.task_type === "error" ? "poprawiony fragment" : undefined} multiline={ex.task_type === "translation"} allowHint onDone={onDone} />;
}
export function withGap(text: string): ReactNode {
  const parts = String(text).split("___");
  return parts.map((t, i) => <span key={i}>{t}{i < parts.length - 1 && <span className="mx-1 inline-block w-16 border-b-[3px] border-accent align-baseline dark:border-accent-dark" />}</span>);
}

/** Grading for test mode (no feedback until the end). */
export function gradeExercise(ex: Exercise, value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  if (["mc", "mc_cloze", "tfng", "matching"].includes(ex.task_type)) return value === ex.answers[0];
  if (checkText(value, ex.answers).ok) return true;
  if (ex.task_type === "kwt" && ex.prompt.sentence2) return ex.answers.some((a) => checkText(value, [ex.prompt.sentence2!.replace("___", a)]).ok);
  return false;
}
