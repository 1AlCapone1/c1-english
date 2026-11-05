import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listVocab, myProgress, savedIds, toggleSaved, vocabCounts } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { cardStatus, STATUS_LABEL } from "../lib/srs";
import { CATEGORIES, KIND_LABEL, REGISTER_LABEL, type Kind, type Progress as P, type Vocab } from "../lib/types";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Pill, inputCls } from "../components/ui";

export function exampleHtml(ex: string) {
  return ex.split(/(\*[^*]+\*)/).map((part, i) => part.startsWith("*") && part.endsWith("*") ? <mark key={i} className="rounded bg-amber-100 px-0.5 dark:bg-amber-900/60 dark:text-amber-100">{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>);
}
export function VocabDetail({ v }: { v: Vocab }) {
  const row = (k: string, val: React.ReactNode) => val ? <div className="grid gap-1 sm:grid-cols-[130px_1fr]"><span className="text-xs font-bold uppercase tracking-wider text-ink-soft">{k}</span><div>{val}</div></div> : null;
  return <div className="flex flex-col gap-2 text-[0.95rem]">
    {row("Wymowa", v.ipa && <span className="font-mono">/{v.ipa}/</span>)}
    {row("Część mowy", v.pos)}
    {row("Polski", v.translation_pl)}
    {row("Definicja", v.definition)}
    {row("Przykład", <><span className="italic">{exampleHtml(v.example)}</span>{v.example_pl && <div className="text-sm text-ink-soft">{v.example_pl}</div>}</>)}
    {row("Kolokacje", v.collocations.join(" · "))}
    {row("Synonimy", v.synonyms.join(", "))}
    {row("Antonimy", v.antonyms.join(", "))}
    {row("Rejestr", REGISTER_LABEL[v.register])}
    {row("Uwaga", v.usage_note)}
  </div>;
}

export default function Vocabulary() {
  const [kind, setKind] = useState(""); const [category, setCategory] = useState(""); const [level, setLevel] = useState("");
  const [q, setQ] = useState(""); const [qApplied, setQApplied] = useState(""); const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [prog, setProg] = useState<Map<string, P>>(new Map());
  const counts = useAsync(vocabCounts);
  const list = useAsync(() => listVocab({ kind: kind || undefined, category: category || undefined, level: level || undefined, q: qApplied || undefined, limit: 40, offset: page * 40 }), [kind, category, level, qApplied, page]);
  useEffect(() => { savedIds().then(setSaved).catch(() => {}); myProgress().then((p) => setProg(new Map(p.map((x) => [x.vocab_id, x])))).catch(() => {}); }, []);
  useEffect(() => setPage(0), [kind, category, level, qApplied]);
  const byCat = useMemo(() => { const m: Record<string, number> = {}; (counts.data ?? []).forEach((r) => (m[r.category] = (m[r.category] ?? 0) + 1)); return m; }, [counts.data]);
  const byKind = useMemo(() => { const m: Record<string, number> = {}; (counts.data ?? []).forEach((r) => (m[r.kind] = (m[r.kind] ?? 0) + 1)); return m; }, [counts.data]);
  async function star(id: string) {
    const on = !saved.has(id); const n = new Set(saved); on ? n.add(id) : n.delete(id); setSaved(n);
    try { await toggleSaved(id, on); } catch { setSaved(saved); }
  }
  const total = counts.data?.length ?? 0;
  return <div>
    <PageHeader eyebrow="Moduł A · Vocabulary C1" title="Słownictwo" lead={`W bazie: ${total} haseł z tłumaczeniem, wymową IPA, przykładem i kolokacjami.`} actions={<Link to="/flashcards"><Button>Ucz się w fiszkach</Button></Link>} />
    <Card>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQApplied(q.trim()); }}>
        <input className={inputCls + " max-w-sm"} placeholder="Szukaj po angielsku lub po polsku…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj" />
        <Button type="submit" variant="quiet">Szukaj</Button>
        {qApplied && <Button type="button" variant="ghost" onClick={() => { setQ(""); setQApplied(""); }}>Wyczyść</Button>}
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <select className={inputCls + " w-auto"} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Rodzaj"><option value="">Wszystkie rodzaje</option>{(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]} ({byKind[k] ?? 0})</option>)}</select>
        <select className={inputCls + " w-auto"} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategoria"><option value="">Wszystkie kategorie</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v} ({byCat[k] ?? 0})</option>)}</select>
        <select className={inputCls + " w-auto"} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Poziom"><option value="">Wszystkie poziomy</option>{["B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}</select>
      </div>
    </Card>
    <div className="mt-4">
      {list.loading ? <Loading /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data?.rows.length ? <Empty title="Brak haseł">Zmień filtry lub wyszukiwanie.</Empty> :
        <Card className="p-0"><ul>{list.data.rows.map((v) => { const st = cardStatus(prog.get(v.id)); const isOpen = open === v.id; return <li key={v.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button onClick={() => star(v.id)} aria-label={saved.has(v.id) ? "Usuń z moich fiszek" : "Dodaj do moich fiszek"} title="Moje fiszki" className={saved.has(v.id) ? "text-amber-500" : "text-black/20 hover:text-amber-500 dark:text-white/20"}>★</button>
            <button className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 text-left" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen}>
              <b>{v.term}</b>{v.ipa && <span className="font-mono text-xs text-ink-soft">/{v.ipa}/</span>}<span className="text-ink-soft dark:text-[#9AA3B8]">{v.translation_pl}</span></button>
            <Pill>{KIND_LABEL[v.kind]}</Pill><Pill>{v.level}</Pill><Pill tone={st === "mastered" ? "ok" : st === "hard" ? "bad" : st === "due" ? "warn" : st === "new" ? "accent" : "neutral"}>{STATUS_LABEL[st]}</Pill>
          </div>
          {isOpen && <div className="bg-black/[.02] px-4 pb-4 pt-1 dark:bg-white/[.02]"><VocabDetail v={v} /></div>}
        </li>; })}</ul></Card>}
      {list.data && list.data.count > 40 && <div className="mt-3 flex items-center gap-3"><Button size="sm" variant="quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>← Poprzednie</Button><span className="text-sm text-ink-soft">Strona {page + 1} z {Math.ceil(list.data.count / 40)}</span><Button size="sm" variant="quiet" disabled={(page + 1) * 40 >= list.data.count} onClick={() => setPage(page + 1)}>Następne →</Button></div>}
    </div>
  </div>;
}
