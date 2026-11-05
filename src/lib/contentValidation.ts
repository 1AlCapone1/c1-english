// Content validation – used by the admin panel and by the seed validation script (CI).
export type TableName = "vocabulary" | "grammar_lessons" | "exercises" | "reading_materials" | "listening_materials" | "writing_guides" | "speaking_tasks" | "tests";
type Rec = Record<string, unknown>;
const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const arr = (v: unknown) => Array.isArray(v) && v.length > 0;

export function validateRecord(table: TableName, r: Rec): string[] {
  const e: string[] = [];
  const need = (k: string) => { if (!str(r[k])) e.push(`Brak pola „${k}”.`); };
  if (table === "vocabulary") {
    ["term", "kind", "category", "translation_pl", "example", "ipa", "pos"].forEach(need);
    if (str(r.example) && (String(r.example).match(/\*/g) || []).length < 2) e.push("Przykład musi zawierać hasło oznaczone *gwiazdkami*.");
    if (!["B2", "C1", "C2"].includes(String(r.level))) e.push("Poziom musi być B2, C1 lub C2.");
    if (!str(r.example_pl)) e.push("Brak tłumaczenia przykładu.");
  }
  if (table === "grammar_lessons") {
    ["slug", "area", "title"].forEach(need);
    const c = (r.content ?? {}) as Rec;
    for (const k of ["explanation", "usage"]) if (!str(c[k])) e.push(`Lekcja: brak sekcji „${k}”.`);
    const st = (c.structure ?? {}) as Rec;
    if (!str(st.scheme) || !arr(st.affirmative) || !arr(st.negative) || !arr(st.questions)) e.push("Lekcja: niepełna sekcja „structure”.");
    if (!Array.isArray(c.examples) || c.examples.length < 10) e.push("Lekcja: wymagane co najmniej 10 przykładów.");
    else (c.examples as Rec[]).forEach((x, i) => { if (!str(x.en) || !str(x.pl) || !str(x.why)) e.push(`Przykład ${i + 1}: brak en/pl/why.`); });
    for (const k of ["comparison", "mistakes", "exceptions"]) if (!arr(c[k])) e.push(`Lekcja: brak sekcji „${k}”.`);
  }
  if (table === "exercises") {
    ["module", "task_type", "instruction", "explanation"].forEach(need);
    const p = (r.prompt ?? {}) as Rec;
    if (!str(p.question)) e.push("Brak treści zadania (prompt.question).");
    if (!arr(r.answers) || !(r.answers as unknown[]).every(str)) e.push("Brak poprawnej odpowiedzi.");
    const choice = ["mc", "mc_cloze", "tfng", "matching"].includes(String(r.task_type));
    if (choice) {
      const o = p.options as unknown[] | undefined;
      if (!Array.isArray(o) || o.length < 2) e.push("Zadanie wyboru wymaga co najmniej 2 opcji.");
      else { if (!o.includes((r.answers as unknown[])?.[0])) e.push("Klucz odpowiedzi nie jest jedną z opcji."); if (new Set(o).size !== o.length) e.push("Powtarzające się opcje."); }
    }
    if (["gap", "open_cloze", "word_formation", "mc_cloze"].includes(String(r.task_type)) && str(p.question) && !String(p.question).includes("___")) e.push("Zadanie z luką musi zawierać ___.");
    if (r.task_type === "kwt" && (!str(p.keyword) || !String(p.sentence2 ?? "").includes("___"))) e.push("Transformacja wymaga keyword i sentence2 z ___.");
    if (r.task_type === "kwt" && str(p.keyword) && arr(r.answers) && !(r.answers as string[]).every((a) => a.toLowerCase().includes(String(p.keyword).toLowerCase().replace("'", "")) || a.toLowerCase().includes(String(p.keyword).toLowerCase()))) e.push("Każda odpowiedź transformacji musi zawierać słowo kluczowe.");
    if (r.task_type === "word_formation" && !str(p.base)) e.push("Word formation wymaga prompt.base.");
  }
  if (table === "reading_materials") { ["title", "topic", "body"].forEach(need); if (String(r.body ?? "").length < 1200) e.push("Tekst jest za krótki na poziom C1 (min. ok. 200 słów)."); if (!arr(r.glossary)) e.push("Brak listy trudniejszych słów."); }
  if (table === "listening_materials") { ["title", "topic", "transcript"].forEach(need); if (r.published && !str(r.audio_path)) e.push("Nie można opublikować nagrania bez pliku audio."); }
  if (table === "writing_guides") { ["type", "title"].forEach(need); const c = (r.content ?? {}) as Rec; for (const k of ["structure", "phrases", "criteria", "tasks"]) if (!arr(c[k])) e.push(`Brak „${k}”.`); if (!str((c.sample as Rec | undefined)?.text)) e.push("Brak przykładowej pracy."); }
  if (table === "speaking_tasks") ["type", "title", "prompt", "model_answer"].forEach(need);
  if (table === "tests") ["title", "kind"].forEach(need);
  return e;
}
