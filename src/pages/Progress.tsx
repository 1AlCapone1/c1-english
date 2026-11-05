import { achievements, dashboard, listAttempts, listMistakes, sessionsHistory } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { BarChart, Card, ErrorBox, Loading, PageHeader, Pill, Stat } from "../components/ui";
import { MISTAKE_CATS } from "./Mistakes";

const ICON: Record<string, string> = { flag: "⚑", flame: "🔥", trophy: "🏆", book: "📘", crown: "👑", pen: "✎", check: "✔", star: "★", repeat: "↻", medal: "🏅" };
export default function ProgressPage() {
  const { data, error, loading, reload } = useAsync(async () => { const [d, a, t, s, m] = await Promise.all([dashboard(), achievements(), listAttempts(50), sessionsHistory(30), listMistakes()]); return { d, a, t, s, m }; });
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  const { d, a, t, s, m } = data;
  const days: { label: string; value: number }[] = []; const acc: { label: string; value: number }[] = [];
  for (let k = 29; k >= 0; k--) { const dt = new Date(Date.now() - k * 86400000); const key = dt.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }); const rows = s.filter((x) => x.day === key); const items = rows.reduce((q, r) => q + r.items, 0); const correct = rows.reduce((q, r) => q + r.correct, 0);
    days.push({ label: String(dt.getDate()), value: Math.round(rows.reduce((q, r) => q + Number(r.minutes), 0)) }); acc.push({ label: String(dt.getDate()), value: items ? Math.round((correct / items) * 100) : 0 }); }
  const tests = t.slice().reverse().map((x, i) => ({ label: String(i + 1), value: Math.round((x.score / x.max_score) * 100) }));
  const cats: Record<string, number> = {}; m.forEach((x) => (cats[x.category] = (cats[x.category] ?? 0) + 1));
  return <div>
    <PageHeader eyebrow="Statystyki" title="Postępy" lead="Wszystkie liczby pochodzą z Twojego konta." />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Seria dni" value={d.streak} /><Stat label="Poznane słowa" value={d.words_learned} sub={`${d.words_mastered} opanowanych`} /><Stat label="Lekcje gramatyki" value={`${d.lessons_done}/${d.lessons_total}`} sub={`${d.lessons_mastered} z testem ≥ 80%`} /><Stat label="Testy" value={t.length} sub={t.length ? `średnio ${Math.round(t.reduce((q, x) => q + x.score / x.max_score, 0) / t.length * 100)}%` : "brak"} /></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card><h2 className="font-display text-lg font-bold">Minuty nauki – 30 dni</h2><div className="mt-3"><BarChart data={days} unit=" min" /></div></Card><Card><h2 className="font-display text-lg font-bold">Poprawność za pierwszym razem – 30 dni (%)</h2><div className="mt-3"><BarChart data={acc} unit="%" /></div></Card></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card><h2 className="font-display text-lg font-bold">Wyniki kolejnych testów (%)</h2><div className="mt-3">{tests.length ? <BarChart data={tests} unit="%" /> : <p className="text-ink-soft">Brak testów.</p>}</div></Card>
      <Card><h2 className="font-display text-lg font-bold">Błędy według kategorii</h2><ul className="mt-3 flex flex-col gap-1.5">{Object.entries(cats).sort((x, y) => y[1] - x[1]).map(([k, v]) => <li key={k} className="flex justify-between"><span>{MISTAKE_CATS[k] ?? k}</span><Pill>{v}</Pill></li>)}{!Object.keys(cats).length && <li className="text-ink-soft">Brak błędów.</li>}</ul></Card></div>
    <h2 className="mt-8 font-display text-xl font-bold">Odznaki</h2>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{a.map((x) => <Card key={x.id} className={x.earned_at ? "" : "opacity-50"}><div className="text-2xl" aria-hidden>{ICON[x.icon] ?? "★"}</div><div className="mt-1 font-bold">{x.name}</div><div className="text-sm text-ink-soft">{x.description}</div><div className="mt-1 text-xs">{x.earned_at ? `Zdobyta ${new Date(x.earned_at).toLocaleDateString("pl-PL")}` : "Jeszcze nie zdobyta"}</div></Card>)}</div>
    <h2 className="mt-8 font-display text-xl font-bold">Historia aktywności</h2>
    <Card className="mt-3 overflow-x-auto p-0"><table className="w-full text-sm"><tbody>{s.slice(0, 40).map((x, i) => <tr key={i} className="border-t border-black/5 first:border-0 dark:border-white/5"><td className="p-3 whitespace-nowrap">{new Date(x.created_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}</td><td className="p-3">{x.kind}</td><td className="p-3 font-mono">{x.correct}/{x.items}</td><td className="p-3 font-mono">{Number(x.minutes).toFixed(1)} min</td></tr>)}{!s.length && <tr><td className="p-3 text-ink-soft">Brak aktywności w ostatnich 30 dniach.</td></tr>}</tbody></table></Card>
  </div>;
}
