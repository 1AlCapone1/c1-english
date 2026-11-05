import { useState } from "react";
import { listExercises, shuffle } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { PracticeSession } from "../components/PracticeSession";
import { Button, Card, ErrorBox, Loading, PageHeader, inputCls } from "../components/ui";
import type { Exercise } from "../lib/types";

const TYPES = [["mc_cloze", "Multiple-choice cloze", "Wybierz słowo, które pasuje do luki (kolokacje, phrasal verbs, idiomy)."], ["open_cloze", "Open cloze", "Wpisz jedno słowo: przyimki, przedimki, spójniki, zaimki, czasowniki posiłkowe."], ["word_formation", "Word formation", "Utwórz poprawną formę wyrazu podanego wielkimi literami."], ["kwt", "Key word transformations", "Przekształć zdanie, używając słowa kluczowego (3–6 słów)."]] as const;

export default function UseOfEnglish() {
  const { data, error, loading, reload } = useAsync(() => listExercises({ module: "use_of_english" }));
  const [run, setRun] = useState<{ title: string; items: Exercise[]; pool: Exercise[] } | null>(null);
  const [n, setN] = useState(10);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  if (run) return <PracticeSession title={run.title} items={run.items} pool={run.pool} source="use_of_english" onClose={() => setRun(null)} />;
  const by = (t: string) => data.filter((e) => e.task_type === t);
  return <div>
    <PageHeader eyebrow="Moduł C" title="Use of English" lead={`Zadania w stylu Cambridge C1 Advanced: ${data.length} w bazie. Każde ma wyjaśnienie, a w zadaniach wyboru – informację, dlaczego pozostałe odpowiedzi są błędne.`}
      actions={<label className="flex items-center gap-2 text-sm">Zadań w serii<select className={inputCls + " w-auto"} value={n} onChange={(e) => setN(Number(e.target.value))}>{[5, 10, 20].map((x) => <option key={x}>{x}</option>)}</select></label>} />
    <div className="grid gap-4 sm:grid-cols-2">{TYPES.map(([t, name, desc]) => { const items = by(t); return <Card key={t}><h2 className="font-display text-lg font-bold">{name}</h2><p className="mt-1 text-ink-soft">{desc}</p><p className="mt-2 text-sm">{items.length} zadań</p>
      <Button className="mt-3" size="sm" disabled={!items.length} onClick={() => { const s = shuffle(items); setRun({ title: name, items: s.slice(0, n), pool: s.slice(n) }); }}>Ćwicz</Button></Card>; })}
      <Card><h2 className="font-display text-lg font-bold">Mieszana seria</h2><p className="mt-1 text-ink-soft">Wszystkie typy zadań naraz – jak na egzaminie.</p><Button className="mt-3" size="sm" disabled={!data.length} onClick={() => { const s = shuffle(data); setRun({ title: "Use of English – mix", items: s.slice(0, n), pool: s.slice(n) }); }}>Ćwicz</Button></Card>
    </div>
  </div>;
}
