// Data access layer – all reads/writes go through Supabase with RLS.
import { supabase, unwrap } from "./supabase";
import { nextState } from "./srs";
import type { Exercise, GrammarLesson, Listening, Mistake, Profile, Progress, Reading, SpeakingTask, TestAttempt, Vocab, WritingGuide } from "./types";
import type { MistakeCategory } from "./answer";

const uid = async () => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Zaloguj się, aby kontynuować.");
  return data.user.id;
};

// ---------- vocabulary ----------
export async function vocabCounts() {
  const rows = unwrap(await supabase.from("vocabulary").select("kind, category"));
  return rows as { kind: string; category: string }[];
}
export async function listVocab(f: { kind?: string; category?: string; level?: string; q?: string; ids?: string[]; limit?: number; offset?: number }) {
  let q = supabase.from("vocabulary").select("*", { count: "exact" }).order("term");
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.category) q = q.eq("category", f.category);
  if (f.level) q = q.eq("level", f.level);
  if (f.ids) q = q.in("id", f.ids);
  if (f.q) { const s = f.q.replace(/[%,()]/g, " ").trim(); q = q.or(`term.ilike.%${s}%,translation_pl.ilike.%${s}%`); }
  q = q.range(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 50) - 1);
  const res = await q;
  if (res.error) throw new Error(res.error.message);
  return { rows: (res.data ?? []) as Vocab[], count: res.count ?? 0 };
}
export async function myProgress(ids?: string[]): Promise<Progress[]> {
  let q = supabase.from("flashcard_progress").select("vocab_id, box, due_at, correct, wrong, last_attempts, last_mode");
  if (ids) q = q.in("vocab_id", ids);
  return unwrap(await q.limit(10000)) as Progress[];
}
/** Pick flashcards: due first, then new, filtered by category/level/kind. */
export async function pickFlashcards(f: { kind?: string; category?: string; level?: string; n: number; mode: "smart" | "new" | "due" | "hard" | "saved" }) {
  const prog = await myProgress();
  const pmap = new Map(prog.map((p) => [p.vocab_id, p]));
  if (f.mode === "saved") {
    const saved = unwrap(await supabase.from("flashcards").select("vocab_id").not("vocab_id", "is", null)) as { vocab_id: string }[];
    const ids = saved.map((s) => s.vocab_id).slice(0, f.n);
    if (!ids.length) return [];
    return (await listVocab({ ids, limit: ids.length })).rows;
  }
  const now = Date.now();
  const dueIds = prog.filter((p) => new Date(p.due_at).getTime() <= now).sort((a, b) => a.box - b.box || b.wrong - a.wrong).map((p) => p.vocab_id);
  const hardIds = prog.filter((p) => p.wrong > 0).sort((a, b) => (b.wrong - b.correct) - (a.wrong - a.correct)).map((p) => p.vocab_id);
  const pool: Vocab[] = [];
  const filterFn = (v: Vocab) => (!f.kind || v.kind === f.kind) && (!f.category || v.category === f.category) && (!f.level || v.level === f.level);
  const take = async (ids: string[]) => {
    for (let i = 0; i < ids.length && pool.length < f.n; i += 200) {
      const rows = (await listVocab({ ids: ids.slice(i, i + 200), limit: 200 })).rows.filter(filterFn);
      const order = new Map(ids.map((id, k) => [id, k]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).forEach((r) => pool.length < f.n && pool.push(r));
    }
  };
  if (f.mode === "hard") await take(hardIds);
  if (f.mode === "due" || f.mode === "smart") await take(dueIds);
  if ((f.mode === "new" || f.mode === "smart") && pool.length < f.n) {
    let q = supabase.from("vocabulary").select("*");
    if (f.kind) q = q.eq("kind", f.kind);
    if (f.category) q = q.eq("category", f.category);
    if (f.level) q = q.eq("level", f.level);
    const all = unwrap(await q.limit(3000)) as Vocab[];
    const fresh = all.filter((v) => !pmap.has(v.id));
    shuffle(fresh).slice(0, f.n - pool.length).forEach((v) => pool.push(v));
  }
  return shuffle(pool);
}
export async function saveFlashcardResult(vocabId: string, firstTryCorrect: boolean, hinted: boolean, attempts: number, mode: string) {
  const user_id = await uid();
  const cur = unwrap(await supabase.from("flashcard_progress").select("box, correct, wrong").eq("vocab_id", vocabId).maybeSingle()) as { box: number; correct: number; wrong: number } | null;
  const s = nextState(cur, firstTryCorrect, hinted);
  unwrap(await supabase.from("flashcard_progress").upsert({ user_id, vocab_id: vocabId, box: s.box, correct: s.correct, wrong: s.wrong, due_at: s.due_at, last_attempts: attempts, last_mode: firstTryCorrect ? null : mode, last_reviewed_at: new Date().toISOString() }));
}
export async function toggleSaved(vocabId: string, save: boolean) {
  const user_id = await uid();
  if (save) unwrap(await supabase.from("flashcards").upsert({ user_id, vocab_id: vocabId }, { onConflict: "user_id,vocab_id", ignoreDuplicates: true }));
  else unwrap(await supabase.from("flashcards").delete().eq("vocab_id", vocabId));
}
export async function savedIds(): Promise<Set<string>> {
  const rows = unwrap(await supabase.from("flashcards").select("vocab_id").not("vocab_id", "is", null)) as { vocab_id: string }[];
  return new Set(rows.map((r) => r.vocab_id));
}

// ---------- grammar ----------
export async function listLessons(): Promise<GrammarLesson[]> {
  return unwrap(await supabase.from("grammar_lessons").select("id, slug, area, title, position, published, content").order("position")) as GrammarLesson[];
}
export async function getLesson(slug: string) {
  const lesson = unwrap(await supabase.from("grammar_lessons").select("*").eq("slug", slug).maybeSingle()) as GrammarLesson | null;
  if (!lesson) throw new Error("Nie znaleziono lekcji.");
  const exercises = unwrap(await supabase.from("exercises").select("*").eq("grammar_lesson_id", lesson.id).order("position")) as Exercise[];
  return { lesson, exercises };
}
export async function lessonProgress() {
  return unwrap(await supabase.from("lesson_progress").select("*")) as { lesson_id: string; completed_at: string | null; test_score: number | null; test_max: number | null }[];
}
export async function saveLessonProgress(lessonId: string, score: number, max: number) {
  const user_id = await uid();
  unwrap(await supabase.from("lesson_progress").upsert({ user_id, lesson_id: lessonId, completed_at: new Date().toISOString(), test_score: score, test_max: max }));
}

// ---------- exercises ----------
export async function listExercises(f: { module?: string; task_type?: string; types?: string[]; level?: string; reading_id?: string; listening_id?: string; limit?: number }) {
  let q = supabase.from("exercises").select("*");
  if (f.module) q = q.eq("module", f.module);
  if (f.task_type) q = q.eq("task_type", f.task_type);
  if (f.types) q = q.in("task_type", f.types);
  if (f.level) q = q.eq("level", f.level);
  if (f.reading_id) q = q.eq("reading_id", f.reading_id).order("position");
  if (f.listening_id) q = q.eq("listening_id", f.listening_id).order("position");
  return unwrap(await q.limit(f.limit ?? 2000)) as Exercise[];
}
export async function exercisesByIds(ids: string[]) {
  if (!ids.length) return [];
  return unwrap(await supabase.from("exercises").select("*").in("id", ids)) as Exercise[];
}

// ---------- reading / listening / writing / speaking ----------
export async function listReading(): Promise<Reading[]> {
  return unwrap(await supabase.from("reading_materials").select("id, title, topic, level, word_count, glossary, body").order("created_at")) as Reading[];
}
export async function getReading(id: string) {
  const r = unwrap(await supabase.from("reading_materials").select("*").eq("id", id).maybeSingle()) as Reading | null;
  if (!r) throw new Error("Nie znaleziono tekstu.");
  return { reading: r, exercises: await listExercises({ reading_id: id }) };
}
export async function listListening(): Promise<Listening[]> {
  return unwrap(await supabase.from("listening_materials").select("*").eq("published", true).order("created_at")) as Listening[];
}
export function audioUrl(path: string) { return supabase.storage.from("audio").getPublicUrl(path).data.publicUrl; }
export async function listWritingGuides(): Promise<WritingGuide[]> { return unwrap(await supabase.from("writing_guides").select("*").order("type")) as WritingGuide[]; }
export async function listSpeaking(): Promise<SpeakingTask[]> { return unwrap(await supabase.from("speaking_tasks").select("*").order("type")) as SpeakingTask[]; }
export async function mySubmissions() {
  return unwrap(await supabase.from("writing_submissions").select("*").order("updated_at", { ascending: false })) as { id: string; type: string; task: string; body: string; word_count: number; self_assessment: Record<string, number> | null; updated_at: string }[];
}
export async function saveSubmission(s: { id?: string; type: string; task: string; body: string; self_assessment?: Record<string, number> | null }) {
  const user_id = await uid();
  const word_count = (s.body.trim().match(/[A-Za-zÀ-ž0-9'’-]+/g) || []).length;
  const row = { user_id, type: s.type, task: s.task, body: s.body, word_count, self_assessment: s.self_assessment ?? null, updated_at: new Date().toISOString() };
  if (s.id) return unwrap(await supabase.from("writing_submissions").update(row).eq("id", s.id).select().single());
  return unwrap(await supabase.from("writing_submissions").insert(row).select().single());
}
export async function deleteSubmission(id: string) { unwrap(await supabase.from("writing_submissions").delete().eq("id", id)); }

// ---------- mistakes ----------
const isUuid = (x?: string) => !!x && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export async function recordMistake(m: { category: MistakeCategory; source: string; prompt: string; user_answer: string; correct: string; explanation?: string; vocab_id?: string; exercise_id?: string }) {
  if (!isUuid(m.exercise_id)) m = { ...m, exercise_id: undefined };
  if (!isUuid(m.vocab_id)) m = { ...m, vocab_id: undefined };
  unwrap(await supabase.rpc("record_mistake", { p_category: m.category, p_source: m.source, p_prompt: m.prompt.slice(0, 500), p_user_answer: m.user_answer.slice(0, 300), p_correct: m.correct.slice(0, 300), p_explanation: m.explanation ?? null, p_vocab: m.vocab_id ?? null, p_exercise: m.exercise_id ?? null }));
}
export async function listMistakes(): Promise<Mistake[]> { return unwrap(await supabase.from("mistakes").select("*").order("last_seen_at", { ascending: false }).limit(1000)) as Mistake[]; }
export async function updateMistake(id: string, patch: Partial<Pick<Mistake, "mastered">>) { unwrap(await supabase.from("mistakes").update(patch).eq("id", id)); }
export async function deleteMistake(id: string) { unwrap(await supabase.from("mistakes").delete().eq("id", id)); }

// ---------- tests & sessions ----------
export async function saveAttempt(a: { kind: string; title: string; score: number; max_score: number; duration_sec?: number; details?: unknown; test_id?: string }) {
  const user_id = await uid();
  const row = unwrap(await supabase.from("test_attempts").insert({ user_id, ...a, details: a.details ?? {} }).select().single());
  return row as TestAttempt;
}
export async function listAttempts(limit = 100): Promise<TestAttempt[]> {
  return unwrap(await supabase.from("test_attempts").select("*").order("created_at", { ascending: false }).limit(limit)) as TestAttempt[];
}
export async function logSession(kind: string, items: number, correct: number, minutes: number) {
  const user_id = await uid();
  unwrap(await supabase.from("learning_sessions").insert({ user_id, kind, items, correct: Math.min(correct, items), minutes: Math.min(240, Math.max(0, Math.round(minutes * 10) / 10)) }));
  const earned = await supabase.rpc("check_achievements");
  return (earned.data as string[] | null) ?? [];
}
export async function dashboard() { return unwrap(await supabase.rpc("my_dashboard")) as Dashboard; }
export type Dashboard = {
  streak: number; words_learned: number; words_mastered: number; words_due: number; vocab_total: number; lessons_done: number; lessons_mastered: number; lessons_total: number;
  mistakes_open: number; today_minutes: number; today_items: number; recent_tests: { id: string; title: string; kind: string; score: number; max_score: number; created_at: string }[];
  week: { day: string; minutes: number; items: number; correct: number }[];
};
export async function achievements() {
  const all = unwrap(await supabase.from("achievements").select("*").order("sort")) as { id: string; name: string; description: string; icon: string }[];
  const mine = unwrap(await supabase.from("user_achievements").select("achievement_id, earned_at")) as { achievement_id: string; earned_at: string }[];
  const m = new Map(mine.map((x) => [x.achievement_id, x.earned_at]));
  return all.map((a) => ({ ...a, earned_at: m.get(a.id) ?? null }));
}
export async function sessionsHistory(days = 60) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return unwrap(await supabase.from("learning_sessions").select("kind, items, correct, minutes, day, created_at").gte("created_at", since).order("created_at", { ascending: false })) as { kind: string; items: number; correct: number; minutes: number; day: string; created_at: string }[];
}

// ---------- profile ----------
export async function updateProfile(p: Partial<Pick<Profile, "display_name" | "level" | "daily_goal_min" | "theme">>) {
  const id = await uid();
  unwrap(await supabase.from("profiles").update(p).eq("id", id));
}

// ---------- helpers ----------
export function shuffle<T>(a: T[]): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
