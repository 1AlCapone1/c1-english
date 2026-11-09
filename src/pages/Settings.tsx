import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { listHidden, unhideWord, updateProfile } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { supabase, translateError } from "../lib/supabase";
import { applyTheme } from "../lib/theme";
import { Button, Card, Feedback, Loading, PageHeader, inputCls } from "../components/ui";
import type { Level } from "../lib/types";

export default function Settings() {
  const { profile, session, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? ""); const [level, setLevel] = useState<Level>(profile?.level ?? "B2"); const [goal, setGoal] = useState(profile?.daily_goal_min ?? 20); const [theme, setTheme] = useState(profile?.theme ?? "system");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; t: string } | null>(null);
  const [pw, setPw] = useState(""); const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "bad"; t: string } | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (name.trim().length < 2) return setMsg({ tone: "bad", t: "Nazwa musi mieć co najmniej 2 znaki." });
    try { await updateProfile({ display_name: name.trim().slice(0, 60), level, daily_goal_min: goal, theme }); applyTheme(theme); await refreshProfile(); setMsg({ tone: "ok", t: "Zapisano." }); } catch (er) { setMsg({ tone: "bad", t: er instanceof Error ? er.message : String(er) }); }
  }
  async function changePw(e: FormEvent) {
    e.preventDefault(); setPwMsg(null);
    if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) return setPwMsg({ tone: "bad", t: "Hasło musi mieć co najmniej 8 znaków, w tym literę i cyfrę." });
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwMsg(error ? { tone: "bad", t: translateError(error.message) } : { tone: "ok", t: "Hasło zmienione." }); setPw("");
  }
  return <div className="max-w-2xl">
    <PageHeader title="Ustawienia konta" lead={session?.user.email} />
    <Card><form onSubmit={save} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-bold">Imię lub pseudonim<input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Aktualny poziom<select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as Level)}>{["B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Dzienny cel (minuty)<select className={inputCls} value={goal} onChange={(e) => setGoal(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm font-bold">Motyw<select className={inputCls} value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}><option value="system">Systemowy</option><option value="light">Jasny</option><option value="dark">Ciemny</option></select></label>
      {msg && <Feedback tone={msg.tone}>{msg.t}</Feedback>}
      <div><Button type="submit">Zapisz</Button></div></form></Card>
    <Card className="mt-4"><h2 className="font-display text-lg font-bold">Zmiana hasła</h2><form onSubmit={changePw} className="mt-3 flex flex-col gap-3"><input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nowe hasło" autoComplete="new-password" aria-label="Nowe hasło" />{pwMsg && <Feedback tone={pwMsg.tone}>{pwMsg.t}</Feedback>}<div><Button type="submit" variant="quiet">Zmień hasło</Button></div></form></Card>
    <HiddenWords />
  </div>;
}


/** Words removed with "Wyrzuć" – they are not offered in flashcards and daily lessons until restored. */
function HiddenWords() {
  const list = useAsync(listHidden);
  const [busy, setBusy] = useState<string | null>(null);
  return <div data-testid="hidden-words"><Card className="mt-4"><h2 className="font-display text-lg font-bold">Wyrzucone słowa</h2>
    <p className="mt-1 text-sm text-ink-soft">Hasła, które wyrzuciłeś z nauki. Nie pojawiają się w fiszkach ani w codziennej lekcji. Przywróć, jeśli chcesz się ich jednak uczyć.</p>
    {list.loading ? <Loading /> : list.error ? <Feedback tone="warn">{list.error}</Feedback> : !list.data?.length ? <p className="mt-3 text-sm">Brak wyrzuconych słów.</p> :
      <ul className="mt-3">{list.data.map((v) => <li key={v.id} className="flex items-center justify-between gap-3 border-t border-black/5 py-2 first:border-0 dark:border-white/5">
        <span><b>{v.term}</b> <span className="text-ink-soft">– {v.translation_pl}</span></span>
        <Button size="sm" variant="quiet" disabled={busy === v.id} onClick={async () => { setBusy(v.id); try { await unhideWord(v.id); list.reload(); } finally { setBusy(null); } }}>Przywróć</Button></li>)}</ul>}
  </Card></div>;
}
