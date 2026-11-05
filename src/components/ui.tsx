import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { diffSegments, type Seg } from "../lib/answer";

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost" | "danger"; size?: "sm" | "md" };
export function Button({ variant = "primary", size = "md", className, ...p }: BtnProps) {
  return <button {...p} className={cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed",
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5",
    variant === "primary" && "bg-accent text-white hover:brightness-110 dark:bg-accent-dark dark:text-[#0E1320]",
    variant === "quiet" && "bg-black/5 text-ink hover:bg-black/10 dark:bg-white/10 dark:text-[#E5E8F1] dark:hover:bg-white/15",
    variant === "ghost" && "text-accent hover:bg-accent-soft dark:text-accent-dark dark:hover:bg-white/5",
    variant === "danger" && "border border-red-600 text-red-700 hover:bg-red-50 dark:text-red-300 dark:border-red-400 dark:hover:bg-red-950",
    className)} />;
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#161D2E]", className)}>{children}</div>;
}
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "bad" | "warn" | "accent" }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
    tone === "neutral" && "bg-black/5 text-ink-soft dark:bg-white/10 dark:text-[#9AA3B8]",
    tone === "ok" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    tone === "bad" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    tone === "warn" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    tone === "accent" && "bg-accent-soft text-accent dark:bg-[#232E55] dark:text-accent-dark")}>{children}</span>;
}
export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "ok" | "warn" | "bad" }) {
  const v = Math.max(0, Math.min(100, value));
  return <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
    <div className={cx("h-full rounded-full transition-all duration-500", tone === "accent" && "bg-accent dark:bg-accent-dark", tone === "ok" && "bg-emerald-600", tone === "warn" && "bg-amber-500", tone === "bad" && "bg-red-600")} style={{ width: `${v}%` }} />
  </div>;
}
export function Loading({ label = "Wczytywanie…" }: { label?: string }) {
  return <div className="flex items-center gap-3 py-10 text-ink-soft dark:text-[#9AA3B8]" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{label}</div>;
}
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200" role="alert"><b>Coś poszło nie tak.</b> {error}{onRetry && <div className="mt-2"><Button size="sm" variant="quiet" onClick={onRetry}>Spróbuj ponownie</Button></div>}</div>;
}
export function Feedback({ tone, title, children }: { tone: "ok" | "bad" | "warn" | "info"; title?: ReactNode; children?: ReactNode }) {
  return <div className={cx("flex animate-pop flex-col gap-1.5 rounded-lg p-3.5 text-[0.95rem]",
    tone === "ok" && "bg-emerald-50 dark:bg-emerald-950/60", tone === "bad" && "bg-red-50 dark:bg-red-950/60", tone === "warn" && "bg-amber-50 dark:bg-amber-950/60", tone === "info" && "bg-black/5 dark:bg-white/5")} role={tone === "bad" ? "alert" : undefined}>
    {title && <b className="font-display">{title}</b>}{children}</div>;
}
export function PageHeader({ eyebrow, title, lead, actions }: { eyebrow?: string; title: string; lead?: ReactNode; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="max-w-3xl">
    {eyebrow && <div className="text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-[#9AA3B8]">{eyebrow}</div>}
    <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
    {lead && <p className="mt-2 text-lg text-ink-soft dark:text-[#9AA3B8]">{lead}</p>}</div>{actions}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-black/20 p-8 text-center dark:border-white/20"><b className="font-display text-lg">{title}</b><div className="mt-2 text-ink-soft dark:text-[#9AA3B8]">{children}</div></div>;
}
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-[#9AA3B8]">{label}</div><div className="mt-2 font-display text-3xl font-extrabold tabular-nums">{value}</div>{sub && <div className="mt-1 text-sm text-ink-soft dark:text-[#9AA3B8]">{sub}</div>}</Card>;
}
export function Diff({ user, right }: { user: string; right: string }) {
  const d = diffSegments(user, right);
  const row = (segs: Seg[], tone: "bad" | "ok") => <span className="font-mono">{segs.map((s, i) => s.bad ? <mark key={i} className={tone === "bad" ? "rounded bg-red-200 px-0.5 text-red-900 underline decoration-wavy dark:bg-red-900 dark:text-red-100" : "rounded bg-emerald-200 px-0.5 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"}>{s.t}</mark> : <span key={i}>{s.t}</span>)}</span>;
  return <div className="grid gap-2 rounded-md bg-white p-2.5 text-sm sm:grid-cols-2 dark:bg-[#0E1320]"><div><div className="text-xs text-ink-soft">Twoja odpowiedź</div>{row(d.u, "bad")}</div><div><div className="text-xs text-ink-soft">Poprawnie</div>{row(d.r, "ok")}</div></div>;
}
/** Simple accessible bar chart (SVG, scaled to data). */
export function BarChart({ data, unit = "", height = 160 }: { data: { label: string; value: number }[]; unit?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value)); const W = Math.max(280, data.length * 34); const H = height; const P = 24;
  const bw = (W - P * 2) / Math.max(1, data.length) - 6;
  return <div className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full min-w-[280px]" role="img" aria-label="Wykres">
    {[0, 0.5, 1].map((t) => <g key={t}><line x1={P} x2={W - P} y1={P + (H - P) * (1 - t)} y2={P + (H - P) * (1 - t)} className="stroke-black/10 dark:stroke-white/10" /><text x={P - 4} y={P + (H - P) * (1 - t) + 4} textAnchor="end" className="fill-ink-soft text-[10px]">{Math.round(max * t)}</text></g>)}
    {data.map((d, i) => { const h = ((H - P) * d.value) / max; const x = P + i * (bw + 6) + 3; return <g key={i}>
      <rect x={x} y={P + (H - P) - h} width={bw} height={Math.max(h, d.value ? 2 : 0)} rx={3} className="fill-accent dark:fill-accent-dark"><title>{`${d.label}: ${d.value}${unit}`}</title></rect>
      <text x={x + bw / 2} y={H + 16} textAnchor="middle" className="fill-ink-soft text-[10px]">{d.label}</text></g>; })}
  </svg></div>;
}
export function Confirm({ label, onConfirm, children }: { label: string; onConfirm: () => void; children: ReactNode }) {
  const [ask, setAsk] = useState(false);
  return ask ? <span className="inline-flex items-center gap-2"><span className="text-sm">{label}</span><Button size="sm" variant="danger" onClick={() => { setAsk(false); onConfirm(); }}>Tak</Button><Button size="sm" variant="quiet" onClick={() => setAsk(false)}>Nie</Button></span>
    : <span onClick={() => setAsk(true)}>{children}</span>;
}
export const inputCls = "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/15 dark:bg-[#0E1320] dark:focus:border-accent-dark";
export const answerCls = "w-full max-w-xl border-0 border-b-2 border-ink bg-transparent px-1 py-2 font-mono text-lg outline-none focus:border-accent focus:bg-accent-soft/50 dark:border-[#E5E8F1] dark:focus:border-accent-dark dark:focus:bg-white/5";
