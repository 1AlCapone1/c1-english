import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase, translateError } from "../lib/supabase";
import { Button, Card, Feedback, inputCls } from "../components/ui";
import { ThemeToggle } from "../components/Layout";
import { classifyAuthError, isTokenHash, peekAuthLink, type AuthLink, type ConfirmProblem } from "../lib/authRedirect";

export const appUrl = () => window.location.origin + import.meta.env.BASE_URL;
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
      {err?.startsWith("Potwierdź adres e-mail") && <ResendVerification initialEmail={email} compact />}
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
  if (ok) return <AuthFrame title="Sprawdź skrzynkę"><Feedback tone="ok" title="Konto utworzone">Wysłaliśmy link potwierdzający na {email}. Otwórz wiadomość, kliknij link, a potem „Potwierdź weryfikację”.</Feedback>
    <div className="mt-4 flex flex-col gap-3"><Link to="/login"><Button variant="quiet">Przejdź do logowania</Button></Link><ResendVerification initialEmail={email} compact /></div></AuthFrame>;
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() + "?type=recovery" });
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


const PROBLEM: Record<ConfirmProblem, { title: string; text: string; resend: boolean; retry: boolean }> = {
  expired: { title: "Link wygasł lub został już użyty", text: "Linki weryfikacyjne są jednorazowe i ważne przez ograniczony czas. Jeśli konto zostało już potwierdzone, po prostu się zaloguj. W przeciwnym razie wyślij nowy link.", resend: true, retry: false },
  invalid: { title: "Nieprawidłowy link weryfikacyjny", text: "Link jest niepełny lub uszkodzony (zdarza się przy kopiowaniu adresu z wiadomości). Otwórz link bezpośrednio z e-maila albo wyślij nowy.", resend: true, retry: false },
  other_device: { title: "Konto zostało pomyślnie zweryfikowane", text: "Adres e-mail jest potwierdzony. Link otwarto na innym urządzeniu lub w innej przeglądarce niż rejestracja, dlatego zaloguj się tutaj swoim e-mailem i hasłem.", resend: false, retry: false },
  already: { title: "To konto jest już zweryfikowane", text: "Adres e-mail został potwierdzony wcześniej. Możesz się zalogować.", resend: false, retry: false },
  server: { title: "Błąd serwera", text: "Serwer logowania nie odpowiedział poprawnie. Spróbuj ponownie za chwilę – Twój link nadal może być ważny.", resend: false, retry: true },
  network: { title: "Problem z połączeniem", text: "Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie – link nie został jeszcze wykorzystany.", resend: false, retry: true },
};

