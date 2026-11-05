import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listExercises, listLessons, listListening, listReading, listSpeaking, listWritingGuides, logSession, recordMistake, saveAttempt, saveSubmission, shuffle } from "../lib/api";
import { categoryFor, promptText } from "../components/PracticeSession";
import { TestRunner, type TestResult } from "../components/TestRunner";
import { Button, Card, Feedback, Loading, PageHeader, Pill, Progress, inputCls } from "../components/ui";
import type { Exercise, GrammarLesson, SpeakingTask, WritingGuide } from "../lib/types";

type Stage = "intro" | "rue" | "writing" | "listening" | "speaking" | "results";
const STAGES: [Stage, string][] = [["rue", "1. Reading and Use of English"], ["writing", "2. Writing"], ["listening", "3. Listening"], ["speaking", "4. Speaking"], ["results", "5. Wynik i analiza"]];
const TASK_NAME: Record<string, string> = { mc_cloze: "Multiple-choice cloze", open_cloze: "Open cloze", word_formation: "Word formation", kwt: "Key word transformations", mc: "Reading – multiple choice", tfng: "Reading – true/false/not given", matching: "Reading – dopasowanie", gap: "Luki", translation: "Tłumaczenie", error: "Błędy" };
const wc = (t: string) => (t.trim().match(/[A-Za-zÀ-ž0-9'’-]+/g) || []).length;

type ExamData = { rue: Exercise[]; readingTitle: string; readingBody: string; writing: WritingGuide[]; speaking: SpeakingTask[]; listeningAvailable: boolean; lessons: GrammarLesson[] };

export default function Exam() {
  const [stage, setStage] = useState<Stage>("intro");
  const [data, setData] = useState<ExamData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rue, setRue] = useState<TestResult | null>(null);
  const [writing, setWriting] = useState<{ t1: string; t2: string; task1: string; task2: string; type2: string; self: number }>({ t1: "", t2: "", task1: "", task2: "", type2: "report", self: -1 });
  const [speakSelf, setSpeakSelf] = useState<number>(-1);
  const [saved, setSaved] = useState<string | null>(null);

  async function prepare() {
    setErr(null);
    try {
      const [u, texts, w, s, l, lessons] = await Promise.all([listExercises({ module: "use_of_english" }), listReading(), listWritingGuides(), listSpeaking(), listListening(), listLessons()]);
      const pick = (t: string, n: number) => shuffle(u.filter((e) => e.task_type === t)).slice(0, n);
      const uoe = [...pick("mc_cloze", 8), ...pick("open_cloze", 8), ...pick("word_formation", 8), ...pick("kwt", 6)];
      const text = texts.length ? texts[Math.floor(Math.random() * texts.length)] : null;
      const rq = text ? await listExercises({ reading_id: text.id }) : [];
      if (uoe.length < 10) throw new Error("Za mało zadań Use of English w bazie, aby uruchomić egzamin.");
      const essay = w.find((g) => g.type === "essay");
      const second = shuffle(w.filter((g) => g.type !== "essay"))[0];
      setWriting((x) => ({ ...x, task1: essay?.content.tasks[0] ?? "", task2: second?.content.tasks[0] ?? "", type2: second?.type ?? "report" }));
      setData({ rue: [...uoe, ...rq], readingTitle: text?.title ?? "", readingBody: text?.body ?? "", writing: w, speaking: shuffle(s).slice(0, 3), listeningAvailable: l.length > 0, lessons });
      setStage("rue");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function finishExam() {
    setStage("results");
    if (!rue || !data) return;
    try {
      if (writing.t1.trim()) await saveSubmission({ type: "essay", task: writing.task1, body: writing.t1 });
      if (writing.t2.trim()) await saveSubmission({ type: writing.type2, task: writing.task2, body: writing.t2 });
      await saveAttempt({ kind: "exam", title: "Exam Simulator – C1 Advanced", score: rue.score, max_score: rue.max, duration_sec: rue.durationSec, details: { writing_self: writing.self, speaking_self: speakSelf, words: [wc(writing.t1), wc(writing.t2)], listening: data.listeningAvailable ? "taken" : "unavailable" } });
      for (const g of rue.items.filter((x) => !x.ok)) await recordMistake({ category: categoryFor(g.ex), source: "exam", prompt: promptText(g.ex), user_answer: g.answer, correct: g.ex.answers[0], explanation: g.ex.explanation, exercise_id: g.ex.id });
      await logSession("exam", rue.max, rue.score, rue.durationSec / 60);
      setSaved("ok");
    } catch (e) { setSaved(e instanceof Error ? e.message : String(e)); }
  }
  const nav = <div className="mb-5 flex gap-1.5 overflow-x-auto">{STAGES.map(([k, n]) => <span key={k} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${stage === k ? "border-ink bg-ink font-bold text-white dark:bg-white dark:text-ink" : "border-black/15 opacity-70 dark:border-white/15"}`}>{n}</span>)}</div>;

  if (stage === "intro") return <div className="max-w-3xl">
    <PageHeader eyebrow="Exam Simulator" title="Egzamin próbny – Cambridge C1 Advanced" lead="Pięć części jak na egzaminie: Reading and Use of English (90 min), Writing (90 min), Listening (ok. 40 min), Speaking (ok. 15 min) i analiza wyniku. Zadania są nasze własne, wzorowane na formacie egzaminu – nie są to oficjalne materiały Cambridge." />
    <Card><ul className="list-disc pl-5"><li>Reading and Use of English: multiple-choice cloze, open cloze, word formation, key word transformations i tekst z pytaniami. Limit czasu: 90 minut.</li><li>Writing: obowiązkowy esej i jedno zadanie do wyboru, z licznikiem słów.</li><li>Listening: uruchamiany tylko wtedy, gdy w bazie są nagrania.</li><li>Speaking: zadania z nagrywaniem wypowiedzi i samooceną.</li></ul>
      <p className="mt-3 text-sm text-ink-soft">Wynik obejmuje automatycznie sprawdzane części. Writing i Speaking oceniasz sam według kryteriów – to nie jest ocena egzaminatora ani oficjalny wynik w skali Cambridge.</p>
      {err && <div className="mt-3"><Feedback tone="bad">{err}</Feedback></div>}
      <div className="mt-4"><Button onClick={prepare} data-testid="start-exam">Rozpocznij egzamin</Button></div></Card></div>;
  if (!data) return <Loading />;
  if (stage === "rue") return <div className="max-w-4xl">{nav}<TestRunner title="Reading and Use of English" kind="exam-rue" items={data.rue} timeLimitSec={90 * 60} save={false}
    intro={data.readingBody ? <Card><h2 className="font-display text-lg font-bold">Tekst do ostatnich pytań: {data.readingTitle}</h2><article className="prose-c1 mt-3 max-w-[70ch] leading-relaxed">{data.readingBody.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</article></Card> : undefined}
    onFinished={(r) => setRue(r)} />{rue && <div className="mt-4"><Button onClick={() => setStage("writing")}>Przejdź do części Writing →</Button></div>}</div>;
  if (stage === "writing") return <div className="max-w-4xl">{nav}<WritingPart data={data} writing={writing} setWriting={setWriting} onNext={() => setStage("listening")} /></div>;
  if (stage === "listening") return <div className="max-w-3xl">{nav}<Card><h2 className="font-display text-xl font-bold">Listening</h2>
    {data.listeningAvailable ? <p className="mt-2">Nagrania są dostępne w module Listening. W tej wersji symulatora część Listening rozwiązujesz w module Listening, a wynik zapisuje się osobno w historii testów.</p>
      : <Feedback tone="info" title="Część pominięta">W bazie nie ma jeszcze nagrań audio, więc ta część nie jest oceniana. Wynik egzaminu obejmie pozostałe części.</Feedback>}
    <div className="mt-4"><Button onClick={() => setStage("speaking")}>Przejdź do części Speaking →</Button></div></Card></div>;
  if (stage === "speaking") return <div className="max-w-3xl">{nav}<Card><h2 className="font-display text-xl font-bold">Speaking</h2><p className="mt-1 text-ink-soft">Odpowiedz na głos na każde zadanie (ok. 1–2 minuty). Możesz się nagrać w module Speaking. Potem oceń się sam.</p>
    <ol className="mt-3 flex flex-col gap-3">{data.speaking.map((t, i) => <li key={t.id} className="rounded-lg border border-black/10 p-3 dark:border-white/10"><b>{i + 1}. {t.title}</b><p className="mt-1 whitespace-pre-wrap">{t.prompt}</p></li>)}</ol>
    <label className="mt-4 flex flex-col gap-1 text-sm font-bold">Samoocena części Speaking (0–5)<select className={inputCls + " w-32"} value={speakSelf} onChange={(e) => setSpeakSelf(Number(e.target.value))}><option value={-1}>–</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
    <div className="mt-4"><Button onClick={finishExam} data-testid="exam-finish">Zakończ egzamin i zobacz analizę →</Button></div></Card></div>;
  return <div className="max-w-4xl">{nav}<Results data={data} rue={rue} writing={writing} speakSelf={speakSelf} saved={saved} /></div>;
}

function WritingPart({ data, writing, setWriting, onNext }: { data: ExamData; writing: { t1: string; t2: string; task1: string; task2: string; type2: string; self: number }; setWriting: (w: typeof writing) => void; onNext: () => void }) {
  const start = useRef(Date.now()); const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = 90 * 60 - (now - start.current) / 1000;
  const others = data.writing.filter((g) => g.type !== "essay");
  return <Card><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Writing</h2><span className="rounded-md bg-black/5 px-2.5 py-1 font-mono font-bold dark:bg-white/10">{Math.max(0, Math.floor(left / 60))}:{String(Math.max(0, Math.floor(left % 60))).padStart(2, "0")}</span></div>
    <h3 className="mt-4 font-bold">Część 1 – esej (obowiązkowa), 220–260 słów</h3><p className="mt-1">{writing.task1}</p>
    <textarea className={inputCls + " mt-2 min-h-[220px]"} value={writing.t1} onChange={(e) => setWriting({ ...writing, t1: e.target.value })} spellCheck={false} aria-label="Esej" /><div className="text-right font-mono text-sm">{wc(writing.t1)} słów</div>
    <h3 className="mt-4 font-bold">Część 2 – jedno zadanie do wyboru, 220–260 słów</h3>
    <select className={inputCls + " mt-1"} value={writing.type2} onChange={(e) => { const g = others.find((x) => x.type === e.target.value); setWriting({ ...writing, type2: e.target.value, task2: g?.content.tasks[0] ?? "" }); }}>{others.map((g) => <option key={g.type} value={g.type}>{g.title}</option>)}</select>
    <p className="mt-2">{writing.task2}</p>
    <textarea className={inputCls + " mt-2 min-h-[220px]"} value={writing.t2} onChange={(e) => setWriting({ ...writing, t2: e.target.value })} spellCheck={false} aria-label="Zadanie 2" /><div className="text-right font-mono text-sm">{wc(writing.t2)} słów</div>
    <label className="mt-3 flex flex-col gap-1 text-sm font-bold">Samoocena Writing (0–5, wg kryteriów: realizacja polecenia, komunikacja, organizacja, język)<select className={inputCls + " w-32"} value={writing.self} onChange={(e) => setWriting({ ...writing, self: Number(e.target.value) })}><option value={-1}>–</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
    <div className="mt-4"><Button onClick={onNext}>Przejdź do części Listening →</Button></div></Card>;
}

function Results({ data, rue, writing, speakSelf, saved }: { data: ExamData; rue: TestResult | null; writing: { t1: string; t2: string; self: number }; speakSelf: number; saved: string | null }) {
  if (!rue) return <Feedback tone="warn">Brak wyniku części Reading and Use of English.</Feedback>;
  const byType: Record<string, { ok: number; n: number }> = {};
  rue.items.forEach((g) => { const k = g.ex.reading_id ? "reading" : g.ex.task_type; byType[k] = byType[k] || { ok: 0, n: 0 }; byType[k].n++; if (g.ok) byType[k].ok++; });
  const rows = Object.entries(byType).map(([k, v]) => ({ k, name: k === "reading" ? "Reading" : TASK_NAME[k] ?? k, pct: Math.round((v.ok / v.n) * 100), ...v })).sort((a, b) => b.pct - a.pct);
  const strong = rows.filter((r) => r.pct >= 75), weak = rows.filter((r) => r.pct < 60);
  const total = Math.round((rue.score / rue.max) * 100);
  const wrongLessonIds = new Set(rue.items.filter((g) => !g.ok && g.ex.grammar_lesson_id).map((g) => g.ex.grammar_lesson_id));
  const wrongTopics = new Set(rue.items.filter((g) => !g.ok).map((g) => g.ex.topic).filter(Boolean));
  const recLessons = data.lessons.filter((l) => wrongLessonIds.has(l.id) || wrongTopics.has(l.slug)).slice(0, 5);
  const fallbackLessons = recLessons.length ? recLessons : data.lessons.slice(0, 3);
  const plan = [
    weak.some((w) => w.k === "kwt") && "Codziennie 5 transformacji (Use of English → Key word transformations) – to najwięcej punktów do zdobycia.",
    weak.some((w) => w.k === "word_formation") && "Word formation: powtarzaj przedrostki i przyrostki (fiszki → rodzaj „Word formation”).",
    weak.some((w) => w.k === "open_cloze") && "Open cloze: przyimki, spójniki i czasowniki posiłkowe – lekcje gramatyki z listy poniżej.",
    weak.some((w) => w.k === "mc_cloze") && "Multiple-choice cloze: kolokacje i phrasal verbs – 20 fiszek dziennie z tych kategorii.",
    weak.some((w) => w.k === "reading") && "Reading: jeden tekst dziennie z pytaniami o intencję autora.",
    (wc(writing.t1) < 220 || wc(writing.t2) < 220) && "Writing: ćwicz pisanie pełnej długości (220–260 słów) w limicie czasu.",
    "Raz w tygodniu powtórz cały egzamin próbny i porównaj wyniki w zakładce Postępy.",
  ].filter(Boolean) as string[];
  return <div className="flex flex-col gap-4">
    <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Wynik części sprawdzanych automatycznie</div><div className="mt-1 font-display text-5xl font-extrabold">{total}%</div><div className="mt-1 text-ink-soft">{rue.score}/{rue.max} pkt w Reading and Use of English</div><div className="mt-3"><Progress value={total} tone={total >= 70 ? "ok" : total >= 50 ? "warn" : "bad"} /></div>
      <p className="mt-3 text-sm text-ink-soft">Samoocena: Writing {writing.self >= 0 ? `${writing.self}/5` : "–"}, Speaking {speakSelf >= 0 ? `${speakSelf}/5` : "–"}. To nie jest wynik w oficjalnej skali Cambridge.</p>
      {saved === "ok" ? <p className="mt-1 text-sm text-ink-soft">Wynik i prace pisemne zapisano na Twoim koncie.</p> : saved ? <Feedback tone="warn" title="Nie zapisano wyniku">{saved}</Feedback> : <p className="mt-1 text-sm text-ink-soft" aria-live="polite">Zapisywanie wyniku…</p>}</Card>
    <Card><h2 className="font-display text-lg font-bold">Wyniki według typu zadań</h2><div className="mt-3 flex flex-col gap-2">{rows.map((r) => <div key={r.k} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[220px_1fr_auto]"><span>{r.name}</span><div className="hidden sm:block"><Progress value={r.pct} tone={r.pct >= 75 ? "ok" : r.pct >= 60 ? "warn" : "bad"} /></div><span className="font-mono text-sm">{r.ok}/{r.n}</span></div>)}</div></Card>
    <div className="grid gap-4 sm:grid-cols-2"><Card><h2 className="font-display text-lg font-bold">Mocne strony</h2><p className="mt-2">{strong.length ? strong.map((s) => s.name).join(", ") : "Na razie żaden typ zadań nie przekroczył 75%."}</p></Card><Card><h2 className="font-display text-lg font-bold">Słabe strony</h2><p className="mt-2">{weak.length ? weak.map((s) => s.name).join(", ") : "Brak typów zadań poniżej 60% – świetnie."}</p></Card></div>
    <Card><h2 className="font-display text-lg font-bold">Rekomendowane lekcje</h2><ul className="mt-2 flex flex-col gap-1">{fallbackLessons.map((l) => <li key={l.id}><Link className="text-accent underline dark:text-accent-dark" to={`/grammar/${l.slug}`}>{l.title}</Link></li>)}</ul></Card>
    <Card><h2 className="font-display text-lg font-bold">Plan dalszej nauki</h2><ol className="mt-2 list-decimal pl-5">{plan.map((p) => <li key={p} className="mb-1">{p}</li>)}</ol></Card>
    <Card><h2 className="font-display text-lg font-bold">Błędy ({rue.items.filter((g) => !g.ok).length})</h2><ul className="mt-2">{rue.items.filter((g) => !g.ok).map((g) => <li key={g.ex.id} className="border-t border-black/5 py-2 text-sm first:border-0 dark:border-white/5"><Pill>{TASK_NAME[g.ex.task_type] ?? g.ex.task_type}</Pill> {g.ex.prompt.question} <span className="ml-1">→ <s>{g.answer || "–"}</s> <b>{g.ex.answers[0]}</b></span><div className="text-ink-soft">{g.ex.explanation}</div></li>)}</ul></Card>
  </div>;
}
