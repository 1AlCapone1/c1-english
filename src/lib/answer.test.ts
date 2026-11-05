import { describe, it, expect } from "vitest";
import { canon, checkText, diagnose, hint, mistakeCategory } from "./answer";
import { nextState, cardStatus } from "./srs";

describe("canon", () => {
  it("ignores case, punctuation and quotes", () => expect(canon("  Hello, World! ")).toBe(canon("hello world")));
  it("treats BrE and AmE spelling the same", () => { expect(canon("criticised")).toBe(canon("criticized")); expect(canon("behaviour")).toBe(canon("behavior")); });
  it("expands contractions", () => expect(canon("can't have taken")).toBe(canon("cannot have taken")));
  it("strips Polish diacritics", () => expect(canon("szkodliwy")).toBe(canon("szkodliwy")));
});
describe("checkText", () => {
  it("accepts any listed variant", () => expect(checkText("Despite", ["despite", "in spite of"]).ok).toBe(true));
  it("rejects wrong grammatical form even with the right word", () => expect(checkText("having finish", ["having finished"]).ok).toBe(false));
  it("flags near misses as close but not correct", () => { const r = checkText("meticulus", ["meticulous"]); expect(r.ok).toBe(false); expect(r.close).toBe(true); });
  it("accepts optional placeholders", () => expect(checkText("take with a pinch of salt", ["take something with a pinch of salt"]).ok).toBe(true));
  it("reports empty input", () => expect(checkText("  ", ["x"]).empty).toBe(true));
});
describe("diagnose", () => {
  it("detects typos", () => expect(diagnose("meticulus", ["meticulous"]).type).toBe("typo"));
  it("detects wrong collocation word", () => expect(diagnose("make a balance", ["strike a balance"]).type).toBe("coll"));
  it("detects wrong form", () => expect(diagnose("would have help", ["would have helped"]).type).toBe("form"));
  it("detects missing words", () => expect(diagnose("carry", ["carry out"]).type).toBe("missing"));
  it("detects word order", () => expect(diagnose("i have seen never", ["i have never seen"]).type).toBe("order"));
});
describe("hint", () => it("never reveals the full answer", () => { expect(hint("meticulous", 1)).toBe("m_________"); expect(hint("carry out", 2)).toBe("ca___ ou_"); }));
describe("mistakeCategory", () => {
  it("maps typos to spelling", () => expect(mistakeCategory(diagnose("recieve", ["receive"]), "vocabulary", "receive")).toBe("spelling"));
  it("maps prepositions", () => expect(mistakeCategory(diagnose("in", ["at"]), "grammar", "at")).toBe("prepositions"));
});
describe("srs", () => {
  it("promotes on first-try success", () => expect(nextState({ box: 1, correct: 1, wrong: 0 }, true).box).toBe(2));
  it("resets on failure", () => expect(nextState({ box: 5, correct: 5, wrong: 0 }, false).box).toBe(0));
  it("does not promote hinted answers", () => expect(nextState({ box: 2, correct: 1, wrong: 0 }, true, true).box).toBe(2));
  it("classifies mastered", () => expect(cardStatus({ box: 4, correct: 4, wrong: 0, due_at: new Date().toISOString() })).toBe("mastered"));
});
