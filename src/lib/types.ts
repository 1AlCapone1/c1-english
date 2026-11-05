export type Level = "B2" | "C1" | "C2";
export type Kind = "word" | "phrasal_verb" | "idiom" | "collocation" | "fixed_expression" | "linking" | "word_formation" | "confused";
export type Vocab = {
  id: string; term: string; kind: Kind; category: string; pos: string | null; ipa: string | null; level: Level;
  translation_pl: string; definition: string | null; example: string; example_pl: string | null;
  collocations: string[]; synonyms: string[]; antonyms: string[]; register: "neutral" | "formal" | "informal" | "academic"; usage_note: string | null;
};
export type Progress = { vocab_id: string; box: number; due_at: string; correct: number; wrong: number; last_attempts: number; last_mode: string | null };
export type Profile = { id: string; display_name: string; role: "user" | "admin"; level: Level; daily_goal_min: number; theme: "system" | "light" | "dark"; created_at: string };
export type TaskType = "mc" | "gap" | "open_cloze" | "mc_cloze" | "word_formation" | "kwt" | "error" | "translation" | "matching" | "tfng";
export type Exercise = {
  id: string; module: string; task_type: TaskType; grammar_lesson_id: string | null; reading_id: string | null; listening_id?: string | null; topic: string | null; level: Level;
  instruction: string; prompt: ExercisePrompt; answers: string[]; explanation: string; distractor_notes: Record<string, string> | null; position: number;
};
/** prompt shapes: mc/tfng/matching: {question, options}; gap/open_cloze/word_formation/error/translation: {question}; kwt: {question, keyword, sentence2} */
export type ExercisePrompt = { question: string; options?: string[]; keyword?: string; sentence2?: string; base?: string };
export type GrammarContent = {
  explanation: string; usage: string; structure: { scheme: string; affirmative: string[]; negative: string[]; questions: string[]; word_order?: string };
  examples: { en: string; pl: string; why: string }[]; comparison: { vs: string; difference: string; when: string }[];
  mistakes: { wrong: string; right: string; why: string }[]; exceptions: string[]; advanced?: { en: string; pl: string; note: string }[];
};
export type GrammarLesson = { id: string; slug: string; area: string; title: string; position: number; content: GrammarContent; published: boolean };
export type Reading = { id: string; title: string; topic: string; level: Level; body: string; glossary: { term: string; pl: string }[]; word_count: number };
export type Listening = { id: string; title: string; topic: string; transcript: string; audio_path: string | null; glossary: { term: string; pl: string }[]; published: boolean };
export type WritingGuide = { id: string; type: "essay" | "report" | "proposal" | "review" | "letter"; title: string; content: {
  requirements: string; structure: { part: string; content: string }[]; phrases: { en: string; pl: string }[]; sample: { task: string; text: string }; criteria: { name: string; description: string }[]; tasks: string[];
} };
export type SpeakingTask = { id: string; type: string; title: string; prompt: string; model_answer: string; phrases: { en: string; pl: string }[] };
export type Mistake = { id: string; category: string; source: string; prompt: string; user_answer: string | null; correct_answer: string; explanation: string | null; times: number; mastered: boolean; created_at: string; last_seen_at: string; vocab_id: string | null; exercise_id: string | null };
export type TestAttempt = { id: string; kind: string; title: string; score: number; max_score: number; duration_sec: number | null; details: any; created_at: string };

export const KIND_LABEL: Record<Kind, string> = { word: "Słowo", phrasal_verb: "Phrasal verb", idiom: "Idiom", collocation: "Kolokacja", fixed_expression: "Wyrażenie stałe", linking: "Łącznik", word_formation: "Word formation", confused: "Mylone słowa" };
export const CATEGORIES: Record<string, string> = {
  education: "Education", work: "Work and careers", business: "Business and economics", politics: "Politics and society", science: "Science and technology",
  environment: "Environment", health: "Health and psychology", media: "Media and communication", culture: "Culture and art", relationships: "Relationships",
  law: "Crime and law", globalisation: "Globalisation", travel: "Travel and tourism", personal: "Personal development", academic: "Academic English",
  formal: "Formal English", idioms: "Idioms and expressions", phrasal: "Phrasal verbs", collocations: "Collocations", word_formation: "Word formation",
};
export const REGISTER_LABEL = { neutral: "neutralny", formal: "formalny", informal: "potoczny", academic: "akademicki" } as const;
