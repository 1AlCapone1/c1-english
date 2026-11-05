import type { Exercise, Vocab } from "./types";
/** Build test questions from vocabulary entries (typed answers). */
export function vocabToExercise(v: Vocab, kind: "gap" | "plen" | "sentence"): Exercise {
  const target = (v.example.match(/\*([^*]+)\*/) || [])[1] ?? v.term;
  const base = { id: `v:${v.id}:${kind}`, module: "vocabulary", grammar_lesson_id: null, reading_id: null, topic: v.kind === "phrasal_verb" ? "phrasal" : v.kind === "collocation" ? "collocations" : "vocabulary", level: v.level, distractor_notes: null, position: 0 } as const;
  if (kind === "gap" && (v.example.match(/\*/g) || []).length === 2)
    return { ...base, task_type: "gap", instruction: "Uzupełnij lukę (podpowiedź po polsku w nawiasie).", prompt: { question: v.example.replace(/\*[^*]+\*/, "___") + ` (${v.translation_pl.split(/[,;]/)[0]})` }, answers: [target], explanation: `${v.term} – ${v.translation_pl}. ${v.definition ?? ""}` };
  if (kind === "sentence" && v.example_pl)
    return { ...base, task_type: "translation", instruction: "Przetłumacz zdanie na angielski.", prompt: { question: v.example_pl }, answers: [v.example.replace(/\*/g, "")], explanation: `Kluczowe wyrażenie: ${v.term} – ${v.translation_pl}.` };
  return { ...base, task_type: "gap", instruction: "Podaj angielski odpowiednik.", prompt: { question: `${v.translation_pl} → ___` }, answers: [v.term], explanation: `${v.term} – ${v.definition ?? v.translation_pl}` };
}
