// Answer checking & error diagnosis (pure functions – unit tested)
export type CheckResult = { ok: boolean; close?: boolean; empty?: boolean };
export type Diagnosis = { type: ErrorType; label: string; best?: string; note: string };
export type ErrorType = "empty" | "typo" | "form" | "coll" | "word" | "missing" | "extra" | "order" | "choice";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");

/** Canonical form: case, punctuation, quotes, contractions, BrE/AmE spelling, Polish diacritics. */
export function canon(input: string): string {
  let s = String(input ?? "").toLowerCase()
    .replace(/[’‘`´]/g, "'").replace(/[“”„]/g, '"').replace(/[–—]/g, "-");
  s = s.replace(/^["'\s]+|["'\s.!?,;:]+$/g, "").replace(/[,;:!?]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\bcan't\b/g, "can not").replace(/\bcannot\b/g, "can not").replace(/\bwon't\b/g, "will not")
    .replace(/\bshan't\b/g, "shall not").replace(/n't\b/g, " not").replace(/'re\b/g, " are").replace(/'ve\b/g, " have")
    .replace(/'m\b/g, " am").replace(/'ll\b/g, " will").replace(/\bit's\b/g, "it is");
  // British / American spelling variants map to one form
  s = s.replace(/our\b/g, "or").replace(/is(e|ed|es|ing|ation|ations)\b/g, "iz$1").replace(/ys(e|ed|es|ing)\b/g, "yz$1")
    .replace(/scept/g, "skept").replace(/tre\b/g, "ter").replace(/ll(ed|ing)\b/g, "l$1").replace(/ogue\b/g, "og");
  return strip(s).replace(/\s+/g, " ").trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Placeholders like sb/sth/someone are optional in fixed phrases. */
export const stripPlaceholders = (s: string) =>
  canon(s).replace(/\b(something|someone|somebody|sth|sb|one's|someone's)\b/g, " ").replace(/\.\.\./g, " ").replace(/\s+/g, " ").trim();

export function checkText(input: string, answers: string[]): CheckResult {
  const u = canon(input);
  if (!u) return { ok: false, empty: true };
  const list = answers.map(canon);
  if (list.includes(u)) return { ok: true };
  const up = stripPlaceholders(input);
  if (answers.some((a) => stripPlaceholders(a) === up && up.length > 0)) return { ok: true };
  let best = Infinity;
  for (const a of list) best = Math.min(best, levenshtein(u, a));
  return { ok: false, close: (best <= 1 && u.length > 3) || (best <= 2 && u.length > 7) };
}

const commonPrefix = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };

export const ERROR_LABELS: Record<ErrorType, string> = {
  empty: "Brak odpowiedzi", typo: "Literówka", form: "Zła forma gramatyczna", coll: "Niepoprawna kolokacja / niewłaściwe słowo w wyrażeniu",
  word: "Niewłaściwe słowo lub wyrażenie", missing: "Brakujące słowo", extra: "Zbędne słowo", order: "Zły szyk wyrazów", choice: "Zła odpowiedź",
};

/** Explain *what* is wrong, without AI – used for the mandatory correction loop. */
export function diagnose(input: string, answers: string[]): Diagnosis {
  const clean = answers.filter(Boolean);
  if (!String(input ?? "").trim()) return { type: "empty", label: ERROR_LABELS.empty, best: clean[0], note: "Nie podałeś odpowiedzi – przeczytaj wyjaśnienie i spróbuj ją sobie przypomnieć." };
  const u = canon(input);
  let best = clean[0] ?? "", bd = Infinity;
  for (const a of clean) { const d = levenshtein(u, canon(a)); if (d < bd) { bd = d; best = a; } }
  const a = canon(best);
  const uw = u.split(" "), aw = a.split(" ");
  const isSuffixChange = (x: string, y: string) => x !== y && (y.startsWith(x) || x.startsWith(y)) && Math.min(x.length, y.length) >= 3 && /^(s|es|ed|d|ing|ly|er|est|en|ment|ness|tion|ation|ity|ive|al|ful|less|able|ible)$/.test(y.length > x.length ? y.slice(x.length) : x.slice(y.length));
  if (uw.length === aw.length) {
    const diffIdx = aw.map((w, i) => (w !== uw[i] ? i : -1)).filter((i) => i >= 0);
    if (diffIdx.length === 1 && isSuffixChange(uw[diffIdx[0]], aw[diffIdx[0]]))
      return { type: "form", label: ERROR_LABELS.form, best, note: `„${uw[diffIdx[0]]}” zamiast „${aw[diffIdx[0]]}” – właściwe słowo w złej formie (końcówka, czas, liczba lub część mowy).` };
  }
  if (bd <= 2 && a.length > 3 && bd < a.length / 3 && uw.length === aw.length)
    return { type: "typo", label: ERROR_LABELS.typo, best, note: "Odpowiedź jest prawie poprawna, ale różni się pisownią. Na egzaminie błąd ortograficzny kosztuje punkt." };
  if (uw.length === aw.length && aw.length > 1) {
    const diff = aw.map((w, i) => (w !== uw[i] ? i : -1)).filter((i) => i >= 0);
    if (diff.length === 1) {
      const i = diff[0];
      if (commonPrefix(uw[i], aw[i]) >= Math.min(4, aw[i].length - 1))
        return { type: "form", label: ERROR_LABELS.form, best, note: `„${uw[i]}” zamiast „${aw[i]}” – właściwe słowo w złej formie (końcówka, czas, liczba lub część mowy).` };
      return { type: "coll", label: ERROR_LABELS.coll, best, note: `„${uw[i]}” zamiast „${aw[i]}”. Reszta wyrażenia jest dobra, ale w tym połączeniu używa się słowa „${aw[i]}”.` };
    }
    if ([...aw].sort().join(" ") === [...uw].sort().join(" ")) return { type: "order", label: ERROR_LABELS.order, best, note: "Wszystkie słowa są właściwe, ale w złej kolejności." };
  }
  const aSet = new Set(aw), uSet = new Set(uw);
  const missing = aw.filter((w) => !uSet.has(w)), extra = uw.filter((w) => !aSet.has(w));
  if (aw.length > 1 && missing.length && !extra.length) return { type: "missing", label: ERROR_LABELS.missing, best, note: `Brakuje: „${missing.join(" ")}”.` };
  if (extra.length && !missing.length) return { type: "extra", label: ERROR_LABELS.extra, best, note: `Zbędne: „${extra.join(" ")}”.` };
  if (aw.length === 1 && uw.length === 1 && commonPrefix(u, a) >= Math.min(5, a.length - 2))
    return { type: "form", label: ERROR_LABELS.form, best, note: "Rdzeń słowa się zgadza, ale forma jest inna – sprawdź końcówkę, część mowy albo liczbę." };
  if (aw.length > 1 && missing.length && extra.length && missing.length < aw.length)
    return { type: "coll", label: ERROR_LABELS.coll, best, note: `„${extra.join(" ")}” zamiast „${missing.join(" ")}”.` };
  return { type: "word", label: ERROR_LABELS.word, best, note: "Twoja odpowiedź ma inne znaczenie albo nie pasuje do kontekstu." };
}

/** Progressive hint that never reveals the whole answer. */
export function hint(answer: string, level: number): string {
  return String(answer).split(" ").map((w) => {
    const n = Math.max(1, Math.min(w.length - 1, level));
    return w.slice(0, n) + "_".repeat(Math.max(0, w.length - n));
  }).join(" ");
}

/** Character / word diff segments for highlighting. */
export function diffSegments(user: string, right: string): { u: Seg[]; r: Seg[] } {
  const uw = user.trim().split(/\s+/), rw = right.trim().split(/\s+/);
  if (uw.length > 1 && uw.length === rw.length) {
    const map = (a: string[], b: string[]) => a.flatMap((w, i) => [{ t: w, bad: w.toLowerCase() !== b[i].toLowerCase() }, { t: " ", bad: false }]).slice(0, -1);
    return { u: map(uw, rw), r: map(rw, uw) };
  }
  const ul = user.toLowerCase(), rl = right.toLowerCase();
  const p = commonPrefix(ul, rl);
  let s = 0; while (s < ul.length - p && s < rl.length - p && ul[ul.length - 1 - s] === rl[rl.length - 1 - s]) s++;
  const seg = (x: string) => [{ t: x.slice(0, p), bad: false }, { t: x.slice(p, x.length - s) || "‸", bad: true }, { t: x.slice(x.length - s), bad: false }];
  return { u: seg(user), r: seg(right) };
}
export type Seg = { t: string; bad: boolean };

/** Map a diagnosis to a Mistake Notebook category. */
export function mistakeCategory(d: Diagnosis, fallback: MistakeCategory, answer = ""): MistakeCategory {
  if (d.type === "typo") return "spelling";
  if (d.type === "order") return "word_order";
  if (d.type === "coll") return fallback === "phrasal_verbs" ? "phrasal_verbs" : "collocations";
  const a = canon(answer);
  if (/^(a|an|the)$/.test(a)) return "articles";
  if (/^(in|on|at|of|for|to|with|by|from|about|into|over|under)$/.test(a)) return "prepositions";
  return fallback;
}
export type MistakeCategory = "vocabulary" | "grammar" | "spelling" | "articles" | "prepositions" | "word_order" | "collocations" | "phrasal_verbs" | "word_formation";