/** #/auth/confirm – processes links from verification and password-reset e-mails. Never renders an empty page. */
export function ConfirmEmail() {
  const nav = useNavigate();
  const linkRef = useRef<AuthLink | null>(null);
  if (linkRef.current === null) linkRef.current = peekAuthLink() ?? { tokenHash: null, type: null, code: null, error: null, errorCode: null, errorDescription: null };
  const link = linkRef.current;
  const recovery = link.type === "recovery";
  type State = { s: "ready" } | { s: "working" } | { s: "success"; loggedIn: boolean } | { s: "problem"; p: ConfirmProblem; detail?: string } | { s: "nolink" };
  const initial: State = link.error || link.errorCode ? { s: "problem", p: classifyAuthError(link.errorCode, link.errorDescription ?? link.error) }
    : link.code ? { s: "working" } : link.tokenHash ? (isTokenHash(link.tokenHash) ? { s: "ready" } : { s: "problem", p: "invalid" }) : { s: "nolink" };
  const [st, setSt] = useState<State>(initial);
  const ran = useRef(false);

  async function afterProblem(p: ConfirmProblem, detail?: string) {
    if (p === "expired") { // a used link for an account that is already confirmed and signed in → say so
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (data.session?.user.email_confirmed_at) return setSt({ s: "problem", p: "already" });
    }
    setSt({ s: "problem", p, detail });
  }
  async function confirmToken() {
    if (!link.tokenHash) return;
    setSt({ s: "working" });
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: recovery ? "recovery" : link.type === "email_change" ? "email_change" : "email" });
      if (error) return afterProblem(classifyAuthError((error as { code?: string }).code, error.message, (error as { status?: number }).status), error.message);
      if (recovery) return nav("/update-password", { replace: true });
      setSt({ s: "success", loggedIn: !!data.session });
    } catch (e) { afterProblem(classifyAuthError("network", e instanceof Error ? e.message : String(e))); }
  }
  useEffect(() => {
    if (!link.code || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(link.code!);
        if (error) {
          const p = classifyAuthError((error as { code?: string }).code, error.message, (error as { status?: number }).status);
          // The code is only issued after Supabase has verified the e-mail, so a missing verifier means "verified, but log in here".
          return afterProblem(p === "invalid" ? "other_device" : p, error.message);
        }
        if (recovery) return nav("/update-password", { replace: true });
        setSt({ s: "success", loggedIn: !!data.session });
      } catch (e) { afterProblem(classifyAuthError("network", e instanceof Error ? e.message : String(e))); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const title = st.s === "success" ? "Konto zostało pomyślnie zweryfikowane" : st.s === "problem" ? PROBLEM[st.p].title : recovery ? "Reset hasła" : "Weryfikacja konta";
  return <AuthFrame title={title}>
    <div data-testid="confirm-state" data-state={st.s === "problem" ? st.p : st.s} className="flex flex-col gap-4">
      {st.s === "ready" && <><p className="text-ink-soft">{recovery ? "Kliknij przycisk, aby przejść do ustawienia nowego hasła." : "Kliknij przycisk, aby potwierdzić swój adres e-mail i aktywować konto."}</p>
        <Button onClick={confirmToken} data-testid="confirm-button">{recovery ? "Ustaw nowe hasło" : "Potwierdź weryfikację"}</Button></>}
      {st.s === "working" && <p className="text-ink-soft" aria-live="polite">Sprawdzanie linku…</p>}
      {st.s === "success" && <><Feedback tone="ok" title="Konto zostało pomyślnie zweryfikowane">Twój adres e-mail jest potwierdzony. {st.loggedIn ? "Jesteś już zalogowany – możesz zaczynać naukę." : "Zaloguj się, aby rozpocząć naukę."}</Feedback>
        {st.loggedIn ? <Button onClick={() => nav("/dashboard", { replace: true })} data-testid="confirm-continue">Przejdź do aplikacji</Button> : <Button onClick={() => nav("/login", { replace: true })} data-testid="confirm-continue">Zaloguj się</Button>}</>}
      {st.s === "problem" && <>
        <Feedback tone={st.p === "other_device" || st.p === "already" ? "ok" : st.p === "network" || st.p === "server" ? "warn" : "bad"} title={PROBLEM[st.p].title}>{PROBLEM[st.p].text}</Feedback>
        {PROBLEM[st.p].retry && link.tokenHash && <Button onClick={confirmToken}>Spróbuj ponownie</Button>}
        {PROBLEM[st.p].retry && !link.tokenHash && <Button onClick={() => window.location.reload()}>Odśwież stronę</Button>}
        {(st.p === "other_device" || st.p === "already" || st.p === "expired") && <Button variant={st.p === "expired" ? "quiet" : "primary"} onClick={() => nav("/login", { replace: true })} data-testid="confirm-login">Zaloguj się</Button>}
        {PROBLEM[st.p].resend && !recovery && <ResendVerification />}
        {PROBLEM[st.p].resend && recovery && <Link to="/reset"><Button variant="quiet">Wyślij nowy link do resetu hasła</Button></Link>}
      </>}
      {st.s === "nolink" && <><p className="text-ink-soft">Ta strona obsługuje linki z wiadomości e-mail. Nie znaleziono w adresie danych weryfikacyjnych – otwórz link bezpośrednio z wiadomości albo wyślij nowy.</p>
        <Button variant="quiet" onClick={() => nav("/login", { replace: true })}>Zaloguj się</Button><ResendVerification /></>}
    </div>
  </AuthFrame>;
}

/** Re-send the sign-up confirmation e-mail. */
export function ResendVerification({ initialEmail = "", compact = false }: { initialEmail?: string; compact?: boolean }) {
  const [email, setEmail] = useState(initialEmail); const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad" | "warn"; t: string } | null>(null);
  const [open, setOpen] = useState(!compact);
  async function send(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!emailOk(email)) return setMsg({ tone: "bad", t: "Podaj poprawny adres e-mail." });
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: appUrl() } });
      if (error) {
        const p = classifyAuthError((error as { code?: string }).code, error.message, (error as { status?: number }).status);
        setMsg(p === "already" ? { tone: "ok", t: "To konto jest już zweryfikowane – możesz się zalogować." } : { tone: "bad", t: translateError(error.message) });
      } else setMsg({ tone: "ok", t: `Jeśli konto ${email.trim()} czeka na potwierdzenie, wysłaliśmy nowy link. Sprawdź też folder spam.` });
    } catch (err) { setMsg({ tone: "warn", t: translateError(err instanceof Error ? err.message : String(err)) }); }
    setBusy(false);
  }
  if (!open) return <button type="button" className="text-left text-sm font-bold text-accent dark:text-accent-dark" onClick={() => setOpen(true)} data-testid="resend-open">Nie dostałeś wiadomości? Wyślij link ponownie</button>;
  return <form onSubmit={send} className="flex flex-col gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10" noValidate data-testid="resend-form">
    <div className="text-sm font-bold">Wyślij nowy link weryfikacyjny</div>
    <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" aria-label="E-mail do ponownej weryfikacji" />
    {msg && <Feedback tone={msg.tone}>{msg.t}</Feedback>}
    <Button type="submit" variant="quiet" disabled={busy} data-testid="resend-submit">{busy ? "Wysyłanie…" : "Wyślij ponownie"}</Button>
  </form>;
}
