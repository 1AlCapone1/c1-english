import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { U1, U2 } from "./helpers";

const url = process.env.VITE_SUPABASE_URL!, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
async function client(u: { email: string; password: string }) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword(u); if (error) throw error;
  return c;
}
test("users only see their own private data", async () => {
  const a = await client(U1), b = await client(U2);
  const aId = (await a.auth.getUser()).data.user!.id;
  await a.from("mistakes").insert({ category: "grammar", source: "e2e", prompt: "rls-probe", correct_answer: "x" });
  const seen = await b.from("mistakes").select("id").eq("user_id", aId);
  expect(seen.data ?? []).toHaveLength(0);
  const prof = await b.from("profiles").select("id");
  expect((prof.data ?? []).every((p) => p.id !== aId)).toBe(true);
  await a.from("mistakes").delete().eq("prompt", "rls-probe");
});
test("a user cannot make themselves admin or edit content", async () => {
  const b = await client(U2);
  const id = (await b.auth.getUser()).data.user!.id;
  const up = await b.from("profiles").update({ role: "admin" }).eq("id", id).select();
  expect(up.error).not.toBeNull();
  const ins = await b.from("vocabulary").insert({ term: "hack", kind: "word", category: "academic", translation_pl: "x", example: "*hack*" }).select();
  expect(ins.data ?? []).toHaveLength(0);
  const stats = await b.rpc("admin_stats");
  expect(stats.error).not.toBeNull();
});
test("anonymous visitors cannot read content or user data", async () => {
  const anon = createClient(url, key, { auth: { persistSession: false } });
  const v = await anon.from("vocabulary").select("id").limit(1);
  expect(v.data ?? []).toHaveLength(0);
  const m = await anon.from("mistakes").select("id").limit(1);
  expect(m.data ?? []).toHaveLength(0);
});
