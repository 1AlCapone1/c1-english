import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLesson, saveLessonProgress } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { PracticeSession } from "../components/PracticeSession";
import { TestRunner } from "../components/TestRunner";
import { Button, Card, ErrorBox, Feedback, Loading, PageHeader, cx } from "../components/ui";

const STEPS = [["explanation", "1. Wyjaśnienie"], ["usage", "2. Zastosowanie"], ["structure", "3. Budowa zdań"], ["examples", "4. Przykłady i tłumaczenia"], ["comparison", "5. Porównanie"], ["mistakes", "6. Typowe błędy Polaków"], ["exceptions", "7. Wyjątki"], ["advanced", "8. C1 w praktyce"], ["practice", "9. Ćwiczenia"], ["test", "10. Test końcowy"]] as const;
type Step = (typeof STEPS)[number][0];
const paras = (t: string) => t.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>);

export default function GrammarLesson() {
  const { slug = "" } = useParams();
  const { data, error, loading, reload } = useAsync(() => getLesson(slug), [slug]);
  const [step, setStep] = useState<Step>("explanation");
  const [mode, setMode] = useState<"none" | "practice" | "test">("none");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  const { lesson, exercises } = data; const c = lesson.content;
  const practice = exercises.filter((e) => e.position < 100); const test = exercises.filter((e) => e.position >= 100);
  const idx = STEPS.findIndex((s) => s[0] === step);
  let body: React.ReactNode = null;
  if (step === "explanation") body = <div className="prose-c1 text-[1.05rem] leading-relaxed">{paras(c.explanation)}</div>;
  if (step === "usage") body = <div className="prose-c1 text-[1.05rem] leading-relaxed">{paras(c.usage)}</div>;
  if (step === "structure") body = <div className="flex flex-col gap-4">
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/5 p-4 font-mono text-sm dark:bg-white/5">{c.structure.scheme}</pre>
    {c.structure.word_order && <p>{c.structure.word_order}</p>}
    <div className="grid gap-3 md:grid-cols-3">{([["Zdania twierdzące", c.structure.affirmative], ["Zdania przeczące", c.structure.negative], ["Pytania", c.structure.questions]] as const).map(([h, l]) => <Card key={h}><h3 className="font-bold">{h}</h3><ul className="mt-2 list-disc pl-5 text-sm">{l.map((x, i) => <li key={i}>{x}</li>)}</ul></Card>)}</div></div>;
  if (step === "examples") body = <div><p className="mb-3 text-sm text-ink-soft">Przeczytaj zdanie i spróbuj sam wyjaśnić, dlaczego użyto tej konstrukcji. Tłumaczenie i wyjaśnienie odsłonisz kliknięciem.</p><ol className="flex flex-col gap-3">{c.examples.map((x, i) => <li key={i} className="rounded-lg border border-black/10 p-3 dark:border-white/10"><div className="font-medium">{i + 1}. {x.en}</div>
    {revealed.has(i) ? <div className="mt-1 text-sm"><div className="text-ink-soft">{x.pl}</div><div><b>Dlaczego:</b> {x.why}</div></div> : <button className="mt-1 text-sm text-accent underline dark:text-accent-dark" onClick={() => setRevealed(new Set(revealed).add(i))}>Pokaż tłumaczenie i wyjaśnienie</button>}</li>)}</ol></div>;
  if (step === "comparison") body = <div className="grid gap-3">{c.comparison.map((x, i) => <Card key={i}><h3 className="font-bold">vs {x.vs}</h3><p className="mt-1">{x.difference}</p><p className="mt-1 text-sm text-ink-soft"><b>Kiedy której:</b> {x.when}</p></Card>)}</div>;
  if (step === "mistakes") body = <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-ink-soft"><th className="p-2">Błędnie</th><th className="p-2">Poprawnie</th><th className="p-2">Dlaczego</th></tr></thead><tbody>{c.mistakes.map((m, i) => <tr key={i} className="border-t border-black/5 dark:border-white/5"><td className="p-2 text-red-700 line-through dark:text-red-300">{m.wrong}</td><td className="p-2 font-medium text-emerald-700 dark:text-emerald-300">{m.right}</td><td className="p-2">{m.why}</td></tr>)}</tbody></table></div>;
  if (step === "exceptions") body = <ul className="list-disc pl-5">{c.exceptions.map((x, i) => <li key={i} className="mb-2">{x}</li>)}</ul>;
  if (step === "advanced") body = c.advanced?.length ? <ol className="flex flex-col gap-3">{c.advanced.map((x, i) => <li key={i} className="rounded-lg border border-black/10 p-3 dark:border-white/10"><div className="font-medium">{x.en}</div><div className="text-sm text-ink-soft">{x.pl}</div><div className="mt-1 text-sm">{x.note}</div></li>)}</ol> : <p className="text-ink-soft">Ta lekcja nie ma rozszerzenia C1.</p>;
  if (step === "practice") body = mode === "practice" ? <PracticeSession title={`${lesson.title} · ćwiczenia`} items={practice} pool={test} source={`grammar:${lesson.slug}`} onClose={() => setMode("none")} />
    : <div><p className="mb-3">{practice.length} ćwiczeń, od łatwiejszych do trudniejszych. Po błędzie zobaczysz wyjaśnienie i musisz rozwiązać zadanie ponownie samodzielnie; dostaniesz też podobne zadanie sprawdzające.</p><Button onClick={() => setMode("practice")} disabled={!practice.length}>Rozpocznij ćwiczenia</Button></div>;
  if (step === "test") body = mode === "test" ? <TestRunner title={`Test: ${lesson.title}`} kind="grammar" items={test} onFinished={async (r) => { try { await saveLessonProgress(lesson.id, r.score, r.max); setSaved(null); } catch (e) { setSaved(e instanceof Error ? e.message : String(e)); } }} />
    : <div><p className="mb-3">{test.length} pytań sprawdzających całe zagadnienie. Odpowiedzi zobaczysz po zakończeniu; potem poprawisz błędy. Wynik co najmniej 80% oznacza opanowanie tematu.</p><Button onClick={() => setMode("test")} disabled={!test.length}>Rozpocznij test</Button></div>;
  return <div className="max-w-4xl">
    <Link to="/grammar" className="text-sm text-accent dark:text-accent-dark">← Wszystkie lekcje</Link>
    <PageHeader eyebrow={`Moduł B · ${lesson.area}`} title={lesson.title} />
    <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">{STEPS.map(([k, n]) => <button key={k} onClick={() => { setStep(k); setMode("none"); }} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", step === k ? "border-ink bg-ink font-bold text-white dark:border-[#E5E8F1] dark:bg-[#E5E8F1] dark:text-[#0E1320]" : "border-black/15 dark:border-white/15")}>{n}</button>)}</div>
    <Card><h2 className="mb-4 font-display text-xl font-bold">{STEPS[idx][1]}</h2>{body}</Card>
    {saved && <div className="mt-3"><Feedback tone="warn" title="Nie zapisano postępu lekcji">{saved}</Feedback></div>}
    {mode === "none" && <div className="mt-4 flex justify-between">{idx > 0 ? <Button variant="quiet" onClick={() => setStep(STEPS[idx - 1][0])}>← {STEPS[idx - 1][1]}</Button> : <span />}{idx < STEPS.length - 1 && <Button onClick={() => setStep(STEPS[idx + 1][0])}>{STEPS[idx + 1][1]} →</Button>}</div>}
  </div>;
}
