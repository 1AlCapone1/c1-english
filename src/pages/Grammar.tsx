import { Link } from "react-router-dom";
import { lessonProgress, listLessons } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { Card, Empty, ErrorBox, Loading, PageHeader, Pill } from "../components/ui";

export default function Grammar() {
  const { data, error, loading, reload } = useAsync(async () => { const [l, p] = await Promise.all([listLessons(), lessonProgress()]); return { l, p: new Map(p.map((x) => [x.lesson_id, x])) }; });
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  const areas = Array.from(new Set(data.l.map((x) => x.area)));
  return <div>
    <PageHeader eyebrow="Moduł B · Grammar C1" title="Kurs gramatyki" lead={`${data.l.length} lekcji. Każda: wyjaśnienie po polsku, zastosowanie, budowa zdań, przykłady z tłumaczeniem, porównanie z podobnymi konstrukcjami, typowe błędy Polaków, wyjątki, ćwiczenia i test końcowy.`} />
    {!data.l.length ? <Empty title="Brak lekcji">Administrator nie dodał jeszcze lekcji.</Empty> :
      <div className="grid gap-4">{areas.map((a) => <Card key={a}><h2 className="font-display text-lg font-bold">{a}</h2><ul className="mt-2">{data.l.filter((x) => x.area === a).map((x) => { const pr = data.p.get(x.id); const pct = pr?.test_max ? Math.round((Number(pr.test_score) / Number(pr.test_max)) * 100) : null; return <li key={x.id}><Link to={`/grammar/${x.slug}`} className="flex items-center justify-between gap-3 border-t border-black/5 px-1 py-2.5 first:border-0 hover:bg-black/[.03] dark:border-white/5 dark:hover:bg-white/[.03]"><span>{x.title}</span>{pr?.completed_at ? <Pill tone={pct !== null && pct >= 80 ? "ok" : "warn"}>test {pct}%</Pill> : <Pill>nowa</Pill>}</Link></li>; })}</ul></Card>)}</div>}
  </div>;
}
