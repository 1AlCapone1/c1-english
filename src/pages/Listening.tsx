import { useState } from "react";
import { audioUrl, listExercises, listListening } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { TestRunner } from "../components/TestRunner";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader } from "../components/ui";
import type { Listening as L } from "../lib/types";

export default function Listening() {
  const { data, error, loading, reload } = useAsync(listListening);
  const [open, setOpen] = useState<L | null>(null);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  if (open) return <ListeningItem item={open} onBack={() => setOpen(null)} />;
  return <div>
    <PageHeader eyebrow="Moduł E" title="Listening" lead="Nagrania C1 z transkrypcją, pytaniami, wyjaśnieniami i listą słownictwa." />
    {!data.length ? <Empty title="Nagrania są w przygotowaniu">Ten moduł zostanie uruchomiony, gdy w bazie pojawią się prawdziwe pliki audio. Nie pokazujemy odtwarzacza bez nagrania. Do tego czasu ćwicz rozumienie tekstu w module Reading.</Empty>
      : <div className="grid gap-4 sm:grid-cols-2">{data.map((l) => <Card key={l.id}><h2 className="font-display text-lg font-bold">{l.title}</h2><p className="text-sm text-ink-soft">{l.topic}</p><Button className="mt-3" size="sm" onClick={() => setOpen(l)}>Otwórz</Button></Card>)}</div>}
  </div>;
}
function ListeningItem({ item, onBack }: { item: L; onBack: () => void }) {
  const ex = useAsync(() => listExercises({ listening_id: item.id }), [item.id]);
  const [transcript, setTranscript] = useState(false);
  const header = <Card><audio controls preload="metadata" className="w-full" src={audioUrl(item.audio_path!)}>Twoja przeglądarka nie obsługuje odtwarzania audio.</audio>
    <div className="mt-3 flex gap-2"><Button size="sm" variant="quiet" onClick={() => setTranscript(!transcript)}>{transcript ? "Ukryj transkrypcję" : "Pokaż transkrypcję"}</Button></div>
    {transcript && <div className="mt-3 whitespace-pre-wrap text-sm">{item.transcript}</div>}
    {item.glossary.length > 0 && <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">{item.glossary.map((g) => <li key={g.term}><b>{g.term}</b> – {g.pl}</li>)}</ul>}</Card>;
  return <div className="max-w-3xl"><button className="text-sm text-accent" onClick={onBack}>← Nagrania</button><PageHeader title={item.title} />
    {ex.loading ? <Loading /> : ex.error ? <ErrorBox error={ex.error} /> : <TestRunner title={`Listening: ${item.title}`} kind="listening" items={ex.data ?? []} header={header} />}</div>;
}
