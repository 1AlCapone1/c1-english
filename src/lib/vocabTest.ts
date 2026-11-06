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

const KIND_HINT: Record<string, string> = { phrasal_verb: "phrasal verb", idiom: "idiom", collocation: "kolokacja", fixed_expression: "wyrażenie", linking: "łącznik" };
/**
 * Daily-lesson cards with ONE short typed answer (like the original prototype):
 *  plen – Polish word → English word/phrase · gap – one word missing in the example (Polish hint) · def – English definition → word.
 * Never asks for a whole sentence.
 */
export function vocabShortExercise(v: Vocab, mode: "plen" | "gap" | "def"): Exercise {
  const target = (v.example.match(/\*([^*]+)\*/) || [])[1] ?? v.term;
  const base = { module: "vocabulary", grammar_lesson_id: null, reading_id: null, topic: v.kind === "phrasal_verb" ? "phrasal" : v.kind === "collocation" ? "collocations" : "vocabulary", level: v.level, distractor_notes: null, position: 0 } as const;
  const pl = v.translation_pl.split(/[;]/)[0].trim();
  const why = `${v.term} – ${v.translation_pl}${v.definition ? `. ${v.definition}` : ""}${v.usage_note ? ` ${v.usage_note}` : ""}`;
  if (mode === "gap" && (v.example.match(/\*/g) || []).length === 2 && target.split(/\s+/).length <= 4)
    return { ...base, id: `v:${v.id}:gap`, task_type: "gap", instruction: "Wpisz brakujące słowo (podpowiedź po polsku w nawiasie).", prompt: { question: v.example.replace(/\*[^*]+\*/, "___") + ` (${pl.split(",")[0]})` }, answers: [target], explanation: why };
  if (mode === "def" && v.definition)
    return { ...base, id: `v:${v.id}:def`, task_type: "gap", instruction: "Jakie słowo pasuje do definicji?", prompt: { question: `${v.definition} → ___` + (KIND_HINT[v.kind] ? ` (${KIND_HINT[v.kind]})` : "") }, answers: [v.term], explanation: why };
  return { ...base, id: `v:${v.id}:plen`, task_type: "gap", instruction: "Wpisz angielski odpowiednik." + (KIND_HINT[v.kind] ? ` (${KIND_HINT[v.kind]})` : ""), prompt: { question: `${pl} → ___` }, answers: [v.term], explanation: why };
}

/** True for tasks answered with a single word or a short form (max. 4 words) – the only kind used in the daily lesson. */
export function isShortTask(e: Exercise): boolean {
  if (!["gap", "mc", "mc_cloze", "open_cloze", "word_formation"].includes(e.task_type)) return false;
  return e.answers.every((a) => String(a).trim().split(/\s+/).length <= 4);
}
