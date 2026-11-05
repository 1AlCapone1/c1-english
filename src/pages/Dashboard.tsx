import { Link, useNavigate } from "react-router-dom";
import { dashboard, lessonProgress, listLessons } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../lib/auth";
import { BarChart, Button, Card, ErrorBox, Loading, PageHeader, Pill, Progress, Stat } from "../components/ui";

export default function Dashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useAsync(async () => {
    const [d, lessons, lp] = await Promise.all([dashboard(), listLessons(), lessonProgress()]);
    const done = new Set(lp.filter((x) => x.completed_at).map((x) => x.lesson_id));
    const next = lessons.find((l) => !done.has(l.id)) ?? null;
    return { d, next };
  });
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Brak danych"} onRetry={reload} />;
  const { d, next } = data;
  const goal = profile?.daily_goal_min ?? 20;
  const goalPct = Math.min(100, (Number(d.today_minutes) / goal) * 100);
  const course = Math.round(((d.vocab_total ? d.words_learned / d.vocab_total : 0) * 0.5 + (d.lessons_total ? d.lessons_done / d.lessons_total : 0) * 0.5) * 100);
  const days: { label: string; value: number }[] = [];
  for (let k = 13; k >= 0; k--) {
    const dt = new Date(Date.now() - k * 86400000); const key = dt.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
    const row = d.week.find((w) => w.day === key);
    days.push({ label: dt.toLocaleDateString("pl-PL", { day: "numeric" }), value: row ? Math.round(Number(row.minutes)) : 0 });
  }
  const cont = () => nav("/daily");
  return <div>
    <PageHeader eyebrow={`Poziom ${profile?.level ?? "B2"}`} title={`Cześć, ${profile?.display_name || "uczniu"}!`} lead={d.words_due > 0 ? `Masz ${d.words_due} haseł do powtórki.` : next ? `Następna lekcja: ${next.title}.` : "Wszystko na bieżąco – wybierz moduł i ćwicz dalej."}
      actions={<Button onClick={cont} data-testid="continue">Codzienna lekcja (ok. 20 min) →</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Dzienny cel</div><div className="mt-2 font-display text-3xl font-extrabold tabular-nums">{Math.round(Number(d.today_minutes))}<span className="text-base font-normal text-ink-soft"> / {goal} min</span></div><div className="mt-3"><Progress value={goalPct} tone={goalPct >= 100 ? "ok" : "accent"} /></div></Card>
      <Stat label="Seria dni nauki" value={d.streak} sub={d.streak ? "dni z rzędu" : "zacznij dziś"} />
      <Stat label="Poznane słowa" value={d.words_learned} sub={`${d.words_mastered} opanowanych · baza: ${d.vocab_total}`} />
      <Stat label="Gramatyka" value={`${d.lessons_mastered}`} sub={`opanowanych zagadnień · ukończone lekcje: ${d.lessons_done}/${d.lessons_total}`} />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Minuty nauki – ostatnie 14 dni</h2><Pill>dane z Twojego konta</Pill></div><div className="mt-3"><BarChart data={days} unit=" min" /></div></Card>
      <Card><h2 className="font-display text-lg font-bold">Realizacja kursu</h2><div className="mt-2 font-display text-4xl font-extrabold">{course}%</div><div className="mt-3"><Progress value={course} /></div><p className="mt-2 text-sm text-ink-soft">Średnia z poznanego słownictwa i ukończonych lekcji gramatyki.</p></Card>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card><h2 className="font-display text-lg font-bold">Do powtórzenia</h2><ul className="mt-3 flex flex-col gap-2">
        <li className="flex items-center justify-between"><span>Fiszki do powtórki</span><Link to="/flashcards?mode=due"><Pill tone={d.words_due ? "warn" : "ok"}>{d.words_due}</Pill></Link></li>
        <li className="flex items-center justify-between"><span>Otwarte błędy</span><Link to="/mistakes"><Pill tone={d.mistakes_open ? "bad" : "ok"}>{d.mistakes_open}</Pill></Link></li>
      </ul></Card>
      <Card><h2 className="font-display text-lg font-bold">Rekomendowana lekcja</h2>{next ? <><p className="mt-2">{next.title}</p><Link to={`/grammar/${next.slug}`} className="mt-3 inline-block"><Button size="sm" variant="quiet">Otwórz lekcję</Button></Link></> : <p className="mt-2 text-ink-soft">Ukończyłeś wszystkie dostępne lekcje. Zrób test powtórkowy.</p>}</Card>
      <Card><h2 className="font-display text-lg font-bold">Ostatnie testy</h2>{d.recent_tests.length ? <ul className="mt-3 flex flex-col gap-2">{d.recent_tests.map((t) => <li key={t.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{t.title}</span><Pill tone={t.score / t.max_score >= 0.7 ? "ok" : "warn"}>{Math.round((t.score / t.max_score) * 100)}%</Pill></li>)}</ul> : <p className="mt-2 text-ink-soft">Brak wyników. <Link className="text-accent underline dark:text-accent-dark" to="/tests">Rozwiąż pierwszy test</Link>.</p>}</Card>
    </div>
  </div>;
}
