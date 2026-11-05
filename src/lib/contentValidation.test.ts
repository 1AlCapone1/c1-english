import { describe, it, expect } from "vitest";
import { validateRecord } from "./contentValidation";
describe("content validation", () => {
  it("rejects a choice exercise whose key is not an option", () => expect(validateRecord("exercises", { module: "use_of_english", task_type: "mc_cloze", instruction: "x", explanation: "y", prompt: { question: "a ___ b", options: ["one", "two"] }, answers: ["three"] }).length).toBeGreaterThan(0));
  it("accepts a valid open cloze item", () => expect(validateRecord("exercises", { module: "use_of_english", task_type: "open_cloze", instruction: "x", explanation: "y", prompt: { question: "good ___ maths" }, answers: ["at"] })).toEqual([]));
  it("requires the keyword in transformations", () => expect(validateRecord("exercises", { module: "use_of_english", task_type: "kwt", instruction: "x", explanation: "y", prompt: { question: "q", keyword: "SAID", sentence2: "He ___ rich." }, answers: ["is believed to be"] }).length).toBeGreaterThan(0));
  it("requires 10 examples in a lesson", () => expect(validateRecord("grammar_lessons", { slug: "a", area: "b", title: "c", content: { explanation: "x", usage: "y", structure: { scheme: "s", affirmative: ["a"], negative: ["n"], questions: ["q"] }, examples: [], comparison: [1], mistakes: [1], exceptions: [1] } }).join(" ")).toContain("10"));
});
