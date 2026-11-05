import { useEffect, useRef, useState } from "react";
import { listSpeaking } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { Button, Card, ErrorBox, Feedback, Loading, PageHeader, cx } from "../components/ui";

const TYPE_LABEL: Record<string, string> = { questions: "Odpowiadanie na pytania", photo: "Opisywanie zdjęć", compare: "Porównywanie", opinion: "Wyrażanie opinii", argue: "Argumentowanie", speculate: "Spekulowanie", discussion: "Dyskusja", respond: "Reagowanie na wypowiedź" };

function Recorder() {
  const [state, setState] = useState<"idle" | "rec" | "done" | "unsupported" | "denied">(() => (typeof MediaRecorder === "undefined" || !navigator.mediaDevices ? "unsupported" : "idle"));
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const timer = useRef<number>();
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, [url]);
  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream); chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = () => { const b = new Blob(chunks.current, { type: r.mimeType }); if (url) URL.revokeObjectURL(url); setUrl(URL.createObjectURL(b)); setState("done"); stream.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); };
      r.start(); rec.current = r; setSecs(0); setState("rec");
      timer.current = window.setInterval(() => setSecs((s) => s + 1), 1000);
    } catch { setState("denied"); }
  }
  if (state === "unsupported") return <Feedback tone="info">Ta przeglądarka nie obsługuje nagrywania. Ćwicz na głos i porównaj z przykładową odpowiedzią.</Feedback>;
  if (state === "denied") return <Feedback tone="warn">Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki, aby nagrać odpowiedź.</Feedback>;
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">{state === "rec" ? <Button variant="danger" onClick={() => rec.current?.stop()}>■ Zatrzymaj ({secs}s)</Button> : <Button onClick={start}>● {url ? "Nagraj ponownie" : "Nagraj odpowiedź"}</Button>}</div>
    {url && <audio controls src={url} className="w-full" />}
    <p className="text-xs text-ink-soft">Nagranie zostaje tylko w Twojej przeglądarce – nie jest wysyłane ani oceniane automatycznie. Odsłuchaj je i porównaj z przykładową odpowiedzią.</p>
  </div>;
}

export default function Speaking() {
  const { data, error, loading, reload } = useAsync(listSpeaking);
  const [type, setType] = useState(""); const [i, setI] = useState(0); const [show, setShow] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? ""} onRetry={reload} />;
  const types = Array.from(new Set(data.map((d) => d.type)));
  const list = data.filter((d) => !type || d.type === type);
  const t = list[i % Math.max(1, list.length)];
  return <div className="max-w-3xl">
    <PageHeader eyebrow="Moduł G" title="Speaking" lead={`${data.length} zadań: pytania, zdjęcia, porównywanie, opinie, argumentowanie, spekulowanie i dyskusja – z przykładowymi odpowiedziami C1 i przydatnymi zwrotami.`} />
    <div className="mb-4 flex flex-wrap gap-2"><button onClick={() => { setType(""); setI(0); setShow(false); }} className={cx("rounded-full border px-3 py-1 text-sm", !type && "bg-ink text-white dark:bg-white dark:text-ink")}>Wszystkie</button>{types.map((x) => <button key={x} onClick={() => { setType(x); setI(0); setShow(false); }} className={cx("rounded-full border px-3 py-1 text-sm", type === x && "bg-ink text-white dark:bg-white dark:text-ink")}>{TYPE_LABEL[x] ?? x}</button>)}</div>
    {t && <div className="flex flex-col gap-4">
      <Card><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">{TYPE_LABEL[t.type] ?? t.type} · {(i % list.length) + 1}/{list.length}</div><h2 className="mt-2 font-display text-xl font-bold">{t.title}</h2><p className="mt-2 whitespace-pre-wrap text-lg">{t.prompt}</p></Card>
      <Card><h3 className="font-bold">Twoja odpowiedź</h3><div className="mt-2"><Recorder key={t.id} /></div></Card>
      <Card><h3 className="font-bold">Przydatne zwroty</h3><ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{t.phrases.map((p, k) => <li key={k}><b>{p.en}</b> – <span className="text-ink-soft">{p.pl}</span></li>)}</ul></Card>
      <Card>{show ? <><h3 className="font-bold">Przykładowa odpowiedź C1</h3><p className="mt-2 whitespace-pre-wrap">{t.model_answer}</p></> : <Button variant="quiet" onClick={() => setShow(true)}>Pokaż przykładową odpowiedź C1</Button>}</Card>
      <div><Button onClick={() => { setI(i + 1); setShow(false); }}>Następne zadanie →</Button></div>
    </div>}
  </div>;
}
