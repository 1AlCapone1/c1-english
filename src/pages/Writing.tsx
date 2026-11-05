import { useEffect, useState } from "react";
import { deleteSubmission, listWritingGuides, mySubmissions, saveSubmission } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { Button, Card, Confirm, ErrorBox, Feedback, Loading, PageHeader, Pill, cx, inputCls } from "../components/ui";
import type { WritingGuide } from "../lib/types";

const wc = (t: string) => (t.trim().match(/[A-Za-zÀ-ž0-9'’-]+/g) || []).length;

export default function Writing() {
  const guides = useAsync(listWritingGuides);
  const subs = useAsync(mySubmissions);
  const [type, setType] = useState<string>("essay");
  const [tab, setTab] = useState<"guide" | "write" | "mine">("guide");
  const [draft, setDraft] = useState<{ id?: string; task: string; body: string; self: Record<string, number> }>({ task: "", body: "", self: {} });
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const g = guides.data?.find((x) => x.type === type) as WritingGuide | undefined;
  useEffect(() => { if (g && !draft.task) setDraft((d) => ({ ...d, task: g.content.tasks[0] ?? "" })); }, [g]); // eslint-disable-line
  if (guides.loading) return <Loading />;
  if (guides.error || !guides.data) return <ErrorBox error={guides.error ?? ""} onRetry={guides.reload} />;
  async function save() {
    setBusy(true); setMsg(null);
    try { const row = await saveSubmission({ id: draft.id, type, task: draft.task, body: draft.body, self_assessment: Object.keys(draft.self).length ? draft.self : null }) as { id: string }; setDraft((d) => ({ ...d, id: row.id })); setMsg({ tone: "ok", text: "Zapisano na Twoim koncie." }); subs.reload(); }
    catch (e) { setMsg({ tone: "bad", text: e instanceof Error ? e.message : String(e) }); } finally { setBusy(false); }
  }
  const words = wc(draft.body);
  return <div className="max-w-4xl">
    <PageHeader eyebrow="Moduł F" title="Writing" lead="Przygotowanie do części Writing Cambridge C1 Advanced: wymagania, struktura, zwroty, przykładowa praca C1, kryteria i zadania do napisania." />
    <div className="mb-4 flex flex-wrap gap-2">{guides.data.map((x) => <button key={x.type} onClick={() => { setType(x.type); setDraft({ task: x.content.tasks[0] ?? "", body: "", self: {} }); setTab("guide"); }} className={cx("rounded-full border px-3 py-1.5 text-sm", type === x.type ? "bg-ink font-bold text-white dark:bg-white dark:text-ink" : "border-black/15 dark:border-white/15")}>{x.title}</button>)}</div>
    <div className="mb-4 flex gap-1 border-b border-black/10 dark:border-white/10">{([["guide", "Poradnik"], ["write", "Napisz"], ["mine", `Moje prace (${subs.data?.length ?? 0})`]] as const).map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-3 py-2 text-sm", tab === k ? "border-accent font-bold text-accent dark:border-accent-dark dark:text-accent-dark" : "border-transparent")}>{n}</button>)}</div>
    {g && tab === "guide" && <div className="flex flex-col gap-4">
      <Card><h2 className="font-display text-lg font-bold">Wymagania</h2><p className="mt-2">{g.content.requirements}</p></Card>
      <Card><h2 className="font-display text-lg font-bold">Struktura</h2><ol className="mt-2 flex flex-col gap-2">{g.content.structure.map((s, i) => <li key={i}><b>{s.part}</b> – {s.content}</li>)}</ol></Card>
      <Card><h2 className="font-display text-lg font-bold">Przydatne zwroty</h2><ul className="mt-2 grid gap-1.5 sm:grid-cols-2">{g.content.phrases.map((p, i) => <li key={i} className="text-sm"><b>{p.en}</b> – <span className="text-ink-soft">{p.pl}</span></li>)}</ul></Card>
      <Card><h2 className="font-display text-lg font-bold">Przykładowa praca na poziomie C1</h2><p className="mt-2 text-sm italic text-ink-soft">{g.content.sample.task}</p><div className="prose-c1 mt-3 whitespace-pre-wrap">{g.content.sample.text}</div><p className="mt-2 text-xs text-ink-soft">{wc(g.content.sample.text)} słów</p></Card>
      <Card><h2 className="font-display text-lg font-bold">Kryteria oceny</h2><ul className="mt-2 flex flex-col gap-2">{g.content.criteria.map((c) => <li key={c.name}><b>{c.name}</b> – {c.description}</li>)}</ul></Card>
      <div><Button onClick={() => setTab("write")}>Napisz własną pracę</Button></div></div>}
    {g && tab === "write" && <div className="flex flex-col gap-4">
      <Card><label className="flex flex-col gap-1 text-sm font-bold">Zadanie<select className={inputCls} value={draft.task} onChange={(e) => setDraft({ ...draft, task: e.target.value })}>{g.content.tasks.map((t) => <option key={t} value={t}>{t.slice(0, 110)}{t.length > 110 ? "…" : ""}</option>)}</select></label><p className="mt-3">{draft.task}</p></Card>
      <div><div className="mb-1 flex justify-between text-sm"><span className="font-bold">Twój tekst</span><span className={cx("font-mono", words > 0 && (words < 220 || words > 260) ? "text-amber-700 dark:text-amber-300" : "")}>{words} słów · zalecane 220–260</span></div>
        <textarea className={inputCls + " min-h-[320px] leading-relaxed"} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} spellCheck={false} placeholder="Write your answer here…" aria-label="Twój tekst" /></div>
      <Card><h2 className="font-display text-lg font-bold">Samoocena</h2><p className="text-sm text-ink-soft">To Twoja własna ocena według kryteriów Cambridge (0–5). Nie jest to ocena egzaminatora ani ocena automatyczna.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{g.content.criteria.map((c) => <label key={c.name} className="flex items-center justify-between gap-2 text-sm">{c.name}<select className={inputCls + " w-20"} value={draft.self[c.name] ?? ""} onChange={(e) => setDraft({ ...draft, self: { ...draft.self, [c.name]: Number(e.target.value) } })}><option value="">–</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>)}</div></Card>
      {msg && <Feedback tone={msg.tone}>{msg.text}</Feedback>}
      <div className="flex gap-2"><Button onClick={save} disabled={busy || !draft.body.trim()}>{busy ? "Zapisywanie…" : draft.id ? "Zapisz zmiany" : "Zapisz pracę"}</Button>{draft.id && <Button variant="quiet" onClick={() => setDraft({ task: draft.task, body: "", self: {} })}>Nowa praca</Button>}</div></div>}
    {tab === "mine" && (subs.loading ? <Loading /> : subs.error ? <ErrorBox error={subs.error} /> : !subs.data?.length ? <p className="text-ink-soft">Nie masz jeszcze zapisanych prac.</p> :
      <div className="flex flex-col gap-3">{subs.data.map((s) => <Card key={s.id}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><Pill>{s.type}</Pill><Pill>{s.word_count} słów</Pill></div><span className="text-sm text-ink-soft">{new Date(s.updated_at).toLocaleString("pl-PL")}</span></div>
        <p className="mt-2 text-sm italic">{s.task}</p><p className="mt-2 line-clamp-3 text-sm">{s.body}</p>
        <div className="mt-3 flex gap-2"><Button size="sm" variant="quiet" onClick={() => { setType(s.type); setDraft({ id: s.id, task: s.task, body: s.body, self: s.self_assessment ?? {} }); setTab("write"); }}>Edytuj</Button><Confirm label="Usunąć pracę?" onConfirm={async () => { await deleteSubmission(s.id); subs.reload(); }}><Button size="sm" variant="ghost">Usuń</Button></Confirm></div></Card>)}</div>)}
  </div>;
}
