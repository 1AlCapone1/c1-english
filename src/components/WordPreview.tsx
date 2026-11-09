import { useState } from "react";
import type { Vocab } from "../lib/types";
import { KIND_LABEL } from "../lib/types";
import { VocabDetail, exampleHtml, SpeakButton } from "../pages/Vocabulary";
import { Button, Card, Pill } from "./ui";
import { useEnter } from "../lib/keys";

/**
 * "Zanim zaczniesz": every word/expression of the coming flashcards, so the learner sees them first.
 * Compact rows (word, translation, example) – tap a row for the full card. Enter starts the session.
 */
export function WordPreview({ words, title = "Najpierw przejrzyj hasła", lead, startLabel = "Zaczynamy fiszki →", onStart, onBack }: {
  words: Vocab[]; title?: string; lead?: string; startLabel?: string; onStart: () => void; onBack?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  useEnter(onStart, true);
  return <div className="max-w-3xl" data-testid="word-preview">
    <div className="mb-4"><div className="text-xs font-bold uppercase tracking-widest text-ink-soft">Zanim zaczniesz · {words.length} {words.length === 1 ? "hasło" : words.length < 5 ? "hasła" : "haseł"}</div>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-ink-soft">{lead ?? "Oto wszystkie wyrażenia, których będziesz się uczyć w tej sesji. Przeczytaj je, a kliknij hasło, żeby zobaczyć pełną kartę (synonimy, kolokacje, uwagi)."}</p></div>
    <Card className="p-0"><ol>{words.map((v, i) => {
      const isOpen = open === v.id;
      return <li key={v.id} className="border-t border-black/5 first:border-0 dark:border-white/5">
        <button type="button" className="flex w-full flex-col gap-1 p-3 text-left hover:bg-black/[.03] dark:hover:bg-white/[.04]" onClick={() => setOpen(isOpen ? null : v.id)} aria-expanded={isOpen}>
          <span className="flex flex-wrap items-baseline gap-2"><span className="font-mono text-xs text-ink-soft">{i + 1}</span><b className="text-lg">{v.term}</b>
            {v.ipa && <span className="font-mono text-xs text-ink-soft">/{v.ipa.replace(/^\/|\/$/g, "")}/</span>}
            <span className="text-ink-soft">– {v.translation_pl}</span>{v.kind !== "word" && <Pill>{KIND_LABEL[v.kind]}</Pill>}</span>
          <span className="text-sm">{exampleHtml(v.example)}</span>
          {v.example_pl && <span className="text-sm text-ink-soft">{v.example_pl}</span>}
        </button>
        {isOpen && <div className="px-3 pb-4"><div className="mb-2"><SpeakButton text={v.term} /></div><VocabDetail v={v} /></div>}
      </li>;
    })}</ol></Card>
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap items-center gap-3 bg-paper/95 px-1 py-3 backdrop-blur dark:bg-[#0E1320]/95">
      <Button onClick={onStart} data-testid="preview-start">{startLabel}</Button>
      {onBack && <Button variant="quiet" onClick={onBack}>Wróć</Button>}
      <span className="hidden text-xs text-ink-soft sm:inline">lub Enter</span>
    </div>
  </div>;
}
