import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { applyTheme, currentTheme, type Theme } from "../lib/theme";
import { Loading, cx } from "./ui";

const NAV: (string | [string, string, string?])[] = [
  ["/dashboard", "Pulpit"], ["/daily", "Codzienna lekcja", "☀"], ["/flashcards", "Fiszki", "★"], ["/tests", "Testy"], ["/mistakes", "Mistake Notebook"],
  "Kurs",
  ["/vocabulary", "Vocabulary", "A"], ["/grammar", "Grammar", "B"], ["/use-of-english", "Use of English", "C"], ["/reading", "Reading", "D"],
  ["/listening", "Listening", "E"], ["/writing", "Writing", "F"], ["/speaking", "Speaking", "G"],
  "Egzamin i postępy",
  ["/exam", "Exam Simulator"], ["/progress", "Postępy"], ["/settings", "Ustawienia"],
];

export function ThemeToggle() {
  const [t, setT] = useState<Theme>(currentTheme());
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const label = { system: "Motyw: systemowy", light: "Motyw: jasny", dark: "Motyw: ciemny" }[t];
  return <button className="rounded-lg px-2.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={() => { const n = next[t]; setT(n); applyTheme(n); }} aria-label={label} title={label}>
    {t === "dark" ? "☾" : t === "light" ? "☀" : "◐"} <span className="hidden sm:inline">{label.replace("Motyw: ", "")}</span></button>;
}

export function Protected({ admin = false }: { admin?: boolean }) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8"><Loading /></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (admin && profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <Shell><Outlet /></Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const items = profile?.role === "admin" ? [...NAV, ["/admin", "Panel administratora"] as [string, string]] : NAV;
  const nav = <nav aria-label="Nawigacja" className="flex flex-col gap-0.5">
    {items.map((n, i) => typeof n === "string"
      ? <div key={i} className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-widest text-ink-soft dark:text-[#9AA3B8]">{n}</div>
      : <NavLink key={n[0]} to={n[0]} className={({ isActive }) => cx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.95rem]", isActive ? "bg-accent-soft font-bold text-accent dark:bg-[#232E55] dark:text-accent-dark" : "hover:bg-black/5 dark:hover:bg-white/5")}>
          <span className={cx("grid h-5 w-5 place-items-center rounded border font-mono text-[11px]", n[2] ? "border-current opacity-80" : "border-transparent")}>{n[2] ?? ""}</span>{n[1]}</NavLink>)}
  </nav>;
  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#161D2E]/90">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <button className="rounded-lg p-2 lg:hidden hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>☰</button>
        <NavLink to="/dashboard" className="flex items-center gap-2 font-display text-lg font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-accent text-xs text-accent dark:border-accent-dark dark:text-accent-dark">C1</span>C1 English Academy</NavLink>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <span className="hidden max-w-[12rem] truncate text-sm text-ink-soft md:inline dark:text-[#9AA3B8]">{profile?.display_name}</span>
          <button className="rounded-lg px-2.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={signOut}>Wyloguj</button>
        </div>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl lg:grid-cols-[240px_1fr]">
      <aside className={cx("border-r border-black/10 p-3 dark:border-white/10 lg:sticky lg:top-[57px] lg:block lg:h-[calc(100vh-57px)] lg:overflow-y-auto", open ? "block" : "hidden")}>{nav}</aside>
      <main className="min-w-0 px-4 pb-16 pt-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  </div>;
}
