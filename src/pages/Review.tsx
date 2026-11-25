import { useState } from "react";
import { srsOverview, srsQueue, updateProfile } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../lib/auth";
import { useEnter } from "../lib/keys";
import { BarChart, Button, Card, ErrorBox, Feedback, Loading, PageHeader, Stat, inputCls } from "../components/ui";
import { WordPreview } from "../components/WordPreview";
import { Session, pickMode, type FlashCard } from "./Flashcards";

/**
 * Powtórki (SRS) – spaced repetition: every word comes back exactly when you are about to forget it.
 * Session = all cards due now (most overdue first) + a daily limit of new words.
 * After a correct answer you rate it (Trudne / Dobre / Łatwe) and the scheduler (SM-2) sets the next date.
 */
export default function Review() {
  const { refreshProfile } = useAuth();
  const ov = useAsync(srsOverview);
  const [session, setSession] = useState<{ cards: FlashCard[]; started: boolean; fresh: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  async function start() {
    if (!ov.data) return;
    setBusy(true); setErr(null);
    try {
      const q = await srsQueue(limit, ov.data.newLeft);
      const cards: FlashCard[] = [...q.due, ...q.fresh].map((v) => ({ v, mode: pickMode(v, "mix") }));
      if (!cards.length) { setErr("Na teraz nie ma nic do powtórki, a limit nowych słów na dziś jest wykorzystany."); return; }
      setSession({ cards, started: false, fresh: q.fresh.length });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const ready = !!ov.data && (ov.data.dueNow > 0 || ov.data.newLeft > 0);
  useEnter(() => { void start(); }, !session && ready && !busy);

  if (session && !session.started) return <WordPreview words={session.cards.map((c) => c.v)} title="Powtórka SRS – hasła"
    lead={`${session.cards.length - session.fresh} do powtórki${session.fresh ? ` i ${session.fresh} nowych` : ""}. Przejrzyj je, a potem zaczynamy. Po każdej poprawnej odpowiedzi ocenisz, jak łatwo było ją sobie przypomnieć.`}
    startLabel="Zaczynamy powtórkę →" onStart={() => setSession({ ...session, started: true })} onBack={() => setSession(null)}
    onRemove={(v) => setSession((s) => s && { ...s, cards: s.cards.filter((c) => c.v.id !== v.id) })}
    onRestore={(v) => setSession((s) => s && { ...s, cards: [...s.cards, { v, mode: pickMode(v, "mix") }] })} />;
  if (session) return <Session cards={session.cards} source="srs" onExit={() => { setSession(null); ov.reload(); }} />;
  if (ov.loading) return <Loading />;
  if (ov.error || !ov.data) return <ErrorBox error={ov.error ?? ""} onRetry={ov.reload} />;
  const d = ov.data;
  const fc = d.forecast.map((f, i) => ({ label: i === 0 ? "dziś" : new Date(f.day).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric" }), value: f.count }));

  return <div className="max-w-3xl" data-testid="srs-page">
    <PageHeader eyebrow="Spaced repetition" title="Powtórki (SRS)"
      lead="Każde słowo wraca dokładnie wtedy, gdy zaczynasz je zapominać. Po poprawnej odpowiedzi oceniasz ją: Trudne, Dobre albo Łatwe – i na tej podstawie system ustala następną powtórkę (za 1 dzień, 3 dni, tydzień, miesiąc…). Błąd = słowo wraca za 10 minut." />
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Do powtórki teraz" value={<span data-testid="srs-due">{d.dueNow}</span>} sub={`dziś łącznie ${d.dueToday}`} />
      <Stat label="Nowe słowa dziś" value={d.newLeft} sub={`limit ${d.newPerDay} dziennie`} />
      <Stat label="Skuteczność (30 dni)" value={d.retention === null ? "–" : `${d.retention}%`} sub={`${d.reviews30} powtórek`} />
    </div>
    <Card className="mt-4">
      {ready ? <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy} data-testid="srs-start">{busy ? "Przygotowuję…" : `Rozpocznij powtórkę (${Math.min(limit, d.dueNow) + d.newLeft})`}</Button>
        <label className="flex items-center gap-2 text-sm">maks. powtórek w sesji
          <select className={inputCls + " w-auto"} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <span className="hidden text-xs text-ink-soft sm:inline">lub Enter</span>
      </div> : <Feedback tone="ok" title="Wszystko powtórzone!">Na dziś nie ma więcej powtórek, a limit nowych słów jest wykorzystany. Wróć jutro – albo zwiększ limit nowych słów poniżej.</Feedback>}
      {err && <div className="mt-3"><Feedback tone="warn">{err}</Feedback></div>}
    </Card>
    <Card className="mt-4"><h2 className="font-display text-lg font-bold">Prognoza powtórek – 14 dni</h2>
      <p className="mt-1 text-sm text-ink-soft">Ile słów będzie do powtórzenia każdego dnia (dziś = także zaległe).</p>
      <div className="mt-3"><BarChart data={fc} /></div></Card>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Stat label="W nauce (krótko)" value={d.learning} sub="wracają w ciągu minut/dni" />
      <Stat label="Młode" value={d.young} sub="odstęp < 21 dni" />
      <Stat label="Dojrzałe" value={d.matureCount} sub="odstęp ≥ 21 dni" />
    </div>
    <Card className="mt-4"><h2 className="font-display text-lg font-bold">Ustawienia</h2>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">Nowe słowa dziennie
        <select className={inputCls + " w-auto"} value={d.newPerDay} data-testid="srs-new-limit" onChange={async (e) => { try { await updateProfile({ srs_new_per_day: Number(e.target.value) }); await refreshProfile(); ov.reload(); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } }}>
          {[0, 5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <p className="mt-2 text-sm text-ink-soft">Więcej nowych słów = więcej powtórek w kolejnych dniach (każde nowe słowo wraca ok. 5–6 razy w pierwszym miesiącu). Słowa z codziennej lekcji też trafiają do powtórek.</p>
    </Card>
  </div>;
}
