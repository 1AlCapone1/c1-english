import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase, translateError } from "../lib/supabase";
import { Button, Card, Feedback, inputCls } from "../components/ui";
import { ThemeToggle } from "../components/Layout";

const appUrl = () => window.location.origin + import.meta.env.BASE_URL;
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function AuthFrame({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return <div className="min-h-screen px-4 py-10"><div className="mx-auto max-w-md">
    <div className="mb-6 flex items-center justify-between"><Link to="/" className="font-display text-lg font-extrabold">C1 English Academy</Link><ThemeToggle /></div>
    <Card><h1 className="mb-5 font-display text-2xl font-extrabold">{title}</h1>{children}</Card>
    {footer && <div className="mt-4 text-center text-sm">{footer}</div>}
  </div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex flex-col gap-1.5 text-sm font-bold">{label}{children}</label>; }

export function Landing() {
  const features = [["Fiszki z obowiązkową poprawą", "Po błędzie widzisz, co dokładnie jest nie tak, i wpisujesz odpowiedź z pamięci, aż będzie dobrze."], ["Kurs gramatyki C1", "Lekcje po polsku: zastosowanie, budowa, przykłady z tłumaczeniem, typowe błędy Polaków, ćwiczenia i test."], ["Use of English i Reading", "Zadania w formacie Cambridge C1 Advanced z wyjaśnieniem każdej odpowiedzi."], ["Exam Simulator", "Egzamin próbny z limitem czasu, analizą mocnych i słabych stron oraz planem dalszej nauki."], ["Mistake Notebook", "Każdy błąd trafia do Twojego notatnika – możesz go filtrować, powtarzać i oznaczać jako opanowany."], ["Statystyki i powtórki", "Seria dni, odznaki, wykresy i system powtórek w odstępach."]];
  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4"><span className="font-display text-lg font-extrabold">C1 English Academy</span><div className="ml-auto flex items-center gap-2"><ThemeToggle /><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10">Zaloguj się</Link></div></header>
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-8">
      <div className="max-w-3xl"><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Angielski B2 → C1</div>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Ucz się aktywnie. Poprawiaj każdy błąd.</h1>
        <p className="mt-4 text-lg text-ink-soft dark:text-[#9AA3B8]">Kurs przygotowujący do poziomu C1 i egzaminu Cambridge C1 Advanced. Wyjaśnienia po polsku, materiały po angielsku, postępy zapisane na Twoim koncie.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link to="/register"><Button>Załóż darmowe konto</Button></Link><Link to="/login"><Button variant="quiet">Mam już konto</Button></Link></div></div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([t, d]) => <Card key={t}><h3 className="font-display text-lg font-bold">{t}</h3><p className="mt-2 text-ink-soft dark:text-[#9AA3B8]">{d}</p></Card>)}</div>
    </section>
  </div>;
}

export function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const nav = useNavigate(); const loc = useLocation() as { state?: { from?: string } };
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (!emailOk(email)) return setErr("Podaj poprawny adres e-mail.");
    if (!password) return setErr("Podaj hasło.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr(translateError(error.message));
    nav(loc.state?.from || "/dashboard", { replace: true });
  }
  return <AuthFrame title="Zaloguj się" footer={<>Nie masz konta? <Link className="font-bold text-accent dark:text-accent-dark" to="/register">Zarejestruj się</Link></>}>
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="E-mail"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="email" /></Field>
      <Field label="Hasło"><input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="password" /></Field>
      {err && <Feedback tone="bad">{err}</Feedback>}
      <Button type="submit" disabled={busy} data-testid="login-submit">{busy ? "Logowanie…" : "Zaloguj się"}</Button>
      <Link className="text-sm text-accent dark:text-accent-dark" to="/reset">Nie pamiętasz hasła?</Link>
    </form>
  </AuthFrame>;
}

export function Register() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [password2, setPassword2] = useState("");
  const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (name.trim().length < 2) return setErr("Podaj imię lub pseudonim (min. 2 znaki).");
    if (!emailOk(email)) return setErr("Podaj poprawny adres e-mail.");
    if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) return setErr("Hasło musi mieć co najmniej 8 znaków, w tym literę i cyfrę.");
    if (password !== password2) return setErr("Hasła nie są takie same.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim().slice(0, 60) }, emailRedirectTo: appUrl() } });
    setBusy(false);
    if (error) return setErr(translateError(error.message));
    if (data.session) nav("/dashboard", { replace: true }); else setOk(true);
  }
  if (ok) return <AuthFrame title="Sprawdź skrzynkę"><Feedback tone="ok" title="Konto utworzone">Wysłaliśmy link potwierdzający na {email}. Kliknij go, a potem zaloguj się.</Feedback><div className="mt-4"><Link to="/login"><Button variant="quiet">Przejdź do logowania</Button></Link></div></AuthFrame>;
  return <AuthFrame title="Załóż konto" footer={<>Masz już konto? <Link className="font-bold text-accent dark:text-accent-dark" to="/login">Zaloguj się</Link></>}>
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Imię lub pseudonim"><input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="nickname" /></Field>
      <Field label="E-mail"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Hasło (min. 8 znaków, litera i cyfra)"><input className={inputCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Field label="Powtórz hasło"><input className={inputCls} type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} /></Field>
      {err && <Feedback tone="bad">{err}</Feedback>}
      <Button type="submit" disabled={busy}>{busy ? "Tworzenie konta…" : "Załóż konto"}</Button>
    </form>
  </AuthFrame>;
}

export function ResetPassword() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (!emailOk(email)) return setErr("Podaj poprawny adres e-mail.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setBusy(false);
    if (error) return setErr(translateError(error.message));
    setSent(true);
  }
  return <AuthFrame title="Reset hasła" footer={<Link className="text-accent dark:text-accent-dark" to="/login">Wróć do logowania</Link>}>
    {sent ? <Feedback tone="ok" title="Sprawdź skrzynkę">Jeśli konto z adresem {email} istnieje, wysłaliśmy link do ustawienia nowego hasła.</Feedback>
      : <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-ink-soft">Podaj adres e-mail konta. Wyślemy link do ustawienia nowego hasła.</p>
        <Field label="E-mail"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {err && <Feedback tone="bad">{err}</Feedback>}
        <Button type="submit" disabled={busy}>{busy ? "Wysyłanie…" : "Wyślij link"}</Button>
      </form>}
  </AuthFrame>;
}

export function UpdatePassword() {
  const [p1, setP1] = useState(""); const [p2, setP2] = useState(""); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    if (p1.length < 8 || !/[0-9]/.test(p1) || !/[A-Za-z]/.test(p1)) return setErr("Hasło musi mieć co najmniej 8 znaków, w tym literę i cyfrę.");
    if (p1 !== p2) return setErr("Hasła nie są takie same.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr(translateError(error.message));
    setOk(true);
  }
  return <AuthFrame title="Ustaw nowe hasło">
    {ok ? <><Feedback tone="ok" title="Hasło zmienione">Możesz korzystać z aplikacji.</Feedback><div className="mt-4"><a href={import.meta.env.BASE_URL + "#/dashboard"} onClick={() => setTimeout(() => window.location.reload(), 50)}><Button>Przejdź do pulpitu</Button></a></div></>
      : <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Nowe hasło"><input className={inputCls} type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
        <Field label="Powtórz hasło"><input className={inputCls} type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
        {err && <Feedback tone="bad">{err}</Feedback>}
        <Button type="submit" disabled={busy}>{busy ? "Zapisywanie…" : "Zapisz hasło"}</Button>
      </form>}
  </AuthFrame>;
}
