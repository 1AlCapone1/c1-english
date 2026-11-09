import { useState } from "react";
import { hideWord } from "../lib/api";
import { Button, Feedback } from "./ui";

/**
 * "Pomiń" – skip this card now (allowed only before answering, so the correction loop can't be bypassed).
 * "Wyrzuć słowo" – remove the word from learning for good (not offered in flashcards / daily lessons; restore in Ustawienia).
 */
export function SkipBar({ canSkip, vocabId, onSkip, onRemoved }: { canSkip: boolean; vocabId?: string; onSkip: () => void; onRemoved?: (id: string) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  if (!canSkip && !vocabId) return null;
  async function remove() {
    if (!vocabId) return;
    setBusy(true); setErr(null);
    try { await hideWord(vocabId, "known"); onRemoved?.(vocabId); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2 text-sm">
    {canSkip && <Button size="sm" variant="ghost" onClick={onSkip} data-testid="skip">Pomiń</Button>}
    {vocabId && <Button size="sm" variant="ghost" onClick={remove} disabled={busy} data-testid="remove-word" title="Nie będzie się pojawiać w fiszkach i codziennych lekcjach. Przywrócisz je w Ustawieniach.">{busy ? "Usuwanie…" : "Wyrzuć to słowo z nauki"}</Button>}
    {err && <Feedback tone="warn">{err}</Feedback>}
  </div>;
}

/** Small notice after removing a word, with undo. */
export function RemovedNotice({ term, onUndo }: { term: string; onUndo: () => void }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5" role="status" data-testid="removed-notice">
    <span>Wyrzucono „{term}” z nauki.</span><button type="button" className="font-bold underline" onClick={onUndo}>Cofnij</button>
  </div>;
}
