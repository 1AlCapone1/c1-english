import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getReading, listReading } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { TestRunner } from "../components/TestRunner";
import { Card, Empty, ErrorBox, Loading, PageHeader, Pill, Button } from "../components/ui";

export default function Reading() {
  const { id } = useParams();
  return id ? <ReadingText id={id} /> : <ReadingList />;
}
function ReadingList() {
  const { data, error, loading, reload } = useAsync(listReading);
  const [topic, setTopic] = useState("");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  const topics = Array.from(new Set(data.map((r) => r.topic))).sort();
  const list = data.filter((r) => !topic || r.topic === topic);
  return <div>
    <PageHeader eyebrow="Moduł D" title="Reading" lead={`${data.length} tekstów C1 z pytaniami o szczegóły, główną myśl i intencję autora, zadaniami dopasowania, wyjaśnieniami i listą trudniejszych słów.`} />
    <div className="mb-4 flex flex-wrap gap-2"><button className={`rounded-full border px-3 py-1 text-sm ${!topic ? "bg-ink text-white dark:bg-white dark:text-ink" : ""}`} onClick={() => setTopic("")}>Wszystkie</button>{topics.map((t) => <button key={t} className={`rounded-full border px-3 py-1 text-sm ${topic === t ? "bg-ink text-white dark:bg-white dark:text-ink" : ""}`} onClick={() => setTopic(t)}>{t}</button>)}</div>
    {!list.length ? <Empty title="Brak tekstów" /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((r) => <Link key={r.id} to={`/reading/${r.id}`}><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex gap-1"><Pill>{r.topic}</Pill><Pill>{r.level}</Pill></div><h2 className="mt-2 font-display text-lg font-bold">{r.title}</h2><p className="mt-1 text-sm text-ink-soft">{r.word_count} słów</p></Card></Link>)}</div>}
  </div>;
}
function ReadingText({ id }: { id: string }) {
  const { data, error, loading, reload } = useAsync(() => getReading(id), [id]);
  const [glossary, setGlossary] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  const { reading: r, exercises } = data;
  const text = <Card><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><Pill>{r.topic}</Pill><Pill>{r.level}</Pill><Pill>{r.word_count} słów</Pill></div><Button size="sm" variant="quiet" onClick={() => setGlossary(!glossary)}>{glossary ? "Ukryj słowniczek" : "Trudniejsze słowa"}</Button></div>
    {glossary && <ul className="mt-3 grid gap-1 rounded-lg bg-black/[.03] p-3 text-sm sm:grid-cols-2 dark:bg-white/[.04]">{r.glossary.map((g) => <li key={g.term}><b>{g.term}</b> – {g.pl}</li>)}</ul>}
    <article className="prose-c1 mt-4 max-w-[70ch] text-[1.05rem] leading-relaxed">{r.body.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</article></Card>;
  return <div className="max-w-4xl"><Link to="/reading" className="text-sm text-accent dark:text-accent-dark">← Wszystkie teksty</Link>
    <PageHeader title={r.title} />
    {exercises.length ? <TestRunner title={`Reading: ${r.title}`} kind="reading" items={exercises} header={text} /> : <>{text}<p className="mt-3 text-ink-soft">Ten tekst nie ma jeszcze pytań.</p></>}
  </div>;
}
