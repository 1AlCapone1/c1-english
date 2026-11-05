// Validates every seed file in content/seed against the same rules the admin panel uses.
// Run: node --experimental-strip-types scripts/validate-content.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateRecord, type TableName } from "../src/lib/contentValidation.ts";

const dir = join(import.meta.dirname, "..", "content", "seed");
let bad = 0, total = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const table = file.replace(/\.json$/, "").replace(/^\d+_/, "") as TableName;
  const rows = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>[];
  const keys = new Set<string>();
  rows.forEach((r, i) => {
    total++;
    const problems = validateRecord(table, r);
    const key = table === "vocabulary" ? `${String(r.term).toLowerCase()}|${r.kind}` : table === "exercises" ? JSON.stringify([r.prompt, r.answers]) : String(r.slug ?? r.title ?? r.type);
    if (keys.has(key)) problems.push(`Duplikat: ${key}`);
    keys.add(key);
    if (problems.length) { bad++; console.log(`${file}#${i} (${String(r.term ?? r.title ?? r.slug ?? "")}): ${problems.join(" ")}`); }
  });
  console.log(`${file}: ${rows.length} rekordów`);
}
console.log(`Razem ${total}, błędnych ${bad}`);
if (bad) process.exit(1);
